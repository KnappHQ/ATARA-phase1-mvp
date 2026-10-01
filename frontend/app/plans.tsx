import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Check } from "lucide-react-native";

import { useEntitlements } from "@/hooks/useEntitlements";
import { COLORS } from "@/utils/constants";
import { formatPrice, formatUsd, nextAllowanceStep, planHighlights } from "@/utils/entitlements";

/** Billing is off until the purchase flow and its server-side verification exist. */
const BILLING_ENABLED = process.env.EXPO_PUBLIC_BILLING_ENABLED === "true";

export default function PlansScreen() {
  const router = useRouter();
  const { plans, mine, milesPerSend, failed, refresh } = useEntitlements();
  const current = plans?.find((plan) => plan.id === mine?.plan);
  const step = nextAllowanceStep(current, mine?.miles.monthlyCardSpendUsdCents ?? 0);

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
        <Text className="ml-4 text-xl font-semibold text-white">Plans & Miles</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Text className="text-sm leading-5 text-white/55 mb-5">
          ATARA is useful for free. A plan adds room (more Vaults and members), more of your network fees covered, and
          better rates. Sending money to other people costs nothing on any plan.
        </Text>

        {failed && !plans ? (
          <Pressable onPress={refresh} accessibilityRole="button" className="mb-5 rounded-2xl border border-white/15 p-4">
            <Text className="text-sm text-white/70">Plans could not be loaded. Tap to try again.</Text>
          </Pressable>
        ) : null}

        {mine ? (
          <View className="mb-6 rounded-3xl border border-white/15 bg-white/[0.04] p-5">
            <Text className="text-xs uppercase text-white/40" style={{ letterSpacing: 1.2 }}>Your ATARA Miles</Text>
            <Text className="mt-1 text-3xl font-semibold text-white">{mine.miles.balance.toLocaleString("en-US")}</Text>
            <Text className="mt-2 text-sm leading-5 text-white/60">
              {`This month: ${formatUsd(mine.miles.monthlyCardSpendUsdCents)} spent by card, ${mine.miles.sponsoredAllowance} sends with network fees covered, ${mine.miles.sendsThisMonth} sent so far.`}
            </Text>
            {step ? (
              <Text className="mt-2 text-sm leading-5 text-white/60">
                {`Spend ${formatUsd(step.toGoUsdCents)} more by card this month to cover one more send.`}
              </Text>
            ) : null}
            <Text className="mt-2 text-xs leading-5 text-white/40">
              {`Miles are earned on card spending. ${milesPerSend ?? 20} miles cover one send beyond your monthly allowance. They are not money: they cannot be sent or cashed out.`}
            </Text>
          </View>
        ) : null}

        {(plans ?? []).map((plan) => {
          const isCurrent = plan.id === mine?.plan;
          return (
            <View
              key={plan.id}
              className="mb-4 rounded-3xl border p-5"
              style={{ borderColor: isCurrent ? `${COLORS.accent}66` : `${COLORS.white}18`, backgroundColor: `${COLORS.white}05` }}
            >
              <View className="flex-row items-start justify-between gap-3">
                <Text className="flex-1 text-lg font-semibold text-white">{plan.name}</Text>
                {isCurrent ? (
                  <View className="rounded-full px-3 py-1" style={{ backgroundColor: `${COLORS.accent}22` }}>
                    <Text className="text-[11px] font-semibold" style={{ color: COLORS.accent }}>Your plan</Text>
                  </View>
                ) : null}
              </View>
              <Text className="mt-1 text-sm text-white/60">{formatPrice(plan.priceEurCents)}</Text>
              {planHighlights(plan).map((line) => (
                <View key={line} className="mt-2 flex-row gap-2">
                  <Check size={14} color={COLORS.accent} style={{ marginTop: 3 }} />
                  <Text className="flex-1 text-sm leading-5 text-white/70">{line}</Text>
                </View>
              ))}
              {plan.id !== "FREE" && !isCurrent ? (
                <View
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !BILLING_ENABLED }}
                  className="mt-4 min-h-11 items-center justify-center rounded-2xl border border-white/15"
                  style={{ opacity: BILLING_ENABLED ? 1 : 0.5 }}
                >
                  <Text className="text-sm font-semibold text-white">{BILLING_ENABLED ? `Choose ${plan.name}` : "Available soon"}</Text>
                </View>
              ) : null}
            </View>
          );
        })}

        <Text className="mt-2 text-xs leading-5 text-white/40">
          What a plan includes is decided on ATARA’s servers. Prices shown are before any store taxes.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
