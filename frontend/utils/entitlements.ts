import type { PlanId, PlanInfo } from "@/services/subscription.service";

/**
 * What the app shows and checks from the offers. Every number comes from the
 * server's /plans and /subscription/me; nothing is decided here.
 *
 * Be clear about what an app-side check is: a convenience. It stops an honest
 * person walking into a limit by accident. It cannot stop someone who edits the
 * app, and nothing here pretends to: the server-side levers are described in
 * docs/MONETIZATION_AND_CARD_PLAN.md §2.
 */

export const formatPrice = (priceEurCents: number): string =>
  priceEurCents === 0 ? "Free" : `€${(priceEurCents / 100).toFixed(2)}/month`;

/** "0.90 %" from basis points. */
export const formatRate = (bps: number): string => (bps === 0 ? "No fee" : `${(bps / 100).toFixed(2)} %`);

export type VaultGate =
  | { allowed: true }
  | { allowed: false; reason: "vault-limit" | "member-limit"; limit: number; suggestPlan: PlanId | null };

const nextPlanFor = (plans: PlanInfo[], current: PlanId, fits: (plan: PlanInfo) => boolean): PlanId | null => {
  const order: PlanId[] = ["FREE", "PLUS", "MAX"];
  for (const id of order.slice(order.indexOf(current) + 1)) {
    const plan = plans.find((candidate) => candidate.id === id);
    if (plan && fits(plan)) return id;
  }
  return null;
};

/**
 * Whether this account may create another Vault with this many members. When
 * the plan is not known (offline, not loaded) the answer is "allowed": a limit
 * the app cannot read is not a reason to stop someone.
 */
export const vaultCreationGate = (input: {
  plans: PlanInfo[] | null;
  plan: PlanId | null;
  vaultsOwned: number | null;
  members: number;
}): VaultGate => {
  const { plans, plan, vaultsOwned, members } = input;
  if (!plans || !plan) return { allowed: true };
  const current = plans.find((candidate) => candidate.id === plan);
  if (!current) return { allowed: true };

  if (vaultsOwned !== null && vaultsOwned >= current.limits.vaults) {
    return { allowed: false, reason: "vault-limit", limit: current.limits.vaults, suggestPlan: nextPlanFor(plans, plan, (p) => p.limits.vaults > vaultsOwned) };
  }
  if (members > current.limits.vaultMembers) {
    return { allowed: false, reason: "member-limit", limit: current.limits.vaultMembers, suggestPlan: nextPlanFor(plans, plan, (p) => p.limits.vaultMembers >= members) };
  }
  return { allowed: true };
};

export const describeVaultGate = (gate: Extract<VaultGate, { allowed: false }>, plans: PlanInfo[]): string => {
  const suggestion = gate.suggestPlan ? plans.find((plan) => plan.id === gate.suggestPlan) : null;
  const upgrade = suggestion ? ` ${suggestion.name} raises it.` : "";
  return gate.reason === "vault-limit"
    ? `Your plan allows ${gate.limit} Vault${gate.limit === 1 ? "" : "s"}.${upgrade}`
    : `Your plan allows up to ${gate.limit} members in a Vault.${upgrade}`;
};

/** One line per thing a plan gives, for the comparison cards. */
export const planHighlights = (plan: PlanInfo): string[] => [
  `${plan.limits.vaults} Vault${plan.limits.vaults === 1 ? "" : "s"}, up to ${plan.limits.vaultMembers} members each`,
  plan.id === "MAX"
    ? "Network fees covered on your sends (fair use)"
    : `Network fees covered on ${plan.sponsoredSendsPerMonth} sends a month, more when you spend by card`,
  `${plan.milesPerUsd} mile${plan.milesPerUsd === 1 ? "" : "s"} per $1 spent by card`,
  `Card currency conversion ${formatRate(plan.feeBps.card_fx)}`,
  `Buying and cashing out crypto ${formatRate(plan.feeBps.ramp)}`,
];

/** How far the card spend of the month is from the next extra covered send. */
export const nextAllowanceStep = (
  plan: PlanInfo | undefined,
  monthlySpendUsdCents: number,
): { toGoUsdCents: number } | null => {
  if (!plan || plan.spendStepUsdCents <= 0) return null;
  const earned = Math.floor(monthlySpendUsdCents / plan.spendStepUsdCents);
  if (earned >= plan.spendBonusCap) return null;
  return { toGoUsdCents: plan.spendStepUsdCents - (monthlySpendUsdCents % plan.spendStepUsdCents) };
};

export const formatUsd = (cents: number): string => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
