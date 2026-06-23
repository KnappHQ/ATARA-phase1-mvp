import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { jwtDecode } from "jwt-decode";
import { useWalletStore } from "./useWalletStore";
import { UserService } from "@/services/user.service";
import {
  analyticsIdentify,
  analyticsReset,
} from "@/services/analytics.service";
import * as Sentry from "@sentry/react-native";

const isJwtExpired = (token: string): boolean => {
  try {
    const payload = jwtDecode<{ exp?: number }>(token);
    if (!payload.exp) {
      return true;
    }

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
  justLoggedOut: boolean;

  setAuth: (user: UserProfile, token: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
  updateProfile: (data: { displayName?: string }) => Promise<void>;
  updateUser: (updates: Partial<UserProfile>) => void;
  clearJustLoggedOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  justLoggedOut: false,

  setAuth: async (user, token) => {
    await SecureStore.setItemAsync("auth_token", token);
    await SecureStore.setItemAsync("user_profile", JSON.stringify(user));

    // Successful login clears any previous explicit logout block
    try {
      await SecureStore.deleteItemAsync("just_logged_out");
    } catch {}

    set({ user, token, isAuthenticated: true, justLoggedOut: false });

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
    // Persist a short-term flag to avoid immediate auto-login (survives app restart)
    try {
      await SecureStore.setItemAsync("just_logged_out", Date.now().toString());
    } catch (e) {
      console.error("Failed to persist just_logged_out flag", e);
    }

    try {
      Sentry.setUser(null);
    } catch (e) {
      console.error("Sentry.clearUser failed:", e);
    }

    analyticsReset();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      justLoggedOut: true,
    });
  },

  loadSession: async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      const userStr = await SecureStore.getItemAsync("user_profile");
      const justLoggedOutFlag =
        await SecureStore.getItemAsync("just_logged_out");

      if (justLoggedOutFlag) {
        // If the user explicitly logged out recently, preserve that state and avoid auto-login
        set({ isLoading: false, justLoggedOut: true });
        return;
      }

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

  clearJustLoggedOut: async () => {
    try {
      await SecureStore.deleteItemAsync("just_logged_out");
    } catch (e) {
      console.error("Failed to clear just_logged_out flag", e);
    }
    set({ justLoggedOut: false });
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
