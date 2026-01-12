import React from "react";
import { View, Text, ScrollView } from "react-native";
import { MarketRow } from "./MarketRow";
import { CRYPTO_DATA } from "./mockData";

export const MarketPulseSection = () => {
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

        <ScrollView
          style={{ maxHeight: 280 }}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
        >
          {CRYPTO_DATA.map((crypto, index) => (
            <MarketRow
              key={crypto.symbol}
              crypto={crypto}
              index={index}
              isLast={index === CRYPTO_DATA.length - 1}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
};
