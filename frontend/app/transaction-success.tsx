import { ActionButtons } from "@/components/transaction/ActionButtons";
import { ShieldIcon } from "@/components/transaction/ShieldIcon";
import { TransactionReceipt } from "@/components/transaction/TransactionReceipt";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TransactionSuccess() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const transactionData = {
    amount: (params.amount as string) || "1.45",
    coin: (params.coin as string) || "ETH",
    recipient: {
      name: (params.recipientName as string) || "Alex Chen",
      handle: (params.recipientHandle as string) || "@alexc",
      avatar: (params.recipientAvatar as string) || "AC",
    },
    usdValue: (params.usdValue as string) || "$3,625.00",
  };

  const handleShareProof = () => {
    console.log("Share proof");
  };

  const handleBackToDashboard = () => {
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 24 }}
      >
        <View className="h-48 items-center justify-center mb-8">
          <ShieldIcon visible={true} />
        </View>

        <TransactionReceipt
          amount={transactionData.amount}
          coin={transactionData.coin}
          recipient={transactionData.recipient}
          usdValue={transactionData.usdValue}
        />

        <ActionButtons
          onShareProof={handleShareProof}
          onBackToDashboard={handleBackToDashboard}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
