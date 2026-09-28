import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { jwtDecode } from "jwt-decode";
import { useWalletStore } from "./useWalletStore";
import { useAddressBookStore } from "./useAddressBookStore";
import { UserService } from "@/services/user.service";
import * as Sentry from "@sentry/react-native";
import { resetAccountScope } from "@/utils/accountScope";
import { toUserProfile, type UserProfile } from "@/utils/userProfile";

let authMutationRevision = 0;
let authStorageQueue: Promise<unknown> = Promise.resolve();

const queueAuthStorageMutation = async (
  task: () => Promise<void>,
): Promise<void> => {
  const operation = authStorageQueue.then(task, task);
  authStorageQueue = operation.catch(() => undefined);
  return operation;
};

const assertCurrentAuthMutation = (
  revision: number,
  signal?: AbortSignal,
) => {
  if (signal?.aborted || revision !== authMutationRevision) {
    throw new Error("Authentication attempt cancelled.");
  }
};

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

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  justLoggedOut: boolean;

  setAuth: (
    user: UserProfile,
    token: string,
    signal?: AbortSignal,
  ) => Promise<void>;
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

  setAuth: async (received, token, signal) => {
    const revision = ++authMutationRevision;
    const user = toUserProfile(received as unknown as Record<string, unknown>);
    await queueAuthStorageMutation(async () => {
      assertCurrentAuthMutation(revision, signal);
      await SecureStore.setItemAsync("auth_token", token);
      assertCurrentAuthMutation(revision, signal);
      await SecureStore.setItemAsync("user_profile", JSON.stringify(user));
      assertCurrentAuthMutation(revision, signal);

      // Successful login clears any previous explicit logout block.
      try {
        await SecureStore.deleteItemAsync("just_logged_out");
      } catch {}
      assertCurrentAuthMutation(revision, signal);
      if (get().user?.id !== user.id) resetAccountScope();
      set({ user, token, isAuthenticated: true, justLoggedOut: false });
      useAddressBookStore.getState().openFor(user.id);

      try {
        // The opaque account id is enough to group a user's crashes. Email and
        // handle would tell Sentry who the person is and whom they pay.
        Sentry.setUser({ id: user.id });
      } catch (e) {
        // Non-fatal: ensure Sentry calls don't break auth flow
        console.error("Sentry.setUser failed:", e);
      }

      if (user.smartAccountAddress) {
        useWalletStore.getState().setWalletAddress(user.smartAccountAddress);
      }
    });
  },

  logout: async () => {
    const revision = ++authMutationRevision;
    // Clear the visible account before slow secure-storage operations finish.
    useWalletStore.getState().reset();
    resetAccountScope();
    set({ user: null, token: null, isAuthenticated: false, justLoggedOut: true });
    try {
      Sentry.setUser(null);
    } catch (e) {
      console.error("Sentry.clearUser failed:", e);
    }
    await queueAuthStorageMutation(async () => {
      await SecureStore.deleteItemAsync("auth_token");
      await SecureStore.deleteItemAsync("user_profile");
      // Persist a short-term flag to avoid immediate auto-login (survives app restart)
      try {
        await SecureStore.setItemAsync("just_logged_out", Date.now().toString());
      } catch (e) {
        console.error("Failed to persist just_logged_out flag", e);
      }
    });

    if (revision === authMutationRevision) {
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        justLoggedOut: true,
      });
    }
  },

  loadSession: async () => {
    const revision = authMutationRevision;
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      const userStr = await SecureStore.getItemAsync("user_profile");
      const justLoggedOutFlag =
        await SecureStore.getItemAsync("just_logged_out");
      if (revision !== authMutationRevision) return;

      if (justLoggedOutFlag) {
        // If the user explicitly logged out recently, preserve that state and avoid auto-login
        set({ isLoading: false, justLoggedOut: true });
        return;
      }

      if (token && userStr && !isJwtExpired(token)) {
        const user = toUserProfile(JSON.parse(userStr));
        set({ token, user, isAuthenticated: true });
        useAddressBookStore.getState().openFor(user.id);

        // Earlier builds saved the full account row. Rewrite it with the
        // profile alone.
        const minimal = JSON.stringify(user);
        if (minimal !== userStr) {
          void queueAuthStorageMutation(async () => {
            if (revision !== authMutationRevision) return;
            await SecureStore.setItemAsync("user_profile", minimal);
          }).catch(() => undefined);
        }

        if (user.smartAccountAddress) {
          useWalletStore.getState().setWalletAddress(user.smartAccountAddress);
        }
      } else if (token) {
        // Token exists but is expired — clear stale credentials
        await queueAuthStorageMutation(async () => {
          if (revision !== authMutationRevision) return;
          await SecureStore.deleteItemAsync("auth_token");
          await SecureStore.deleteItemAsync("user_profile");
        });
      }
    } catch (e) {
      console.error("Failed to load session", e);
      Sentry.captureException(e);
    } finally {
      set({ isLoading: false });
    }
  },

  clearJustLoggedOut: async () => {
    const revision = authMutationRevision;
    await queueAuthStorageMutation(async () => {
      assertCurrentAuthMutation(revision);
      await SecureStore.deleteItemAsync("just_logged_out");
      assertCurrentAuthMutation(revision);
      set({ justLoggedOut: false });
    });
  },

  updateProfile: async (data) => {
    const revision = authMutationRevision;
    const currentUser = get().user;
    if (!currentUser) return;

    try {
      const updatedUserFromApi = await UserService.updateProfile(data);
      assertCurrentAuthMutation(revision);
      const updatedUser = toUserProfile({ ...currentUser, ...updatedUserFromApi });
      await queueAuthStorageMutation(async () => {
        assertCurrentAuthMutation(revision);
        await SecureStore.setItemAsync("user_profile", JSON.stringify(updatedUser));
        assertCurrentAuthMutation(revision);
        set({ user: updatedUser });
      });
    } catch (e) {
      console.error("Failed to update profile", e);
      Sentry.captureException(e);
      throw e;
    }
  },

  updateUser: (updates) => {
    const revision = authMutationRevision;
    const currentUser = get().user;
    if (currentUser) {
      const updatedUser = toUserProfile({ ...currentUser, ...updates });
      set({ user: updatedUser });
      void queueAuthStorageMutation(async () => {
        if (revision !== authMutationRevision) return;
        await SecureStore.setItemAsync("user_profile", JSON.stringify(updatedUser));
      }).catch((error) => Sentry.captureException(error));
    }
  },
}));
