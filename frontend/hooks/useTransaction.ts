import { useState, useEffect, useCallback } from "react";
import { TransactionService } from "../services/transaction.service";
import { useAuthStore } from "@/stores/useAuthStore";

export interface UI_Transaction {
  id: string;
  name: string;
  date: string;
  amount: string;
  type: "receive" | "send";
  status: string;
  rawDate: Date;
}

export const useGasEstimation = (
  recipientAddress?: string,
  amount?: string
) => {
  const [networkFee, setNetworkFee] = useState("0.00");
  const [isEstimating, setIsEstimating] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const estimate = async () => {
      if (isMounted) setIsEstimating(true);

      if (!recipientAddress || !amount) {
        if (isMounted) setIsEstimating(false);
        return;
      }

      try {
        const { estimatedFee } = await TransactionService.estimateTransaction(
          recipientAddress,
          amount
        );
        if (isMounted) setNetworkFee(estimatedFee);
      } catch (e) {
        console.warn("Gas estimation failed", e);
        // Fallback for UI if estimation fails
        if (isMounted) setNetworkFee("0.0001");
      } finally {
        if (isMounted) setIsEstimating(false);
      }
    };

    estimate();

    return () => {
      isMounted = false;
    };
  }, [recipientAddress, amount]);

  return { networkFee, isEstimating };
};

export const useTransactions = (currentUserId: string | undefined) => {
  const [allTransactions, setAllTransactions] = useState<UI_Transaction[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<
    UI_Transaction[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isAuthenticated } = useAuthStore();

  const formatAddress = (addr: string) => {
    if (!addr) return "Unknown";
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  const fetchHistory = useCallback(async () => {
    if (!isAuthenticated || !currentUserId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const rawHistory = await TransactionService.getHistory();

      const formatted = rawHistory.map((tx) => {
        const isSend = tx.senderId === currentUserId;

        let name = "Unknown";
        if (isSend) {
          if (tx.receiver && tx.receiver.handle) {
            name = `Sent to @${tx.receiver.handle}`;
          } else {
            // Fallback to receiverAddress from schema
            name = `Sent to ${formatAddress(tx.receiverAddress)}`;
          }
        } else {
          if (tx.sender && tx.sender.handle) {
            name = `Received from @${tx.sender.handle}`;
          } else {
            name = `Received from ${formatAddress(tx.sender.publicAddress)}`;
          }
        }

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
          rawDate: txDate,
          type: isSend ? "send" : "receive",
          amount: `${isSend ? "-" : "+"}${parseFloat(tx.amount).toFixed(4)} ${tx.assetSymbol}`,
          status: tx.status,
        } as UI_Transaction;
      });

      setAllTransactions(formatted);

      setRecentTransactions(formatted.slice(0, 5));
    } catch (e) {
      console.error(e);
      setError("Failed to load transactions");
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, isAuthenticated]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    allTransactions,
    recentTransactions,
    isLoading,
    error,
    refetch: fetchHistory,
  };
};
