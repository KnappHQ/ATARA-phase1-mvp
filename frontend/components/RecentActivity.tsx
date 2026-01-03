import { ArrowDownLeft, ArrowUpRight } from "lucide-react-native";
import { Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

interface Transaction {
  id: number;
  name: string;
  date: string;
  amount: string;
  type: "receive" | "send";
}

const transactions: Transaction[] = [
  {
    id: 1,
    name: "Bitcoin Purchase",
    date: "Today, 2:34 PM",
    amount: "+0.024 BTC",
    type: "receive",
  },
  {
    id: 2,
    name: "Sent to @Marcus",
    date: "Yesterday",
    amount: "-$150.00",
    type: "send",
  },
  {
    id: 3,
    name: "Ethereum Swap",
    date: "Dec 14",
    amount: "+1.2 ETH",
    type: "receive",
  },
  {
    id: 4,
    name: "USDC Transfer",
    date: "Dec 13",
    amount: "-$500.00",
    type: "send",
  },
  {
    id: 5,
    name: "Solana Reward",
    date: "Dec 12",
    amount: "+2.5 SOL",
    type: "receive",
  },
];

export const RecentActivity = () => {
  return (
    <View className="flex-1">
      <Text className="font-orbitron-medium text-sm text-champagne/60 uppercase tracking-widest mb-4">
        Recent Activity
      </Text>
      <View className="space-y-1">
        {transactions.map((tx, index) => (
          <Animated.View
            key={tx.id}
            entering={FadeInDown.delay(index * 50).duration(300)}
          >
            <TouchableOpacity
              activeOpacity={0.7}
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
                  tx.type === "receive"
                    ? "text-champagne"
                    : "text-muted-foreground"
                }`}
              >
                {tx.amount}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    </View>
  );
};
