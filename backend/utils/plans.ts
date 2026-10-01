/**
 * The offers, and what each one gives. Pure data and validation: nothing here
 * talks to a database, a payment provider or the network.
 *
 * The numbers are product decisions, not facts about the world. They live here
 * (and can be overridden with PLANS_OVERRIDE_JSON) so that changing a price or a
 * limit never needs a new app release. See docs/MONETIZATION_AND_CARD_PLAN.md.
 *
 * Money is in integer minor units (cents) and rates in basis points, never in
 * floating point.
 */

export type PlanId = "FREE" | "PLUS" | "MAX";
export const PLAN_IDS: readonly PlanId[] = ["FREE", "PLUS", "MAX"];

/** What an operation is, for the fee schedule. */
export type FeeKind = "transfer" | "ramp" | "card_fx" | "swap";

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly price in euro cents. 0 for Free. */
  priceEurCents: number;
  limits: {
    /** Vaults the account may create. */
    vaults: number;
    /** Members per vault, the creator included. The contract itself caps this at 10. */
    vaultMembers: number;
  };
  sponsorship: {
    /** Sends per calendar month whose network fee ATARA pays. */
    monthlySends: number;
    /** One extra sponsored send per this much card spend in the month (USD cents). 0 = none. */
    spendStepUsdCents: number;
    /** Most extra sends card spend can add in a month. */
    spendBonusCap: number;
  };
  /** ATARA Miles earned per whole US dollar of card spend. */
  milesPerUsd: number;
  /** Fee rates in basis points of the amount (100 bps = 1 %). */
  feeBps: Record<FeeKind, number>;
}

export const MILES_PER_SPONSORED_SEND = 20;

const DEFAULT_PLANS: Record<PlanId, Plan> = {
  FREE: {
    id: "FREE",
    name: "ATARA",
    priceEurCents: 0,
    limits: { vaults: 1, vaultMembers: 4 },
    sponsorship: { monthlySends: 10, spendStepUsdCents: 5000, spendBonusCap: 20 },
    milesPerUsd: 1,
    feeBps: { transfer: 0, ramp: 50, card_fx: 90, swap: 40 },
  },
  PLUS: {
    id: "PLUS",
    name: "ATARA Plus",
    priceEurCents: 499,
    limits: { vaults: 5, vaultMembers: 10 },
    sponsorship: { monthlySends: 60, spendStepUsdCents: 2500, spendBonusCap: 60 },
    milesPerUsd: 2,
    feeBps: { transfer: 0, ramp: 30, card_fx: 50, swap: 25 },
  },
  MAX: {
    id: "MAX",
    name: "ATARA Max",
    priceEurCents: 1299,
    limits: { vaults: 20, vaultMembers: 10 },
    // "Unlimited" is a fair-use ceiling, so that one account cannot cost without bound.
    sponsorship: { monthlySends: 500, spendStepUsdCents: 0, spendBonusCap: 0 },
    milesPerUsd: 3,
    feeBps: { transfer: 0, ramp: 10, card_fx: 20, swap: 15 },
  },
};

const FEE_KINDS: readonly FeeKind[] = ["transfer", "ramp", "card_fx", "swap"];

/** The hard ceilings an override may not exceed: a typo must not make a plan free-for-all or a fee 100 %. */
const MAX_FEE_BPS = 500; // 5 %
const MAX_VAULTS = 100;
const MAX_VAULT_MEMBERS = 10; // the deployed contract's own limit
const MAX_MONTHLY_SENDS = 10_000;

const isInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

const clone = (plans: Record<PlanId, Plan>): Record<PlanId, Plan> => JSON.parse(JSON.stringify(plans));

/**
 * Applies a JSON override (from the environment) to the defaults. Anything
 * invalid is ignored field by field, and what is ignored is reported, so a bad
 * override can never take the service down or open a plan up by accident.
 */
export const applyPlanOverrides = (
  raw: string | undefined,
): { plans: Record<PlanId, Plan>; ignored: string[] } => {
  const plans = clone(DEFAULT_PLANS);
  const ignored: string[] = [];
  if (!raw || !raw.trim()) return { plans, ignored };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { plans, ignored: ["PLANS_OVERRIDE_JSON is not valid JSON"] };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { plans, ignored: ["PLANS_OVERRIDE_JSON must be an object"] };
  }

  for (const id of PLAN_IDS) {
    const patch = (parsed as Record<string, any>)[id];
    if (patch === undefined) continue;
    if (!patch || typeof patch !== "object") {
      ignored.push(`${id}: not an object`);
      continue;
    }
    const plan = plans[id];
    const set = (path: string, ok: boolean, apply: () => void) => {
      if (ok) apply();
      else ignored.push(`${id}.${path}`);
    };
    if ("name" in patch) set("name", typeof patch.name === "string" && patch.name.length > 0 && patch.name.length <= 40, () => (plan.name = patch.name));
    if ("priceEurCents" in patch) set("priceEurCents", isInt(patch.priceEurCents, 0, 100_000) && (id !== "FREE" || patch.priceEurCents === 0), () => (plan.priceEurCents = patch.priceEurCents));
    if ("milesPerUsd" in patch) set("milesPerUsd", isInt(patch.milesPerUsd, 0, 20), () => (plan.milesPerUsd = patch.milesPerUsd));
    const limits = patch.limits;
    if (limits && typeof limits === "object") {
      if ("vaults" in limits) set("limits.vaults", isInt(limits.vaults, 0, MAX_VAULTS), () => (plan.limits.vaults = limits.vaults));
      if ("vaultMembers" in limits) set("limits.vaultMembers", isInt(limits.vaultMembers, 2, MAX_VAULT_MEMBERS), () => (plan.limits.vaultMembers = limits.vaultMembers));
    }
    const sponsorship = patch.sponsorship;
    if (sponsorship && typeof sponsorship === "object") {
      if ("monthlySends" in sponsorship) set("sponsorship.monthlySends", isInt(sponsorship.monthlySends, 0, MAX_MONTHLY_SENDS), () => (plan.sponsorship.monthlySends = sponsorship.monthlySends));
      if ("spendStepUsdCents" in sponsorship) set("sponsorship.spendStepUsdCents", isInt(sponsorship.spendStepUsdCents, 0, 10_000_000), () => (plan.sponsorship.spendStepUsdCents = sponsorship.spendStepUsdCents));
      if ("spendBonusCap" in sponsorship) set("sponsorship.spendBonusCap", isInt(sponsorship.spendBonusCap, 0, MAX_MONTHLY_SENDS), () => (plan.sponsorship.spendBonusCap = sponsorship.spendBonusCap));
    }
    const feeBps = patch.feeBps;
    if (feeBps && typeof feeBps === "object") {
      for (const kind of FEE_KINDS) {
        if (kind in feeBps) set(`feeBps.${kind}`, isInt(feeBps[kind], 0, MAX_FEE_BPS), () => (plan.feeBps[kind] = feeBps[kind]));
      }
    }
  }
  return { plans, ignored };
};

let cached: { plans: Record<PlanId, Plan>; ignored: string[] } | null = null;

/** The plans in force: defaults plus the environment's override, read once per process. */
export const getPlans = (): Record<PlanId, Plan> => {
  if (!cached) cached = applyPlanOverrides(process.env.PLANS_OVERRIDE_JSON);
  return cached.plans;
};

export const getPlan = (id: PlanId): Plan => getPlans()[id];

/** For tests. */
export const resetPlansCache = () => {
  cached = null;
};
