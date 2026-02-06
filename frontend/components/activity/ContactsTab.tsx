import { View } from "react-native";
import { ContactThreadItem } from "./ContactThreadItem";
import { Transaction } from "./TransactionItem";

export interface ContactThread {
  address: string;
  displayName: string;
  lastMessage: string;
  lastNote: string;
  lastDate: string;
  lastTime: string;
  totalReceived: number;
  totalSent: number;
  transactionCount: number;
  transactions: Transaction[];
}

interface ContactsTabProps {
  contactThreads: ContactThread[];
  onThreadClick: (thread: ContactThread) => void;
}

export function ContactsTab({
  contactThreads,
  onThreadClick,
}: ContactsTabProps) {
  return (
    <View>
      {contactThreads.map((thread, index) => (
        <ContactThreadItem
          key={thread.address}
          thread={thread}
          index={index}
          onPress={onThreadClick}
        />
      ))}
    </View>
  );
}
