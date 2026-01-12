import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { Plus } from "lucide-react-native";
import { MotiView } from "moti";
import { PortfolioCard, Holding } from "./PortfolioCard";
import { formatPrice } from "./mockData";

interface PortfolioSectionProps {
  holdings: Holding[];
  onAddPress: () => void;
  onRemoveHolding: (id: string) => void;
}

export const PortfolioSection = ({
  holdings,
  onAddPress,
  onRemoveHolding,
}: PortfolioSectionProps) => {
  const totalValue = holdings.reduce(
    (sum, h) => sum + h.quantity * h.currentPrice,
    0
  );
  const totalInvested = holdings.reduce(
    (sum, h) => sum + h.quantity * h.purchasePrice,
    0
  );
  const totalProfitLoss = totalValue - totalInvested;
  const totalProfitLossPercent =
    totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

  return (
    <View>
      {holdings.length > 0 && (
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 400 }}
          className="relative overflow-hidden rounded-xl border border-champagne/20 bg-[rgba(255,255,255,0.03)] p-4 mb-6"
        >
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs text-champagne/50 font-rajdhani-medium uppercase tracking-hud-wide">
              Total Value
            </Text>
            <Text
              className={`text-xs font-rajdhani-semibold ${
                totalProfitLoss >= 0 ? "text-champagne" : "text-red-400"
              }`}
            >
              {totalProfitLoss >= 0 ? "+" : ""}
              {formatPrice(totalProfitLoss)} (
              {totalProfitLossPercent.toFixed(1)}%)
            </Text>
          </View>
          <Text
            className="text-3xl font-rajdhani-bold text-champagne-neon"
            style={{
              textShadowColor: "rgba(255, 235, 153, 0.5)",
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 20,
            }}
          >
            {formatPrice(totalValue)}
          </Text>
          <Text className="text-xs text-white/40 font-rajdhani-medium mt-1">
            Invested: {formatPrice(totalInvested)}
          </Text>
        </MotiView>
      )}

      <View className="mb-8">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-sm font-rajdhani-medium text-muted-foreground uppercase tracking-wider">
            My Portfolio
          </Text>
          <Pressable
            onPress={onAddPress}
            className="flex-row items-center gap-1 px-3 py-1.5 rounded-lg bg-champagne/10 border border-champagne/20 active:bg-champagne/20"
          >
            <Plus size={14} color="#E5D2A6" />
            <Text className="text-xs font-rajdhani-semibold text-champagne">
              Add
            </Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-3"
        >
          {holdings.length === 0 ? (
            <Pressable
              onPress={onAddPress}
              className="flex-shrink-0 rounded-xl border border-1 border-dashed border-champagne/20 bg-[rgba(255,255,255,0.03)] shadow-lg p-4 items-center justify-center active:border-champagne/50"
              style={{ minHeight: 90, width: 144 }}
            >
              <Plus size={24} color="#E5D2A6" />
              <Text className="text-xs text-muted-foreground font-rajdhani-medium mt-2">
                Add crypto
              </Text>
            </Pressable>
          ) : (
            holdings.map((holding, index) => (
              <PortfolioCard
                key={holding.id}
                holding={holding}
                index={index}
                onRemove={onRemoveHolding}
              />
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
};
