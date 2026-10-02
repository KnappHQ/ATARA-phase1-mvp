import type { ChainAnswer, ChainSearch, TransferCheck } from "./userOperationChain";
import { isHash32 } from "../utils/callId";
import {
  KEY_PREFIX,
  checkOwnership,
  completeRecord,
  isUnresolved,
  keyForOperation,
  ownerFromKey,
  parseOperationRecord,
  paymentIdentity,
  paymentOf,
  releaseAllowed,
  serializeOperationRecord,
  type OperationRecord,
  type UnresolvedKind,
} from "../utils/operationRecord";
import {
  OUTBOX_PREFIX,
  dueForRetry,
  outboxKey,
  outboxPrefixFor,
  parseOutboxEntry,
  type OutboxEntry,
  type RecordingOutcome,
} from "../utils/operationOutbox";
import {
  appendEvidence,
  classifyProviderError,
  interpretCallsStatus,
  isDefinitelyUnknownToProvider,
  type Evidence,
} from "../utils/operationStatus";
import type { PendingPayment } from "../utils/pendingOperation";

/**
 * Everything that decides what a phone believes about a payment it has sent.
 *
 * This is the one place that reads a pending payment, asks the wallet provider
 * and the chain about it, and changes what is stored. Every collaborator is
 * passed in, so that closing the app in the middle of a payment, losing the
 * network, the provider forgetting an id, the ATARA service being down, or two
 * accounts on one phone can each be replayed in a test with nothing real.
 *
 * The rules it keeps, each of which has a test:
 *  - A payment is "failed" only when the provider or the chain says explicitly
 *    that it did not happen. Silence, an error, a timeout, "unknown id" and "no
 *    trace in the blocks searched" leave it unresolved, and unresolved blocks
 *    the next payment.
 *  - A record that cannot be read, or is under the wrong network or account, is
 *    never used for a payment and never deleted.
 *  - A confirmed transfer is queued for recording BEFORE its pending record is
 *    removed, and only the recording is ever retried. Nothing here can send the
 *    transfer again.
 */

export interface StorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
}

export interface ProviderStatusSource {
  /** `wallet_getCallsStatus`. Rejects with whatever the SDK rejects with. */
  getCallsStatus(input: { id: string }): Promise<unknown>;
}

export interface ChainReaderLike {
  findUserOperation(search: ChainSearch): Promise<ChainAnswer>;
}

export interface OperationsDeps {
  storage: StorageLike;
  chainId: number;
  provider?: ProviderStatusSource | null;
  chain?: ChainReaderLike | null;
  now?: () => number;
  /** Which asset a token contract is on this network, e.g. "USDC". */
  symbolForToken?: (token: string) => string | undefined;
  /** The ATARA user signed in now, recorded with what they send. */
  currentUserId?: () => string | null;
  /** For monitoring: an event name and small facts, never addresses or messages. */
  report?: (event: string, facts?: Record<string, string | number | boolean>) => void;
  /** Serializes work per wallet. Must reject when the wallet is already busy. */
  lock?: <T>(key: string, run: () => Promise<T>) => Promise<T>;
}

export type Ids = { callId?: string; userOpHash?: string; transactionHash?: string };

export type Verdict =
  | { status: "confirmed"; transactionHash: string; via: "provider" | "chain" }
  | { status: "failed"; reason: string; code?: number; transactionHash?: string; via: "provider" | "chain" }
  | { status: "pending"; via: "provider" }
  | { status: "unknown"; reason: "not-found" | "unreachable" | "no-source" | "inconclusive" };

export interface Reconciled {
  verdict: Verdict;
  evidence: Evidence[];
  transfer?: TransferCheck;
}

export type OperationReport =
  | { status: "none" }
  | { status: "foreign"; reason: "other-network" | "other-account" }
  | { status: "busy" }
  | {
      status: "confirmed";
      ids: Ids;
      evidence: Evidence[];
      payment: PendingPayment | null;
      /** "queued": ATARA will be told about it; "not-possible": what was paid is unknown. */
      recording: "queued" | "not-possible";
      via: "provider" | "chain";
    }
  | { status: "failed"; ids: Ids; evidence: Evidence[]; payment: PendingPayment | null; reason: string; code?: number }
  | {
      status: "pending" | "unknown";
      ids: Ids;
      evidence: Evidence[];
      payment: PendingPayment | null;
      createdAt?: number;
      releasable: boolean;
      /** Why nothing was concluded. */
      reason?: string;
    };

const idsOf = (record: OperationRecord): Ids => ({
  ...(record.id ? { callId: record.id } : {}),
  ...(record.userOpHash ? { userOpHash: record.userOpHash } : {}),
  ...(record.transactionHash ? { transactionHash: record.transactionHash } : {}),
});

const noLock = async <T>(_key: string, run: () => Promise<T>) => run();

export const createPaymentOperations = (deps: OperationsDeps) => {
  const now = deps.now ?? (() => Date.now());
  const lock = deps.lock ?? noLock;
  const lockKey = (account: string) => `${deps.chainId}:${account.toLowerCase()}`;
  const keyFor = (account: string) => keyForOperation(deps.chainId, account);
  const releasedKey = (account: string) => `atara.released-operations.${deps.chainId}.${account.toLowerCase()}`;
  const owner = (account: string) => ({ chainId: deps.chainId, account: account.toLowerCase() });

  // ------------------------------------------------------------ storage

  const readRecord = async (account: string): Promise<OperationRecord | null> => {
    const stored = await deps.storage.getItem(keyFor(account));
    return parseOperationRecord(stored, owner(account));
  };

  const writeRecord = (account: string, record: OperationRecord) =>
    deps.storage.setItem(keyFor(account), serializeOperationRecord(record));

  const clearRecord = (account: string) => deps.storage.removeItem(keyFor(account));

  // ------------------------------------------------------------ outbox

  const listOutbox = async (account: string): Promise<OutboxEntry[]> => {
    const prefix = outboxPrefixFor(deps.chainId, account);
    const keys = (await deps.storage.getAllKeys()).filter((key) => key.startsWith(prefix));
    const entries: OutboxEntry[] = [];
    for (const key of keys) {
      const entry = parseOutboxEntry(await deps.storage.getItem(key));
      if (entry && entry.state !== "recorded") entries.push(entry);
    }
    return entries.sort((a, b) => b.confirmedAt - a.confirmedAt);
  };

  const writeOutbox = (entry: OutboxEntry) =>
    deps.storage.setItem(outboxKey(entry.chainId, entry.account, entry.transactionHash), JSON.stringify(entry));

  /** Queues a confirmed transfer for recording. Idempotent per transaction hash. */
  const queueRecording = async (
    account: string,
    input: {
      transactionHash: string;
      payment: PendingPayment;
      proof: Evidence[];
      recipientHandle?: string | null;
      recipientName?: string | null;
      note?: string | null;
      category?: string;
      amount?: string;
    },
  ): Promise<OutboxEntry> => {
    const existing = parseOutboxEntry(await deps.storage.getItem(outboxKey(deps.chainId, account, input.transactionHash)));
    if (existing) return existing;
    const assetSymbol = input.payment.token === null ? "ETH" : deps.symbolForToken?.(input.payment.token) ?? "";
    const entry: OutboxEntry = {
      v: 1,
      chainId: deps.chainId,
      account: account.toLowerCase(),
      userId: deps.currentUserId?.() ?? null,
      transactionHash: input.transactionHash.toLowerCase(),
      receiverAddress: input.payment.recipient,
      assetSymbol,
      rawAmountWei: input.payment.amount,
      ...(input.amount ? { amount: input.amount } : {}),
      ...(input.recipientHandle !== undefined ? { recipientHandle: input.recipientHandle } : {}),
      ...(input.recipientName !== undefined ? { recipientName: input.recipientName } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.category ? { category: input.category } : {}),
      confirmedAt: now(),
      attempts: 0,
      state: "queued",
      proof: input.proof.slice(-4),
    };
    await writeOutbox(entry);
    return entry;
  };

  /** Adds what only the payer's screen knows (note, handle) to an entry already queued. */
  const enrichRecording = async (
    account: string,
    transactionHash: string,
    patch: Partial<Pick<OutboxEntry, "note" | "category" | "recipientHandle" | "recipientName" | "amount">>,
  ) => {
    const key = outboxKey(deps.chainId, account, transactionHash);
    const entry = parseOutboxEntry(await deps.storage.getItem(key));
    if (!entry) return;
    await writeOutbox({ ...entry, ...patch });
  };

  /**
   * Tries to record each queued transfer with ATARA's service. `post` performs
   * the one request that records a transfer; nothing in here can pay anyone.
   */
  const flushRecordings = async (
    account: string,
    post: (entry: OutboxEntry) => Promise<RecordingOutcome>,
    options: { force?: boolean } = {},
  ): Promise<{ recorded: number; waiting: number; rejected: number; recordedIds: Record<string, string> }> => {
    const summary = { recorded: 0, waiting: 0, rejected: 0, recordedIds: {} as Record<string, string> };
    for (const entry of await listOutbox(account)) {
      if (entry.state === "rejected") {
        summary.rejected++;
        continue;
      }
      if (!dueForRetry(entry, now(), options.force)) {
        summary.waiting++;
        continue;
      }
      let outcome: RecordingOutcome;
      try {
        outcome = await post(entry);
      } catch {
        outcome = { kind: "retry", reason: "The service could not be reached." };
      }
      const next: OutboxEntry = { ...entry, attempts: entry.attempts + 1, lastAttemptAt: now() };
      if (outcome.kind === "recorded") {
        // A recorded entry has nothing left to hold.
        await deps.storage.removeItem(outboxKey(entry.chainId, entry.account, entry.transactionHash));
        summary.recorded++;
        summary.recordedIds[entry.transactionHash] = outcome.backendTransactionId;
      } else if (outcome.kind === "rejected") {
        await writeOutbox({ ...next, state: "rejected", lastStatus: outcome.status, lastReason: outcome.reason });
        summary.rejected++;
      } else {
        await writeOutbox({ ...next, lastReason: outcome.reason, ...(outcome.status !== undefined ? { lastStatus: outcome.status } : {}) });
        summary.waiting++;
      }
    }
    return summary;
  };

  // ------------------------------------------------------------ reconciling

  const paymentFor = (record: OperationRecord, transfer?: TransferCheck): PendingPayment | null => {
    const known = paymentOf(record);
    if (known) return known;
    if (transfer?.kind === "matched") return { recipient: transfer.recipient, amount: transfer.amount, token: transfer.token };
    return null;
  };

  /**
   * Asks each source in turn and reads their answers. Never throws: a source that
   * fails is a line of evidence, not a verdict.
   */
  const reconcile = async (
    record: OperationRecord,
    account: string,
    options: { useChain?: boolean } = {},
  ): Promise<Reconciled> => {
    const at = now();
    const evidence: Evidence[] = [];
    const payment = paymentOf(record);
    let providerSaidUnknown = false;
    let anySourceUsed = false;
    let anyUnreachable = false;

    if (deps.provider && record.id) {
      anySourceUsed = true;
      try {
        const verdict = interpretCallsStatus(await deps.provider.getCallsStatus({ id: record.id }));
        if (verdict.kind === "confirmed") {
          evidence.push({ at, source: "provider", result: "confirmed", note: "reports the payment as confirmed on the network" });
          return { verdict: { status: "confirmed", transactionHash: verdict.transactionHash, via: "provider" }, evidence };
        }
        if (verdict.kind === "failed") {
          evidence.push({ at, source: "provider", result: "failed", note: verdict.reason, code: verdict.statusCode });
          return {
            verdict: {
              status: "failed",
              reason: verdict.reason,
              code: verdict.statusCode,
              ...(verdict.transactionHash ? { transactionHash: verdict.transactionHash } : {}),
              via: "provider",
            },
            evidence,
          };
        }
        if (verdict.kind === "pending") {
          evidence.push({ at, source: "provider", result: "pending", note: "has the payment and is still processing it", code: verdict.statusCode });
          return { verdict: { status: "pending", via: "provider" }, evidence };
        }
        anyUnreachable = true;
        evidence.push({ at, source: "provider", result: "error", note: "sent a status this app does not understand", ...(verdict.statusCode !== undefined ? { code: verdict.statusCode } : {}) });
      } catch (error) {
        const info = classifyProviderError(error);
        if (isDefinitelyUnknownToProvider(info)) providerSaidUnknown = true;
        else anyUnreachable = true;
        evidence.push({
          at,
          source: "provider",
          result: isDefinitelyUnknownToProvider(info) ? "unknown" : "error",
          note: info.summary,
          ...(info.code !== undefined ? { code: info.code } : {}),
          ...(info.status !== undefined ? { status: info.status } : {}),
        });
        deps.report?.("payment-status-provider-error", { kind: info.kind, ...(info.code !== undefined ? { code: info.code } : {}) });
      }
    } else if (!deps.provider) {
      evidence.push({ at, source: "provider", result: "error", note: "could not be used from this phone" });
    } else {
      evidence.push({ at, source: "provider", result: "error", note: "was never given an operation id for this payment" });
    }

    const chain = options.useChain === false ? null : deps.chain;
    if (chain && record.userOpHash && isHash32(record.userOpHash)) {
      anySourceUsed = true;
      const answer = await chain.findUserOperation({
        userOpHash: record.userOpHash as `0x${string}`,
        account,
        createdAt: record.createdAt,
        now: at,
        payment,
      });
      if (answer.status === "found") {
        if (!answer.success) {
          const reason = "The network ran this payment and it reverted, so no money moved.";
          evidence.push({ at, source: "chain", result: "failed", note: reason });
          return {
            verdict: { status: "failed", reason, transactionHash: answer.transactionHash, via: "chain" },
            evidence,
          };
        }
        if (answer.transfer.kind === "missing" || answer.transfer.kind === "ambiguous") {
          anyUnreachable = true;
          evidence.push({
            at,
            source: "chain",
            result: "unknown",
            note:
              answer.transfer.kind === "missing"
                ? "shows the operation ran, but no matching transfer inside it"
                : "shows the operation ran, but several transfers could match it",
          });
        } else {
          evidence.push({ at, source: "chain", result: "confirmed", note: "shows the operation executed successfully" });
          return {
            verdict: { status: "confirmed", transactionHash: answer.transactionHash, via: "chain" },
            evidence,
            transfer: answer.transfer,
          };
        }
      } else if (answer.status === "not-found") {
        evidence.push({
          at,
          source: "chain",
          result: "unknown",
          note: answer.complete ? "has no trace of this operation in the period searched" : "had no trace of it in the part of the period that could be searched",
          fromBlock: answer.fromBlock,
          toBlock: answer.toBlock,
        });
      } else {
        anyUnreachable = true;
        evidence.push({
          at,
          source: "chain",
          result: "error",
          note: answer.error.summary,
          ...(answer.error.code !== undefined ? { code: answer.error.code } : {}),
          ...(answer.error.status !== undefined ? { status: answer.error.status } : {}),
          ...(answer.fromBlock !== undefined ? { fromBlock: answer.fromBlock } : {}),
          ...(answer.toBlock !== undefined ? { toBlock: answer.toBlock } : {}),
        });
        deps.report?.("payment-status-chain-error", { kind: answer.error.kind });
      }
    } else if (chain) {
      evidence.push({ at, source: "chain", result: "error", note: "cannot look for it: the operation id is in a format this app does not recognize" });
    }

    if (!anySourceUsed) return { verdict: { status: "unknown", reason: "no-source" }, evidence };
    if (anyUnreachable) return { verdict: { status: "unknown", reason: "unreachable" }, evidence };
    return { verdict: { status: "unknown", reason: providerSaidUnknown ? "not-found" : "inconclusive" }, evidence };
  };

  // ------------------------------------------------------------ settling a verdict

  /** The transfer is proven: queue its recording, and only then drop the pending record. */
  const settleConfirmed = async (
    account: string,
    record: OperationRecord,
    reconciled: Reconciled & { verdict: Extract<Verdict, { status: "confirmed" }> },
  ): Promise<Extract<OperationReport, { status: "confirmed" }>> => {
    const payment = paymentFor(record, reconciled.transfer);
    let recording: "queued" | "not-possible" = "not-possible";
    if (payment) {
      await queueRecording(account, { transactionHash: reconciled.verdict.transactionHash, payment, proof: reconciled.evidence });
      recording = "queued";
    }
    await clearRecord(account);
    return {
      status: "confirmed",
      ids: { ...idsOf(record), transactionHash: reconciled.verdict.transactionHash },
      evidence: appendEvidence(record.checks, reconciled.evidence),
      payment,
      recording,
      via: reconciled.verdict.via,
    };
  };

  const settleFailed = async (
    account: string,
    record: OperationRecord,
    reconciled: Reconciled & { verdict: Extract<Verdict, { status: "failed" }> },
  ): Promise<Extract<OperationReport, { status: "failed" }>> => {
    const verdict = reconciled.verdict;
    const evidence = appendEvidence(record.checks, reconciled.evidence);
    await writeRecord(account, {
      ...record,
      phase: "failed",
      checks: evidence,
      failure: { at: now(), reason: verdict.reason, ...(verdict.code !== undefined ? { code: verdict.code } : {}), ...(verdict.transactionHash ? { transactionHash: verdict.transactionHash } : {}) },
    });
    return {
      status: "failed",
      ids: { ...idsOf(record), ...(verdict.transactionHash ? { transactionHash: verdict.transactionHash } : {}) },
      evidence,
      payment: paymentOf(record),
      reason: verdict.reason,
      ...(verdict.code !== undefined ? { code: verdict.code } : {}),
    };
  };

  const settleOpen = async (
    account: string,
    record: OperationRecord,
    reconciled: Reconciled,
  ): Promise<Extract<OperationReport, { status: "pending" | "unknown" }>> => {
    const evidence = appendEvidence(record.checks, reconciled.evidence);
    await writeRecord(account, { ...record, checks: evidence });
    const kind: UnresolvedKind = reconciled.verdict.status === "pending" ? "pending" : "unknown";
    return {
      status: kind,
      ids: idsOf(record),
      evidence,
      payment: paymentOf(record),
      ...(record.createdAt !== undefined ? { createdAt: record.createdAt } : {}),
      releasable: releaseAllowed(record, kind, now()),
      ...(reconciled.verdict.status === "unknown" ? { reason: reconciled.verdict.reason } : {}),
    };
  };

  const settle = async (account: string, record: OperationRecord, reconciled: Reconciled): Promise<OperationReport> => {
    const verdict = reconciled.verdict;
    if (verdict.status === "confirmed") return settleConfirmed(account, record, { ...reconciled, verdict });
    if (verdict.status === "failed") return settleFailed(account, record, { ...reconciled, verdict });
    return settleOpen(account, record, reconciled);
  };

  /** Reads, reconciles and settles what this account has pending. Caller holds the lock. */
  const checkUnlocked = async (account: string, options: { useChain?: boolean } = {}): Promise<OperationReport> => {
    const record = await readRecord(account);
    if (!record) return { status: "none" };
    const ownership = checkOwnership(record, owner(account));
    if (!ownership.ok) return { status: "foreign", reason: ownership.reason };
    if (record.phase === "failed") {
      return {
        status: "failed",
        ids: idsOf(record),
        evidence: record.checks,
        payment: paymentOf(record),
        reason: record.failure?.reason ?? "The network reported that this payment failed.",
        ...(record.failure?.code !== undefined ? { code: record.failure.code } : {}),
      };
    }
    return settle(account, record, await reconcile(record, account, options));
  };

  // ------------------------------------------------------------ public API

  const busyReport = (error: unknown): OperationReport | null =>
    classifyProviderError(error).kind === "busy" ? { status: "busy" } : null;

  /** The owner's "Check wallet operation". */
  const check = async (account: string): Promise<OperationReport> => {
    try {
      return await lock(lockKey(account), () => checkUnlocked(account));
    } catch (error) {
      const busy = busyReport(error);
      if (busy) return busy;
      throw error;
    }
  };

  /** What is stored, with no network. For screens that only need to know whether something is waiting. */
  const peek = async (account: string): Promise<OperationRecord | null> => {
    const record = await readRecord(account);
    if (!record) return null;
    return checkOwnership(record, owner(account)).ok ? record : null;
  };

  /**
   * Lets the owner pay again after a payment nobody can prove. The record is not
   * deleted: it moves to a watch list, so that if the payment lands later the
   * phone notices and says so.
   */
  const release = async (account: string): Promise<void> => {
    await lock(lockKey(account), async () => {
      const record = await readRecord(account);
      if (!record) return;
      if (isUnresolved(record)) {
        const watched = await readReleased(account);
        await deps.storage.setItem(
          releasedKey(account),
          JSON.stringify([...watched, { ...record, releasedAt: now() }].slice(-5)),
        );
        deps.report?.("payment-released-by-owner", { hadHash: Boolean(record.userOpHash) });
      }
      await clearRecord(account);
    });
  };

  type Released = OperationRecord & { releasedAt: number };
  const WATCH_FOR_MS = 14 * 24 * 60 * 60 * 1000;

  const readReleased = async (account: string): Promise<Released[]> => {
    try {
      const parsed = JSON.parse((await deps.storage.getItem(releasedKey(account))) ?? "[]") as unknown[];
      return parsed
        .map((item) => parseOperationRecord(JSON.stringify(item), owner(account)))
        .filter((record): record is OperationRecord => record !== null)
        .map((record, index) => ({ ...record, releasedAt: Number((parsed[index] as { releasedAt?: number }).releasedAt ?? 0) }));
    } catch {
      return [];
    }
  };

  /**
   * Looks again at payments the owner released. One that turns out to have gone
   * through is queued for recording and reported, so the owner knows they paid
   * twice if they paid again.
   */
  const checkReleased = async (account: string): Promise<{ landed: Extract<OperationReport, { status: "confirmed" }>[] }> => {
    const landed: Extract<OperationReport, { status: "confirmed" }>[] = [];
    await lock(lockKey(account), async () => {
      const watched = await readReleased(account);
      const keep: Released[] = [];
      for (const record of watched) {
        if (now() - record.releasedAt > WATCH_FOR_MS) continue;
        const reconciled = await reconcile(record, account);
        if (reconciled.verdict.status === "confirmed") {
          const payment = paymentFor(record, reconciled.transfer);
          if (payment) await queueRecording(account, { transactionHash: reconciled.verdict.transactionHash, payment, proof: reconciled.evidence });
          landed.push({
            status: "confirmed",
            ids: { ...idsOf(record), transactionHash: reconciled.verdict.transactionHash },
            evidence: reconciled.evidence,
            payment,
            recording: payment ? "queued" : "not-possible",
            via: reconciled.verdict.via,
          });
          deps.report?.("released-payment-landed", {});
        } else if (reconciled.verdict.status !== "failed") {
          keep.push({ ...record, checks: appendEvidence(record.checks, reconciled.evidence) });
        }
      }
      await deps.storage.setItem(releasedKey(account), JSON.stringify(keep));
    });
    return { landed };
  };

  /** Removes the note of a failed payment once the owner has read it. */
  const dismissFailure = async (account: string): Promise<void> => {
    await lock(lockKey(account), async () => {
      const record = await readRecord(account);
      if (record && record.phase === "failed") await clearRecord(account);
    });
  };

  /**
   * Unresolved payments of every account on this phone, found in storage. Used to
   * warn before an account is removed and before the same payment is sent from
   * another account.
   */
  const listUnresolved = async (): Promise<{ account: string; chainId: number; record: OperationRecord }[]> => {
    const found: { account: string; chainId: number; record: OperationRecord }[] = [];
    for (const key of await deps.storage.getAllKeys()) {
      const keyOwner = ownerFromKey(key);
      if (!keyOwner || keyOwner.chainId !== deps.chainId) continue;
      const record = parseOperationRecord(await deps.storage.getItem(key), keyOwner);
      if (record && isUnresolved(record)) found.push({ ...keyOwner, record });
    }
    return found;
  };

  /**
   * Before a new payment: is this account free to pay? Reconciles what is
   * pending first, so a payment that has in fact gone through is recognised and
   * a retry of the very same payment is answered with the first one, not sent
   * again. Caller holds the lock.
   */
  const beforeSend = async (
    account: string,
    fingerprint: string,
  ): Promise<
    | { action: "proceed" }
    | { action: "reuse"; transactionHash: string }
    | { action: "blocked"; reason: "unverified" | "other-account" | "unreadable"; message: string; otherAccount?: string }
  > => {
    let stored: string | null;
    try {
      stored = await deps.storage.getItem(keyFor(account));
    } catch {
      return { action: "blocked", reason: "unreadable", message: "This phone could not read its record of your earlier payments, so it sent nothing. Try again." };
    }
    const record = parseOperationRecord(stored, owner(account));
    if (record) {
      const ownership = checkOwnership(record, owner(account));
      if (!ownership.ok) {
        return { action: "blocked", reason: "unreadable", message: "A saved payment record does not match this wallet or network, so nothing was sent. Open Activity." };
      }
      if (record.phase !== "failed") {
        const report = await settle(account, record, await reconcile(record, account));
        if (report.status === "confirmed") {
          if (record.fingerprint === fingerprint && report.ids.transactionHash) {
            return { action: "reuse", transactionHash: report.ids.transactionHash };
          }
          return {
            action: "blocked",
            reason: "unverified",
            message: `Your earlier payment has just been confirmed (${report.ids.transactionHash}). Check Activity before starting a different one.`,
          };
        }
        if (report.status === "pending" || report.status === "unknown") {
          return { action: "blocked", reason: "unverified", message: "An earlier payment is still unverified. Nothing new was sent. Open Activity to check it." };
        }
        // failed: the way is clear, and the failed record is replaced by the new payment.
      }
    }

    // The same payment from another account on this phone would be paid twice if
    // the first one lands.
    const wanted = describeFingerprint(fingerprint);
    if (wanted) {
      const identity = paymentIdentity(wanted);
      for (const other of await listUnresolved()) {
        if (other.account === account.toLowerCase()) continue;
        const payment = paymentOf(other.record);
        if (payment && paymentIdentity(payment) === identity) {
          return {
            action: "blocked",
            reason: "other-account",
            otherAccount: other.account,
            message:
              "Another account on this iPhone already has this exact payment waiting to be verified. Sending it again from here could pay twice. Sign in to that account and check it in Activity first.",
          };
        }
      }
    }
    return { action: "proceed" };
  };

  /**
   * Every account on this phone that has a payment still unproven, or proven and
   * not yet recorded. What the account screens warn about before an account is
   * switched away from, removed or deleted: nothing here is ever deleted by them.
   */
  const unsettled = async (): Promise<{ account: string; pending: OperationRecord | null; recordings: OutboxEntry[] }[]> => {
    const byAccount = new Map<string, { account: string; pending: OperationRecord | null; recordings: OutboxEntry[] }>();
    const slot = (account: string) => {
      const key = account.toLowerCase();
      const existing = byAccount.get(key) ?? { account: key, pending: null, recordings: [] };
      byAccount.set(key, existing);
      return existing;
    };
    for (const item of await listUnresolved()) slot(item.account).pending = item.record;
    const outboxPrefix = `${OUTBOX_PREFIX}${deps.chainId}.`;
    for (const key of await deps.storage.getAllKeys()) {
      if (!key.startsWith(outboxPrefix)) continue;
      const entry = parseOutboxEntry(await deps.storage.getItem(key));
      if (entry && entry.chainId === deps.chainId && entry.state !== "recorded") slot(entry.account).recordings.push(entry);
    }
    return [...byAccount.values()];
  };

  const describeFingerprint = (fingerprint: string): PendingPayment | null =>
    paymentOf({ v: 2, phase: "submitting", fingerprint, checks: [] });

  /** Written before the request that could move money leaves the phone. Throws if it cannot be kept. */
  const begin = async (account: string, input: { fingerprint: string; userOpHash?: string }): Promise<OperationRecord> => {
    const record: OperationRecord = completeRecord(
      {
        v: 2,
        phase: "submitting",
        ...(input.userOpHash && isHash32(input.userOpHash) ? { userOpHash: input.userOpHash.toLowerCase() } : {}),
        fingerprint: input.fingerprint,
        createdAt: now(),
        userId: deps.currentUserId?.() ?? null,
        checks: [],
      },
      owner(account),
    );
    await writeRecord(account, record);
    return record;
  };

  const markSubmitted = async (account: string, input: { id: string; userOpHash?: string }): Promise<void> => {
    const record = await readRecord(account);
    if (!record) return;
    await writeRecord(
      account,
      completeRecord(
        {
          ...record,
          phase: "submitted",
          id: input.id,
          submittedAt: now(),
          ...(input.userOpHash && isHash32(input.userOpHash) ? { userOpHash: input.userOpHash.toLowerCase() } : {}),
        },
        owner(account),
      ),
    );
  };

  /** The provider refused the request outright: nothing was sent. */
  const abandon = async (account: string): Promise<void> => {
    await clearRecord(account);
  };

  const addEvidence = async (account: string, entries: Evidence[]): Promise<void> => {
    const record = await readRecord(account);
    if (!record) return;
    await writeRecord(account, { ...record, checks: appendEvidence(record.checks, entries) });
  };

  return {
    check,
    peek,
    release,
    checkReleased,
    dismissFailure,
    listUnresolved,
    unsettled,
    // The pieces the send path uses while it already holds the lock:
    inLock: { check: checkUnlocked, beforeSend, begin, markSubmitted, abandon, addEvidence, reconcile, settle },
    outbox: { list: listOutbox, queue: queueRecording, enrich: enrichRecording, flush: flushRecordings },
    keyFor,
    lockKey,
  };
};

export type PaymentOperations = ReturnType<typeof createPaymentOperations>;

export { KEY_PREFIX, OUTBOX_PREFIX };
