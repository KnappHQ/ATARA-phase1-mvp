import {
  decodeEventLog,
  encodeEventTopics,
  parseAbiItem,
  type Address,
  type Hex,
} from "viem";

import { classifyProviderError, type ProviderErrorInfo } from "../utils/operationStatus";
import type { PendingPayment } from "../utils/pendingOperation";

/**
 * Asks the chain whether a user operation ran, by its hash.
 *
 * This is what makes a payment provable when the wallet provider no longer
 * remembers it. The EntryPoint contract emits `UserOperationEvent` with the
 * operation's hash as an indexed field, for every operation it executes, so the
 * answer is on the chain whatever any provider says. It needs only the hash,
 * which is inside the call id (see utils/callId.ts), and a node.
 *
 * "Not found" is reported with the range that was searched and nothing more. It
 * does NOT mean the payment failed: the operation may be waiting to be included,
 * or older than the range. Only an operation that is found and reverted is a
 * failure.
 */

/** ERC-4337 EntryPoint v0.6, v0.7 and v0.8. An address with no logs costs nothing. */
export const ENTRY_POINTS: readonly Address[] = [
  "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
  "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
  "0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108",
];

export const USER_OPERATION_EVENT = parseAbiItem(
  "event UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed)",
);
export const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

/** Base produces a block every two seconds. */
export const BLOCK_MS = 2_000;
/** Where to start looking for an operation whose age is not known: about 14 days. */
export const UNKNOWN_AGE_LOOKBACK_BLOCKS = 604_800;
/** Never look back further than about 46 days in one check. */
export const MAX_LOOKBACK_BLOCKS = 2_000_000;
/** Half an hour of blocks, plus 2% of the span, to absorb an estimated start block. */
const MARGIN_BLOCKS = 900;
const FLOOR_WINDOW = 500;
const MAX_REQUESTS = 60;

export interface LogLike {
  address: string;
  topics: readonly string[];
  data: string;
  transactionHash: string;
  blockNumber: bigint | number;
  logIndex: number;
}

export interface ReceiptLike {
  status?: string | number | boolean;
  logs: readonly LogLike[];
  blockNumber?: bigint | number;
}

/** What the reader needs from a viem public client. */
export interface ChainClientLike {
  getBlockNumber(): Promise<bigint>;
  getLogs(args: {
    address: readonly Address[];
    event: typeof USER_OPERATION_EVENT;
    args: { userOpHash: Hex };
    fromBlock: bigint;
    toBlock: bigint;
  }): Promise<readonly LogLike[]>;
  getTransactionReceipt(args: { hash: Hex }): Promise<ReceiptLike>;
}

export type TransferCheck =
  | { kind: "matched"; token: string; recipient: string; amount: string }
  | { kind: "missing" }
  | { kind: "ambiguous"; count: number }
  | { kind: "not-applicable" };

export type ChainAnswer =
  | {
      status: "found";
      success: boolean;
      transactionHash: string;
      blockNumber: number;
      sender: string;
      transfer: TransferCheck;
    }
  | { status: "not-found"; fromBlock: number; toBlock: number; complete: boolean }
  | { status: "unreadable"; error: ProviderErrorInfo; fromBlock?: number; toBlock?: number };

export interface ChainSearch {
  userOpHash: Hex;
  /** The smart account that sent it, lower case. */
  account: string;
  /** When it was sent, if known. It narrows the search a great deal. */
  createdAt?: number;
  now: number;
  /** What it paid, if known, so the transfer inside it can be checked. */
  payment?: PendingPayment | null;
}

const RANGE_ERROR =
  /block range|range (is )?(too|is)|too (large|many|wide|big)|exceed|more than \d+|limit|response size|query returned|10000|logs matched/i;

/** A node that refuses or chokes on a wide search, as opposed to one that is down. */
const isRangeError = (error: unknown, windowSize: bigint): boolean => {
  // A search over a very wide range can time out; a narrow one that does is a node problem.
  if (classifyProviderError(error).kind === "timeout" && windowSize > 20_000n) return true;
  let current: unknown = error;
  for (let depth = 0; current && typeof current === "object" && depth < 6; depth++) {
    const entry = current as { message?: unknown; shortMessage?: unknown; details?: unknown; cause?: unknown };
    const text = [entry.shortMessage, entry.message, entry.details].filter((part) => typeof part === "string").join(" ");
    if (RANGE_ERROR.test(text)) return true;
    current = entry.cause;
  }
  return false;
};

const lower = (value: string) => value.toLowerCase();

const asNumber = (value: bigint | number): number => Number(value);

/**
 * Decodes the token transfers inside one user operation and compares them with
 * what was meant to be paid.
 *
 * A bundle transaction can carry many operations, and one account can have two
 * in the same bundle. The logs of an operation sit between the previous
 * `UserOperationEvent` and its own, so only those are read: two payments of the
 * same amount to the same person are two separate transfers here, never one.
 */
export const checkTransfer = (
  receipt: ReceiptLike,
  ourEvent: LogLike,
  account: string,
  payment: PendingPayment | null | undefined,
  entryPoints: readonly Address[] = ENTRY_POINTS,
): TransferCheck => {
  if (payment && payment.token === null) return { kind: "not-applicable" };
  const eventTopic = encodeEventTopics({ abi: [USER_OPERATION_EVENT], eventName: "UserOperationEvent" })[0];
  const isEntryPoint = (address: string) => entryPoints.some((entry) => lower(entry) === lower(address));

  const logs = [...receipt.logs].sort((a, b) => a.logIndex - b.logIndex);
  const previousBoundary = logs
    .filter(
      (log) =>
        log.logIndex < ourEvent.logIndex &&
        isEntryPoint(log.address) &&
        lower(log.topics[0] ?? "") === lower(eventTopic ?? ""),
    )
    .reduce((highest, log) => Math.max(highest, log.logIndex), -1);

  const ours = logs.filter((log) => log.logIndex > previousBoundary && log.logIndex < ourEvent.logIndex);
  const transfers: { token: string; from: string; to: string; value: bigint }[] = [];
  for (const log of ours) {
    if (log.topics.length !== 3) continue;
    try {
      const decoded = decodeEventLog({
        abi: [TRANSFER_EVENT],
        data: log.data as Hex,
        topics: log.topics as [Hex, ...Hex[]],
      });
      const args = decoded.args as { from: string; to: string; value: bigint };
      transfers.push({ token: lower(log.address), from: lower(args.from), to: lower(args.to), value: args.value });
    } catch {
      // Not an ERC-20 Transfer (ERC-721 shares the topic with a different shape).
    }
  }
  const fromAccount = transfers.filter((transfer) => transfer.from === lower(account));

  if (payment) {
    const matching = fromAccount.filter(
      (transfer) =>
        transfer.token === lower(payment.token as string) &&
        transfer.to === lower(payment.recipient) &&
        transfer.value.toString() === payment.amount,
    );
    if (matching.length === 1) {
      return { kind: "matched", token: matching[0].token, recipient: matching[0].to, amount: matching[0].value.toString() };
    }
    return matching.length === 0 ? { kind: "missing" } : { kind: "ambiguous", count: matching.length };
  }

  // Nothing is known about what was paid: read it from the chain if it is clear.
  if (fromAccount.length === 1) {
    return { kind: "matched", token: fromAccount[0].token, recipient: fromAccount[0].to, amount: fromAccount[0].value.toString() };
  }
  return { kind: "not-applicable" };
};

export interface ChainReaderOptions {
  client: ChainClientLike;
  entryPoints?: readonly Address[];
  maxRequests?: number;
}

export const createChainReader = ({ client, entryPoints = ENTRY_POINTS, maxRequests = MAX_REQUESTS }: ChainReaderOptions) => {
  const findUserOperation = async (search: ChainSearch): Promise<ChainAnswer> => {
    let latest: bigint;
    try {
      latest = await client.getBlockNumber();
    } catch (error) {
      return { status: "unreadable", error: classifyProviderError(error) };
    }

    const estimatedAge =
      search.createdAt !== undefined
        ? Math.max(0, Math.ceil((search.now - search.createdAt) / BLOCK_MS)) + MARGIN_BLOCKS
        : UNKNOWN_AGE_LOOKBACK_BLOCKS;
    const span = BigInt(Math.min(MAX_LOOKBACK_BLOCKS, Math.ceil(estimatedAge * 1.02)));
    const lowest = latest > span ? latest - span : 0n;

    let windowSize = latest - lowest + 1n;
    let to = latest;
    let requests = 0;
    let scannedFrom = latest + 1n;

    while (to >= lowest && requests < maxRequests) {
      const from = to - windowSize + 1n > lowest ? to - windowSize + 1n : lowest;
      requests++;
      let logs: readonly LogLike[];
      try {
        logs = await client.getLogs({
          address: entryPoints,
          event: USER_OPERATION_EVENT,
          args: { userOpHash: search.userOpHash },
          fromBlock: from,
          toBlock: to,
        });
      } catch (error) {
        if (isRangeError(error, windowSize) && windowSize > BigInt(FLOOR_WINDOW)) {
          windowSize = windowSize / 2n > BigInt(FLOOR_WINDOW) ? windowSize / 2n : BigInt(FLOOR_WINDOW);
          continue;
        }
        return {
          status: "unreadable",
          error: classifyProviderError(error),
          fromBlock: scannedFrom <= latest ? asNumber(scannedFrom) : undefined,
          toBlock: asNumber(latest),
        };
      }

      const hit = logs.find((log) => lower(log.topics[1] ?? "") === lower(search.userOpHash));
      if (hit) return describeHit(hit, search, client);
      scannedFrom = from;
      if (from === lowest) break;
      to = from - 1n;
    }

    const covered = scannedFrom <= lowest;
    return {
      status: "not-found",
      fromBlock: asNumber(scannedFrom > latest ? latest : scannedFrom),
      toBlock: asNumber(latest),
      complete: covered,
    };
  };

  return { findUserOperation };
};

const describeHit = async (hit: LogLike, search: ChainSearch, client: ChainClientLike): Promise<ChainAnswer> => {
  let decoded: { userOpHash: string; sender: string; success: boolean };
  try {
    const event = decodeEventLog({
      abi: [USER_OPERATION_EVENT],
      data: hit.data as Hex,
      topics: hit.topics as [Hex, ...Hex[]],
    });
    decoded = event.args as unknown as typeof decoded;
  } catch (error) {
    return { status: "unreadable", error: classifyProviderError(error) };
  }

  const sender = lower(decoded.sender);
  const base = { transactionHash: lower(hit.transactionHash), blockNumber: asNumber(hit.blockNumber), sender };
  if (sender !== lower(search.account)) {
    // The hash is ours and the sender is not: something is wrong with the record.
    // It is never read as confirmation.
    return { status: "unreadable", error: classifyProviderError(new Error("unexpected sender")) };
  }
  if (!decoded.success) return { status: "found", success: false, ...base, transfer: { kind: "not-applicable" } };

  try {
    const receipt = await client.getTransactionReceipt({ hash: hit.transactionHash as Hex });
    return { status: "found", success: true, ...base, transfer: checkTransfer(receipt, hit, search.account, search.payment) };
  } catch (error) {
    // The operation is proven by its own event. Only the transfer detail is missing.
    void error;
    return { status: "found", success: true, ...base, transfer: { kind: "not-applicable" } };
  }
};

