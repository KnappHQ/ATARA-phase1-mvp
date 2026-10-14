import { View, Text, TouchableOpacity } from "react-native";
import { TransactionItem } from "./TransactionItem";
import { TransactionsSkeleton } from "../homeScreen/ActivitySkeleton";
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
    return <TransactionsSkeleton />;
  }

  if (transactions.length === 0) {
    return (
      <View className="py-16 items-center">
        <Text className="text-white/40 text-center">
          Your payments will show up here.
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/send")}
          activeOpacity={0.8}
          accessibilityRole="button"
          className="mt-5 min-h-11 px-5 items-center justify-center rounded-full border border-white/20"
        >
          <Text className="text-sm font-medium text-white">Send money</Text>
        </TouchableOpacity>
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
