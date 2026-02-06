import { ArrowRight, Search, X, Wallet } from "lucide-react-native";
import { Pressable, Text, TextInput, View, ScrollView } from "react-native";
import { MotiView } from "moti";
import { Contact } from "@/app/send";
import { COLORS } from "@/utils/constants";

interface ContactsListProps {
  contacts: Contact[];
  searchQuery: string;
  onSearchChange: (text: string) => void;
  onSelectContact: (contact: Contact) => void;
}

export const ContactsList = ({
  contacts,
  searchQuery,
  onSearchChange,
  onSelectContact,
}: ContactsListProps) => {
  return (
    <MotiView
      from={{ opacity: 0, translateY: -20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 400, delay: 200 }}
    >
      <View className="flex-row items-center mb-6">
        <View className="flex-1 flex-row items-center px-3 py-2 rounded-2xl border border-white/15 bg-white/5">
          <View className="mr-2">
            <Search size={18} color="rgba(255, 255, 255, 0.4)" />
          </View>

          <TextInput
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder="Search name or @handle..."
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            className="flex-1 text-base text-white"
            autoCapitalize="none"
          />

          {searchQuery ? (
            <Pressable
              onPress={() => onSearchChange("")}
              className="ml-2 w-6 h-6 rounded-full items-center justify-center bg-white/10 active:opacity-70"
            >
              <X size={12} color="rgba(255, 255, 255, 0.6)" />
            </Pressable>
          ) : null}
        </View>
      </View>

      <Pressable className="w-full flex-row items-center gap-3 p-4 rounded-2xl border border-white/15 mb-4 active:opacity-70 bg-white/5">
        <View className="w-12 h-12 rounded-full items-center justify-center bg-primary/20">
          <Wallet size={20} color={COLORS.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-medium text-white">
            Paste Wallet Address
          </Text>
          <Text className="text-sm text-muted">
            Send to any external address
          </Text>
        </View>
      </Pressable>

      {contacts.length > 0 && (
        <Text className="text-sm font-medium uppercase mb-3 text-muted tracking-widest">
          {searchQuery ? "Matching Contacts" : "Recent Contacts"}
        </Text>
      )}

      {contacts.length > 0 ? (
        <ScrollView
          style={{ maxHeight: 320 }}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
        >
          <View style={{ gap: 8 }}>
            {contacts.map((contact) => (
              <Pressable
                key={contact.id}
                onPress={() => onSelectContact(contact)}
                className="flex-row items-center gap-3 p-4 rounded-2xl border border-white/15 bg-white/5 active:opacity-70"
              >
                <View className="w-10 h-10 rounded-full items-center justify-center bg-white/10">
                  <Text className="text-xs font-bold text-white">
                    {contact.avatar}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-base font-medium text-platinum">
                    {contact.name}
                  </Text>
                  <Text className="text-sm text-muted/80">
                    {contact.handle}
                  </Text>
                </View>
                <ArrowRight size={18} color="rgba(245, 245, 240, 0.5)" />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : (
        searchQuery &&
        !searchQuery.startsWith("@") && (
          <View className="text-center py-20 items-center">
            <Text className="text-base text-white/50">
              No contacts found for "{searchQuery}"
            </Text>
            <Text className="text-sm mt-1 text-white/30">
              Try searching with @handle
            </Text>
          </View>
        )
      )}
    </MotiView>
  );
};
