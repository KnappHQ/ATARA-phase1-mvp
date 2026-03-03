import { View, Text, Pressable } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { COLORS } from "@/utils/constants";

interface GroupCreateHeaderProps {
  onBack: () => void;
}

export const GroupCreateHeader = ({ onBack }: GroupCreateHeaderProps) => {
  return (
    <View
      className="flex-row items-center gap-3 px-6 py-4 border-b"
      style={{ borderColor: `${COLORS.white}10` }}
    >
      <Pressable
        onPress={onBack}
        className="w-12 h-12 rounded-full items-center justify-center"
        style={{
          backgroundColor: `${COLORS.white}08`,
          borderWidth: 1,
          borderColor: `${COLORS.white}18`,
        }}
      >
        <ArrowLeft size={20} color={COLORS.white} />
      </Pressable>
      <Text className="text-xl font-semibold text-white">New Group</Text>
    </View>
  );
};
