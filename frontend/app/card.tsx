import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, CreditCard, QrCode } from "lucide-react-native";

import { useEntitlements } from "@/hooks/useEntitlements";
import { SubscriptionService } from "@/services/subscription.service";
import { useAlertStore } from "@/stores/useAlertStore";
import { COLORS } from "@/utils/constants";
import { CARD_FUNDS_NOTICE, QR_ALTERNATIVE_NOTICE, cardScreenFor } from "@/utils/cardScreen";
import { formatRate } from "@/utils/entitlements";

export default function CardScreen() {
  const router = useRouter();
  const { plans, mine, card, refresh } = useEntitlements();
  const [joining, setJoining] = useState(false);
  const screen = cardScreenFor(card);
  const current = plans?.find((plan) => plan.id === mine?.plan);

  const notifyMe = async () => {
    setJoining(true);
    try {
      await SubscriptionService.joinCardWaitlist();
      await refresh();
      useAlertStore.getState().success("You're on the list", "We'll tell you when the card is available.");
    } catch {
      useAlertStore.getState().error("Could not add you", "Check your connection and try again.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center px-6 py-4 border-b border-white/10">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="w-11 h-11 rounded-full items-center justify-center bg-white/10"
        >
          <ArrowLeft size={20} color={COLORS.white} />
        </Pressable>
        <Text className="ml-4 text-xl font-semibold text-white">ATARA Card</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <View className="rounded-3xl border border-white/15 bg-white/[0.06] p-5">
          <View className="flex-row items-center">
            <View className="w-12 h-12 rounded-2xl bg-white/10 items-center justify-center">
              <CreditCard size={24} color={COLORS.accent} />
            </View>
            <View className="flex-1 ml-4">
              <Text className="text-white text-lg font-semibold">Visa card in Apple Wallet</Text>
              <Text className="text-white/50 text-sm mt-1">Spend your balance anywhere Visa is accepted</Text>
            </View>
          </View>

          {screen.kind === "coming-soon" ? (
            <>
              <Text className="mt-4 text-sm leading-5 text-white/70">
                The card is not available yet. Tell us you want it and we’ll let you know as soon as it opens.
              </Text>
              <Pressable
                disabled={joining || screen.joined}
                onPress={notifyMe}
                accessibilityRole="button"
                className="mt-4 min-h-12 items-center justify-center rounded-2xl"
                style={{ backgroundColor: COLORS.accent, opacity: joining || screen.joined ? 0.5 : 1 }}
              >
                <Text className="text-sm font-semibold text-black">{screen.joined ? "You're on the list" : "Notify me"}</Text>
              </Pressable>
            </>
          ) : null}
          {screen.kind === "not-applied" ? (
            <Text className="mt-4 text-sm leading-5 text-white/70">Your card is ready to request.</Text>
          ) : null}
          {screen.kind === "pending" ? (
            <Text className="mt-4 text-sm leading-5 text-white/70">Your card request is being reviewed.</Text>
          ) : null}
          {screen.kind === "active" ? (
            <Text className="mt-4 text-sm leading-5 text-white/70">
              {screen.last4 ? `Your card ending ${screen.last4} is active.` : "Your card is active."}
              {screen.canAddToWallet ? " Add it to Apple Wallet to pay with a tap." : ""}
            </Text>
          ) : null}
          {screen.kind === "frozen" ? (
            <Text className="mt-4 text-sm leading-5 text-white/70">Your card is frozen. Contact support to unfreeze it.</Text>
          ) : null}
        </View>

        <View className="mt-5 rounded-3xl border border-white/10 p-5">
          <Text className="text-sm font-semibold text-white">Your balance and the card</Text>
          <Text className="mt-2 text-sm leading-5 text-white/60">{CARD_FUNDS_NOTICE}</Text>
        </View>

        {current ? (
          <View className="mt-5 rounded-3xl border border-white/10 p-5">
            <Text className="text-sm font-semibold text-white">Fees on your plan ({current.name})</Text>
            <Text className="mt-2 text-sm leading-5 text-white/60">{`Currency conversion on card purchases: ${formatRate(current.feeBps.card_fx)}`}</Text>
            <Text className="mt-1 text-sm leading-5 text-white/60">{`Buying or cashing out crypto: ${formatRate(current.feeBps.ramp)}`}</Text>
            <Text className="mt-1 text-sm leading-5 text-white/60">{`You earn ${current.milesPerUsd} mile${current.milesPerUsd === 1 ? "" : "s"} per $1 spent. Miles cover network fees on your sends.`}</Text>
            <Pressable onPress={() => router.push("/plans" as never)} accessibilityRole="button" className="mt-3">
              <Text className="text-sm" style={{ color: COLORS.accent }}>See plans & your miles</Text>
            </Pressable>
          </View>
        ) : null}

        <View className="mt-5 rounded-3xl border border-white/10 p-5">
          <View className="flex-row items-center gap-2">
            <QrCode size={16} color={COLORS.accent} />
            <Text className="text-sm font-semibold text-white">Pay with crypto instead</Text>
          </View>
          <Text className="mt-2 text-sm leading-5 text-white/60">{QR_ALTERNATIVE_NOTICE}</Text>
          <Pressable onPress={() => router.push("/pay-merchant" as never)} accessibilityRole="button" className="mt-3">
            <Text className="text-sm" style={{ color: COLORS.accent }}>Pay a merchant</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
