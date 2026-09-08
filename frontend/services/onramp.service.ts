import { api } from "./api";

export type OnrampSession = {
  provider: "moonpay";
  network: "base-mainnet" | "sandbox";
  mode: "live" | "sandbox";
  currencyCode: string;
  walletAddress: string;
  url: string;
};

export const OnrampService = {
  createSession: async (
    baseCurrencyAmount?: string,
  ): Promise<OnrampSession> => {
    const response = await api.post("/wallet/onramp-session", {
      baseCurrencyAmount: baseCurrencyAmount || undefined,
    });
    return response.data.session as OnrampSession;
  },
};
