import { ChevronRight, Scale, Users } from "lucide-react-native";
import { Pressable, View, Text } from "react-native";
import { MotiView } from "moti";
import { COLORS } from "@/utils/constants";
import { Group, useGroups } from "@/hooks/useGroups";

interface GroupItemProps {
  group: Group;
  index: number;
  onPress: (group: Group) => void;
}

export const GroupItem = ({ group, index, onPress }: GroupItemProps) => {
  const { getUserBalance } = useGroups();
  const balance = getUserBalance(group);
  const isSettled = balance.youOwe < 0.01 && balance.groupOwesYou < 0.01;
  const totalExpenses = group.expenses.reduce((sum, e) => sum + e.amount, 0);

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
                {group.members.length} members
              </Text>
            </View>

            <Text className="text-sm mb-1 text-white/40" numberOfLines={1}>
              $
              {totalExpenses.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              total expenses
            </Text>

            <View className="flex-row items-center justify-between">
              <Text className="font-mono text-xs uppercase tracking-wide text-white/30">
                {group.expenses.length} expense
                {group.expenses.length !== 1 ? "s" : ""}
              </Text>

              <View className="flex-row items-center gap-1">
                {isSettled ? (
                  <>
                    <Scale size={12} color="rgba(255, 255, 255, 0.3)" />
                    <Text
                      className="font-mono text-[10px]"
                      style={{ color: "rgba(255, 255, 255, 0.3)" }}
                    >
                      Settled
                    </Text>
                  </>
                ) : balance.youOwe > 0 ? (
                  <Text
                    className="font-mono text-[10px]"
                    style={{ color: "rgba(255, 255, 255, 0.5)" }}
                  >
                    You owe ${balance.youOwe.toFixed(2)}
                  </Text>
                ) : (
                  <Text
                    className="font-mono text-[10px]"
                    style={{ color: COLORS.accent }}
                  >
                    +${balance.groupOwesYou.toFixed(2)} owed
                  </Text>
                )}
              </View>
            </View>
          </View>

          <ChevronRight size={16} color="rgba(255, 255, 255, 0.2)" />
        </View>
      </Pressable>
    </MotiView>
  );
};
