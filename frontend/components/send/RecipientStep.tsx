import { Search, Wallet } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { AstraDropButton } from "./AstraDropButton";
import { ContactListItem } from "./ContactListItem";
import { QuickContactButton } from "./QuickContactButton";

interface Contact {
  id: string;
  name: string;
  handle: string;
  avatar: string;
}

interface QuickContact {
  id: string;
  name: string;
  avatar: string;
  gradientColors: [string, string];
}

interface RecipientStepProps {
  searchQuery: string;
  onSearchChange: (text: string) => void;
  quickContacts: QuickContact[];
  contacts: Contact[];
  onSelectContact: (contact: Contact) => void;
  onQuickContactPress: (contact: QuickContact) => void;
  onAstraDropPress: () => void;
}

export const RecipientStep = ({
  searchQuery,
  onSearchChange,
  quickContacts,
  contacts,
  onSelectContact,
  onQuickContactPress,
  onAstraDropPress,
}: RecipientStepProps) => {
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.handle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 24 }}
    >
      <AstraDropButton onPress={onAstraDropPress} />

      <Animated.View entering={FadeInDown.delay(100)} className="mb-6">
        <Text className="text-sm font-rajdhani-medium text-champagne/60 uppercase tracking-hud-wide mb-4">
          Quick Send
        </Text>
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
              onPress={() => onQuickContactPress(contact)}
            />
          ))}
        </ScrollView>
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
            onChangeText={onSearchChange}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="Search name or @handle..."
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            className="flex-1 text-foreground font-rajdhani text-xl"
          />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300)} className="mb-6">
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
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(400)}>
        <Text className="text-sm font-rajdhani-medium text-muted-foreground uppercase tracking-wider mb-4">
          Recent Contacts
        </Text>
        <View style={{ gap: 8 }}>
          {filteredContacts.map((contact) => (
            <ContactListItem
              key={contact.id}
              name={contact.name}
              handle={contact.handle}
              avatar={contact.avatar}
              onPress={() => onSelectContact(contact)}
            />
          ))}
        </View>
      </Animated.View>
    </ScrollView>
  );
};
