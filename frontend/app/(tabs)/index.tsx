import { useRouter } from "expo-router";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { ShareModal } from "../../components/homeScreen/ShareModal";
import { QuickSendBar } from "../../components/homeScreen/QuickSendBar";
import { BalanceRevealSection } from "../../components/homeScreen/BalanceRevealSection";
import { ActionButtons } from "../../components/homeScreen/ActionButtons";
import { CryptoActions } from "../../components/homeScreen/CryptoActions";
import { VaultEntryCard } from "../../components/homeScreen/VaultEntryCard";
import { CardEntryCard } from "../../components/homeScreen/CardEntryCard";
import { ActivityList } from "../../components/homeScreen/ActivityList";
import { useTransactionHistoryStore } from "@/stores/useTransactionHistoryStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useGroupStore } from "@/stores/useGroupStore";
import { useWalletStore } from "@/stores/useWalletStore";
import { COLORS } from "@/utils/constants";
import { ACTIVITY_LIMIT } from "@/utils/constants";

const VAULTS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_VAULTS === "true";

export default function HomeTab() {
  const router = useRouter();
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const { displayHistory, isLoading, fetchHistory } =
    useTransactionHistoryStore();
  const { fetchGroups } = useGroupStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchHistory();
      fetchGroups();
    }
  }, [fetchGroups, fetchHistory, isAuthenticated]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Reads only. The balance and the activity keep their current values while
  // this runs, and one failing read does not stop the others.
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        useWalletStore.getState().refreshBalances(),
        fetchHistory(),
        fetchGroups(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchGroups, fetchHistory]);

  const recentActivity = useMemo(
    () => displayHistory.slice(0, ACTIVITY_LIMIT),
    [displayHistory],
  );

  return (
    <View className="flex-1" style={{ backgroundColor: "#000000" }}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
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
        <View className="px-6">
          <BalanceRevealSection>
            <View className="mt-4">
              <View className="mb-7">
                <QuickSendBar />
              </View>

              <ActionButtons
                onReceive={() => setShareModalOpen(true)}
                onSend={() => router.push("/send")}
              />

              <CryptoActions
                onAddCrypto={() => router.push("/add-crypto")}
                onPayMerchant={() => router.push("/pay-merchant")}
              />

              <CardEntryCard onPress={() => router.push("/card" as never)} />

              {VAULTS_ENABLED ? (
                <VaultEntryCard onPress={() => router.push("/vaults")} />
              ) : null}

              <ActivityList
                transactions={recentActivity}
                isLoading={isLoading}
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
