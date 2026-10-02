import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import * as Clipboard from "expo-clipboard";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  ShieldCheck,
  WalletCards,
} from "lucide-react-native";
import { APP_NETWORK, COLORS, NETWORK_NAME } from "@/utils/constants";
import { DEMO_MODE } from "@/utils/demoMode";
import { OnrampService } from "@/services/onramp.service";
import { useWalletStore } from "@/stores/useWalletStore";
import {
  INITIAL_ONRAMP,
  isBusy,
  onrampReducer,
  runCheckout,
  scheduleBalanceRefresh,
} from "@/utils/onrampFlow";

export default function AddCryptoScreen() {
  const router = useRouter();
  const [amount, setAmount] = useState("50");
  const [checkout, dispatch] = useReducer(onrampReducer, INITIAL_ONRAMP);
  const isOpening = isBusy(checkout);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const walletAddress = useWalletStore((state) => state.smartAccountAddress);
  const isTestnet = APP_NETWORK === "base-sepolia";

  // After coming back from MoonPay the balance is re-read a few times, then left
  // alone: nothing here waits for MoonPay, and a later confirmation shows in Activity.
  const cancelRefresh = useRef<(() => void) | null>(null);
  const refreshAfterReturn = useCallback(() => {
    cancelRefresh.current?.();
    cancelRefresh.current = scheduleBalanceRefresh(() => useWalletStore.getState().refreshBalances());
  }, []);
  useEffect(() => () => cancelRefresh.current?.(), []);

  // The browser's own promise may never settle on iOS when the checkout hands
  // control back through a link, so coming back to the app is enough to move on.
  const phase = checkout.phase;
  useEffect(() => {
    if (phase !== "open") return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        dispatch({ type: "returned" });
        refreshAfterReturn();
      }
    });
    return () => subscription.remove();
  }, [phase, refreshAfterReturn]);
  useEffect(() => {
    if (phase === "returned") refreshAfterReturn();
  }, [phase, refreshAfterReturn]);

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

  const openMoonPay = async () => {
    if (!DEMO_MODE && APP_NETWORK !== "base-sepolia") {
      setError(
        "Real purchases are not available in this beta yet.",
      );
      return;
    }
    const numericAmount = Number(amount.replace(",", "."));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter an amount greater than 0 EUR.");
      return;
    }

    if (DEMO_MODE) {
      setError(null);
      setMessage(
        `Simulation: ${numericAmount.toFixed(2)} EUR converted to USDC. No real purchase was made.`,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    if (!walletAddress) {
      setError("Your secure wallet is not ready yet.");
      return;
    }

    setError(null);
    setMessage(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await runCheckout(
      {
        createSession: (value) => OnrampService.createSession(value),
        openBrowser: (url) =>
          WebBrowser.openBrowserAsync(url, {
            // Use Safari's full-screen chrome so its native Close button remains
            // reachable even when the checkout itself displays an error.
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
            dismissButtonStyle: "close",
            controlsColor: COLORS.white,
            toolbarColor: COLORS.black,
          }),
      },
      numericAmount.toFixed(2),
      dispatch,
    );
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
          Add crypto
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
      >
        <View className="rounded-3xl border border-blue-300/25 bg-blue-300/10 p-5 mb-5">
          <Text className="text-blue-100 text-base font-semibold">
            {isTestnet ? "Receive test tokens" : "Receive crypto on Base"}
          </Text>
          <Text className="text-blue-100/80 text-sm leading-5 mt-2">
            {isTestnet
              ? "This beta uses Base Sepolia. Request test USDC from another Base Sepolia wallet. These tokens have no value. Never send real money or crypto here."
              : "Always confirm the network and address with the sender before a transfer. Card purchases are unavailable here."}
          </Text>
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
        </View>
        <View className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
          {DEMO_MODE ? (
            <View className="mb-5 rounded-2xl border border-blue-300/25 bg-blue-300/10 p-4">
              <Text className="text-blue-100 font-semibold">
                SIMULATION MODE
              </Text>
              <Text className="text-blue-100/70 text-xs leading-5 mt-1">
                No payment or crypto received. This screen only
                tests the flow.
              </Text>
            </View>
          ) : null}
          <View className="flex-row items-center">
            <View className="w-12 h-12 rounded-2xl bg-white/10 items-center justify-center">
              <WalletCards size={24} color={COLORS.accent} />
            </View>
            <View className="flex-1 ml-4">
              <Text className="text-white text-lg font-semibold">
                Test buying USDC
              </Text>
              <Text className="text-white/50 text-sm mt-1">
                Test flow · no real USDC received
              </Text>
            </View>
          </View>

          <Text
            className="text-white/50 text-xs uppercase mt-7 mb-2"
            style={{ letterSpacing: 1.4 }}
          >
            Amount in euros
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
              MoonPay’s sandbox simulates a purchase. No real payment
              and no deposit on Base Sepolia.
            </Text>
          </View>

          {error ? (
            <Text className="mt-4 text-sm leading-5 text-red-300">{error}</Text>
          ) : null}
          {checkout.phase === "failed" && checkout.failure ? (
            <View accessibilityRole="alert" className="mt-4">
              <Text className="text-sm leading-5 text-red-300">{checkout.failure.message}</Text>
              {checkout.failure.code ? (
                <Text selectable className="mt-1 text-xs text-white/40">{`Reference: ${checkout.failure.code}`}</Text>
              ) : null}
            </View>
          ) : null}
          {checkout.phase === "open" ? (
            <View accessibilityRole="alert" className="mt-4 rounded-2xl border border-white/15 bg-white/5 p-4">
              <Text className="text-sm font-semibold text-white">MoonPay is open</Text>
              <Text className="mt-1 text-sm leading-5 text-white/65">
                Finish or close it when you like and come back here. Nothing is waiting on it.
              </Text>
              <Pressable
                onPress={() => dispatch({ type: "returned" })}
                accessibilityRole="button"
                hitSlop={8}
                className="mt-3 min-h-11 justify-center self-start"
              >
                <Text className="text-sm font-semibold" style={{ color: COLORS.accent }}>I’m back</Text>
              </Pressable>
            </View>
          ) : null}
          {checkout.phase === "returned" ? (
            <Text className="mt-4 text-sm leading-5 text-green-300">
              Back from MoonPay. The sandbox only simulates a purchase, so nothing is added to your Base Sepolia balance.
              If MoonPay confirms something later, it appears in Activity.
            </Text>
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
                  {DEMO_MODE ? "Simulate purchase" : "Try MoonPay (sandbox)"}
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
          <Text className="text-white font-semibold">Network used</Text>
          <Text className="text-white/60 text-sm mt-2">
            {NETWORK_NAME} · USDC · 6 decimals
          </Text>
          <Text className="text-white/45 text-xs leading-5 mt-3">
            Your beta wallet uses Base Sepolia and test tokens. The
            MoonPay sandbox is a separate demo: it does not fund
            this balance.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
