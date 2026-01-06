import "../shim";
import { ethers } from "ethers";
import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "../stores/useAuthStore";
import { api } from "./api";

const STORE_KEY_PRIVATE = "auth_private_key";

export const AuthService = {
  createWallet: async () => {
    const wallet = ethers.Wallet.createRandom();

    await SecureStore.setItemAsync(STORE_KEY_PRIVATE, wallet.privateKey);

    return {
      mnemonic: wallet.mnemonic?.phrase,
      address: wallet.address,
      privateKey: wallet.privateKey,
    };
  },

  restoreWallet: async (mnemonic: string) => {
    const cleanMnemonic = mnemonic.trim();

    if (!ethers.utils.isValidMnemonic(cleanMnemonic)) {
      throw new Error("Invalid seed phrase");
    }

    const wallet = ethers.Wallet.fromMnemonic(cleanMnemonic);

    await SecureStore.setItemAsync(STORE_KEY_PRIVATE, wallet.privateKey);

    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
    };
  },

  register: async (handle: string, address: string) => {
    const privateKey = await SecureStore.getItemAsync(STORE_KEY_PRIVATE);
    if (!privateKey) throw new Error("No wallet found on device");

    const wallet = new ethers.Wallet(privateKey);
    const timestamp = Date.now();
    const message = `Login to ASTRA: ${timestamp}`;

    const signature = await wallet.signMessage(message);

    const response = await api.post("/auth/register", {
      handle,
      publicAddress: address,
      signature,
      timestamp,
    });

    const { user, token } = response.data;
    await useAuthStore.getState().setAuth(user, token);

    return user;
  },

  login: async () => {
    const privateKey = await SecureStore.getItemAsync(STORE_KEY_PRIVATE);
    if (!privateKey) throw new Error("No wallet found. Please restore access.");

    const wallet = new ethers.Wallet(privateKey);
    const timestamp = Date.now();
    const message = `Login to ASTRA: ${timestamp}`;

    const signature = await wallet.signMessage(message);

    const response = await api.post("/auth/login", {
      publicAddress: wallet.address,
      signature,
      timestamp,
    });

    const { user, token } = response.data;
    await useAuthStore.getState().setAuth(user, token);

    return user;
  },

  hasWallet: async () => {
    return (await SecureStore.getItemAsync(STORE_KEY_PRIVATE)) !== null;
  },
};
