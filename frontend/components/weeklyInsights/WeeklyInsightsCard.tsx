import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, Animated, Easing } from "react-native";
import { MotiView } from "moti";
import { Zap } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SparklineChart } from "./SparklineChart";
import { CHART_DATA } from "./mockData";

export const WeeklyInsightsCard = ({ onPress }: { onPress: () => void }) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        }),
        Animated.delay(800),
      ])
    );
    shimmer.start();
    return () => shimmer.stop();
  }, []);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-500, 500],
  });

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <MotiView
          animate={{
            scale: pressed ? 0.97 : 1,
          }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 20,
          }}
        >
          <View className="relative overflow-hidden rounded-xl border border-champagne/20 bg-[rgba(255,255,255,0.03)] shadow-lg">
            <View className="absolute inset-0">
              <Animated.View
                style={{
                  position: "absolute",
                  top: -50,
                  left: -100,
                  right: -100,
                  bottom: -50,
                  transform: [{ translateX }, { rotate: "-25deg" }],
                }}
                pointerEvents="none"
              >
                <LinearGradient
                  colors={[
                    "rgba(229, 210, 166, 0)",
                    "rgba(229, 210, 166, 0)",
                    "rgba(229, 210, 166, 0.08)",
                    "rgba(229, 210, 166, 0.15)",
                    "rgba(229, 210, 166, 0.2)",
                    "rgba(229, 210, 166, 0.15)",
                    "rgba(229, 210, 166, 0.08)",
                    "rgba(229, 210, 166, 0)",
                    "rgba(229, 210, 166, 0)",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  locations={[0, 0.3, 0.4, 0.45, 0.5, 0.55, 0.6, 0.7, 1]}
                  style={{
                    width: "100%",
                    height: "100%",
                  }}
                />
              </Animated.View>
            </View>

            <View className="relative z-10 p-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-xs text-champagne font-orbitron-medium tracking-hud-wide uppercase">
                  ASTRÂ Insight
                </Text>
                <MotiView
                  className="flex-row items-center gap-1"
                  from={{ opacity: 0.5 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    type: "timing",
                    duration: 2000,
                    loop: true,
                    repeatReverse: true,
                  }}
                >
                  <Zap size={12} color="#E5D2A6" />
                  <Text className="text-[8px] font-orbitron-medium text-champagne/70 tracking-wider">
                    TAP::EXPAND
                  </Text>
                </MotiView>
              </View>

              <View className="flex-row items-baseline gap-3 mb-3">
                <Text
                  className="text-4xl font-orbitron-semibold text-champagne-neon tracking-tight"
                  style={{
                    textShadowColor: "rgba(255, 235, 153, 0.6)",
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 20,
                  }}
                >
                  +12.4%
                </Text>
                <View className="px-2 py-0.5 rounded bg-[#E5D2A6]/10 border border-[#E5D2A6]/30">
                  <Text className="text-[9px] font-orbitron text-champagne tracking-wider">
                    MARKET GROWTH
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-2 mb-1">
                <Text className="text-sm font-rajdhani-medium text-white/50">
                  Spent this week:
                </Text>
                <Text className="text-sm font-rajdhani-semibold text-champagne">
                  €0.00
                </Text>
              </View>

              <View className="mt-4">
                <SparklineChart data={CHART_DATA} />
              </View>
            </View>
          </View>
        </MotiView>
      )}
    </Pressable>
  );
};
