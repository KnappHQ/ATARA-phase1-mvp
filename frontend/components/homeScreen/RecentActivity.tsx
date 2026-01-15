import { useRecentActivity } from "@/hooks/useRecentActivity";
import { useAuthStore } from "@/stores/useAuthStore";
import { UiTransaction } from "@/types/transaction";
import { ArrowDownLeft, ArrowUpRight, History } from "lucide-react-native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const TransactionItem = ({
  tx,
  index,
}: {
  tx: UiTransaction;
  index: number;
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  const handlePressIn = () => {
    scale.value = withTiming(0.99, { duration: 150 });
    opacity.value = withTiming(0.85, { duration: 150 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 200 });
    opacity.value = withTiming(1, { duration: 200 });
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
      <AnimatedPressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={animatedStyle}
        className="flex-row items-center justify-between py-3 px-1 border-b border-champagne/10"
      >
        <View className="flex-row items-center gap-3">
          <View
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              tx.type === "receive"
                ? "bg-champagne/10 border border-champagne/20"
                : "bg-muted/50 border border-muted"
            }`}
          >
            {tx.type === "receive" ? (
              <ArrowDownLeft size={16} color="#F5D580" />
            ) : (
              <ArrowUpRight size={16} color="#808080" />
            )}
          </View>
          <View>
            <Text className="font-rajdhani-semibold text-base text-foreground tracking-wide">
              {tx.name}
            </Text>
            <Text className="font-rajdhani-medium text-sm text-muted-foreground">
              {tx.date}
            </Text>
          </View>
        </View>
        <Text
          className={`font-rajdhani-semibold text-base tracking-wide ${
            tx.type === "receive" ? "text-champagne" : "text-muted-foreground"
          }`}
        >
          {tx.amount}
        </Text>
      </AnimatedPressable>
    </Animated.View>
  );
};

export const RecentActivity = () => {
  const { user } = useAuthStore();
  const { recentTransactions, isLoading } = useRecentActivity(user?.id);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center py-8">
        <ActivityIndicator color="#FFE666" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <Text className="font-orbitron-medium text-sm text-champagne/60 uppercase tracking-widest mb-4">
        Recent Activity
      </Text>

      {recentTransactions.length === 0 ? (
        <Text className="text-muted-foreground font-rajdhani text-center mt-4">
          No recent activity
        </Text>
      ) : (
        <View className="space-y-1">
          {recentTransactions.map((tx, index) => (
            <TransactionItem key={tx.id} tx={tx} index={index} />
          ))}
        </View>
      )}
    </View>
  );
};
