import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { api } from "./api";
import * as Passkeys from "react-native-passkeys";

export type SecurityStatus = {
  totpEnabled: boolean;
  recoveryPhone: string | null;
  recoveryPhoneVerified: boolean;
  recoveryCodesRemaining: number;
};

const PASSKEY_STATUS_KEY = "atara_passkey_status";
const PASSKEY_RP_ID = process.env.EXPO_PUBLIC_PASSKEY_RP_ID || "";

const toBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const randomChallenge = async () =>
  toBase64Url(await Crypto.getRandomBytesAsync(32));

export const SecurityService = {
  getStatus: async (): Promise<SecurityStatus> => {
    const response = await api.get("/security/status");
    return response.data.security;
  },

  setupTotp: async (label?: string) => {
    const response = await api.post("/security/totp/setup", { label });
    return response.data.setup as { secret: string; otpauthUri: string };
  },

  enableTotp: async (code: string) => {
    await api.post("/security/totp/enable", { code });
  },

  disableTotp: async (code: string) => {
    await api.post("/security/totp/disable", { code });
  },

  regenerateRecoveryCodes: async (): Promise<string[]> => {
    const response = await api.post("/security/recovery-codes");
    return response.data.codes;
  },

  saveRecoveryPhone: async (phone: string) => {
    const response = await api.patch("/security/recovery-phone", { phone });
    return response.data.recoveryPhone;
  },

  isPasskeyConfigured: () => Boolean(PASSKEY_RP_ID),

  isPasskeyRegistered: async () =>
    (await SecureStore.getItemAsync(PASSKEY_STATUS_KEY)) === "registered",

  registerPasskey: async ({ userId, handle }: { userId: string; handle: string }) => {
    if (!PASSKEY_RP_ID) {
      throw new Error("Le domaine de passkey n'est pas encore configuré pour cette bêta.");
    }
    if (!Passkeys.isSupported()) {
      throw new Error("Ce téléphone ne prend pas en charge les passkeys.");
    }

    const challenge = await randomChallenge();
    const userIdBytes = new TextEncoder().encode(userId);
    const result = await Passkeys.create({
      rp: { id: PASSKEY_RP_ID, name: "ATARA" },
      user: {
        id: toBase64Url(userIdBytes),
        name: handle,
        displayName: handle,
      },
      challenge,
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
      attestation: "none",
    } as any);

    if (!result) throw new Error("La création de la passkey a été annulée.");
    await SecureStore.setItemAsync(PASSKEY_STATUS_KEY, "registered");
    return result;
  },
};
