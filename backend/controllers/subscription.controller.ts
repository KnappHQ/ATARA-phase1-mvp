import { Request, Response } from "express";
import prisma from "../config/prisma";
import { catchAsync } from "../utils/catchAsync";
import { resolveEntitlement } from "../utils/entitlements";
import { getPlans } from "../utils/plans";
import { MILES_PER_SPONSORED_SEND } from "../utils/plans";
import { sponsorshipAllowance } from "../utils/miles";
import { rewardsService } from "../services/rewards.service";
import { getCardProvider } from "../services/card/provider";
import { ErrorHandler } from "../utils/errorHandler";

const monthStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

/** The offers, as the app shows them. Read-only: nothing here can change anyone's offer. */
const publicPlans = () =>
  Object.values(getPlans()).map((plan) => ({
    id: plan.id,
    name: plan.name,
    priceEurCents: plan.priceEurCents,
    limits: plan.limits,
    sponsoredSendsPerMonth: plan.sponsorship.monthlySends,
    spendStepUsdCents: plan.sponsorship.spendStepUsdCents,
    spendBonusCap: plan.sponsorship.spendBonusCap,
    milesPerUsd: plan.milesPerUsd,
    feeBps: plan.feeBps,
  }));

export const subscriptionController = {
  plans: catchAsync(async (_req: Request, res: Response) => {
    res.status(200).json({ success: true, plans: publicPlans(), milesPerSponsoredSend: MILES_PER_SPONSORED_SEND });
  }),

  /** What this account is entitled to, and where its miles and allowance stand. */
  me: catchAsync(async (req: Request, res: Response) => {
    const now = new Date();
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { subscriptionTier: true, subscriptionStatus: true, subscriptionExpiresAt: true },
    });
    if (!user) throw new ErrorHandler("User not found", 404);

    const entitlement = resolveEntitlement(user, now);
    const [balance, monthlySpend, sentThisMonth] = await Promise.all([
      rewardsService.balance(req.user.id),
      rewardsService.monthlySpendUsdCents(req.user.id, now),
      // Sends ATARA recorded this month: what the allowance is measured against.
      prisma.transaction.count({ where: { senderId: req.user.id, createdAt: { gte: monthStart(now) } } }),
    ]);

    res.status(200).json({
      success: true,
      plan: entitlement.plan,
      reason: entitlement.reason,
      expiresAt: user.subscriptionExpiresAt,
      miles: {
        balance,
        monthlyCardSpendUsdCents: monthlySpend,
        sponsoredAllowance: sponsorshipAllowance(entitlement.plan, monthlySpend),
        sendsThisMonth: sentThisMonth,
      },
    });
  }),

  cardStatus: catchAsync(async (req: Request, res: Response) => {
    const provider = getCardProvider();
    const status = await provider.status(req.user.id);
    const waitlisted = !!(await prisma.cardWaitlist.findUnique({ where: { userId: req.user.id }, select: { userId: true } }));
    res.status(200).json({ success: true, available: provider.configured(), ...status, waitlisted });
  }),

  joinWaitlist: catchAsync(async (req: Request, res: Response) => {
    const raw = req.body?.country;
    // An ISO 3166-1 alpha-2 country code, or nothing. Never free text.
    const country = typeof raw === "string" && /^[A-Za-z]{2}$/.test(raw) ? raw.toUpperCase() : null;
    await prisma.cardWaitlist.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, country },
      update: { country },
    });
    res.status(200).json({ success: true, waitlisted: true });
  }),
};
