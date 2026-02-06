import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const PARTICLE_COUNT = 24;
const DOOR_DURATION = 800;
const DOOR_DELAY = 400;
const FLASH_DELAY = 800;
const CHAMPAGNE_COLOR = "#FFE666";

const easeOut = Easing.bezier(0.22, 1, 0.36, 1);

const particleData = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  targetX: (Math.random() - 0.5) * 600,
  targetY: (Math.random() - 0.5) * 600,
  delay: i * 20,
}));

interface VaultOpeningAnimationProps {
  onComplete?: () => void;
}

export const VaultOpeningAnimation = ({
  onComplete,
}: VaultOpeningAnimationProps) => {
  const orbScale = useSharedValue(0);
  const orbOpacity = useSharedValue(0);
  const doorsY = useSharedValue(0);
  const flashOpacity = useSharedValue(0);

  const particles = particleData.map(() => ({
    x: useSharedValue(0),
    y: useSharedValue(0),
    opacity: useSharedValue(1),
  }));

  useEffect(() => {
    orbScale.value = withSequence(
      withTiming(1, { duration: 400, easing: easeOut }),
      withTiming(50, { duration: 800, easing: easeOut })
    );
    orbOpacity.value = withSequence(
      withTiming(0.6, { duration: 400 }),
      withTiming(0, { duration: 800 })
    );

    doorsY.value = withDelay(
      DOOR_DELAY,
      withTiming(1, { duration: DOOR_DURATION, easing: easeOut })
    );

    particles.forEach((particle, i) => {
      const data = particleData[i];
      particle.x.value = withDelay(
        300 + data.delay,
        withTiming(data.targetX, {
          duration: 1000,
          easing: Easing.out(Easing.quad),
        })
      );
      particle.y.value = withDelay(
        300 + data.delay,
        withTiming(data.targetY, {
          duration: 1000,
          easing: Easing.out(Easing.quad),
        })
      );
      particle.opacity.value = withDelay(
        300 + data.delay,
        withTiming(0, { duration: 800 })
      );
    });

    flashOpacity.value = withDelay(
      FLASH_DELAY,
      withSequence(
        withTiming(0.6, { duration: 300 }),
        withTiming(0, { duration: 300 }, (finished) => {
          if (finished && onComplete) {
            runOnJS(onComplete)();
          }
        })
      )
    );
  }, []);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
    opacity: orbOpacity.value,
  }));

  const topDoorStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -doorsY.value * 1000 }],
  }));

  const bottomDoorStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: doorsY.value * 1000 }],
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  return (
    <View className="absolute inset-0 z-50 items-center justify-center">
      <Animated.View
        style={[
          topDoorStyle,
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "50%",
            backgroundColor: "#070609",
          },
        ]}
        pointerEvents="none"
      />

      <Animated.View
        style={[
          bottomDoorStyle,
          {
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "50%",
            backgroundColor: "#070609",
          },
        ]}
        pointerEvents="none"
      />

      <Animated.View style={orbStyle} className="absolute">
        <LinearGradient
          colors={[
            "rgba(255, 230, 102, 0.3)",
            "rgba(255, 230, 102, 0.15)",
            "rgba(255, 230, 102, 0)",
          ]}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            shadowColor: CHAMPAGNE_COLOR,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.3,
            shadowRadius: 30,
          }}
        />
      </Animated.View>

      {particles.map((particle, i) => {
        const particleStyle = useAnimatedStyle(() => ({
          transform: [
            { translateX: particle.x.value },
            { translateY: particle.y.value },
          ],
          opacity: particle.opacity.value,
        }));

        return (
          <Animated.View
            key={i}
            style={[
              particleStyle,
              {
                position: "absolute",
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: CHAMPAGNE_COLOR,
                shadowColor: CHAMPAGNE_COLOR,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: 10,
              },
            ]}
          />
        );
      })}

      <Animated.View
        style={[
          flashStyle,
          {
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(255, 230, 102, 0.2)",
            zIndex: 60,
          },
        ]}
        pointerEvents="none"
      />
    </View>
  );
};
