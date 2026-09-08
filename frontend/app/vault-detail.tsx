import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";
import { ArrowLeft, Check, LockKeyhole, ShieldCheck, Trash2, Users } from "lucide-react-native";
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
  const isCancelled = Boolean(snapshot?.cancelled);
  const hasProposal = !!snapshot?.proposalId && !snapshot.proposal.executed && !snapshot.proposal.cancelled && snapshot.chainTimestamp < snapshot.proposal.expiresAt;
  const unanimous = hasProposal && snapshot!.proposal.approvalCount === snapshot!.members.length;
  const cancellationUnanimous = !!snapshot && snapshot.cancellationApprovalCount === snapshot.members.length;

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
  const toggleCancellationApproval = () => {
    if (!snapshot || !member || isCancelled) return;
    const nextValue = !member.cancellationApproved;
    return run(
      [VaultService.cancellationApprovalCall(vaultAddress, nextValue)],
      DEMO_MODE ? (current) => ({
        ...current,
        cancellationApprovalCount: current.cancellationApprovalCount + (nextValue ? 1 : -1),
        members: current.members.map((item) => item.address.toLowerCase() === member.address.toLowerCase() ? { ...item, cancellationApproved: nextValue } : item),
      }) : undefined,
      nextValue ? "Ta confirmation de suppression est enregistrée." : "Ta confirmation de suppression a été retirée.",
    );
  };
  const simulateOtherCancellationApprovals = () => {
    if (!snapshot || !DEMO_MODE || isCancelled) return;
    return run([], (current) => ({
      ...current,
      cancellationApprovalCount: current.members.length,
      members: current.members.map((item) => ({ ...item, cancellationApproved: true })),
    }), "Simulation : les autres membres ont confirmé la suppression.");
  };
  const cancelVault = () => {
    if (!snapshot || !cancellationUnanimous || isCancelled) return;
    const refunds = snapshot.members
      .map((item) => `${short(item.address)} : ${formatUnits(BigInt(item.contribution), 6)} USDC`)
      .filter((line) => !line.endsWith("0 USDC"))
      .join(" · ");
    return run(
      DEMO_MODE ? [] : [VaultService.cancelVaultCall(vaultAddress)],
      DEMO_MODE ? (current) => ({
        ...current,
        balance: "0",
        totalDeposited: "0",
        cancelled: true,
        members: current.members.map((item) => ({ ...item, contribution: "0" })),
      }) : undefined,
      `Vault supprimé. Chaque part est retournée à son déposant : ${refunds || "aucun dépôt"}.`,
    );
  };

  if (!snapshot) {
    return <SafeAreaView className="flex-1 bg-black"><View className="flex-row items-center px-6 py-4"><Pressable onPress={() => router.back()} className="w-11 h-11 rounded-full items-center justify-center bg-white/10"><ArrowLeft size={20} color={COLORS.white} /></Pressable><Text className="ml-4 text-xl font-semibold text-white">Vault</Text></View><View className="flex-1 items-center justify-center px-8">{error ? <Text className="text-red-300 text-center leading-5">{error}</Text> : <ActivityIndicator color={COLORS.white} />}</View></SafeAreaView>;
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center px-6 py-4 border-b border-white/10"><Pressable onPress={() => router.back()} className="w-11 h-11 rounded-full items-center justify-center bg-white/10"><ArrowLeft size={20} color={COLORS.white} /></Pressable><Text className="ml-4 text-xl font-semibold text-white">{snapshot.name}</Text></View>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 54 }} showsVerticalScrollIndicator={false}>
        <View className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
          {DEMO_MODE ? <View className="mb-5 rounded-2xl border border-blue-300/25 bg-blue-300/10 p-4"><Text className="text-blue-100 font-semibold">MODE SIMULATION</Text><Text className="text-blue-100/70 text-xs leading-5 mt-1">Données fictives. Les dépôts et retraits ne sont pas exécutés sur Base Sepolia.</Text></View> : null}
          <View className="flex-row items-center"><View className="w-11 h-11 rounded-2xl bg-white/10 items-center justify-center"><LockKeyhole size={21} color={isCancelled ? "#fca5a5" : COLORS.accent} /></View><View className="flex-1 ml-3"><Text className="text-white text-lg font-semibold">Solde du Vault</Text><Text className="text-white/50 text-sm mt-1">{formatUnits(BigInt(snapshot.balance), 6)} USDC</Text></View></View>
          <Text className="text-white text-xl font-semibold mt-6">{isCancelled ? "Vault supprimé — parts remboursées" : isLocked ? `Fonds bloqués jusqu’au ${dateTime(snapshot.unlockAt)}` : "Date atteinte — accord unanime encore requis"}</Text>
          {!isCancelled ? <Text className="text-white/45 text-xs mt-2">Heure UTC : {new Date(snapshot.unlockAt * 1000).toISOString().replace("T", " ").replace(".000Z", " UTC")}</Text> : <Text className="text-red-200/70 text-xs mt-2">Le solde est à zéro et chaque contribution enregistrée a été renvoyée à son déposant.</Text>}
          <View className="h-2 rounded-full bg-white/10 mt-5 overflow-hidden"><View className="h-full rounded-full" style={{ width: `${Math.min(100, (snapshot.acceptedCount / snapshot.members.length) * 100)}%`, backgroundColor: COLORS.accent }} /></View>
          <Text className="text-white/60 text-sm mt-2">{snapshot.acceptedCount}/{snapshot.members.length} membres ont accepté les règles</Text>
          <View className="flex-row items-center mt-5 rounded-2xl bg-white/5 p-4"><ShieldCheck size={18} color="#4ade80" /><Text className="flex-1 ml-3 text-xs leading-5 text-white/60">La date ne libère jamais automatiquement les fonds. Chaque membre doit valider le même retrait ou la suppression collective.</Text></View>
        </View>

        {!member ? <View className="mt-4 rounded-2xl bg-red-300/5 border border-red-300/20 p-4"><Text className="text-red-200 text-sm">Ce portefeuille n’est pas membre de ce Vault.</Text></View> : null}
        {member && !member.accepted && !isCancelled ? <Pressable onPress={accept} disabled={busy || isLocked === false} className="mt-4 rounded-2xl bg-white p-4" style={{ opacity: busy || !isLocked ? 0.4 : 1 }}><Text className="text-center font-semibold" style={{ color: COLORS.black }}>J’accepte les règles du Vault</Text></Pressable> : null}

        <View className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-5"><View className="flex-row items-center"><Users size={18} color={COLORS.white} /><Text className="text-white font-semibold ml-2">Invitations et membres</Text></View><Text className="text-white/45 text-xs leading-5 mt-2">Les membres sont choisis lors de la création, puis chacun accepte les règles depuis son compte. Un Vault déployé ne peut pas ajouter une adresse en silence.</Text>{snapshot.members.map((item) => <View key={item.address} className="flex-row items-center py-3 border-b border-white/5"><View className="w-7 h-7 rounded-full bg-white/10 items-center justify-center">{item.accepted ? <Check size={14} color="#4ade80" /> : null}</View><View className="flex-1 ml-3"><Text className="text-white text-xs font-mono">{short(item.address)}</Text><Text className="text-white/40 text-xs mt-1">{formatUnits(BigInt(item.contribution), 6)} USDC déposés</Text></View><Text className="text-white/50 text-xs">{item.accepted ? "Règles acceptées" : "Invitation en attente"}</Text></View>)}</View>

        {member && allAccepted && isLocked && !isCancelled ? <View className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-5"><Text className="text-white font-semibold">Déposer des USDC</Text><TextInput value={depositAmount} onChangeText={(value) => setDepositAmount(value.replace(/[^0-9.,]/g, ""))} keyboardType="decimal-pad" placeholder="Montant" placeholderTextColor="rgba(255,255,255,0.25)" className="mt-4 rounded-2xl border border-white/15 bg-black/40 px-4 py-4 text-white" /><Pressable onPress={deposit} disabled={busy || !depositAmount} className="mt-4 h-13 rounded-2xl bg-white items-center justify-center" style={{ opacity: busy || !depositAmount ? 0.4 : 1 }}><Text className="font-semibold" style={{ color: COLORS.black }}>Déposer en USDC</Text></Pressable></View> : null}

        {member && !isLocked && allAccepted && !isCancelled ? <View className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-5"><Text className="text-white font-semibold">Proposer un retrait</Text>{hasProposal ? <><Text className="text-white/60 text-sm mt-3">{formatUnits(BigInt(snapshot.proposal.amount), 6)} USDC vers {short(snapshot.proposal.recipient)}</Text><Text className="text-white/50 text-sm mt-1">Accords : {snapshot.proposal.approvalCount}/{snapshot.members.length}</Text><Pressable onPress={toggleApproval} disabled={busy} className="mt-4 h-13 rounded-2xl bg-white items-center justify-center" style={{ opacity: busy ? 0.4 : 1 }}><Text className="font-semibold" style={{ color: COLORS.black }}>{member.approved ? "Retirer mon accord" : "Valider ce retrait"}</Text></Pressable>{unanimous ? <Pressable onPress={execute} disabled={busy} className="mt-3 h-13 rounded-2xl border border-white/20 items-center justify-center"><Text className="font-semibold text-white">Exécuter le retrait</Text></Pressable> : null}</> : <><TextInput value={recipient} onChangeText={setRecipient} autoCapitalize="none" placeholder="Adresse du bénéficiaire (0x…)" placeholderTextColor="rgba(255,255,255,0.25)" className="mt-4 rounded-2xl border border-white/15 bg-black/40 px-4 py-4 text-sm text-white" /><TextInput value={withdrawAmount} onChangeText={(value) => setWithdrawAmount(value.replace(/[^0-9.,]/g, ""))} keyboardType="decimal-pad" placeholder="Montant USDC" placeholderTextColor="rgba(255,255,255,0.25)" className="mt-3 rounded-2xl border border-white/15 bg-black/40 px-4 py-4 text-white" /><Pressable onPress={propose} disabled={busy || !isAddress(recipient) || !withdrawAmount} className="mt-4 h-13 rounded-2xl bg-white items-center justify-center" style={{ opacity: busy || !isAddress(recipient) || !withdrawAmount ? 0.4 : 1 }}><Text className="font-semibold" style={{ color: COLORS.black }}>Proposer le retrait</Text></Pressable></>}</View> : null}

        {member && !isCancelled && BigInt(snapshot.totalWithdrawn) === 0n ? <View className="mt-5 rounded-3xl border border-red-300/20 bg-red-300/[0.04] p-5"><View className="flex-row items-center"><Trash2 size={18} color="#fca5a5" /><Text className="text-red-100 font-semibold ml-2">Supprimer le Vault et rembourser</Text></View><Text className="text-red-100/65 text-sm leading-5 mt-3">La suppression n’est jamais unilatérale. Chaque membre doit confirmer, puis chaque contribution enregistrée retourne à son propre déposant.</Text><Text className="text-red-100/75 text-sm mt-3">Confirmations : {snapshot.cancellationApprovalCount}/{snapshot.members.length}</Text><Pressable onPress={toggleCancellationApproval} disabled={busy} className="mt-4 h-13 rounded-2xl border border-red-200/30 items-center justify-center" style={{ opacity: busy ? 0.4 : 1 }}><Text className="font-semibold text-red-100">{member.cancellationApproved ? "Retirer ma confirmation" : "Confirmer la suppression"}</Text></Pressable>{DEMO_MODE && !cancellationUnanimous ? <Pressable onPress={simulateOtherCancellationApprovals} disabled={busy} className="mt-3 h-13 rounded-2xl border border-white/15 items-center justify-center"><Text className="font-semibold text-white/75">Simulation : confirmer pour les autres membres</Text></Pressable> : null}{cancellationUnanimous ? <Pressable onPress={cancelVault} disabled={busy} className="mt-3 h-13 rounded-2xl bg-red-200 items-center justify-center" style={{ opacity: busy ? 0.4 : 1 }}><Text className="font-semibold text-black">Supprimer et rembourser chaque part</Text></Pressable> : null}</View> : null}
        {member && !isCancelled && BigInt(snapshot.totalWithdrawn) > 0n ? <View className="mt-5 rounded-3xl border border-amber-300/20 bg-amber-300/[0.04] p-5"><Text className="text-amber-100 font-semibold">Remboursement exact indisponible</Text><Text className="text-amber-100/65 text-sm leading-5 mt-2">Un retrait a déjà été exécuté. Les contributions historiques ne correspondent plus au solde restant, donc le Vault ne peut pas promettre de rendre exactement chaque part.</Text></View> : null}

        {error ? <Text className="text-red-300 text-sm leading-5 mt-4">{error}</Text> : null}
        {message ? <Text className="text-green-300 text-sm leading-5 mt-4">{message}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
