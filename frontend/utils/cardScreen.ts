import type { CardStatusInfo } from "@/services/subscription.service";

/**
 * What the Card screen offers, from the card's state alone. One function so the
 * screen cannot show a button for something that does not exist: while no card
 * issuer is connected, the only thing a person can do is ask to be told.
 */

export type CardScreen =
  | { kind: "coming-soon"; joined: boolean }
  | { kind: "not-applied" }
  | { kind: "pending" }
  | { kind: "active"; last4?: string; canAddToWallet: boolean }
  | { kind: "frozen"; last4?: string };

export const cardScreenFor = (status: CardStatusInfo | null): CardScreen => {
  if (!status || !status.available || status.state === "unavailable") {
    return { kind: "coming-soon", joined: !!status?.waitlisted };
  }
  switch (status.state) {
    case "not_applied":
      return { kind: "not-applied" };
    case "pending":
      return { kind: "pending" };
    case "active":
      return { kind: "active", last4: status.last4, canAddToWallet: status.canAddToWallet };
    case "frozen":
      return { kind: "frozen", last4: status.last4 };
    default:
      return { kind: "coming-soon", joined: !!status.waitlisted };
  }
};

/** Said on the card screen before anyone is asked to put money on a card. */
export const CARD_FUNDS_NOTICE =
  "Money on the card is held by the card issuer, not in your ATARA wallet. You choose how much to put on it, you confirm each top-up yourself, and you can take it back. Your wallet's money stays in your control.";

export const QR_ALTERNATIVE_NOTICE =
  "Prefer crypto, or no card in your country? Paying a merchant by QR code still works and is unchanged.";
