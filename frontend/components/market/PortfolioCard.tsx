import React from "react";
import { View, Text, Pressable } from "react-native";
import { Trash2 } from "lucide-react-native";
import { MotiView } from "moti";
import { Holding } from "@/types/market";
import { formatCurrency } from "@/utils/format";

interface PortfolioCardProps {
  holding: Holding;
  index: number;
  onRemove: (id: string) => void;
}

export const PortfolioCard = ({
  holding,
  index,
  onRemove,
}: PortfolioCardProps) => {
  const currentValue = holding.currentValue || 0;
  const profitLoss = holding.profitLoss || 0;
  const isPositive = profitLoss >= 0;

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "timing", duration: 300, delay: index * 100 }}
      className="flex-shrink-0 w-44"
    >
      <View className="relative overflow-hidden rounded-xl border border-champagne/20 bg-[rgba(255,255,255,0.03)] p-4">
        <Pressable
          onPress={() => onRemove(holding.id)}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/10 border border-red-500/20 items-center justify-center z-10 active:bg-red-500/20"
        >
          <Trash2 size={12} color="#ef4444" />
        </Pressable>

        <View className="flex-row items-center gap-2 mb-3">
          <View className="w-8 h-8 rounded-full bg-champagne/10 border border-champagne/20 items-center justify-center">
            <Text className="text-sm font-rajdhani-bold text-champagne">
              {holding.symbol.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            <Text
              className="text-base font-rajdhani-semibold text-white"
              numberOfLines={1}
            >
              {holding.symbol}
            </Text>
            <Text className="text-xs text-white/40 font-rajdhani-medium">
              {holding.quantity.toFixed(4)}
            </Text>
          </View>
        </View>

        <Text className="text-lg font-rajdhani-semibold text-white mb-2">
          {formatCurrency(currentValue)}
        </Text>

        <View className="flex-row items-center justify-between">
          <View>
            <Text
              className={`text-xs font-rajdhani-semibold ${
                isPositive ? "text-champagne-neon" : "text-red-400"
              }`}
              style={
                isPositive
                  ? {
                      textShadowColor: "rgba(255, 235, 153, 0.4)",
                      textShadowOffset: { width: 0, height: 0 },
                      textShadowRadius: 8,
                    }
                  : undefined
              }
            >
              {isPositive ? "+" : ""}
              {formatCurrency(profitLoss)}
            </Text>
          </View>
        </View>
      </View>
    </MotiView>
  );
};
