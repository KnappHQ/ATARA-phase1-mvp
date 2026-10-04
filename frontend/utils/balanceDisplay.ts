import type { BalanceSource } from "@/stores/useWalletStore";

/**
 * What a balance on screen says.
 *
 * A balance that was never read is not zero, and a USD value that has no price
 * is not "$0.00": both read as an empty wallet, which is the one thing a person
 * must never be told by mistake. So the display depends on whether the value is
 * KNOWN, and a known zero (the wallet was read and is really empty) still shows
 * as 0.
 */
export const UNAVAILABLE = "Unavailable";

/** Token amounts were read, from ATARA's service or straight from the chain. */
export const balancesKnown = (source: BalanceSource): boolean => source !== null;

/** USD values exist only when ATARA's price service answered. */
export const usdValuesKnown = (source: BalanceSource): boolean => source === "service";

/** "12.5", "0" or, when the amount is not known or not a number, "Unavailable". */
export const formatAssetBalance = (balance: string | null | undefined, known: boolean): string => {
  if (!known || balance === null || balance === undefined || balance.trim() === "") return UNAVAILABLE;
  const amount = Number(balance.replace(/,/g, ""));
  if (!Number.isFinite(amount)) return UNAVAILABLE;
  return amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 6 });
};

/** "$12.50", "$0.00" for a real zero, or "Unavailable" when there is no price or no value. */
export const formatAssetUsd = (usdValue: string | null | undefined, known: boolean): string => {
  if (!known || usdValue === null || usdValue === undefined || usdValue.trim() === "") return UNAVAILABLE;
  const amount = Number(usdValue.replace(/[$,]/g, ""));
  if (!Number.isFinite(amount)) return UNAVAILABLE;
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
