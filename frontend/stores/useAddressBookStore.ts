import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface AddressBookState {
  contacts: Record<string, string>;

  addContact: (address: string, nickname: string) => void;
  removeContact: (address: string) => void;
  getNickname: (address: string) => string | null;
}

export const useAddressBookStore = create<AddressBookState>()(
  persist(
    (set, get) => ({
      contacts: {},

      addContact: (address, nickname) => {
        const normalizedAddr = address.toLowerCase();
        set((state) => ({
          contacts: { ...state.contacts, [normalizedAddr]: nickname },
        }));
      },

      removeContact: (address) => {
        const normalizedAddr = address.toLowerCase();
        set((state) => {
          const newContacts = { ...state.contacts };
          delete newContacts[normalizedAddr];
          return { contacts: newContacts };
        });
      },

      getNickname: (address) => {
        if (!address) return null;
        return get().contacts[address.toLowerCase()] || null;
      },
    }),
    {
      name: "astra-address-book",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
