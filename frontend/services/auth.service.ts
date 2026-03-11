import { useAuthStore } from "../stores/useAuthStore";
import { api } from "./api";
import { analyticsEvents } from "./analytics.service";

interface RegisterParams {
  handle: string;
  smartAccountAddress?: string;
  signerAddress: string;
  email?: string;
  authProvider: string;
}

export const AuthService = {
  register: async (params: RegisterParams) => {
    const response = await api.post("/auth/register", params);

    const { user, token } = response.data;
    await useAuthStore.getState().setAuth(user, token);

    analyticsEvents.userSignedUp({
      handle: user.handle,
      authProvider: params.authProvider,
    });

    return user;
  },

  loginWithSigner: async (signerAddress: string) => {
    const response = await api.post("/auth/login", { signerAddress });

    const { user, token } = response.data;
    await useAuthStore.getState().setAuth(user, token);

    return user;
  },

  checkHandle: async (handle: string): Promise<boolean> => {
    try {
      const response = await api.get(`/auth/check-handle/${handle}`);
      return response.data.available;
    } catch {
      return false;
    }
  },

  logout: async () => {
    await useAuthStore.getState().logout();
  },
};
