import { BadgeCheck, Zap } from "lucide-react-native";
import { Text, View } from "react-native";
import { MotiView } from "moti";
import { COLORS } from "@/utils/constants";

interface Recipient {
  name: string;
  handle: string;
  avatar: string;
}

interface TransactionReceiptProps {
  amount: string;
  coin: string;
  recipient: Recipient;
  usdValue: string;
  txHash?: string;
  networkFee?: string;
}

export const TransactionReceipt = ({
  amount,
  coin,
  recipient,
  usdValue,
  txHash,
  networkFee = "0.0001",
}: TransactionReceiptProps) => {
  const formatHash = (hash?: string) => {
    if (!hash) return "#PENDING";
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };
  return (
    <>
      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 400, delay: 600 }}
        className="items-center mb-6"
      >
        <Text className="text-xs font-medium tracking-ultra uppercase mb-3 text-primary">
          Transaction Secured
        </Text>

        <View className="flex-row items-center gap-2 px-3 py-1.5 rounded-full bg-emarald/10 border border-emarald/20">
          <View className="w-2 h-2 rounded-full bg-emarald" />
          <Text className="text-[10px] font-semibold tracking-wider uppercase text-emarald">
            Confirmed On-Chain
          </Text>
        </View>
      </MotiView>

      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 400, delay: 1200 }}
        className="rounded-2xl p-6 border border-muted/35"
      >
        <View className="flex-row items-center gap-3 mb-6">
          <View className="w-12 h-12 rounded-full items-center justify-center bg-primary/20 border border-primary/20">
            <Text className="text-sm font-bold text-white">
              {recipient.avatar}
            </Text>
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-base font-semibold text-primary">
                {recipient.name}
              </Text>
              <BadgeCheck size={16} color={COLORS.sapphire} />
            </View>
            <Text className="text-sm text-muted">{recipient.handle}</Text>
          </View>
        </View>

        <View
          className="py-6 items-center border-y border-muted/35"
          style={{
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: "rgba(247, 247, 243, 0.1)",
          }}
        >
          <Text className="text-4xl font-bold text-primary">
            {amount} {coin}
          </Text>
          <Text className="text-base mt-1 text-muted">≈ ${usdValue}</Text>
        </View>

        <View className="mt-6 gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-medium text-muted">Tx Hash</Text>
            <Text className="text-sm font-medium text-white/70">
              {formatHash(txHash)}
            </Text>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-medium text-muted">Network Fee</Text>
            <View className="flex-row items-center gap-2">
              <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-emarald/10 border border-emarald/20">
                <Zap size={12} color={COLORS.emarald} />
                <Text className="text-xs font-semibold text-emarald">
                  ${networkFee}
                </Text>
              </View>
            </View>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-medium text-muted">Time</Text>
            <Text className="text-sm font-medium text-white/70">
              {new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        </View>

        <Text className="text-xs text-center mt-6 leading-relaxed text-muted">
          Funds have successfully reached the destination wallet.{"\n"}
          This receipt is immutable.
        </Text>
      </MotiView>
    </>
  );
};
