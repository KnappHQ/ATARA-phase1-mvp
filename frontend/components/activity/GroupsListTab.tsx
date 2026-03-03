import { View, Text, Pressable } from "react-native";
import { Users } from "lucide-react-native";
import { COLORS } from "@/utils/constants";
import { Group } from "@/hooks/useGroups";
import { GroupItem } from "./GroupItem";

interface GroupsListTabProps {
  groups: Group[];
  searchQuery: string;
  onCreateNew: () => void;
  onSelectGroup: (group: Group) => void;
}

export function GroupsListTab({
  groups,
  searchQuery,
  onCreateNew,
  onSelectGroup,
}: GroupsListTabProps) {
  const filteredGroups = groups.filter((group) =>
    searchQuery
      ? group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.members.some((m) =>
          m.name.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : true,
  );

  if (filteredGroups.length === 0) {
    if (searchQuery) {
      return (
        <View className="py-16 items-center">
          <Text className="text-white/40 text-center">
            No groups match "{searchQuery}"
          </Text>
          <Text className="text-white/30 text-sm text-center mt-2">
            Try a different name or member
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
          onPress={onCreateNew}
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
      {filteredGroups.map((group, index) => (
        <GroupItem
          key={group.id}
          group={group}
          index={index}
          onPress={onSelectGroup}
        />
      ))}
    </View>
  );
}
