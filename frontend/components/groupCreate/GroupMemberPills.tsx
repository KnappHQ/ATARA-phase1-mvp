import { View, Text, Pressable } from "react-native";
import { MotiView } from "moti";
import { X } from "lucide-react-native";
import { COLORS } from "@/utils/constants";
import { GroupMember } from "@/stores/useGroupStore";

interface GroupMemberPillsProps {
  selectedMembers: GroupMember[];
  onRemove: (member: GroupMember) => void;
}

export const GroupMemberPills = ({
  selectedMembers,
  onRemove,
}: GroupMemberPillsProps) => {
  if (selectedMembers.length === 0) return null;

  return (
    <View className="mb-6">
      <Text
        className="text-xs font-mono uppercase tracking-wide mb-3"
        style={{ color: `${COLORS.white}66` }}
      >
        Members ({selectedMembers.length + 1})
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <View
          className="flex-row items-center gap-2 px-3 py-2 rounded-full"
          style={{
            backgroundColor: `${COLORS.platinum}33`,
            borderWidth: 1,
            borderColor: `${COLORS.platinum}4d`,
          }}
        >
          <View
            className="w-6 h-6 rounded-full items-center justify-center"
            style={{ backgroundColor: `${COLORS.platinum}4d` }}
          >
            <Text className="text-[10px] font-semibold text-white">YO</Text>
          </View>
          <Text className="text-sm text-white font-medium">You</Text>
        </View>

        {selectedMembers.map((member) => (
          <MotiView
            key={member.id}
            from={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "timing", duration: 150 }}
          >
            <Pressable
              onPress={() => onRemove(member)}
              className="flex-row items-center gap-2 px-3 py-2 rounded-full"
              style={{
                backgroundColor: `${COLORS.white}0a`,
                borderWidth: 1,
                borderColor: `${COLORS.white}1a`,
              }}
            >
              <View
                className="w-6 h-6 rounded-full items-center justify-center"
                style={{ backgroundColor: `${COLORS.white}1a` }}
              >
                <Text className="text-[10px] font-semibold text-white">
                  {member.avatar}
                </Text>
              </View>
              <Text className="text-sm text-white">
                {member.name.split(" ")[0]}
              </Text>
              <X size={14} color={`${COLORS.white}66`} />
            </Pressable>
          </MotiView>
        ))}
      </View>
    </View>
  );
};
