import { View, Text, TouchableOpacity } from "react-native";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react-native";
import { COLORS } from "@/utils/constants";

interface ActionButtonsProps {
  onReceive: () => void;
  onSend: () => void;
}

export const ActionButtons = ({ onReceive, onSend }: ActionButtonsProps) => {
  return (
    <View className="flex-row gap-3 mb-6">
      <TouchableOpacity
        onPress={onReceive}
        activeOpacity={0.7}
        className="flex-1 py-4 flex-row items-center justify-center gap-2 rounded-2xl border border-white/20"
        style={{ backgroundColor: "transparent" }}
      >
        <ArrowDownLeft size={16} color={COLORS.white} />
        <Text className="text-base font-medium text-white">Receive</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onSend}
        activeOpacity={0.7}
        className="flex-1 py-4 flex-row items-center justify-center gap-2 rounded-2xl"
        style={{ backgroundColor: COLORS.white }}
      >
        <ArrowUpRight size={16} color={COLORS.black} />
        <Text className="text-base font-medium" style={{ color: COLORS.black }}>
          Send
        </Text>
      </TouchableOpacity>
    </View>
  );
};
