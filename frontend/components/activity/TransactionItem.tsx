import { ArrowDownLeft, ArrowUpRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { MotiView } from "moti";
import { COLORS } from "@/utils/constants";
import { DisplayTransaction } from "@/stores/useTransactionHistoryStore";
import { truncateAddress } from "@/utils/format";
import { RowHeader } from "./RowHeader";
import { MAX_ROW_FONT_MULTIPLIER } from "@/utils/rowLayout";

interface TransactionItemProps {
  transaction: DisplayTransaction;
  index: number;
  onPress: (transaction: DisplayTransaction) => void;
}

export const TransactionItem = ({
  transaction,
  index,
  onPress,
}: TransactionItemProps) => {
  const isReceive = transaction.type === "receive";

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 150, delay: index * 30 }}
    >
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress(transaction);
        }}
        className="px-4 py-4 rounded-3xl mb-2 active:opacity-70 bg-white/5 border border-white/15"
      >
        <View className="flex-row items-center gap-4">
          <View
            className="w-12 h-12 rounded-full items-center justify-center"
            style={{
              backgroundColor: isReceive
                ? `${COLORS.accent}1A`
                : "rgba(255, 255, 255, 0.05)",
              borderWidth: 1,
              borderColor: isReceive
                ? `${COLORS.accent}33`
                : "rgba(255, 255, 255, 0.15)",
            }}
          >
            {isReceive ? (
              <ArrowDownLeft size={18} color={COLORS.accent} />
            ) : (
              <ArrowUpRight size={18} color="rgba(255, 255, 255, 0.6)" />
            )}
          </View>

          <View className="flex-1" style={{ minWidth: 0 }}>
            <View className="mb-0.5">
              <RowHeader
                name={transaction.counterparty.name}
                address={transaction.counterparty.showAddress ? truncateAddress(transaction.counterparty.address) : null}
                amount={transaction.formattedAmount}
                amountColor={isReceive ? COLORS.accent : "rgba(255, 255, 255, 0.6)"}
                nameClassName="text-base font-medium text-white"
                addressClassName="text-xs font-mono text-white/30"
                amountClassName="font-mono text-base"
              />
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm flex-1 text-white/40" numberOfLines={1} maxFontSizeMultiplier={MAX_ROW_FONT_MULTIPLIER}>
                {transaction.userNote || (isReceive ? "Received" : "Sent")}
              </Text>
              <Text className="text-sm ml-2 text-white/30" numberOfLines={1} maxFontSizeMultiplier={MAX_ROW_FONT_MULTIPLIER}>
                {transaction.displayDateShort}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </MotiView>
  );
};
