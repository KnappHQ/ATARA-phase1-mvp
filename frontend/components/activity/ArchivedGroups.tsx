import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useAlertStore } from "@/stores/useAlertStore";
import { useGroupStore, type Group } from "@/stores/useGroupStore";

/**
 * Groups this person archived. They keep their whole history here and come back to the
 * list with Restore. Archiving is personal: nobody else's list changes.
 */
export const ArchivedGroups = ({ groups }: { groups: Group[] }) => {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (groups.length === 0) return null;

  const restore = async (group: Group) => {
    if (busyId) return;
    setBusyId(group.id);
    try {
      await useGroupStore.getState().unarchiveGroup(group.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      useAlertStore.getState().error("Could not restore the group", error?.response?.data?.message ?? "Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View className="mt-6">
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="flex-row items-center gap-2 min-h-11"
      >
        {open ? <ChevronDown size={16} color="rgba(255,255,255,0.5)" /> : <ChevronRight size={16} color="rgba(255,255,255,0.5)" />}
        <Text className="text-sm text-white/60">Archived ({groups.length})</Text>
      </Pressable>

      {open &&
        groups.map((group) => (
          <View key={group.id} className="flex-row items-center justify-between py-3 border-b border-white/5">
            <View className="flex-1 pr-3">
              <Text className="text-base text-white/70" numberOfLines={1}>{group.name}</Text>
              <Text className="text-xs text-white/35">{group.memberCount} members · history kept</Text>
            </View>
            <Pressable
              onPress={() => restore(group)}
              disabled={busyId !== null}
              accessibilityRole="button"
              accessibilityLabel={`Restore ${group.name}`}
              className="min-h-11 px-4 items-center justify-center rounded-full border border-white/20"
            >
              {busyId === group.id ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-sm text-white">Restore</Text>}
            </Pressable>
          </View>
        ))}
    </View>
  );
};
