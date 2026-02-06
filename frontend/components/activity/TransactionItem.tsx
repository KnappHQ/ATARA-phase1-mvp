import { ArrowDownLeft, ArrowUpRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { MotiView } from "moti";
import { COLORS } from "@/utils/constants";

export interface Transaction {
  id: string;
  name: string;
  address: string;
  date: string;
  time: string;
  amount: string;
  type: "receive" | "send";
  note?: string;
}

interface TransactionItemProps {
  transaction: Transaction;
  index: number;
  onPress: (transaction: Transaction) => void;
}

const truncateAddress = (address: string) => {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}....`;
};

export const TransactionItem = ({
  transaction,
  index,
  onPress,
}: TransactionItemProps) => {
  const isReceive = transaction.type === "receive";

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 150, delay: index * 30 }}
    >
      <Pressable
        onPress={() => onPress(transaction)}
        className="px-4 py-4 rounded-3xl mb-2 active:opacity-70 bg-white/5 border border-white/15"
      >
        <View className="flex-row items-center gap-4">
          <View
            className="w-12 h-12 rounded-full items-center justify-center"
            style={{
              backgroundColor: isReceive
                ? `${COLORS.accent}1A`
                : "rgba(255, 255, 255, 0.05)",
              borderWidth: 1,
              borderColor: isReceive
                ? `${COLORS.accent}33`
                : "rgba(255, 255, 255, 0.15)",
            }}
          >
            {isReceive ? (
              <ArrowDownLeft size={18} color={COLORS.accent} />
            ) : (
              <ArrowUpRight size={18} color="rgba(255, 255, 255, 0.6)" />
            )}
          </View>

          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-0.5">
              <View className="flex-1 flex-row items-center">
                <Text
                  className="text-base font-medium text-white"
                  numberOfLines={1}
                >
                  @{transaction.name.toLowerCase().replace(/\s/g, "")}
                </Text>
                <Text className="text-xs font-mono ml-2 text-white/30">
                  {truncateAddress(transaction.address)}
                </Text>
              </View>
              <Text
                className="font-mono text-base ml-2"
                style={{
                  color: isReceive ? COLORS.accent : "rgba(255, 255, 255, 0.6)",
                }}
              >
                {transaction.amount}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm flex-1 text-white/40" numberOfLines={1}>
                {transaction.note || (isReceive ? "Received" : "Sent")}
              </Text>
              <Text className="text-sm ml-2 text-white/30">
                {transaction.date}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </MotiView>
  );
};
