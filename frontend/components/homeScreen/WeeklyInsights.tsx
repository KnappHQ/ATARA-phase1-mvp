import { useState, useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MotiView } from "moti";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { SparklineChart } from "./SparklineChart";
import { COLORS } from "@/utils/constants";

const TOTAL_SENT = 550;
const TOTAL_RECEIVED = 600;

export const WeeklyInsights = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  const weeklyFlow = useMemo(() => {
    const received: number = TOTAL_RECEIVED;
    const sent: number = TOTAL_SENT;
    if (received === 0 && sent === 0) return 0;
    const diff = received - sent;
    const total = Math.max(received, sent);
    return total > 0 ? (diff / total) * 100 : 0;
  }, []);

  const isFlowPositive = weeklyFlow >= 0;

  // Generate smooth spline data points
  const splineData = useMemo(() => {
    const points = [];
    const trend = isFlowPositive ? 1 : -1;
    for (let i = 0; i <= 24; i++) {
      const noise = Math.sin(i * 0.6) * 6 + Math.cos(i * 0.9) * 4;
      const trendComponent = (i / 24) * Math.abs(weeklyFlow) * 0.4 * trend;
      points.push(50 + noise + trendComponent);
    }
    return points;
  }, [weeklyFlow, isFlowPositive]);

  const handleTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExpanded(!isExpanded);
  };

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
          <View className="p-6 rounded-2xl bg-white/5 border border-white/10">
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
                  ${TOTAL_RECEIVED}
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
                  ${TOTAL_SENT}
                </Text>
              </View>
            </View>
          </View>
        </MotiView>
      )}
    </View>
  );
};
