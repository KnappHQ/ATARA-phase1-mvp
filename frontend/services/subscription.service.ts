import { api } from "./api";
import { parseCardStatus, parseMine, parsePlans } from "@/utils/subscriptionParsers";

export type PlanId = "FREE" | "PLUS" | "MAX";

/** Only what the screens use. Prices and fee rates are deliberately not carried: none is a promise yet. */
export interface PlanInfo {
  id: PlanId;
  name: string;
  sponsoredSendsPerMonth: number;
  milesPerUsd: number;
  /** Card currency-conversion rate in basis points, used only to say whether a plan's is lower. */
  cardFxBps: number | null;
}

export interface MyEntitlements {
  plan: PlanId;
  milesBalance: number;
  monthlyCardSpendUsdCents: number;
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
 * Every answer is validated, so a service that is old, down or sends something
 * unexpected is an error the screen handles, never a half-filled screen.
 */
export const SubscriptionService = {
  getPlans: async () => parsePlans((await api.get("/plans")).data),
  getMine: async (): Promise<MyEntitlements> => parseMine((await api.get("/subscription/me")).data),
  getCardStatus: async (): Promise<CardStatusInfo> => parseCardStatus((await api.get("/card/status")).data),
  joinCardWaitlist: async (country?: string): Promise<void> => {
    await api.post("/card/waitlist", country ? { country } : {});
  },
};
