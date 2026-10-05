import { View, Text } from "react-native";
import { MotiView } from "moti";

export const BalanceSkeleton = () => (
  <View className="items-center">
    <Text
      className="text-xs uppercase text-platinum-muted mb-4 text-center"
      style={{ letterSpacing: 2.5 }}
    >
      Balance
    </Text>

    <MotiView
      from={{ opacity: 0.3 }}
      animate={{ opacity: 0.6 }}
      transition={{ type: "timing", duration: 1000, loop: true }}
      style={{
        width: 200,
        height: 48,
        backgroundColor: "rgba(255, 255, 255, 0.08)",
        borderRadius: 12,
        marginBottom: 12,
      }}
    />

    <MotiView
      from={{ opacity: 0.3 }}
      animate={{ opacity: 0.6 }}
      transition={{ type: "timing", duration: 1000, loop: true, delay: 100 }}
      style={{
        width: 120,
        height: 16,
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        borderRadius: 8,
      }}
    />
  </View>
);
