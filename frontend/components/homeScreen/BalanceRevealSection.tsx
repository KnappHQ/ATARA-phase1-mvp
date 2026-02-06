import { useState, ReactNode } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { ChevronDown, EyeOff } from "lucide-react-native";
import { MotiView } from "moti";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { AnimatedCounter } from "./AnimatedCounter";

interface BalanceRevealSectionProps {
  children?: ReactNode;
}

export const BalanceRevealSection = ({
  children,
}: BalanceRevealSectionProps) => {
  const [isBalanceRevealed, setIsBalanceRevealed] = useState(false);
  const translateY = useSharedValue(0);
  const startY = useSharedValue(0);

  // Dummy data
  const totalBalance = 24500;
  const stealthMode = false;

  const updateRevealState = (revealed: boolean) => {
    setIsBalanceRevealed(revealed);
  };

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      const newValue = startY.value + event.translationY;
      translateY.value = Math.max(0, Math.min(100, newValue));
    })
    .onEnd((event) => {
      const shouldReveal = translateY.value > 60 || event.velocityY > 300;
      const shouldHide = translateY.value < 30 && event.velocityY < -200;

      if (shouldReveal) {
        translateY.value = withTiming(80, { duration: 300 });
        runOnJS(updateRevealState)(true);
      } else if (shouldHide) {
        translateY.value = withTiming(0, { duration: 300 });
        runOnJS(updateRevealState)(false);
      } else {
        translateY.value = withTiming(isBalanceRevealed ? 80 : 0, {
          duration: 300,
        });
      }
    });

  const toggleReveal = () => {
    const newState = !isBalanceRevealed;
    translateY.value = withTiming(newState ? 80 : 0, { duration: 300 });
    setIsBalanceRevealed(newState);
  };

  const handleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${interpolate(
          translateY.value,
          [0, 80],
          [0, 180],
          Extrapolation.CLAMP,
        )}deg`,
      },
    ],
  }));

  const balanceStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [0, 80],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          translateY.value,
          [0, 80],
          [-30, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value * 0.75 }],
  }));

  return (
    <>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={handleStyle}>
          <TouchableOpacity
            onPress={toggleReveal}
            activeOpacity={1}
            className="pt-8 pb-4 flex-col items-center gap-2"
          >
            <View className="w-10 h-0.5 rounded-full bg-white/20" />
            <Animated.View style={arrowStyle}>
              <ChevronDown size={20} color="rgba(255, 255, 255, 0.4)" />
            </Animated.View>
          </TouchableOpacity>

          <Animated.View style={balanceStyle} className="pt-6 pb-8">
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: isBalanceRevealed ? 1 : 0 }}
              transition={{ type: "timing", delay: 100 }}
            >
              <Text
                className="text-xs uppercase text-platinum-muted mb-4 text-center"
                style={{ letterSpacing: 2.5 }}
              >
                Total Liquidity
              </Text>
            </MotiView>

            {stealthMode ? (
              <View className="flex-row items-center justify-center gap-3 mb-3">
                <EyeOff size={24} color="rgba(255, 255, 255, 0.3)" />
                <Text className="text-5xl font-bold text-white/15">••••••</Text>
              </View>
            ) : isBalanceRevealed ? (
              <View className="items-center mb-3">
                <AnimatedCounter
                  value={totalBalance}
                  prefix="$"
                  decimals={2}
                  duration={1500}
                  className="text-5xl font-bold text-white"
                />
              </View>
            ) : (
              <Text className="text-5xl font-bold text-white mb-3 text-center">
                ${totalBalance.toLocaleString()}
                <Text className="text-3xl text-white/40">.00</Text>
              </Text>
            )}

            {!stealthMode && (
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{
                  opacity: isBalanceRevealed ? 1 : 0,
                  translateY: isBalanceRevealed ? 0 : 10,
                }}
                transition={{ type: "timing", delay: 400 }}
              >
                <Text
                  className="text-sm font-semibold text-center"
                  style={{ color: "#F7931A" }}
                >
                  +$1,240.50 (5.3%)
                </Text>
              </MotiView>
            )}
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {children && (
        <Animated.View style={contentStyle} className="flex-1">
          {children}
        </Animated.View>
      )}
    </>
  );
};
