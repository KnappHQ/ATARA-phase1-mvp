import { LinearGradient } from "expo-linear-gradient";
import { ArrowDownLeft } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable);

interface EmptyVaultCardProps {
  onDeposit: () => void;
}

export const EmptyVaultCard = ({ onDeposit }: EmptyVaultCardProps) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const scale = useSharedValue(1);

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

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(0.96, { damping: 18, stiffness: 420 });
  };

  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 18, stiffness: 420 });
  };

  return (
    <View className="relative overflow-hidden rounded-xl border border-champagne/20 bg-[rgba(255,255,255,0.03)] shadow-lg">
      <View className="absolute inset-0"></View>

      <View className="relative z-10 p-6 items-center">
        <Text className="font-orbitron-semibold text-2xl text-champagne mb-2 tracking-wide">
          Wallet empty
        </Text>

        <Text className="font-sans text-base text-muted-foreground mb-6 text-center">
          Secure your first assets to start tracking your wealth
        </Text>

        <Reanimated.View style={buttonStyle}>
          <View
            className="rounded-xl overflow-hidden"
            style={{
              boxShadow:
                "0 0 20px rgba(245, 215, 101, 0.4), 0 0 40px rgba(245, 215, 101, 0.2)",
            }}
          >
            <LinearGradient
              colors={[
                "hsl(48, 80%, 55%)",
                "hsl(48, 80%, 55%)",
                "hsl(48, 80%, 55%)",
                "hsl(48, 80%, 55%)",
                "hsl(48, 80%, 55%)",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              locations={[0, 0.4, 0.48, 0.5, 0.52, 0.6, 1]}
              className="rounded-xl"
              style={{ position: "relative" }}
            >
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
                    "rgba(255, 255, 255, 0)",
                    "rgba(255, 255, 255, 0)",
                    "rgba(255, 255, 255, 0.15)",
                    "rgba(255, 255, 255, 0.4)",
                    "rgba(255, 255, 255, 0.6)",
                    "rgba(255, 255, 255, 0.4)",
                    "rgba(255, 255, 255, 0.15)",
                    "rgba(255, 255, 255, 0)",
                    "rgba(255, 255, 255, 0)",
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

              <AnimatedPressable
                onPress={onDeposit}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                className="px-12 py-4 rounded-xl flex-row items-center justify-center gap-2"
              >
                <ArrowDownLeft size={18} color="#0D080F" />
                <Text className="font-orbitron-bold text-[14px] tracking-hud uppercase text-[#0D080F]">
                  Deposit Now
                </Text>
              </AnimatedPressable>
            </LinearGradient>
          </View>
        </Reanimated.View>
      </View>
    </View>
  );
};
