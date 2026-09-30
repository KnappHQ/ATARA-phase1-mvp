/**
 * The record a phone keeps for a payment it has sent and cannot yet prove.
 *
 * It lives in AsyncStorage under `atara.pending-call-bundle.<chain id>.<smart
 * account address>`, so it belongs to one network and one account by its key.
 * Earlier versions of the app wrote three shapes there (a bare call id, then
 * `{ id, fingerprint }`, then `{ id, fingerprint, createdAt }`). All three are
 * still read: a payment sent before this version is exactly the one that most
 * needs finding, and nothing has to be reinstalled or erased for it to be found.
 *
 * What the record is for:
 *  - to refuse a second payment while the first is unproven, which is what keeps
 *    a slow network from turning one payment into two;
 *  - to say which payment is waiting and how to find it;
 *  - to hold the identifiers (call id, user operation hash, transaction hash,
 *    kept apart, see utils/callId.ts) and the trail of what each check found,
 *    so nothing that could prove or disprove the payment is thrown away.
 *
 * It is never deleted because a check failed or timed out.
 */

import { parseCallId, isHash32 } from "./callId";
import { MAX_EVIDENCE, type Evidence } from "./operationStatus";
import { describePendingPayment, type PendingPayment } from "./pendingOperation";

export const RECORD_VERSION = 2;

/** "submitting": signed, and the request to send it may or may not have arrived. */
export type OperationPhase = "submitting" | "submitted" | "failed";

export interface OperationFailure {
  at: number;
  reason: string;
  code?: number;
  transactionHash?: string;
}

export interface OperationRecord {
  v: typeof RECORD_VERSION;
  phase: OperationPhase;
  /** The provider's call id. Read this as `callId`; the name is kept for older readers. */
  id?: string;
  userOpHash?: string;
  transactionHash?: string;
  chainId?: number;
  /** Lower case. The account whose money this is. */
  account?: string;
  /** The ATARA user who sent it, when known. */
  userId?: string | null;
  /** JSON list of [target, value, data], as sent. */
  fingerprint?: string;
  createdAt?: number;
  submittedAt?: number;
  checks: Evidence[];
  failure?: OperationFailure;
}

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;
const number = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const EVIDENCE_SOURCES = new Set(["send", "provider", "chain"]);
const EVIDENCE_RESULTS = new Set(["confirmed", "failed", "pending", "unknown", "error"]);

const readEvidence = (raw: unknown): Evidence[] => {
  if (!Array.isArray(raw)) return [];
  const kept: Evidence[] = [];
  for (const item of raw as Record<string, unknown>[]) {
    if (!item || typeof item !== "object") continue;
    const at = number(item.at);
    if (at === undefined || !EVIDENCE_SOURCES.has(String(item.source)) || !EVIDENCE_RESULTS.has(String(item.result))) continue;
    kept.push({
      at,
      source: item.source as Evidence["source"],
      result: item.result as Evidence["result"],
      note: typeof item.note === "string" ? item.note.slice(0, 200) : "",
      ...(number(item.code) !== undefined ? { code: number(item.code) } : {}),
      ...(number(item.status) !== undefined ? { status: number(item.status) } : {}),
      ...(number(item.fromBlock) !== undefined ? { fromBlock: number(item.fromBlock) } : {}),
      ...(number(item.toBlock) !== undefined ? { toBlock: number(item.toBlock) } : {}),
    });
  }
  return kept.slice(-MAX_EVIDENCE);
};

export interface KeyOwner {
  chainId: number;
  /** Lower case smart account address. */
  account: string;
}

/**
 * Fills in what the key already says (network and account) and what the call id
 * says (network and user operation hash), without overwriting anything the
 * record itself holds.
 */
export const completeRecord = (record: OperationRecord, owner?: KeyOwner): OperationRecord => {
  const fromId = parseCallId(record.id);
  return {
    ...record,
    chainId: record.chainId ?? owner?.chainId ?? fromId?.chainId,
    account: record.account ?? owner?.account,
    userOpHash: record.userOpHash ?? fromId?.userOpHash,
  };
};

/**
 * Reads whatever a previous version wrote. Returns null only when there is
 * nothing at all; anything else is a record, however little it holds.
 */
export const parseOperationRecord = (stored: string | null | undefined, owner?: KeyOwner): OperationRecord | null => {
  if (!stored) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    parsed = undefined;
  }

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const raw = parsed as Record<string, unknown>;
    const isCurrent = raw.v === RECORD_VERSION;
    const id = text(raw.id);
    // `{ id, fingerprint, createdAt }` and the current shape both have an id; the
    // current one may not have one yet (see "submitting").
    if (isCurrent || id) {
      const failure = raw.failure as Record<string, unknown> | undefined;
      const record: OperationRecord = {
        v: RECORD_VERSION,
        phase: raw.phase === "submitting" || raw.phase === "failed" ? raw.phase : "submitted",
        ...(id ? { id } : {}),
        ...(isHash32(raw.userOpHash) ? { userOpHash: (raw.userOpHash as string).toLowerCase() } : {}),
        ...(isHash32(raw.transactionHash) ? { transactionHash: (raw.transactionHash as string).toLowerCase() } : {}),
        ...(number(raw.chainId) !== undefined ? { chainId: number(raw.chainId) } : {}),
        ...(text(raw.account) ? { account: (raw.account as string).toLowerCase() } : {}),
        ...(raw.userId === null || text(raw.userId) ? { userId: raw.userId as string | null } : {}),
        ...(text(raw.fingerprint) ? { fingerprint: raw.fingerprint as string } : {}),
        ...(number(raw.createdAt) !== undefined ? { createdAt: number(raw.createdAt) } : {}),
        ...(number(raw.submittedAt) !== undefined ? { submittedAt: number(raw.submittedAt) } : {}),
        checks: readEvidence(raw.checks),
        ...(failure && typeof failure === "object" && number(failure.at) !== undefined
          ? {
              failure: {
                at: number(failure.at) as number,
                reason: typeof failure.reason === "string" ? failure.reason.slice(0, 300) : "",
                ...(number(failure.code) !== undefined ? { code: number(failure.code) } : {}),
                ...(isHash32(failure.transactionHash) ? { transactionHash: failure.transactionHash as string } : {}),
              },
            }
          : {}),
      };
      return completeRecord(record, owner);
    }
  }

  // The oldest records were the bare call id.
  return completeRecord({ v: RECORD_VERSION, phase: "submitted", id: stored, checks: [] }, owner);
};

export const serializeOperationRecord = (record: OperationRecord): string =>
  JSON.stringify({ ...record, checks: record.checks.slice(-MAX_EVIDENCE) });

/** While true, this account is not allowed to send another payment. */
export const isUnresolved = (record: OperationRecord): boolean => record.phase !== "failed";

export type Ownership = { ok: true } | { ok: false; reason: "other-network" | "other-account" };

/**
 * Whether a record belongs to the wallet and network being asked about. The key
 * already separates them; this is the second look, so a record that ends up
 * under the wrong key (a restore, a bug) is never used for the wrong account.
 */
export const checkOwnership = (record: OperationRecord, owner: KeyOwner): Ownership => {
  const fromId = parseCallId(record.id);
  if ((record.chainId !== undefined && record.chainId !== owner.chainId) || (fromId && fromId.chainId !== owner.chainId)) {
    return { ok: false, reason: "other-network" };
  }
  if (record.account !== undefined && record.account.toLowerCase() !== owner.account.toLowerCase()) {
    return { ok: false, reason: "other-account" };
  }
  return { ok: true };
};

export const paymentOf = (record: OperationRecord): PendingPayment | null =>
  describePendingPayment({ id: record.id ?? "", fingerprint: record.fingerprint, createdAt: record.createdAt });

/**
 * Two payments are the same payment to a person: same asset, same recipient,
 * same amount. It is only used to REFUSE a second payment while another account
 * on this phone has one unproven, never to decide that two payments on the
 * chain or in a list are one.
 */
export const paymentIdentity = (payment: PendingPayment): string =>
  `${payment.token ?? "eth"}|${payment.recipient.toLowerCase()}|${payment.amount}`;

export const keyForOperation = (chainId: number, address: string): string =>
  `atara.pending-call-bundle.${chainId}.${address.toLowerCase()}`;

export const KEY_PREFIX = "atara.pending-call-bundle.";

/** "84532", "0xabc…" from a key, or null when it is not one of ours. */
export const ownerFromKey = (key: string): KeyOwner | null => {
  if (!key.startsWith(KEY_PREFIX)) return null;
  const [chain, account, ...rest] = key.slice(KEY_PREFIX.length).split(".");
  const chainId = Number(chain);
  if (rest.length > 0 || !Number.isInteger(chainId) || chainId <= 0 || !/^0x[0-9a-fA-F]{40}$/.test(account ?? "")) return null;
  return { chainId, account: account.toLowerCase() };
};

// --------------------------------------------------------------------------
// When the owner may let go of a payment nobody can prove

/** A payment nobody can find can be released this long after it was sent. */
export const RELEASE_UNKNOWN_AFTER_MS = 30 * 60 * 1000;
/** One the provider still reports as in flight waits longer: it may well land. */
export const RELEASE_PENDING_AFTER_MS = 2 * 60 * 60 * 1000;

export type UnresolvedKind = "pending" | "unknown";

/**
 * Records written before this version have no time. They are at least as old as
 * the update, and were the ones stuck for days, so they may be released.
 */
export const releaseAllowed = (record: OperationRecord, kind: UnresolvedKind, now: number): boolean => {
  const wait = kind === "pending" ? RELEASE_PENDING_AFTER_MS : RELEASE_UNKNOWN_AFTER_MS;
  return record.createdAt === undefined || now - record.createdAt >= wait;
};
