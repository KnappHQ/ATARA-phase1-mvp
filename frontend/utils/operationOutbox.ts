/**
 * A payment that is proven on the chain and not yet recorded by ATARA's service.
 *
 * Recording is a separate step from paying. The transfer has already happened
 * and cannot be undone or repeated by anything here; what is left is telling the
 * service, so it appears in history with its note and settles a group debt. When
 * that step fails (the service is down, the phone is offline, the chain is not
 * yet confirmed enough for the service), the entry stays on the phone and only
 * the recording is retried. The transfer is never sent again.
 *
 * The service is idempotent per transaction hash, so retrying is always safe.
 */

import type { Evidence } from "./operationStatus";

export const OUTBOX_PREFIX = "atara.recording.";

export type RecordingState = "queued" | "recorded" | "rejected";

export interface OutboxEntry {
  v: 1;
  chainId: number;
  /** The sender's smart account, lower case. */
  account: string;
  userId?: string | null;
  transactionHash: string;
  receiverAddress: string;
  assetSymbol: string;
  /** Decimal, for display. */
  amount?: string;
  rawAmountWei?: string;
  recipientHandle?: string | null;
  recipientName?: string | null;
  note?: string | null;
  category?: string;
  confirmedAt: number;
  attempts: number;
  lastAttemptAt?: number;
  /** HTTP status of the last attempt, when there was one. */
  lastStatus?: number;
  /** A fixed phrase, never a raw error. */
  lastReason?: string;
  state: RecordingState;
  backendTransactionId?: string;
  /** How it was proven, kept with it. */
  proof?: Evidence[];
}

export const outboxKey = (chainId: number, account: string, transactionHash: string): string =>
  `${OUTBOX_PREFIX}${chainId}.${account.toLowerCase()}.${transactionHash.toLowerCase()}`;

export const outboxPrefixFor = (chainId: number, account: string): string =>
  `${OUTBOX_PREFIX}${chainId}.${account.toLowerCase()}.`;

const HASH = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export const parseOutboxEntry = (stored: string | null | undefined): OutboxEntry | null => {
  if (!stored) return null;
  try {
    const raw = JSON.parse(stored) as Partial<OutboxEntry> | null;
    if (
      !raw ||
      raw.v !== 1 ||
      typeof raw.chainId !== "number" ||
      typeof raw.account !== "string" ||
      !HASH.test(String(raw.transactionHash)) ||
      !ADDRESS.test(String(raw.receiverAddress)) ||
      typeof raw.assetSymbol !== "string"
    ) {
      return null;
    }
    return {
      ...raw,
      v: 1,
      account: raw.account.toLowerCase(),
      transactionHash: String(raw.transactionHash).toLowerCase(),
      confirmedAt: typeof raw.confirmedAt === "number" ? raw.confirmedAt : 0,
      attempts: typeof raw.attempts === "number" ? raw.attempts : 0,
      state: raw.state === "recorded" || raw.state === "rejected" ? raw.state : "queued",
    } as OutboxEntry;
  } catch {
    return null;
  }
};

/** Waits longer after each failure, up to a quarter of an hour, so a down service is not hammered. */
export const backoffMs = (attempts: number): number =>
  Math.min(15 * 60 * 1000, 15_000 * 2 ** Math.max(0, attempts - 1));

export const dueForRetry = (entry: OutboxEntry, now: number, force = false): boolean =>
  entry.state === "queued" && (force || entry.lastAttemptAt === undefined || now - entry.lastAttemptAt >= backoffMs(entry.attempts));

/** What the service answered to a recording request, reduced to what decides the next step. */
export type RecordingOutcome =
  | { kind: "recorded"; backendTransactionId: string }
  | { kind: "retry"; status?: number; reason: string }
  | { kind: "rejected"; status: number; reason: string };

/**
 * The service's answers, sorted. Only an explicit refusal that retrying cannot
 * change stops the retries; everything else (offline, 5xx, "waiting for
 * confirmations", an expired session) is a reason to try again later.
 */
export const interpretRecordingResponse = (response: { status?: number; message?: string } | null, sessionOk = true): RecordingOutcome => {
  if (!response) return { kind: "retry", reason: sessionOk ? "The service could not be reached." : "Sign in to finish recording it." };
  const status = response.status;
  const message = (response.message ?? "").toLowerCase();
  if (status === 409 && message.includes("another transfer")) {
    return { kind: "rejected", status, reason: "The service already holds a different payment under this transaction." };
  }
  if (status === 400 && message.includes("failed on-chain")) {
    return { kind: "rejected", status, reason: "The service reports that transaction as failed." };
  }
  if (status === 400 && (message.includes("unambiguous") || message.includes("unsupported token"))) {
    return { kind: "rejected", status, reason: "The service cannot match this transfer automatically." };
  }
  if (status === 202 || status === 404 || status === 409) {
    return { kind: "retry", status, reason: "The service is still waiting for the network to confirm it." };
  }
  if (typeof status === "number" && status >= 500) return { kind: "retry", status, reason: "The service had an error." };
  if (status === 401 || status === 403) return { kind: "retry", status, reason: "Sign in again to finish recording it." };
  return { kind: "retry", ...(status !== undefined ? { status } : {}), reason: "The service did not accept it yet." };
};
