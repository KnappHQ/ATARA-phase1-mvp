import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Check } from "lucide-react-native";

import { LoadNotice } from "@/components/activity/LoadNotice";
import { useEntitlements } from "@/hooks/useEntitlements";
import { COLORS } from "@/utils/constants";
import { buildPlansView } from "@/utils/plansScreen";

export default function PlansScreen() {
  const router = useRouter();
  const { plans, mine, plansLoad, refresh } = useEntitlements();
  // Fixed content first: the live data only adds to it, so this is never blank.
  const view = buildPlansView({ load: plansLoad, plans, mine });

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
        <Text className="ml-4 text-xl font-semibold text-white" numberOfLines={1}>Plans & Miles</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <LoadNotice notice={view.notice} onRetry={refresh} />

        <Text className="mb-4 text-lg font-semibold text-white">{view.heading}</Text>
        {view.plans.map((plan) => {
          const current = plan.badge === "Current plan";
          return (
            <View
              key={plan.id}
              className="mb-4 rounded-3xl border p-5"
              style={{ borderColor: current ? `${COLORS.accent}66` : `${COLORS.white}18`, backgroundColor: `${COLORS.white}05` }}
            >
              <View className="flex-row items-start justify-between gap-3">
                <Text className="flex-1 text-lg font-semibold text-white">{plan.name}</Text>
                <View
                  className="rounded-full px-3 py-1"
                  style={{ backgroundColor: current ? `${COLORS.accent}22` : `${COLORS.white}10` }}
                >
                  <Text className="text-[11px] font-semibold" style={{ color: current ? COLORS.accent : "rgba(255,255,255,0.6)" }}>
                    {plan.badge}
                  </Text>
                </View>
              </View>
              {plan.planned ? <Text className="mt-2 text-xs text-white/40">Planned · not active yet</Text> : null}
              {plan.highlights.map((line) => (
                <View key={line} className="mt-2 flex-row gap-2">
                  <Check size={14} color={COLORS.accent} style={{ marginTop: 3 }} />
                  <Text className="flex-1 text-sm leading-5 text-white/70">{line}</Text>
                </View>
              ))}
              {plan.action ? (
                <View
                  accessibilityRole="button"
                  accessibilityState={{ disabled: true }}
                  className="mt-4 min-h-11 items-center justify-center rounded-2xl border border-white/15"
                  style={{ opacity: 0.5 }}
                >
                  <Text className="text-sm font-semibold text-white">{plan.action}</Text>
                </View>
              ) : null}
            </View>
          );
        })}

        <View className="mt-2 rounded-3xl border border-white/15 bg-white/[0.04] p-5">
          <Text className="text-xs uppercase text-white/40" style={{ letterSpacing: 1.2 }}>ATARA Miles</Text>
          <Text
            className={view.miles.state === "live" ? "mt-1 text-2xl font-semibold text-white" : "mt-1 text-lg font-semibold text-white/70"}
          >
            {view.miles.valueLabel}
          </Text>
          <Text className="mt-1 text-sm font-semibold" style={{ color: COLORS.accent }}>{view.miles.status}</Text>
          {view.miles.lines.map((line) => (
            <Text key={line} className="mt-2 text-sm leading-5 text-white/55">{line}</Text>
          ))}
        </View>

        <Text className="mt-4 text-xs leading-5 text-white/40">{view.footnote}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
