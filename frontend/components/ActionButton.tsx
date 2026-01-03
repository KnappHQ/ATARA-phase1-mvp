import { BlurView } from "expo-blur";
import React from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}

export default function ActionButton({
  icon,
  label,
  onPress,
}: ActionButtonProps) {
  const scale = useSharedValue(1);
  const borderOpacity = useSharedValue(0.18);

  const wrapperStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(255, 230, 102, ${borderOpacity.value})`,
  }));

  const onPressIn = () => {
    scale.value = withSpring(0.96, { damping: 18, stiffness: 420 });
    borderOpacity.value = withSpring(0.4, { damping: 15, stiffness: 300 });
  };

  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 18, stiffness: 420 });
    borderOpacity.value = withSpring(0.18, { damping: 15, stiffness: 300 });
  };

  return (
    <Animated.View style={wrapperStyle} className="flex-1">
      <AnimatedPressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        <Animated.View
          style={borderStyle}
          className="rounded-xl border overflow-hidden"
        >
          <BlurView
            intensity={40}
            tint="dark"
            style={{
              backgroundColor: "rgba(255,255,255,0.04)",
              borderRadius: 12,
            }}
          >
            <View className="flex-row items-center justify-center gap-3 py-5 px-6">
              {icon}
              <Text className="font-orbitron-medium text-[12px] tracking-hud text-foreground">
                {label}
              </Text>
            </View>
          </BlurView>
        </Animated.View>
      </AnimatedPressable>
    </Animated.View>
  );
}
