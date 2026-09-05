import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";
import { ArrowLeft, Check, LockKeyhole, ShieldCheck, Users } from "lucide-react-native";
import { formatUnits, isAddress, keccak256, stringToHex } from "viem";
import { COLORS } from "@/utils/constants";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSmartAccountService } from "@/services/smartAccount.service";
import { VaultService, type VaultSnapshot } from "@/services/vault.service";
import { DEMO_MODE, DEMO_MEMBER_ADDRESS, DEMO_VAULT_ADDRESS, getDemoVaultSnapshot } from "@/utils/demoMode";

const dateTime = (timestamp: number) => new Date(timestamp * 1000).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
const short = (address: string) => `${address.slice(0, 8)}…${address.slice(-6)}`;

export default function VaultDetailScreen() {
  const router = useRouter();
  const { address } = useLocalSearchParams<{ address?: string }>();
  const account = useAuthStore((state) => state.user?.smartAccountAddress?.toLowerCase());
  const smartAccount = useSmartAccountService();
  const [snapshot, setSnapshot] = useState<VaultSnapshot | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const vaultAddress = address || "";
  const load = useCallback(async () => {
    if (DEMO_MODE && vaultAddress === DEMO_VAULT_ADDRESS) {
      setSnapshot(getDemoVaultSnapshot(account));
      setError(null);
      return;
    }
    if (!isAddress(vaultAddress)) return;
    try { setSnapshot(await VaultService.getSnapshot(vaultAddress)); setError(null); } catch (requestError: any) { setError(requestError?.message || "Impossible de charger ce Vault."); }
  }, [account, vaultAddress]);
  useEffect(() => { void load(); }, [load]);

  const member = useMemo(() => snapshot?.members.find((item) => item.address.toLowerCase() === (account || (DEMO_MODE ? DEMO_MEMBER_ADDRESS : "").toLowerCase())), [account, snapshot]);
  const isLocked = snapshot ? snapshot.chainTimestamp < snapshot.unlockAt : true;
  const allAccepted = snapshot ? snapshot.acceptedCount === snapshot.members.length : false;
  const hasProposal = !!snapshot?.proposalId && !snapshot.proposal.executed && !snapshot.proposal.cancelled && snapshot.chainTimestamp < snapshot.proposal.expiresAt;
  const unanimous = hasProposal && snapshot!.proposal.approvalCount === snapshot!.members.length;

  const run = async (calls: { target: `0x${string}`; data: `0x${string}` | string }[], simulate?: (current: VaultSnapshot) => VaultSnapshot, successMessage?: string) => {
    if (DEMO_MODE && simulate) {
      setSnapshot((current) => current ? simulate(current) : current);
      setMessage(successMessage || "Action simulée. Aucune transaction réelle n’a été envoyée.");
      return;
    }
    if (!smartAccount) { setError("Connexion au portefeuille en cours…"); return; }
    setBusy(true); setError(null);
    try { await smartAccount.sendContractCalls(calls); await load(); } catch (requestError: any) { setError(requestError?.message || "La transaction a échoué."); } finally { setBusy(false); }
  };

  const accept = () => run([VaultService.acceptCall(vaultAddress)]);
  const deposit = () => {
    if (!depositAmount || Number(depositAmount.replace(",", ".")) <= 0) return;
    const depositId = keccak256(stringToHex(`${vaultAddress}:${account}:${depositAmount}:${Date.now()}`));
    const rawAmount = Number(depositAmount.replace(",", "."));
    return run(DEMO_MODE ? [] : VaultService.depositCalls(vaultAddress, depositAmount.replace(",", "."), depositId), DEMO_MODE ? (current) => ({
      ...current,
      balance: (BigInt(current.balance) + BigInt(Math.round(rawAmount * 1_000_000))).toString(),
      totalDeposited: (BigInt(current.totalDeposited) + BigInt(Math.round(rawAmount * 1_000_000))).toString(),
      members: current.members.map((item) => item.address.toLowerCase() === (account || DEMO_MEMBER_ADDRESS).toLowerCase() ? { ...item, contribution: (BigInt(item.contribution) + BigInt(Math.round(rawAmount * 1_000_000))).toString() } : item),
    }) : undefined, `Simulation : dépôt de ${rawAmount.toFixed(2)} USDC ajouté au Vault.`);
  };
  const propose = () => {
    if (!isAddress(recipient) || !withdrawAmount || Number(withdrawAmount.replace(",", ".")) <= 0 || !snapshot) return;
    return run([VaultService.proposeCall(vaultAddress, recipient, withdrawAmount.replace(",", "."), snapshot.proposalId + 1)]);
  };
  const toggleApproval = () => {
    if (!snapshot) return;
    return run([VaultService.approvalCall(vaultAddress, snapshot.proposalId, !member?.approved)]);
  };
  const execute = () => snapshot && run([VaultService.executeCall(vaultAddress, snapshot.proposalId)]);

  if (!snapshot) {
    return <SafeAreaView className="flex-1 bg-black"><View className="flex-row items-center px-6 py-4"><Pressable onPress={() => router.back()} className="w-11 h-11 rounded-full items-center justify-center bg-white/10"><ArrowLeft size={20} color={COLORS.white} /></Pressable><Text className="ml-4 text-xl font-semibold text-white">Vault</Text></View><View className="flex-1 items-center justify-center px-8">{error ? <Text className="text-red-300 text-center leading-5">{error}</Text> : <ActivityIndicator color={COLORS.white} />}</View></SafeAreaView>;
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center px-6 py-4 border-b border-white/10"><Pressable onPress={() => router.back()} className="w-11 h-11 rounded-full items-center justify-center bg-white/10"><ArrowLeft size={20} color={COLORS.white} /></Pressable><Text className="ml-4 text-xl font-semibold text-white">{snapshot.name}</Text></View>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 54 }} showsVerticalScrollIndicator={false}>
        <View className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
          {DEMO_MODE ? <View className="mb-5 rounded-2xl border border-blue-300/25 bg-blue-300/10 p-4"><Text className="text-blue-100 font-semibold">MODE SIMULATION</Text><Text className="text-blue-100/70 text-xs leading-5 mt-1">Données fictives. Les dépôts et retraits ne sont pas exécutés sur Base Sepolia.</Text></View> : null}
          <View className="flex-row items-center"><View className="w-11 h-11 rounded-2xl bg-white/10 items-center justify-center"><LockKeyhole size={21} color={COLORS.accent} /></View><View className="flex-1 ml-3"><Text className="text-white text-lg font-semibold">Solde du Vault</Text><Text className="text-white/50 text-sm mt-1">{formatUnits(BigInt(snapshot.balance), 6)} USDC</Text></View></View>
          <Text className="text-white text-xl font-semibold mt-6">{isLocked ? `Fonds bloqués jusqu’au ${dateTime(snapshot.unlockAt)}` : "Date atteinte — accord unanime encore requis"}</Text>
          <Text className="text-white/45 text-xs mt-2">Heure UTC : {new Date(snapshot.unlockAt * 1000).toISOString().replace("T", " ").replace(".000Z", " UTC")}</Text>
          <View className="h-2 rounded-full bg-white/10 mt-5 overflow-hidden"><View className="h-full rounded-full" style={{ width: `${Math.min(100, (snapshot.acceptedCount / snapshot.members.length) * 100)}%`, backgroundColor: COLORS.accent }} /></View>
          <Text className="text-white/60 text-sm mt-2">{snapshot.acceptedCount}/{snapshot.members.length} membres ont accepté les règles</Text>
          <View className="flex-row items-center mt-5 rounded-2xl bg-white/5 p-4"><ShieldCheck size={18} color="#4ade80" /><Text className="flex-1 ml-3 text-xs leading-5 text-white/60">La date ne libère jamais automatiquement les fonds. Chaque membre doit valider le même retrait.</Text></View>
        </View>

        {!member ? <View className="mt-4 rounded-2xl bg-red-300/5 border border-red-300/20 p-4"><Text className="text-red-200 text-sm">Ce portefeuille n’est pas membre de ce Vault.</Text></View> : null}
        {member && !member.accepted ? <Pressable onPress={accept} disabled={busy || isLocked === false} className="mt-4 rounded-2xl bg-white p-4" style={{ opacity: busy || !isLocked ? 0.4 : 1 }}><Text className="text-center font-semibold" style={{ color: COLORS.black }}>J’accepte les règles du Vault</Text></Pressable> : null}

        <View className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-5"><View className="flex-row items-center"><Users size={18} color={COLORS.white} /><Text className="text-white font-semibold ml-2">Membres</Text></View>{snapshot.members.map((item) => <View key={item.address} className="flex-row items-center py-3 border-b border-white/5"><View className="w-7 h-7 rounded-full bg-white/10 items-center justify-center">{item.accepted ? <Check size={14} color="#4ade80" /> : null}</View><View className="flex-1 ml-3"><Text className="text-white text-xs font-mono">{short(item.address)}</Text><Text className="text-white/40 text-xs mt-1">{formatUnits(BigInt(item.contribution), 6)} USDC déposés</Text></View><Text className="text-white/50 text-xs">{item.approved ? "Validé" : "En attente"}</Text></View>)}</View>

        {member && allAccepted && isLocked ? <View className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-5"><Text className="text-white font-semibold">Déposer des USDC</Text><TextInput value={depositAmount} onChangeText={(value) => setDepositAmount(value.replace(/[^0-9.,]/g, ""))} keyboardType="decimal-pad" placeholder="Montant" placeholderTextColor="rgba(255,255,255,0.25)" className="mt-4 rounded-2xl border border-white/15 bg-black/40 px-4 py-4 text-white" /><Pressable onPress={deposit} disabled={busy || !depositAmount} className="mt-4 h-13 rounded-2xl bg-white items-center justify-center" style={{ opacity: busy || !depositAmount ? 0.4 : 1 }}><Text className="font-semibold" style={{ color: COLORS.black }}>Déposer en USDC</Text></Pressable></View> : null}

        {member && !isLocked && allAccepted ? <View className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-5"><Text className="text-white font-semibold">Proposer un retrait</Text>{hasProposal ? <><Text className="text-white/60 text-sm mt-3">{formatUnits(BigInt(snapshot.proposal.amount), 6)} USDC vers {short(snapshot.proposal.recipient)}</Text><Text className="text-white/50 text-sm mt-1">Accords : {snapshot.proposal.approvalCount}/{snapshot.members.length}</Text><Pressable onPress={toggleApproval} disabled={busy} className="mt-4 h-13 rounded-2xl bg-white items-center justify-center" style={{ opacity: busy ? 0.4 : 1 }}><Text className="font-semibold" style={{ color: COLORS.black }}>{member.approved ? "Retirer mon accord" : "Valider ce retrait"}</Text></Pressable>{unanimous ? <Pressable onPress={execute} disabled={busy} className="mt-3 h-13 rounded-2xl border border-white/20 items-center justify-center"><Text className="font-semibold text-white">Exécuter le retrait</Text></Pressable> : null}</> : <><TextInput value={recipient} onChangeText={setRecipient} autoCapitalize="none" placeholder="Adresse du bénéficiaire (0x…)" placeholderTextColor="rgba(255,255,255,0.25)" className="mt-4 rounded-2xl border border-white/15 bg-black/40 px-4 py-4 text-sm text-white" /><TextInput value={withdrawAmount} onChangeText={(value) => setWithdrawAmount(value.replace(/[^0-9.,]/g, ""))} keyboardType="decimal-pad" placeholder="Montant USDC" placeholderTextColor="rgba(255,255,255,0.25)" className="mt-3 rounded-2xl border border-white/15 bg-black/40 px-4 py-4 text-white" /><Pressable onPress={propose} disabled={busy || !isAddress(recipient) || !withdrawAmount} className="mt-4 h-13 rounded-2xl bg-white items-center justify-center" style={{ opacity: busy || !isAddress(recipient) || !withdrawAmount ? 0.4 : 1 }}><Text className="font-semibold" style={{ color: COLORS.black }}>Proposer le retrait</Text></Pressable></>}</View> : null}

        {error ? <Text className="text-red-300 text-sm leading-5 mt-4">{error}</Text> : null}
        {message ? <Text className="text-green-300 text-sm leading-5 mt-4">{message}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
