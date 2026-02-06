import { ActionButtons } from "@/components/transaction/ActionButtons";
import { ProofCardModal } from "@/components/transaction/ProofCardModal";
import { ShieldIcon } from "@/components/transaction/ShieldIcon";
import { TransactionReceipt } from "@/components/transaction/TransactionReceipt";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Share, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Dummy transaction data
const DUMMY_TRANSACTION = {
  amount: "0.5",
  coin: "ETH",
  recipient: {
    name: "Alex Chen",
    handle: "@alexchen",
    avatar: "AC",
  },
  usdValue: "1,250.00",
  txHash: "0x1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890",
  networkFee: "0.00",
  timestamp: new Date().toISOString(),
};

export default function TransactionSuccess() {
  const router = useRouter();
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);

  const transactionData = DUMMY_TRANSACTION;

  const handleShareProof = () => {
    setIsProofModalOpen(true);
  };

  const handleShareImage = async () => {
    try {
      await Share.share({
        title: "Transaction Proof",
        message: `I just sent ${transactionData.amount} ${transactionData.coin} to ${transactionData.recipient.handle} on Astrâ! 🚀`,
      });
      setIsProofModalOpen(false);
    } catch (error) {
      console.error("Share failed:", error);
    }
  };

  const handleBackToDashboard = () => {
    router.replace("/(tabs)");
  };

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
          usdValue={transactionData.usdValue}
          txHash={transactionData.txHash}
          networkFee={transactionData.networkFee}
        />

        <ActionButtons
          onShareProof={handleShareProof}
          onBackToDashboard={handleBackToDashboard}
        />
      </ScrollView>

      <ProofCardModal
        isOpen={isProofModalOpen}
        onClose={() => setIsProofModalOpen(false)}
        onShare={handleShareImage}
        amount={transactionData.amount}
        coin={transactionData.coin}
        recipientHandle={
          transactionData.recipient.handle || transactionData.recipient.name
        }
        transactionId={transactionData.txHash}
      />
    </SafeAreaView>
  );
}
