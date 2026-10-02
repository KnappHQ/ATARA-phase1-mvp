import { InvalidResponseError } from "./loadState";
import type { CardStatusInfo, MyEntitlements, PlanId, PlanInfo } from "@/services/subscription.service";

/**
 * The service's answers, checked before anything shows them. A body that is not
 * the expected shape (an HTML error page from a proxy, an older version of the
 * service, a truncated JSON) is an InvalidResponseError, which a screen shows as
 * "unavailable" instead of rendering garbage or nothing.
 */

const PLAN_IDS: readonly PlanId[] = ["FREE", "PLUS", "MAX"];
const CARD_STATES = ["unavailable", "not_applied", "pending", "active", "frozen"] as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

export const parsePlans = (data: unknown): { plans: PlanInfo[]; milesPerSponsoredSend: number | null } => {
  if (!isObject(data) || !Array.isArray(data.plans)) throw new InvalidResponseError("plans");
  const plans: PlanInfo[] = [];
  for (const raw of data.plans) {
    if (!isObject(raw) || !PLAN_IDS.includes(raw.id as PlanId) || typeof raw.name !== "string" || !raw.name) continue;
    const fees = isObject(raw.feeBps) ? raw.feeBps : {};
    plans.push({
      id: raw.id as PlanId,
      name: raw.name.slice(0, 40),
      sponsoredSendsPerMonth: isCount(raw.sponsoredSendsPerMonth) ? raw.sponsoredSendsPerMonth : 0,
      milesPerUsd: isCount(raw.milesPerUsd) ? raw.milesPerUsd : 0,
      cardFxBps: isCount(fees.card_fx) ? fees.card_fx : null,
    });
  }
  if (plans.length === 0) throw new InvalidResponseError("plans");
  return { plans, milesPerSponsoredSend: isCount(data.milesPerSponsoredSend) ? data.milesPerSponsoredSend : null };
};

export const parseMine = (data: unknown): MyEntitlements => {
  if (!isObject(data) || !PLAN_IDS.includes(data.plan as PlanId)) throw new InvalidResponseError("subscription");
  const miles = isObject(data.miles) ? data.miles : null;
  if (!miles || !isCount(miles.balance)) throw new InvalidResponseError("subscription");
  return {
    plan: data.plan as PlanId,
    milesBalance: Math.floor(miles.balance),
    monthlyCardSpendUsdCents: isCount(miles.monthlyCardSpendUsdCents) ? miles.monthlyCardSpendUsdCents : 0,
  };
};

export const parseCardStatus = (data: unknown): CardStatusInfo => {
  if (!isObject(data) || !CARD_STATES.includes(data.state as (typeof CARD_STATES)[number])) {
    throw new InvalidResponseError("card");
  }
  return {
    available: data.available === true,
    state: data.state as CardStatusInfo["state"],
    canAddToWallet: data.canAddToWallet === true,
    last4: typeof data.last4 === "string" && /^\d{4}$/.test(data.last4) ? data.last4 : undefined,
    waitlisted: data.waitlisted === true,
  };
};
