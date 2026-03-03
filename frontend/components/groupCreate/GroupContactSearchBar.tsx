import { View, Text, TextInput, Pressable } from "react-native";
import { Search, X } from "lucide-react-native";
import { COLORS } from "@/utils/constants";

interface GroupContactSearchBarProps {
  value: string;
  onChange: (text: string) => void;
}

export const GroupContactSearchBar = ({
  value,
  onChange,
}: GroupContactSearchBarProps) => {
  return (
    <View className="mb-4">
      <Text
        className="text-xs font-mono uppercase tracking-wide mb-2"
        style={{ color: `${COLORS.white}66` }}
      >
        Add Members
      </Text>
      <View
        className="flex-row items-center rounded-2xl px-4 py-1"
        style={{
          backgroundColor: `${COLORS.white}08`,
          borderWidth: 1,
          borderColor: `${COLORS.white}18`,
        }}
      >
        <Search size={16} color={`${COLORS.white}4d`} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Search name or address"
          placeholderTextColor={`${COLORS.white}4d`}
          className="flex-1 px-3 py-3 text-white"
        />
        {value.length > 0 && (
          <Pressable onPress={() => onChange("")}>
            <X size={16} color={`${COLORS.white}99`} />
          </Pressable>
        )}
      </View>
    </View>
  );
};
