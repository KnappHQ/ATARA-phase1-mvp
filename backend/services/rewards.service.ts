import prisma from "../config/prisma";
import { ErrorHandler } from "../utils/errorHandler";
import { milesForSpend } from "../utils/miles";
import type { PlanId } from "../utils/plans";

/**
 * The ATARA Miles ledger.
 *
 * Every change is a new, signed entry; the balance is their sum and is never a
 * number something can overwrite. (source, sourceId, kind) is unique in the
 * database, so a card event delivered twice credits once: the second insert is
 * refused by the database itself, not by a check that could race.
 *
 * Miles are not money: they cannot be transferred and are not paid out.
 */

type Db = typeof prisma;

const isUniqueViolation = (error: unknown) => (error as { code?: string })?.code === "P2002";

const monthBounds = (now: Date) => {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
};

export const rewardsService = {
  /** Sum of the user's entries. Never below zero. */
  async balance(userId: string, db: Db = prisma): Promise<number> {
    const total = await db.milesEntry.aggregate({ where: { userId }, _sum: { miles: true } });
    return Math.max(0, total._sum.miles ?? 0);
  },

  /** Card spend this calendar month (UTC), net of refunds, in USD cents. */
  async monthlySpendUsdCents(userId: string, now: Date = new Date(), db: Db = prisma): Promise<number> {
    const { start, end } = monthBounds(now);
    const total = await db.milesEntry.aggregate({
      where: { userId, source: "card", createdAt: { gte: start, lt: end } },
      _sum: { spendUsdCents: true },
    });
    return Math.max(0, total._sum.spendUsdCents ?? 0);
  },

  /** Credits the miles for one card purchase. Safe to call again with the same sourceId. */
  async creditSpend(
    input: { userId: string; sourceId: string; spendUsdCents: number; plan: PlanId },
    db: Db = prisma,
  ): Promise<{ credited: boolean; miles: number }> {
    const miles = milesForSpend(input.spendUsdCents, input.plan);
    try {
      await db.milesEntry.create({
        data: {
          userId: input.userId,
          kind: "EARN",
          miles,
          spendUsdCents: input.spendUsdCents,
          source: "card",
          sourceId: input.sourceId,
        },
      });
      return { credited: true, miles };
    } catch (error) {
      if (isUniqueViolation(error)) return { credited: false, miles: 0 };
      throw error;
    }
  },

  /**
   * A refund or cancelled purchase takes back what it earned, as far as the
   * balance allows: miles already spent are not clawed back into a debt.
   * Idempotent per purchase.
   */
  async reverseSpend(
    input: { userId: string; sourceId: string },
    db: Db = prisma,
  ): Promise<{ reversed: boolean; miles: number }> {
    return db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.userId}))`;
      const earned = await tx.milesEntry.findUnique({
        where: { source_sourceId_kind: { source: "card", sourceId: input.sourceId, kind: "EARN" } },
      });
      if (!earned || earned.userId !== input.userId) return { reversed: false, miles: 0 };
      const balance = Math.max(0, (await tx.milesEntry.aggregate({ where: { userId: input.userId }, _sum: { miles: true } }))._sum.miles ?? 0);
      const take = Math.min(earned.miles, balance);
      try {
        await tx.milesEntry.create({
          data: {
            userId: input.userId,
            kind: "REVERSAL",
            miles: -take,
            spendUsdCents: earned.spendUsdCents === null ? null : -earned.spendUsdCents,
            source: "card",
            sourceId: input.sourceId,
          },
        });
        return { reversed: true, miles: take };
      } catch (error) {
        if (isUniqueViolation(error)) return { reversed: false, miles: 0 };
        throw error;
      }
    });
  },

  /**
   * Spends miles. Refused, with nothing written, when the balance is short.
   * Serialised per user so two requests at once cannot both spend the same miles.
   * Idempotent per sourceId (the thing the miles pay for).
   */
  async redeem(
    input: { userId: string; sourceId: string; miles: number },
    db: Db = prisma,
  ): Promise<{ redeemed: boolean; balance: number }> {
    if (!Number.isInteger(input.miles) || input.miles <= 0) throw new ErrorHandler("Invalid miles amount", 400);
    return db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.userId}))`;
      const existing = await tx.milesEntry.findUnique({
        where: { source_sourceId_kind: { source: "sponsorship", sourceId: input.sourceId, kind: "REDEEM" } },
      });
      const balance = Math.max(0, (await tx.milesEntry.aggregate({ where: { userId: input.userId }, _sum: { miles: true } }))._sum.miles ?? 0);
      if (existing) return { redeemed: false, balance };
      if (balance < input.miles) throw new ErrorHandler("Not enough miles", 409);
      await tx.milesEntry.create({
        data: { userId: input.userId, kind: "REDEEM", miles: -input.miles, source: "sponsorship", sourceId: input.sourceId },
      });
      return { redeemed: true, balance: balance - input.miles };
    });
  },
};
