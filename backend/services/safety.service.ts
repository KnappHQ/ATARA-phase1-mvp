import { timingSafeEqual } from "node:crypto";
import { Resend } from "resend";
import prisma from "../config/prisma";
import { ErrorHandler } from "../utils/errorHandler";
import { RESEND_API_KEY, FEEDBACK_FROM_EMAIL } from "../utils/constants";
import { logInfo } from "../utils/logger";
import {
  SUPPORT_EMAIL,
  normalizeTargetHandle,
  parseReport,
  reportEmailHtml,
  reportEmailSubject,
  reportEmailText,
} from "../utils/safety";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

/**
 * Report and block.
 *
 * A block works both ways: neither person can find, add, invite or split an
 * expense with the other. Nothing here ever tells someone they were blocked:
 * every refusal reads as "not found".
 */
class SafetyService {
  private async findTarget(handle: unknown, requesterId: string) {
    const normalized = normalizeTargetHandle(handle);
    if (!normalized) throw new ErrorHandler("User not found", 404);
    const user = await prisma.user.findUnique({
      where: { handle: normalized },
      select: { id: true, handle: true, displayName: true, deletedAt: true },
    });
    if (!user || user.deletedAt) throw new ErrorHandler("User not found", 404);
    if (user.id === requesterId) throw new ErrorHandler("You cannot do that to yourself", 400);
    return user;
  }

  /** Everyone who has blocked this person, or whom this person has blocked. */
  public async blockedBothWays(userId: string): Promise<Set<string>> {
    const rows = await prisma.userBlock.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    return new Set(rows.map((row) => (row.blockerId === userId ? row.blockedId : row.blockerId)));
  }

  public async isBlockedEitherWay(a: string, b: string): Promise<boolean> {
    const found = await prisma.userBlock.findFirst({
      where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
      select: { blockerId: true },
    });
    return !!found;
  }

  public async block(blockerId: string, handle: unknown) {
    const target = await this.findTarget(handle, blockerId);
    await prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId: target.id } },
      create: { blockerId, blockedId: target.id },
      update: {},
    });
    // Invitations between the two end with the block: a blocked person cannot
    // keep a pending place in a group the other one runs, or the other way round.
    await prisma.groupMember.deleteMany({
      where: {
        status: "INVITED",
        OR: [
          { userId: blockerId, invitedById: target.id },
          { userId: target.id, invitedById: blockerId },
        ],
      },
    });
    return { handle: target.handle };
  }

  public async unblock(blockerId: string, handle: unknown) {
    const normalized = normalizeTargetHandle(handle);
    if (!normalized) throw new ErrorHandler("User not found", 404);
    const user = await prisma.user.findUnique({ where: { handle: normalized }, select: { id: true } });
    if (user) {
      await prisma.userBlock.deleteMany({ where: { blockerId, blockedId: user.id } });
    }
    return { handle: normalized };
  }

  public async listBlocks(blockerId: string) {
    const rows = await prisma.userBlock.findMany({
      where: { blockerId, blocked: { deletedAt: null } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, blocked: { select: { handle: true, displayName: true } } },
    });
    return rows.map((row) => ({ handle: row.blocked.handle, displayName: row.blocked.displayName, blockedAt: row.createdAt }));
  }

  /**
   * An item can only be reported by someone who could see it, and it must involve
   * the reported person: otherwise a report could point at a stranger's content.
   */
  private async assertContext(
    context: string | null,
    contextId: string | null,
    reporterId: string,
    reportedId: string,
  ) {
    if (!context || context === "contact") return;
    const refuse = () => new ErrorHandler("That item cannot be reported", 400);
    const both = [reporterId, reportedId];
    if (context === "group") {
      const members = await prisma.groupMember.count({ where: { groupId: contextId!, userId: { in: both } } });
      if (members !== 2) throw refuse();
    } else if (context === "expense") {
      const expense = await prisma.groupExpense.findUnique({
        where: { id: contextId! },
        select: { groupId: true },
      });
      if (!expense) throw refuse();
      const members = await prisma.groupMember.count({ where: { groupId: expense.groupId, userId: { in: both } } });
      if (members !== 2) throw refuse();
    } else if (context === "payment_note") {
      const tx = await prisma.transaction.findUnique({
        where: { id: contextId! },
        select: { senderId: true, receiverId: true },
      });
      const parties = tx ? [tx.senderId, tx.receiverId] : [];
      if (!tx || !both.every((id) => parties.includes(id))) throw refuse();
    }
  }

  public async report(reporter: { id: string; handle?: string | null }, body: unknown) {
    const input = parseReport(body);
    const target = await this.findTarget(input.handle, reporter.id);
    await this.assertContext(input.context, input.contextId, reporter.id, target.id);

    const report = await prisma.userReport.create({
      data: {
        reporterId: reporter.id,
        reportedId: target.id,
        reportedHandle: target.handle,
        reason: input.reason,
        details: input.details,
        context: input.context,
        contextId: input.contextId,
      },
    });

    // The report is stored before anything else, so a failing mailer loses nothing.
    logInfo("user-report-created", { reportId: report.id, reason: report.reason, context: report.context ?? "none" });
    void this.notify(report, reporter.handle ?? null);

    if (input.alsoBlock) await this.block(reporter.id, target.handle);
    return { id: report.id };
  }

  private async notify(
    report: { id: string; reason: string; reportedHandle: string; details: string; context: string | null; contextId: string | null; createdAt: Date },
    reporterHandle: string | null,
  ) {
    try {
      if (!resend) {
        logInfo("user-report-email-skipped", { reportId: report.id, why: "mailer not configured" });
        return;
      }
      const email = { ...report, reporterHandle };
      const { error } = await resend.emails.send({
        from: `ATARA <${FEEDBACK_FROM_EMAIL}>`,
        to: [process.env.SAFETY_RECIPIENT_EMAIL || SUPPORT_EMAIL],
        subject: reportEmailSubject(report.reason, report.reportedHandle),
        text: reportEmailText(email),
        html: reportEmailHtml(email),
      });
      if (error) throw new Error(error.message);
    } catch (error: any) {
      // Never throws into the request: the report is already stored.
      logInfo("user-report-email-failed", { reportId: report.id, message: String(error?.message ?? "unknown").slice(0, 200) });
    }
  }

  /** The admin token from the environment, compared without leaking its length or content by timing. */
  public isAdminToken(candidate: unknown): boolean {
    const expected = process.env.SAFETY_ADMIN_TOKEN;
    if (!expected || expected.length < 24 || typeof candidate !== "string") return false;
    const a = Buffer.from(candidate);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  public async listReports(status: "OPEN" | "REVIEWED" | "ACTIONED" | "ALL" = "OPEN", limit = 50) {
    return prisma.userReport.findMany({
      where: status === "ALL" ? {} : { status },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200),
      select: {
        id: true,
        reason: true,
        status: true,
        details: true,
        context: true,
        contextId: true,
        reportedHandle: true,
        createdAt: true,
        reviewedAt: true,
        reporter: { select: { handle: true } },
      },
    });
  }

  public async setReportStatus(id: string, status: unknown) {
    if (status !== "REVIEWED" && status !== "ACTIONED" && status !== "OPEN") throw new ErrorHandler("Unknown status", 400);
    const existing = await prisma.userReport.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new ErrorHandler("Report not found", 404);
    return prisma.userReport.update({
      where: { id },
      data: { status, reviewedAt: status === "OPEN" ? null : new Date() },
      select: { id: true, status: true, reviewedAt: true },
    });
  }
}

export const safetyService = new SafetyService();
