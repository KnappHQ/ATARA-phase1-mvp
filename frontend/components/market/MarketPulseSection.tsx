import React, { useEffect } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { MarketRow } from "./MarketRow";
import { useMarketStore } from "@/stores/useMarketStore";

export const MarketPulseSection = () => {
  const { marketData, isMarketLoading, fetchMarketOverview } = useMarketStore();

  useEffect(() => {
    if (marketData.length === 0) fetchMarketOverview();
  }, []);
  return (
    <View className="mb-8">
      <Text className="text-sm font-rajdhani-medium text-muted-foreground uppercase tracking-wider mb-4">
        Market Pulse
      </Text>

      <View className="relative overflow-hidden rounded-xl border border-champagne/10 bg-[rgba(255,255,255,0.03)] shadow-lg">
        <View className="flex-row items-center px-4 py-2 border-b border-champagne/10">
          <Text className="flex-1 text-xs font-rajdhani-medium text-muted-foreground uppercase tracking-wider">
            Asset
          </Text>
          <Text className="text-xs font-rajdhani-medium text-muted-foreground uppercase tracking-wider mr-4">
            Price
          </Text>
          <Text className="text-xs font-rajdhani-medium text-muted-foreground uppercase tracking-wider min-w-[70px] text-right">
            24h
          </Text>
        </View>

        {isMarketLoading && marketData.length === 0 ? (
          <View className="py-20 items-center justify-center">
            <ActivityIndicator color="#E5D2A6" size="large" />
          </View>
        ) : (
          <ScrollView
            style={{ maxHeight: 280 }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            {marketData.map((crypto, index) => (
              <MarketRow
                key={crypto.id}
                crypto={crypto}
                index={index}
                isLast={index === marketData.length - 1}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
};
