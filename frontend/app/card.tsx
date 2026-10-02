import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, CreditCard, QrCode, Smartphone } from "lucide-react-native";

import { LoadNotice } from "@/components/activity/LoadNotice";
import { useEntitlements } from "@/hooks/useEntitlements";
import { SubscriptionService } from "@/services/subscription.service";
import { useAlertStore } from "@/stores/useAlertStore";
import { COLORS } from "@/utils/constants";
import { buildCardView } from "@/utils/cardScreen";
import { classifyFailure, describeFailure } from "@/utils/loadState";

const Badge = ({ label }: { label: string }) => (
  <View className="rounded-full px-3 py-1" style={{ backgroundColor: `${COLORS.white}10` }}>
    <Text className="text-[11px] font-semibold text-white/60">{label}</Text>
  </View>
);

export default function CardScreen() {
  const router = useRouter();
  const { card, cardLoad, refresh } = useEntitlements();
  const [joining, setJoining] = useState(false);
  // Fixed content first: the service only changes the state of the card, so this is never blank.
  const view = buildCardView({ load: cardLoad, status: card });

  const notifyMe = async () => {
    setJoining(true);
    try {
      await SubscriptionService.joinCardWaitlist();
      await refresh();
      useAlertStore.getState().success("You’re on the list", "We’ll tell you when the card is available.");
    } catch (error) {
      // Said as it is: nothing is recorded, and nothing is pretended.
      useAlertStore.getState().error("Could not add you to the list", describeFailure(classifyFailure(error)));
    } finally {
      setJoining(false);
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
        <Text className="ml-4 text-xl font-semibold text-white" numberOfLines={1}>{view.heading}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <LoadNotice notice={view.notice} onRetry={refresh} />

        <View className="rounded-3xl border border-white/15 bg-white/[0.06] p-5">
          <View className="flex-row items-center">
            <View className="w-12 h-12 rounded-2xl bg-white/10 items-center justify-center">
              <CreditCard size={24} color={COLORS.accent} />
            </View>
            <Text className="flex-1 ml-4 text-white text-lg font-semibold">{view.card.title}</Text>
            <Badge label={view.card.badge} />
          </View>
          <Text className="mt-4 text-sm leading-5 text-white/70">{view.card.body}</Text>
          {view.card.last4 ? <Text className="mt-2 text-sm text-white/60">{`Card ending ${view.card.last4}`}</Text> : null}
          {view.action ? (
            <Pressable
              disabled={joining || view.action.disabled}
              onPress={notifyMe}
              accessibilityRole="button"
              className="mt-4 min-h-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: COLORS.accent, opacity: joining || view.action.disabled ? 0.5 : 1 }}
            >
              <Text className="text-sm font-semibold text-black">{view.action.label}</Text>
            </Pressable>
          ) : null}
        </View>

        <View className="mt-4 rounded-3xl border border-white/10 p-5">
          <View className="flex-row items-center gap-3">
            <Smartphone size={18} color={COLORS.accent} />
            <Text className="flex-1 text-sm font-semibold text-white">Apple Pay</Text>
            <Badge label={view.applePay.badge} />
          </View>
          <Text className="mt-2 text-sm leading-5 text-white/60">{view.applePay.body}</Text>
        </View>

        <View className="mt-4 rounded-3xl border border-white/10 p-5">
          <Text className="text-sm font-semibold text-white">{view.miles.title}</Text>
          <Text className="mt-2 text-sm leading-5 text-white/60">{view.miles.body}</Text>
          <Pressable onPress={() => router.push("/plans" as never)} accessibilityRole="button" className="mt-3">
            <Text className="text-sm" style={{ color: COLORS.accent }}>See plans & Miles</Text>
          </Pressable>
        </View>

        <View className="mt-4 rounded-3xl border border-white/10 p-5">
          <View className="flex-row items-center gap-2">
            <QrCode size={16} color={COLORS.accent} />
            <Text className="text-sm font-semibold text-white">{view.qr.title}</Text>
          </View>
          <Text className="mt-2 text-sm leading-5 text-white/60">{view.qr.body}</Text>
          <Pressable onPress={() => router.push("/pay-merchant" as never)} accessibilityRole="button" className="mt-3 min-h-11 justify-center">
            <Text className="text-sm" style={{ color: COLORS.accent }}>{view.qr.action}</Text>
          </Pressable>
        </View>

        <View className="mt-4 rounded-3xl border border-white/10 p-5">
          <Text className="text-sm font-semibold text-white">Your balance and the card</Text>
          <Text className="mt-2 text-sm leading-5 text-white/60">{view.fundsNotice}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
