import React from "react";
import { View, Text } from "react-native";
import { MotiView } from "moti";
import { TransactionItem } from "./TransactionItem";
import { UiTransaction } from "@/types/transaction";

interface TransactionGroupProps {
  date: string;
  transactions: UiTransaction[];
  index: number;
}

export const TransactionGroup = ({
  date,
  transactions,
  index,
}: TransactionGroupProps) => {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 400, delay: index * 100 }}
    >
      <View className="mb-6">
        <Text className="text-sm font-rajdhani-medium text-champagne/50 uppercase tracking-wider mb-3">
          {date}
        </Text>

        <View className="relative overflow-hidden rounded-xl border border-champagne/10 bg-[rgba(255,255,255,0.03)] shadow-lg">
          {transactions.map((transaction, txIndex) => (
            <TransactionItem
              key={transaction.id}
              transaction={transaction}
              index={txIndex}
            />
          ))}
        </View>
      </View>
    </MotiView>
  );
};
