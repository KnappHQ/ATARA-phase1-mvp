import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";

import { SafetyService, type BlockedUser } from "@/services/safety.service";
import { useAlertStore } from "@/stores/useAlertStore";
import { COLORS } from "@/utils/constants";
import { SUPPORT_EMAIL } from "@/utils/site";
import { safetyFailureText } from "@/utils/safetyFlow";

type State = { status: "loading" } | { status: "ready"; blocks: BlockedUser[] } | { status: "failed"; message: string };

/**
 * People the user blocked, with a way to undo it. A blocked person cannot find the
 * user, add them to a group or split an expense with them, and the user no longer
 * sees their notes.
 */
export default function BlockedUsersScreen() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", blocks: await SafetyService.listBlocks() });
    } catch (error) {
      setState({ status: "failed", message: safetyFailureText(error) });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unblock = async (handle: string) => {
    if (busy) return;
    setBusy(handle);
    try {
      await SafetyService.unblock(handle);
      await load();
    } catch (error) {
      useAlertStore.getState().error("Could not unblock", safetyFailureText(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black" edges={["top", "bottom"]}>
      <View className="flex-row items-center px-6 py-4 border-b border-white/10">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          hitSlop={8}
          className="w-11 h-11 rounded-full items-center justify-center bg-white/10"
        >
          <ArrowLeft size={20} color={COLORS.white} />
        </Pressable>
        <Text className="ml-4 text-xl font-semibold text-white">Blocked users</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
        <Text className="text-sm leading-5 text-white/55 mb-5">
          A blocked person cannot find you, add you to a group or split an expense with you, and you no longer see their notes.
          Payments already made stay in your history. To report someone, open their profile, a note or a group.
        </Text>

        {state.status === "loading" ? <ActivityIndicator color={COLORS.white} /> : null}

        {state.status === "failed" ? (
          <View>
            <Text className="text-white/70">{state.message}</Text>
            <Pressable accessibilityRole="button" onPress={load} className="mt-3 self-start rounded-xl border border-white/20 px-4 py-2">
              <Text className="text-sm font-semibold text-white">Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {state.status === "ready" && state.blocks.length === 0 ? (
          <Text className="text-white/50">You have not blocked anyone.</Text>
        ) : null}

        {state.status === "ready"
          ? state.blocks.map((block) => (
              <View key={block.handle} className="flex-row items-center rounded-2xl border border-white/10 px-4 py-4 mb-3" style={{ backgroundColor: `${COLORS.white}06` }}>
                <View className="flex-1">
                  <Text className="text-white font-semibold">@{block.handle}</Text>
                  {block.displayName ? <Text className="text-white/50 text-xs mt-0.5">{block.displayName}</Text> : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Unblock @${block.handle}`}
                  disabled={busy !== null}
                  onPress={() => unblock(block.handle)}
                  className="rounded-xl border border-white/20 px-4 py-2"
                  style={{ opacity: busy === block.handle ? 0.5 : 1 }}
                >
                  <Text className="text-sm font-semibold text-white">Unblock</Text>
                </Pressable>
              </View>
            ))
          : null}

        <Text className="text-xs text-white/40 mt-6">Something else? Write to {SUPPORT_EMAIL}.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
