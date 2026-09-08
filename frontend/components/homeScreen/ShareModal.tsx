import { useState } from "react";
import { Modal, Pressable, Share, Text, TextInput, ScrollView, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { SvgUri } from "react-native-svg";
import { useAuthStore } from "@/stores/useAuthStore";
import { useWalletStore } from "@/stores/useWalletStore";
import { api } from "@/services/api";
import { COLORS } from "@/utils/constants";

type Request = { id: string; url: string; amount: string; chainId: number; expiresAt: string };
export function ShareModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const user = useAuthStore(s => s.user);
  const address = useWalletStore(s => s.smartAccountAddress);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [request, setRequest] = useState<Request | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const mainnet = process.env.EXPO_PUBLIC_NETWORK === "base-mainnet";
  const run = async (action: () => Promise<unknown>) => {
    if (busy) return; setBusy(true); setMessage("");
    try { await action(); } catch (error: any) { setMessage(error?.response?.data?.message ?? error?.message ?? "Opération indisponible."); } finally { setBusy(false); }
  };
  return <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
    <View className="flex-1 bg-black/90 justify-end"><ScrollView style={{ maxHeight: "90%", backgroundColor: "#100d12", borderTopLeftRadius: 28, borderTopRightRadius: 28 }} contentContainerStyle={{ padding: 24, paddingBottom: 44 }} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onClose}><Text className="text-white/60 text-right mb-5">Fermer</Text></Pressable>
      <Text className="text-white text-2xl font-semibold">Recevoir · @{user?.handle ?? ""}</Text>
      <Text className="text-white/50 my-3">{mainnet ? "Base · Fonds réels" : "Base Sepolia · Fonds de test"}</Text>
      <Text selectable className="text-white/80 p-4 rounded-2xl bg-white/5">{address ?? "Portefeuille en cours de chargement"}</Text>
      <Pressable disabled={!address} onPress={() => run(async () => { await Clipboard.setStringAsync(address!); setMessage("Adresse copiée. Utilise uniquement le réseau indiqué."); })}><Text style={{ color: COLORS.accent }} className="my-4">Copier mon adresse Base</Text></Pressable>
      <Text className="text-white/50 text-xs mb-6">Cette adresse reçoit les actifs pris en charge sur Base. N’envoie pas de BTC, SOL ou XMR natifs à cette adresse.</Text>
      {!!message && <Text accessibilityRole="alert" className="text-white/70 my-3">{message}</Text>}
      {request ? <>
        <Text className="text-white text-xl">Demande de {request.amount} USDC</Text>
        <Text className="text-white/50 text-xs my-3">Expire le {new Date(request.expiresAt).toLocaleString("fr-FR")}</Text>
        <View className="items-center py-4"><SvgUri uri={request.url.replace("/pay/", "/") + "/qr"} width={190} height={190} /></View>
        <Pressable disabled={busy} className="p-4 rounded-2xl" style={{ backgroundColor: COLORS.accent }} onPress={() => run(() => Share.share({ message: `Demande ATARA · ${request.amount} USDC sur ${request.chainId === 84532 ? "Base Sepolia (test)" : "Base"}. ${request.url}` }))}><Text className="text-black text-center">Partager le lien</Text></Pressable>
        <Pressable disabled={busy} className="p-4" onPress={() => run(async () => { const token = request.url.split("/").pop(); const result = await api.get(`/requests/${token}`); setMessage({ PAID: "Paiement confirmé.", OPEN: "En attente de paiement.", EXPIRED: "Demande expirée.", CANCELLED: "Demande annulée." }[result.data.status as string] ?? "Statut indisponible."); })}><Text className="text-white text-center">Actualiser le statut</Text></Pressable>
        <Pressable disabled={busy} className="p-4" onPress={() => run(async () => { await api.delete(`/requests/${request.id}`); setRequest(null); setMessage("Demande annulée."); })}><Text className="text-white/60 text-center">Annuler cette demande</Text></Pressable>
        <Pressable disabled={busy} className="p-3" onPress={() => { setRequest(null); setAmount(""); setNote(""); }}><Text className="text-white/60 text-center">Créer une autre demande</Text></Pressable>
      </> : <>
        <Text className="text-white text-lg font-semibold">Demander un montant</Text>
        <TextInput accessibilityLabel="Montant demandé en USDC" placeholder="Montant en USDC" placeholderTextColor="#777" value={amount} onChangeText={v => setAmount(v.replace(",", "."))} keyboardType="decimal-pad" className="text-white text-xl bg-white/5 p-4 rounded-2xl mt-4" />
        <TextInput accessibilityLabel="Note de paiement" placeholder="Note facultative" placeholderTextColor="#777" maxLength={140} value={note} onChangeText={setNote} className="text-white bg-white/5 p-4 rounded-2xl my-3" />
        <Pressable disabled={busy || !/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0} onPress={() => run(async () => { const result = await api.post("/requests", { amount, note }); setRequest(result.data.request); })} className="p-4 rounded-2xl" style={{ backgroundColor: COLORS.accent }}><Text className="text-black text-center">{busy ? "Création…" : "Créer un lien valable 24 h"}</Text></Pressable>
        <Text className="text-white/40 text-xs leading-5 mt-4">Le lien contient une demande de paiement ; il ne donne jamais accès à tes fonds. La personne peut payer depuis son portefeuille compatible sans créer de compte ATARA.</Text>
      </>}
    </ScrollView></View>
  </Modal>;
}
