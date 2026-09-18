import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter, Redirect } from "expo-router";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";
import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react-native";
import { formatUnits, isAddress, keccak256, stringToHex } from "viem";
import { usePrivy, useMfa } from "@privy-io/expo";
import { COLORS } from "@/utils/constants";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSmartAccountService } from "@/services/smartAccount.service";
import { SavingsLockService, type SavingsLockSnapshot } from "@/services/savingsLock.service";
import { SAVINGS_ENABLED } from "@/utils/savingsConfig";

const dateTime = (timestamp: number) =>
  new Date(timestamp * 1000).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });

function SavingsDetailScreenEnabled() {
  const router = useRouter();
  const { address } = useLocalSearchParams<{ address?: string }>();
  const account = useAuthStore((state) => state.user?.smartAccountAddress);
  const smartAccount = useSmartAccountService();
  const { user } = usePrivy();
  const { prompt } = useMfa();
  const [snapshot, setSnapshot] = useState<SavingsLockSnapshot | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lockAddress = address || "";
  const hasSecondFactor = (user?.mfa_methods?.length ?? 0) > 0;

  const load = useCallback(async () => {
    if (!isAddress(lockAddress)) return;
    try {
      setSnapshot(await SavingsLockService.getSnapshot(lockAddress));
      setError(null);
    } catch (requestError: any) {
      setError(requestError?.message || "Impossible de charger cette épargne.");
    }
  }, [lockAddress]);
  useEffect(() => { void load(); }, [load]);

  const isLocked = snapshot ? snapshot.chainTimestamp < snapshot.unlockAt : true;

  const run = async (calls: { target: `0x${string}`; data: `0x${string}` }[]) => {
    if (!smartAccount) { setError("Connexion au portefeuille en cours…"); return; }
    setBusy(true);
    setError(null);
    try {
      await smartAccount.sendContractCalls(calls);
      await load();
    } catch (requestError: any) {
      setError(requestError?.message || "La transaction a échoué.");
    } finally {
      setBusy(false);
    }
  };

  const deposit = async () => {
    if (!depositAmount || !isAddress(lockAddress)) return;
    const depositId = keccak256(stringToHex(`${lockAddress}:${depositAmount}:${Date.now()}`));
    await run(SavingsLockService.depositCalls(lockAddress, depositAmount, depositId));
  };

  const withdraw = async () => {
    if (!withdrawAmount || !account || !isAddress(lockAddress)) return;
    // Ask for the second factor before the signature, not after: once the call
    // is signed the money has moved, and a prompt at that point proves nothing.
    if (hasSecondFactor) {
      setBusy(true);
      try {
        await prompt();
      } catch {
        setError("Vérification annulée. Le retrait n'a pas été envoyé.");
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    const call = SavingsLockService.withdrawCall(lockAddress, account, withdrawAmount);
    await run([call]);
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center px-6 py-4 border-b border-white/10">
        <Pressable onPress={() => router.back()} accessibilityLabel="Retour" className="w-11 h-11 rounded-full items-center justify-center bg-white/10">
          <ArrowLeft size={20} color={COLORS.white} />
        </Pressable>
        <Text className="ml-4 text-xl font-semibold text-white">{snapshot?.name || "Épargne"}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 50 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
          <View className="flex-row items-center">
            <View className="w-11 h-11 rounded-2xl bg-white/10 items-center justify-center">
              <LockKeyhole size={21} color={COLORS.accent} />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-white text-2xl font-semibold">
                {snapshot ? `${formatUnits(BigInt(snapshot.balance), 6)} USDC` : "—"}
              </Text>
              <Text className="text-white/50 text-sm mt-1">
                {snapshot ? (isLocked ? `Bloqué jusqu'au ${dateTime(snapshot.unlockAt)}` : "Échéance atteinte — retrait possible") : "Chargement…"}
              </Text>
            </View>
          </View>
        </View>

        {snapshot && isLocked ? (
          <View className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 mt-4">
            <Text className="text-white/50 text-xs uppercase mb-2" style={{ letterSpacing: 1.4 }}>Ajouter</Text>
            <TextInput value={depositAmount} onChangeText={setDepositAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="rgba(255,255,255,0.25)" className="rounded-2xl border border-white/15 bg-black/40 px-4 py-4 text-white" />
            <Pressable onPress={deposit} disabled={busy || !depositAmount} accessibilityRole="button" className="mt-4 h-13 rounded-2xl items-center justify-center py-4" style={{ backgroundColor: COLORS.white, opacity: busy || !depositAmount ? 0.4 : 1 }}>
              {busy ? <ActivityIndicator color={COLORS.black} /> : <Text className="font-semibold" style={{ color: COLORS.black }}>Déposer</Text>}
            </Pressable>
          </View>
        ) : null}

        {snapshot && !isLocked ? (
          <View className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 mt-4">
            <Text className="text-white/50 text-xs uppercase mb-2" style={{ letterSpacing: 1.4 }}>Retirer</Text>
            <TextInput value={withdrawAmount} onChangeText={setWithdrawAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="rgba(255,255,255,0.25)" className="rounded-2xl border border-white/15 bg-black/40 px-4 py-4 text-white" />

            <View className="flex-row items-start gap-2 mt-4">
              <ShieldCheck size={15} color={hasSecondFactor ? COLORS.accent : "rgba(255,255,255,0.35)"} />
              <Text className="flex-1 text-white/45 text-xs leading-5">
                {hasSecondFactor
                  ? "Ton second facteur sera demandé avant la signature."
                  : "Aucun second facteur configuré : seule la date protège cette épargne. Tu peux en ajouter un dans Sécurité."}
              </Text>
            </View>

            <Pressable onPress={withdraw} disabled={busy || !withdrawAmount} accessibilityRole="button" className="mt-4 rounded-2xl items-center justify-center py-4" style={{ backgroundColor: COLORS.white, opacity: busy || !withdrawAmount ? 0.4 : 1 }}>
              {busy ? <ActivityIndicator color={COLORS.black} /> : <Text className="font-semibold" style={{ color: COLORS.black }}>Retirer</Text>}
            </Pressable>
          </View>
        ) : null}

        {error ? <Text accessibilityRole="alert" className="text-red-300 text-sm leading-5 mt-4">{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function SavingsDetailScreen() {
  if (!SAVINGS_ENABLED) return <Redirect href="/" />;
  return <SavingsDetailScreenEnabled />;
}
