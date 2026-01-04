import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

interface UserProfile {
  id: string;
  handle: string;
  publicAddress: string;
  profilePicUrl?: string;
}

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setAuth: (user: UserProfile, token: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: async (user, token) => {
    await SecureStore.setItemAsync("auth_token", token);
    await SecureStore.setItemAsync("user_profile", JSON.stringify(user));

    set({ user, token, isAuthenticated: true });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync("auth_token");
    await SecureStore.deleteItemAsync("user_profile");

    set({ user: null, token: null, isAuthenticated: false });
  },

  loadSession: async () => {
    try {
      console.log("Loading session from SecureStore");
      const token = await SecureStore.getItemAsync("auth_token");
      const userStr = await SecureStore.getItemAsync("user_profile");

      console.log("Token:", token);
      console.log("User String:", userStr);

      if (token && userStr) {
        set({
          token,
          user: JSON.parse(userStr),
          isAuthenticated: true,
        });
      }
      console.log("Session loaded successfully");
    } catch (e) {
      console.error("Failed to load session", e);
    } finally {
      set({ isLoading: false });
    }
  },
}));
