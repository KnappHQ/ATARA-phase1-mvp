import { baseUnitsToDecimal } from "./paymentRequest";

export type OnChainReading = {
  symbol: string;
  balanceWei: string;
  decimals: number;
};

type AssetLike = { symbol: string; balance: string; balanceWei?: string };

/**
 * Applies balances read straight from the chain onto the known assets.
 *
 * Only the token amounts change. USD values are left alone on purpose: when
 * the chain is the source, ATARA's price service is the thing that failed, and
 * a guessed price would be a number the user cannot check. A reading the
 * formatter rejects is dropped rather than shown as a zero balance.
 */
export const mergeOnChainBalances = <T extends AssetLike>(
  assets: T[],
  readings: OnChainReading[],
): T[] =>
  assets.map((asset) => {
    const reading = readings.find((item) => item.symbol === asset.symbol);
    if (!reading) return asset;
    const balance = baseUnitsToDecimal(reading.balanceWei, reading.decimals);
    if (balance === null) return asset;
    return { ...asset, balance, balanceWei: reading.balanceWei };
  });

/**
 * Splits a dollar value into grouped whole dollars and exactly two cents
 * digits. The home screen used to append a literal ".00" to
 * `toLocaleString()`, so $12.50 read "$12.5.00".
 */
export const splitUsd = (value: number): { whole: string; cents: string } => {
  const safe = Number.isFinite(value) && value > 0 ? value : 0;
  const totalCents = Math.round(safe * 100);
  const whole = Math.floor(totalCents / 100);
  return {
    whole: whole.toLocaleString("en-US"),
    cents: String(totalCents % 100).padStart(2, "0"),
  };
};
