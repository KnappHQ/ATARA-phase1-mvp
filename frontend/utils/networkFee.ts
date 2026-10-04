/**
 * The network fee, paid in USDC. Everything here is whole base units (bigint),
 * never floating point: USDC has 6 decimals and a JS number drifts on them.
 *
 * A missing, zero or malformed fee is never turned into a number. It stays
 * "unavailable", and a payment waits for a real one.
 */

export const FEE_TOKEN_SYMBOL = "USDC";
export const FEE_TOKEN_DECIMALS = 6;

/** A fee may rise by this much between the review and the signature. */
export const FEE_TOLERANCE_PERCENT = 25n;

const USDC_UNIT = 10n ** BigInt(FEE_TOKEN_DECIMALS);
const CENT = USDC_UNIT / 100n;

export type FeeErrorCode = "FEE_UNAVAILABLE" | "FEE_CHANGED" | "FEE_INSUFFICIENT" | "FEE_SERVICE";

export const FEE_MESSAGES: Record<FeeErrorCode, string> = {
  FEE_UNAVAILABLE: "The network fee could not be calculated. No money was sent.",
  FEE_CHANGED: "The network fee changed. Please check and confirm again.",
  FEE_INSUFFICIENT: "You need a little USDC to pay the network fee. No money was sent.",
  FEE_SERVICE: "Payments are temporarily unavailable. No money was sent.",
};

export type FeeError = Error & { code: FeeErrorCode; notSent: true };

export const createFeeError = (code: FeeErrorCode, message?: string): FeeError =>
  Object.assign(new Error(message ?? FEE_MESSAGES[code]), { name: "NetworkFeeError", code, notSent: true as const });

export const isFeeError = (error: unknown): error is FeeError =>
  !!error && typeof error === "object" && typeof (error as { code?: unknown }).code === "string" &&
  (error as { code: string }).code in FEE_MESSAGES;

/** A fee quote is usable only when it is a positive amount of whole base units. */
export const isUsableFee = (value: unknown): value is bigint => typeof value === "bigint" && value > 0n;

/** "123456" with 6 decimals -> "0.123456". Trailing zeros are kept to at least `minDecimals`. */
export const formatUnits = (units: bigint, decimals: number, minDecimals = 2): string => {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  let fraction = (abs % base).toString().padStart(decimals, "0");
  while (fraction.length > minDecimals && fraction.endsWith("0")) fraction = fraction.slice(0, -1);
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
};

/** "25.5" -> 25_500_000n. Null for anything that is not a plain decimal that fits `decimals`. */
export const parseUnits = (text: string, decimals: number): bigint | null => {
  const trimmed = (text ?? "").trim().replace(/,/g, "");
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(trimmed)) return null;
  const [whole = "", fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) return null;
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
};

/** What the person reads: "about $0.02", "less than $0.01", or "Unavailable". Never "$0". */
export const formatNetworkFee = (maxFee: bigint | null | undefined): string => {
  if (!isUsableFee(maxFee)) return "Unavailable";
  if (maxFee < CENT) return "less than $0.01";
  const cents = (maxFee + CENT - 1n) / CENT; // round up: a shown fee is never below the real maximum
  return `about $${formatUnits(cents * CENT, FEE_TOKEN_DECIMALS)}`;
};

/** An amount of USDC with its unit, e.g. "24.97 USDC". */
export const formatUsdc = (units: bigint): string => `${formatUnits(units, FEE_TOKEN_DECIMALS)} ${FEE_TOKEN_SYMBOL}`;

/** The most that can be sent from a USDC balance once the largest possible fee is kept back. */
export const maxSendable = (balance: bigint, maxFee: bigint | null | undefined): bigint | null => {
  if (!isUsableFee(maxFee)) return null;
  return balance > maxFee ? balance - maxFee : 0n;
};

/** Rounds `units` down to a token's own decimals, from USDC's 6 (never up). */
export const roundDownToDecimals = (units: bigint, fromDecimals: number, toDecimals: number): bigint => {
  if (toDecimals >= fromDecimals) return units * 10n ** BigInt(toDecimals - fromDecimals);
  const step = 10n ** BigInt(fromDecimals - toDecimals);
  return (units / step) * step;
};

export type FundsCheck =
  | { ok: true }
  | { ok: false; reason: "amount-and-fee" | "fee"; message: string; maxSend?: bigint };

/**
 * Can the account pay the amount AND the fee? For a USDC send both come out of the
 * same balance. For any other token only the fee comes out of the USDC balance.
 */
export const checkFunds = (input: {
  amount: bigint;
  sendingFeeToken: boolean;
  tokenBalance: bigint;
  feeTokenBalance: bigint;
  maxFee: bigint;
}): FundsCheck => {
  const { amount, sendingFeeToken, tokenBalance, feeTokenBalance, maxFee } = input;
  const feeText = formatNetworkFee(maxFee);
  if (sendingFeeToken) {
    if (amount + maxFee <= tokenBalance) return { ok: true };
    const maxSend = maxSendable(tokenBalance, maxFee) ?? 0n;
    return {
      ok: false,
      reason: "amount-and-fee",
      message: `Not enough USDC to cover this amount and the network fee (${feeText}).`,
      ...(maxSend > 0n ? { maxSend } : {}),
    };
  }
  if (maxFee <= feeTokenBalance) return { ok: true };
  return { ok: false, reason: "fee", message: `You need a little USDC (${feeText}) to pay the network fee.` };
};

/** True when the real maximum fee is more than the tolerance above what the person was shown. */
export const feeChangedTooMuch = (shown: bigint, actual: bigint): boolean =>
  actual * 100n > shown * (100n + FEE_TOLERANCE_PERCENT);

/** What the review says leaves the account. */
export const formatLeavesAccount = (input: {
  amount: string;
  tokenSymbol: string;
  maxFee: bigint | null | undefined;
}): string => {
  const { amount, tokenSymbol, maxFee } = input;
  if (!isUsableFee(maxFee)) return `${amount} ${tokenSymbol} + network fee`;
  if (tokenSymbol === FEE_TOKEN_SYMBOL) {
    const units = parseUnits(amount, FEE_TOKEN_DECIMALS);
    return units === null
      ? `${amount} ${tokenSymbol} + network fee`
      : `${amount} ${tokenSymbol} + fee (max ${formatUsdc(units + maxFee)})`;
  }
  return `${amount} ${tokenSymbol} + network fee ${formatNetworkFee(maxFee)} in USDC`;
};

/**
 * Plain-language mapping of what a provider says when the FEE cannot be paid.
 * Deliberately narrow: only wording that names the fee machinery counts. A
 * reverted simulation, an AA23 validation failure or "transfer amount exceeds
 * balance" can come from the payment itself, and calling them a fee problem would
 * hide the real cause, so they stay unclassified (null).
 */
export const classifyFeeFailure = (message: string): FeeErrorCode | null => {
  if (/AA21|didn'?t pay prefund/i.test(message)) return "FEE_INSUFFICIENT";
  if (/paymaster|gas manager|policy id|AA3\d/i.test(message)) return "FEE_SERVICE";
  return null;
};

/** A wallet asset's balance in base units: the exact figure when known, else its decimal text. Null when neither is readable. */
export const assetBaseUnits = (asset: { balance?: string; balanceWei?: string; decimals: number } | undefined | null): bigint | null => {
  if (!asset) return null;
  if (asset.balanceWei !== undefined && /^\d+$/.test(asset.balanceWei)) return BigInt(asset.balanceWei);
  return parseUnits(asset.balance ?? "", asset.decimals);
};

export interface SendAssessment {
  /** Why the payment cannot go ahead on funds, in plain words; null when it can. */
  fundsMessage: string | null;
  /** For a USDC send: the most that can be sent (balance minus the largest fee), if above zero. */
  maxSend: bigint | null;
}

/**
 * Funds check for the current draft. Without a real fee quote there is no honest
 * answer, so the caller gets no message and must wait for the quote on its own.
 */
export const assessSend = (input: {
  amountUnits: bigint | null;
  tokenSymbol: string;
  tokenBalance: bigint | null;
  feeTokenBalance: bigint | null;
  maxFee: bigint | null | undefined;
}): SendAssessment => {
  const { amountUnits, tokenSymbol, tokenBalance, feeTokenBalance, maxFee } = input;
  if (!isUsableFee(maxFee) || amountUnits === null) return { fundsMessage: null, maxSend: null };
  const sendingFeeToken = tokenSymbol === FEE_TOKEN_SYMBOL;
  const funds = checkFunds({
    amount: amountUnits,
    sendingFeeToken,
    tokenBalance: tokenBalance ?? 0n,
    feeTokenBalance: sendingFeeToken ? (tokenBalance ?? 0n) : (feeTokenBalance ?? 0n),
    maxFee,
  });
  if (funds.ok) return { fundsMessage: null, maxSend: null };
  return { fundsMessage: funds.message, maxSend: funds.reason === "amount-and-fee" ? funds.maxSend ?? null : null };
};

/** The quote on a prepared payment, or null when it is not a real fee in the fee token. */
export const usableFee = (prepared: any, feeTokenAddress: string): bigint | null => {
  const quote = prepared?.feePayment;
  if (!quote || quote.sponsored) return null;
  if (String(quote.tokenAddress ?? "").toLowerCase() !== feeTokenAddress.toLowerCase()) return null;
  return isUsableFee(quote.maxAmount) ? quote.maxAmount : null;
};

/** What the person saw and could afford when they confirmed, in whole base units. */
export interface FeeGuard {
  /** The largest network fee the review showed, in USDC base units. */
  shownMaxFee: bigint;
  /** The amount being sent, in the sent token's base units. */
  amount: bigint;
  sendingFeeToken: boolean;
  tokenBalance: bigint;
  feeTokenBalance: bigint;
}

/**
 * Runs on the real prepared payment, before it is recorded or signed. Throws when
 * there is no real fee, when no fee was shown (no guard), when it rose past what the person was shown, or when it no
 * longer fits the balance. Nothing has been sent at that point.
 */
export const checkPreparedFee = (prepared: any, feeTokenAddress: string, guard?: FeeGuard): bigint => {
  const actual = usableFee(prepared, feeTokenAddress);
  // No fee was shown to the person (no guard): there is nothing they agreed to, so nothing is signed.
  if (actual === null || !guard) throw createFeeError("FEE_UNAVAILABLE");
  if (feeChangedTooMuch(guard.shownMaxFee, actual)) throw createFeeError("FEE_CHANGED");
  const funds = checkFunds({
    amount: guard.amount,
    sendingFeeToken: guard.sendingFeeToken,
    tokenBalance: guard.tokenBalance,
    feeTokenBalance: guard.feeTokenBalance,
    maxFee: actual,
  });
  if (!funds.ok) throw createFeeError(funds.reason === "fee" ? "FEE_INSUFFICIENT" : "FEE_CHANGED");
  return actual;
};
