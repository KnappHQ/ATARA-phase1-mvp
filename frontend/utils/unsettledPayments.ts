/**
 * What the account screens say when the account being switched away from,
 * removed, or deleted has a payment that is not settled.
 *
 * None of those actions touches the payment: its record stays on this phone,
 * under the wallet's address, whatever happens to the entry in the list of
 * accounts. What the person needs to know is that it is still out there, that
 * it may still go through, and that sending it again from anywhere could pay it
 * twice.
 */

import { formatPendingPayment, type PendingPayment } from "./pendingOperation";
import { paymentOf, type OperationRecord } from "./operationRecord";
import type { OutboxEntry } from "./operationOutbox";

export interface UnsettledAccount {
  account: string;
  pending: OperationRecord | null;
  recordings: OutboxEntry[];
}

export type UnsettledSummary = { pending: string | null; recordings: number };

type Assets = Parameters<typeof formatPendingPayment>[1];

export const summarize = (item: UnsettledAccount | undefined, assets: Assets): UnsettledSummary | null => {
  if (!item || (!item.pending && item.recordings.length === 0)) return null;
  const payment: PendingPayment | null = item.pending ? paymentOf(item.pending) : null;
  return {
    pending: item.pending ? (payment ? formatPendingPayment(payment, assets) : "a payment") : null,
    recordings: item.recordings.length,
  };
};

/** One line for the list of accounts. */
export const badgeFor = (summary: UnsettledSummary): string =>
  summary.pending
    ? "A payment is waiting to be verified"
    : `${summary.recordings === 1 ? "A payment" : `${summary.recordings} payments`} made, not yet in history`;

export type UnsettledAction = "switch" | "remove" | "delete";

export const warningFor = (action: UnsettledAction, summary: UnsettledSummary): string[] => {
  const lines: string[] = [];
  if (summary.pending) {
    const what = summary.pending.charAt(0).toUpperCase() + summary.pending.slice(1);
    lines.push(
      `${what} has not been verified yet, so it may still go through. It is kept on this iPhone under this wallet${
        action === "delete" ? ", and deleting the ATARA profile does not remove it" : ""
      }.`,
    );
    lines.push(
      action === "delete"
        ? "Check it in Activity before you delete, and do not send it again from another account."
        : "Sign back in to this account to check it in Activity, and do not send the same payment from another account.",
    );
  }
  if (summary.recordings > 0) {
    lines.push(
      action === "delete"
        ? "A payment that went through has not been recorded in your history yet. Once the profile is deleted it can no longer be recorded; the payment itself is unaffected."
        : "A payment that went through has not been recorded in your history yet. It will be recorded the next time you are signed in to this account.",
    );
  }
  return lines;
};
