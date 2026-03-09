import {
  ArrowRight,
  Search,
  X,
  Wallet,
  ClipboardPaste,
  BookUser,
} from "lucide-react-native";
import { Pressable, Text, TextInput, View, ScrollView } from "react-native";
import { MotiView } from "moti";
import { useEffect, useCallback, useState } from "react";
import { Contact, useContactStore } from "@/stores/useContactStore";
import { ContactEmptyStates } from "./ContactEmptyStates";
import { ContactsLoading } from "./ContactsLoading";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAddressBookStore } from "@/stores/useAddressBookStore";
import * as Clipboard from "expo-clipboard";
import debounce from "@/utils/debounce";
import { COLORS } from "@/utils/constants";
import { buildAddressContact } from "@/utils/format";

interface ContactsListProps {
  searchQuery: string;
  onSearchChange: (text: string) => void;
  onSelectContact: (contact: Contact) => void;
}

const ETH_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

function isEthAddress(value: string) {
  return ETH_ADDRESS_REGEX.test(value.trim());
}

export const ContactsList = ({
  searchQuery,
  onSearchChange,
  onSelectContact,
}: ContactsListProps) => {
  const { user } = useAuthStore();
  const { contacts: addressBook } = useAddressBookStore();
  const {
    recentContacts,
    searchResults,
    isLoadingRecents,
    isLoadingSearch,
    searchError,
    searchContacts,
    getRecentContacts,
  } = useContactStore();

  const [clipboardAddress, setClipboardAddress] = useState<string | null>(null);

  useEffect(() => {
    Clipboard.getStringAsync().then((text) => {
      if (text && isEthAddress(text.trim())) {
        setClipboardAddress(text.trim());
      }
    });
  }, []);

  const refreshClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    if (text && isEthAddress(text.trim())) {
      setClipboardAddress(text.trim());
    } else {
      setClipboardAddress(null);
    }
  };

  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (query.trim()) {
        await searchContacts(query);
      }
    }, 500),
    [],
  );

  useEffect(() => {
    getRecentContacts();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      debouncedSearch(searchQuery);
    }
  }, [searchQuery, debouncedSearch]);

  // Nickname matches from local address book
  const nicknameResults: Contact[] = searchQuery.trim()
    ? Object.entries(addressBook)
        .filter(([, nickname]) =>
          nickname.toLowerCase().includes(searchQuery.trim().toLowerCase()),
        )
        .map(([address, nickname]) => buildAddressContact(address, nickname))
    : [];

  const mergedSearchResults: Contact[] = searchQuery.trim()
    ? [
        ...nicknameResults,
        ...searchResults
          .filter((r) => !nicknameResults.some((n) => n.id === r.id))
          .map((r) => {
            const saved = addressBook[r.smartAccountAddress?.toLowerCase()];
            return saved ? { ...r, name: saved } : r;
          }),
      ]
    : [];

  const displayContacts = searchQuery ? mergedSearchResults : recentContacts;
  const isLoading = searchQuery ? isLoadingSearch : isLoadingRecents;
  const hasQuery = searchQuery.trim().length > 0;
  const showResults = displayContacts.length > 0;

  const queryIsAddress = isEthAddress(searchQuery.trim());
  const queryAddressContact = queryIsAddress
    ? buildAddressContact(
        searchQuery.trim(),
        addressBook[searchQuery.trim().toLowerCase()],
      )
    : null;

  const handleRetry = () => {
    if (hasQuery) {
      searchContacts(searchQuery);
    } else {
      getRecentContacts();
    }
  };

  const handleInvite = () => {
    // TODO: Implement invite functionality
    console.log("Invite user:", searchQuery);
  };

  const handlePasteAddress = async () => {
    await refreshClipboard();
    const text = await Clipboard.getStringAsync();
    if (text && isEthAddress(text.trim())) {
      const nickname = addressBook[text.trim().toLowerCase()];
      onSelectContact(buildAddressContact(text.trim(), nickname));
    }
  };

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
            onFocus={refreshClipboard}
            placeholder="Search name, @handle or address..."
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

      {!queryIsAddress && (
        <Pressable
          onPress={handlePasteAddress}
          className="w-full flex-row items-center gap-3 p-4 rounded-2xl border border-white/15 mb-4 active:opacity-70 bg-white/5"
        >
          <View className="w-12 h-12 rounded-full items-center justify-center bg-primary/20">
            <Wallet size={20} color={COLORS.primary} />
          </View>
          <View className="flex-1">
            {clipboardAddress ? (
              <>
                <Text className="text-base font-medium text-white">
                  {addressBook[clipboardAddress.toLowerCase()]
                    ? addressBook[clipboardAddress.toLowerCase()]
                    : clipboardAddress.slice(0, 10) +
                      "…" +
                      clipboardAddress.slice(-6)}
                </Text>
                <Text className="text-sm text-muted">
                  Tap to send to clipboard address
                </Text>
              </>
            ) : (
              <>
                <Text className="text-base font-medium text-white">
                  Paste Wallet Address
                </Text>
                <Text className="text-sm text-muted">
                  Send to any external address
                </Text>
              </>
            )}
          </View>
          <ClipboardPaste size={18} color="rgba(255,255,255,0.4)" />
        </Pressable>
      )}

      {queryAddressContact && (
        <Pressable
          onPress={() => onSelectContact(queryAddressContact)}
          className="w-full flex-row items-center gap-3 p-4 rounded-2xl border border-primary/40 mb-4 active:opacity-70 bg-primary/10"
        >
          <View className="w-10 h-10 rounded-full items-center justify-center bg-primary/20">
            <Wallet size={18} color={COLORS.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-medium text-white">
              {queryAddressContact.name ?? queryAddressContact.handle}
            </Text>
            {queryAddressContact.name ? (
              <Text className="text-sm text-muted">
                {queryAddressContact.handle}
              </Text>
            ) : (
              <Text className="text-sm text-muted">
                Tap to send to this address
              </Text>
            )}
          </View>
          <ArrowRight size={18} color={COLORS.primary} />
        </Pressable>
      )}

      {isLoading ? (
        <View>
          <Text className="text-sm font-medium uppercase mb-3 text-muted tracking-widest">
            {hasQuery ? "Searching..." : "Loading Contacts..."}
          </Text>
          <ContactsLoading count={3} />
        </View>
      ) : showResults ? (
        <View>
          <Text className="text-sm font-medium uppercase mb-3 text-muted tracking-widest">
            {hasQuery ? "Search Results" : "Recent Contacts"}
          </Text>
          <ScrollView
            style={{ maxHeight: 320 }}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            <View style={{ gap: 8 }}>
              {displayContacts.map((contact) => (
                <Pressable
                  key={contact.id}
                  onPress={() => onSelectContact(contact)}
                  className="flex-row items-center gap-3 p-4 rounded-2xl border border-white/15 bg-white/5 active:opacity-70"
                >
                  <View className="w-10 h-10 rounded-full items-center justify-center bg-white/10">
                    <Text className="text-xs font-bold text-white">
                      {contact.handle
                        .replace(/^@/, "")
                        .slice(0, 2)
                        .toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center" style={{ gap: 6 }}>
                      <Text className="text-base font-medium text-platinum">
                        {contact.handle.startsWith("0x")
                          ? contact.handle
                          : `@${contact.handle}`}
                      </Text>
                      {contact.isLocalContact && (
                        <View
                          style={{
                            backgroundColor: "rgba(60,131,246,0.15)",
                            borderRadius: 6,
                            paddingHorizontal: 5,
                            paddingVertical: 1,
                          }}
                        >
                          <BookUser size={10} color={COLORS.primary} />
                        </View>
                      )}
                    </View>
                    {contact.name && contact.name !== contact.handle && (
                      <Text className="text-sm text-muted/80" numberOfLines={1}>
                        {contact.name}
                      </Text>
                    )}
                  </View>
                  <ArrowRight size={18} color="rgba(245, 245, 240, 0.5)" />
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : searchError ? (
        <ContactEmptyStates type="network-error" onRetry={handleRetry} />
      ) : hasQuery ? (
        <ContactEmptyStates
          type="no-search-results"
          searchQuery={searchQuery}
          onInvite={handleInvite}
        />
      ) : (
        <ContactEmptyStates type="no-contacts" userHandle={user?.handle} />
      )}
    </MotiView>
  );
};
