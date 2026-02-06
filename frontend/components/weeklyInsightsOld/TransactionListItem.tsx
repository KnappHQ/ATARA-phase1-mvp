import React from "react";
import { View, Text } from "react-native";
import { MotiView } from "moti";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react-native";
import { formatCurrency } from "@/utils/format";

export const TransactionListItem = ({
  transaction,
  index,
}: {
  transaction: any;
  index: number;
}) => {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 15 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 300, delay: index * 50 }}
      className="bg-[#0e0d10] backdrop-blur-xl rounded-xl p-4 border border-[#E5D2A6]/10"
    >
      <View className="flex-row items-center gap-3">
        <View
          className={`w-9 h-9 rounded-full items-center justify-center ${
            transaction.type === "out"
              ? "bg-red-500/10 border border-red-500/20"
              : "bg-[#E5D2A6]/10 border border-[#E5D2A6]/20"
          }`}
        >
          {transaction.type === "out" ? (
            <ArrowUpRight size={16} color="#ef4444" />
          ) : (
            <ArrowDownLeft size={16} color="#E5D2A6" />
          )}
        </View>

        <View className="flex-1">
          <Text
            className="text-tiny font-rajdhani-medium text-white/90"
            numberOfLines={1}
          >
            {transaction.title}
          </Text>
          <Text className="text-sm font-rajdhani-medium text-white/40">
            {transaction.date} · {transaction.time}
          </Text>
        </View>

        <Text
          className={`text-base font-rajdhani-semibold ${
            transaction.type === "out" ? "text-white" : "text-[#E5D2A6]"
          }`}
        >
          {transaction.type === "out" ? "-" : "+"}
          {formatCurrency(transaction.amount)}
        </Text>
      </View>
    </MotiView>
  );
};
