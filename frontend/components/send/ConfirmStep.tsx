import { ArrowRight, Check } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

interface Contact {
  id: string;
  name: string;
  handle: string;
  avatar: string;
}

interface Coin {
  symbol: string;
  name: string;
  balance: string;
  value: string;
}

interface ConfirmStepProps {
  recipient: Contact;
  selectedCoin: Coin;
  amount: string;
  onConfirm: () => void;
}

export const ConfirmStep = ({
  recipient,
  selectedCoin,
  amount,
  onConfirm,
}: ConfirmStepProps) => {
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
          {amount}{" "}
          <Text className="text-xl text-champagne">{selectedCoin.symbol}</Text>
        </Text>
        <Text className="text-lg font-rajdhani text-muted-foreground">
          ≈ $1,234.56
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
                  {recipient.avatar}
                </Text>
              </View>
              <Text className="text-sm font-rajdhani-semibold text-foreground">
                {recipient.name}
              </Text>
            </View>
          </View>

          <View className="h-px bg-champagne/10 mb-4" />

          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-base font-rajdhani text-muted-foreground">
              Network Fee
            </Text>
            <Text className="text-base font-rajdhani text-foreground">
              ~$2.50
            </Text>
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="text-base font-rajdhani text-muted-foreground">
              Arrival
            </Text>
            <Text className="text-base font-rajdhani text-foreground">
              ~30 seconds
            </Text>
          </View>
        </View>
      </Animated.View>

      <Animated.View entering={FadeIn.delay(200)}>
        <Pressable
          onPress={onConfirm}
          className="w-full py-5 bg-champagne rounded-xl flex-row items-center justify-center gap-2 active:opacity-90"
        >
          <Check size={20} color="#0D080F" />
          <Text className="font-orbitron-bold text-sm tracking-hud uppercase text-[#0D080F]">
            Confirm & Send
          </Text>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
};
