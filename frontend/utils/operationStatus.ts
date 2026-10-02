/**
 * Reading what a provider or the chain says about a payment.
 *
 * Two rules run through this file, because getting them wrong is how a payment
 * ends up shown as failed when it was not, or sent twice:
 *
 *  1. A failure is only ever concluded from an explicit answer that the payment
 *     did not happen. A timeout, a dropped connection, a rejected request or a
 *     provider that no longer knows the id are none of those: they are "no
 *     answer", and the payment stays unresolved.
 *  2. Nothing here keeps the text of an error. A network library's message can
 *     hold the request URL (which, for a node, carries the API key) and the
 *     whole request body (addresses, call data). Errors are reduced to a kind
 *     and a few numbers, and every sentence shown to a person is fixed text.
 */

import { isHash32 } from "./callId";

// --------------------------------------------------------------------------
// Errors

export type ProviderErrorKind =
  | "unknown-call-id"
  | "unauthorized"
  | "rate-limited"
  | "server"
  | "timeout"
  | "network"
  | "busy"
  | "unavailable"
  | "other";

export interface ProviderErrorInfo {
  kind: ProviderErrorKind;
  /** The JSON-RPC error code, when the provider answered with one. */
  code?: number;
  /** The HTTP status, when there was one. */
  status?: number;
  /** A fixed sentence for a person. Never the raw message. */
  summary: string;
}

const SUMMARIES: Record<ProviderErrorKind, string> = {
  "unknown-call-id": "the provider does not know this operation id",
  unauthorized: "the provider refused the request (authentication)",
  "rate-limited": "the provider is limiting requests right now",
  server: "the provider had an error on its side",
  timeout: "the provider took too long to answer",
  network: "this phone could not reach the provider",
  busy: "another check or payment is already running for this wallet",
  unavailable: "this source could not be used",
  other: "the provider answered with an error this app does not recognize",
};

/** The error, then each error it was caused by. */
const causes = (error: unknown): Record<string, unknown>[] => {
  const seen = new Set<unknown>();
  const chain: Record<string, unknown>[] = [];
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current) && chain.length < 8) {
    seen.add(current);
    chain.push(current as Record<string, unknown>);
    current = (current as { cause?: unknown }).cause;
  }
  return chain;
};

const textOf = (entry: Record<string, unknown>): string => {
  const message = entry.shortMessage ?? entry.message;
  return typeof message === "string" ? message : "";
};

/** Which kind of failure this is, without keeping what it said. */
export const classifyProviderError = (error: unknown): ProviderErrorInfo => {
  const chain = causes(error);
  const find = <T>(pick: (entry: Record<string, unknown>) => T | undefined): T | undefined => {
    for (const entry of chain) {
      const value = pick(entry);
      if (value !== undefined) return value;
    }
    return undefined;
  };

  const code = find((entry) => (typeof entry.code === "number" ? entry.code : undefined));
  const status = find((entry) => (typeof entry.status === "number" ? entry.status : undefined));
  const names = chain.map((entry) => (typeof entry.name === "string" ? entry.name : ""));
  const text = chain.map(textOf).join(" ");

  const result = (kind: ProviderErrorKind): ProviderErrorInfo => ({
    kind,
    ...(code !== undefined ? { code } : {}),
    ...(status !== undefined ? { status } : {}),
    summary: SUMMARIES[kind],
  });

  if (code === 5730 || names.includes("UnknownBundleIdError")) return result("unknown-call-id");
  if (/operation is already in progress/i.test(text)) return result("busy");
  if (status === 401 || status === 403 || /must be authenticated|unauthori[sz]ed|invalid api key|api key/i.test(text)) {
    return result("unauthorized");
  }
  if (status === 429 || /rate.?limit|too many requests|\b429\b|exceeded.*(compute|capacity)/i.test(text)) {
    return result("rate-limited");
  }
  if (typeof status === "number" && status >= 500) return result("server");
  if (names.includes("TimeoutError") || /timed out|timeout|took too long/i.test(text)) return result("timeout");
  if (
    names.includes("HttpRequestError") ||
    /network request failed|failed to fetch|fetch failed|offline|internet connection|econn|enotfound|socket|no network/i.test(text)
  ) {
    return result("network");
  }
  return result("other");
};

/** Only these can mean "the provider looked and there is nothing", not "it could not look". */
export const isDefinitelyUnknownToProvider = (info: ProviderErrorInfo): boolean =>
  info.kind === "unknown-call-id";

// --------------------------------------------------------------------------
// What `getCallsStatus` returned

/** EIP-5792 and Alchemy status codes, as documented in @alchemy/wallet-api-types. */
const FAILURE_REASONS: Record<number, string> = {
  400: "The network never included this payment and will not try again.",
  500: "The network included it, but it reverted, so the payment did not happen.",
  600: "The network included it, but part of it reverted.",
  410: "The network refunded it.",
};

export type CallsStatusVerdict =
  | { kind: "confirmed"; transactionHash: string; userOpHash?: string }
  | { kind: "failed"; statusCode: number; reason: string; transactionHash?: string }
  | { kind: "pending"; statusCode: number; pendingTransactionHash?: string }
  | { kind: "unrecognized"; statusCode?: number };

interface CallsStatusLike {
  status?: unknown;
  statusCode?: unknown;
  receipts?: readonly { transactionHash?: unknown; status?: unknown }[] | null;
  details?: { data?: { hash?: unknown; pendingBundle?: { txHash?: unknown } } } | null;
}

const firstReceiptHash = (result: CallsStatusLike): string | undefined => {
  const hash = result.receipts?.[0]?.transactionHash;
  return isHash32(hash) ? hash.toLowerCase() : undefined;
};

/**
 * What the provider's answer means. `success` needs a transaction hash to count
 * as confirmed: a bundle reported as done with no receipt is not yet something
 * the payment can be recorded against.
 */
export const interpretCallsStatus = (result: unknown): CallsStatusVerdict => {
  if (!result || typeof result !== "object") return { kind: "unrecognized" };
  const answer = result as CallsStatusLike;
  const code =
    typeof answer.statusCode === "number"
      ? answer.statusCode
      : typeof answer.status === "number"
        ? answer.status
        : undefined;

  const userOpHash = isHash32(answer.details?.data?.hash) ? (answer.details?.data?.hash as string).toLowerCase() : undefined;

  if (code === undefined) {
    // Older wire formats: "CONFIRMED" and "PENDING".
    if (answer.status === "CONFIRMED" || answer.status === "success") {
      const hash = firstReceiptHash(answer);
      return hash ? { kind: "confirmed", transactionHash: hash, userOpHash } : { kind: "pending", statusCode: 100 };
    }
    if (answer.status === "PENDING" || answer.status === "pending") return { kind: "pending", statusCode: 100 };
    return { kind: "unrecognized" };
  }

  if (code >= 100 && code < 200) {
    const pending = answer.details?.data?.pendingBundle?.txHash;
    return {
      kind: "pending",
      statusCode: code,
      ...(isHash32(pending) ? { pendingTransactionHash: pending.toLowerCase() } : {}),
    };
  }
  if (code >= 200 && code < 300) {
    const hash = firstReceiptHash(answer);
    return hash
      ? { kind: "confirmed", transactionHash: hash, userOpHash }
      : { kind: "pending", statusCode: code };
  }
  if (code >= 300 && code < 700) {
    const hash = firstReceiptHash(answer);
    return {
      kind: "failed",
      statusCode: code,
      reason: FAILURE_REASONS[code] ?? "The network reported that this payment failed.",
      ...(hash ? { transactionHash: hash } : {}),
    };
  }
  return { kind: "unrecognized", statusCode: code };
};

// --------------------------------------------------------------------------
// Evidence

export type EvidenceSource = "send" | "provider" | "chain";
export type EvidenceResult = "confirmed" | "failed" | "pending" | "unknown" | "error";

/** One line of the trail kept with a payment. Small, and free of addresses. */
export interface Evidence {
  at: number;
  source: EvidenceSource;
  result: EvidenceResult;
  /** A fixed sentence, see SUMMARIES and the chain reader. */
  note: string;
  code?: number;
  status?: number;
  /** Block range the chain was searched in, when it was. */
  fromBlock?: number;
  toBlock?: number;
}

export const MAX_EVIDENCE = 8;

/** The trail, oldest first, without ever growing past MAX_EVIDENCE. */
export const appendEvidence = (trail: readonly Evidence[] | undefined, added: readonly Evidence[]): Evidence[] => {
  const same = (a: Evidence, b: Evidence) =>
    a.source === b.source && a.result === b.result && a.note === b.note && a.code === b.code && a.status === b.status;
  let kept = [...(trail ?? [])];
  // A fact seen again replaces its earlier line, so a long wait shows what was
  // learned, not the same answer forty times.
  for (const entry of added) kept = [...kept.filter((earlier) => !same(earlier, entry)), entry];
  return kept.slice(-MAX_EVIDENCE);
};

export const describeEvidence = (entry: Evidence): string => {
  const who = entry.source === "provider" ? "Wallet service" : entry.source === "chain" ? "Base network" : "This phone";
  const range =
    entry.fromBlock !== undefined && entry.toBlock !== undefined
      ? ` (blocks ${entry.fromBlock.toLocaleString("en-US")}–${entry.toBlock.toLocaleString("en-US")})`
      : "";
  return `${who}: ${entry.note}${range}`;
};
