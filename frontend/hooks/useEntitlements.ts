import { useCallback, useEffect, useRef, useState } from "react";

import { SubscriptionService, type CardStatusInfo, type MyEntitlements, type PlanInfo } from "@/services/subscription.service";
import { useAuthStore } from "@/stores/useAuthStore";

/**
 * The offers, this account's offer, its miles and its card status, as the
 * server states them. Nothing is cached across accounts: the account's id is
 * part of what a result belongs to, so switching accounts never shows one
 * person's miles to another.
 */
export const useEntitlements = () => {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const [plans, setPlans] = useState<PlanInfo[] | null>(null);
  const [milesPerSend, setMilesPerSend] = useState<number | null>(null);
  const [mine, setMine] = useState<MyEntitlements | null>(null);
  const [card, setCard] = useState<CardStatusInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const owner = useRef<string | null>(userId);
  owner.current = userId;

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setFailed(false);
    const [offers, own, cardStatus] = await Promise.allSettled([
      SubscriptionService.getPlans(),
      SubscriptionService.getMine(),
      SubscriptionService.getCardStatus(),
    ]);
    // The account may have changed while this was running.
    if (owner.current !== userId) return;
    if (offers.status === "fulfilled") {
      setPlans(offers.value.plans);
      setMilesPerSend(offers.value.milesPerSponsoredSend);
    }
    if (own.status === "fulfilled") setMine(own.value);
    if (cardStatus.status === "fulfilled") setCard(cardStatus.value);
    setFailed([offers, own, cardStatus].some((result) => result.status === "rejected"));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setPlans(null);
    setMine(null);
    setCard(null);
    setFailed(false);
    void refresh();
  }, [userId, refresh]);

  return { plans, milesPerSend, mine, card, loading, failed, refresh };
};
