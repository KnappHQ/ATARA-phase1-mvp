import { View, Text, Pressable } from "react-native";
import { MotiView } from "moti";
import { Check, Scale } from "lucide-react-native";
import { COLORS } from "@/utils/constants";
import { GroupMemberBalance } from "@/stores/useGroupStore";
import { getInitials } from "@/utils/format";

interface MemberBalanceListProps {
  memberBalances: GroupMemberBalance[];
  onSettle: (member: GroupMemberBalance) => void;
}

export const MemberBalanceList = ({
  memberBalances,
  onSettle,
}: MemberBalanceListProps) => {
  const allSettled = memberBalances.every((b) => Math.abs(b.netBalance) < 0.01);

  const displayName = (b: GroupMemberBalance) =>
    b.displayName || `@${b.handle}`;

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
          Balances
        </Text>
      </View>

      {allSettled ? (
        <View className="flex-row items-center gap-2 py-1">
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
      ) : (
        <View>
          {memberBalances.map((b, i) => {
            const isSettled = Math.abs(b.netBalance) < 0.01;
            const owesThem = b.netBalance < 0;
            const owesMe = b.netBalance > 0;

            return (
              <MotiView
                key={b.userId}
                from={{ opacity: 0, translateX: -8 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: "timing", duration: 250, delay: i * 60 }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingTop: i > 0 ? 14 : 2,
                  marginTop: i > 0 ? 0 : 0,
                  borderTopWidth: i > 0 ? 1 : 0,
                  borderTopColor: `${COLORS.white}10`,
                }}
              >
                <View
                  className="w-8 h-8 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: `${COLORS.white}0f` }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: COLORS.white }}
                  >
                    {getInitials(b.displayName, b.handle)}
                  </Text>
                </View>

                <View className="flex-1">
                  <Text
                    className="text-sm font-medium text-white"
                    numberOfLines={1}
                  >
                    {displayName(b)}
                  </Text>
                  {isSettled ? (
                    <Text
                      className="text-xs font-mono mt-0.5"
                      style={{ color: `${COLORS.white}40` }}
                    >
                      all square
                    </Text>
                  ) : owesMe ? (
                    <Text
                      className="text-xs font-mono mt-0.5"
                      style={{ color: COLORS.accent }}
                    >
                      owes you ${b.netBalance.toFixed(2)}
                    </Text>
                  ) : (
                    <Text
                      className="text-xs font-mono mt-0.5"
                      style={{ color: `${COLORS.white}80` }}
                    >
                      you owe ${Math.abs(b.netBalance).toFixed(2)}
                    </Text>
                  )}
                </View>

                {/* Settle button — only when you owe them */}
                {owesThem && (
                  <Pressable
                    onPress={() => onSettle(b)}
                    className="px-3 py-1.5 rounded-xl ml-2 active:opacity-70"
                    style={{
                      backgroundColor: `${COLORS.white}10`,
                      borderWidth: 1,
                      borderColor: `${COLORS.white}20`,
                    }}
                  >
                    <Text
                      className="font-mono text-xs font-semibold"
                      style={{ color: COLORS.white }}
                    >
                      Settle
                    </Text>
                  </Pressable>
                )}
              </MotiView>
            );
          })}
        </View>
      )}
    </MotiView>
  );
};
