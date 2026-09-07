import { api } from "./api";

export type SecurityStatus = {
  totpEnabled: boolean;
  recoveryPhone: string | null;
  recoveryPhoneVerified: boolean;
  recoveryCodesRemaining: number;
};

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

};
