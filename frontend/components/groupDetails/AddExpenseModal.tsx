import { useRef, useState } from "react";
import { View, Text, TextInput, Modal, Pressable, ScrollView, ActivityIndicator } from "react-native";
import * as Crypto from "expo-crypto";
import { COLORS } from "@/utils/constants";
import { useGroupStore } from "@/stores/useGroupStore";
import { useAlertStore } from "@/stores/useAlertStore";

export const AddExpenseModal = ({ isOpen, onClose, groupId }: {
  isOpen: boolean; onClose: () => void; groupId: string; memberCount: number;
}) => {
  const { addExpense, groupDetail } = useGroupStore();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [custom, setCustom] = useState(false);
  const [shares, setShares] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const key = useRef<{ signature: string; id: string } | null>(null);
  const members = [...(groupDetail?.members ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  const total = /^\d+(\.\d{1,2})?$/.test(amount) ? Math.round(Number(amount) * 100) : 0;
  const unit = groupDetail?.assetSymbol ?? "USDC";
  const breakdown = members.map((m, i) => ({ userId: m.id, amount: custom ? (shares[m.id] ?? "0") : ((Math.floor(total / members.length) + (i < total % members.length ? 1 : 0)) / 100).toFixed(2) }));
  const splitTotal = breakdown.reduce((sum, s) => sum + Math.round(Number(s.amount) * 100), 0);
  const valid = total > 0 && total <= 100_000_000 && description.trim().length > 0 && description.length <= 240 && members.length > 0 &&
    breakdown.every(s => /^\d+(\.\d{1,2})?$/.test(s.amount)) && splitTotal === total;
  const close = () => { if (!busy) onClose(); };
  const submit = async () => {
    if (busy || !valid) return;
    setBusy(true);
    const signature = JSON.stringify([groupId, description.trim(), amount, breakdown]);
    if (key.current?.signature !== signature) key.current = { signature, id: Crypto.randomUUID() };
    try {
      await addExpense(groupId, description.trim(), Number(amount), key.current.id, custom ? breakdown : undefined);
      setDescription(""); setAmount(""); setShares({}); key.current = null; onClose();
    } catch (error: any) {
      useAlertStore.getState().error("Dépense non ajoutée", error?.response?.data?.message ?? "Réessaie : une réponse perdue ne créera pas de doublon.");
    } finally { setBusy(false); }
  };
  return <Modal visible={isOpen} transparent animationType="slide" onRequestClose={close}>
    <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,.75)" }}>
      <View style={{ backgroundColor: "#100e12", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: "90%", borderWidth: 1, borderColor: "#302b32" }}>
        <Text className="text-white text-xl font-semibold mb-4">Ajouter une dépense</Text>
        <ScrollView keyboardShouldPersistTaps="handled">
          <Text className="text-white/50 mb-2">Tu as avancé cet argent pour le groupe.</Text>
          <TextInput accessibilityLabel="Description" value={description} onChangeText={setDescription} maxLength={240} editable={!busy} placeholder="Restaurant, taxi, week-end…" placeholderTextColor="#666" className="text-white bg-white/5 rounded-2xl p-4 mb-3" />
          <Text className="text-white/60 mb-2">Montant en {unit}</Text>
          <TextInput accessibilityLabel={`Montant en ${unit}`} value={amount} onChangeText={v => setAmount(v.replace(",", "."))} editable={!busy} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#666" className="text-white text-2xl bg-white/5 rounded-2xl p-4 mb-3" />
          <View className="flex-row gap-3 my-2">
            {[false, true].map(option => <Pressable key={String(option)} disabled={busy} onPress={() => setCustom(option)} className="flex-1 p-3 rounded-full" style={{ backgroundColor: custom === option ? COLORS.accent : "#222" }}><Text style={{ textAlign: "center", color: custom === option ? "#000" : "#fff" }}>{option ? "Personnalisé" : "Parts égales"}</Text></Pressable>)}
          </View>
          {members.map((member, i) => <View key={member.id} className="flex-row items-center justify-between py-3 border-b border-white/10">
            <Text className="text-white flex-1">@{member.handle}</Text>
            {custom ? <TextInput accessibilityLabel={`Part de ${member.handle}`} value={shares[member.id] ?? ""} onChangeText={v => setShares(s => ({ ...s, [member.id]: v.replace(",", ".") }))} placeholder="0.00" placeholderTextColor="#666" editable={!busy} keyboardType="decimal-pad" className="text-white p-2 bg-white/5 rounded-xl w-24 text-right" /> : <Text className="text-white/70">{breakdown[i].amount} {unit}</Text>}
          </View>)}
          <Text className="text-white/50 text-xs leading-5 my-4">Chaque participant reçoit une proposition à accepter ou contester. Les centimes restants sont répartis pour conserver exactement le total.{custom && splitTotal !== total ? ` Reste à répartir : ${((total - splitTotal) / 100).toFixed(2)} ${unit}.` : ""}</Text>
        </ScrollView>
        <View className="flex-row gap-3 pt-3">
          <Pressable onPress={close} disabled={busy} className="flex-1 rounded-2xl bg-white/10 p-4"><Text className="text-white text-center">Fermer</Text></Pressable>
          <Pressable onPress={submit} disabled={!valid || busy} className="flex-1 rounded-2xl p-4" style={{ backgroundColor: COLORS.accent, opacity: valid && !busy ? 1 : .4 }}>{busy ? <ActivityIndicator color="#000" /> : <Text className="text-black text-center">Proposer les parts</Text>}</Pressable>
        </View>
      </View>
    </View>
  </Modal>;
};
