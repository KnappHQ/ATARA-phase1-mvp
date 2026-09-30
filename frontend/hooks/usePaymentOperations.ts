import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import { flushRecordings, getPaymentOperations } from "@/services/paymentOperations.runtime";
import type { OperationReport } from "@/services/paymentOperations";
import type { OperationRecord } from "@/utils/operationRecord";
import type { OutboxEntry } from "@/utils/operationOutbox";
import {
  cardForOutbox,
  cardForRecord,
  cardForReport,
  type CardAction,
  type OperationCard,
} from "@/utils/operationPresentation";
import { useTransactionHistoryStore } from "@/stores/useTransactionHistoryStore";

type Assets = Parameters<typeof cardForReport>[1]["assets"];

/**
 * Everything the Activity screen needs to show, and do, about payments that are
 * not settled for one account. The account is the smart account address itself,
 * so nothing depends on the wallet having finished starting.
 */
export const usePaymentOperations = (account: string | null | undefined, assets: Assets) => {
  const [record, setRecord] = useState<OperationRecord | null>(null);
  const [report, setReport] = useState<OperationReport | null>(null);
  const [outbox, setOutbox] = useState<OutboxEntry[]>([]);
  const [landed, setLanded] = useState<OperationReport[]>([]);
  const [checking, setChecking] = useState(false);
  const [releasedNote, setReleasedNote] = useState<string | null>(null);
  const currentAccount = useRef(account);
  currentAccount.current = account;

  const refreshHistory = useCallback(() => useTransactionHistoryStore.getState().fetchHistory(), []);

  const refresh = useCallback(async () => {
    if (!account) {
      setRecord(null);
      setOutbox([]);
      return;
    }
    const ops = getPaymentOperations();
    const [nextRecord, nextOutbox] = await Promise.all([ops.peek(account), ops.outbox.list(account)]);
    // The account may have changed while this was running: never show one account's payment under another.
    if (currentAccount.current !== account) return;
    setRecord(nextRecord);
    setOutbox(nextOutbox);
  }, [account]);

  const flush = useCallback(
    async (force = false) => {
      if (!account) return;
      const summary = await flushRecordings(account, { force });
      if (summary.recorded > 0) void refreshHistory();
      await refresh();
    },
    [account, refresh, refreshHistory],
  );

  const check = useCallback(async () => {
    if (!account) return;
    setChecking(true);
    try {
      const result = await getPaymentOperations().check(account);
      if (currentAccount.current !== account) return;
      setReport(result.status === "none" ? null : result);
      await refresh();
      if (result.status === "confirmed") await flush(true);
    } catch {
      // The check itself never throws; this is a storage failure.
      setReport({ status: "unknown", ids: {}, evidence: [], payment: null, releasable: false, reason: "inconclusive" });
    } finally {
      setChecking(false);
    }
  }, [account, refresh, flush]);

  // Switching accounts shows only that account's payments.
  useEffect(() => {
    setReport(null);
    setLanded([]);
    setReleasedNote(null);
    void refresh();
  }, [account, refresh]);

  // Once per account and visit: look again at a payment left waiting, retry the
  // recordings that could not be made, and look again at payments released earlier.
  const startedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!account || startedFor.current === account) return;
    startedFor.current = account;
    void (async () => {
      const ops = getPaymentOperations();
      const pending = await ops.peek(account);
      if (pending) await check();
      const { landed: late } = await ops.checkReleased(account);
      if (late.length && currentAccount.current === account) setLanded(late);
      await flush(false);
    })().catch(() => undefined);
  }, [account, check, flush]);

  // Back from the background is the moment the network usually returns.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void flush(false);
    });
    return () => subscription.remove();
  }, [flush]);

  const run = useCallback(
    async (action: CardAction["id"]) => {
      if (!account) return;
      const ops = getPaymentOperations();
      if (action === "check" || action === "retry-check") return check();
      if (action === "retry-recording") return flush(true);
      if (action === "release") {
        await ops.release(account);
        setReport(null);
        setReleasedNote(
          "Released. This account can send again. ATARA keeps watching that payment and will tell you here if it goes through after all.",
        );
        await refresh();
        return;
      }
      if (action === "dismiss") {
        if (report?.status !== "confirmed") await ops.dismissFailure(account);
        setReport(null);
        await refresh();
      }
    },
    [account, check, flush, refresh, report],
  );

  const cards: OperationCard[] = useMemo(() => {
    const result: OperationCard[] = [];
    const options = { assets, checking };
    if (report && report.status !== "none") {
      const card = cardForReport(report, options);
      // Its own card says the same thing as the confirmed report, with a way to retry.
      const shownBelow =
        report.status === "confirmed" && outbox.some((entry) => entry.transactionHash === report.ids.transactionHash);
      if (card && !shownBelow) result.push(card);
    } else if (record) {
      result.push(cardForRecord(record, options));
    }
    // A payment released earlier that went through after all.
    for (const item of landed) {
      if (item.status !== "confirmed") continue;
      const card = cardForReport(item, options);
      if (card) {
        result.push({
          ...card,
          key: `landed:${item.ids.transactionHash}`,
          title: "A payment you released went through",
          body: "The payment you released earlier has confirmed after all. If you paid again since, that was a second payment. The transaction hash below identifies it.",
          tone: "bad",
        });
      }
    }
    for (const entry of outbox) result.push(cardForOutbox(entry, { assets }));
    return result;
  }, [report, record, outbox, landed, assets, checking]);

  return { cards, checking, run, refresh, releasedNote, dismissReleasedNote: () => setReleasedNote(null) };
};
