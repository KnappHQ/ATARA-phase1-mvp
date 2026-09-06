import { View, Text, ScrollView, Pressable, Platform, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Plus } from "lucide-react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
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
  const [autoCollectEnabled, setAutoCollectEnabled] = useState(false);

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

        <View
          className="mx-6 mb-6 rounded-2xl border border-white/10 p-4"
          style={{ backgroundColor: `${COLORS.white}06` }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-4">
              <Text className="text-white text-sm font-semibold">Collecte automatique</Text>
              <Text className="text-white/50 text-xs leading-5 mt-1">
                Prépare une demande de règlement avec accord explicite, plafond et contrôle de solde.
              </Text>
            </View>
            <Switch
              value={autoCollectEnabled}
              onValueChange={setAutoCollectEnabled}
              trackColor={{ false: "rgba(255,255,255,0.15)", true: `${COLORS.accent}88` }}
              thumbColor={autoCollectEnabled ? COLORS.accent : "#777"}
            />
          </View>
          <Text className="text-white/40 text-[11px] leading-4 mt-3">
            Le contrat devra vérifier : solde disponible ≥ dette + 20 % (avec réserve minimum), autorisation du membre et plafond de collecte. Aucun débit automatique n’est actif tant que le contrat audité n’est pas déployé.
          </Text>
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
