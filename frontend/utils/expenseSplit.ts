/**
 * Who owes what on a group expense, in whole cents.
 *
 * The same arithmetic the server uses (`backend/utils/expenseAmounts.ts`): people sorted by
 * id, the remaining cents go to the first ones. Pure, so the screen can show every share
 * before anything is saved, and a test can pin the numbers.
 */

export type SplitMode = "equal" | "custom" | "percent";

export const MAX_TOTAL_CENTS = 100_000_000;

/** "12.5" -> 1250. Null when the text is not an amount with at most two decimals. */
export const toCents = (text: string): number | null => {
  const value = text.trim().replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
};

export const formatCents = (cents: number): string => (cents / 100).toFixed(2);

const sortedUnique = (ids: string[]) => [...new Set(ids)].sort();

/** Equal shares: every person gets the same, the leftover cents go to the first ids. */
export const equalShares = (totalCents: number, ids: string[]): Record<string, number> => {
  const people = sortedUnique(ids);
  const result: Record<string, number> = {};
  people.forEach((id, index) => {
    result[id] = Math.floor(totalCents / people.length) + (index < totalCents % people.length ? 1 : 0);
  });
  return result;
};

/** "33.33" -> 3333 hundredths of a percent. Null when it is not a percentage with at most two decimals. */
export const toBasisPoints = (text: string): number | null => {
  const value = text.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const basis = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return basis > 10_000 ? null : basis;
};

export interface SplitInput {
  mode: SplitMode;
  totalCents: number;
  /** Everyone who shares the expense, the payer included. */
  ids: string[];
  /** What was typed per person, as text: amounts for "custom", percentages for "percent". */
  typed: Record<string, string>;
  unit: string;
}

export interface SplitResult {
  /** One share per person, in cents. Null while the numbers do not add up. */
  shares: Record<string, number> | null;
  /** A plain sentence saying what to fix, or null. */
  error: string | null;
}

export const computeSplit = ({ mode, totalCents, ids, typed, unit }: SplitInput): SplitResult => {
  const people = sortedUnique(ids);
  if (totalCents <= 0 || people.length === 0) return { shares: null, error: null };

  if (mode === "equal") return { shares: equalShares(totalCents, people), error: null };

  if (mode === "custom") {
    const shares: Record<string, number> = {};
    for (const id of people) {
      const text = typed[id] ?? "";
      const cents = text.trim() === "" ? 0 : toCents(text);
      if (cents === null) return { shares: null, error: "Use amounts with at most two decimals, for example 12.50." };
      shares[id] = cents;
    }
    const assigned = Object.values(shares).reduce((sum, cents) => sum + cents, 0);
    if (assigned < totalCents)
      return { shares: null, error: `Still to allocate ${formatCents(totalCents - assigned)} ${unit}. The shares must add up to the total.` };
    if (assigned > totalCents)
      return { shares: null, error: `Over allocated by ${formatCents(assigned - totalCents)} ${unit}. The shares must add up to the total.` };
    return { shares, error: null };
  }

  const basis: Record<string, number> = {};
  for (const id of people) {
    const text = typed[id] ?? "";
    const value = text.trim() === "" ? 0 : toBasisPoints(text);
    if (value === null) return { shares: null, error: "Use percentages between 0 and 100, with at most two decimals." };
    basis[id] = value;
  }
  const percentTotal = Object.values(basis).reduce((sum, value) => sum + value, 0);
  if (percentTotal !== 10_000)
    return { shares: null, error: `Percentages must add up to 100% (now ${(percentTotal / 100).toFixed(2).replace(/\.?0+$/, "")}%).` };
  // Whole cents for everyone, then the leftover cents go to the first people with a share.
  const shares: Record<string, number> = {};
  for (const id of people) shares[id] = Math.floor((totalCents * basis[id]) / 10_000);
  let left = totalCents - Object.values(shares).reduce((sum, cents) => sum + cents, 0);
  for (const id of people) {
    if (left === 0) break;
    if (basis[id] > 0) {
      shares[id] += 1;
      left -= 1;
    }
  }
  return { shares, error: null };
};

export interface SummaryLine {
  userId: string;
  text: string;
}

/** One sentence per person: "@alex owes you 25.00 USDC", and your own share for you. */
export const summaryLines = (
  shares: Record<string, number>,
  handles: Record<string, string>,
  payerId: string,
  unit: string,
): SummaryLine[] =>
  sortedUnique(Object.keys(shares)).map((userId) =>
    userId === payerId
      ? { userId, text: `Your share: ${formatCents(shares[userId])} ${unit}` }
      : { userId, text: `@${handles[userId] ?? "member"} owes you ${formatCents(shares[userId])} ${unit}` },
  );

/** The people sharing the expense: those ticked, and always the payer. */
export const sharingIds = (selected: Record<string, boolean>, payerId: string): string[] =>
  sortedUnique([payerId, ...Object.keys(selected).filter((id) => selected[id])]);

/** An expense needs someone besides the payer. */
export const hasSomeoneElse = (ids: string[], payerId: string): boolean =>
  ids.some((id) => id !== payerId);

/** The `customSplits` to send: nothing for an equal split (the server divides), one share per person otherwise. */
export const customSplitsToSend = (
  mode: SplitMode,
  shares: Record<string, number> | null,
): { userId: string; amount: string }[] | undefined =>
  mode === "equal" || !shares
    ? undefined
    : sortedUnique(Object.keys(shares)).map((userId) => ({ userId, amount: formatCents(shares[userId]) }));
