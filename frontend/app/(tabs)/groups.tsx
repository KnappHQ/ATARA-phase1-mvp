import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Plus } from "lucide-react-native";
import { useRouter } from "expo-router";
import { GroupsListTab } from "@/components/activity/GroupsListTab";
import { useGroupStore } from "@/stores/useGroupStore";
import { COLORS } from "@/utils/constants";

/** Groups on their own tab: the invitations to answer, then the groups the person is in. */
export default function GroupsTab() {
  const router = useRouter();
  const { groups, isLoading, error, fetchGroups } = useGroupStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshKey((key) => key + 1); // invitations reload too
    try {
      await fetchGroups();
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchGroups]);

  return (
    <View className="flex-1 bg-black">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.platinum}
            colors={[COLORS.platinum]}
            progressBackgroundColor="#111111"
          />
        }
      >
        <View className="flex-row items-center justify-between mt-5 mb-4">
          <Text className="text-2xl font-semibold text-primary">Groups</Text>
          <Pressable
            onPress={() => router.push("/group-create")}
            accessibilityRole="button"
            accessibilityLabel="New group"
            className="flex-row items-center gap-1 rounded-full border border-white/20 px-4 min-h-11 active:opacity-80"
          >
            <Plus size={16} color={COLORS.white} strokeWidth={2.5} />
            <Text className="text-sm font-medium text-white">New group</Text>
          </Pressable>
        </View>

        <GroupsListTab
          groups={groups}
          searchQuery=""
          isLoading={isLoading}
          error={error}
          onRetry={fetchGroups}
          refreshKey={refreshKey}
        />

        <View className="h-28" />
      </ScrollView>
    </View>
  );
}
