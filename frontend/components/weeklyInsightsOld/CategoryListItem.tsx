import React from "react";
import { View, Text, Pressable } from "react-native";
import { MotiView } from "moti";
import {
  Users,
  ShoppingBag,
  Terminal,
  MoreHorizontal,
  Circle,
  ArrowDownLeft,
} from "lucide-react-native";

function getCategoryIcon(icon: string) {
  switch (icon) {
    case "users":
      return <Users size={20} color="#ffe066" />;
    case "arrow-down-left":
      return <ArrowDownLeft size={20} color="#ffe066" />;
    case "shopping-bag":
      return <ShoppingBag size={20} color="#ffe066" />;
    case "terminal":
      return <Terminal size={20} color="#ffe066" />;
    case "more-horizontal":
      return <MoreHorizontal size={20} color="#ffe066" />;
    default:
      return <Circle size={20} color="#ffe066" />;
  }
}

export const CategoryListItem = ({
  category,
  index,
  onPress,
}: {
  category: any;
  index: number;
  onPress: () => void;
}) => {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 400, delay: 100 + index * 80 }}
    >
      <Pressable
        onPress={onPress}
        className="bg-[#0e0d10] rounded-xl p-4 border border-[#E5D2A6]/10 active:bg-[#E5D2A6]/5"
      >
        <View className="flex-row items-center gap-4">
          <View
            className="w-10 h-10 rounded-md bg-[#E5D2A6]/5 border border-[#E5D2A6]/20 items-center justify-center"
            style={{
              boxShadow:
                "0 0 32px 12px rgba(229, 210, 166, 0.07), 0 0 2px 0px rgba(229, 210, 166, 0.04)",
            }}
          >
            {getCategoryIcon(category.icon)}
          </View>

          <View className="flex-1">
            <View className="flex-row justify-between items-center mb-2">
              <Text
                className="text-base font-rajdhani-medium text-white/90 flex-1"
                numberOfLines={1}
              >
                {category.name}
              </Text>
              <Text className="text-base font-rajdhani-semibold text-white ml-2">
                $
                {category.amount.toLocaleString("en-US", {
                  minimumFractionDigits: 4,
                })}
              </Text>
            </View>

            <View className="h-1 bg-white/5 rounded-full overflow-hidden">
              <MotiView
                className="h-full rounded-full bg-champagne"
                from={{ width: "0%" }}
                animate={{ width: `${category.percentage}%` }}
                transition={{
                  type: "timing",
                  duration: 800,
                  delay: 300 + index * 100,
                }}
              />
            </View>
          </View>

          <Text className="text-xs font-mono text-champagne ml-2">
            {category.percentage}%
          </Text>
        </View>
      </Pressable>
    </MotiView>
  );
};
