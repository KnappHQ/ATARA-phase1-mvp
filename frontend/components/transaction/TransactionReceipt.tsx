import { BadgeCheck, Zap } from "lucide-react-native";
import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

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
}

export const TransactionReceipt = ({
  amount,
  coin,
  recipient,
  usdValue,
}: TransactionReceiptProps) => {
  return (
    <>
      <Animated.View
        entering={FadeInDown.delay(600)}
        className="items-center mb-6"
      >
        <Text className="text-xs font-orbitron-medium tracking-hud-wide text-champagne uppercase mb-3">
          Transaction Secured
        </Text>

        <View className="flex-row items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
          <View className="w-2 h-2 rounded-full bg-emerald-400" />
          <Text className="text-[10px] font-rajdhani-semibold tracking-wider text-emerald-400 uppercase">
            Confirmed On-Chain
          </Text>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(1200)}
        className="rounded-2xl p-6 bg-[rgba(255,255,255,0.05)] border border-champagne/15"
        style={{
          boxShadow: "inset 0 0 30px rgba(255, 230, 102, 0.03)",
        }}
      >
        <View className="flex-row items-center gap-3 mb-6">
          <View className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 items-center justify-center">
            <Text className="text-sm font-rajdhani-bold text-white">
              {recipient.avatar}
            </Text>
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-base font-rajdhani-semibold text-foreground">
                {recipient.name}
              </Text>
              <BadgeCheck size={16} color="#FFE666" />
            </View>
            <Text className="text-sm font-rajdhani text-muted-foreground">
              {recipient.handle}
            </Text>
          </View>
        </View>

        <View className="py-6 border-t border-b border-champagne/10 items-center">
          <Text className="text-4xl font-rajdhani text-champagne">
            {amount} {coin}
          </Text>
          <Text className="text-base font-rajdhani text-muted-foreground mt-1">
            {usdValue}
          </Text>
        </View>

        <View className="mt-6 gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-rajdhani-medium text-muted-foreground">
              Block
            </Text>
            <Text className="text-sm font-rajdhani-medium text-foreground/70">
              #192402
            </Text>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-rajdhani-medium text-muted-foreground">
              Network Fee
            </Text>
            <View className="flex-row items-center gap-2">
              <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <Zap size={12} color="#34D399" />
                <Text className="text-xs font-rajdhani-semibold text-emerald-400">
                  $0.00
                </Text>
              </View>
              <Text className="text-sm font-rajdhani-medium text-emerald-400/70">
                (Sponsored)
              </Text>
            </View>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-rajdhani-medium text-muted-foreground">
              Time
            </Text>
            <Text className="text-sm font-rajdhani-medium text-foreground/70">
              {new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        </View>

        <Text className="text-xs font-rajdhani text-muted-foreground/60 text-center mt-6 leading-relaxed">
          Funds have successfully reached the destination wallet.{"\n"}
          This receipt is immutable.
        </Text>
      </Animated.View>
    </>
  );
};
