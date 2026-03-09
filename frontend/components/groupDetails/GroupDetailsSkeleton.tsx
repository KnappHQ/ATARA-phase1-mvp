import { View, DimensionValue } from "react-native";
import { MotiView } from "moti";
import { COLORS } from "@/utils/constants";

const pulse = {
  from: { opacity: 0.3 },
  animate: { opacity: 0.6 },
  transition: { type: "timing" as const, duration: 1000, loop: true },
};

const Block = ({
  width,
  height,
  radius = 6,
}: {
  width: DimensionValue;
  height: number;
  radius?: number;
}) => (
  <View
    style={{
      width,
      height,
      backgroundColor: "rgba(255, 255, 255, 0.08)",
      borderRadius: radius,
    }}
  />
);

const BalanceCardSkeleton = () => (
  <MotiView
    {...pulse}
    className="mx-6 mb-4 px-5 py-5 rounded-3xl"
    style={{
      backgroundColor: `${COLORS.white}05`,
      borderWidth: 1,
      borderColor: `${COLORS.white}10`,
    }}
  >
    <View className="flex-row justify-between mb-4">
      {[0, 1].map((i) => (
        <View key={i} className="gap-2">
          <Block width={60} height={10} />
          <Block width={80} height={18} radius={8} />
        </View>
      ))}
    </View>
    <Block width="100%" height={44} radius={14} />
  </MotiView>
);

const ExpenseItemSkeleton = ({ delay }: { delay: number }) => (
  <MotiView
    from={{ opacity: 0.3 }}
    animate={{ opacity: 0.6 }}
    transition={{ type: "timing", duration: 1000, loop: true, delay }}
    className="flex-row items-center justify-between px-6 py-4 border-b"
    style={{ borderColor: `${COLORS.white}06` }}
  >
    <View className="flex-row items-center gap-3">
      <View
        className="w-10 h-10 rounded-full"
        style={{ backgroundColor: "rgba(255, 255, 255, 0.07)" }}
      />
      <View className="gap-1.5">
        <Block width={120} height={13} />
        <Block width={70} height={10} />
      </View>
    </View>
    <Block width={55} height={14} />
  </MotiView>
);

export const GroupDetailsSkeleton = () => (
  <View>
    <BalanceCardSkeleton />

    <MotiView
      {...pulse}
      className="flex-row items-center justify-between px-6 mb-3"
    >
      <Block width={80} height={10} />
      <Block width={40} height={10} />
    </MotiView>

    {[0, 1, 2, 3].map((i) => (
      <ExpenseItemSkeleton key={i} delay={i * 80} />
    ))}
  </View>
);
