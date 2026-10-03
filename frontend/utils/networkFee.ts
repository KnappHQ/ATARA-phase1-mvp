/**
 * The network fee of a payment, paid by the sender in USDC.
 *
 * ATARA no longer sponsors fees: every payment pays its own, taken from the same
 * account in USDC (Alchemy's ERC-20 paymaster), so nobody ever needs ETH. This
 * file holds the pure rules, all in USDC base units (bigint, 6 decimals), never
 * floating point:
 *
 *  - what to show: "about $0.02", "less than $0.01", never a fake 0;
 *  - what can be sent: the balance minus the largest fee that can be charged;
 *  - what stops a payment before anything is signed: no fee quote, a fee that
 *    grew past what was shown, or a balance that cannot cover amount plus fee.
 */
export const FEE_TOKEN_DECIMALS = 6;
/** The fee at signing may exceed the one shown by this much before the person is asked again. */
export const FEE_TOLERANCE_PERCENT = 25;

const CENT = 10_000n; // $0.01 in USDC base units

export type FeeFailureCode = "FEE_UNAVAILABLE" | "FEE_CHANGED" | "FEE_INSUFFICIENT";

/** Thrown before anything is signed, so nothing was sent. */
export class FeeError extends Error {
  readonly code: FeeFailureCode;
  readonly notSent = true;
  constructor(code: FeeFailureCode, message: string) {
    super(message);
    this.name = "FeeError";
    this.code = code;
  }
}

export const FEE_MESSAGES = {
  FEE_UNAVAILABLE: "We can't work out the network fee right now. Try again in a moment. No money was sent.",
  FEE_CHANGED: "The network fee changed. Please check and confirm again. No money was sent.",
  FEE_INSUFFICIENT: "Not enough USDC to cover this amount and the network fee. No money was sent.",
  SERVICE_DOWN: "Payments are temporarily unavailable. No money was sent. Try again later.",
} as const;

/** A fee is only real when it is a positive amount: 0 or missing is "unknown", never "free". */
export const isUsableFee = (fee: unknown): fee is bigint => typeof fee === "bigint" && fee > 0n;

/** "about $0.02" (rounded up to the cent), or "less than $0.01" for a fee under a cent. */
export const formatFee = (maxFee: bigint): string => {
  if (!isUsableFee(maxFee)) return "Unavailable";
  if (maxFee < CENT) return "less than $0.01";
  const cents = (maxFee + CENT - 1n) / CENT;
  const dollars = cents / 100n;
  const rest = (cents % 100n).toString().padStart(2, "0");
  return `about $${dollars}.${rest}`;
};

/** A USDC amount in base units as plain text, at most 6 decimals, no trailing zeros ("24.97", "25"). */
export const formatUsdc = (base: bigint): string => {
  const whole = base / 1_000_000n;
  const fraction = (base % 1_000_000n).toString().padStart(FEE_TOKEN_DECIMALS, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
};

/**
 * Decimal text to base units, or null when it is not a plain non-negative number.
 * Extra decimals beyond the token's are cut off, never rounded up.
 */
export const toBaseUnits = (text: string | undefined | null, decimals: number): bigint | null => {
  const cleaned = (text ?? "").trim().replace(/,/g, "");
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === "" || cleaned === ".") return null;
  const [whole, fraction = ""] = cleaned.split(".");
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(fraction.slice(0, decimals).padEnd(decimals, "0") || "0");
};

/** The most that can be sent in USDC when the fee must also be paid from the balance. */
export const maxSendable = (balance: bigint, maxFee: bigint): bigint => (balance > maxFee ? balance - maxFee : 0n);

export type FeeCheck =
  | { ok: true }
  | { ok: false; reason: "estimating" | "unavailable" | "not-enough-for-fee" | "not-enough-usdc-for-fee"; maxSendable?: bigint };

/**
 * Can this payment be made, fee included?
 * `usdcBalance` is null when the balance is not known: that is "unavailable", not zero.
 */
export const checkFee = (input: {
  feeState: "loading" | "ready" | "unavailable";
  maxFee: bigint | null;
  tokenSymbol: string;
  /** The amount being sent, in the token's base units. */
  amountBase: bigint;
  usdcBalance: bigint | null;
}): FeeCheck => {
  if (input.feeState === "loading") return { ok: false, reason: "estimating" };
  if (input.feeState === "unavailable" || !isUsableFee(input.maxFee) || input.usdcBalance === null) {
    return { ok: false, reason: "unavailable" };
  }
  if (input.tokenSymbol === "USDC") {
    if (input.amountBase + input.maxFee > input.usdcBalance) {
      return { ok: false, reason: "not-enough-for-fee", maxSendable: maxSendable(input.usdcBalance, input.maxFee) };
    }
    return { ok: true };
  }
  if (input.usdcBalance < input.maxFee) return { ok: false, reason: "not-enough-usdc-for-fee" };
  return { ok: true };
};

/** The sentence under the amount when a payment cannot be made because of the fee. */
export const feeCheckMessage = (check: FeeCheck, maxFee: bigint | null): string | null => {
  if (check.ok) return null;
  const fee = isUsableFee(maxFee) ? formatFee(maxFee) : null;
  switch (check.reason) {
    case "estimating":
      return null;
    case "unavailable":
      return "Network fee unavailable. Check your connection and try again.";
    case "not-enough-for-fee":
      return `Not enough USDC to cover this amount and the network fee${fee ? ` (${fee})` : ""}.`;
    case "not-enough-usdc-for-fee":
      return `You need a little USDC${fee ? ` (${fee})` : ""} to pay the network fee.`;
  }
};

/** True when the fee at signing is more than the tolerance above the one that was shown. */
export const feeChangedTooMuch = (shown: bigint, actual: bigint): boolean =>
  actual * 100n > shown * BigInt(100 + FEE_TOLERANCE_PERCENT);

/**
 * Reads the fee quote from a prepared payment. Only an unsponsored quote in USDC
 * with a positive maximum counts; anything else is "no quote".
 */
export const readFeeQuote = (prepared: any, usdcAddress: string): bigint | null => {
  const payment = prepared?.feePayment;
  if (!payment || payment.sponsored === true) return null;
  if (typeof payment.tokenAddress !== "string" || payment.tokenAddress.toLowerCase() !== usdcAddress.toLowerCase()) return null;
  return isUsableFee(payment.maxAmount) ? payment.maxAmount : null;
};

export interface FeeGuard {
  /** The maximum fee the person was shown. */
  shownMaxFee: bigint | null;
  usdcAddress: string;
  usdcBalance: bigint | null;
  /** USDC that leaves the account as the payment itself (0 when another token is sent). */
  payingUsdc: bigint;
}

/**
 * Runs on the real prepared payment, before anything is signed or recorded.
 * Throws a FeeError (nothing sent) unless the fee is known, fits the balance,
 * and has not grown past what the person saw.
 */
export const assertFeeAcceptable = (prepared: any, guard: FeeGuard): bigint => {
  const actual = readFeeQuote(prepared, guard.usdcAddress);
  if (actual === null || !isUsableFee(guard.shownMaxFee) || guard.usdcBalance === null) {
    throw new FeeError("FEE_UNAVAILABLE", FEE_MESSAGES.FEE_UNAVAILABLE);
  }
  if (feeChangedTooMuch(guard.shownMaxFee, actual)) {
    throw new FeeError("FEE_CHANGED", FEE_MESSAGES.FEE_CHANGED);
  }
  if (guard.payingUsdc + actual > guard.usdcBalance) {
    throw new FeeError("FEE_INSUFFICIENT", FEE_MESSAGES.FEE_INSUFFICIENT);
  }
  return actual;
};

/** Plain words for a payment that failed: the fee messages, a fee-service refusal, or null for anything else. */
export const feeFailureMessage = (error: unknown): string | null => {
  if (error instanceof FeeError) return error.message;
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "FEE_UNAVAILABLE" || code === "FEE_CHANGED" || code === "FEE_INSUFFICIENT") return FEE_MESSAGES[code];
  const text = String((error as { message?: unknown } | null)?.message ?? "");
  if (/paymaster|gas manager|erc-?20 policy/i.test(text)) return FEE_MESSAGES.SERVICE_DOWN;
  return null;
};

/** The "Network fee" line of the review. */
export const feeLineLabel = (state: "loading" | "ready" | "unavailable", maxFee: bigint | null): string =>
  state === "loading" ? "Estimating…" : state === "ready" && isUsableFee(maxFee) ? formatFee(maxFee) : "Unavailable";

/** The "Leaves your account" line: the payment plus the most the fee can be. */
export const leavesAccountLabel = (amount: string, tokenSymbol: string, maxFee: bigint | null): string => {
  if (!isUsableFee(maxFee)) return `${amount} ${tokenSymbol} + network fee`;
  return tokenSymbol === "USDC"
    ? `${amount} USDC + up to ${formatUsdc(maxFee)} USDC fee`
    : `${amount} ${tokenSymbol} + up to ${formatUsdc(maxFee)} USDC fee`;
};
