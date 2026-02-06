import { MotiView } from "moti";
import { Search, X } from "lucide-react-native";
import { useState } from "react";
import { View, TextInput, TouchableOpacity, Text } from "react-native";
import { COLORS } from "@/utils/constants";
import * as Haptics from "expo-haptics";

interface RecentContact {
  id: string;
  address: string;
  name: string;
  avatar: string;
}

const recentContacts: RecentContact[] = [
  {
    id: "1",
    address: "0xAb5801a7D398351b8bE11C439e05C5B3259aeCd8",
    name: "Marcus",
    avatar: "MA",
  },
  {
    id: "2",
    address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    name: "0x1f9...984",
    avatar: "ET",
  },
  {
    id: "3",
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    name: "0xC02...Cc2",
    avatar: "US",
  },
];

interface QuickSendBarProps {
  onSearch: (query: string) => void;
  onQuickSend: (contact: RecentContact) => void;
}

export const QuickSendBar = ({ onSearch, onQuickSend }: QuickSendBarProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim());
    }
  };

  return (
    <View className="gap-4">
      <View className="flex-row items-center bg-white/5 border border-white/20 rounded-3xl px-4 py-1.5">
        <Search size={18} color="rgba(255, 255, 255, 0.3)" />
        <TextInput
          placeholder="Search @handle or address"
          placeholderTextColor="rgba(255, 255, 255, 0.3)"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearchSubmit}
          returnKeyType="search"
          className="flex-1 text-white text-base ml-3"
        />
        {searchQuery !== "" && (
          <TouchableOpacity
            onPress={() => setSearchQuery("")}
            className="w-6 h-6 rounded-full bg-white/10 items-center justify-center ml-2"
            activeOpacity={0.7}
          >
            <X size={14} color="rgba(255, 255, 255, 0.6)" />
          </TouchableOpacity>
        )}
      </View>

      <View className="flex-row gap-2">
        {recentContacts.map((contact, index) => (
          <MotiView
            key={contact.id}
            from={{ opacity: 0, translateY: 5 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 150, delay: index * 30 }}
            className="flex-1"
          >
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onQuickSend(contact);
              }}
              activeOpacity={0.8}
              className="flex-col items-center gap-1.5 py-4 bg-white/5 border border-white/15 rounded-3xl"
            >
              <View className="w-9 h-9 rounded-full bg-transparent border border-white/20 items-center justify-center">
                <Text className="text-xs font-medium text-white">
                  {contact.avatar}
                </Text>
              </View>
              <Text
                className="text-xs font-medium text-white/50"
                numberOfLines={1}
                style={{ maxWidth: 60 }}
              >
                {contact.name.length > 8
                  ? contact.name.slice(0, 7) + "…"
                  : contact.name}
              </Text>
            </TouchableOpacity>
          </MotiView>
        ))}
      </View>
    </View>
  );
};
