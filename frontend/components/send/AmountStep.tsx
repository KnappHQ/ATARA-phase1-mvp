import { useState, useEffect } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { MotiView } from "moti";
import { ChevronDown, AlertCircle } from "lucide-react-native";
import { useRouter } from "expo-router";
import { SwipeToSend } from "./SwipeToSend";
import { Contact, DUMMY_COINS } from "@/app/send";
import { COLORS } from "@/utils/constants";

interface AmountStepProps {
  recipient: Contact;
}

const QUICK_AMOUNTS = ["25%", "50%", "75%", "MAX"];

export const AmountStep = ({ recipient }: AmountStepProps) => {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [selectedCoin, setSelectedCoin] = useState(DUMMY_COINS[0]);
  const [insufficientBalance, setInsufficientBalance] = useState(false);

  const balanceValue = parseFloat(selectedCoin.balance.replace(/,/g, ""));

  // Validate balance whenever amount changes
  useEffect(() => {
    const amountValue = parseFloat(amount) || 0;
    setInsufficientBalance(amountValue > balanceValue);
  }, [amount, balanceValue]);

  const handleQuickAmount = (percentage: string) => {
    const balance = parseFloat(selectedCoin.balance.replace(/,/g, ""));
    const multiplier = percentage === "MAX" ? 1 : parseInt(percentage) / 100;
    setAmount((balance * multiplier).toFixed(4));
  };

  const isValidAmount = Boolean(amount && parseFloat(amount) > 0);

  const handleSendComplete = () => {
    const amountValue = parseFloat(amount) || 0;

    // Final balance check before transaction
    if (amountValue > balanceValue) {
      return;
    }

    if (amount && amountValue > 0) {
      console.log("Send completed:", {
        recipient,
        amount,
        coin: selectedCoin.symbol,
        note: note || undefined,
      });
      router.push("/transaction-success");
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-black"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 24 }}
    >
      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 400 }}
        className="mb-6"
      >
        <View
          className="flex-row items-center gap-3 p-3 rounded-2xl border border-white/20"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
        >
          <View className="w-10 h-10 rounded-full items-center justify-center bg-white/10">
            <Text className="text-xs font-bold text-white">
              {recipient.avatar}
            </Text>
          </View>
          <View>
            <Text className="text-base font-medium text-white">
              {recipient.name}
            </Text>
            <Text className="text-sm text-white/50">{recipient.handle}</Text>
          </View>
        </View>
      </MotiView>

      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 400, delay: 100 }}
        className="mb-6"
      >
        <Text className="text-sm font-medium uppercase mb-3 text-muted tracking-widest">
          Select Asset
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
        >
          {DUMMY_COINS.map((coin) => (
            <Pressable
              key={coin.symbol}
              onPress={() => setSelectedCoin(coin)}
              className="px-5 py-3 rounded-2xl active:opacity-80"
              style={{
                backgroundColor:
                  selectedCoin.symbol === coin.symbol
                    ? COLORS.white
                    : "rgba(255, 255, 255, 0.03)",
                borderWidth: 1,
                borderColor:
                  selectedCoin.symbol === coin.symbol
                    ? COLORS.white
                    : "rgba(255, 255, 255, 0.1)",
              }}
            >
              <Text
                className="text-sm font-medium"
                style={{
                  color:
                    selectedCoin.symbol === coin.symbol
                      ? COLORS.black
                      : COLORS.white,
                }}
              >
                {coin.symbol}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </MotiView>

      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 400, delay: 200 }}
        className="items-center mb-6"
      >
        <View className="relative inline-block">
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor="rgba(255, 255, 255, 0.2)"
            keyboardType="decimal-pad"
            className="text-5xl font-light text-center w-full"
            style={{
              maxWidth: 200,
              color: COLORS.white,
            }}
          />
        </View>
        <Text className="text-base mt-2 text-muted">
          {selectedCoin.symbol} · Balance: {selectedCoin.balance}
        </Text>
      </MotiView>

      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 400, delay: 300 }}
        className="flex-row gap-2 justify-center mb-6"
      >
        {QUICK_AMOUNTS.map((pct) => (
          <Pressable
            key={pct}
            onPress={() => handleQuickAmount(pct)}
            className="px-4 py-2 rounded-2xl active:opacity-70 border border-muted/40"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.05)",
            }}
          >
            <Text className="text-xs font-medium text-muted">{pct}</Text>
          </Pressable>
        ))}
      </MotiView>

      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 400, delay: 400 }}
        className="mb-6"
      >
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Add a note (optional)"
          placeholderTextColor={COLORS.muted}
          className="w-full px-4 py-4 rounded-2xl text-base text-primary border border-muted/40"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.05)",
          }}
        />
      </MotiView>

      {insufficientBalance && (
        <MotiView
          from={{ opacity: 0, translateY: -5 }}
          animate={{ opacity: 1, translateY: 0 }}
          className="flex-row items-center justify-center gap-2 mb-4 p-3 rounded-2xl bg-bitcoin/10 border border-bitcoin/30"
        >
          <AlertCircle size={16} color={COLORS.bitcoinOrange} />
          <Text className="text-sm text-bitcoin">
            Insufficient Balance. Please top up your wallet.
          </Text>
        </MotiView>
      )}

      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 400, delay: 500 }}
        className="flex-row items-center justify-center gap-2 mb-6 py-2"
      >
        <View className="w-2 h-2 rounded-full bg-emarald" />
        <Text className="text-sm text-muted mr-4">Base Network</Text>

        <Text className="text-sm text-muted">Network Fee:</Text>
        <View className="px-2.5 py-1 rounded-full bg-emarald/10 border border-emarald/20">
          <Text className="text-xs font-medium text-emarald">$0.00</Text>
        </View>
      </MotiView>

      <MotiView
        from={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "timing", duration: 400, delay: 600 }}
      >
        <SwipeToSend
          onComplete={handleSendComplete}
          disabled={!isValidAmount || insufficientBalance}
          label={insufficientBalance ? "Insufficient Balance" : "Swipe to Send"}
        />
      </MotiView>
    </ScrollView>
  );
};
