import { useMemo } from "react";
import { Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS } from "react-native-reanimated";
import type { Token } from "@/stores/useWalletStore";

interface AssetBalanceCarouselProps {
  assets: Token[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

const formatBalance = (balance: string) => {
  const numericBalance = Number(balance);
  if (!Number.isFinite(numericBalance)) return balance || "0";

  return numericBalance.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
};

const formatUsd = (usdValue: string) => {
  const numericValue = Number(usdValue.replace(/[$,]/g, ""));
  if (!Number.isFinite(numericValue)) return "$0.00";

  return numericValue.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const AssetBalanceCarousel = ({
  assets,
  selectedIndex,
  onSelect,
}: AssetBalanceCarouselProps) => {
  const availableAssets = useMemo(
    () => assets.filter((asset) => Boolean(asset.symbol)),
    [assets],
  );

  if (availableAssets.length === 0) return null;

  const safeIndex = Math.min(selectedIndex, availableAssets.length - 1);
  const asset = availableAssets[safeIndex];

  const selectAsset = (nextIndex: number) => {
    const normalizedIndex =
      (nextIndex + availableAssets.length) % availableAssets.length;
    if (normalizedIndex === safeIndex) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(normalizedIndex);
  };

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-18, 18])
    .failOffsetY([-18, 18])
    .onEnd((event) => {
      if (Math.abs(event.translationX) < 36) return;
      runOnJS(selectAsset)(safeIndex + (event.translationX < 0 ? 1 : -1));
    });

  return (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View
        className="items-center"
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Solde ${asset.name}`}
        accessibilityHint="Balaye horizontalement pour changer de crypto"
      >
        <View className="flex-row items-center gap-2 mb-2">
          <View className="w-7 h-7 rounded-full bg-white/10 items-center justify-center">
            <Text className="text-[9px] font-semibold text-white/80">
              {asset.symbol.slice(0, 3)}
            </Text>
          </View>
          <Text className="text-xs uppercase text-white/55" style={{ letterSpacing: 1.5 }}>
            {asset.name}
          </Text>
        </View>

        <View className="flex-row items-baseline justify-center">
          <Text className="text-5xl font-bold text-white">
            {formatBalance(asset.balance)}
          </Text>
          <Text className="text-2xl text-white/45 ml-2">{asset.symbol}</Text>
        </View>
        <Text className="text-sm text-white/45 mt-2">
          ≈ {formatUsd(asset.usdValue)} · solde disponible
        </Text>

        <View className="flex-row items-center gap-3 mt-5" accessible={false}>
          <ChevronLeft size={14} color="rgba(255,255,255,0.35)" />
          <View className="flex-row gap-1.5">
            {availableAssets.map((item, index) => (
              <View
                key={`${item.symbol}-${index}`}
                className={`h-1.5 rounded-full ${index === safeIndex ? "w-5 bg-white" : "w-1.5 bg-white/25"}`}
              />
            ))}
          </View>
          <ChevronRight size={14} color="rgba(255,255,255,0.35)" />
        </View>
        <Text className="text-[10px] text-white/35 mt-2">
          Balaye pour changer de crypto
        </Text>
      </Animated.View>
    </GestureDetector>
  );
};
