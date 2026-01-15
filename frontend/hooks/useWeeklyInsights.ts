import { useMemo } from "react";
import { useTransactionStore } from "@/stores/useTransactionStore";
import { useAddressBookStore } from "@/stores/useAddressBookStore"; // Import Store
import { resolveTransactionName } from "@/utils/transactionUtils"; // Import Utils
import { categorizeTransaction, CATEGORY_CONFIG } from "@/utils/categoryLogic";

export const useWeeklyInsights = () => {
  const { allTransactions, isLoading } = useTransactionStore();

  const contacts = useAddressBookStore((state) => state.contacts);

  const stats = useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(now.getDate() - 7);
    oneWeekAgo.setHours(0, 0, 0, 0);

    const recentTx = allTransactions.filter((tx) => {
      const txDate = new Date(tx.rawDate);
      return txDate >= oneWeekAgo && txDate <= now;
    });

    const totalVolume = recentTx.reduce(
      (sum, tx) => sum + Math.abs(parseFloat(tx.amount)),
      0
    );

    const chartData = Array(7).fill(0);
    recentTx.forEach((tx) => {
      const txDate = new Date(tx.rawDate);
      const diffTime = txDate.getTime() - oneWeekAgo.getTime();
      const dayIndex = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (dayIndex >= 0 && dayIndex < 7) {
        chartData[dayIndex] += Math.abs(parseFloat(tx.amount));
      }
    });

    const categoryAggregates: Record<
      string,
      { amount: number; count: number; transactions: any[]; icon: string }
    > = {};

    Object.values(CATEGORY_CONFIG).forEach((config) => {
      categoryAggregates[config.label] = {
        amount: 0,
        count: 0,
        transactions: [],
        icon: config.icon,
      };
    });

    recentTx.forEach((tx) => {
      const categoryKey = categorizeTransaction(tx);
      const config = CATEGORY_CONFIG[categoryKey];
      const uiName = config.label;
      const amountVal = Math.abs(parseFloat(tx.amount));

      if (categoryAggregates[uiName]) {
        categoryAggregates[uiName].amount += amountVal;
        categoryAggregates[uiName].count += 1;
        categoryAggregates[uiName].transactions.push({
          id: tx.id,
          title: resolveTransactionName(tx, contacts),
          date: tx.date,
          time: tx.time,
          amount: amountVal,
          type: tx.type === "send" ? "out" : "in",
          icon: config.icon,
        });
      }
    });

    const categories = Object.entries(categoryAggregates)
      .map(([name, data]) => {
        const percentage =
          totalVolume > 0 ? (data.amount / totalVolume) * 100 : 0;

        return {
          name,
          amount: data.amount,
          count: data.count,
          icon: data.icon,
          percentage:
            percentage > 0 && percentage < 1 ? "<1" : Math.round(percentage),
        };
      })
      .sort((a, b) => b.amount - a.amount);

    const transactionsByCategory: Record<string, any[]> = {};
    Object.entries(categoryAggregates).forEach(([name, data]) => {
      transactionsByCategory[name] = data.transactions;
    });

    return {
      totalSpent: totalVolume,
      chartData,
      categories,
      transactionsByCategory,
    };
  }, [allTransactions, contacts]);
  return {
    isLoading,
    ...stats,
  };
};
