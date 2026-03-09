import { ActionButtons } from "@/components/transaction/ActionButtons";
import { ShieldIcon } from "@/components/transaction/ShieldIcon";
import { TransactionReceipt } from "@/components/transaction/TransactionReceipt";
import { useTransactionStore } from "@/stores/useTransactionStore";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { ScrollView, Share, View, Text, BackHandler } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TransactionSuccess() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { getTransactionById } = useTransactionStore();

  const transactionId = params.transactionId as string;
  const transaction = transactionId ? getTransactionById(transactionId) : null;

  const transactionData = transaction
    ? {
        amount: transaction.amount,
        coin: transaction.tokenSymbol,
        recipient: {
          name:
            transaction.recipientName ||
            transaction.recipientHandle ||
            "Unknown",
          handle: transaction.recipientHandle || "",
          avatar: transaction.recipientName?.slice(0, 2).toUpperCase() || "UN",
        },
        recipientAddress: transaction.recipientAddress || "",
        usdValue: transaction.usdValue?.replace("$", "") || "0.00",
        txHash: transaction.hash || (params.hash as string) || "",
        networkFee: transaction.gasFee || "0.00",
        timestamp: transaction.timestamp.toISOString(),
        status: transaction.status,
      }
    : {
        amount: (params.amount as string) || "0",
        coin: (params.token as string) || "ETH",
        recipient: {
          name: (params.recipient as string) || "Unknown",
          handle: (params.recipient as string) || "",
          avatar:
            (params.recipient as string)?.slice(0, 2).toUpperCase() || "UN",
        },
        usdValue: "0.00",
        txHash: (params.hash as string) || "",
        networkFee: "0.00",
        recipientAddress: "",
        timestamp: new Date().toISOString(),
        status: "pending" as const,
      };

  if (!transactionData.txHash && !transactionId) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center">
        <Text className="text-white text-lg">Loading transaction...</Text>
      </SafeAreaView>
    );
  }

  const handleShareProof = async () => {
    try {
      await Share.share({
        title: "Transaction Proof",
        message: `I just sent ${transactionData.amount} ${transactionData.coin} to ${transactionData.recipient.handle || transactionData.recipientAddress} on ATARA! 🚀`,
      });
    } catch (error) {
      console.error("Share failed:", error);
    }
  };

  const handleBackToDashboard = () => {
    router.replace("/(tabs)");
  };

  // Handle hardware back button to go to home instead of previous screen
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        router.replace("/(tabs)");
        return true; // Prevent default back behavior
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );

      return () => subscription.remove();
    }, []),
  );

  return (
    <SafeAreaView className="flex-1 bg-black" edges={["top"]}>
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
          recipientAddress={transactionData.recipientAddress}
          usdValue={transactionData.usdValue}
          txHash={transactionData.txHash}
          networkFee={transactionData.networkFee}
        />

        <ActionButtons
          onShareProof={handleShareProof}
          onBackToDashboard={handleBackToDashboard}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
