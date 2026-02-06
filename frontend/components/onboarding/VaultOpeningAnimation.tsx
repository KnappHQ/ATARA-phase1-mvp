import { MotiView } from "moti";
import { View } from "react-native";

export const VaultOpeningAnimation = () => {
  return (
    <View className="absolute inset-0 bg-black items-center justify-center z-50">
      <MotiView
        from={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1, 50], opacity: [0, 1, 0] }}
        transition={{
          type: "timing",
          duration: 600,
        }}
        className="w-4 h-4 rounded-full bg-white"
      />
    </View>
  );
};
