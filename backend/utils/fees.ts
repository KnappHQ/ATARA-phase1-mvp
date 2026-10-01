import { getPlan, type FeeKind, type PlanId } from "./plans";

/**
 * Fees ATARA may take, computed from the plan's rate card.
 *
 * Rules that protect the person paying:
 *  - integer arithmetic on base units (bigint), never floating point;
 *  - rounded DOWN, so a fee is never more than its stated rate;
 *  - a fee is only ever computed for a kind that has a rate: zero rate, zero fee;
 *  - the same function produces the number shown before the person confirms and
 *    the number charged, so the two cannot differ.
 *
 * Nothing here moves money. Where a fee is actually collected (the on-ramp
 * partner, the card program) is up to that integration.
 */

export interface FeeQuote {
  kind: FeeKind;
  plan: PlanId;
  bps: number;
  /** In the same base units as the amount. */
  feeBaseUnits: bigint;
  /** What the other party receives or is credited: amount minus fee, for fees taken out of the amount. */
  netBaseUnits: bigint;
}

export const computeFee = (input: { kind: FeeKind; plan: PlanId; amountBaseUnits: bigint }): FeeQuote => {
  if (input.amountBaseUnits < 0n) throw new Error("Amount cannot be negative");
  const bps = getPlan(input.plan).feeBps[input.kind];
  const fee = (input.amountBaseUnits * BigInt(bps)) / 10_000n;
  return { kind: input.kind, plan: input.plan, bps, feeBaseUnits: fee, netBaseUnits: input.amountBaseUnits - fee };
};

/** "0.50 %" for display, from basis points. */
export const formatBps = (bps: number): string => `${(bps / 100).toFixed(2)} %`;
