import { isHash32 } from "../utils/callId";
import { classifyProviderError } from "../utils/operationStatus";
import type { PaymentOperations } from "./paymentOperations";

/**
 * Sends one payment and waits for its outcome, without ever putting the owner in
 * a position where they can pay twice.
 *
 * The SDK's `sendCalls` is three requests: prepare, sign, send. Its id only
 * exists after the last one answers, and the old code stored nothing until then:
 * an app closed, or a connection lost, between "send" and its answer left a
 * payment that might be on its way with no record at all. Here the intent is
 * written first, with the user operation hash the prepare step already returned
 * (details.data.hash), so the chain can be asked about that payment even if no
 * call id ever came back.
 *
 * The caller holds the wallet's lock.
 */

export interface SubmissionClient {
  prepareCalls(params: Record<string, unknown>): Promise<any>;
  signPreparedCalls(prepared: any): Promise<any>;
  sendPreparedCalls(params: Record<string, unknown>): Promise<{ id: string }>;
  sendCalls(params: Record<string, unknown>): Promise<{ id: string }>;
}

export interface SubmissionCall {
  target: `0x${string}`;
  value?: bigint;
  data: string;
}

export interface SubmissionResult {
  hash: string;
  userOpHash?: string;
  success: true;
}

export type SubmissionError = Error & {
  isPendingVerification?: boolean;
  /** The provider or the chain said, explicitly, that this payment did not happen. */
  definitiveFailure?: boolean;
  /** Nothing left this phone. */
  notSent?: boolean;
};

export interface SubmissionOptions {
  client: SubmissionClient;
  ops: PaymentOperations;
  account: string;
  calls: SubmissionCall[];
  overrides?: Record<string, unknown>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** How long to wait for confirmation before leaving it to Activity. */
  waitMs?: number;
  pollMs?: number;
}

export const fingerprintOf = (calls: SubmissionCall[]): string =>
  JSON.stringify(calls.map((call) => [call.target.toLowerCase(), String(call.value ?? 0n), call.data.toLowerCase()]));

const failure = (message: string, flags: Partial<SubmissionError>): SubmissionError =>
  Object.assign(new Error(message), flags);

/**
 * True only when the provider ANSWERED with a refusal, so nothing was accepted.
 * A timeout, a dropped connection or a server error may have come after the
 * request was accepted, so it is not a refusal.
 */
export const wasRefused = (error: unknown): boolean => {
  const info = classifyProviderError(error);
  if (info.kind === "timeout" || info.kind === "network" || info.kind === "server" || info.kind === "busy") return false;
  if (info.code !== undefined) return true;
  return info.status !== undefined && info.status >= 400 && info.status < 500;
};

/** The capabilities `sendPreparedCalls` takes are the paymaster and permissions parts only. */
const capabilitiesForSending = (overrides?: Record<string, unknown>) => {
  if (!overrides || (overrides.permissions == null && overrides.paymaster == null)) return undefined;
  const paymaster = overrides.paymaster as { policyId?: string; policyIds?: string[]; webhookData?: string } | undefined;
  return {
    permissions: overrides.permissions,
    paymaster: paymaster
      ? { ...("policyId" in paymaster ? { policyId: paymaster.policyId } : { policyIds: paymaster.policyIds }), webhookData: paymaster.webhookData }
      : undefined,
  };
};

const USER_OPERATIONS = new Set(["user-operation-v060", "user-operation-v070"]);

export const submitAndConfirm = async (options: SubmissionOptions): Promise<SubmissionResult> => {
  const { client, ops, account, calls, overrides } = options;
  const now = options.now ?? (() => Date.now());
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const waitMs = options.waitMs ?? 120_000;
  const pollMs = options.pollMs ?? 2_500;
  const fingerprint = fingerprintOf(calls);

  // 1. Is this account free to pay? This also recognises an earlier payment that has since gone through.
  const gate = await ops.inLock.beforeSend(account, fingerprint);
  if (gate.action === "reuse") return { hash: gate.transactionHash, success: true };
  if (gate.action === "blocked") {
    throw failure(gate.message, gate.reason === "unreadable" ? { notSent: true } : { isPendingVerification: true, notSent: true });
  }

  const wire = calls.map((call) => ({ to: call.target, value: call.value ?? 0n, data: call.data }));
  const request = { account, calls: wire, ...(overrides ? { capabilities: overrides } : {}) };

  // 2. Prepare. Nothing is committed yet, so a failure here leaves nothing behind.
  const prepared: any = await client.prepareCalls(request);
  const preparedHash = USER_OPERATIONS.has(prepared?.type) && isHash32(prepared?.details?.data?.hash) ? (prepared.details.data.hash as string) : undefined;

  // 3. Write the intent, THEN sign and send.
  await ops.inLock.begin(account, { fingerprint, userOpHash: preparedHash });

  let id: string;
  try {
    if (preparedHash) {
      // Signing happens on this phone: a failure here (the owner declining, the signer unavailable) sent nothing.
      let signed: any;
      try {
        signed = await client.signPreparedCalls(prepared);
      } catch (error) {
        await ops.inLock.abandon(account);
        throw error;
      }
      const capabilities = capabilitiesForSending(overrides);
      ({ id } = await client.sendPreparedCalls({ ...signed, ...(capabilities ? { capabilities } : {}) }));
    } else {
      // A shape this code does not split (e.g. an ERC-20 paymaster permit): the SDK does it whole.
      ({ id } = await client.sendCalls(request));
    }
  } catch (error) {
    if (!(await ops.peek(account))) throw error; // already abandoned above
    if (wasRefused(error)) {
      await ops.inLock.abandon(account);
      throw error;
    }
    // The request may have been accepted. Keep the intent; the chain can settle it.
    const info = classifyProviderError(error);
    await ops.inLock.addEvidence(account, [
      {
        at: now(),
        source: "send",
        result: "error",
        note: `the request to send it ended with an error: ${info.summary}`,
        ...(info.code !== undefined ? { code: info.code } : {}),
        ...(info.status !== undefined ? { status: info.status } : {}),
      },
    ]);
    throw Object.assign(error as Error, { isPendingVerification: true });
  }

  try {
    await ops.inLock.markSubmitted(account, { id });
  } catch {
    // The intent, with its hash, is already stored; the chain can still settle it.
  }

  // 4. Wait for the outcome, asking the provider (the chain is asked once, at the end).
  const deadline = now() + waitMs;
  for (;;) {
    const last = now() >= deadline;
    const report = await ops.inLock.check(account, { useChain: last });
    if (report.status === "confirmed") {
      return { hash: report.ids.transactionHash as string, ...(report.ids.userOpHash ? { userOpHash: report.ids.userOpHash } : {}), success: true };
    }
    if (report.status === "failed") {
      await ops.inLock.abandon(account);
      throw failure(report.reason, { definitiveFailure: true });
    }
    if (report.status === "foreign") {
      throw failure("A saved payment record does not match this wallet or network. Open Activity.", { isPendingVerification: true });
    }
    if (last) {
      throw failure("Payment sent. It has not been confirmed yet, so it is still being verified. Open Activity before sending anything else.", {
        isPendingVerification: true,
      });
    }
    await sleep(pollMs);
  }
};
