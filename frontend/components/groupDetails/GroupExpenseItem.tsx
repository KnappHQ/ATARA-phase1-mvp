import { View, Text, Pressable } from "react-native";
import { MotiView } from "moti";
import { COLORS } from "@/utils/constants";
import { useGroupStore, type GroupExpenseDetail } from "@/stores/useGroupStore";
import { useState } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAlertStore } from "@/stores/useAlertStore";
import { GroupService } from "@/services/group.service";
import { getInitials } from "@/utils/format";

interface GroupExpenseItemProps {
  expense: GroupExpenseDetail;
  index: number;
  memberCount: number;
}

export const GroupExpenseItem = ({
  expense,
  index,
  memberCount,
}: GroupExpenseItemProps) => {
  const me = useAuthStore(s => s.user?.id);
  const [busy, setBusy] = useState(false);
  const decide = async (decision: "ACCEPTED" | "DISPUTED") => {
    if (busy) return;
    setBusy(true);
    try {
      await GroupService.decideSplit(expense.id, decision);
      const store = useGroupStore.getState();
      if (store.groupDetail) await store.fetchGroupDetail(store.groupDetail.id);
      await store.fetchGroups();
    } catch (error: any) { useAlertStore.getState().error("Part non modifiée", error?.response?.data?.message ?? "Réessaie dans un instant."); }
    finally { setBusy(false); }
  };
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 150, delay: index * 40 }}
      style={{
        marginBottom: 8,
        padding: 16,
        borderRadius: 16,
        backgroundColor: `${COLORS.white}08`,
        borderWidth: 1,
        borderColor: `${COLORS.white}10`,
      }}
    >
      <View className="flex-row items-center gap-3 mb-2">
        <View
          className="w-12 h-12 rounded-full items-center justify-center"
          style={{
            backgroundColor: `${COLORS.white}0a`,
            borderWidth: 1,
            borderColor: `${COLORS.white}1a`,
          }}
        >
          <Text className="text-xs font-semibold text-white">
            {getInitials(
              expense.paidByName.startsWith("@") ? null : expense.paidByName,
              expense.paidByName,
            )}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-base text-white">
            <Text className="font-semibold">{expense.paidByName}</Text>
            <Text style={{ color: `${COLORS.white}80` }}> paid </Text>
            <Text className="font-mono font-semibold">
              {expense.amount.toFixed(2)} {expense.assetSymbol}
            </Text>
          </Text>
          <Text
            className="text-sm mt-0.5"
            style={{ color: `${COLORS.white}66` }}
          >
            for {expense.description}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        <Text
          className="text-xs font-mono"
          style={{ color: `${COLORS.white}4d` }}
        >
          {expense.date}
        </Text>
        <Text
          className="text-xs font-mono"
          style={{ color: `${COLORS.white}99` }}
        >
          {expense.splits.length} parts
        </Text>
      </View>
      <View className="mt-3 gap-2">
        {expense.splits.map(split => <View key={split.id}>
          <Text className="text-white/60 text-xs">{split.userId === me ? "Ta part" : `@${split.user?.handle ?? "membre"}`} : {Number(split.amount).toFixed(2)} {expense.assetSymbol} · {split.settled ? "réglée" : split.decision === "ACCEPTED" ? "acceptée" : split.decision === "DISPUTED" ? "contestée" : "à valider"}</Text>
          {split.userId === me && !split.settled ? <View className="flex-row gap-4 mt-2">
            {split.decision !== "ACCEPTED" && <Pressable disabled={busy} onPress={() => decide("ACCEPTED")}><Text style={{ color: COLORS.accent }}>Accepter ma part</Text></Pressable>}
            {split.decision !== "DISPUTED" && <Pressable disabled={busy} onPress={() => decide("DISPUTED")}><Text className="text-white/60">Contester</Text></Pressable>}
          </View> : null}
        </View>)}
      </View>
    </MotiView>
  );
};
