import prisma from "../../config/prisma";
import { resolveEntitlement } from "../../utils/entitlements";
import { rewardsService } from "../rewards.service";
import type { CardProvider } from "./provider";

/**
 * Handles one verified card event: miles for a purchase, taken back for a
 * refund, and a note that the event was handled so a retry does nothing.
 *
 * Order matters and is what makes a crash safe: the miles entry is written
 * first (its unique key makes a second write a no-op), and only then is the
 * event marked handled. A crash in between means the retry finds the miles
 * already there and finishes the job.
 */

export type CardEventOutcome = "credited" | "reversed" | "ignored" | "duplicate" | "unknown-user";

export const handleCardEvent = async (provider: CardProvider, body: unknown): Promise<CardEventOutcome> => {
  const event = provider.parseEvent(body);
  if (!event) return "ignored";

  const handled = await prisma.cardEvent.findUnique({
    where: { provider_eventId: { provider: provider.name, eventId: event.eventId } },
  });
  if (handled) return "duplicate";

  let outcome: CardEventOutcome = "ignored";
  let userId: string | null = null;

  if (event.type === "purchase" || event.type === "refund") {
    const user = await prisma.user.findUnique({
      where: { id: event.userRef },
      select: { id: true, deletedAt: true, subscriptionTier: true, subscriptionStatus: true, subscriptionExpiresAt: true },
    });
    if (!user || user.deletedAt) {
      outcome = "unknown-user";
    } else {
      userId = user.id;
      if (event.type === "purchase") {
        const { plan } = resolveEntitlement(user);
        await rewardsService.creditSpend({ userId: user.id, sourceId: event.purchaseId, spendUsdCents: event.amountUsdCents, plan });
        outcome = "credited";
      } else {
        await rewardsService.reverseSpend({ userId: user.id, sourceId: event.purchaseId });
        outcome = "reversed";
      }
    }
  }

  try {
    await prisma.cardEvent.create({
      data: { provider: provider.name, eventId: event.eventId, type: event.type, userId },
    });
  } catch (error) {
    // A concurrent delivery of the same event got there first: same result.
    if ((error as { code?: string })?.code === "P2002") return "duplicate";
    throw error;
  }
  return outcome;
};
