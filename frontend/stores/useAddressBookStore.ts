import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAccountReset } from "@/utils/accountScope";
import {
  forgetBook,
  migrateAddressBooks,
  openBook,
  type AddressBooks,
  type Nicknames,
} from "@/utils/addressBookScope";

interface AddressBookState extends AddressBooks {
  /** The signed-in account's nicknames. Empty when nobody is signed in. */
  contacts: Nicknames;
  ownerId: string | null;
  openFor: (userId: string) => void;
  close: () => void;
  forget: (userId: string) => void;
  setNickname: (address: string, nickname: string) => void;
  removeNickname: (address: string) => void;
  hasNickname: (address: string) => boolean;
  getDisplayName: (address: string) => string;
}

const refreshTransactionHistory = () => {
  // Lazy require to avoid circular dependency at module load time
  const {
    useTransactionHistoryStore,
  } = require("@/stores/useTransactionHistoryStore");
  useTransactionHistoryStore.getState().rebuildDisplayHistory();
};

/**
 * Nicknames are private labels on addresses, kept on this phone only. They
 * used to be one list for the whole phone, so whoever signed in next saw the
 * previous account's labels. Each account now has its own book, and deleting
 * the account deletes its book.
 */
export const useAddressBookStore = create<AddressBookState>()(
  persist(
    (set, get) => {
      const writeContacts = (contacts: Nicknames) => {
        const { ownerId, books } = get();
        set({
          contacts,
          ...(ownerId && { books: { ...books, [ownerId]: contacts } }),
        });
        refreshTransactionHistory();
      };

      return {
        books: {},
        legacy: null,
        contacts: {},
        ownerId: null,

        openFor: (userId) => {
          set({ ownerId: userId, ...openBook(get(), userId) });
          refreshTransactionHistory();
        },

        close: () => set({ ownerId: null, contacts: {} }),

        forget: (userId) => {
          const { ownerId } = get();
          set({
            ...forgetBook(get(), userId),
            ...(ownerId === userId && { ownerId: null, contacts: {} }),
          });
        },

        setNickname: (address, nickname) => {
          writeContacts({ ...get().contacts, [address.toLowerCase()]: nickname });
        },

        removeNickname: (address) => {
          const contacts = { ...get().contacts };
          delete contacts[address.toLowerCase()];
          writeContacts(contacts);
        },

        hasNickname: (address) => {
          if (!address) return false;
          return !!get().contacts[address.toLowerCase()];
        },

        getDisplayName: (address) => {
          if (!address) return address;
          return get().contacts[address.toLowerCase()] || address;
        },
      };
    },
    {
      name: "knapp-address-book",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: migrateAddressBooks,
      // Which book is open is decided by who is signed in, never by storage.
      partialize: (state) => ({ books: state.books, legacy: state.legacy }),
      onRehydrateStorage: () => (state) => {
        if (state?.ownerId) state.openFor(state.ownerId);
      },
    },
  ),
);

onAccountReset(() => useAddressBookStore.getState().close());
