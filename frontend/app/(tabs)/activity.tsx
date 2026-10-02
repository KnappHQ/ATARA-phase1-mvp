import { useState, useMemo, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  Platform,
  RefreshControl,
  Alert,
} from "react-native";
import { MotiView } from "moti";
import { Plus } from "lucide-react-native";
import { useRouter } from "expo-router";
import { SearchBar } from "@/components/activity/SearchBar";
import { ContactsTab } from "@/components/activity/ContactsTab";
import { TransactionsTab } from "@/components/activity/TransactionsTab";
import { TabSwitcher, ActivityTab } from "@/components/activity/TabSwitcher";
import { GroupsListTab } from "@/components/activity/GroupsListTab";
import { COLORS } from "@/utils/constants";
import { useTransactionHistoryStore } from "@/stores/useTransactionHistoryStore";
import { useGroupStore } from "@/stores/useGroupStore";
import { OperationCards } from "@/components/activity/OperationCards";
import { usePaymentOperations } from "@/hooks/usePaymentOperations";
import { useAuthStore } from "@/stores/useAuthStore";
import { useWalletStore } from "@/stores/useWalletStore";

export default function Activity() {
  const router = useRouter();
  const [activityTab, setActivityTab] = useState<ActivityTab>("transactions");
  const [searchQuery, setSearchQuery] = useState("");
  const address = useAuthStore((s) => s.user?.smartAccountAddress);
  const assets = useWalletStore((s) => s.assets);
  // The account's own payments that are not settled. Nothing here waits for the
  // wallet to start: checking a payment needs only its address.
  const operations = usePaymentOperations(address, assets);
  const refreshOperations = operations.refresh;

  const { displayHistory, contactThreads, isLoading, fetchHistory } =
    useTransactionHistoryStore();

  // The phone refuses new payments while one is unverified. When nobody can find
  // an old one any more, only the owner can lift that, knowing what it risks: the
  // phone cannot prove the old payment will never land.
  const confirmRelease = () =>
    Alert.alert(
      "Release this payment?",
      "ATARA cannot find this payment. Look for it in your Activity below and in your balance. If it is there, it went through and releasing is safe. If it is not, it may have expired, or it may still be waiting. Releasing lets this account pay again, and if the old payment still goes through later you would have paid twice. ATARA will keep watching it and tell you here if that happens.",
      [
        { text: "Keep waiting", style: "cancel" },
        { text: "Release", style: "destructive", onPress: () => void operations.run("release") },
      ],
    );
  const {
    groups,
    isLoading: groupsLoading,
    error: groupsError,
    fetchGroups,
  } = useGroupStore();

  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return displayHistory;
    const query = searchQuery.toLowerCase();
    return displayHistory.filter(
      (tx) =>
        tx.counterparty.name.toLowerCase().includes(query) ||
        tx.userNote?.toLowerCase().includes(query) ||
        tx.formattedAmount.toLowerCase().includes(query),
    );
  }, [searchQuery, displayHistory]);

  const filteredContactThreads = useMemo(() => {
    if (!searchQuery.trim()) return contactThreads;
    const query = searchQuery.toLowerCase();
    return contactThreads.filter(
      (thread) =>
        thread.displayName.toLowerCase().includes(query) ||
        thread.lastNote.toLowerCase().includes(query) ||
        thread.transactions.some((tx) =>
          tx.userNote?.toLowerCase().includes(query),
        ),
    );
  }, [contactThreads, searchQuery]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const query = searchQuery.toLowerCase();
    return groups.filter((g) => g.name.toLowerCase().includes(query));
  }, [groups, searchQuery]);

  const handleCreateGroup = () => {
    router.push("/group-create");
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchHistory(), fetchGroups(), refreshOperations()]);
    setIsRefreshing(false);
  }, [fetchHistory, fetchGroups, refreshOperations]);

  const handleTabChange = (tab: ActivityTab) => {
    setActivityTab(tab);
    setSearchQuery("");
  };

  return (
    <View className="flex-1 bg-black">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.platinum}
            colors={[COLORS.platinum]}
            progressBackgroundColor="#111111"
          />
        }
      >
        <View className="flex-row items-center justify-between mt-5 mb-4">
          <Text className="text-2xl font-semibold text-primary">Activity</Text>
        </View>

        <OperationCards
          cards={operations.cards}
          checking={operations.checking}
          onAction={(action) => {
            if (action === "release") return confirmRelease();
            void operations.run(action).then(fetchHistory);
          }}
          note={operations.releasedNote}
          onDismissNote={operations.dismissReleasedNote}
        />

        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search @handle or note..."
        />

        <TabSwitcher activeTab={activityTab} onTabChange={handleTabChange} />

        {activityTab === "transactions" && (
          <TransactionsTab
            transactions={filteredTransactions}
            isLoading={isLoading}
          />
        )}

        {activityTab === "contacts" && (
          <ContactsTab
            contactThreads={filteredContactThreads}
            isLoading={isLoading}
          />
        )}

        {activityTab === "groups" && (
          <GroupsListTab
            groups={filteredGroups}
            searchQuery={searchQuery}
            isLoading={groupsLoading}
            error={groupsError}
            onRetry={fetchGroups}
          />
        )}

        <View className="h-24" />
      </ScrollView>

      {activityTab === "groups" && (
        <MotiView
          from={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ type: "spring", damping: 18, stiffness: 200 }}
          style={{ position: "absolute", bottom: 128, right: 24 }}
        >
          <Pressable
            onPress={handleCreateGroup}
            className="w-14 h-14 rounded-full items-center justify-center active:opacity-80"
            style={[
              { backgroundColor: COLORS.accent },
              Platform.OS === "ios" && {
                shadowColor: "#000",
                shadowOpacity: 0.3,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
              },
            ]}
          >
            <Plus size={24} color="#000" strokeWidth={2.5} />
          </Pressable>
        </MotiView>
      )}
    </View>
  );
}
