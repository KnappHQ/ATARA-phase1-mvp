import { View, Text, TouchableOpacity } from "react-native";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react-native";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import { COLORS } from "@/utils/constants";
import { truncateAddress } from "@/utils/format";
import { DisplayTransaction } from "@/stores/useTransactionHistoryStore";
import { TransactionsSkeleton } from "./ActivitySkeleton";
import { RowHeader } from "@/components/activity/RowHeader";
import { MAX_ROW_FONT_MULTIPLIER } from "@/utils/rowLayout";
import { useRouter } from "expo-router";

interface ActivityListProps {
  transactions: DisplayTransaction[];
  isLoading: boolean;
}

export const ActivityList = ({
  transactions,
  isLoading,
}: ActivityListProps) => {
  const router = useRouter();
  const handleTransactionPress = (transaction: DisplayTransaction) => {
    router.push({
      pathname: "/transaction-detail",
      params: {
        id: transaction.id,
        name: transaction.counterparty.name,
        address: transaction.counterparty.address || "",
        handle: transaction.counterparty.handle || "",
        amount: transaction.formattedAmount,
        date: transaction.displayDate,
        type: transaction.type,
        category: transaction.category || "",
        note: transaction.userNote || "",
        isInApp: transaction.isInApp.toString(),
      },
    });
  };

  return (
    <View className="flex-1">
      <Text
        className="text-sm uppercase text-white/40 mb-3"
        style={{ letterSpacing: 1.2 }}
      >
        Activity
      </Text>

      {isLoading && transactions.length === 0 ? (
        <TransactionsSkeleton />
      ) : transactions.length === 0 ? (
        <View className="py-8 items-center">
          <Text className="text-sm text-white/30">No transactions yet</Text>
        </View>
      ) : (
        <View>
          {transactions.map((tx, index) => {
            return (
              <MotiView
                key={tx.id}
                from={{ opacity: 0, translateY: 6 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{
                  type: "timing",
                  delay: index * 15,
                  duration: 100,
                }}
              >
                <TouchableOpacity
                  onPress={() => {
                    handleTransactionPress(tx);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  activeOpacity={0.8}
                  className="flex-row items-center py-4 border-b border-white/5"
                >
                  <View className="flex-1 flex-row items-center gap-3" style={{ minWidth: 0 }}>
                    <View className="w-8 h-8 items-center justify-center">
                      {tx.type === "receive" ? (
                        <ArrowDownLeft size={16} color={COLORS.accent} />
                      ) : (
                        <ArrowUpRight
                          size={16}
                          color="rgba(255, 255, 255, 0.8)"
                        />
                      )}
                    </View>
                    <View className="flex-1" style={{ minWidth: 0 }}>
                      <RowHeader
                        name={tx.counterparty.name}
                        address={tx.counterparty.showAddress ? truncateAddress(tx.counterparty.address) : null}
                        amount={tx.formattedAmount}
                        amountColor={tx.type === "receive" ? COLORS.accent : "rgba(255, 255, 255, 0.8)"}
                        nameClassName="text-base font-medium text-white/80"
                        addressClassName="text-xs text-platinum-muted/40"
                        amountClassName="text-sm font-medium"
                        amountStyle={{ fontVariant: ["tabular-nums"] }}
                      />
                      <Text className="text-xs text-platinum-muted/60" numberOfLines={1} maxFontSizeMultiplier={MAX_ROW_FONT_MULTIPLIER}>
                        {tx.displayDate}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </MotiView>
            );
          })}
        </View>
      )}
    </View>
  );
};
