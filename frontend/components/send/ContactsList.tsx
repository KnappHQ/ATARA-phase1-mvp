import {
  ArrowRight,
  Search,
  X,
  Wallet,
  ClipboardPaste,
  BookUser,
} from "lucide-react-native";
import {
  Pressable,
  Share,
  Text,
  TextInput,
  View,
  ScrollView,
} from "react-native";
import * as Haptics from "expo-haptics";
import { MotiView } from "moti";
import { useEffect, useMemo, useState } from "react";
import { Contact, useContactStore } from "@/stores/useContactStore";
import { ContactEmptyStates } from "./ContactEmptyStates";
import { ContactsLoading } from "./ContactsLoading";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAddressBookStore } from "@/stores/useAddressBookStore";
import * as Clipboard from "expo-clipboard";
import debounce from "@/utils/debounce";
import { COLORS } from "@/utils/constants";
import { buildAddressContact } from "@/utils/format";
import { useAlertStore } from "@/stores/useAlertStore";
import * as Sentry from "@sentry/react-native";

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
    favoriteContacts,
    searchResults,
    isLoadingRecents,
    isLoadingSearch,
    searchError,
    searchContacts,
    getRecentContacts,
  } = useContactStore();

  const [clipboardAddress, setClipboardAddress] = useState<string | null>(null);

  const sortContactsAlphabetically = (contacts: Contact[]) =>
    [...contacts].sort((a, b) => {
      const labelA = (a.name || a.handle).replace(/^@/, "").toLocaleLowerCase();
      const labelB = (b.name || b.handle).replace(/^@/, "").toLocaleLowerCase();
      return labelA.localeCompare(labelB, undefined, { sensitivity: "base" });
    });

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

  const debouncedSearch = useMemo(
    () =>
      debounce(async (query: string) => {
        // A lone @ is an explicit “show my contacts” affordance. Keep this
        // local so suggestions appear immediately and stay alphabetized.
        if (query.trim().replace(/^@/, "").length >= 3) {
          await searchContacts(query);
        }
      }, 500),
    [searchContacts],
  );

  useEffect(() => {
    getRecentContacts();
  }, [getRecentContacts]);

  useEffect(() => {
    if (searchQuery.trim()) {
      debouncedSearch(searchQuery);
    }
  }, [searchQuery, debouncedSearch]);

  const knownContacts = useMemo(() => {
    const contactsById = new Map<string, Contact>();
    [...favoriteContacts, ...recentContacts].forEach((contact) => {
      contactsById.set(contact.id, contact);
    });

    Object.entries(addressBook).forEach(([address, nickname]) => {
      const contact = buildAddressContact(address, nickname);
      if (!contactsById.has(contact.id)) contactsById.set(contact.id, contact);
    });

    return sortContactsAlphabetically(Array.from(contactsById.values()));
  }, [addressBook, favoriteContacts, recentContacts]);

  const normalizedQuery = searchQuery
    .trim()
    .replace(/^@/, "")
    .toLocaleLowerCase();
  const isAllContactsQuery = searchQuery.trim() === "@";
  const localMatches = knownContacts.filter((contact) =>
    [contact.handle, contact.name || ""].some((label) =>
      label.replace(/^@/, "").toLocaleLowerCase().includes(normalizedQuery),
    ),
  );
  const matchingRemote =
    normalizedQuery.length >= 3
      ? searchResults.filter((contact) =>
          [
            contact.handle,
            contact.name || "",
            contact.smartAccountAddress,
          ].some((label) =>
            label.toLocaleLowerCase().includes(normalizedQuery),
          ),
        )
      : [];
  const merged = Array.from(
    new Map(
      [...matchingRemote, ...localMatches].map((c) => [c.id, c]),
    ).values(),
  );
  const displayContacts = searchQuery.trim()
    ? sortContactsAlphabetically(merged)
    : sortContactsAlphabetically(recentContacts);
  const isLoading = searchQuery.trim()
    ? normalizedQuery.length >= 3 && isLoadingSearch && !displayContacts.length
    : isLoadingRecents;
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

  const handleInvite = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await Share.share({
        title: "Join me on ATARA",
        message:
          "Join me on ATARA to send and receive money instantly: https://atara.money",
      });
    } catch (error: any) {
      Sentry.captureException(error);
      useAlertStore
        .getState()
        .error("Invite failed", error?.message || "Unable to share right now");
    }
  };

  const handlePasteAddress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSelectContact(queryAddressContact);
          }}
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
            {isAllContactsQuery
              ? "Tous les contacts"
              : hasQuery
                ? "Search Results"
                : "Recent Contacts"}
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
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onSelectContact(contact);
                  }}
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
