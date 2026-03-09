import { useState, useMemo } from "react";
import { ScrollView, View, Text, Pressable, Platform } from "react-native";
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

export default function Activity() {
  const router = useRouter();
  const [activityTab, setActivityTab] = useState<ActivityTab>("transactions");
  const [searchQuery, setSearchQuery] = useState("");

  const { displayHistory, contactThreads, isLoading } =
    useTransactionHistoryStore();
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
      >
        <View className="flex-row items-center justify-between mt-5 mb-4">
          <Text className="text-2xl font-semibold text-primary">Activity</Text>
        </View>

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
