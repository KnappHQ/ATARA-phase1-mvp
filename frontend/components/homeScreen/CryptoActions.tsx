import { Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import { ArrowDownToLine, ShoppingBasket } from "lucide-react-native";
import { COLORS } from "@/utils/constants";

export const CryptoActions = ({
  onAddCrypto,
  onPayMerchant,
}: {
  onAddCrypto: () => void;
  onPayMerchant: () => void;
}) => (
  <View className="flex-row gap-3 mb-6">
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onAddCrypto();
      }}
      activeOpacity={0.75}
      className="flex-1 rounded-2xl border border-white/10 bg-white/[0.06] p-4"
    >
      <ArrowDownToLine size={19} color={COLORS.accent} />
      <Text className="text-white text-sm font-semibold mt-3">Ajouter des crypto</Text>
      <Text className="text-white/45 text-xs mt-1">Via MoonPay</Text>
    </TouchableOpacity>
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPayMerchant();
      }}
      activeOpacity={0.75}
      className="flex-1 rounded-2xl border border-white/10 bg-white/[0.06] p-4"
    >
      <ShoppingBasket size={19} color="#4ade80" />
      <Text className="text-white text-sm font-semibold mt-3">Payer une course</Text>
      <Text className="text-white/45 text-xs mt-1">USDC · Base</Text>
    </TouchableOpacity>
  </View>
);
