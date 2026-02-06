import { Search, X } from "lucide-react-native";
import { Pressable, TextInput, View } from "react-native";
import { COLORS } from "@/utils/constants";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SearchBar = ({
  value,
  onChange,
  placeholder = "Search @handle or note...",
}: SearchBarProps) => {
  return (
    <View className="flex-row items-center mb-5">
      <View className="flex-1 flex-row items-center px-4 py-1 rounded-3xl border border-white/15 bg-white/5">
        <View className="mr-3">
          <Search size={16} color="rgba(255, 255, 255, 0.3)" />
        </View>

        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="rgba(255, 255, 255, 0.3)"
          className="flex-1 text-base text-white"
          autoCapitalize="none"
        />

        {value ? (
          <Pressable
            onPress={() => onChange("")}
            className="ml-2 w-6 h-6 rounded-full items-center justify-center bg-white/10 active:opacity-70"
          >
            <X size={12} color="rgba(255, 255, 255, 0.6)" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};
