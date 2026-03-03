import { View, Text, TextInput } from "react-native";
import { COLORS } from "@/utils/constants";

interface GroupNameInputProps {
  value: string;
  onChange: (text: string) => void;
}

export const GroupNameInput = ({ value, onChange }: GroupNameInputProps) => {
  return (
    <View className="mb-6">
      <Text
        className="text-xs font-mono uppercase tracking-wide mb-2"
        style={{ color: `${COLORS.white}66` }}
      >
        Group Name
      </Text>
      <TextInput
        value={value}
        onChangeText={(text) => onChange(text.slice(0, 30))}
        placeholder="e.g., Thailand Trip, Roommates"
        placeholderTextColor={`${COLORS.white}4d`}
        className="px-4 py-4 rounded-2xl text-lg text-white"
        style={{
          backgroundColor: `${COLORS.white}08`,
          borderWidth: 1,
          borderColor: `${COLORS.white}18`,
        }}
        maxLength={30}
      />
    </View>
  );
};
