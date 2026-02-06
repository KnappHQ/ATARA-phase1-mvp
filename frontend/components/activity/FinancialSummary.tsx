import { ArrowDownLeft, Scale, Check } from "lucide-react-native";
import { Text, View } from "react-native";
import { MotiView } from "moti";
import { COLORS } from "@/utils/constants";

interface FinancialSummaryProps {
  totalReceived: number;
  totalSent: number;
  contactName: string;
}

export const FinancialSummary = ({
  totalReceived,
  totalSent,
  contactName,
}: FinancialSummaryProps) => {
  const netBalance = totalReceived - totalSent;
  const isSettled = Math.abs(netBalance) < 0.01;
  const youOwe = netBalance > 0;
  const absoluteBalance = Math.abs(netBalance);

  return (
    <MotiView
      from={{ opacity: 0, translateY: -10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 400 }}
      className="mb-4 p-4 rounded-2xl"
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.15)",
      }}
    >
      {/* Header */}
      <View className="flex-row items-center gap-2 mb-3">
        <Scale size={14} color="rgba(255, 255, 255, 0.4)" />
        <Text
          className="text-xs uppercase tracking-widest font-mono"
          style={{ color: "rgba(255, 255, 255, 0.4)" }}
        >
          Financial Summary
        </Text>
      </View>

      {/* Stats */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <ArrowDownLeft size={12} color={COLORS.accent} />
          <Text
            className="text-xs uppercase tracking-wide"
            style={{ color: "rgba(255, 255, 255, 0.4)" }}
          >
            Received
          </Text>
          <Text className="font-mono text-sm" style={{ color: COLORS.accent }}>
            $
            {totalReceived.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text
            className="text-xs uppercase tracking-wide"
            style={{ color: "rgba(255, 255, 255, 0.4)" }}
          >
            Sent
          </Text>
          <Text
            className="font-mono text-sm"
            style={{ color: "rgba(255, 255, 255, 0.6)" }}
          >
            $
            {totalSent.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        </View>
      </View>

      {/* Separator */}
      <View
        className="h-px mb-3"
        style={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}
      />

      {/* Net Balance Display */}
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          {isSettled ? (
            <View className="flex-row items-center gap-2">
              <View
                className="w-5 h-5 rounded-full items-center justify-center"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}
              >
                <Scale size={12} color="rgba(255, 255, 255, 0.6)" />
              </View>
              <Text
                className="font-mono text-sm"
                style={{ color: "rgba(255, 255, 255, 0.6)" }}
              >
                Settled
              </Text>
            </View>
          ) : youOwe ? (
            <View>
              <Text
                className="text-xs uppercase tracking-wide"
                style={{ color: "rgba(255, 255, 255, 0.4)" }}
              >
                Net Balance
              </Text>
              <Text
                className="font-mono text-base mt-0.5"
                style={{ color: COLORS.white }}
              >
                You owe {contactName.split(" ")[0]}{" "}
                <Text className="font-semibold">
                  $
                  {absoluteBalance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              </Text>
            </View>
          ) : (
            <View>
              <Text
                className="text-xs uppercase tracking-wide"
                style={{ color: "rgba(255, 255, 255, 0.4)" }}
              >
                Net Balance
              </Text>
              <Text
                className="font-mono text-base mt-0.5"
                style={{ color: COLORS.accent }}
              >
                {contactName.split(" ")[0]} owes you{" "}
                <Text className="font-semibold">
                  $
                  {absoluteBalance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              </Text>
            </View>
          )}
        </View>

        {/* Settled Checkmark */}
        {isSettled && (
          <View
            className="w-8 h-8 rounded-full items-center justify-center"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.1)",
            }}
          >
            <Check size={16} color="rgba(255, 255, 255, 0.5)" />
          </View>
        )}
      </View>
    </MotiView>
  );
};
