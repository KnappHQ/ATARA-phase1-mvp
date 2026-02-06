import { View, Text, TouchableOpacity } from "react-native";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react-native";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import { COLORS } from "@/utils/constants";

// Helper to truncate wallet addresses
const truncateAddress = (address: string) => {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export interface Transaction {
  id: string;
  name: string;
  address?: string;
  date: string;
  amount: string;
  type: "receive" | "send";
  category?: string;
  note?: string;
}

interface ActivityListProps {
  transactions: Transaction[];
  onTransactionPress: (transaction: Transaction) => void;
}

export const ActivityList = ({
  transactions,
  onTransactionPress,
}: ActivityListProps) => {
  return (
    <View className="flex-1">
      <Text
        className="text-sm uppercase text-white/40 mb-3"
        style={{ letterSpacing: 1.2 }}
      >
        Activity
      </Text>
      <View>
        {transactions.map((tx, index) => (
          <MotiView
            key={tx.id}
            from={{ opacity: 0, translateY: 6 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{
              type: "timing",
              delay: index * 15,
              duration: 100,
            }}
          >
            <TouchableOpacity
              onPress={() => {
                onTransactionPress(tx);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              activeOpacity={0.8}
              className="flex-row items-center justify-between py-4 border-b border-white/5"
            >
              <View className="flex-row items-center gap-3">
                <View className="w-8 h-8 items-center justify-center">
                  {tx.type === "receive" ? (
                    <ArrowDownLeft size={16} color={COLORS.accent} />
                  ) : (
                    <ArrowUpRight size={16} color="rgba(255, 255, 255, 0.8)" />
                  )}
                </View>
                <View>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base font-medium text-white/80">
                      @{tx.name.toLowerCase().replace(/\s/g, "")}
                    </Text>
                    {tx.address && (
                      <Text className="text-xs text-platinum-muted/40">
                        {truncateAddress(tx.address)}
                      </Text>
                    )}
                  </View>
                  <Text className="text-xs text-platinum-muted/60">
                    {tx.date}
                  </Text>
                </View>
              </View>
              <Text
                className="text-sm font-medium"
                style={{
                  color:
                    tx.type === "receive"
                      ? COLORS.accent
                      : "rgba(255, 255, 255, 0.8)",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {tx.amount}
              </Text>
            </TouchableOpacity>
          </MotiView>
        ))}
      </View>
    </View>
  );
};
