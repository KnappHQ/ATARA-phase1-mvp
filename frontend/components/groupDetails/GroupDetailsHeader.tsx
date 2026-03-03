import { View, Text, Pressable } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { COLORS } from "@/utils/constants";
import { GroupMember } from "@/hooks/useGroups";

interface GroupDetailsHeaderProps {
  name: string;
  members: GroupMember[];
  onBack: () => void;
}

export const GroupDetailsHeader = ({
  name,
  members,
  onBack,
}: GroupDetailsHeaderProps) => {
  const visible = members.slice(0, 4);
  const overflow = members.length - visible.length;

  return (
    <View className="flex-row items-center gap-3 px-6 pt-4 pb-6">
      <Pressable
        onPress={onBack}
        className="w-12 h-12 rounded-full items-center justify-center"
        style={{
          backgroundColor: `${COLORS.white}08`,
          borderWidth: 1,
          borderColor: `${COLORS.white}18`,
        }}
      >
        <ArrowLeft size={20} color={COLORS.white} />
      </Pressable>

      <View className="flex-1">
        <Text className="text-lg font-semibold text-white">{name}</Text>
        <Text
          className="text-xs font-mono mt-0.5"
          style={{ color: `${COLORS.white}66` }}
        >
          {members.length} members · Base Network
        </Text>
      </View>

      <View className="flex-row items-center">
        {visible.map((member, idx) => (
          <View
            key={member.id}
            className="w-8 h-8 rounded-full items-center justify-center"
            style={{
              backgroundColor: "#1c1c1e",
              borderWidth: 2,
              borderColor: COLORS.black,
              marginLeft: idx > 0 ? -10 : 0,
              zIndex: 10 - idx,
            }}
          >
            <Text className="text-[10px] font-semibold text-white">
              {member.avatar}
            </Text>
          </View>
        ))}
        {overflow > 0 && (
          <View
            className="w-8 h-8 rounded-full items-center justify-center"
            style={{
              backgroundColor: "#1c1c1e",
              borderWidth: 2,
              borderColor: COLORS.black,
              marginLeft: -10,
            }}
          >
            <Text
              className="text-[9px] font-mono"
              style={{ color: `${COLORS.white}99` }}
            >
              +{overflow}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};
