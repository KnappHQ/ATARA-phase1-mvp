import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

interface AstraDropButtonProps {
  onPress: () => void;
}

export const AstraDropButton = ({ onPress }: AstraDropButtonProps) => {
  return (
    <Animated.View entering={FadeInDown} className="mb-6">
      <Pressable
        onPress={onPress}
        className="w-full rounded-2xl overflow-hidden active:opacity-90 bg-champagne/[0.08] border border-champagne/20"
      >
        <View className="p-5 flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-full items-center justify-center bg-champagne/[0.15]">
            <Text className="text-lg">📡</Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-rajdhani-semibold text-champagne">
              Astrâ Drop
            </Text>
            <Text className="text-xs text-muted-foreground mt-0.5">
              Find nearby users to send instantly
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};
