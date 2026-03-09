import { ChevronRight, Scale, Users } from "lucide-react-native";
import { Pressable, View, Text } from "react-native";
import { MotiView } from "moti";
import { COLORS } from "@/utils/constants";
import { Group } from "@/stores/useGroupStore";

function getBalanceLabel(net: number): { label: string; color: string } {
  if (Math.abs(net) < 0.01)
    return { label: "All settled", color: "rgba(255,255,255,0.3)" };
  if (net > 0)
    return { label: `You're owed $${net.toFixed(2)}`, color: COLORS.accent };
  return {
    label: `You owe $${Math.abs(net).toFixed(2)}`,
    color: "rgba(255, 255, 255, 0.6)",
  };
}

interface GroupItemProps {
  group: Group;
  index: number;
  onPress: (group: Group) => void;
}

export const GroupItem = ({ group, index, onPress }: GroupItemProps) => {
  const balance = getBalanceLabel(group.userNetBalance);
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 150, delay: index * 50 }}
    >
      <Pressable
        onPress={() => onPress(group)}
        className="p-4 rounded-2xl mb-2 active:opacity-70 border bg-white/5 border-white/15"
      >
        <View className="flex-row items-center gap-4">
          <View className="w-12 h-12 rounded-full items-center justify-center bg-white/10 border border-white/20">
            <Users size={20} color="rgba(255, 255, 255, 0.6)" />
          </View>

          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-1">
              <Text
                className="text-base font-medium text-white flex-1"
                numberOfLines={1}
              >
                {group.name}
              </Text>
              <Text className="text-sm ml-2 text-white/40">
                {group.memberCount} members
              </Text>
            </View>

            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-1">
                <Scale size={12} color={balance.color} />
                <Text
                  className="font-mono text-[10px]"
                  style={{ color: balance.color }}
                >
                  {balance.label}
                </Text>
              </View>

              <Text className="text-xs text-white/30">{group.createdAt}</Text>
            </View>
          </View>

          <ChevronRight size={16} color="rgba(255, 255, 255, 0.2)" />
        </View>
      </Pressable>
    </MotiView>
  );
};
