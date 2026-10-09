import { useMemo, useRef, useState } from "react";
import { View, Text, TextInput, Modal, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Check } from "lucide-react-native";
import * as Crypto from "expo-crypto";
import { COLORS } from "@/utils/constants";
import { useGroupStore } from "@/stores/useGroupStore";
import { useAlertStore } from "@/stores/useAlertStore";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  MAX_TOTAL_CENTS,
  computeSplit,
  customSplitsToSend,
  formatCents,
  hasSomeoneElse,
  sharingIds,
  summaryLines,
  toCents,
  type SplitMode,
} from "@/utils/expenseSplit";

type Step = "paid" | "split" | "summary";

const MODES: { id: SplitMode; label: string }[] = [
  { id: "equal", label: "Equal" },
  { id: "custom", label: "Custom amounts" },
  { id: "percent", label: "%" },
];

/**
 * Adding an expense in three steps: who paid, how it is split, then a summary of what each
 * person owes before anything is saved. Only the people already in the group can share it;
 * someone who has not accepted an invitation is shown, but cannot be given a share yet.
 */
export const AddExpenseModal = ({ isOpen, onClose, groupId }: {
  isOpen: boolean; onClose: () => void; groupId: string; memberCount: number;
}) => {
  const { addExpense, groupDetail } = useGroupStore();
  const myId = useAuthStore((state) => state.user?.id) ?? "";
  const [step, setStep] = useState<Step>("paid");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<SplitMode>("equal");
  const [excluded, setExcluded] = useState<Record<string, boolean>>({});
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  // The last attempt the server may have received (no answer, or a 5xx): a retry resends it
  // as it was, so a lost response never turns into a second expense, even if someone accepted
  // an invitation in between and `members` changed.
  const unconfirmed = useRef<{ inputs: string; id: string; customSplits?: { userId: string; amount: string }[]; splitWithUserIds: string[] } | null>(null);

  const members = useMemo(() => [...(groupDetail?.members ?? [])].sort((a, b) => a.id.localeCompare(b.id)), [groupDetail?.members]);
  const pending = groupDetail?.pendingMembers ?? [];
  const unit = groupDetail?.assetSymbol ?? "USDC";
  const handles = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m.handle])), [members]);

  const totalCents = toCents(amount) ?? 0;
  const amountOk = totalCents > 0 && totalCents <= MAX_TOTAL_CENTS;
  const detailsOk = amountOk && description.trim().length > 0 && description.length <= 240;

  // Everyone in the group shares it, unless unticked. The payer always does.
  const selected = Object.fromEntries(members.map((m) => [m.id, m.id === myId || !excluded[m.id]]));
  const ids = sharingIds(selected, myId);
  const someoneElse = hasSomeoneElse(ids, myId);
  const split = computeSplit({ mode, totalCents, ids, typed, unit });
  const splitOk = amountOk && someoneElse && !!split.shares;
  const lines = split.shares ? summaryLines(split.shares, handles, myId, unit) : [];

  const reset = () => {
    setStep("paid"); setDescription(""); setAmount(""); setMode("equal"); setExcluded({}); setTyped({});
  };
  const close = () => { if (!busy) onClose(); };

  const submit = async () => {
    if (busy || !splitOk) return;
    setBusy(true);
    const inputs = JSON.stringify([groupId, description.trim(), amount, mode, ids, mode === "equal" ? null : typed]);
    const attempt = unconfirmed.current?.inputs === inputs
      ? unconfirmed.current
      : { inputs, id: Crypto.randomUUID(), customSplits: customSplitsToSend(mode, split.shares), splitWithUserIds: ids };
    try {
      // Always say who shares it: the ticked people who are already in the group.
      await addExpense(groupId, description.trim(), Number(amount), attempt.id, attempt.customSplits, attempt.splitWithUserIds);
      unconfirmed.current = null;
      reset();
      onClose();
    } catch (error: any) {
      const status = error?.response?.status;
      unconfirmed.current = !status || status >= 500 ? attempt : null;
      useAlertStore.getState().error("Expense not added", error?.response?.data?.message ?? (status === 409
        ? "Wait for invitations to be accepted, or add the expense only for people who are already in the group."
        : "Try again: a lost response will not create a duplicate."));
    } finally { setBusy(false); }
  };

  const title = step === "paid" ? "Who paid?" : step === "split" ? "Split how?" : "Review";

  return <Modal visible={isOpen} transparent animationType="slide" onRequestClose={close}>
    <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,.75)" }}>
      <View style={{ backgroundColor: "#100e12", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: "90%", borderWidth: 1, borderColor: "#302b32" }}>
        <Text className="text-white/40 text-xs mb-1">Step {step === "paid" ? 1 : step === "split" ? 2 : 3} of 3</Text>
        <Text className="text-white text-xl font-semibold mb-4">{title}</Text>

        <ScrollView keyboardShouldPersistTaps="handled">
          {step === "paid" && <>
            <View className="rounded-2xl p-4 mb-4" style={{ borderWidth: 1, borderColor: COLORS.accent, backgroundColor: "rgba(255,255,255,0.04)" }}>
              <Text className="text-white font-semibold">You paid</Text>
              <Text className="text-white/55 text-sm leading-5 mt-1">The person who paid adds the expense, so it is recorded as paid by you. Next you choose who shares it.</Text>
            </View>
            <TextInput accessibilityLabel="Description" value={description} onChangeText={setDescription} maxLength={240} editable={!busy} placeholder="Restaurant, taxi, week-end…" placeholderTextColor="#666" className="text-white bg-white/5 rounded-2xl p-4 mb-3" />
            <Text className="text-white/60 mb-2">Amount in {unit}</Text>
            <TextInput accessibilityLabel={`Amount in ${unit}`} value={amount} onChangeText={(v) => setAmount(v.replace(",", "."))} editable={!busy} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#666" className="text-white text-2xl bg-white/5 rounded-2xl p-4 mb-3" />
            {members.length < 2 && <Text className="text-amber-300 text-sm mb-3">Nobody else is in this group yet. Invited people can share an expense once they accept.</Text>}
          </>}

          {step === "split" && <>
            <View className="flex-row gap-2 my-2">
              {MODES.map((option) => <Pressable key={option.id} disabled={busy} onPress={() => setMode(option.id)} accessibilityRole="button" accessibilityState={{ selected: mode === option.id }} className="flex-1 p-3 rounded-full" style={{ backgroundColor: mode === option.id ? COLORS.accent : "#222" }}><Text style={{ textAlign: "center", color: mode === option.id ? "#000" : "#fff" }}>{option.label}</Text></Pressable>)}
            </View>
            <Text className="text-white/50 text-sm my-2">
              {mode === "equal" ? "Everyone ticked pays the same." : mode === "custom" ? `Enter what each person owes. It must add up to ${formatCents(totalCents)} ${unit}.` : "Enter each person's percentage. It must add up to 100%."}
            </Text>

            {members.map((member) => {
              const isMe = member.id === myId;
              const on = selected[member.id];
              return <View key={member.id} className="flex-row items-center py-3 border-b border-white/10">
                <Pressable disabled={isMe || busy} onPress={() => setExcluded((current) => ({ ...current, [member.id]: on }))} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: isMe }} accessibilityLabel={isMe ? "You share this expense" : `@${member.handle} shares this expense`} hitSlop={8} className="flex-row items-center flex-1">
                  <View className="w-6 h-6 rounded-md items-center justify-center mr-3" style={{ borderWidth: 1, borderColor: on ? COLORS.accent : "#555", backgroundColor: on ? COLORS.accent : "transparent", opacity: isMe ? 0.6 : 1 }}>
                    {on && <Check size={14} color="#000" strokeWidth={3} />}
                  </View>
                  <Text className="text-white flex-1">{isMe ? `You (@${member.handle})` : `@${member.handle}`}</Text>
                </Pressable>
                {!on ? <Text className="text-white/35 text-sm">Not sharing</Text>
                  : mode === "equal" ? <Text className="text-white/70">{split.shares ? formatCents(split.shares[member.id] ?? 0) : "0.00"} {unit}</Text>
                  : <View className="flex-row items-center">
                      <TextInput accessibilityLabel={mode === "percent" ? `Percentage for @${member.handle}` : `Share for @${member.handle}`} value={typed[member.id] ?? ""} onChangeText={(v) => setTyped((current) => ({ ...current, [member.id]: v.replace(",", ".") }))} placeholder={mode === "percent" ? "0" : "0.00"} placeholderTextColor="#666" editable={!busy} keyboardType="decimal-pad" className="text-white p-2 bg-white/5 rounded-xl w-24 text-right" />
                      <Text className="text-white/50 ml-1 w-10">{mode === "percent" ? "%" : unit}</Text>
                    </View>}
              </View>;
            })}

            {pending.map((member) => <View key={member.id} className="flex-row items-center py-3 border-b border-white/10" accessibilityLabel={`@${member.handle} is invited and cannot share yet`}>
              <View className="w-6 h-6 rounded-md mr-3" style={{ borderWidth: 1, borderColor: "#444", opacity: 0.4 }} />
              <Text className="text-white/40 flex-1">@{member.handle}</Text>
              <Text className="text-white/35 text-sm">{"Invited · can't share yet"}</Text>
            </View>)}

            {!someoneElse && <Text accessibilityRole="alert" className="text-amber-300 text-sm font-semibold mt-3">Tick at least one other person to share this expense with.</Text>}
            {someoneElse && split.error && <Text accessibilityRole="alert" className="text-amber-300 text-sm font-semibold mt-3">{split.error}</Text>}
          </>}

          {step === "summary" && <>
            <View className="rounded-2xl p-4 mb-4 bg-white/5">
              <Text className="text-white font-semibold">You paid {formatCents(totalCents)} {unit}</Text>
              <Text className="text-white/55 text-sm mt-1" numberOfLines={2}>{description.trim()}</Text>
            </View>
            {lines.map((line) => <Text key={line.userId} className="text-white py-2 border-b border-white/10">{line.text}</Text>)}
            <Text className="text-white/60 text-sm leading-5 my-4">Each person gets a share to accept or dispute. Nothing is paid until they do and you both confirm.</Text>
          </>}
        </ScrollView>

        <View className="flex-row gap-3 pt-3">
          {step === "paid"
            ? <Pressable onPress={close} disabled={busy} className="flex-1 rounded-2xl bg-white/10 p-4"><Text className="text-white text-center">Close</Text></Pressable>
            : <Pressable onPress={() => setStep(step === "summary" ? "split" : "paid")} disabled={busy} className="flex-1 rounded-2xl bg-white/10 p-4"><Text className="text-white text-center">Back</Text></Pressable>}
          {step === "paid" && <Pressable onPress={() => setStep("split")} disabled={!detailsOk || members.length < 2} className="flex-1 rounded-2xl p-4" style={{ backgroundColor: COLORS.accent, opacity: detailsOk && members.length > 1 ? 1 : .4 }}><Text className="text-black text-center">Next: split</Text></Pressable>}
          {step === "split" && <Pressable onPress={() => setStep("summary")} disabled={!splitOk} className="flex-1 rounded-2xl p-4" style={{ backgroundColor: COLORS.accent, opacity: splitOk ? 1 : .4 }}><Text className="text-black text-center">Review</Text></Pressable>}
          {step === "summary" && <Pressable onPress={submit} disabled={!splitOk || busy} className="flex-1 rounded-2xl p-4" style={{ backgroundColor: COLORS.accent, opacity: splitOk && !busy ? 1 : .4 }}>{busy ? <ActivityIndicator color="#000" /> : <Text className="text-black text-center">Add expense</Text>}</Pressable>}
        </View>
      </View>
    </View>
  </Modal>;
};
