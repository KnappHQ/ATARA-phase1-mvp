import { View, Text } from "react-native";
import { MotiView } from "moti";
import { COLORS } from "@/utils/constants";
import { GroupExpense } from "@/hooks/useGroups";

interface GroupExpenseItemProps {
  expense: GroupExpense;
  index: number;
  memberCount: number;
}

export const GroupExpenseItem = ({
  expense,
  index,
  memberCount,
}: GroupExpenseItemProps) => {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 150, delay: index * 40 }}
      style={{
        marginBottom: 8,
        padding: 16,
        borderRadius: 16,
        backgroundColor: `${COLORS.white}08`,
        borderWidth: 1,
        borderColor: `${COLORS.white}10`,
      }}
    >
      <View className="flex-row items-center gap-3 mb-2">
        <View
          className="w-12 h-12 rounded-full items-center justify-center"
          style={{
            backgroundColor: `${COLORS.white}0a`,
            borderWidth: 1,
            borderColor: `${COLORS.white}1a`,
          }}
        >
          <Text className="text-xs font-semibold text-white">
            {expense.paidByName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-base text-white">
            <Text className="font-semibold">{expense.paidByName}</Text>
            <Text style={{ color: `${COLORS.white}80` }}> paid </Text>
            <Text className="font-mono font-semibold">
              ${expense.amount.toFixed(2)}
            </Text>
          </Text>
          <Text
            className="text-sm mt-0.5"
            style={{ color: `${COLORS.white}66` }}
          >
            for {expense.description}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        <Text
          className="text-xs font-mono"
          style={{ color: `${COLORS.white}4d` }}
        >
          {expense.date}
        </Text>
        <Text
          className="text-xs font-mono"
          style={{ color: `${COLORS.white}99` }}
        >
          ${(expense.amount / memberCount).toFixed(2)} each
        </Text>
      </View>
    </MotiView>
  );
};
