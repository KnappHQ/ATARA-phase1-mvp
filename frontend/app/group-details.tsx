import { View, Text, ScrollView, Pressable, Platform, Alert, TextInput, Modal, ActivityIndicator } from "react-native";
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
import { GroupService } from "@/services/group.service";
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
  const [showInvite, setShowInvite] = useState(false);
  const [inviteHandle, setInviteHandle] = useState("");
  const [inviting, setInviting] = useState(false);
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
          memberCount={groupDetail?.members.length ?? parseInt(memberCount ?? "0", 10)}
          onBack={() => router.back()}
        />

        {groupDetail && (
          <MemberBalanceList
            memberBalances={groupDetail.memberBalances}
            onSettle={(member) => setSettleMember(member)}
          />
        )}

        {groupDetail?.members.length === 1 && (
          <View className="mx-6 mb-5 rounded-2xl border border-white/20 p-4">
            <Text className="text-white font-semibold mb-2">This group only has you</Text>
            <Text className="text-white/60 mb-3">The person you selected may have been your own account. Add another member to share expenses.</Text>
            <Pressable onPress={() => setShowInvite(true)}><Text style={{ color: COLORS.accent }}>Add a member</Text></Pressable>
          </View>
        )}

        <View className="mx-6 mb-6 rounded-2xl border border-white/10 p-4">
          <Text className="text-white text-sm font-semibold">Shared expenses · {groupDetail?.assetSymbol ?? "USDC"}</Text>
          <Pressable className="py-3" onPress={async () => { try { const result = await retryPendingSettlements(); if (id) await fetchGroupDetail(id); Alert.alert("Checking receipts", `${result.settled} payment(s) reconciled. ${result.remaining} still pending. Do not pay again for a transfer already sent.`); } catch (error) { Alert.alert("Verification", error instanceof Error ? error.message : "Try again shortly."); } }}><Text style={{ color: COLORS.accent }}>Check pending payments</Text></Pressable>
          <Text className="text-white/50 text-xs leading-5 mt-2">Each member accepts or disputes their share. Only accepted shares count toward what you owe. You confirm every payment.</Text>
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

      <Modal visible={showInvite} transparent animationType="slide" onRequestClose={() => setShowInvite(false)}>
        <View className="flex-1 justify-end bg-black/80">
          <View className="rounded-t-3xl bg-[#151217] p-6 pb-12">
            <Text className="text-white text-xl font-semibold mb-3">Add a member</Text>
            <Text className="text-white/60 mb-3">Enter the other person’s @handle.</Text>
            <TextInput accessibilityLabel="Member handle" autoCapitalize="none" autoCorrect={false} value={inviteHandle} onChangeText={setInviteHandle} placeholder="@handle" placeholderTextColor="#777" className="text-white bg-white/10 p-4 rounded-2xl mb-4" />
            <Pressable disabled={inviting || !/^@?[a-zA-Z0-9_]{1,32}$/.test(inviteHandle.trim())} onPress={async () => {
              if (!id || inviting) return;
              setInviting(true);
              try {
                await GroupService.addMembers(id, [inviteHandle.trim()]);
                await fetchGroupDetail(id);
                setShowInvite(false); setInviteHandle("");
              } catch (error: any) { Alert.alert("Couldn't add member", error?.response?.data?.message ?? "Check the handle and try again."); }
              finally { setInviting(false); }
            }} className="rounded-2xl p-4" style={{ backgroundColor: COLORS.accent, opacity: inviting || !inviteHandle.trim() ? .5 : 1 }}>
              {inviting ? <ActivityIndicator color="#000" /> : <Text className="text-black font-semibold text-center">Add member</Text>}
            </Pressable>
            <Pressable disabled={inviting} onPress={() => setShowInvite(false)} className="p-4"><Text className="text-white/70 text-center">Cancel</Text></Pressable>
          </View>
        </View>
      </Modal>

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
          if (groupDetail?.members.length === 1) setShowInvite(true);
          else setShowAddExpense(true);
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
