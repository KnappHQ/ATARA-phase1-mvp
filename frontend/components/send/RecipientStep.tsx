import { Search, Wallet, Users } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
} from "react-native-reanimated";
import { AstraDropButton } from "./AstraDropButton";
import { ContactListItem } from "./ContactListItem";
import { QuickContactButton } from "./QuickContactButton";
import { useSendStore } from "@/stores/useSendStore";
import { useQuickContacts, useUserSearch } from "@/hooks/useUser";
import { ethers } from "ethers";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const RecipientStep = () => {
  const { setRecipient, setStep } = useSendStore();

  const { data: quickContacts = [] } = useQuickContacts();
  const { isSearching, searchResults, search, setSearchResults } =
    useUserSearch();

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [manualAddress, setManualAddress] = useState<string | null>(null);

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    scale.value = withTiming(0.98, {
      duration: 100,
    });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, {
      duration: 200,
    });
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      const query = searchQuery.trim();
      if (query.length > 2) {
        if (ethers.utils.isAddress(query)) {
          setManualAddress(query);
          setSearchResults([]);
        } else {
          setManualAddress(null);
          search(query);
        }
      } else {
        setSearchResults([]);
        setManualAddress(null);
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const handleSelectContact = (contact: any) => {
    setRecipient({
      id: contact.id,
      name: contact.name,
      handle: contact.handle,
      publicAddress: contact.publicAddress,
      avatar: contact.avatar || "0x",
    });
    setStep("amount");
    Keyboard.dismiss();
  };

  const handleManualSelect = () => {
    if (manualAddress) {
      setRecipient({
        id: "manual",
        name: "External Wallet",
        handle: `${manualAddress.slice(0, 6)}...${manualAddress.slice(-4)}`,
        publicAddress: manualAddress,
        avatar: "0x",
      });
      setStep("amount");
      Keyboard.dismiss();
    }
  };

  const handleAstraDrop = () => {
    console.log("Astrâ Drop activated - Finding nearby users...");
  };

  const isSearchingMode = searchQuery.length > 2 && !manualAddress;

  const listData = isSearchingMode ? searchResults : quickContacts;

  return (
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 24 }}
    >
      <AstraDropButton onPress={handleAstraDrop} />

      <Animated.View entering={FadeInDown.delay(100)} className="mb-6">
        <Text className="text-sm font-rajdhani-medium text-champagne/60 uppercase tracking-hud-wide mb-4">
          Quick Send
        </Text>
        {quickContacts.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 16, paddingBottom: 10 }}
          >
            {quickContacts.map((contact) => (
              <QuickContactButton
                key={contact.id}
                name={contact.name}
                avatar={contact.avatar}
                gradientColors={contact.gradientColors}
                onPress={() => handleSelectContact(contact)}
              />
            ))}
          </ScrollView>
        ) : (
          <View className="flex-row items-center gap-3 py-3">
            <Users
              size={20}
              color="rgba(255, 230, 102, 0.4)"
              strokeWidth={1.5}
            />
            <Text className="text-muted-foreground font-rajdhani text-sm">
              No quick contacts yet
            </Text>
          </View>
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200)} className="mb-6">
        <View
          className={`flex-row items-center gap-3 px-4 py-1 rounded-xl bg-muted/50 border ${
            isSearchFocused ? "border-champagne/30" : "border-border"
          }`}
        >
          <Search size={16} color="rgba(255, 255, 255, 0.4)" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="Search name or @handle..."
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            className="flex-1 text-foreground font-rajdhani text-xl"
            autoCapitalize="none"
          />
          {isSearching && <ActivityIndicator size="small" color="#FFE666" />}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300)} className="mb-6">
        {manualAddress ? (
          <AnimatedPressable
            onPress={handleManualSelect}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={[
              animatedStyle,
              {
                shadowColor: "#FFE666",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0,
                shadowRadius: 12,
              },
            ]}
          >
            <View className="w-full flex-row items-center gap-3 p-5 bg-[#100f12] border border-champagne/10 rounded-xl">
              <View className="w-12 h-12 rounded-full bg-champagne/20 items-center justify-center">
                <Wallet size={20} color="#FFE666" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-rajdhani-semibold text-foreground">
                  External Address
                </Text>
                <Text className="text-sm font-rajdhani text-muted-foreground">
                  {manualAddress}
                </Text>
              </View>
            </View>
          </AnimatedPressable>
        ) : (
          <AnimatedPressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={[
              animatedStyle,
              {
                shadowColor: "#FFE666",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0,
                shadowRadius: 12,
              },
            ]}
          >
            <View className="w-full flex-row items-center gap-3 p-5 bg-[#100f12] border border-champagne/10 rounded-xl">
              <View className="w-12 h-12 rounded-full bg-champagne/20 items-center justify-center">
                <Wallet size={20} color="#FFE666" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-rajdhani-semibold text-foreground">
                  Paste Wallet Address
                </Text>
                <Text className="text-sm font-rajdhani text-muted-foreground">
                  Send to any external address
                </Text>
              </View>
            </View>
          </AnimatedPressable>
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(400)}>
        <Text className="text-sm font-rajdhani-medium text-muted-foreground uppercase tracking-wider mb-4">
          {searchQuery.length > 2 ? "Search Results" : "Recent Contacts"}
        </Text>
        <View style={{ gap: 8 }}>
          {listData.map((contact: any) => (
            <ContactListItem
              key={contact.id}
              name={contact.name}
              handle={contact.handle}
              avatar={
                contact.avatar ||
                contact.name?.substring(0, 2).toUpperCase() ||
                "??"
              }
              onPress={() => handleSelectContact(contact)}
            />
          ))}

          {isSearchingMode && listData.length === 0 && !isSearching && (
            <View className="py-16 items-center justify-center">
              <Search
                size={32}
                color="rgba(255, 255, 255, 0.3)"
                strokeWidth={1.5}
              />
              <Text className="text-foreground/60 text-center font-rajdhani-medium text-base mb-1 mt-4">
                No users found
              </Text>
              <Text className="text-muted-foreground text-center font-rajdhani text-sm">
                Try a different search term
              </Text>
            </View>
          )}

          {!isSearchingMode && listData.length === 0 && (
            <View className="py-16 items-center justify-center">
              <Users
                size={32}
                color="rgba(255, 230, 102, 0.6)"
                strokeWidth={1.5}
              />
              <Text className="text-foreground/80 text-center font-rajdhani-semibold text-lg mb-2 mt-4">
                No Recent Contacts
              </Text>
              <Text className="text-muted-foreground text-center font-rajdhani text-sm px-8">
                Start a new transaction to see your contacts appear here
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    </ScrollView>
  );
};
