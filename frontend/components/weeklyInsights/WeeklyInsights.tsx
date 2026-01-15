import React, { useState } from "react";
import { WeeklyInsightsCard } from "./WeeklyInsightsCard";
import { WeeklyInsightsModal } from "./WeeklyInsightsModal";
import { useWeeklyInsights } from "@/hooks/useWeeklyInsights";

export const WeeklyInsights = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  const { totalSpent, chartData, categories, transactionsByCategory } =
    useWeeklyInsights();

  return (
    <>
      <WeeklyInsightsCard
        onPress={() => setIsExpanded(true)}
        totalSpent={totalSpent}
        chartData={chartData}
      />
      <WeeklyInsightsModal
        visible={isExpanded}
        onClose={() => setIsExpanded(false)}
        totalSpent={totalSpent}
        categories={categories}
        transactionsByCategory={transactionsByCategory}
      />
    </>
  );
};
