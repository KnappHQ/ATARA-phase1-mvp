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
    try { await action(); } catch (error: any) { setMessage(error?.response?.data?.message ?? error?.message ?? "Operation unavailable."); } finally { setBusy(false); }
  };
  return <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
    <View className="flex-1 bg-black/90 justify-end"><ScrollView style={{ maxHeight: "90%", backgroundColor: "#100d12", borderTopLeftRadius: 28, borderTopRightRadius: 28 }} contentContainerStyle={{ padding: 24, paddingBottom: 44 }} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onClose}><Text className="text-white/60 text-right mb-5">Close</Text></Pressable>
      <Text className="text-white text-2xl font-semibold">Receive · @{user?.handle ?? ""}</Text>
      <Text className="text-white/50 my-3">{mainnet ? "Base · Real funds" : "Base Sepolia · Test funds"}</Text>
      <Text selectable className="text-white/80 p-4 rounded-2xl bg-white/5">{address ?? "Loading wallet"}</Text>
      <Pressable disabled={!address} onPress={() => run(async () => { await Clipboard.setStringAsync(address!); setMessage("Address copied. Use only the network shown."); })}><Text style={{ color: COLORS.accent }} className="my-4">Copy my Base address</Text></Pressable>
      <Text className="text-white/50 text-xs mb-6">This address receives supported assets on Base. Do not send native BTC, SOL, or XMR to this address.</Text>
      {!!message && <Text accessibilityRole="alert" className="text-white/70 my-3">{message}</Text>}
      {request ? <>
        <Text className="text-white text-xl">Request for {request.amount} USDC</Text>
        <Text className="text-white/50 text-xs my-3">Expires on {new Date(request.expiresAt).toLocaleString("en-US")}</Text>
        <View className="items-center py-4"><SvgUri uri={request.url.replace("/pay/", "/") + "/qr"} width={190} height={190} /></View>
        <Pressable disabled={busy} className="p-4 rounded-2xl" style={{ backgroundColor: COLORS.accent }} onPress={() => run(() => Share.share({ message: `ATARA request · ${request.amount} USDC on ${request.chainId === 84532 ? "Base Sepolia (test)" : "Base"}. ${request.url}` }))}><Text className="text-black text-center">Share link</Text></Pressable>
        <Pressable disabled={busy} className="p-4" onPress={() => run(async () => { const token = request.url.split("/").pop(); const result = await api.get(`/requests/${token}`); setMessage({ PAID: "Payment confirmed.", OPEN: "Awaiting payment.", EXPIRED: "Request expired.", CANCELLED: "Request canceled." }[result.data.status as string] ?? "Status unavailable."); })}><Text className="text-white text-center">Refresh status</Text></Pressable>
        <Pressable disabled={busy} className="p-4" onPress={() => run(async () => { await api.delete(`/requests/${request.id}`); setRequest(null); setMessage("Request canceled."); })}><Text className="text-white/60 text-center">Cancel this request</Text></Pressable>
        <Pressable disabled={busy} className="p-3" onPress={() => { setRequest(null); setAmount(""); setNote(""); }}><Text className="text-white/60 text-center">Create another request</Text></Pressable>
      </> : <>
        <Text className="text-white text-lg font-semibold">Request an amount</Text>
        <TextInput accessibilityLabel="Requested amount in USDC" placeholder="Amount in USDC" placeholderTextColor="#777" value={amount} onChangeText={v => setAmount(v.replace(",", "."))} keyboardType="decimal-pad" className="text-white text-xl bg-white/5 p-4 rounded-2xl mt-4" />
        <TextInput accessibilityLabel="Note de paiement" placeholder="Optional note" placeholderTextColor="#777" maxLength={140} value={note} onChangeText={setNote} className="text-white bg-white/5 p-4 rounded-2xl my-3" />
        <Pressable disabled={busy || !/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0} onPress={() => run(async () => { const result = await api.post("/requests", { amount, note }); setRequest(result.data.request); })} className="p-4 rounded-2xl" style={{ backgroundColor: COLORS.accent }}><Text className="text-black text-center">{busy ? "Creating…" : "Create a link valid for 24 hours"}</Text></Pressable>
        <Text className="text-white/40 text-xs leading-5 mt-4">The link contains a payment request; it never grants access to your funds. Anyone with a compatible wallet can pay without an ATARA account.</Text>
      </>}
    </ScrollView></View>
  </Modal>;
}
