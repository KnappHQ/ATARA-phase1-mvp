import { describeFailure, type FailureKind } from "./loadState";
import type { MyEntitlements, PlanId, PlanInfo } from "@/services/subscription.service";

/**
 * What the Plans & Miles screen shows, decided in one place.
 *
 * The screen is never empty: the three offers and the Miles section are fixed
 * content, and the service's answers only add to them. Nothing is purchasable
 * yet, so Plus and Max say "Coming soon" whatever the service sends; the one
 * thing the service can change is which plan is the current one, because the
 * server is the authority on that, and the app never grants itself a plan.
 *
 * No price and no fee rate is shown: none is a promise until the card issuer's
 * contract and the billing are in place. Vaults are not part of any plan.
 */

export type PlansLoad =
  | { status: "loading" }
  | { status: "unavailable"; failure: FailureKind }
  | { status: "ready" };

export interface PlanCardView {
  id: PlanId;
  name: string;
  badge: "Current plan" | "Coming soon";
  /** "Available soon" on the offers that cannot be bought yet; none on the current plan. */
  action: string | null;
  highlights: string[];
  /** True when the highlights are intentions, not things a person has today. */
  planned: boolean;
}

export interface PlansView {
  heading: string;
  /** Shown above the content while loading or when live details could not be had. */
  notice: { kind: "loading" | "unavailable"; text: string; canRetry: boolean } | null;
  plans: PlanCardView[];
  /**
   * Never a made-up number: "Coming soon" until Miles are live, then the server's
   * balance, or "Loading…" / "Unavailable" while it is not known.
   */
  miles: { state: "coming-soon" | "loading" | "unavailable" | "live"; valueLabel: string; status: string; lines: string[] };
  footnote: string;
}

const DEFAULT_NAMES: Record<PlanId, string> = { FREE: "ATARA", PLUS: "ATARA Plus", MAX: "ATARA Max" };
const ORDER: PlanId[] = ["FREE", "PLUS", "MAX"];

const FREE_HIGHLIGHTS = [
  "Your wallet, sending and receiving, contacts and Activity",
  "Paying a merchant by QR code",
  "No ATARA fee on sending money to other people. A small network fee, shown before you confirm, is paid in USDC.",
];

const plannedHighlights = (plan: PlanInfo | undefined, free: PlanInfo | undefined): string[] => {
  if (!plan || !free) return ["Details will appear here when this plan opens."];
  const lines: string[] = [];
  if (free.milesPerUsd > 0 && plan.milesPerUsd > free.milesPerUsd) {
    lines.push(`${Number((plan.milesPerUsd / free.milesPerUsd).toFixed(1))}× ATARA Miles on card spending`);
  }
  if (plan.cardFxBps !== null && free.cardFxBps !== null && plan.cardFxBps < free.cardFxBps) {
    lines.push("Lower card currency-conversion fee");
  }
  return lines.length ? lines : ["Details will appear here when this plan opens."];
};

/**
 * Miles are earned on card spending and the card has not launched, so no balance
 * exists to show yet. Flip this when the card goes live; never infer it from a
 * balance of 0 or from a missing answer.
 */
export const MILES_LIVE = false;

const milesView = (
  milesLive: boolean,
  load: PlansLoad,
  mine: MyEntitlements | null,
): Pick<PlansView["miles"], "state" | "valueLabel"> => {
  if (!milesLive) return { state: "coming-soon", valueLabel: "Coming soon" };
  if (mine) return { state: "live", valueLabel: `Miles balance: ${mine.milesBalance.toLocaleString("en-US")}` };
  if (load.status === "loading") return { state: "loading", valueLabel: "Loading…" };
  return { state: "unavailable", valueLabel: "Unavailable" };
};

export const buildPlansView = (input: {
  load: PlansLoad;
  plans: PlanInfo[] | null;
  mine: MyEntitlements | null;
  milesLive?: boolean;
}): PlansView => {
  const { load, plans, mine, milesLive = MILES_LIVE } = input;
  const byId = (id: PlanId) => plans?.find((plan) => plan.id === id);
  const free = byId("FREE");
  // The server decides. Without its answer, nothing else can be purchased, so Free is the plan.
  const current: PlanId = mine?.plan ?? "FREE";

  const cards: PlanCardView[] = ORDER.map((id) => {
    const isCurrent = id === current;
    return {
      id,
      name: byId(id)?.name ?? DEFAULT_NAMES[id],
      badge: isCurrent ? "Current plan" : "Coming soon",
      action: isCurrent ? null : "Available soon",
      highlights: id === "FREE" ? FREE_HIGHLIGHTS : plannedHighlights(byId(id), free),
      planned: id !== "FREE",
    };
  });

  const notice: PlansView["notice"] =
    load.status === "loading"
      ? { kind: "loading", text: "Loading your plan…", canRetry: false }
      : load.status === "unavailable"
        ? {
            kind: "unavailable",
            text: `Live details are unavailable right now. ${describeFailure(load.failure)} What is planned is shown below.`,
            canRetry: true,
          }
        : null;

  return {
    heading: "ATARA Plans",
    notice,
    plans: cards,
    miles: {
      ...milesView(milesLive, load, mine),
      status: "Card rewards coming soon",
      lines: [
        "ATARA Miles are earned on card spending once the card launches.",
        "Miles are not money: they cannot be sent or cashed out.",
      ],
    },
    footnote: "Plans cannot be bought yet. What a plan includes is decided on ATARA’s servers.",
  };
};
