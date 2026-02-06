import { useState, useRef } from "react";
import { View, Text, Dimensions } from "react-native";
import { MotiView } from "moti";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  runOnJS,
} from "react-native-reanimated";
import { ArrowUp, Check } from "lucide-react-native";
import { COLORS } from "@/utils/constants";
import * as Haptics from "expo-haptics";

interface SwipeToSendProps {
  onComplete: () => void;
  disabled?: boolean;
  label?: string;
}

const CONTAINER_HEIGHT = 200;
const THUMB_SIZE = 64;
const MAX_DRAG = CONTAINER_HEIGHT - THUMB_SIZE - 16;

export const SwipeToSend = ({
  onComplete,
  disabled = false,
  label = "Swipe to Send",
}: SwipeToSendProps) => {
  const [isComplete, setIsComplete] = useState(false);
  const translateY = useSharedValue(0);
  const startY = useSharedValue(0);

  const handleComplete = () => {
    setIsComplete(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(onComplete, 300);
  };

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      const newValue = startY.value + event.translationY;
      translateY.value = Math.max(-MAX_DRAG, Math.min(0, newValue));
    })
    .onEnd((event) => {
      const threshold = -MAX_DRAG * 0.85;

      if (translateY.value <= threshold && !isComplete) {
        translateY.value = withSpring(-MAX_DRAG);
        runOnJS(handleComplete)();
      } else if (!isComplete) {
        translateY.value = withSpring(0);
      }
    })
    .enabled(!disabled && !isComplete);

  const thumbStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      translateY.value,
      [0, -MAX_DRAG],
      [0, 1],
      Extrapolation.CLAMP,
    );

    return {
      transform: [
        { translateY: translateY.value },
        { scale: interpolate(progress, [0, 1], [1, 1.1]) },
      ],
    };
  });

  const arrowOpacity = useAnimatedStyle(() => {
    const progress = interpolate(
      translateY.value,
      [0, -MAX_DRAG],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: interpolate(progress, [0, 0.8, 1], [1, 1, 0]),
    };
  });

  const checkOpacity = useAnimatedStyle(() => {
    const progress = interpolate(
      translateY.value,
      [0, -MAX_DRAG],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: interpolate(progress, [0, 0.8, 1], [0, 0, 1]),
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      translateY.value,
      [0, -MAX_DRAG],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: progress * 0.2,
    };
  });

  if (disabled) {
    return (
      <View
        className="w-full rounded-2xl items-center justify-center"
        style={{
          height: CONTAINER_HEIGHT,
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.1)",
          opacity: 0.5,
        }}
      >
        <Text className="text-sm" style={{ color: "rgba(255, 255, 255, 0.4)" }}>
          {label}
        </Text>
      </View>
    );
  }

  return (
    <View
      className="relative w-full rounded-2xl overflow-hidden"
      style={{
        height: CONTAINER_HEIGHT,
        backgroundColor: "rgba(245, 245, 240, 0.02)",
        borderWidth: 1,
        borderColor: "rgba(245, 245, 240, 0.15)",
      }}
    >
      {/* Background glow */}
      <Animated.View
        className="absolute inset-0 rounded-2xl"
        style={[
          {
            backgroundColor: "rgba(245, 245, 240, 0.05)",
          },
          glowStyle,
        ]}
      />

      {/* Track lines */}
      <View className="absolute inset-x-0 top-4 bottom-20 flex-col items-center justify-between opacity-20">
        {[...Array(5)].map((_, i) => (
          <View
            key={i}
            className="w-8 h-0.5 rounded-full"
            style={{ backgroundColor: "rgba(245, 245, 240, 0.2)" }}
          />
        ))}
      </View>

      {/* Label */}
      <Animated.View
        className="absolute top-6 inset-x-0 items-center"
        style={arrowOpacity}
      >
        <Text
          className="text-sm uppercase"
          style={{
            color: "rgba(245, 245, 240, 0.5)",
            letterSpacing: 1.5,
          }}
        >
          {label}
        </Text>
      </Animated.View>

      {/* Success indicator */}
      <Animated.View
        className="absolute top-1/2 left-1/2 items-center justify-center"
        style={[
          checkOpacity,
          {
            width: 64,
            height: 64,
            marginLeft: -32,
            marginTop: -32,
          },
        ]}
      >
        <View
          className="w-16 h-16 rounded-full items-center justify-center"
          style={{
            backgroundColor: "rgba(245, 245, 240, 0.15)",
            borderWidth: 1,
            borderColor: "rgba(245, 245, 240, 0.3)",
          }}
        >
          <Check size={32} color={COLORS.platinum} />
        </View>
      </Animated.View>

      {/* Draggable thumb */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          className="absolute bottom-2 left-1/2 items-center justify-center"
          style={[
            thumbStyle,
            {
              width: THUMB_SIZE,
              height: THUMB_SIZE,
              marginLeft: -THUMB_SIZE / 2,
            },
          ]}
        >
          <View
            className="w-16 h-16 rounded-full items-center justify-center"
            style={{
              backgroundColor: COLORS.platinum,
              shadowColor: COLORS.platinum,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <Animated.View style={arrowOpacity}>
              <ArrowUp size={24} color={COLORS.black} />
            </Animated.View>
            <Animated.View className="absolute" style={checkOpacity}>
              <Check size={24} color={COLORS.black} />
            </Animated.View>
          </View>

          {/* Pulsing ring hint */}
          {!isComplete && (
            <MotiView
              className="absolute rounded-full"
              from={{ scale: 1, opacity: 0.4 }}
              animate={{ scale: 1.3, opacity: 0 }}
              transition={{
                type: "timing",
                duration: 1500,
                loop: true,
              }}
              style={{
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                borderWidth: 2,
                borderColor: "rgba(245, 245, 240, 0.25)",
              }}
            />
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
};
