import { MILES_PER_SPONSORED_SEND, getPlan, type PlanId } from "./plans";

/**
 * ATARA Miles and the network fees ATARA pays, as pure rules.
 *
 * Two separate things, on purpose:
 *  1. the month's ALLOWANCE of sponsored sends, which card spend raises;
 *  2. MILES, a loyalty balance earned on card spend, spent on sponsored sends
 *     beyond the allowance.
 *
 * Miles are not money: they are not transferable and not redeemable for cash.
 */

/** Miles earned by one card purchase. Whole dollars only, rounded down; a refund removes what it earned. */
export const milesForSpend = (spendUsdCents: number, plan: PlanId): number => {
  if (!Number.isInteger(spendUsdCents) || spendUsdCents <= 0) return 0;
  return Math.floor(spendUsdCents / 100) * getPlan(plan).milesPerUsd;
};

/** Sponsored sends available this month before miles are needed. */
export const sponsorshipAllowance = (plan: PlanId, monthlySpendUsdCents: number): number => {
  const { monthlySends, spendStepUsdCents, spendBonusCap } = getPlan(plan).sponsorship;
  if (spendStepUsdCents <= 0 || !Number.isInteger(monthlySpendUsdCents) || monthlySpendUsdCents <= 0) return monthlySends;
  const bonus = Math.min(spendBonusCap, Math.floor(monthlySpendUsdCents / spendStepUsdCents));
  return monthlySends + bonus;
};

export type SponsorshipDecision =
  | { sponsor: true; via: "allowance"; remaining: number }
  | { sponsor: true; via: "miles"; milesCost: number; milesLeft: number }
  | { sponsor: false; reason: "no-allowance-no-miles"; milesNeeded: number; milesShort: number };

export const decideSponsorship = (input: {
  plan: PlanId;
  /** Sponsored sends already used this calendar month. */
  sponsoredThisMonth: number;
  monthlySpendUsdCents: number;
  milesBalance: number;
}): SponsorshipDecision => {
  const allowance = sponsorshipAllowance(input.plan, input.monthlySpendUsdCents);
  if (input.sponsoredThisMonth < allowance) {
    return { sponsor: true, via: "allowance", remaining: allowance - input.sponsoredThisMonth - 1 };
  }
  const balance = Math.max(0, Math.floor(input.milesBalance));
  if (balance >= MILES_PER_SPONSORED_SEND) {
    return { sponsor: true, via: "miles", milesCost: MILES_PER_SPONSORED_SEND, milesLeft: balance - MILES_PER_SPONSORED_SEND };
  }
  return {
    sponsor: false,
    reason: "no-allowance-no-miles",
    milesNeeded: MILES_PER_SPONSORED_SEND,
    milesShort: MILES_PER_SPONSORED_SEND - balance,
  };
};

/** The calendar month a moment falls in, in UTC: "2026-10". Allowances reset on the 1st, UTC. */
export const monthKey = (date: Date): string =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
