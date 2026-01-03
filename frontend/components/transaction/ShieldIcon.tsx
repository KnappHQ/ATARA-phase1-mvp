import { Check, Shield } from "lucide-react-native";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

interface ShieldIconProps {
  visible: boolean;
}

export const ShieldIcon = ({ visible }: ShieldIconProps) => {
  const shieldScale = useSharedValue(0);
  const shieldShake = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      shieldScale.value = withSpring(1, {
        damping: 20,
        stiffness: 200,
      });

      shieldShake.value = withDelay(
        400,
        withSequence(
          withTiming(-6, { duration: 50 }),
          withTiming(6, { duration: 50 }),
          withTiming(-4, { duration: 50 }),
          withTiming(4, { duration: 50 }),
          withTiming(-2, { duration: 50 }),
          withTiming(0, { duration: 50 })
        )
      );
    }
  }, [visible]);

  const shieldContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: shieldScale.value },
      { translateX: shieldShake.value },
    ],
    opacity: shieldScale.value,
  }));

  return (
    <Animated.View style={shieldContainerStyle}>
      <View
        className="w-20 h-20 rounded-full bg-champagne/20 items-center justify-center border border-champagne/40"
        style={{
          boxShadow:
            "0 0 30px rgba(255, 230, 102, 0.3), 0 0 60px rgba(255, 230, 102, 0.2)",
        }}
      >
        <Shield size={32} color="#FFE666" strokeWidth={1.5} />
        <View className="absolute">
          <Check size={20} color="#FFE666" strokeWidth={3} />
        </View>
      </View>
    </Animated.View>
  );
};
