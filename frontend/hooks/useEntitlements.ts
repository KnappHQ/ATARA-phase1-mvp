import { useCallback, useEffect, useRef, useState } from "react";

import { SubscriptionService, type CardStatusInfo, type MyEntitlements, type PlanInfo } from "@/services/subscription.service";
import { useAuthStore } from "@/stores/useAuthStore";
import { loadEntitlementParts } from "@/utils/entitlementsLoader";
import type { FailureKind, Loaded } from "@/utils/loadState";
import type { CardLoad } from "@/utils/cardScreen";
import type { PlansLoad } from "@/utils/plansScreen";

type Part<T> = { status: "loading" } | Loaded<T>;
const LOADING = { status: "loading" } as const;

const summarize = (parts: Part<unknown>[]): PlansLoad & CardLoad => {
  if (parts.some((part) => part.status === "loading")) return { status: "loading" };
  const failed = parts.find((part): part is { status: "failed"; failure: FailureKind } => part.status === "failed");
  return failed ? { status: "unavailable", failure: failed.failure } : { status: "ready" };
};

/**
 * The offers, this account's offer and miles, and its card status, as the
 * server states them. Each is loaded on its own with a hard deadline, so one
 * slow or missing endpoint (an older service, a 404, a timeout) never holds up
 * the others and nothing stays "loading" for ever. The screens render their own
 * fixed content either way; this only reports how the live part went.
 *
 * Nothing is cached across accounts: results are dropped when the account
 * changes, and a late answer for the previous account is ignored.
 */
export const useEntitlements = () => {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const [plans, setPlans] = useState<Part<{ plans: PlanInfo[]; milesPerSponsoredSend: number | null }>>(LOADING);
  const [mine, setMine] = useState<Part<MyEntitlements>>(LOADING);
  const [card, setCard] = useState<Part<CardStatusInfo>>(LOADING);
  const run = useRef(0);

  const refresh = useCallback(async () => {
    const ticket = ++run.current;
    if (!userId) {
      // Not signed in: there is nothing to load, which is an answer, not a wait.
      const unauthorized = { status: "failed", failure: "unauthorized" } as const;
      setPlans(unauthorized);
      setMine(unauthorized);
      setCard(unauthorized);
      return;
    }
    setPlans(LOADING);
    setMine(LOADING);
    setCard(LOADING);
    const current = () => run.current === ticket;
    await loadEntitlementParts(SubscriptionService, (part) => {
      if (!current()) return;
      if (part.name === "plans") setPlans(part.result);
      else if (part.name === "mine") setMine(part.result);
      else setCard(part.result);
    });
  }, [userId]);

  useEffect(() => {
    void refresh();
    return () => {
      run.current++;
    };
  }, [refresh]);

  return {
    plans: plans.status === "ok" ? plans.data.plans : null,
    mine: mine.status === "ok" ? mine.data : null,
    card: card.status === "ok" ? card.data : null,
    plansLoad: summarize([plans, mine]) as PlansLoad,
    cardLoad: summarize([card]) as CardLoad,
    refresh,
  };
};
