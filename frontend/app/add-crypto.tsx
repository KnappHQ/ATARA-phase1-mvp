import { useState } from "react";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Clipboard from "expo-clipboard";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCodeStyled from "react-native-qrcode-styled";
import { ArrowLeft, Copy } from "lucide-react-native";
import { APP_NETWORK, CHAIN_ID, COLORS, NETWORK_NAME } from "@/utils/constants";
import { CARD_PURCHASE_ENABLED } from "@/utils/featureFlags";
import { buildReceiveUri } from "@/utils/paymentRequest";
import { useWalletStore } from "@/stores/useWalletStore";
import { useAddressVerificationStore } from "@/stores/useAddressVerificationStore";
import { CardPurchaseSection } from "@/components/addMoney/CardPurchaseSection";

export default function AddCryptoScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const walletAddress = useWalletStore((state) => state.smartAccountAddress);
  const verification = useAddressVerificationStore((state) => state.statusFor(walletAddress));
  const isTestnet = APP_NETWORK === "base-sepolia";

  const openTestFaucet = async () => {
    if (!isTestnet || !walletAddress) return;
    try {
      await Clipboard.setStringAsync(walletAddress);
      setError(null);
      setMessage("Address copied. On Circle, select USDC and Base Sepolia, then paste your address. These tokens have no real value.");
      await WebBrowser.openBrowserAsync("https://faucet.circle.com/", {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        toolbarColor: COLORS.black,
      });
    } catch {
      setError("Could not open Circle. Go to faucet.circle.com and paste your Base Sepolia address.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black" edges={["top", "bottom"]}>
      <View className="flex-row items-center px-6 py-4 border-b border-white/10">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          className="w-11 h-11 rounded-full items-center justify-center bg-white/10"
        >
          <ArrowLeft size={20} color={COLORS.white} />
        </Pressable>
        <Text className="ml-4 text-xl font-semibold text-white">
          Add money
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
      >
        <View className="rounded-3xl border border-blue-300/25 bg-blue-300/10 p-5 mb-5">
          <Text className="text-blue-100 text-base font-semibold">
            {isTestnet ? "Receive test USDC" : "Receive USDC"}
          </Text>
          <Text className="text-blue-100/80 text-sm leading-5 mt-2">
            {isTestnet
              ? "Share this address or QR code with someone who has test USDC on Base Sepolia, or get free test USDC below. Test USDC has no value. Never send real money here."
              : "Ask the sender to send USDC on Base to this address. Always check the network before sending."}
          </Text>
          {verification === "mismatch" ? (
            <View accessibilityRole="alert" className="mt-4 p-4 rounded-2xl border border-red-400/40 bg-red-500/10">
              <Text className="text-red-200 font-semibold">This address does not match the key on this phone.</Text>
              <Text className="text-red-100/70 text-xs leading-5 mt-1">Do not share it or ask anyone to pay it until support has checked your account. Your key and your funds are not affected by this check.</Text>
            </View>
          ) : null}
          {/* Drawn on the phone, and never when the address failed its check (same rule as ShareModal). */}
          {walletAddress && verification !== "mismatch" ? (
            <View className="items-center mt-4">
              <View className="rounded-2xl bg-white p-3">
                <QRCodeStyled
                  data={buildReceiveUri(walletAddress, CHAIN_ID)}
                  pieceSize={5}
                  accessibilityLabel="QR code of your receiving address"
                />
              </View>
            </View>
          ) : null}
          {walletAddress ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy my receiving address"
              onPress={async () => {
                await Clipboard.setStringAsync(walletAddress);
                setMessage("Address copied. Check the network before sending.");
              }}
              className="mt-4 rounded-xl border border-white/20 p-4 flex-row items-center"
            >
              <Text selectable numberOfLines={2} className="flex-1 text-white text-xs font-mono">
                {walletAddress}
              </Text>
              <Copy size={18} color={COLORS.white} />
            </Pressable>
          ) : (
            <Text className="text-amber-200 mt-3 text-sm">
              Address unavailable: wait for your wallet to be created before receiving.
            </Text>
          )}
          {isTestnet && walletAddress ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy my address and open the Circle faucet to receive test USDC"
              onPress={openTestFaucet}
              className="mt-3 rounded-xl border border-blue-300/30 bg-blue-300/10 p-4 items-center"
            >
              <Text className="text-blue-100 font-semibold">Get free test USDC</Text>
              <Text className="text-blue-100/70 text-xs mt-1">Copy address · open Circle faucet</Text>
            </Pressable>
          ) : null}
          <Text className="text-blue-100/70 text-xs mt-3">Network: {NETWORK_NAME}</Text>
          {error ? <Text className="mt-3 text-sm leading-5 text-red-300">{error}</Text> : null}
          {message ? <Text className="mt-3 text-sm leading-5 text-green-300">{message}</Text> : null}
        </View>

        {CARD_PURCHASE_ENABLED ? (
          <CardPurchaseSection />
        ) : (
          <Text className="text-white/40 text-sm text-center mt-2">Buying by card: coming soon.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
