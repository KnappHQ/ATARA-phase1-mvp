import { isUsableFee } from "./networkFee";

/** Where a fee quote stands. `ready` always carries a real, positive fee. */
export type FeeQuote =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; maxFee: bigint }
  | { status: "unavailable" };

/**
 * Runs fee estimates one at a time in effect: only the newest request may change
 * the state, so a slow answer for an earlier recipient or token can never be shown
 * for the current one. Any failure, or an answer that is not a real fee, is
 * "unavailable": there is no default fee.
 */
export const createFeeEstimator = (
  estimate: () => Promise<bigint>,
  onChange: (quote: FeeQuote) => void,
) => {
  let current = 0;
  return {
    run: async (): Promise<void> => {
      const mine = ++current;
      onChange({ status: "loading" });
      let quote: FeeQuote;
      try {
        const fee = await estimate();
        quote = isUsableFee(fee) ? { status: "ready", maxFee: fee } : { status: "unavailable" };
      } catch {
        quote = { status: "unavailable" };
      }
      if (mine === current) onChange(quote);
    },
    /** Drops any answer still on its way. */
    cancel: (to: FeeQuote = { status: "idle" }): void => {
      current++;
      onChange(to);
    },
  };
};
