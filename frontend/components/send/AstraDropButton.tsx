import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "@/utils/constants";

interface AstraDropButtonProps {
  onPress: () => void;
}

export const AstraDropButton = ({ onPress }: AstraDropButtonProps) => {
  return (
    <Pressable onPress={onPress} className="w-full mb-6 active:opacity-80">
      <LinearGradient
        colors={[
          `${COLORS.primary}33`, // 20% opacity
          `${COLORS.primary}1A`, // 10% opacity
          `${COLORS.primary}33`, // 20% opacity
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        className="p-4 flex-row items-center justify-center gap-3"
        style={{
          borderWidth: 1,
          borderColor: `${COLORS.primary}4D`, // 30% opacity
          borderRadius: 16,
        }}
      >
        <View className="w-10 h-10 rounded-full items-center justify-center bg-primary/30">
          <Text className="text-lg">📡</Text>
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-primary">
            ATARA Drop
          </Text>
          <Text className="text-sm text-muted">
            Find nearby users to send instantly
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
};
