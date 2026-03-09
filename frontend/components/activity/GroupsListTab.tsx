import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Users, AlertCircle } from "lucide-react-native";
import { COLORS } from "@/utils/constants";
import { Group } from "@/stores/useGroupStore";
import { GroupItem } from "./GroupItem";
import { useRouter } from "expo-router";

interface GroupsListTabProps {
  groups: Group[];
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function GroupsListTab({
  groups,
  searchQuery,
  isLoading,
  error,
  onRetry,
}: GroupsListTabProps) {
  const router = useRouter();

  const handleCreateGroup = () => {
    router.push("/group-create");
  };

  const handleSelectGroup = (group: any) => {
    router.push({
      pathname: "/group-details",
      params: {
        id: group.id,
        name: group.name,
        memberCount: group.memberCount,
      },
    });
  };
  if (isLoading && groups.length === 0) {
    return (
      <View className="py-16 items-center">
        <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.4)" />
        <Text className="text-white/30 text-sm mt-3">Loading groups...</Text>
      </View>
    );
  }

  if (error && groups.length === 0) {
    return (
      <View className="py-16 items-center">
        <View className="w-16 h-16 rounded-full bg-white/5 border border-white/10 items-center justify-center mb-4">
          <AlertCircle size={28} color="rgba(255, 255, 255, 0.2)" />
        </View>
        <Text className="text-white/40 text-center">{error}</Text>
        <Pressable
          onPress={onRetry}
          className="mt-4 px-5 py-2.5 rounded-2xl active:opacity-80"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.08)" }}
        >
          <Text className="text-white/60 font-mono text-sm">Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (groups.length === 0) {
    if (searchQuery.trim()) {
      return (
        <View className="py-16 items-center">
          <Text className="text-white/40 text-center">
            No groups match "{searchQuery}"
          </Text>
          <Text className="text-white/30 text-sm text-center mt-2">
            Try a different name
          </Text>
        </View>
      );
    }

    return (
      <View className="py-16 items-center">
        <View className="w-16 h-16 rounded-full bg-white/5 border border-white/10 items-center justify-center mb-4">
          <Users size={28} color="rgba(255, 255, 255, 0.2)" />
        </View>
        <Text className="text-white/40 text-center">No groups yet</Text>
        <Text className="text-white/30 text-sm text-center mt-2 max-w-56">
          Create a group to split expenses with friends
        </Text>
        <Pressable
          onPress={handleCreateGroup}
          className="mt-6 px-6 py-3 rounded-2xl active:opacity-80"
          style={{ backgroundColor: COLORS.platinum }}
        >
          <Text className="text-black font-mono text-sm font-semibold">
            Create Your First Group
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      {groups.map((group, index) => (
        <GroupItem
          key={group.id}
          group={group}
          index={index}
          onPress={handleSelectGroup}
        />
      ))}
    </View>
  );
}
