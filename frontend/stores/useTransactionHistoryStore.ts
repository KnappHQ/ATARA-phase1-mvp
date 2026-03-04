import { create } from "zustand";
import { HistoryService, HistoryTransaction } from "@/services/history.service";
import {
  formatHistoryAmount,
  buildTransactionName,
  formatTimestamp,
} from "@/utils/format";
import { useAddressBookStore } from "@/stores/useAddressBookStore";
import { useWalletStore } from "@/stores/useWalletStore";

export interface WeeklyDayData {
  day: string;
  dateShort: string;
  totalSentUSD: number;
  totalReceivedUSD: number;
  transactionCount: number;
}

export interface WeeklyInsights {
  days: WeeklyDayData[];
  totalSentUSD: number;
  totalReceivedUSD: number;
  netUSD: number;
  period: string;
}

export interface DisplayTransaction {
  id: string;
  txHash: string;
  timestamp: string;
  status: string;
  amount: string;
  assetSymbol: string;
  formattedAmount: string;
  type: "send" | "receive";
  counterparty: {
    address: string;
    name: string;
    showAddress: boolean;
    handle: string | null;
    displayName: string | null;
    profilePicUrl: string | null;
  };
  displayDate: string;
  displayDateShort: string;
  displayTime: string;
  category: string | null;
  userNote: string | null;
  isInApp: boolean;
}

export interface ContactThread {
  address: string;
  displayName: string;
  lastMessage: string;
  lastNote: string;
  lastDate: string;
  lastTime: string;
  lastTimestamp: string;
  totalReceived: number;
  totalSent: number;
  transactionCount: number;
  transactions: DisplayTransaction[];
}

const groupTransactionsByContact = (
  transactions: DisplayTransaction[],
): ContactThread[] => {
  const { assets } = useWalletStore.getState();

  const toUSD = (amount: string, symbol: string): number => {
    const raw = Math.abs(parseFloat(amount));
    if (isNaN(raw)) return 0;
    const asset = assets.find(
      (a) => a.symbol.toUpperCase() === symbol.toUpperCase(),
    );
    return raw * (asset?.usdPrice ?? 0);
  };

  const threads: Record<string, ContactThread> = {};

  transactions.forEach((tx) => {
    const address = tx.counterparty.address;
    // tx.counterparty.name is already formatted by buildTransactionName (@handle / @nickname / truncated)
    const displayName = tx.counterparty.name;

    if (!threads[address]) {
      threads[address] = {
        address,
        displayName,
        lastMessage: "",
        lastNote: "",
        lastDate: tx.displayDateShort,
        lastTime: tx.displayTime,
        lastTimestamp: tx.timestamp,
        totalReceived: 0,
        totalSent: 0,
        transactionCount: 0,
        transactions: [],
      };
    }

    threads[address].transactions.push(tx);
    threads[address].transactionCount += 1;

    const usd = toUSD(tx.amount, tx.assetSymbol);
    if (tx.type === "receive") {
      threads[address].totalReceived += usd;
    } else {
      threads[address].totalSent += usd;
    }
  });

  Object.values(threads).forEach((thread) => {
    thread.transactions.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    const lastTx = thread.transactions[0];
    thread.lastMessage =
      lastTx.type === "receive"
        ? `Received ${lastTx.formattedAmount}`
        : `Sent ${lastTx.formattedAmount.replace("-", "")}`;
    thread.lastNote = lastTx.userNote || "";
    thread.lastDate = lastTx.displayDateShort;
    thread.lastTime = lastTx.displayTime;
    thread.lastTimestamp = lastTx.timestamp;
    thread.totalReceived = parseFloat(thread.totalReceived.toFixed(2));
    thread.totalSent = parseFloat(thread.totalSent.toFixed(2));
  });

  return Object.values(threads).sort((a, b) => {
    return (
      new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()
    );
  });
};

const transformTransaction = (tx: HistoryTransaction): DisplayTransaction => {
  const date = new Date(tx.timestamp);

  let handle = tx.counterparty.handle;
  let displayName = tx.counterparty.displayName;
  let nickname: string | null = null;

  if (!tx.isInApp && tx.counterparty.address) {
    const { hasNickname, getDisplayName } = useAddressBookStore.getState();
    if (hasNickname(tx.counterparty.address)) {
      nickname = getDisplayName(tx.counterparty.address);
      handle = nickname;
      displayName = nickname;
    }
  }

  const { name, showAddress } = buildTransactionName(
    tx.counterparty,
    tx.isInApp,
    nickname,
  );

  return {
    id: tx.id,
    txHash: tx.txHash,
    timestamp: tx.timestamp,
    status: tx.status,
    amount: tx.amount,
    assetSymbol: tx.assetSymbol,
    formattedAmount: formatHistoryAmount(tx.amount, tx.assetSymbol, tx.type),
    type: tx.type,
    counterparty: {
      address: tx.counterparty.address,
      name,
      showAddress,
      handle,
      displayName,
      profilePicUrl: tx.counterparty.profilePicUrl,
    },
    displayDate: formatTimestamp(tx.timestamp),
    displayDateShort: date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    displayTime: date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
    category: tx.category,
    userNote: tx.userNote,
    isInApp: tx.isInApp,
  };
};

const computeWeeklyInsights = (
  transactions: DisplayTransaction[],
): WeeklyInsights => {
  const { assets } = useWalletStore.getState();

  const toUSD = (amount: string, symbol: string): number => {
    const raw = Math.abs(parseFloat(amount));
    if (isNaN(raw)) return 0;
    const asset = assets.find(
      (a) => a.symbol.toUpperCase() === symbol.toUpperCase(),
    );
    return raw * (asset?.usdPrice ?? 0);
  };

  // Build 7-day window: today going back 6 days (oldest first)
  const days: WeeklyDayData[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    return {
      day: d.toLocaleDateString("en-US", { weekday: "short" }),
      dateShort: d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      totalSentUSD: 0,
      totalReceivedUSD: 0,
      transactionCount: 0,
      _date: d,
    } as WeeklyDayData & { _date: Date };
  });

  const windowStart = (days[0] as any)._date as Date;
  const windowEnd = new Date();

  transactions.forEach((tx) => {
    const txDate = new Date(tx.timestamp);
    if (txDate < windowStart || txDate > windowEnd) return;

    // Find matching day bucket
    const dayIdx = days.findIndex((d) => {
      const bucketDate = (d as any)._date as Date;
      const next = new Date(bucketDate);
      next.setDate(next.getDate() + 1);
      return txDate >= bucketDate && txDate < next;
    });
    if (dayIdx === -1) return;

    const usd = toUSD(tx.amount, tx.assetSymbol);
    if (tx.type === "receive") {
      days[dayIdx].totalReceivedUSD += usd;
    } else {
      days[dayIdx].totalSentUSD += usd;
    }
    days[dayIdx].transactionCount += 1;
  });

  // Strip internal _date before returning
  const cleanDays: WeeklyDayData[] = days.map(
    ({ day, dateShort, totalSentUSD, totalReceivedUSD, transactionCount }) => ({
      day,
      dateShort,
      totalSentUSD: parseFloat(totalSentUSD.toFixed(2)),
      totalReceivedUSD: parseFloat(totalReceivedUSD.toFixed(2)),
      transactionCount,
    }),
  );

  const totalSentUSD = parseFloat(
    cleanDays.reduce((s, d) => s + d.totalSentUSD, 0).toFixed(2),
  );
  const totalReceivedUSD = parseFloat(
    cleanDays.reduce((s, d) => s + d.totalReceivedUSD, 0).toFixed(2),
  );

  return {
    days: cleanDays,
    totalSentUSD,
    totalReceivedUSD,
    netUSD: parseFloat((totalReceivedUSD - totalSentUSD).toFixed(2)),
    period: `${cleanDays[0].dateShort} – ${cleanDays[6].dateShort}`,
  };
};

interface HistoryState {
  rawHistory: HistoryTransaction[];
  displayHistory: DisplayTransaction[];
  contactThreads: ContactThread[];
  weeklyInsights: WeeklyInsights | null;
  isLoading: boolean;
  error: string | null;

  fetchHistory: () => Promise<void>;
  rebuildDisplayHistory: () => void;
  clearError: () => void;
}

export const useTransactionHistoryStore = create<HistoryState>((set, get) => ({
  rawHistory: [],
  displayHistory: [],
  contactThreads: [],
  weeklyInsights: null,
  isLoading: false,
  error: null,

  fetchHistory: async () => {
    const { isLoading } = get();
    if (isLoading) return;

    set({ isLoading: true, error: null });

    try {
      const rawHistory = await HistoryService.getHistory();
      const displayHistory = rawHistory.map(transformTransaction);
      const contactThreads = groupTransactionsByContact(displayHistory);
      const weeklyInsights = computeWeeklyInsights(displayHistory);
      set({ rawHistory, displayHistory, contactThreads, weeklyInsights });
    } catch (error: any) {
      console.error("Failed to fetch transaction history:", error);
      set({ error: error.message || "Failed to load history" });
    } finally {
      set({ isLoading: false });
    }
  },

  rebuildDisplayHistory: () => {
    const { rawHistory } = get();
    if (!rawHistory.length) return;
    const displayHistory = rawHistory.map(transformTransaction);
    const contactThreads = groupTransactionsByContact(displayHistory);
    const weeklyInsights = computeWeeklyInsights(displayHistory);
    set({ displayHistory, contactThreads, weeklyInsights });
  },

  clearError: () => {
    set({ error: null });
  },
}));
