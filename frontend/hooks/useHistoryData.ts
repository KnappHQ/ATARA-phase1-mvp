import { useState, useMemo } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useTransactions } from "./useTransaction";
import { FilterType } from "@/components/history/FilterTabs";
import { UiTransaction } from "@/types/transaction";

export const useHistoryData = () => {
  const [filter, setFilter] = useState<FilterType>("all");
  const { user } = useAuthStore();
  const { allTransactions, isLoading, refetch } = useTransactions(user?.id);

  const formattedTransactions = useMemo(() => {
    return allTransactions.map((tx) => {
      const d = new Date(tx.rawDate);
      const now = new Date();
      
      let dateHeader = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const isToday = d.toDateString() === now.toDateString();
      const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === d.toDateString();

      if (isToday) dateHeader = "Today";
      else if (isYesterday) dateHeader = "Yesterday";

      return {
        id: tx.id,
        name: tx.name, 
        type: tx.type,
        date: dateHeader,
        time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        amount: tx.amount,
        status: tx.status,
      } as UiTransaction;
    });
  }, [allTransactions]);

  
  const filteredData = useMemo(() => {
    if (filter === "all") return formattedTransactions;
    return formattedTransactions.filter((tx) => tx.type === filter);
  }, [formattedTransactions, filter]);

  
  const groupedEntries = useMemo(() => {
    const groups = filteredData.reduce((acc, tx) => {
      if (!acc[tx.date]) acc[tx.date] = [];
      acc[tx.date].push(tx);
      return acc;
    }, {} as Record<string, UiTransaction[]>);

    return Object.entries(groups);
  }, [filteredData]);

  return {
    filter,
    setFilter,
    groupedEntries,
    isLoading,
    refetch
  };
};