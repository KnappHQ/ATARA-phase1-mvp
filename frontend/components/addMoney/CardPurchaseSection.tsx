import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { ActivityIndicator, AppState, Pressable, Text, TextInput, View } from "react-native";
import { ExternalLink, ShieldCheck, WalletCards } from "lucide-react-native";
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

/**
 * Card purchase through MoonPay. Only rendered when CARD_PURCHASE_ENABLED, so none of
 * its hooks or network calls exist while the feature is off.
 */
export function CardPurchaseSection() {
  const [amount, setAmount] = useState("50");
  const [checkout, dispatch] = useReducer(onrampReducer, INITIAL_ONRAMP);
  const isOpening = isBusy(checkout);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const walletAddress = useWalletStore((state) => state.smartAccountAddress);

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
    <>
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
    </>
  );
}
