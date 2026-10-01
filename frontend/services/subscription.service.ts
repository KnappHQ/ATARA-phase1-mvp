import { api } from "./api";

export type PlanId = "FREE" | "PLUS" | "MAX";

export interface PlanInfo {
  id: PlanId;
  name: string;
  priceEurCents: number;
  limits: { vaults: number; vaultMembers: number };
  sponsoredSendsPerMonth: number;
  spendStepUsdCents: number;
  spendBonusCap: number;
  milesPerUsd: number;
  /** Basis points: 100 = 1 %. */
  feeBps: { transfer: number; ramp: number; card_fx: number; swap: number };
}

export interface MyEntitlements {
  plan: PlanId;
  reason: string;
  expiresAt: string | null;
  miles: {
    balance: number;
    monthlyCardSpendUsdCents: number;
    sponsoredAllowance: number;
    sendsThisMonth: number;
  };
}

export interface CardStatusInfo {
  /** The issuer integration is live for this environment. */
  available: boolean;
  state: "unavailable" | "not_applied" | "pending" | "active" | "frozen";
  canAddToWallet: boolean;
  last4?: string;
  waitlisted: boolean;
}

/**
 * Read-only: the app is told what the server decided, and can change none of it.
 * An offer only changes when the server receives a verified billing event.
 */
export const SubscriptionService = {
  getPlans: async (): Promise<{ plans: PlanInfo[]; milesPerSponsoredSend: number }> => {
    const response = await api.get("/plans");
    return { plans: response.data.plans, milesPerSponsoredSend: response.data.milesPerSponsoredSend };
  },
  getMine: async (): Promise<MyEntitlements> => {
    const { data } = await api.get("/subscription/me");
    return { plan: data.plan, reason: data.reason, expiresAt: data.expiresAt ?? null, miles: data.miles };
  },
  getCardStatus: async (): Promise<CardStatusInfo> => {
    const { data } = await api.get("/card/status");
    return { available: !!data.available, state: data.state, canAddToWallet: !!data.canAddToWallet, last4: data.last4, waitlisted: !!data.waitlisted };
  },
  joinCardWaitlist: async (country?: string): Promise<void> => {
    await api.post("/card/waitlist", country ? { country } : {});
  },
};
