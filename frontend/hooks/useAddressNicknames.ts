import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const NICKNAMES_STORAGE_KEY = "@atara_address_nicknames";

interface AddressNicknames {
  [address: string]: string;
}

export const useAddressNicknames = () => {
  const [nicknames, setNicknames] = useState<AddressNicknames>({});

  // Load nicknames from storage on mount
  useEffect(() => {
    loadNicknames();
  }, []);

  const loadNicknames = async () => {
    try {
      const stored = await AsyncStorage.getItem(NICKNAMES_STORAGE_KEY);
      if (stored) {
        setNicknames(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load nicknames:", error);
    }
  };

  const saveNicknames = async (updatedNicknames: AddressNicknames) => {
    try {
      await AsyncStorage.setItem(
        NICKNAMES_STORAGE_KEY,
        JSON.stringify(updatedNicknames),
      );
      setNicknames(updatedNicknames);
    } catch (error) {
      console.error("Failed to save nicknames:", error);
    }
  };

  const setNickname = (address: string, nickname: string) => {
    const updated = { ...nicknames, [address]: nickname };
    saveNicknames(updated);
  };

  const removeNickname = (address: string) => {
    const updated = { ...nicknames };
    delete updated[address];
    saveNicknames(updated);
  };

  const getNickname = (address: string): string | undefined => {
    return nicknames[address];
  };

  const hasNickname = (address: string): boolean => {
    return !!nicknames[address];
  };

  const getDisplayName = (address: string): string => {
    return nicknames[address] || address;
  };

  return {
    nicknames,
    setNickname,
    removeNickname,
    getNickname,
    hasNickname,
    getDisplayName,
  };
};
