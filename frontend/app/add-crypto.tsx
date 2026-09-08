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
import {
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  WalletCards,
} from "lucide-react-native";
import { APP_NETWORK, COLORS, NETWORK_NAME } from "@/utils/constants";
import { DEMO_MODE } from "@/utils/demoMode";
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
  const [message, setMessage] = useState<string | null>(null);
  const walletAddress = useWalletStore((state) => state.smartAccountAddress);

  const openMoonPay = async () => {
    if (!DEMO_MODE && APP_NETWORK !== "base-sepolia") {
      setError(
        "Les achats réels ne sont pas encore disponibles dans cette version bêta.",
      );
      return;
    }
    const numericAmount = Number(amount.replace(",", "."));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Indique un montant en euros supérieur à 0.");
      return;
    }

    if (DEMO_MODE) {
      setError(null);
      setMessage(
        `Simulation : ${numericAmount.toFixed(2)} € convertis en USDC. Aucun achat réel n’a été effectué.`,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    if (!walletAddress) {
      setError("Ton portefeuille sécurisé n’est pas encore prêt.");
      return;
    }

    setIsOpening(true);
    setError(null);
    setMessage(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const session = await OnrampService.createSession(
        numericAmount.toFixed(2),
      );
      if (
        session.mode !== "sandbox" ||
        new URL(session.url).hostname !== "buy-sandbox.moonpay.com"
      ) {
        throw new Error("Unexpected live checkout in beta");
      }
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
        <Text className="ml-4 text-xl font-semibold text-white">
          Ajouter des crypto
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
      >
        <View className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
          {DEMO_MODE ? (
            <View className="mb-5 rounded-2xl border border-blue-300/25 bg-blue-300/10 p-4">
              <Text className="text-blue-100 font-semibold">
                MODE SIMULATION
              </Text>
              <Text className="text-blue-100/70 text-xs leading-5 mt-1">
                Aucun paiement, aucune crypto reçue. Cet écran sert uniquement à
                tester le parcours.
              </Text>
            </View>
          ) : null}
          <View className="flex-row items-center">
            <View className="w-12 h-12 rounded-2xl bg-white/10 items-center justify-center">
              <WalletCards size={24} color={COLORS.accent} />
            </View>
            <View className="flex-1 ml-4">
              <Text className="text-white text-lg font-semibold">
                Tester l’achat de USDC
              </Text>
              <Text className="text-white/50 text-sm mt-1">
                Parcours de test · aucun USDC réel reçu
              </Text>
            </View>
          </View>

          <Text
            className="text-white/50 text-xs uppercase mt-7 mb-2"
            style={{ letterSpacing: 1.4 }}
          >
            Montant en euros
          </Text>
          <View className="flex-row items-center rounded-2xl border border-white/15 bg-black/40 px-4">
            <TextInput
              value={amount}
              onChangeText={(value) =>
                setAmount(value.replace(/[^0-9.,]/g, ""))
              }
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
              Le sandbox MoonPay simule le parcours d’achat. Aucun paiement réel
              et aucun dépôt sur Base Sepolia.
            </Text>
          </View>

          {error ? (
            <Text className="mt-4 text-sm leading-5 text-red-300">{error}</Text>
          ) : null}
          {message ? (
            <Text className="mt-4 text-sm leading-5 text-green-300">
              {message}
            </Text>
          ) : null}

          <Pressable
            onPress={openMoonPay}
            disabled={isOpening}
            className="mt-5 h-14 rounded-2xl items-center justify-center"
            style={{
              backgroundColor: COLORS.white,
              opacity: isOpening ? 0.65 : 1,
            }}
          >
            {isOpening ? (
              <ActivityIndicator color={COLORS.black} />
            ) : (
              <View className="flex-row items-center">
                <Text className="font-semibold" style={{ color: COLORS.black }}>
                  {DEMO_MODE ? "Simuler l’achat" : "Tester MoonPay (sandbox)"}
                </Text>
                {!DEMO_MODE ? (
                  <ExternalLink
                    size={16}
                    color={COLORS.black}
                    style={{ marginLeft: 8 }}
                  />
                ) : null}
              </View>
            )}
          </Pressable>
        </View>

        <View className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <Text className="text-white font-semibold">Réseau utilisé</Text>
          <Text className="text-white/60 text-sm mt-2">
            {NETWORK_NAME} · USDC · 6 décimales
          </Text>
          <Text className="text-white/45 text-xs leading-5 mt-3">
            Ton portefeuille bêta utilise Base Sepolia et des jetons de test. Le
            sandbox MoonPay est une démonstration séparée : il ne recharge pas
            ce solde.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
