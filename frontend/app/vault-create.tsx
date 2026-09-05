import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";
import { ArrowLeft, LockKeyhole } from "lucide-react-native";
import { isAddress } from "viem";
import { COLORS } from "@/utils/constants";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSmartAccountService } from "@/services/smartAccount.service";
import { VaultService } from "@/services/vault.service";

export default function VaultCreateScreen() {
  const router = useRouter();
  const account = useAuthStore((state) => state.user?.smartAccountAddress);
  const smartAccount = useSmartAccountService();
  const [name, setName] = useState("Notre cagnotte");
  const [memberText, setMemberText] = useState("");
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const members = useMemo(() => {
    const all = [account || "", ...memberText.split(/[\s,;]+/).filter(Boolean)];
    return [...new Set(all.map((value) => value.trim().toLowerCase()))];
  }, [account, memberText]);
  const numericDays = Number(days);
  const unlockAt = Math.floor(Date.now() / 1000) + Math.floor(numericDays * 86400);
  const valid = VaultService.isConfigured() && !!smartAccount && !!account && name.trim().length > 0 && name.length <= 64 && numericDays >= 1 && numericDays <= 365 && members.length >= 2 && members.length <= 10 && members.every((member) => isAddress(member));

  const create = async () => {
    if (!valid || !smartAccount) return;
    setBusy(true); setError(null);
    try {
      const call = VaultService.createVaultCall(name.trim(), members, unlockAt);
      await smartAccount.sendContractCalls([{ target: call.target, data: call.data }]);
      router.replace("/vaults");
    } catch (requestError: any) {
      setError(requestError?.message || "La création du Vault a échoué.");
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center px-6 py-4 border-b border-white/10"><Pressable onPress={() => router.back()} className="w-11 h-11 rounded-full items-center justify-center bg-white/10"><ArrowLeft size={20} color={COLORS.white} /></Pressable><Text className="ml-4 text-xl font-semibold text-white">Créer un Vault</Text></View>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
        <View className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
          <View className="flex-row items-center"><View className="w-11 h-11 rounded-2xl bg-white/10 items-center justify-center"><LockKeyhole size={21} color={COLORS.accent} /></View><View className="flex-1 ml-3"><Text className="text-white text-lg font-semibold">Règles immuables</Text><Text className="text-white/50 text-sm mt-1">Base Sepolia · USDC · 2 à 10 membres</Text></View></View>
          <Text className="text-white/55 text-sm leading-5 mt-5">Le nom et les adresses des membres seront publics sur la blockchain. Le retrait restera soumis à l’accord de tout le monde.</Text>
          <Text className="text-white/50 text-xs uppercase mt-6 mb-2" style={{ letterSpacing: 1.4 }}>Nom public</Text>
          <TextInput value={name} onChangeText={setName} maxLength={64} placeholder="Notre cagnotte" placeholderTextColor="rgba(255,255,255,0.25)" className="rounded-2xl border border-white/15 bg-black/40 px-4 py-4 text-white" />
          <Text className="text-white/50 text-xs uppercase mt-5 mb-2" style={{ letterSpacing: 1.4 }}>Adresses des autres membres</Text>
          <TextInput value={memberText} onChangeText={setMemberText} multiline autoCapitalize="none" autoCorrect={false} placeholder="0x… , 0x…" placeholderTextColor="rgba(255,255,255,0.25)" className="min-h-[92px] rounded-2xl border border-white/15 bg-black/40 px-4 py-4 text-sm text-white" />
          <Text className="text-white/40 text-xs leading-5 mt-2">Ton compte est ajouté automatiquement. Utilise les adresses smart account ATARA de tes membres.</Text>
          <Text className="text-white/50 text-xs uppercase mt-5 mb-2" style={{ letterSpacing: 1.4 }}>Durée avant retrait (jours)</Text>
          <TextInput value={days} onChangeText={(value) => setDays(value.replace(/[^0-9]/g, ""))} keyboardType="number-pad" placeholder="30" placeholderTextColor="rgba(255,255,255,0.25)" className="rounded-2xl border border-white/15 bg-black/40 px-4 py-4 text-white" />
          <Text className="text-white/55 text-sm mt-3">Fonds bloqués jusqu’au {new Date(unlockAt * 1000).toLocaleDateString("fr-FR", { dateStyle: "long" })}.</Text>
          {error ? <Text className="text-red-300 text-sm leading-5 mt-4">{error}</Text> : null}
          <Pressable onPress={create} disabled={!valid || busy} className="mt-6 h-14 rounded-2xl items-center justify-center" style={{ backgroundColor: COLORS.white, opacity: valid && !busy ? 1 : 0.4 }}>{busy ? <ActivityIndicator color={COLORS.black} /> : <Text className="font-semibold" style={{ color: COLORS.black }}>Créer le Vault</Text>}</Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
