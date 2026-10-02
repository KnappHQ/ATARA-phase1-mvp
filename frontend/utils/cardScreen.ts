import { describeFailure, type FailureKind } from "./loadState";
import type { CardStatusInfo } from "@/services/subscription.service";

/**
 * What the ATARA Card screen shows, decided in one place.
 *
 * Until a card issuer is connected there is no card: the screen says so, plainly,
 * and offers only to be told when it opens. It never shows a card number, an
 * active Visa, or Apple Pay as available unless the service says the card
 * exists and supports it. When the service cannot be reached the answer is the
 * same as "not available yet", never a blank page.
 */

export type CardLoad =
  | { status: "loading" }
  | { status: "unavailable"; failure: FailureKind }
  | { status: "ready" };

export type CardPhase = "coming-soon" | "not-applied" | "pending" | "active" | "frozen";

export interface CardView {
  heading: string;
  phase: CardPhase;
  notice: { kind: "loading" | "unavailable"; text: string; canRetry: boolean } | null;
  card: { title: string; badge: string; body: string; last4?: string };
  applePay: { badge: string; body: string };
  miles: { title: string; body: string };
  /** The one thing a person can do about the card. Null when there is nothing to do. */
  action: { id: "notify" | "joined"; label: string; disabled: boolean } | null;
  qr: { title: string; body: string; action: string };
  fundsNotice: string;
}

/** Said on the card screen before anyone is asked to put money on a card. */
export const CARD_FUNDS_NOTICE =
  "Money on the card is held by the card issuer, not in your ATARA wallet. You choose how much to put on it, you confirm each top-up yourself, and you can take it back. Your wallet’s money stays in your control.";

export const QR_ALTERNATIVE_NOTICE =
  "Prefer crypto, or no card in your country? Paying a merchant by QR code still works and is unchanged.";

const phaseOf = (status: CardStatusInfo | null): CardPhase => {
  if (!status || !status.available || status.state === "unavailable") return "coming-soon";
  switch (status.state) {
    case "not_applied":
      return "not-applied";
    case "pending":
      return "pending";
    case "active":
      return "active";
    case "frozen":
      return "frozen";
    default:
      return "coming-soon";
  }
};

export const buildCardView = (input: { load: CardLoad; status: CardStatusInfo | null }): CardView => {
  const { load, status } = input;
  const phase = phaseOf(status);
  const joined = !!status?.waitlisted;

  const notice: CardView["notice"] =
    load.status === "loading"
      ? { kind: "loading", text: "Checking the card status…", canRetry: false }
      : load.status === "unavailable"
        ? { kind: "unavailable", text: `Live card status is unavailable right now. ${describeFailure(load.failure)}`, canRetry: true }
        : null;

  const card: CardView["card"] =
    phase === "active"
      ? { title: "Virtual Visa card", badge: "Active", body: "Spend your digital assets anywhere Visa is accepted.", ...(status?.last4 ? { last4: status.last4 } : {}) }
      : phase === "frozen"
        ? { title: "Virtual Visa card", badge: "Frozen", body: "Your card is frozen. Contact support to unfreeze it.", ...(status?.last4 ? { last4: status.last4 } : {}) }
        : phase === "pending"
          ? { title: "Virtual Visa card", badge: "Under review", body: "Your card request is being reviewed." }
          : phase === "not-applied"
            ? { title: "Virtual Visa card", badge: "Ready to request", body: "Spend your digital assets anywhere Visa is accepted." }
            : { title: "Virtual Visa card", badge: "Coming soon", body: "Spend your digital assets anywhere Visa is accepted." };

  const walletReady = phase === "active" && !!status?.canAddToWallet;

  return {
    heading: "ATARA Card",
    phase,
    notice,
    card,
    applePay: walletReady
      ? { badge: "Available", body: "Add your card to Apple Wallet to pay with a tap." }
      : { badge: "Coming soon", body: "Apple Pay will be available once the card launches." },
    miles: { title: "ATARA Miles", body: "Earn rewards when the card launches." },
    action:
      phase === "coming-soon"
        ? joined
          ? { id: "joined", label: "You’re on the list", disabled: true }
          : { id: "notify", label: "Notify me", disabled: false }
        : null,
    qr: { title: "Payment QR", body: QR_ALTERNATIVE_NOTICE, action: "Pay a merchant" },
    fundsNotice: CARD_FUNDS_NOTICE,
  };
};
