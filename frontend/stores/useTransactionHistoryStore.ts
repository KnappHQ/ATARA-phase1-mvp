import { create } from "zustand";
import { HistoryService, HistoryTransaction } from "@/services/history.service";
import {
  formatHistoryAmount,
  buildTransactionName,
  formatTimestamp,
} from "@/utils/format";
import { useAddressBookStore } from "@/stores/useAddressBookStore";
import { useWalletStore } from "@/stores/useWalletStore";
import * as Sentry from "@sentry/react-native";

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
  lastCategory: string | null;
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
        lastCategory: null,
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
    thread.lastCategory = lastTx.category || null;
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

  if (!tx.counterparty.handle && tx.counterparty.address) {
    const { hasNickname, getDisplayName } = useAddressBookStore.getState();
    if (hasNickname(tx.counterparty.address)) {
      nickname = getDisplayName(tx.counterparty.address);
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

interface HistoryState {
  rawHistory: HistoryTransaction[];
  displayHistory: DisplayTransaction[];
  contactThreads: ContactThread[];
  isLoading: boolean;
  error: string | null;

  fetchHistory: () => Promise<void>;
  rebuildDisplayHistory: () => void;
  updateLocalTransaction: (
    id: string,
    changes: { category?: string; userNote?: string | null },
  ) => void;
  clearError: () => void;
}

export const useTransactionHistoryStore = create<HistoryState>((set, get) => ({
  rawHistory: [],
  displayHistory: [],
  contactThreads: [],
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
      set({ rawHistory, displayHistory, contactThreads });
    } catch (error: any) {
      console.error("Failed to fetch transaction history:", error);
      Sentry.captureException(error);
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
    set({ displayHistory, contactThreads });
  },

  updateLocalTransaction: (id, changes) => {
    const { rawHistory } = get();
    const updated = rawHistory.map((tx) =>
      tx.id === id ? { ...tx, ...changes } : tx,
    );
    const displayHistory = updated.map(transformTransaction);
    const contactThreads = groupTransactionsByContact(displayHistory);
    set({
      rawHistory: updated,
      displayHistory,
      contactThreads,
    });
  },

  clearError: () => {
    set({ error: null });
  },
}));
