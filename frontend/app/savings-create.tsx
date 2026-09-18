import { useState } from "react";
import { useRouter, Redirect } from "expo-router";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";
import { ArrowLeft, LockKeyhole } from "lucide-react-native";
import { COLORS } from "@/utils/constants";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSmartAccountService } from "@/services/smartAccount.service";
import { SavingsLockService } from "@/services/savingsLock.service";
import { SAVINGS_ENABLED } from "@/utils/savingsConfig";

function SavingsCreateScreenEnabled() {
  const router = useRouter();
  const account = useAuthStore((state) => state.user?.smartAccountAddress);
  const smartAccount = useSmartAccountService();
  const [name, setName] = useState("Mon épargne");
  const [days, setDays] = useState("90");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericDays = Number(days);
  const unlockAt = Math.floor(Date.now() / 1000) + Math.floor(numericDays * 86400);
  const valid =
    SavingsLockService.isConfigured() &&
    !!smartAccount &&
    !!account &&
    name.trim().length > 0 &&
    name.length <= 64 &&
    numericDays >= 1 &&
    numericDays <= 365;

  const create = async () => {
    if (!valid || !smartAccount) return;
    setBusy(true);
    setError(null);
    try {
      const call = SavingsLockService.createLockCall(name.trim(), unlockAt);
      await smartAccount.sendContractCalls([{ target: call.target, data: call.data }]);
      router.replace("/");
    } catch (requestError: any) {
      setError(requestError?.message || "La création de l'épargne a échoué.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center px-6 py-4 border-b border-white/10">
        <Pressable onPress={() => router.back()} accessibilityLabel="Retour" className="w-11 h-11 rounded-full items-center justify-center bg-white/10">
          <ArrowLeft size={20} color={COLORS.white} />
        </Pressable>
        <Text className="ml-4 text-xl font-semibold text-white">Bloquer de l&apos;argent</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 50 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
          <View className="flex-row items-center">
            <View className="w-11 h-11 rounded-2xl bg-white/10 items-center justify-center">
              <LockKeyhole size={21} color={COLORS.accent} />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-white text-lg font-semibold">Règles immuables</Text>
              <Text className="text-white/50 text-sm mt-1">Base Sepolia · USDC · toi seul</Text>
            </View>
          </View>

          <Text className="text-white/55 text-sm leading-5 mt-5">
            Une fois créée, la date ne peut plus être changée. Personne ne peut sortir
            les fonds avant l&apos;échéance — ni ATARA, ni toi. C&apos;est ce qui fait
            la différence avec le solde courant.
          </Text>

          <Text className="text-white/50 text-xs uppercase mt-6 mb-2" style={{ letterSpacing: 1.4 }}>Nom</Text>
          <TextInput value={name} onChangeText={setName} maxLength={64} placeholder="Mon épargne" placeholderTextColor="rgba(255,255,255,0.25)" className="rounded-2xl border border-white/15 bg-black/40 px-4 py-4 text-white" />

          <Text className="text-white/50 text-xs uppercase mt-5 mb-2" style={{ letterSpacing: 1.4 }}>Durée du blocage (jours)</Text>
          <TextInput value={days} onChangeText={(value) => setDays(value.replace(/[^0-9]/g, ""))} keyboardType="number-pad" placeholder="90" placeholderTextColor="rgba(255,255,255,0.25)" className="rounded-2xl border border-white/15 bg-black/40 px-4 py-4 text-white" />
          <Text className="text-white/55 text-sm mt-3">
            Fonds bloqués jusqu&apos;au {new Date(unlockAt * 1000).toLocaleDateString("fr-FR", { dateStyle: "long" })}.
          </Text>
          <Text className="text-white/40 text-xs leading-5 mt-2">
            Les dépôts se ferment à cette date : le blocage couvre une période fixe.
          </Text>

          {error ? <Text accessibilityRole="alert" className="text-red-300 text-sm leading-5 mt-4">{error}</Text> : null}

          <Pressable onPress={create} disabled={!valid || busy} accessibilityRole="button" className="mt-6 h-14 rounded-2xl items-center justify-center" style={{ backgroundColor: COLORS.white, opacity: valid && !busy ? 1 : 0.4 }}>
            {busy ? <ActivityIndicator color={COLORS.black} /> : <Text className="font-semibold" style={{ color: COLORS.black }}>Créer l&apos;épargne</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function SavingsCreateScreen() {
  if (!SAVINGS_ENABLED) return <Redirect href="/" />;
  return <SavingsCreateScreenEnabled />;
}
