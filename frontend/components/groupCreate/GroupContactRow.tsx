import { View, Text, Pressable } from "react-native";
import { MotiView } from "moti";
import { Check } from "lucide-react-native";
import { COLORS } from "@/utils/constants";
import { GroupMember } from "@/hooks/useGroups";

interface GroupContactRowProps {
  contact: GroupMember;
  index: number;
  isSelected: boolean;
  onToggle: (member: GroupMember) => void;
}

export const GroupContactRow = ({
  contact,
  index,
  isSelected,
  onToggle,
}: GroupContactRowProps) => {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 150, delay: index * 30 }}
      style={{ marginBottom: 8 }}
    >
      <Pressable
        onPress={() => onToggle(contact)}
        className="flex-row items-center gap-4 p-4 rounded-2xl active:opacity-70"
        style={{
          backgroundColor: isSelected
            ? `${COLORS.white}0a`
            : `${COLORS.white}08`,
          borderWidth: 1,
          borderColor: isSelected ? `${COLORS.white}2a` : `${COLORS.white}18`,
        }}
      >
        <View
          className="w-12 h-12 rounded-full items-center justify-center"
          style={{
            backgroundColor: `${COLORS.white}0a`,
            borderWidth: 1,
            borderColor: `${COLORS.white}1a`,
          }}
        >
          <Text className="text-sm font-medium text-white">
            {contact.avatar}
          </Text>
        </View>

        <View className="flex-1">
          <Text className="text-base font-medium text-white">
            {contact.name}
          </Text>
          <Text
            className="text-xs font-mono mt-0.5"
            style={{ color: `${COLORS.white}66` }}
          >
            {contact.address.slice(0, 10)}...{contact.address.slice(-8)}
          </Text>
        </View>

        <View
          className="w-6 h-6 rounded-full items-center justify-center"
          style={{
            backgroundColor: isSelected ? COLORS.platinum : `${COLORS.white}0a`,
            borderWidth: isSelected ? 0 : 1,
            borderColor: `${COLORS.white}1a`,
          }}
        >
          {isSelected && <Check size={14} color={COLORS.black} />}
        </View>
      </Pressable>
    </MotiView>
  );
};
