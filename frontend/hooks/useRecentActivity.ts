import { useAddressBookStore } from "@/stores/useAddressBookStore";
import { useTransactionStore } from "@/stores/useTransactionStore";
import { resolveTransactionName } from "@/utils/transactionUtils";
import { useEffect, useMemo } from "react";

export const useRecentActivity = (currentUserId: string | undefined) => {
  const { allTransactions, isLoading, error, fetchHistory } =
    useTransactionStore();

  const contacts = useAddressBookStore((state) => state.contacts);

  useEffect(() => {
    if (currentUserId) {
      fetchHistory(currentUserId);
    }
  }, [currentUserId, fetchHistory]);

  const recentTransactions = useMemo(() => {
    return allTransactions.slice(0, 5).map((tx) => ({
      ...tx,
      name: resolveTransactionName(tx, contacts),
    }));
  }, [allTransactions, contacts]);

  return {
    recentTransactions,
    isLoading,
    error,
  };
};
