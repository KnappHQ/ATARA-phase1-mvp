import { MotiView } from "moti";
import { Search, X } from "lucide-react-native";
import { useState, useEffect, useCallback } from "react";
import { View, TextInput, TouchableOpacity, Text } from "react-native";
import { COLORS } from "@/utils/constants";
import * as Haptics from "expo-haptics";
import { useContactStore, Contact } from "@/stores/useContactStore";
import debounce from "@/utils/debounce";
import { useRouter } from "expo-router";

export const QuickSendBar = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const {
    recentContacts,
    searchResults,
    isLoadingRecents,
    isLoadingSearch,
    getRecentContacts,
    searchContacts,
  } = useContactStore();
  const router = useRouter();

  useEffect(() => {
    getRecentContacts();
  }, []);

  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (query.trim()) {
        await searchContacts(query);
      }
    }, 500),
    [],
  );

  useEffect(() => {
    if (searchQuery.trim()) {
      debouncedSearch(searchQuery);
    }
  }, [searchQuery, debouncedSearch]);

  const handleQuickSend = (contact: Contact) => {
    router.push({
      pathname: "/send",
      params: {
        contactId: contact.id,
        contactHandle: contact.handle,
        contactName: contact.name ?? "",
        contactSmartAddress: contact.smartAccountAddress,
        contactProfilePic: contact.profilePicUrl ?? "",
      },
    });
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };

  const quickContacts = recentContacts.slice(0, 3).map((contact) => ({
    ...contact,
    displayName: contact.name || contact.handle,
    avatar: (contact.name || contact.handle).slice(0, 2).toUpperCase(),
  }));

  const searchContactsDisplay = searchResults.slice(0, 3).map((contact) => ({
    ...contact,
    displayName: contact.name || contact.handle,
    avatar: (contact.name || contact.handle).slice(0, 2).toUpperCase(),
  }));

  const displayContacts = searchQuery ? searchContactsDisplay : quickContacts;
  const isLoading = searchQuery ? isLoadingSearch : isLoadingRecents;

  return (
    <View className="gap-4">
      <View className="flex-row items-center bg-white/5 border border-white/20 rounded-3xl px-4 py-1.5">
        <Search size={18} color="rgba(255, 255, 255, 0.3)" />
        <TextInput
          placeholder="Search @handle or address"
          placeholderTextColor="rgba(255, 255, 255, 0.3)"
          value={searchQuery}
          onChangeText={handleSearchChange}
          returnKeyType="search"
          autoCapitalize="none"
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
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <View
                key={i}
                className="flex-1 flex-col items-center gap-1.5 py-4 bg-white/5 border border-white/15 rounded-3xl"
                pointerEvents="none"
              >
                <View
                  className="w-9 h-9 rounded-full bg-white/10"
                  style={{ opacity: 0.5 }}
                />
                <View
                  className="w-12 h-3 rounded bg-white/10"
                  style={{ opacity: 0.5 }}
                />
              </View>
            ))}
          </>
        ) : (
          <>
            {displayContacts.map((contact, index) => (
              <MotiView
                key={contact.id}
                from={{ opacity: 0, translateY: 5 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{
                  type: "timing",
                  duration: 150,
                  delay: index * 30,
                }}
                className="flex-1"
              >
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    handleQuickSend(contact);
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
                    {contact.displayName.length > 8
                      ? contact.displayName.slice(0, 7) + "…"
                      : contact.displayName}
                  </Text>
                </TouchableOpacity>
              </MotiView>
            ))}
          </>
        )}
      </View>
    </View>
  );
};
