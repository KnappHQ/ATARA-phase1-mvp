import { useGasEstimation } from "@/hooks/useGasEstimation";
import { TransactionService } from "@/services/transaction.service";
import { useSendStore } from "@/stores/useSendStore";
import { useRouter } from "expo-router";
import { ArrowRight, Check } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useAlertStore } from "@/stores/useAlertStore";
import Animated, { FadeIn } from "react-native-reanimated";

interface ConfirmStepProps {
  priceUsd?: number;
}

export const ConfirmStep = ({ priceUsd = 0 }: ConfirmStepProps) => {
  const router = useRouter();
  const { recipient, amount, coinSymbol } = useSendStore();
  const { networkFee, isEstimating } = useGasEstimation(
    recipient?.publicAddress,
    amount
  );

  const [isSending, setIsSending] = useState(false);

  const estimatedUsdValue = (
    parseFloat(amount || "0") * priceUsd
  ).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const showAlert = useAlertStore((s) => s.show);
  const onConfirm = async () => {
    if (!recipient?.publicAddress) return;

    setIsSending(true);
    try {
      const tx = await TransactionService.sendTransaction(
        recipient.publicAddress,
        amount,
        coinSymbol
      );

      router.replace({
        pathname: "/transaction-success",
        params: {
          amount,
          coin: coinSymbol,
          recipientName: recipient.name || "External Wallet",
          recipientHandle: recipient.handle,
          recipientAvatar: recipient.avatar,
          txHash: tx.hash,
          networkFee,
          usdValue: estimatedUsdValue,
        },
      });
    } catch (error: any) {
      showAlert("error", error.message || "Unknown error occurred");
      setIsSending(false);
    }
  };

  return (
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 24 }}
    >
      <Animated.View entering={FadeIn} className="items-center mb-8">
        <View className="w-20 h-20 rounded-full bg-champagne/20 items-center justify-center mb-4">
          <ArrowRight
            size={32}
            color="#FFE666"
            style={{ transform: [{ rotate: "-45deg" }] }}
          />
        </View>
        <Text className="text-5xl font-rajdhani text-foreground mb-1">
          {amount} <Text className="text-xl text-champagne">{coinSymbol}</Text>
        </Text>
        <Text className="text-lg font-rajdhani text-muted-foreground">
          ≈ ${estimatedUsdValue}
        </Text>
      </Animated.View>

      <Animated.View entering={FadeIn.delay(100)} className="mb-8">
        <View className="bg-[#100f12] border border-champagne/20 rounded-xl p-4">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-base font-rajdhani text-muted-foreground">
              To
            </Text>
            <View className="flex-row items-center gap-2">
              <View className="w-6 h-6 rounded-full bg-muted items-center justify-center">
                <Text className="text-[10px] font-rajdhani-bold text-foreground">
                  {recipient?.avatar || "??"}
                </Text>
              </View>
              <Text className="text-sm font-rajdhani-semibold text-foreground">
                {recipient?.name || "Unknown"}
              </Text>
            </View>
          </View>

          <View className="h-px bg-champagne/10 mb-4" />

          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-base font-rajdhani text-muted-foreground">
              Network Fee
            </Text>
            <Text className="text-base font-rajdhani text-foreground">
              {isEstimating ? (
                <ActivityIndicator size="small" color="#FFE666" />
              ) : (
                <Text className="text-base font-rajdhani text-foreground">
                  {networkFee} ETH
                </Text>
              )}
            </Text>
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="text-base font-rajdhani text-muted-foreground">
              Arrival
            </Text>
            <Text className="text-base font-rajdhani text-foreground">
              ~15 seconds
            </Text>
          </View>
        </View>
      </Animated.View>

      <Animated.View entering={FadeIn.delay(200)}>
        <Pressable
          onPress={onConfirm}
          disabled={isSending || isEstimating}
          className="w-full py-5 bg-champagne rounded-xl flex-row items-center justify-center gap-2 active:opacity-90"
        >
          {isSending ? (
            <>
              <ActivityIndicator color="#0D080F" />
              <Text className="font-orbitron-bold text-sm tracking-hud uppercase text-[#0D080F]">
                Sending...
              </Text>
            </>
          ) : (
            <>
              <Check size={20} color="#0D080F" />
              <Text className="font-orbitron-bold text-sm tracking-hud uppercase text-[#0D080F]">
                Confirm & Send
              </Text>
            </>
          )}
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
};
