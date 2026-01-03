import { LinearGradient } from "expo-linear-gradient";
import { Pressable, Text } from "react-native";

interface QuickContactButtonProps {
  name: string;
  avatar: string;
  gradientColors: [string, string];
  onPress: () => void;
  delay?: number;
}

export const QuickContactButton = ({
  name,
  avatar,
  gradientColors,
  onPress,
}: QuickContactButtonProps) => {
  return (
    <Pressable
      onPress={onPress}
      className="flex-col items-center gap-2 min-w-[64px]"
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text className="text-base font-rajdhani-bold text-white">
          {avatar}
        </Text>
      </LinearGradient>
      <Text className="text-xs text-muted-foreground">{name}</Text>
    </Pressable>
  );
};
