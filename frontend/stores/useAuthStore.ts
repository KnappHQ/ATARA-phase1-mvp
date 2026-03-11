import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { useWalletStore } from "./useWalletStore";
import { UserService } from "@/services/user.service";
import {
  analyticsIdentify,
  analyticsReset,
} from "@/services/analytics.service";

interface UserProfile {
  id: string;
  handle: string;
  smartAccountAddress: string;
  displayName?: string;
  email?: string;
  profilePicUrl?: string;
  authProvider?: string;
}

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setAuth: (user: UserProfile, token: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
  updateProfile: (data: { displayName?: string }) => Promise<void>;
  updateUser: (updates: Partial<UserProfile>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: async (user, token) => {
    await SecureStore.setItemAsync("auth_token", token);
    await SecureStore.setItemAsync("user_profile", JSON.stringify(user));

    set({ user, token, isAuthenticated: true });

    analyticsIdentify(user.id, {
      handle: user.handle,
      email: user.email,
      authProvider: user.authProvider,
      displayName: user.displayName,
    });

    // Initialize wallet address after login
    if (user.smartAccountAddress) {
      useWalletStore.getState().setWalletAddress(user.smartAccountAddress);
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync("auth_token");
    await SecureStore.deleteItemAsync("user_profile");

    analyticsReset();
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadSession: async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      const userStr = await SecureStore.getItemAsync("user_profile");

      if (token && userStr) {
        const user = JSON.parse(userStr);
        set({
          token,
          user,
          isAuthenticated: true,
        });

        analyticsIdentify(user.id, {
          handle: user.handle,
          email: user.email,
          authProvider: user.authProvider,
          displayName: user.displayName,
        });

        // Initialize wallet address on session restore
        if (user.smartAccountAddress) {
          useWalletStore.getState().setWalletAddress(user.smartAccountAddress);
        }
      }
    } catch (e) {
      console.error("Failed to load session", e);
    } finally {
      set({ isLoading: false });
    }
  },

  updateProfile: async (data) => {
    const currentUser = get().user;
    if (!currentUser) return;

    try {
      const updatedUserFromApi = await UserService.updateProfile(data);
      const updatedUser = { ...currentUser, ...updatedUserFromApi };
      set({ user: updatedUser });
      await SecureStore.setItemAsync(
        "user_profile",
        JSON.stringify(updatedUser),
      );
    } catch (e) {
      console.error("Failed to update profile", e);
      throw e;
    }
  },

  updateUser: (updates) => {
    const currentUser = get().user;
    if (currentUser) {
      const updatedUser = { ...currentUser, ...updates };
      set({ user: updatedUser });
      SecureStore.setItemAsync("user_profile", JSON.stringify(updatedUser));
    }
  },
}));
