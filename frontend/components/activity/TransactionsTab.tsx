import { View } from "react-native";
import { TransactionItem, Transaction } from "./TransactionItem";

interface TransactionsTabProps {
  transactions: Transaction[];
  onTransactionClick: (tx: Transaction) => void;
}

export function TransactionsTab({
  transactions,
  onTransactionClick,
}: TransactionsTabProps) {
  return (
    <View>
      {transactions.map((tx, index) => (
        <TransactionItem
          key={tx.id}
          transaction={tx}
          index={index}
          onPress={onTransactionClick}
        />
      ))}
    </View>
  );
}
