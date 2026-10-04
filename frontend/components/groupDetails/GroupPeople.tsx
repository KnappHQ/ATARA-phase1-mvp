import { View, Text, Pressable } from "react-native";
import { COLORS } from "@/utils/constants";
import type { GroupMember } from "@/stores/useGroupStore";

interface GroupPeopleProps {
  members: GroupMember[];
  /** Added by someone, and who have not said yes yet. */
  pending: GroupMember[];
  myId: string | undefined;
  onSafety: (handle: string) => void;
}

/**
 * Everyone else in the group, each with a way to report or block them. People who
 * have not accepted the invitation are listed too, marked as invited: they are
 * not part of any expense until they say yes.
 */
export const GroupPeople = ({ members, pending, myId, onSafety }: GroupPeopleProps) => {
  const others = [
    ...members.filter((member) => member.id !== myId).map((member) => ({ member, invited: false })),
    ...pending.map((member) => ({ member, invited: true })),
  ];
  if (others.length === 0) return null;

  return (
    <View
      className="mx-6 mb-6 rounded-2xl p-4"
      style={{ backgroundColor: `${COLORS.white}08`, borderWidth: 1, borderColor: `${COLORS.white}18` }}
    >
      <Text className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: `${COLORS.white}66` }}>
        People
      </Text>
      {others.map(({ member, invited }, index) => (
        <View
          key={member.id}
          className="flex-row items-center py-2"
          style={{ borderTopWidth: index > 0 ? 1 : 0, borderTopColor: `${COLORS.white}10` }}
        >
          <View className="flex-1">
            <Text className="text-sm text-white" numberOfLines={1}>{member.name}</Text>
            {invited ? <Text className="text-xs text-white/40 mt-0.5">Invited, has not accepted yet</Text> : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Report or block @${member.handle}`}
            hitSlop={8}
            onPress={() => onSafety(member.handle)}
            className="px-3 py-1.5 rounded-xl"
            style={{ borderWidth: 1, borderColor: `${COLORS.white}20` }}
          >
            <Text className="text-xs font-semibold text-white/70">Report or block</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
};
