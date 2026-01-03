import { ChevronDown } from "lucide-react-native";
import { ReactNode, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { AnimatedCounter } from "./AnimatedCounter";

interface BalanceRevealProps {
  balance: number;
  changeAmount: string;
  changePercentage: string;
  children: ReactNode;
  onRevealChange?: (revealed: boolean) => void;
}

export const BalanceReveal = ({
  balance,
  changeAmount,
  changePercentage,
  children,
  onRevealChange,
}: BalanceRevealProps) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const translateY = useSharedValue(0);
  const startY = useSharedValue(0);

  const updateRevealState = (revealed: boolean) => {
    setIsRevealed(revealed);
    onRevealChange?.(revealed);
  };

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      const newValue = startY.value + event.translationY;
      translateY.value = Math.max(0, Math.min(80, newValue));
    })
    .onEnd((event) => {
      const shouldReveal =
        (translateY.value > 60 && event.velocityY > 0) ||
        (event.velocityY > 300 && translateY.value > 30);
      const shouldHide =
        (translateY.value < 20 && event.velocityY < 0) ||
        (event.velocityY < -200 && translateY.value < 60);

      if (shouldReveal) {
        translateY.value = withTiming(80, { duration: 300 });
        runOnJS(updateRevealState)(true);
      } else if (shouldHide) {
        translateY.value = withTiming(0, { duration: 300 });
        runOnJS(updateRevealState)(false);
      } else {
        translateY.value = withTiming(isRevealed ? 80 : 0, { duration: 300 });
      }
    });

  const toggleReveal = () => {
    const newState = !isRevealed;
    translateY.value = withTiming(newState ? 80 : 0, { duration: 300 });
    setIsRevealed(newState);
  };

  const handleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const balanceStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateY.value,
      [0, 80],
      [0, 1],
      Extrapolation.CLAMP
    );
    const translateYValue = interpolate(
      translateY.value,
      [0, 80],
      [-30, 0],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ translateY: translateYValue }],
    };
  });

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${interpolate(
          translateY.value,
          [0, 80],
          [0, 180],
          Extrapolation.CLAMP
        )}deg`,
      },
    ],
  }));

  const contentPushStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value * 0.75 }],
  }));

  const formattedBalance = balance.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return (
    <>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={handleStyle}>
          <TouchableOpacity
            onPress={toggleReveal}
            activeOpacity={1}
            className="pt-8 pb-4 flex-col items-center gap-2"
          >
            <View className="w-10 h-1 rounded-full bg-champagne/30" />
            <Animated.View style={chevronStyle}>
              <ChevronDown size={20} color="rgba(245, 213, 128, 0.5)" />
            </Animated.View>
          </TouchableOpacity>

          <Animated.View style={balanceStyle} className="px-6 pt-6 pb-10">
            <Text className="font-orbitron-medium text-xs font-semibold tracking-hud-wide text-champagne uppercase mb-6 text-center">
              Total Liquidity
            </Text>

            {isRevealed ? (
              <View className="items-center mb-6">
                <AnimatedCounter
                  value={balance}
                  prefix="$"
                  decimals={2}
                  duration={1500}
                  className="font-orbitron-medium text-champagne"
                  style={{ fontSize: 45 }}
                  glowing
                />
              </View>
            ) : (
              <View className="items-center mb-3 flex-row">
                <Text
                  className="font-orbitron-medium text-champagne"
                  style={{ fontSize: 45 }}
                >
                  ${formattedBalance}
                </Text>
                <Text
                  className="font-orbitron-medium text-champagne/60"
                  style={{ fontSize: 32 }}
                >
                  .00
                </Text>
              </View>
            )}

            {isRevealed && (
              <Text className="font-rajdhanimedium text-base text-emerald-400/90 tracking-widest text-center">
                {changeAmount} ({changePercentage})
              </Text>
            )}
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      <Animated.View style={contentPushStyle} className="flex-1 px-6 mt-4">
        {children}
      </Animated.View>
    </>
  );
};
