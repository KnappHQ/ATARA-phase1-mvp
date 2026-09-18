import { Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import { PiggyBank } from "lucide-react-native";
import { COLORS } from "@/utils/constants";

export const SavingsEntryCard = ({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity
    onPress={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }}
    activeOpacity={0.75}
    accessibilityRole="button"
    accessibilityLabel="Bloquer de l'argent jusqu'à une date"
    className="flex-row items-center rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-6"
  >
    <View className="w-10 h-10 rounded-xl bg-white/10 items-center justify-center">
      <PiggyBank size={18} color={COLORS.white} />
    </View>
    <View className="flex-1 ml-3">
      <Text className="text-white text-sm font-semibold">Épargne bloquée</Text>
      <Text className="text-white/45 text-xs mt-1">Pour toi seul · rien ne sort avant la date</Text>
    </View>
    <Text className="text-white/50 text-xs">Ouvrir</Text>
  </TouchableOpacity>
);
