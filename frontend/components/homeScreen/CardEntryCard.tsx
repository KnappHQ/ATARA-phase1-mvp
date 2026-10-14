import { Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import { CreditCard } from "lucide-react-native";
import { COLORS } from "@/utils/constants";

/** Entry to the card screen. Sits next to the QR payment, which it does not replace. */
export const CardEntryCard = ({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity
    onPress={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }}
    activeOpacity={0.75}
    accessibilityRole="button"
    className="flex-row items-center rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-6"
  >
    <View className="w-10 h-10 rounded-xl bg-white/10 items-center justify-center">
      <CreditCard size={18} color={COLORS.white} />
    </View>
    <View className="flex-1 ml-3" style={{ minWidth: 0 }}>
      <Text className="text-white text-sm font-semibold" numberOfLines={1}>ATARA Card</Text>
      <Text className="text-white/45 text-xs mt-1" numberOfLines={2}>Coming soon · Visa card and ATARA Miles</Text>
    </View>
    <Text className="text-white/50 text-xs ml-2">Open</Text>
  </TouchableOpacity>
);
