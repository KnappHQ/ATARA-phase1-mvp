import { useAuthStore } from "../stores/useAuthStore";
import { api } from "./api";
import { assertActive } from "../utils/walletReadiness";

interface RegisterParams {
  handle: string;
  smartAccountAddress?: string;
  signerAddress: string;
  email?: string;
  authProvider: string;
  message: string;
  signature: string;
}

type AuthPurpose = "login" | "register";

export const AuthService = {
  requestChallenge: async (
    signerAddress: string,
    purpose: AuthPurpose,
    signal?: AbortSignal,
  ) => {
    assertActive(signal);
    const response = await api.post(
      "/auth/challenge",
      { signerAddress, purpose },
      { signal },
    );
    assertActive(signal);
    return response.data as {
      nonce: string;
      message: string;
      expiresAt: string;
    };
  },

  register: async (params: RegisterParams, signal?: AbortSignal) => {
    assertActive(signal);
    const response = await api.post("/auth/register", params, { signal });
    assertActive(signal);

    const { user, token } = response.data;
    await useAuthStore.getState().setAuth(user, token, signal);

    return user;
  },

  loginWithSigner: async (
    signerAddress: string,
    walletSignFunction?: (message: string) => Promise<string>,
    signal?: AbortSignal,
  ) => {
    if (!walletSignFunction) {
      throw new Error("Wallet signing is required for login");
    }

    const challenge = await AuthService.requestChallenge(
      signerAddress,
      "login",
      signal,
    );
    assertActive(signal);
    const signature = await walletSignFunction(challenge.message);
    assertActive(signal);

    if (!signature) {
      throw new Error("Failed to obtain wallet signature for login");
    }

    const response = await api.post(
      "/auth/login",
      {
        signerAddress,
        message: challenge.message,
        signature,
      },
      { signal },
    );
    assertActive(signal);

    const { user, token } = response.data;
    await useAuthStore.getState().setAuth(user, token, signal);

    return user;
  },

  checkHandle: async (handle: string): Promise<boolean> => {
    try {
      const response = await api.get(`/auth/check-handle/${handle}`);
      return response.data.available;
    } catch (error: any) {
      throw new Error(
        error?.response?.data?.message || "Unable to check handle",
      );
    }
  },

  logoutAll: async () => {
    try {
      await api.post("/auth/logout-all");
    } finally {
      // A network failure may prevent revoking the other devices, but this
      // device must still discard its local credentials immediately.
      await useAuthStore.getState().logout();
    }
  },

  logout: async () => {
    await useAuthStore.getState().logout();
  },
};
