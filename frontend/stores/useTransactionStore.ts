import { create } from "zustand";
import { TransactionService } from "../services/transaction.service";
import { UiTransaction } from "@/types/transaction";

interface TransactionState {
  allTransactions: UiTransaction[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
  fetchHistory: (currentUserId: string) => Promise<void>;
  reset: () => void;
}

const formatAddress = (addr: string | null | undefined) => {
  if (!addr) return "Unknown";
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
};

export const useTransactionStore = create<TransactionState>((set) => ({
  allTransactions: [],
  isLoading: false,
  error: null,
  lastFetched: null,

  fetchHistory: async (currentUserId: string) => {
    if (!currentUserId) return;

    set({ isLoading: true, error: null });

    try {
      const rawHistory = await TransactionService.getHistory();

      const formatted: UiTransaction[] = rawHistory.map((tx) => {
        const isSend = tx.senderId === currentUserId;

        const otherUser = isSend ? tx.receiver : tx.sender;
        const otherAddress = isSend
          ? tx.receiverAddress || tx.receiver?.publicAddress
          : tx.sender?.publicAddress || "Unknown";

        let displayName = "Unknown";
        let isExternal = false;

        if (otherUser && otherUser.handle) {
          displayName = `@${otherUser.handle}`;
        } else {
          displayName = formatAddress(otherAddress);
          isExternal = true;
        }

        const name = isSend
          ? `Sent to ${displayName}`
          : `Received from ${displayName}`;

        const txDate = new Date(tx.createdAt);
        const today = new Date();
        const isToday = txDate.toDateString() === today.toDateString();

        const dateString = isToday
          ? `Today, ${txDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
          : txDate.toLocaleDateString([], { month: "short", day: "numeric" });

        return {
          id: tx.id,
          name: name,
          date: dateString,
          time: txDate.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          rawDate: txDate,
          type: isSend ? "send" : "receive",
          amount: `${isSend ? "-" : "+"}${parseFloat(tx.amount).toFixed(4)} ${tx.assetSymbol}`,
          status: tx.status,
          category: tx.category || null,
          userNote: tx.userNote || null,

          isExternal: isExternal,
          otherPartyAddress: otherAddress || "",
        };
      });

      set({
        allTransactions: formatted,
        isLoading: false,
        lastFetched: Date.now(),
      });
    } catch (e) {
      console.error(e);
      set({ error: "Failed to load transactions", isLoading: false });
    }
  },

  reset: () => set({ allTransactions: [], lastFetched: null }),
}));
