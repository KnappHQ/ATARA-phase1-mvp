import { View, Text, ScrollView, Pressable, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Plus } from "lucide-react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { retryPendingSettlements } from "@/services/settlementRecovery.service";
import { COLORS } from "@/utils/constants";
import { useGroupStore } from "@/stores/useGroupStore";
import type { GroupMemberBalance } from "@/stores/useGroupStore";
import { useState, useEffect } from "react";
import { GroupDetailsHeader } from "@/components/groupDetails/GroupDetailsHeader";
import { MemberBalanceList } from "@/components/groupDetails/MemberBalanceList";
import { SettleBottomSheet } from "@/components/groupDetails/SettleBottomSheet";
import { GroupExpenseList } from "@/components/groupDetails/GroupExpenseList";
import { AddExpenseModal } from "@/components/groupDetails/AddExpenseModal";
import { GroupDetailsSkeleton } from "@/components/groupDetails/GroupDetailsSkeleton";

export default function GroupDetailsScreen() {
  const router = useRouter();
  const { id, name, memberCount } = useLocalSearchParams<{
    id: string;
    name: string;
    memberCount: string;
  }>();
  const {
    groupDetail,
    isLoadingDetail,
    detailError,
    fetchGroupDetail,
    clearDetail,
  } = useGroupStore();
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [settleMember, setSettleMember] = useState<GroupMemberBalance | null>(
    null,
  );


  useEffect(() => {
    if (id) fetchGroupDetail(id);
    return () => clearDetail();
  }, [clearDetail, fetchGroupDetail, id]);

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <GroupDetailsHeader
          name={name ?? ""}
          members={groupDetail?.members ?? []}
          memberCount={
            parseInt(memberCount ?? "0", 10) || groupDetail?.members.length
          }
          onBack={() => router.back()}
        />

        {groupDetail && (
          <MemberBalanceList
            memberBalances={groupDetail.memberBalances}
            onSettle={(member) => setSettleMember(member)}
          />
        )}

        <View className="mx-6 mb-6 rounded-2xl border border-white/10 p-4">
          <Text className="text-white text-sm font-semibold">Dépenses partagées · {groupDetail?.assetSymbol ?? "USDC"}</Text>
          <Pressable className="py-3" onPress={async () => { try { const result = await retryPendingSettlements(); if (id) await fetchGroupDetail(id); Alert.alert("Vérification des reçus", `${result.settled} règlement(s) rapproché(s). ${result.remaining} encore à vérifier. Ne repaie pas un transfert déjà envoyé.`); } catch (error) { Alert.alert("Vérification", error instanceof Error ? error.message : "Réessaie dans quelques instants."); } }}><Text style={{ color: COLORS.accent }}>Vérifier mes paiements en attente</Text></Pressable>
          <Text className="text-white/50 text-xs leading-5 mt-2">Chaque membre accepte ou conteste sa part. Seules les parts acceptées apparaissent dans les montants à rembourser. Tu confirmes chaque paiement.</Text>
        </View>

        {isLoadingDetail ? (
          <GroupDetailsSkeleton />
        ) : detailError ? (
          <View className="py-12 items-center gap-2 px-6">
            <Text className="text-white/40 text-center">{detailError}</Text>
            <Pressable
              onPress={() => id && fetchGroupDetail(id)}
              className="mt-2"
            >
              <Text
                className="text-xs font-mono"
                style={{ color: COLORS.accent }}
              >
                Retry
              </Text>
            </Pressable>
          </View>
        ) : groupDetail ? (
          <GroupExpenseList
            expenses={groupDetail.expenses}
            memberCount={groupDetail.members.length}
          />
        ) : null}
      </ScrollView>

      <AddExpenseModal
        isOpen={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        groupId={id ?? ""}
        memberCount={
          groupDetail?.members.length ?? parseInt(memberCount ?? "0", 10)
        }
      />

      <SettleBottomSheet
        isOpen={settleMember !== null}
        onClose={() => setSettleMember(null)}
        member={settleMember}
        groupId={id ?? ""}
        groupName={name ?? ""}
      />

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setShowAddExpense(true);
        }}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full items-center justify-center active:opacity-80"
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
    </SafeAreaView>
  );
}
