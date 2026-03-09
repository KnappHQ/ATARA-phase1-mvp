import { View, Text } from "react-native";
import { ContactThreadItem } from "./ContactThreadItem";
import {
  DisplayTransaction,
  ContactThread,
} from "@/stores/useTransactionHistoryStore";
import { ActivitySkeleton } from "../homeScreen/ActivitySkeleton";
import { useRouter } from "expo-router";

export type { ContactThread };

interface ContactsTabProps {
  contactThreads: ContactThread[];
  isLoading?: boolean;
}

export function ContactsTab({
  contactThreads,
  isLoading = false,
}: ContactsTabProps) {
  const router = useRouter();

  const handleThreadClick = (thread: any) => {
    router.push({
      pathname: "/contact-detail",
      params: {
        address: thread.address,
        displayName: thread.displayName,
      },
    });
  };

  if (isLoading) {
    return <ActivitySkeleton />;
  }

  if (contactThreads.length === 0) {
    return (
      <View className="py-16 items-center">
        <Text className="text-white/40 text-center">No contacts yet</Text>
        <Text className="text-white/30 text-sm text-center mt-2">
          Your transaction contacts will appear here
        </Text>
      </View>
    );
  }

  return (
    <View>
      {contactThreads.map((thread, index) => (
        <ContactThreadItem
          key={thread.address}
          thread={thread}
          index={index}
          onPress={handleThreadClick}
        />
      ))}
    </View>
  );
}
