import { View, ScrollView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState, useMemo } from "react";
import { useGroups, GroupMember } from "@/hooks/useGroups";
import { SAMPLE_CONTACTS } from "@/components/groupCreate/groupContacts";
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
  const { createGroup } = useGroups();

  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<GroupMember[]>([]);

  const filteredContacts = useMemo(
    () =>
      SAMPLE_CONTACTS.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.address.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [searchQuery],
  );

  const toggleMember = (member: GroupMember) => {
    setSelectedMembers((prev) =>
      prev.find((m) => m.id === member.id)
        ? prev.filter((m) => m.id !== member.id)
        : [...prev, member],
    );
  };

  const handleCreate = () => {
    if (!groupName.trim() || selectedMembers.length === 0) return;
    const allMembers: GroupMember[] = [
      {
        id: "self",
        name: "You",
        address: "0x000000000000000000000000000000000000000",
        avatar: "YO",
      },
      ...selectedMembers,
    ];
    createGroup(groupName.trim(), allMembers);
    if (Platform.OS === "ios") navigator.vibrate?.([10, 30, 10]);
    router.back();
  };

  const isValid = groupName.trim().length > 0 && selectedMembers.length > 0;

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

          {filteredContacts.map((contact, index) => (
            <GroupContactRow
              key={contact.id}
              contact={contact}
              index={index}
              isSelected={selectedMembers.some((m) => m.id === contact.id)}
              onToggle={toggleMember}
            />
          ))}

          {filteredContacts.length === 0 && searchQuery.length > 0 && (
            <View className="items-center py-8">
              <Users size={40} color={`${COLORS.white}33`} />
              <Text
                className="text-sm mt-3"
                style={{ color: `${COLORS.white}66` }}
              >
                No contacts found
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
