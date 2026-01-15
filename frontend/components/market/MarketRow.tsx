import React, { useState } from "react";
import { View, Text, Pressable, Image } from "react-native";
import { TrendingUp, TrendingDown } from "lucide-react-native";
import { MotiView } from "moti";
import { MarketCoin } from "@/types/market";
import { formatCurrency, formatChange } from "@/utils/format";

interface MarketRowProps {
  crypto: MarketCoin;
  index: number;
  isLast: boolean;
}

export const MarketRow = ({ crypto, index }: MarketRowProps) => {
  const [imageError, setImageError] = useState(false);
  const isPositive = crypto.price_change_percentage_24h >= 0;

  return (
    <MotiView
      from={{ opacity: 0, translateX: -20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: "timing", duration: 400, delay: index * 50 }}
    >
      <Pressable className="flex-row items-center px-4 py-3 active:bg-white/5">
        <View className="flex-row items-center gap-3 flex-1">
          <View className="w-9 h-9 rounded-full bg-white/5 border border-champagne/20 items-center justify-center overflow-hidden">
            {crypto.image && !imageError ? (
              <View className="w-full h-full items-center justify-center bg-white/10 p-1">
                <Image
                  source={{ uri: crypto.image }}
                  className="w-full h-full rounded-full"
                  resizeMode="contain"
                  onError={() => setImageError(true)}
                />
              </View>
            ) : (
              <Text className="text-sm font-rajdhani-bold text-champagne">
                {crypto.symbol.slice(0, 2).toUpperCase()}
              </Text>
            )}
          </View>
          <View className="flex-1">
            <Text
              className="text-base font-rajdhani-semibold text-white"
              numberOfLines={1}
            >
              {crypto.symbol.toUpperCase()}
            </Text>
            <Text
              className="text-xs text-white/40 font-rajdhani-medium"
              numberOfLines={1}
            >
              {crypto.name}
            </Text>
          </View>
        </View>

        <View className="items-end mr-4">
          <Text className="text-base font-rajdhani-medium text-white">
            {formatCurrency(crypto.current_price)}
          </Text>
        </View>

        <View className="flex-row items-center gap-1 min-w-[70px] justify-end">
          {isPositive ? (
            <TrendingUp size={14} color="#E5D2A6" />
          ) : (
            <TrendingDown size={14} color="#ffffff60" />
          )}
          <Text
            className={`text-base font-rajdhani-semibold ${
              isPositive ? "text-champagne-neon" : "text-white/60"
            }`}
          >
            {formatChange(crypto.price_change_percentage_24h)}
          </Text>
        </View>
      </Pressable>
    </MotiView>
  );
};
