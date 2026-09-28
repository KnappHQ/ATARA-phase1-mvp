import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring,
} from "react-native-reanimated";
import { ArrowRight, Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { COLORS } from "@/utils/constants";

interface SwipeToSendProps {
  onComplete: () => void;
  disabled?: boolean;
  label?: string;
  resetKey?: number;
}

const HEIGHT = 80;
const THUMB = 64;
const INSET = 8;

export const SwipeToSend = ({
  onComplete, disabled = false, label = "Slide right to send", resetKey = 0,
}: SwipeToSendProps) => {
  const [isComplete, setIsComplete] = useState(false);
  const [hasLayout, setHasLayout] = useState(false);
  const translateX = useSharedValue(0);
  const maxDrag = useSharedValue(0);
  const completed = useSharedValue(false);
  const completionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    setIsComplete(false);
    completed.value = false;
    translateX.value = withSpring(0);
    return () => {
      if (completionTimer.current) clearTimeout(completionTimer.current);
    };
  }, [resetKey, completed, translateX]);

  const handleComplete = () => {
    setIsComplete(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    completionTimer.current = setTimeout(() => {
      completionTimer.current = null;
      onCompleteRef.current();
    }, 300);
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX(12)
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      translateX.value = Math.max(0, Math.min(maxDrag.value, event.translationX));
    })
    .onEnd(() => {
      if (maxDrag.value > 0 && translateX.value >= maxDrag.value * 0.85 && !completed.value) {
        completed.value = true;
        translateX.value = withSpring(maxDrag.value);
        runOnJS(handleComplete)();
      } else if (!completed.value) {
        translateX.value = withSpring(0);
      }
    })
    .enabled(!disabled && !isComplete && hasLayout);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const fillStyle = useAnimatedStyle(() => ({
    width: THUMB + INSET * 2 + translateX.value,
  }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      maxDrag.value > 0 ? translateX.value / maxDrag.value : 0,
      [0, 0.8, 1], [1, 0.3, 0], Extrapolation.CLAMP,
    ),
  }));

  if (disabled) {
    return (
      <View className="w-full rounded-2xl items-center justify-center" style={{
        height: HEIGHT, backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", opacity: 0.5,
      }}>
        <Text className="text-sm text-center px-4" style={{ color: COLORS.platinum }}>
          {label}
        </Text>
      </View>
    );
  }

  return (
    <View
      className="relative w-full rounded-2xl overflow-hidden justify-center"
      onLayout={(event) => {
        const distance = Math.max(0, event.nativeEvent.layout.width - THUMB - INSET * 2);
        maxDrag.value = distance;
        setHasLayout(distance > 0);
      }}
      style={{
        height: HEIGHT, backgroundColor: "rgba(245,245,240,0.04)",
        borderWidth: 1, borderColor: "rgba(245,245,240,0.2)",
      }}
    >
      <Animated.View className="absolute left-0 top-0 bottom-0 rounded-2xl" style={[
        { backgroundColor: "rgba(245,245,240,0.12)" }, fillStyle,
      ]} />
      <Animated.View
        pointerEvents="none"
        className="absolute inset-0 justify-center items-center"
        style={[{ paddingLeft: THUMB + INSET * 2 }, labelStyle]}
      >
        <Text numberOfLines={1} className="text-sm font-medium text-center" style={{
          color: COLORS.platinum, letterSpacing: 0.4,
        }}>
          {label}
        </Text>
      </Animated.View>
      <GestureDetector gesture={panGesture}>
        <Animated.View
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Slide from left to right to review the recipient"
          accessibilityActions={[{ name: "activate", label: "Review recipient" }]}
          onAccessibilityAction={() => {
            if (!disabled && !isComplete && hasLayout && !completed.value) {
              completed.value = true;
              translateX.value = withSpring(maxDrag.value);
              handleComplete();
            }
          }}
          className="absolute items-center justify-center"
          style={[thumbStyle, { left: INSET, width: THUMB, height: THUMB }]}
        >
          <View className="w-16 h-16 rounded-xl items-center justify-center" style={{
            backgroundColor: COLORS.platinum,
          }}>
            {isComplete
              ? <Check size={26} color={COLORS.black} />
              : <ArrowRight size={26} color={COLORS.black} />}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};
