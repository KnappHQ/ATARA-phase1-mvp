import { View, ScrollView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState, useEffect, useRef } from "react";
import {
  useGroupStore,
  GroupMember,
  mapContactToMember,
} from "@/stores/useGroupStore";
import { useContactStore } from "@/stores/useContactStore";
import { GroupCreateHeader } from "@/components/groupCreate/GroupCreateHeader";
import { GroupNameInput } from "@/components/groupCreate/GroupNameInput";
import { GroupMemberPills } from "@/components/groupCreate/GroupMemberPills";
import { GroupContactSearchBar } from "@/components/groupCreate/GroupContactSearchBar";
import { GroupContactRow } from "@/components/groupCreate/GroupContactRow";
import { GroupCreateFooter } from "@/components/groupCreate/GroupCreateFooter";
import { Text } from "react-native";
import { Users } from "lucide-react-native";
import { COLORS } from "@/utils/constants";

export default function GroupCreateScreen() {
  const router = useRouter();
  const { createGroup } = useGroupStore();
  const {
    recentContacts,
    searchResults: contactSearchResults,
    isLoadingSearch,
    searchContacts,
  } = useContactStore();

  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<GroupMember[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchContacts(searchQuery.trim());
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const isSearchMode = searchQuery.trim().length > 0;
  const allResults = isSearchMode
    ? contactSearchResults.map(mapContactToMember)
    : recentContacts.map(mapContactToMember);
  const displayList = allResults.filter(
    (r) => !selectedMembers.some((m) => m.id === r.id),
  );

  const toggleMember = (member: GroupMember) => {
    setSelectedMembers((prev) =>
      prev.find((m) => m.id === member.id)
        ? prev.filter((m) => m.id !== member.id)
        : [...prev, member],
    );
  };

  const handleCreate = async () => {
    if (!groupName.trim() || selectedMembers.length === 0 || isCreating) return;
    setIsCreating(true);
    try {
      const handles = selectedMembers.map((m) => m.handle);
      await createGroup(groupName.trim(), handles);
      router.back();
    } catch (err: any) {
      console.error("Failed to create group:", err);
    } finally {
      setIsCreating(false);
    }
  };

  const isValid =
    groupName.trim().length > 0 && selectedMembers.length > 0 && !isCreating;

  return (
    <SafeAreaView className="flex-1 bg-black">
      <GroupCreateHeader onBack={() => router.back()} />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 pt-6">
          <GroupNameInput value={groupName} onChange={setGroupName} />

          <GroupMemberPills
            selectedMembers={selectedMembers}
            onRemove={toggleMember}
          />

          <GroupContactSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
          />

          {isLoadingSearch && (
            <View className="items-center py-6">
              <ActivityIndicator
                size="small"
                color="rgba(255, 255, 255, 0.4)"
              />
            </View>
          )}

          {!isLoadingSearch &&
            displayList.map((contact, index) => (
              <GroupContactRow
                key={contact.id}
                contact={contact}
                index={index}
                isSelected={selectedMembers.some((m) => m.id === contact.id)}
                onToggle={toggleMember}
              />
            ))}

          {!isLoadingSearch &&
            isSearchMode &&
            displayList.length === 0 &&
            searchQuery.trim().length >= 2 && (
              <View className="items-center py-8">
                <Users size={40} color={`${COLORS.white}33`} />
                <Text
                  className="text-sm mt-3"
                  style={{ color: `${COLORS.white}66` }}
                >
                  No users found for "{searchQuery}"
                </Text>
              </View>
            )}

          {isSearchMode && searchQuery.trim().length < 2 && (
            <View className="items-center py-6">
              <Text
                className="text-xs font-mono"
                style={{ color: `${COLORS.white}4d` }}
              >
                Type at least 2 characters to search
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <GroupCreateFooter
        memberCount={selectedMembers.length + 1}
        isValid={isValid}
        onCreate={handleCreate}
      />
    </SafeAreaView>
  );
}
