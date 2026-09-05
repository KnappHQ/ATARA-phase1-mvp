import { useState } from "react";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { ArrowLeft, ExternalLink, ShieldCheck, WalletCards } from "lucide-react-native";
import { APP_NETWORK, COLORS, NETWORK_NAME } from "@/utils/constants";
import { OnrampService } from "@/services/onramp.service";
import { useWalletStore } from "@/stores/useWalletStore";

const formatError = (error: any) =>
  error?.response?.data?.message ||
  "Le service d’achat n’est pas encore configuré pour cette bêta.";

export default function AddCryptoScreen() {
  const router = useRouter();
  const [amount, setAmount] = useState("50");
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const walletAddress = useWalletStore((state) => state.smartAccountAddress);

  const openMoonPay = async () => {
    if (APP_NETWORK !== "base-sepolia") {
      setError("L’achat intégré est activé uniquement sur Base Sepolia pendant la bêta.");
      return;
    }
    if (!walletAddress) {
      setError("Ton portefeuille sécurisé n’est pas encore prêt.");
      return;
    }
    const numericAmount = Number(amount.replace(",", "."));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Indique un montant en euros supérieur à 0.");
      return;
    }

    setIsOpening(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const session = await OnrampService.createSession(numericAmount.toFixed(2));
      await WebBrowser.openBrowserAsync(session.url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        toolbarColor: COLORS.black,
      });
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center px-6 py-4 border-b border-white/10">
        <Pressable
          onPress={() => router.back()}
          className="w-11 h-11 rounded-full items-center justify-center bg-white/10"
        >
          <ArrowLeft size={20} color={COLORS.white} />
        </Pressable>
        <Text className="ml-4 text-xl font-semibold text-white">Ajouter des crypto</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
      >
        <View className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
          <View className="flex-row items-center">
            <View className="w-12 h-12 rounded-2xl bg-white/10 items-center justify-center">
              <WalletCards size={24} color={COLORS.accent} />
            </View>
            <View className="flex-1 ml-4">
              <Text className="text-white text-lg font-semibold">Acheter du USDC</Text>
              <Text className="text-white/50 text-sm mt-1">Envoyé directement sur ton compte ATARA</Text>
            </View>
          </View>

          <Text className="text-white/50 text-xs uppercase mt-7 mb-2" style={{ letterSpacing: 1.4 }}>
            Montant en euros
          </Text>
          <View className="flex-row items-center rounded-2xl border border-white/15 bg-black/40 px-4">
            <TextInput
              value={amount}
              onChangeText={(value) => setAmount(value.replace(/[^0-9.,]/g, ""))}
              keyboardType="decimal-pad"
              placeholder="50"
              placeholderTextColor="rgba(255,255,255,0.25)"
              className="flex-1 py-4 text-2xl text-white"
            />
            <Text className="text-white/60 text-lg">EUR</Text>
          </View>

          <View className="flex-row items-center mt-5 rounded-2xl bg-white/5 p-4">
            <ShieldCheck size={18} color="#4ade80" />
            <Text className="flex-1 ml-3 text-xs leading-5 text-white/60">
              MoonPay vérifie l’identité et le moyen de paiement selon ton pays. ATARA ne détient jamais tes fonds.
            </Text>
          </View>

          {error ? <Text className="mt-4 text-sm leading-5 text-red-300">{error}</Text> : null}

          <Pressable
            onPress={openMoonPay}
            disabled={isOpening}
            className="mt-5 h-14 rounded-2xl items-center justify-center"
            style={{ backgroundColor: COLORS.white, opacity: isOpening ? 0.65 : 1 }}
          >
            {isOpening ? (
              <ActivityIndicator color={COLORS.black} />
            ) : (
              <View className="flex-row items-center">
                <Text className="font-semibold" style={{ color: COLORS.black }}>Continuer avec MoonPay</Text>
                <ExternalLink size={16} color={COLORS.black} style={{ marginLeft: 8 }} />
              </View>
            )}
          </Pressable>
        </View>

        <View className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <Text className="text-white font-semibold">Réseau utilisé</Text>
          <Text className="text-white/60 text-sm mt-2">{NETWORK_NAME} · USDC · 6 décimales</Text>
          <Text className="text-white/45 text-xs leading-5 mt-3">
            Pendant la bêta, le réseau reste Base Sepolia. Vérifie toujours le réseau affiché avant de confirmer un achat.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
