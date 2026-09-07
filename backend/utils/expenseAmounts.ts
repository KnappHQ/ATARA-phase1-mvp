import { ErrorHandler } from "./errorHandler";

/** Decimal input, integer arithmetic: no exponent, NaN, or invisible rounding. */
export function cents(input: unknown, allowZero = false): number {
  const value = String(input ?? "").trim();
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(value))
    throw new ErrorHandler("Use a decimal amount with at most two decimal places", 400);
  const [whole, fraction = ""] = value.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (result < (allowZero ? 0 : 1) || result > 100_000_000)
    throw new ErrorHandler("Amount must be between 0.01 and 1,000,000", 400);
  return result;
}

export function splitExpense(
  amount: unknown,
  memberIds: string[],
  custom?: { userId: string; amount: unknown }[],
): { userId: string; amount: string }[] {
  const total = cents(amount);
  const ids = [...new Set(memberIds)].sort();
  if (!ids.length || ids.length > 50 || ids.length !== memberIds.length)
    throw new ErrorHandler("Select between 1 and 50 distinct group members", 400);
  if (custom !== undefined) {
    if (!Array.isArray(custom) || custom.length !== ids.length ||
        new Set(custom.map(s => s?.userId)).size !== ids.length ||
        custom.some(s => !ids.includes(s?.userId)))
      throw new ErrorHandler("Specify one share for every selected member", 400);
    const shares = custom.map(s => ({ userId: s.userId, value: cents(s.amount, true) }));
    if (shares.reduce((sum, s) => sum + s.value, 0) !== total)
      throw new ErrorHandler("The shares must add up to the expense total", 400);
    return shares.map(s => ({ userId: s.userId, amount: (s.value / 100).toFixed(2) }));
  }
  return ids.map((userId, index) => ({ userId,
    amount: ((Math.floor(total / ids.length) + (index < total % ids.length ? 1 : 0)) / 100).toFixed(2),
  }));
}
