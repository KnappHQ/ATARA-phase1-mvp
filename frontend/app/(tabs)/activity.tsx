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
import { useSmartAccountService } from "@/services/smartAccount.service";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CHAIN_ID } from "@/utils/constants";
import { useAuthStore } from "@/stores/useAuthStore";
import { useWalletStore } from "@/stores/useWalletStore";
import { useEffect } from "react";
import {
  describePendingPayment,
  formatPendingPayment,
  isStale,
  parseStoredOperation,
  type StoredPendingOperation,
} from "@/utils/pendingOperation";

export default function Activity() {
  const router = useRouter();
  const [activityTab, setActivityTab] = useState<ActivityTab>("transactions");
  const [searchQuery, setSearchQuery] = useState("");
  const smartAccount = useSmartAccountService();
  const address = useAuthStore((s) => s.user?.smartAccountAddress);
  const assets = useWalletStore((s) => s.assets);
  const [pendingOperation, setPendingOperation] = useState<StoredPendingOperation | null>(null);
  const [checkingOperation, setCheckingOperation] = useState(false);
  const refreshPending = useCallback(async () => {
    if (!address) { setPendingOperation(null); return; }
    const stored = await AsyncStorage.getItem(`atara.pending-call-bundle.${CHAIN_ID}.${address.toLowerCase()}`);
    setPendingOperation(stored ? parseStoredOperation(stored) : null);
  }, [address]);
  useEffect(() => { void refreshPending(); }, [refreshPending]);
  const pendingPayment = pendingOperation ? describePendingPayment(pendingOperation) : null;
  const pendingLabel = pendingPayment ? formatPendingPayment(pendingPayment, assets) : "a payment";
  const pendingSince = pendingOperation?.createdAt
    ? new Date(pendingOperation.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  // The phone refuses new payments while one is unverified. When the provider
  // can no longer report on an old one, only the owner can lift that, knowing
  // what it risks: the phone cannot prove the old payment will never land.
  const releasePending = () => {
    if (!smartAccount) return;
    Alert.alert(
      "Release this payment?",
      `ATARA can no longer check ${pendingLabel}. Look for it in your Activity below and in your balance. If it is there, it went through and releasing is safe. If it is not, it most likely expired. Releasing lets you pay again; if the old payment still went through later, you would have paid twice.`,
      [
        { text: "Keep waiting", style: "cancel" },
        {
          text: "Release",
          style: "destructive",
          onPress: async () => {
            await smartAccount.releasePendingOperation();
            await refreshPending();
            await fetchHistory();
          },
        },
      ],
    );
  };

  const { displayHistory, contactThreads, isLoading, fetchHistory } =
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

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchHistory(), fetchGroups()]);
    await refreshPending();
    setIsRefreshing(false);
  }, [fetchHistory, fetchGroups, refreshPending]);

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

        {pendingOperation && <View className="rounded-2xl border border-amber-400/40 p-4 mb-4">
          <Text className="text-white font-semibold mb-2">Payment awaiting verification</Text>
          <Text className="text-white/70 mb-3">
            {`${pendingLabel.charAt(0).toUpperCase()}${pendingLabel.slice(1)}${pendingSince ? `, sent ${pendingSince}` : ""}, may still confirm. New payments from this phone wait until it is settled.`}
          </Text>
          <Pressable disabled={!smartAccount || checkingOperation} onPress={async () => {
            if (!smartAccount) return;
            setCheckingOperation(true);
            try {
              const result = await smartAccount.checkPendingOperation();
              await refreshPending();
              if (result.status === "confirmed") {
                Alert.alert("Confirmed on chain", `Transaction: ${result.hash}. Save this hash and refresh Activity. Do not pay twice.`);
                await fetchHistory();
              } else if (result.status === "failed") Alert.alert("Operation failed", "The chain reported a failure. No money left your account for it. You can try again.");
              else if (result.status === "none") await fetchHistory();
              else if (result.stale) releasePending();
              else Alert.alert("Still checking", "No final answer yet. Try this check again in a few minutes; no new payment was sent.");
            } catch { Alert.alert("Verification unavailable", "The wallet status could not be checked. Try again in a moment."); }
            finally { setCheckingOperation(false); }
          }}><Text style={{ color: COLORS.accent }}>{checkingOperation ? "Checking…" : "Check wallet operation"}</Text></Pressable>
          {!!smartAccount && isStale(pendingOperation, Date.now()) && (
            <Pressable onPress={releasePending} className="mt-3">
              <Text className="text-white/60">It no longer confirms? Release it</Text>
            </Pressable>
          )}
        </View>}

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
