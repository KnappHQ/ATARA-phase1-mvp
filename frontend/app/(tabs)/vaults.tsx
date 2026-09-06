import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { ArrowLeft, ChevronRight, LockKeyhole, Plus } from "lucide-react-native";
import { COLORS } from "@/utils/constants";
import { useAuthStore } from "@/stores/useAuthStore";
import { VaultService } from "@/services/vault.service";
import { DEMO_MODE, DEMO_VAULT_ADDRESS } from "@/utils/demoMode";

const shortAddress = (address: string) => `${address.slice(0, 8)}…${address.slice(-6)}`;

export default function VaultsScreen() {
  const router = useRouter();
  const account = useAuthStore((state) => state.user?.smartAccountAddress);
  const [vaults, setVaults] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadVaults = useCallback(async () => {
    if (DEMO_MODE) {
      setVaults([DEMO_VAULT_ADDRESS]);
      setLoading(false);
      setError(null);
      return;
    }
    if (!account || !VaultService.isConfigured()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setVaults(await VaultService.getVaults(account));
      setError(null);
    } catch (requestError: any) {
      setError(requestError?.message || "Impossible de charger les Vaults.");
    } finally {
      setLoading(false);
    }
  }, [account]);

  useFocusEffect(useCallback(() => { void loadVaults(); }, [loadVaults]));

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-white/10">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="w-11 h-11 rounded-full items-center justify-center bg-white/10">
            <ArrowLeft size={20} color={COLORS.white} />
          </Pressable>
          <Text className="ml-4 text-xl font-semibold text-white">Vaults</Text>
        </View>
        <Pressable
          onPress={() => router.push("/vault-create")}
          disabled={!VaultService.isConfigured() && !DEMO_MODE}
          className="w-11 h-11 rounded-full items-center justify-center bg-white"
          style={{ opacity: VaultService.isConfigured() || DEMO_MODE ? 1 : 0.35 }}
        >
          <Plus size={21} color={COLORS.black} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <View className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
          {DEMO_MODE ? <View className="mb-5 rounded-2xl border border-blue-300/25 bg-blue-300/10 p-4"><Text className="text-blue-100 font-semibold">MODE SIMULATION</Text><Text className="text-blue-100/70 text-xs leading-5 mt-1">Ce Vault est fictif : aucune création et aucun dépôt ne touchent la blockchain.</Text></View> : null}
          <View className="flex-row items-center">
            <View className="w-11 h-11 rounded-2xl bg-white/10 items-center justify-center">
              <LockKeyhole size={21} color={COLORS.accent} />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-white text-lg font-semibold">Épargne collective</Text>
              <Text className="text-white/50 text-sm mt-1">Base Sepolia · USDC de test</Text>
            </View>
          </View>
          <Text className="text-white/60 text-sm leading-5 mt-5">
            Chaque membre accepte les règles, dépose ses fonds, puis valide chaque retrait. ATARA ne peut pas déplacer l’argent.
          </Text>
        </View>

        {!VaultService.isConfigured() && !DEMO_MODE ? (
          <View className="mt-4 rounded-3xl border border-amber-300/20 bg-amber-300/5 p-5">
            <Text className="text-amber-100 font-semibold">Vault en préparation</Text>
            <Text className="text-amber-100/65 text-sm leading-5 mt-2">
              Le contrat Base Sepolia doit être déployé et vérifié avant d’activer la création de Vaults.
            </Text>
          </View>
        ) : loading ? (
          <View className="items-center py-12"><ActivityIndicator color={COLORS.white} /></View>
        ) : error ? (
          <View className="mt-5 rounded-3xl border border-red-300/20 bg-red-300/5 p-5"><Text className="text-red-200 text-sm">{error}</Text></View>
        ) : vaults.length === 0 ? (
          <View className="items-center py-12"><Text className="text-white/50 text-sm">Aucun Vault pour le moment.</Text></View>
        ) : (
          <View className="mt-5">
            {vaults.map((vault) => (
              <Pressable key={vault} onPress={() => router.push({ pathname: "/vault-detail", params: { address: vault } })} className="flex-row items-center rounded-2xl border border-white/10 bg-white/[0.04] p-4 mb-3">
                <View className="w-10 h-10 rounded-xl bg-white/10 items-center justify-center"><LockKeyhole size={18} color={COLORS.white} /></View>
                <View className="flex-1 ml-3"><Text className="text-white font-semibold">Vault collectif</Text><Text className="text-white/45 text-xs font-mono mt-1">{shortAddress(vault)}</Text></View>
                <ChevronRight size={18} color="rgba(255,255,255,0.45)" />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
