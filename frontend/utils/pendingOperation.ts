import { baseUnitsToDecimal } from "./paymentRequest";

/**
 * A payment submitted from this phone whose outcome was never confirmed.
 *
 * While one is stored, the phone refuses to send another payment: that is what
 * stops a slow network from turning one payment into two. The record used to
 * hold only the provider's bundle id, so once the provider forgot that id the
 * phone could neither confirm the payment nor let the person pay again.
 */
export interface StoredPendingOperation {
  id: string;
  /** JSON list of [target, value, data] for each call, as sent. */
  fingerprint?: string;
  /** When it was sent. Absent on records written before this field existed. */
  createdAt?: number;
}

export interface PendingPayment {
  recipient: string;
  /** In base units. */
  amount: string;
  /** Token contract, or null for ETH. */
  token: string | null;
}

/** After this long, an operation the provider cannot report on is treated as stale. */
export const STALE_AFTER_MS = 30 * 60 * 1000;

const TRANSFER_SELECTOR = "0xa9059cbb";
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export const parseStoredOperation = (stored: string): StoredPendingOperation | null => {
  try {
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed.id === "string") {
      return {
        id: parsed.id,
        fingerprint: typeof parsed.fingerprint === "string" ? parsed.fingerprint : undefined,
        createdAt: typeof parsed.createdAt === "number" ? parsed.createdAt : undefined,
      };
    }
  } catch {
    // The oldest records were the bare id.
  }
  return stored ? { id: stored } : null;
};

/** What the pending payment was: who it pays and how much. Null if unreadable. */
export const describePendingPayment = (
  operation: StoredPendingOperation,
): PendingPayment | null => {
  if (!operation.fingerprint) return null;
  let calls: unknown;
  try {
    calls = JSON.parse(operation.fingerprint);
  } catch {
    return null;
  }
  if (!Array.isArray(calls) || calls.length !== 1 || !Array.isArray(calls[0])) return null;
  const [target, value, data] = calls[0] as [unknown, unknown, unknown];
  if (typeof target !== "string" || typeof value !== "string" || typeof data !== "string") return null;
  if (!ADDRESS.test(target) || !/^\d+$/.test(value)) return null;

  if (data === "0x" && value !== "0") {
    return { recipient: target, amount: value, token: null };
  }
  const body = data.toLowerCase();
  if (body.startsWith(TRANSFER_SELECTOR) && body.length === 2 + 8 + 64 + 64) {
    const recipient = `0x${body.slice(10 + 24, 10 + 64)}`;
    const amount = BigInt(`0x${body.slice(10 + 64)}`).toString();
    return { recipient, amount, token: target.toLowerCase() };
  }
  return null;
};

export const isStale = (operation: StoredPendingOperation, now: number) =>
  operation.createdAt === undefined || now - operation.createdAt >= STALE_AFTER_MS;

/** "10 USDC to 0x5999…204c", with the decimals of the token it pays in. */
export const formatPendingPayment = (
  payment: PendingPayment,
  tokens: { contractAddress?: string | null; symbol: string; decimals: number }[],
): string => {
  const token = payment.token
    ? tokens.find((t) => t.contractAddress?.toLowerCase() === payment.token)
    : tokens.find((t) => t.symbol === "ETH");
  const amount = token ? baseUnitsToDecimal(payment.amount, token.decimals) : null;
  const who = `${payment.recipient.slice(0, 6)}…${payment.recipient.slice(-4)}`;
  return amount && token ? `${amount} ${token.symbol} to ${who}` : `a payment to ${who}`;
};
