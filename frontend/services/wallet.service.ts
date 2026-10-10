import { api } from "./api";

export type PriceStatus = "live" | "stale" | "pegged_estimate" | "unavailable";

/** How sure the server is about the USD figures. Absent on servers older than this field. */
export interface PortfolioValuation {
  complete: boolean;
  unpricedSymbols: string[];
  staleSymbols: string[];
  estimatedSymbols: string[];
  oldestPriceAsOf: string | null;
  change24hKnown: boolean;
}

interface PortfolioResponse {
  totalUSD: number;
  change24h: number;
  percentChange24h: number;
  valuation?: PortfolioValuation;
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
    /** "unavailable": the amount is real, `usdValue`/`usdPrice` are 0 placeholders for old builds. */
    priceStatus?: PriceStatus;
    priceAsOf?: string | null;
    change24hKnown?: boolean;
  }>;
}

export const WalletService = {
  getPortfolio: async (): Promise<PortfolioResponse> => {
    const response = await api.get("/wallet/portfolio");
    return response.data.portfolio;
  },
};
