import { View, Text, Pressable } from "react-native";
import { COLORS } from "@/utils/constants";

interface GroupCreateFooterProps {
  memberCount: number;
  isValid: boolean;
  onCreate: () => void;
}

export const GroupCreateFooter = ({
  memberCount,
  isValid,
  onCreate,
}: GroupCreateFooterProps) => {
  return (
    <View
      className="px-6 py-6 border-t"
      style={{ borderColor: `${COLORS.white}10` }}
    >
      <Pressable
        onPress={onCreate}
        disabled={!isValid}
        className="py-4 rounded-2xl items-center active:opacity-80"
        style={{
          backgroundColor: isValid ? COLORS.platinum : `${COLORS.platinum}4d`,
        }}
      >
        <Text className="text-sm font-semibold text-black font-mono">
          Create Group ({memberCount} members)
        </Text>
      </Pressable>
    </View>
  );
};
