import { View, Text, Pressable } from "react-native";
import { MotiView } from "moti";
import { Scale, Check } from "lucide-react-native";
import { COLORS } from "@/utils/constants";

interface GroupBalance {
  youOwe: number;
  groupOwesYou: number;
}

interface GroupBalanceCardProps {
  balance: GroupBalance;
  onSettleUp: () => void;
}

export const GroupBalanceCard = ({
  balance,
  onSettleUp,
}: GroupBalanceCardProps) => {
  const isSettled = balance.youOwe < 0.01 && balance.groupOwesYou < 0.01;

  return (
    <MotiView
      from={{ opacity: 0, translateY: -10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 300 }}
      style={{
        marginHorizontal: 24,
        marginBottom: 24,
        padding: 16,
        borderRadius: 16,
        backgroundColor: `${COLORS.white}08`,
        borderWidth: 1,
        borderColor: `${COLORS.white}18`,
      }}
    >
      <View className="flex-row items-center gap-2 mb-3">
        <Scale size={14} color={`${COLORS.white}66`} />
        <Text
          className="text-xs font-mono uppercase tracking-wider"
          style={{ color: `${COLORS.white}66` }}
        >
          Your Balance
        </Text>
      </View>

      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          {isSettled ? (
            <View className="flex-row items-center gap-2">
              <View
                className="w-6 h-6 rounded-full items-center justify-center"
                style={{ backgroundColor: `${COLORS.white}0a` }}
              >
                <Check size={16} color={`${COLORS.white}99`} />
              </View>
              <Text
                className="font-mono text-base"
                style={{ color: `${COLORS.white}99` }}
              >
                All settled up
              </Text>
            </View>
          ) : balance.youOwe > 0 ? (
            <View>
              <Text
                className="text-xs font-mono uppercase"
                style={{ color: `${COLORS.white}66` }}
              >
                Status
              </Text>
              <Text className="font-mono text-xl text-white mt-1">
                You owe the group{" "}
                <Text className="font-semibold">
                  ${balance.youOwe.toFixed(2)}
                </Text>
              </Text>
            </View>
          ) : (
            <View>
              <Text
                className="text-xs font-mono uppercase"
                style={{ color: `${COLORS.white}66` }}
              >
                Status
              </Text>
              <Text
                className="font-mono text-xl mt-1"
                style={{ color: COLORS.accent }}
              >
                The group owes you{" "}
                <Text className="font-semibold">
                  ${balance.groupOwesYou.toFixed(2)}
                </Text>
              </Text>
            </View>
          )}
        </View>

        {balance.youOwe > 0 && (
          <Pressable
            onPress={onSettleUp}
            className="px-5 py-3 rounded-2xl ml-4 active:opacity-80"
            style={{ backgroundColor: COLORS.accent }}
          >
            <Text className="font-mono text-sm font-semibold text-black">
              Settle Up
            </Text>
          </Pressable>
        )}
      </View>
    </MotiView>
  );
};
