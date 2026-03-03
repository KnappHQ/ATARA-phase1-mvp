import { View, Text } from "react-native";
import { DollarSign } from "lucide-react-native";
import { COLORS } from "@/utils/constants";
import { GroupExpense } from "@/hooks/useGroups";
import { GroupExpenseItem } from "./GroupExpenseItem";

interface GroupExpenseListProps {
  expenses: GroupExpense[];
  memberCount: number;
}

export const GroupExpenseList = ({
  expenses,
  memberCount,
}: GroupExpenseListProps) => {
  return (
    <View>
      <View className="px-6 mb-4 flex-row items-center justify-between">
        <Text
          className="flex-1 text-sm font-medium uppercase tracking-widest"
          style={{ color: `${COLORS.white}99` }}
        >
          Expenses
        </Text>
        <Text
          className="text-sm font-mono"
          style={{ color: `${COLORS.white}66` }}
        >
          {expenses.length} total
        </Text>
      </View>

      {expenses.length === 0 ? (
        <View className="px-6 py-12 items-center">
          <DollarSign size={40} color={`${COLORS.white}33`} />
          <Text className="text-sm mt-3" style={{ color: `${COLORS.white}66` }}>
            No expenses yet
          </Text>
          <Text className="text-xs mt-1" style={{ color: `${COLORS.white}4d` }}>
            Tap + to add one
          </Text>
        </View>
      ) : (
        <View className="px-6 pb-24">
          {[...expenses].reverse().map((expense, index) => (
            <GroupExpenseItem
              key={expense.id}
              expense={expense}
              index={index}
              memberCount={memberCount}
            />
          ))}
        </View>
      )}
    </View>
  );
};
