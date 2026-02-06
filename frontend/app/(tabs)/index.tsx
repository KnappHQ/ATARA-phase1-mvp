import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { ShareModal } from "../../components/homeScreen/ShareModal";
import { WeeklyInsights } from "../../components/homeScreen/WeeklyInsights";
import { QuickSendBar } from "../../components/homeScreen/QuickSendBar";
import { BalanceRevealSection } from "../../components/homeScreen/BalanceRevealSection";
import { ActionButtons } from "../../components/homeScreen/ActionButtons";
import {
  ActivityList,
  Transaction,
} from "../../components/homeScreen/ActivityList";

const transactions: Transaction[] = [
  {
    id: "1",
    name: "Marcus Chen",
    address: "0x71C7656EC7ab88b098defB751B7401B5f6d89742",
    date: "Today, 2:34 PM",
    amount: "+$1,038.00",
    type: "receive",
  },
  {
    id: "2",
    name: "Sent to Marcus",
    address: "0xAb5801a7D398351b8bE11C439e05C5B3259aeCd8",
    date: "Yesterday",
    amount: "-$150.00",
    type: "send",
    category: "transfer",
  },
  {
    id: "3",
    name: "Elena Rodriguez",
    address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    date: "Dec 14",
    amount: "+$720.00",
    type: "receive",
  },
  {
    id: "4",
    name: "James Wilson",
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    date: "Dec 13",
    amount: "-$500.00",
    type: "send",
    category: "shopping",
  },
  {
    id: "5",
    name: "Sarah Kim",
    address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    date: "Dec 12",
    amount: "+$246.25",
    type: "receive",
  },
];

export default function HomeTab() {
  const router = useRouter();
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const handleQuickSearch = (query: string) => {
    router.push({
      pathname: "/send",
      params: { searchQuery: query },
    });
  };

  const handleQuickSend = (contact: { address: string; name: string }) => {
    router.push("/send");
  };

  const handleTransactionPress = (transaction: Transaction) => {
    router.push({
      pathname: "/transaction-detail",
      params: {
        id: transaction.id,
        name: transaction.name,
        address: transaction.address || "",
        amount: transaction.amount,
        date: transaction.date,
        type: transaction.type,
        category: transaction.category || "",
        note: transaction.note || "",
      },
    });
  };

  return (
    <View className="flex-1" style={{ backgroundColor: "#000000" }}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View className="px-6">
          <BalanceRevealSection>
            <View className="mt-4">
              <View className="mb-7">
                <QuickSendBar
                  onSearch={handleQuickSearch}
                  onQuickSend={handleQuickSend}
                />
              </View>

              <ActionButtons
                onReceive={() => setShareModalOpen(true)}
                onSend={() => router.push("/send")}
              />

              <View className="mb-6">
                <WeeklyInsights />
              </View>

              <ActivityList
                transactions={transactions}
                onTransactionPress={handleTransactionPress}
              />
            </View>
          </BalanceRevealSection>
        </View>
      </ScrollView>

      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />
    </View>
  );
}
