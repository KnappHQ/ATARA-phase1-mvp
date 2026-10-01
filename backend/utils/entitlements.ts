import type { PlanId } from "./plans";

/**
 * Which offer an account is entitled to right now, decided from what the server
 * itself stored. Nothing here reads anything the app sent: an entitlement can
 * only change when a verified provider event updates these fields.
 *
 * Only an ACTIVE or GRACE_PERIOD subscription that has not expired gives its
 * offer. Everything else (inactive, paused, canceled, expired, an unknown value,
 * a missing expiry on a paid offer that has one on record) falls back to Free,
 * which is always safe: it can only take away convenience, never money.
 */

export interface StoredSubscription {
  subscriptionTier?: string | null;
  subscriptionStatus?: string | null;
  subscriptionExpiresAt?: Date | string | null;
}

export interface Entitlement {
  plan: PlanId;
  /** Why this plan: shown in support tools, never trusted from a client. */
  reason: "free" | "active" | "grace" | "expired" | "inactive" | "unknown-tier";
}

const PAID_STATES = new Set(["ACTIVE", "GRACE_PERIOD"]);

/** PREMIUM is the first-generation name of the paid offer; it is read as PLUS. */
const planOfTier = (tier: string | null | undefined): PlanId | null => {
  if (tier === "PLUS" || tier === "PREMIUM") return "PLUS";
  if (tier === "MAX") return "MAX";
  if (tier === "FREE" || tier === undefined || tier === null) return "FREE";
  return null;
};

export const resolveEntitlement = (sub: StoredSubscription, now: Date = new Date()): Entitlement => {
  const plan = planOfTier(sub.subscriptionTier);
  if (plan === null) return { plan: "FREE", reason: "unknown-tier" };
  if (plan === "FREE") return { plan: "FREE", reason: "free" };

  if (!PAID_STATES.has(String(sub.subscriptionStatus))) return { plan: "FREE", reason: "inactive" };

  if (sub.subscriptionExpiresAt) {
    const expiresAt = new Date(sub.subscriptionExpiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
      return { plan: "FREE", reason: "expired" };
    }
  }
  return { plan, reason: sub.subscriptionStatus === "GRACE_PERIOD" ? "grace" : "active" };
};
