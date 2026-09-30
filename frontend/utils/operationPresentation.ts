/**
 * What the Activity screen says about a payment that is not settled.
 *
 * Every sentence here is fixed text, chosen by the state and nothing else. The
 * important line it draws is between "we could not find out" and "it did not
 * happen": only a failed report says the second, and every other state says
 * that the payment may still have gone through and must not be sent again.
 */

import { describeEvidence, type Evidence } from "./operationStatus";
import { shortHash } from "./callId";
import { formatPendingPayment, type PendingPayment } from "./pendingOperation";
import { paymentOf } from "./operationRecord";
import type { OperationReport } from "../services/paymentOperations";
import type { OperationRecord } from "./operationRecord";
import type { OutboxEntry } from "./operationOutbox";

export type CardTone = "waiting" | "good" | "bad" | "neutral";

export interface CardAction {
  id: "check" | "release" | "retry-recording" | "dismiss" | "retry-check";
  label: string;
  destructive?: boolean;
}

export interface CardDetail {
  label: string;
  value: string;
}

export interface OperationCard {
  key: string;
  tone: CardTone;
  title: string;
  body: string;
  /** "10 USDC to 0x5999…204c", when it is known. */
  payment?: string;
  when?: string;
  details: CardDetail[];
  evidence: string[];
  actions: CardAction[];
}

type Assets = Parameters<typeof formatPendingPayment>[1];

const capitalize = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

export const formatWhen = (timestamp: number | undefined): string | undefined =>
  timestamp
    ? new Date(timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : undefined;

const detailsFor = (ids: { callId?: string; userOpHash?: string; transactionHash?: string }): CardDetail[] => [
  ...(ids.transactionHash ? [{ label: "Transaction hash", value: ids.transactionHash }] : []),
  ...(ids.userOpHash ? [{ label: "Operation hash", value: ids.userOpHash }] : []),
  ...(ids.callId ? [{ label: "Wallet service id", value: ids.callId }] : []),
];

const describeAmount = (payment: PendingPayment | null, assets: Assets) =>
  payment ? formatPendingPayment(payment, assets) : undefined;

/** The card for a payment this phone is waiting on. */
export const cardForReport = (
  report: OperationReport,
  options: { assets: Assets; createdAt?: number; checking?: boolean },
): OperationCard | null => {
  if (report.status === "none") return null;
  const key = "pending";

  if (report.status === "busy") {
    return {
      key,
      tone: "waiting",
      title: "Another check is already running",
      body: "A payment or a check is already running for this account. Wait a moment, then try again.",
      details: [],
      evidence: [],
      actions: [{ id: "check", label: "Check again" }],
    };
  }

  if (report.status === "foreign") {
    return {
      key,
      tone: "neutral",
      title: report.reason === "other-network" ? "A saved payment is for another network" : "A saved payment is for another account",
      body:
        report.reason === "other-network"
          ? "This phone holds a payment made on a different network than this app is using, so it was not checked here and nothing was changed. Use the app version for that network to see it."
          : "This phone holds a payment recorded under a different wallet than this account, so it was not used and nothing was changed.",
      details: [],
      evidence: [],
      actions: [],
    };
  }

  const payment = describeAmount(report.payment, options.assets);
  const evidence = report.evidence.map(describeEvidence);
  const details = detailsFor(report.ids);

  if (report.status === "confirmed") {
    return {
      key,
      tone: "good",
      title: "Payment confirmed",
      body:
        report.recording === "queued"
          ? "The payment went through. It will appear in your history as soon as ATARA has recorded it. You do not need to pay again."
          : "The payment went through and this account can send again. This phone did not keep what was paid, so it cannot add it to your history by itself.",
      ...(payment ? { payment } : {}),
      details,
      evidence,
      actions: [{ id: "dismiss", label: "Done" }],
    };
  }

  if (report.status === "failed") {
    return {
      key,
      tone: "bad",
      title: "Payment did not go through",
      body: `${report.reason} No money moved for it, so you can send it again.`,
      ...(payment ? { payment } : {}),
      details,
      evidence,
      actions: [{ id: "dismiss", label: "Got it" }],
    };
  }

  const when = formatWhen(options.createdAt ?? report.createdAt);
  const actions: CardAction[] = [{ id: "check", label: options.checking ? "Checking…" : "Check again" }];
  if (report.releasable) actions.push({ id: "release", label: "It no longer shows up? Release it", destructive: true });

  if (report.status === "pending") {
    return {
      key,
      tone: "waiting",
      title: "Payment still processing",
      body: "The wallet service has this payment and is still processing it. Nothing was sent again, and this account waits until it is settled.",
      ...(payment ? { payment } : {}),
      ...(when ? { when } : {}),
      details,
      evidence,
      actions,
    };
  }

  const reason =
    report.reason === "unreachable"
      ? "This phone could not get a clear answer just now (a connection or service problem). That says nothing about your payment."
      : report.reason === "no-source"
        ? "The wallet service could not be used from this phone, so the payment could not be looked up. Update the app or try again later."
        : report.reason === "not-found"
          ? "Neither the wallet service nor the Base network shows this payment yet. That does not mean it failed: it can still be waiting."
          : "The answers so far do not settle it either way.";
  return {
    key,
    tone: "waiting",
    title: report.reason === "not-found" ? "This payment can't be found yet" : "This payment could not be verified yet",
    body: `${reason} It may still go through, so do not send it again.`,
    ...(payment ? { payment } : {}),
    ...(when ? { when } : {}),
    details,
    evidence,
    actions,
  };
};

/** The card before any check has run: what is stored, and nothing more. */
export const cardForRecord = (record: OperationRecord, options: { assets: Assets; checking?: boolean }): OperationCard => {
  const failed = record.phase === "failed";
  const base: OperationReport = failed
    ? {
        status: "failed",
        ids: idsFrom(record),
        evidence: record.checks,
        payment: paymentFromRecord(record),
        reason: record.failure?.reason ?? "The network reported that this payment did not happen.",
      }
    : {
        status: "unknown",
        ids: idsFrom(record),
        evidence: record.checks,
        payment: paymentFromRecord(record),
        ...(record.createdAt !== undefined ? { createdAt: record.createdAt } : {}),
        releasable: false,
      };
  const card = cardForReport(base, { ...options, createdAt: record.createdAt }) as OperationCard;
  if (failed) return card;
  return {
    ...card,
    actions: card.actions.map((action) => (action.id === "check" && !options.checking ? { ...action, label: "Check now" } : action)),
    tone: "waiting",
    title: record.phase === "submitting" ? "Payment being sent" : "Payment awaiting verification",
    body:
      record.phase === "submitting"
        ? "This payment was being sent when the app stopped, so it is not known whether it left this phone. It may still go through. Check it before doing anything else."
        : "This payment may still confirm. New payments from this account wait until it is settled. Check it now.",
  };
};

const idsFrom = (record: OperationRecord) => ({
  ...(record.id ? { callId: record.id } : {}),
  ...(record.userOpHash ? { userOpHash: record.userOpHash } : {}),
  ...(record.transactionHash ? { transactionHash: record.transactionHash } : {}),
});

const paymentFromRecord = (record: OperationRecord) => paymentOf(record);

/** A payment that went through and that ATARA has not recorded yet. */
export const cardForOutbox = (entry: OutboxEntry, options: { assets: Assets }): OperationCard => {
  const payment = formatPendingPayment(
    { recipient: entry.receiverAddress, amount: entry.rawAmountWei ?? "0", token: entry.assetSymbol === "ETH" ? null : tokenOf(entry, options.assets) },
    options.assets,
  );
  const rejected = entry.state === "rejected";
  return {
    key: `recording:${entry.transactionHash}`,
    tone: rejected ? "neutral" : "waiting",
    title: rejected ? "Payment made, not added to history" : "Payment made, being added to your history",
    body: rejected
      ? `${entry.lastReason ?? "The service could not record it."} The payment itself went through and is safe: the transaction hash below is your proof. Do not pay again.`
      : `The payment went through. ATARA has not recorded it yet${entry.lastReason ? ` (${entry.lastReason.replace(/\.$/, "").toLowerCase()})` : ""}. It will be retried automatically. Nothing will be sent again.`,
    payment,
    when: formatWhen(entry.confirmedAt),
    details: [{ label: "Transaction hash", value: entry.transactionHash }],
    evidence: (entry.proof ?? []).map(describeEvidence),
    actions: rejected ? [] : [{ id: "retry-recording", label: "Record it now" }],
  };
};

const tokenOf = (entry: OutboxEntry, assets: Assets): string | null =>
  assets.find((asset) => asset.symbol === entry.assetSymbol)?.contractAddress?.toLowerCase() ?? null;

export const evidenceLines = (evidence: Evidence[]): string[] => evidence.map(describeEvidence);
export { shortHash, capitalize };
