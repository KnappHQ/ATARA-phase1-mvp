import { View, Text } from "react-native";
import { TransactionItem } from "./TransactionItem";
import { ActivitySkeleton } from "../homeScreen/ActivitySkeleton";
import { COLORS } from "@/utils/constants";
import { DisplayTransaction } from "@/stores/useTransactionHistoryStore";
import { useRouter } from "expo-router";

interface TransactionsTabProps {
  transactions: DisplayTransaction[];
  isLoading?: boolean;
}

export function TransactionsTab({
  transactions,
  isLoading = false,
}: TransactionsTabProps) {
  const router = useRouter();

  const handleTransactionClick = (tx: any) => {
    router.push({
      pathname: "/transaction-detail",
      params: {
        id: tx.id,
        name: tx.counterparty.name,
        address: tx.counterparty.address,
        handle: tx.counterparty.handle || "",
        amount: tx.formattedAmount,
        date: tx.displayDate,
        type: tx.type,
        note: tx.userNote || "",
        category: tx.category || "",
        isInApp: tx.isInApp.toString(),
      },
    });
  };

  if (isLoading) {
    return <ActivitySkeleton />;
  }

  if (transactions.length === 0) {
    return (
      <View className="py-16 items-center">
        <Text className="text-white/40 text-center">No transactions yet</Text>
        <Text className="text-white/30 text-sm text-center mt-2">
          Your transaction history will appear here
        </Text>
      </View>
    );
  }

  return (
    <View>
      {transactions.map((tx, index) => (
        <TransactionItem
          key={tx.id}
          transaction={tx}
          index={index}
          onPress={handleTransactionClick}
        />
      ))}
    </View>
  );
}
