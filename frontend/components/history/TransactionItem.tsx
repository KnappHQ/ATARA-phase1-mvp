import React from "react";
import { View, Text, Pressable } from "react-native";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react-native";
import { MotiView } from "moti";
import { UiTransaction } from "@/types/transaction";

interface TransactionItemProps {
  transaction: UiTransaction;
  index: number;
}

export const TransactionItem = ({
  transaction,
  index,
}: TransactionItemProps) => {
  const isReceive = transaction.type === "receive";

  return (
    <MotiView
      from={{ opacity: 0, translateX: -20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: "timing", duration: 400, delay: index * 60 }}
    >
      <Pressable className="flex-row items-center justify-between p-5">
        <View className="flex-row items-center gap-3 flex-1">
          <View
            className={`w-12 h-12 rounded-full items-center justify-center ${
              isReceive
                ? "bg-champagne/10 border border-champagne/20"
                : "bg-white/5 border border-white/10"
            }`}
          >
            {isReceive ? (
              <ArrowDownLeft size={20} color="#E5D2A6" />
            ) : (
              <ArrowUpRight size={20} color="#ffffff80" />
            )}
          </View>

          <View className="flex-1">
            <Text
              className="text-base font-rajdhani-semibold text-white mb-0.5"
              numberOfLines={1}
            >
              {transaction.name}
            </Text>
            <Text className="text-sm font-rajdhani-medium text-white/40">
              {transaction.time}
            </Text>
          </View>
        </View>

        <View className="items-end">
          <Text
            className={`text-base font-rajdhani-semibold ${
              isReceive ? "text-champagne-neon" : "text-white/60"
            }`}
          >
            {transaction.amount}
          </Text>
          {transaction.value ? (
            <Text className="text-sm font-rajdhani-medium text-white/40 mt-0.5">
              {transaction.value}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </MotiView>
  );
};
