import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { useWalletStore } from "./useWalletStore";
import { UserService } from "@/services/user.service";
import {
  analyticsIdentify,
  analyticsReset,
} from "@/services/analytics.service";
import * as Sentry from "@sentry/react-native";

const isJwtExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

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

    try {
      Sentry.setUser({
        id: user.id,
        email: user.email || undefined,
        username: user.handle || undefined,
      });
    } catch (e) {
      // Non-fatal: ensure Sentry calls don't break auth flow
      console.error("Sentry.setUser failed:", e);
    }

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

    try {
      Sentry.setUser(null);
    } catch (e) {
      console.error("Sentry.clearUser failed:", e);
    }

    analyticsReset();
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadSession: async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      const userStr = await SecureStore.getItemAsync("user_profile");

      if (token && userStr && !isJwtExpired(token)) {
        const user = JSON.parse(userStr);
        set({ token, user, isAuthenticated: true });

        analyticsIdentify(user.id, {
          handle: user.handle,
          email: user.email,
          authProvider: user.authProvider,
          displayName: user.displayName,
        });

        if (user.smartAccountAddress) {
          useWalletStore.getState().setWalletAddress(user.smartAccountAddress);
        }
      } else if (token) {
        // Token exists but is expired — clear stale credentials
        await SecureStore.deleteItemAsync("auth_token");
        await SecureStore.deleteItemAsync("user_profile");
      }
    } catch (e) {
      console.error("Failed to load session", e);
      Sentry.captureException(e);
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
      Sentry.captureException(e);
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
