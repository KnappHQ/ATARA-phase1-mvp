import { api } from "./api";

interface PortfolioResponse {
  totalUSD: number;
  change24h: number;
  percentChange24h: number;
  tokens: Array<{
    symbol: string;
    name: string;
    balance: string;
    usdValue: number;
    usdPrice: number;
    change24h: number;
    percentChange24h: number;
    decimals: number;
    contractAddress?: string;
  }>;
}

export const WalletService = {
  getPortfolio: async (): Promise<PortfolioResponse> => {
    const response = await api.get("/wallet/portfolio");
    return response.data.portfolio;
  },
};
