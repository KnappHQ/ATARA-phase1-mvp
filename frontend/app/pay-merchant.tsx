import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { ArrowLeft, ClipboardPaste, ShoppingBasket, ShieldCheck } from "lucide-react-native";
import { APP_NETWORK, COLORS, NETWORK_NAME } from "@/utils/constants";
import { DEMO_MODE } from "@/utils/demoMode";
import { getTokenAddress } from "@/utils/tokenConfig";
import { useSmartAccountService } from "@/services/smartAccount.service";
import { useTransactionService } from "@/services/transaction.service";
import { useWalletStore } from "@/stores/useWalletStore";
import { useAuthStore } from "@/stores/useAuthStore";

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

const parsePaymentRequest = (value: string) => {
  const raw = value.trim();
  if (!raw) return null;
  try {
    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw);
      return {
        address: typeof parsed.address === "string" ? parsed.address : "",
        amount: typeof parsed.amount === "string" || typeof parsed.amount === "number" ? String(parsed.amount) : "",
      };
    }
    const normalized = raw.replace(/^ethereum:/i, "");
    const [address, query] = normalized.split("?");
    const params = new URLSearchParams(query || "");
    const valueInEth = params.get("value") || params.get("amount") || "";
    return { address, amount: valueInEth };
  } catch {
    return null;
  }
};

export default function PayMerchantScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const service = useSmartAccountService();
  const transactionService = useTransactionService(service);
  const refreshBalances = useWalletStore((state) => state.refreshBalances);
  const usdc = useWalletStore((state) => state.getAssetBySymbol("USDC"));
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("Courses");
  const [isPaying, setIsPaying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const pastePaymentRequest = async () => {
    const clipboard = await Clipboard.getStringAsync();
    const request = parsePaymentRequest(clipboard);
    if (!request?.address || !ADDRESS_PATTERN.test(request.address)) {
      setMessage("Aucune demande de paiement QR valide dans le presse-papiers.");
      return;
    }
    setRecipient(request.address);
    if (request.amount) setAmount(request.amount);
    setMessage("Demande QR importée. Vérifie le commerçant et le montant avant de payer.");
  };

  const rawAddress = recipient.trim();
  const isValidAddress = ADDRESS_PATTERN.test(rawAddress);
  const parsedAmount = Number(amount.replace(",", "."));
  const isValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const balanceText = useMemo(() => DEMO_MODE ? "500.00" : (usdc?.balance || "0.00"), [usdc?.balance]);
  const hasSixDecimals = !amount.includes(".") || amount.split(".")[1].length <= 6;
  const hasBalance = DEMO_MODE || parsedAmount <= Number(balanceText.replace(",", "."));
  const canPay = (DEMO_MODE || !!transactionService) && isValidAddress && isValidAmount && hasSixDecimals && hasBalance && !isPaying;

  const pay = async () => {
    if (!canPay) return;
    setIsPaying(true);
    setMessage(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (DEMO_MODE) {
        setMessage(`Simulation : paiement de ${parsedAmount.toFixed(2)} USDC validé. Aucune transaction réelle n’a été envoyée.`);
        setAmount("");
        return;
      }
      if (!transactionService) return;
      const result = await transactionService.sendTransaction({
        recipientAddress: rawAddress,
        recipientName: "Commerçant",
        amount: parsedAmount.toFixed(6),
        tokenSymbol: "USDC",
        tokenAddress: getTokenAddress("USDC", APP_NETWORK),
        decimals: 6,
        usdValue: parsedAmount.toFixed(2),
        note,
      });
      if (!result.success) {
        setMessage(result.error || "Le paiement a échoué.");
        return;
      }
      await refreshBalances();
      setMessage("Paiement envoyé. Le commerçant peut maintenant vérifier la transaction.");
      setAmount("");
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center px-6 py-4 border-b border-white/10">
        <Pressable onPress={() => router.back()} className="w-11 h-11 rounded-full items-center justify-center bg-white/10">
          <ArrowLeft size={20} color={COLORS.white} />
        </Pressable>
        <Text className="ml-4 text-xl font-semibold text-white">Payer une course</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <View className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
          {DEMO_MODE ? <View className="mb-5 rounded-2xl border border-blue-300/25 bg-blue-300/10 p-4"><Text className="text-blue-100 font-semibold">MODE SIMULATION</Text><Text className="text-blue-100/70 text-xs leading-5 mt-1">Le solde affiché est fictif. Aucun USDC ne sera envoyé.</Text></View> : null}
          <View className="flex-row items-center">
            <View className="w-12 h-12 rounded-2xl bg-white/10 items-center justify-center">
              <ShoppingBasket size={24} color={COLORS.accent} />
            </View>
            <View className="flex-1 ml-4">
              <Text className="text-white text-lg font-semibold">Paiement commerçant</Text>
              <Text className="text-white/50 text-sm mt-1">USDC sur {NETWORK_NAME}</Text>
            </View>
          </View>

          <Text className="text-white/55 text-sm leading-5 mt-6">
            Importe une demande QR fournie par le magasin ou colle son adresse. Pour la bêta, le commerçant doit accepter l’USDC sur Base Sepolia.
          </Text>

          <Pressable onPress={pastePaymentRequest} className="flex-row items-center justify-center rounded-2xl border border-blue-300/25 bg-blue-300/10 px-4 py-3 mt-4">
            <ClipboardPaste size={17} color="#93c5fd" />
            <Text className="ml-2 text-blue-200 font-semibold text-sm">Importer une demande QR copiée</Text>
          </Pressable>

          <View className="flex-row items-center rounded-2xl border border-white/15 bg-black/40 px-4 mt-5">
            <TextInput
              value={recipient}
              onChangeText={setRecipient}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Adresse du commerçant (0x…)"
              placeholderTextColor="rgba(255,255,255,0.25)"
              className="flex-1 py-4 text-sm text-white"
            />
          </View>
          {recipient.length > 0 && !isValidAddress ? <Text className="text-xs text-red-300 mt-2">Adresse Base invalide.</Text> : null}

          <Text className="text-white/50 text-xs uppercase mt-5 mb-2" style={{ letterSpacing: 1.4 }}>Montant USDC</Text>
          <View className="flex-row items-center rounded-2xl border border-white/15 bg-black/40 px-4">
            <TextInput
              value={amount}
              onChangeText={(value) => setAmount(value.replace(/[^0-9.,]/g, ""))}
              keyboardType="decimal-pad"
              placeholder="12.50"
              placeholderTextColor="rgba(255,255,255,0.25)"
              className="flex-1 py-4 text-2xl text-white"
            />
            <Text className="text-white/60 text-lg">USDC</Text>
          </View>
          <Text className="text-white/40 text-xs mt-2">Solde disponible : {balanceText} USDC</Text>
          {isValidAmount && !hasBalance ? <Text className="text-red-300 text-xs mt-2">Montant supérieur au solde disponible.</Text> : null}
          {amount.includes(".") && !hasSixDecimals ? <Text className="text-red-300 text-xs mt-2">USDC accepte au maximum 6 décimales.</Text> : null}

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Note (facultatif)"
            placeholderTextColor="rgba(255,255,255,0.25)"
            className="mt-4 rounded-2xl border border-white/15 bg-black/40 px-4 py-4 text-sm text-white"
          />

          <View className="flex-row items-center mt-5 rounded-2xl bg-white/5 p-4">
            <ShieldCheck size={18} color="#4ade80" />
            <Text className="flex-1 ml-3 text-xs leading-5 text-white/60">
              Vérifie l’adresse, le réseau et le montant. Un paiement blockchain confirmé ne peut pas être annulé.
            </Text>
          </View>

          {message ? <Text className="mt-4 text-sm leading-5 text-white/75">{message}</Text> : null}
          <Pressable
            onPress={pay}
            disabled={!canPay}
            className="mt-5 h-14 rounded-2xl items-center justify-center"
            style={{ backgroundColor: COLORS.white, opacity: canPay ? 1 : 0.4 }}
          >
            {isPaying ? <ActivityIndicator color={COLORS.black} /> : <Text className="font-semibold" style={{ color: COLORS.black }}>{DEMO_MODE ? "Simuler le paiement" : "Payer en USDC"}</Text>}
          </Pressable>
          {!DEMO_MODE && !service ? <Text className="text-center text-xs text-white/40 mt-3">Connexion au portefeuille en cours…</Text> : null}
          {!DEMO_MODE && !user?.smartAccountAddress ? <Text className="text-center text-xs text-white/40 mt-3">Ton portefeuille ATARA n’est pas encore prêt.</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
