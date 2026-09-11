import { useAuthStore } from "../stores/useAuthStore";
import { api } from "./api";

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
  requestChallenge: async (signerAddress: string, purpose: AuthPurpose) => {
    const response = await api.post("/auth/challenge", {
      signerAddress,
      purpose,
    });
    return response.data as {
      nonce: string;
      message: string;
      expiresAt: string;
    };
  },

  register: async (params: RegisterParams) => {
    const response = await api.post("/auth/register", params);

    const { user, token } = response.data;
    await useAuthStore.getState().setAuth(user, token);

    return user;
  },

  loginWithSigner: async (
    signerAddress: string,
    walletSignFunction?: (message: string) => Promise<string>,
  ) => {
    if (!walletSignFunction) {
      throw new Error("Wallet signing is required for login");
    }

    const challenge = await AuthService.requestChallenge(
      signerAddress,
      "login",
    );
    const signature = await walletSignFunction(challenge.message);

    if (!signature) {
      throw new Error("Failed to obtain wallet signature for login");
    }

    const response = await api.post("/auth/login", {
      signerAddress,
      message: challenge.message,
      signature,
    });

    const { user, token } = response.data;
    await useAuthStore.getState().setAuth(user, token);

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
    await api.post("/auth/logout-all");
    await useAuthStore.getState().logout();
  },

  logout: async () => {
    await useAuthStore.getState().logout();
  },
};
