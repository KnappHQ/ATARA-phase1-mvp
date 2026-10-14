/**
 * Report and block: the choices, and the rules the sheet applies before anything
 * is sent. Kept apart from the screen so they can be tested.
 */
import { SUPPORT_EMAIL } from "@/utils/site";

export type ReportReason = "SPAM" | "SCAM" | "HARASSMENT" | "INAPPROPRIATE" | "IMPERSONATION" | "OTHER";

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "SPAM", label: "Spam" },
  { value: "SCAM", label: "Scam or fraud" },
  { value: "HARASSMENT", label: "Harassment or unwanted contact" },
  { value: "INAPPROPRIATE", label: "Inappropriate name, photo or message" },
  { value: "IMPERSONATION", label: "Pretending to be someone else" },
  { value: "OTHER", label: "Something else" },
];

export const MAX_REPORT_DETAILS = 500;

/** Where in the app the person is when they report: it tells the team what to look at. */
export type SafetyContext =
  | { kind: "contact" }
  | { kind: "group"; id: string }
  | { kind: "expense"; id: string }
  | { kind: "payment_note"; id: string };

export interface ReportDraft {
  reason: ReportReason | null;
  details: string;
  alsoBlock: boolean;
}

/** Blocking too is the default: someone who reports a person usually wants no more contact. */
export const emptyReport = (): ReportDraft => ({ reason: null, details: "", alsoBlock: true });

/** What stops a report from being sent, in plain words; null when it can go. */
export const reportProblem = (draft: ReportDraft): string | null => {
  if (!draft.reason) return "Choose a reason.";
  if (draft.details.trim().length > MAX_REPORT_DETAILS) return `Keep it under ${MAX_REPORT_DETAILS} characters.`;
  return null;
};

/** The request body of POST /safety/reports. */
export const reportPayload = (handle: string, draft: ReportDraft, context: SafetyContext) => ({
  handle: handle.replace(/^@/, ""),
  reason: draft.reason,
  details: draft.details.trim(),
  alsoBlock: draft.alsoBlock,
  context: context.kind,
  ...(context.kind === "contact" ? {} : { contextId: context.id }),
});

export const reportThanks = (blocked: boolean): string =>
  `Thank you. We review reports within 24 hours.${blocked ? " They can no longer find you or add you to groups in ATARA." : ""} You can also write to ${SUPPORT_EMAIL}.`;

export const blockConfirmText = (handle: string): string =>
  `Block @${handle.replace(/^@/, "")}? They will not be able to find you, add you to groups or split expenses with you, and you will no longer see their notes. Payments already made stay in your history.`;

/** A refusal from the service, or no connection, in words a person can act on. */
export const safetyFailureText = (error: unknown): string => {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  const code = (error as { code?: string } | null)?.code;
  if (status === 404) return `This is not available yet. Write to ${SUPPORT_EMAIL} and we will deal with it.`;
  if (status === 429) return "Too many reports in a short time. Try again in a minute.";
  if (status === 400) return "That could not be reported. Check the details and try again.";
  if (code === "ERR_NETWORK" || code === "ECONNABORTED" || !status) return "No connection. Check your internet and try again.";
  return `Something went wrong. Try again, or write to ${SUPPORT_EMAIL}.`;
};
