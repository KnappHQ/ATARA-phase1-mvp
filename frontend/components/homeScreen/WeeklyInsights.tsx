import { useState, useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MotiView } from "moti";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { SparklineChart } from "./SparklineChart";
import { COLORS } from "@/utils/constants";
import { useTransactionHistoryStore } from "@/stores/useTransactionHistoryStore";

export const WeeklyInsights = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { weeklyInsights } = useTransactionHistoryStore();

  const weeklyFlow = useMemo(() => {
    if (!weeklyInsights) return 0;
    const { totalReceivedUSD, totalSentUSD } = weeklyInsights;
    if (totalReceivedUSD === 0 && totalSentUSD === 0) return 0;
    const diff = totalReceivedUSD - totalSentUSD;
    const total = Math.max(totalReceivedUSD, totalSentUSD);
    return total > 0 ? (diff / total) * 100 : 0;
  }, [weeklyInsights]);

  const isFlowPositive = weeklyFlow >= 0;

  // Drive the sparkline from daily received - sent USD values
  const splineData = useMemo(() => {
    if (weeklyInsights?.days?.length) {
      return weeklyInsights.days.map(
        (d) => 50 + (d.totalReceivedUSD - d.totalSentUSD),
      );
    }
    // Fallback synthetic curve
    const trend = isFlowPositive ? 1 : -1;
    return Array.from({ length: 25 }, (_, i) => {
      const noise = Math.sin(i * 0.6) * 6 + Math.cos(i * 0.9) * 4;
      const trendComponent = (i / 24) * Math.abs(weeklyFlow) * 0.4 * trend;
      return 50 + noise + trendComponent;
    });
  }, [weeklyInsights, weeklyFlow, isFlowPositive]);

  const handleTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExpanded(!isExpanded);
  };

  const totalReceivedUSD = weeklyInsights?.totalReceivedUSD ?? 0;
  const totalSentUSD = weeklyInsights?.totalSentUSD ?? 0;
  const netUSD = weeklyInsights?.netUSD ?? 0;
  const period = weeklyInsights?.period ?? "";

  return (
    <View>
      <MotiView
        animate={{ scale: isExpanded ? 0.98 : 1 }}
        transition={{ type: "timing", duration: 150 }}
      >
        <TouchableOpacity
          onPress={handleTap}
          activeOpacity={0.9}
          className="p-6 rounded-2xl bg-white/5 border border-white/10"
        >
          <View className="flex-row items-center justify-between">
            <SparklineChart
              data={splineData}
              color={COLORS.accent}
              fillOpacity={0.15}
              showEndPoint={true}
            />

            <View className="items-end ml-4">
              <Text
                className="text-2xl font-bold font-mono mb-2"
                style={{
                  color: COLORS.bitcoinOrange,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {isFlowPositive ? "+" : ""}
                {weeklyFlow.toFixed(0)}%
              </Text>
              <Text
                className="text-xs uppercase text-white/80"
                style={{ letterSpacing: 1.2 }}
              >
                Weekly Flow
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </MotiView>

      {isExpanded && (
        <MotiView
          from={{ opacity: 0, translateY: -10 }}
          animate={{ opacity: 1, translateY: 0 }}
          exit={{ opacity: 0, translateY: -10 }}
          transition={{ type: "timing", duration: 150 }}
          className="mt-3"
        >
          <View className="p-6 rounded-2xl bg-white/5 border border-white/10 gap-5">
            {period ? (
              <Text className="text-[10px] uppercase text-white/30 tracking-widest font-mono">
                {period}
              </Text>
            ) : null}

            <View className="flex-row gap-3">
              <View className="flex-1 p-3 gap-1 rounded-xl border border-white/10">
                <View className="flex-row items-center gap-2 mb-1">
                  <ArrowDownLeft size={12} color={COLORS.accent} />
                  <Text
                    className="text-xs uppercase text-white/80"
                    style={{ letterSpacing: 1.2 }}
                  >
                    Received
                  </Text>
                </View>
                <Text
                  className="text-lg font-semibold"
                  style={{
                    color: COLORS.accent,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  ${totalReceivedUSD.toFixed(2)}
                </Text>
              </View>

              <View className="flex-1 p-3 gap-1 rounded-xl border border-white/10">
                <View className="flex-row items-center gap-2 mb-1">
                  <ArrowUpRight size={12} color="rgba(255, 255, 255, 0.8)" />
                  <Text
                    className="text-xs uppercase text-white/80"
                    style={{ letterSpacing: 1.2 }}
                  >
                    Sent
                  </Text>
                </View>
                <Text
                  className="text-lg font-semibold text-white/80"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  ${totalSentUSD.toFixed(2)}
                </Text>
              </View>
            </View>

            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: "rgba(255,255,255,0.07)",
                paddingTop: 16,
              }}
              className="flex-row items-center justify-between"
            >
              <Text className="text-[10px] uppercase text-white/30 tracking-widest">
                Net
              </Text>
              <Text
                className="text-xl font-bold font-mono"
                style={{
                  color: netUSD >= 0 ? COLORS.accent : "rgba(255,90,90,0.9)",
                  fontVariant: ["tabular-nums"],
                  letterSpacing: 0.5,
                }}
              >
                {netUSD >= 0 ? "+" : "-"}${Math.abs(netUSD).toFixed(2)}
              </Text>
            </View>
          </View>
        </MotiView>
      )}
    </View>
  );
};
