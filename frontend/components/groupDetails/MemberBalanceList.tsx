import { View, Text, Pressable, Share } from "react-native";
import * as Haptics from "expo-haptics";
import { MotiView } from "moti";
import { Check, Scale } from "lucide-react-native";
import { COLORS } from "@/utils/constants";
import { useGroupStore, type GroupMemberBalance } from "@/stores/useGroupStore";
import { getInitials } from "@/utils/format";

interface MemberBalanceListProps {
  memberBalances: GroupMemberBalance[];
  onSettle: (member: GroupMemberBalance) => void;
}

export const MemberBalanceList = ({
  memberBalances,
  onSettle,
}: MemberBalanceListProps) => {
  const unit = useGroupStore(s => s.groupDetail?.assetSymbol ?? "USDC");
  const allSettled = memberBalances.every((b) => !b.owedByMe && !b.owedToMe);

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
            Aucune part acceptée à rembourser
          </Text>
        </View>
      ) : (
        <View>
          {memberBalances.map((b, i) => {
            const isSettled = !b.owedByMe && !b.owedToMe;
            const owesThem = b.owedByMe > 0;
            const owesMe = b.owedToMe > 0;

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
                  {isSettled ? <Text className="text-white/40 text-xs">Aucune part acceptée à régler</Text> : <View>
                    {owesThem && <Text className="text-white/70 text-xs mt-1">Tu dois {b.owedByMe.toFixed(2)} {unit}</Text>}
                    {owesMe && <Text style={{ color: COLORS.accent }} className="text-xs mt-1">Te doit {b.owedToMe.toFixed(2)} {unit}</Text>}
                    {owesMe && <Pressable onPress={() => Share.share({ message: `Salut @${b.handle}, rappel pour ta part acceptée de ${b.owedToMe.toFixed(2)} ${unit} dans notre groupe ATARA. Ouvre Groups pour vérifier et régler. Merci !` })}><Text className="text-white/50 text-xs mt-2">Partager un rappel</Text></Pressable>}
                  </View>}
                </View>

                {/* Settle button — only when you owe them */}
                {owesThem && unit === "USDC" && (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      onSettle(b);
                    }}
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
