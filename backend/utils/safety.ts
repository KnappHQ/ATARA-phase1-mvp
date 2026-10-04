import { ErrorHandler } from "./errorHandler";
import { escapeHtml } from "./emailTemplates";

/** Where safety reports are sent, and the public contact address shown in the app. */
export const SUPPORT_EMAIL = "support@atara.finance";

export const REPORT_REASONS = ["SPAM", "SCAM", "HARASSMENT", "INAPPROPRIATE", "IMPERSONATION", "OTHER"] as const;
export type ReportReasonValue = (typeof REPORT_REASONS)[number];

/** Where in the app the person saw the thing they report. */
export const REPORT_CONTEXTS = ["contact", "group", "expense", "payment_note"] as const;
export type ReportContext = (typeof REPORT_CONTEXTS)[number];

export const MAX_REPORT_DETAILS = 500;

export interface ParsedReport {
  handle: string;
  reason: ReportReasonValue;
  details: string;
  context: ReportContext | null;
  contextId: string | null;
  alsoBlock: boolean;
}

/** A handle as people type it: with or without "@", any case. Null when it cannot be one. */
export const normalizeTargetHandle = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const handle = value.trim().replace(/^@/, "").toLowerCase();
  return /^[a-z0-9_]{1,32}$/.test(handle) ? handle : null;
};

/** Validates a report from the app. Every refusal is a plain 400 the app can show. */
export const parseReport = (body: unknown): ParsedReport => {
  const input = (body ?? {}) as Record<string, unknown>;
  const handle = normalizeTargetHandle(input.handle);
  if (!handle) throw new ErrorHandler("Choose who you are reporting", 400);

  const reason = typeof input.reason === "string" ? input.reason.toUpperCase() : "";
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) {
    throw new ErrorHandler("Choose a reason for the report", 400);
  }

  const rawDetails = input.details === undefined || input.details === null ? "" : input.details;
  if (typeof rawDetails !== "string") throw new ErrorHandler("The details must be text", 400);
  const details = rawDetails.trim();
  if (details.length > MAX_REPORT_DETAILS) {
    throw new ErrorHandler(`Details must be ${MAX_REPORT_DETAILS} characters or fewer`, 400);
  }

  let context: ReportContext | null = null;
  let contextId: string | null = null;
  if (input.context !== undefined && input.context !== null) {
    if (typeof input.context !== "string" || !(REPORT_CONTEXTS as readonly string[]).includes(input.context)) {
      throw new ErrorHandler("That item cannot be reported", 400);
    }
    context = input.context as ReportContext;
    if (context !== "contact") {
      if (typeof input.contextId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(input.contextId)) {
        throw new ErrorHandler("That item cannot be reported", 400);
      }
      contextId = input.contextId;
    }
  }

  return { handle, reason: reason as ReportReasonValue, details, context, contextId, alsoBlock: input.alsoBlock === true };
};

export const reportEmailSubject = (reason: string, reportedHandle: string): string =>
  `[ATARA report] ${reason} - @${reportedHandle}`;

export const reportEmailText = (report: {
  id: string;
  reason: string;
  reporterHandle: string | null;
  reportedHandle: string;
  details: string;
  context: string | null;
  contextId: string | null;
  createdAt: Date;
}): string =>
  [
    "ATARA - New user report (to be handled within 24 hours)",
    "",
    `Report   : ${report.id}`,
    `Reason   : ${report.reason}`,
    `Reported : @${report.reportedHandle}`,
    `Reporter : ${report.reporterHandle ? `@${report.reporterHandle}` : "unknown"}`,
    `Where    : ${report.context ?? "unknown"}${report.contextId ? ` (${report.contextId})` : ""}`,
    `Date     : ${report.createdAt.toUTCString()}`,
    "",
    report.details || "(no details)",
  ].join("\n");

/** Every value a person typed goes through escapeHtml before it reaches markup. */
export const reportEmailHtml = (report: Parameters<typeof reportEmailText>[0]): string =>
  `<pre style="font-family:ui-monospace,Menlo,monospace;font-size:13px;white-space:pre-wrap">${escapeHtml(reportEmailText(report))}</pre>`;
