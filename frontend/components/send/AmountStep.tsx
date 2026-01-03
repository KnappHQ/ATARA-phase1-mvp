import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
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

interface AmountStepProps {
  recipient: Contact;
  coins: Coin[];
  selectedCoin: Coin;
  amount: string;
  onSelectCoin: (coin: Coin) => void;
  onAmountChange: (amount: string) => void;
  onContinue: () => void;
}

const QUICK_AMOUNTS = ["25%", "50%", "75%", "MAX"];

export const AmountStep = ({
  recipient,
  coins,
  selectedCoin,
  amount,
  onSelectCoin,
  onAmountChange,
  onContinue,
}: AmountStepProps) => {
  const handleQuickAmount = (percentage: string) => {
    const balance = parseFloat(selectedCoin.balance);
    const multiplier = percentage === "MAX" ? 1 : parseInt(percentage) / 100;
    onAmountChange((balance * multiplier).toFixed(4));
  };

  const isValidAmount = amount && parseFloat(amount) > 0;

  return (
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 24 }}
    >
      <Animated.View entering={FadeIn} className="mb-6">
        <View className="flex-row items-center gap-3 p-4 bg-[#100f12] border border-champagne/10 rounded-xl">
          <View className="w-10 h-10 rounded-full bg-muted items-center justify-center">
            <Text className="text-sm font-rajdhani-bold text-foreground">
              {recipient.avatar}
            </Text>
          </View>
          <View>
            <Text className="text-base font-rajdhani-semibold text-foreground">
              {recipient.name}
            </Text>
            <Text className="text-sm font-rajdhani-medium text-muted-foreground">
              {recipient.handle}
            </Text>
          </View>
        </View>
      </Animated.View>

      <Animated.View entering={FadeIn.delay(100)} className="mb-8">
        <Text className="text-sm font-rajdhani-medium text-muted-foreground uppercase tracking-hud mb-3">
          Select Asset
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
        >
          {coins.map((coin) => (
            <Pressable
              key={coin.symbol}
              onPress={() => onSelectCoin(coin)}
              className={`px-4 py-2 rounded-xl ${
                selectedCoin.symbol === coin.symbol
                  ? "bg-champagne"
                  : "bg-[#100f12] border border-champagne/20"
              }`}
              style={{
                boxShadow:
                  selectedCoin.symbol === coin.symbol
                    ? "0 0 12px rgba(255, 230, 102, 0.4)"
                    : "none",
              }}
            >
              <Text
                className={`text-sm font-orbitron-semibold ${
                  selectedCoin.symbol === coin.symbol
                    ? "text-[#0D080F]"
                    : "text-foreground"
                }`}
              >
                {coin.symbol}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>

      <Animated.View entering={FadeIn.delay(200)} className="items-center mb-6">
        <TextInput
          value={amount}
          onChangeText={onAmountChange}
          placeholder="0.00"
          placeholderTextColor="rgba(255, 255, 255, 0.2)"
          keyboardType="decimal-pad"
          className="text-6xl font-rajdhani text-foreground text-center w-full"
          style={{ maxWidth: 250 }}
        />
        <Text className="text-sm text-muted-foreground mt-2">
          {selectedCoin.symbol} · Balance: {selectedCoin.balance}
        </Text>
      </Animated.View>

      <Animated.View
        entering={FadeIn.delay(300)}
        className="flex-row gap-2 justify-center mb-8"
      >
        {QUICK_AMOUNTS.map((pct) => (
          <Pressable
            key={pct}
            onPress={() => handleQuickAmount(pct)}
            className="px-4 py-2 bg-[#100f12] border border-champagne/10 rounded-lg active:opacity-80"
          >
            <Text className="text-xs font-orbitron-medium text-muted-foreground">
              {pct}
            </Text>
          </Pressable>
        ))}
      </Animated.View>

      <Animated.View entering={FadeIn.delay(400)}>
        <Pressable
          onPress={onContinue}
          disabled={!isValidAmount}
          className={`w-full py-5 rounded-xl items-center justify-center ${
            isValidAmount ? "bg-champagne" : "bg-champagne/10"
          }`}
        >
          <Text
            className={`font-orbitron-bold text-sm tracking-hud uppercase ${
              isValidAmount ? "text-[#0D080F]" : "text-muted-foreground"
            }`}
          >
            Continue
          </Text>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
};
