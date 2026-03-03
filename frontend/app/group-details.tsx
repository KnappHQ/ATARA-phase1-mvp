import { View, Text, ScrollView, Pressable, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus } from "lucide-react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { COLORS } from "@/utils/constants";
import { useGroups, Group } from "@/hooks/useGroups";
import { useState } from "react";
import { GroupDetailsHeader } from "@/components/groupDetails/GroupDetailsHeader";
import { GroupBalanceCard } from "@/components/groupDetails/GroupBalanceCard";
import { GroupExpenseList } from "@/components/groupDetails/GroupExpenseList";
import { AddExpenseModal } from "@/components/groupDetails/AddExpenseModal";

export default function GroupDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { groups, addExpense, getUserBalance } = useGroups();
  const [showAddExpense, setShowAddExpense] = useState(false);

  // Parse group from params
  let group: Group | undefined;

  try {
    const groupId = params.id as string;
    const name = params.name as string;
    const membersStr = params.members as string;
    const expensesStr = params.expenses as string;
    const createdAt = params.createdAt as string;

    if (groupId && name && membersStr && expensesStr) {
      group = {
        id: groupId,
        name,
        members: JSON.parse(membersStr),
        expenses: JSON.parse(expensesStr),
        createdAt,
      };
    }
  } catch (error) {
    console.error("Error parsing group params:", error);
    const groupId = params.id as string;
    group = groupId ? groups.find((g) => g.id === groupId) : undefined;
  }

  if (!group) {
    return (
      <SafeAreaView className="flex-1 bg-black">
        <View className="flex-1 items-center justify-center">
          <Text className="text-white/40">Group not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const balance = getUserBalance(group);

  const handleSettleUp = () => {
    if (!group || balance.youOwe <= 0) return;
    router.push({
      pathname: "/send",
      params: {
        preselectedName: group.members[1]?.name || "Group Member",
        preselectedAddress: group.members[1]?.address,
        amount: balance.youOwe.toFixed(2),
        note: `Settlement: ${group.name}`,
      },
    });
  };

  const handleAddExpense = (
    paidById: string,
    paidByName: string,
    amount: number,
    description: string,
  ) => {
    if (!group) return;
    addExpense(group.id, paidById, paidByName, amount, description);
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <GroupDetailsHeader
          name={group.name}
          members={group.members}
          onBack={() => router.back()}
        />

        <GroupBalanceCard balance={balance} onSettleUp={handleSettleUp} />

        <GroupExpenseList
          expenses={group.expenses}
          memberCount={group.members.length}
        />
      </ScrollView>

      <AddExpenseModal
        isOpen={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        members={group.members}
        onAdd={handleAddExpense}
      />

      {/* Floating Add Expense Button */}
      <Pressable
        onPress={() => setShowAddExpense(true)}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full items-center justify-center active:opacity-80"
        style={[
          { backgroundColor: COLORS.accent },
          Platform.OS === "ios" && {
            shadowColor: "#000",
            shadowOpacity: 0.3,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
          },
        ]}
      >
        <Plus size={24} color="#000" strokeWidth={2.5} />
      </Pressable>
    </SafeAreaView>
  );
}
