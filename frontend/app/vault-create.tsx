import { useEffect, useMemo, useState } from "react";
import { useRouter, Redirect } from "expo-router";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";
import { ArrowLeft, LockKeyhole, UserPlus, X } from "lucide-react-native";
import { isAddress } from "viem";
import { COLORS } from "@/utils/constants";
import { useAuthStore } from "@/stores/useAuthStore";
import { useContactStore, type Contact } from "@/stores/useContactStore";
import { useSmartAccountService } from "@/services/smartAccount.service";
import { VaultService } from "@/services/vault.service";
import { DEMO_MODE, DEMO_MEMBER_ADDRESS, DEMO_VAULT_ADDRESS, DEMO_VAULT_CONTACTS } from "@/utils/demoMode";

const VAULTS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_VAULTS === "true";

function VaultCreateScreenEnabled() {
  const router = useRouter();
  const account = useAuthStore((state) => state.user?.smartAccountAddress);
  const smartAccount = useSmartAccountService();
  const [name, setName] = useState("Notre cagnotte");
  const [memberText, setMemberText] = useState("");
  const [inviteQuery, setInviteQuery] = useState("");
  const [invitedContacts, setInvitedContacts] = useState<Contact[]>([]);
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recentContacts = useContactStore((state) => state.recentContacts);
  const favoriteContacts = useContactStore((state) => state.favoriteContacts);
  const searchResults = useContactStore((state) => state.searchResults);
  const getRecentContacts = useContactStore((state) => state.getRecentContacts);
  const searchContacts = useContactStore((state) => state.searchContacts);
  const clearSearch = useContactStore((state) => state.clearSearch);

  useEffect(() => { void getRecentContacts(); }, [getRecentContacts]);
  useEffect(() => {
    const query = inviteQuery.trim().replace(/^@/, "");
    if (!query || DEMO_MODE) { clearSearch(); return; }
    void searchContacts(query);
  }, [clearSearch, inviteQuery, searchContacts]);

  const contactSuggestions = useMemo(() => {
    const demoContacts: Contact[] = DEMO_VAULT_CONTACTS.map((contact) => ({
      id: contact.address,
      handle: contact.handle,
      name: contact.name,
      smartAccountAddress: contact.address,
    }));
    const pool = DEMO_MODE ? demoContacts : [...favoriteContacts, ...recentContacts, ...searchResults];
    const query = inviteQuery.trim().toLocaleLowerCase("fr").replace(/^@/, "");
    const unique = new Map<string, Contact>();
    pool.forEach((contact) => {
      if (!contact.smartAccountAddress || !isAddress(contact.smartAccountAddress)) return;
      if (query && !contact.handle.toLocaleLowerCase("fr").includes(query) && !(contact.name || "").toLocaleLowerCase("fr").includes(query)) return;
      unique.set(contact.smartAccountAddress.toLowerCase(), contact);
    });
    return [...unique.values()]
      .filter((contact) => !invitedContacts.some((item) => item.smartAccountAddress.toLowerCase() === contact.smartAccountAddress.toLowerCase()))
      .sort((a, b) => (a.name || a.handle).localeCompare(b.name || b.handle, "fr", { sensitivity: "base" }))
      .slice(0, 8);
  }, [favoriteContacts, inviteQuery, invitedContacts, recentContacts, searchResults]);

  const members = useMemo(() => {
    const all = [account || (DEMO_MODE ? DEMO_MEMBER_ADDRESS : ""), ...invitedContacts.map((contact) => contact.smartAccountAddress), ...memberText.split(/[\s,;]+/).filter(Boolean)];
    return [...new Set(all.map((value) => value.trim().toLowerCase()))];
  }, [account, invitedContacts, memberText]);
  const numericDays = Number(days);
  const unlockAt = Math.floor(Date.now() / 1000) + Math.floor(numericDays * 86400);
  const valid = (DEMO_MODE || VaultService.isConfigured()) && (DEMO_MODE || (!!smartAccount && !!account)) && name.trim().length > 0 && name.length <= 64 && numericDays >= 1 && numericDays <= 365 && members.length >= 2 && members.length <= 10 && members.every((member) => isAddress(member));

  const create = async () => {
    if (!valid) return;
    setBusy(true); setError(null);
    try {
      if (DEMO_MODE) {
        router.replace({ pathname: "/vault-detail", params: { address: DEMO_VAULT_ADDRESS } });
        return;
      }
      if (!smartAccount) return;
      const call = VaultService.createVaultCall(name.trim(), members, unlockAt);
      await smartAccount.sendContractCalls([{ target: call.target, data: call.data }]);
      router.replace("/vaults");
    } catch (requestError: any) {
      setError(requestError?.message || "La création du Vault a échoué.");
    } finally { setBusy(false); }
  };

  const addInvite = (contact: Contact) => {
    setInvitedContacts((current) => current.some((item) => item.smartAccountAddress.toLowerCase() === contact.smartAccountAddress.toLowerCase()) ? current : [...current, contact]);
    setInviteQuery("");
    clearSearch();
  };

  const removeInvite = (address: string) => {
    setInvitedContacts((current) => current.filter((contact) => contact.smartAccountAddress.toLowerCase() !== address.toLowerCase()));
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center px-6 py-4 border-b border-white/10"><Pressable onPress={() => router.back()} className="w-11 h-11 rounded-full items-center justify-center bg-white/10"><ArrowLeft size={20} color={COLORS.white} /></Pressable><Text className="ml-4 text-xl font-semibold text-white">Créer un Vault</Text></View>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
        <View className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
          {DEMO_MODE ? <View className="mb-5 rounded-2xl border border-blue-300/25 bg-blue-300/10 p-4"><Text className="text-blue-100 font-semibold">MODE SIMULATION</Text><Text className="text-blue-100/70 text-xs leading-5 mt-1">La création sera visualisée sans publier de contrat.</Text></View> : null}
          <View className="flex-row items-center"><View className="w-11 h-11 rounded-2xl bg-white/10 items-center justify-center"><LockKeyhole size={21} color={COLORS.accent} /></View><View className="flex-1 ml-3"><Text className="text-white text-lg font-semibold">Règles immuables</Text><Text className="text-white/50 text-sm mt-1">Base Sepolia · USDC · 2 à 10 membres</Text></View></View>
          <Text className="text-white/55 text-sm leading-5 mt-5">Le nom et les adresses des membres seront publics sur la blockchain. Le retrait restera soumis à l’accord de tout le monde.</Text>
          <Text className="text-white/50 text-xs uppercase mt-6 mb-2" style={{ letterSpacing: 1.4 }}>Nom public</Text>
          <TextInput value={name} onChangeText={setName} maxLength={64} placeholder="Notre cagnotte" placeholderTextColor="rgba(255,255,255,0.25)" className="rounded-2xl border border-white/15 bg-black/40 px-4 py-4 text-white" />
          <Text className="text-white/50 text-xs uppercase mt-5 mb-2" style={{ letterSpacing: 1.4 }}>Inviter des contacts</Text>
          <View className="rounded-2xl border border-white/15 bg-black/40 p-3">
            <View className="flex-row items-center"><UserPlus size={16} color={COLORS.accent} /><TextInput value={inviteQuery} onChangeText={setInviteQuery} autoCapitalize="none" autoCorrect={false} placeholder="@handle pour rechercher" placeholderTextColor="rgba(255,255,255,0.25)" className="flex-1 px-3 py-2 text-white" /></View>
            {inviteQuery.trim().startsWith("@") && contactSuggestions.length > 0 ? <View className="mt-2 border-t border-white/10 pt-2">{contactSuggestions.map((contact) => <Pressable key={contact.smartAccountAddress} onPress={() => addInvite(contact)} className="flex-row items-center rounded-xl px-2 py-3"><View className="w-8 h-8 rounded-full bg-white/10 items-center justify-center"><Text className="text-white text-xs font-semibold">{(contact.name || contact.handle).slice(0, 2).toUpperCase()}</Text></View><View className="flex-1 ml-3"><Text className="text-white text-sm">{contact.handle}</Text><Text className="text-white/45 text-xs mt-0.5">{contact.name || contact.smartAccountAddress.slice(0, 10) + "…"}</Text></View><Text className="text-white/40 text-lg">＋</Text></Pressable>)}</View> : null}
            {invitedContacts.length > 0 ? <View className="flex-row flex-wrap mt-2">{invitedContacts.map((contact) => <View key={contact.smartAccountAddress} className="flex-row items-center rounded-full bg-white/10 px-3 py-2 mr-2 mb-2"><Text className="text-white text-xs">{contact.handle}</Text><Pressable onPress={() => removeInvite(contact.smartAccountAddress)} hitSlop={8} className="ml-2"><X size={13} color="rgba(255,255,255,0.65)" /></Pressable></View>)}</View> : null}
          </View>
          <Text className="text-white/40 text-xs leading-5 mt-2">Les membres invités devront accepter les règles du Vault avant tout dépôt. Les invitations ajoutent leur smart account à la liste publique.</Text>
          <Text className="text-white/50 text-xs uppercase mt-5 mb-2" style={{ letterSpacing: 1.4 }}>Adresses supplémentaires</Text>
          <TextInput value={memberText} onChangeText={setMemberText} multiline autoCapitalize="none" autoCorrect={false} placeholder="0x… , 0x…" placeholderTextColor="rgba(255,255,255,0.25)" className="min-h-[92px] rounded-2xl border border-white/15 bg-black/40 px-4 py-4 text-sm text-white" />
          <Text className="text-white/40 text-xs leading-5 mt-2">Ton compte est ajouté automatiquement. {members.length}/10 membres préparés.</Text>
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

export default function VaultCreateScreen() {
  if (!VAULTS_ENABLED) return <Redirect href="/" />;
  return <VaultCreateScreenEnabled />;
}
