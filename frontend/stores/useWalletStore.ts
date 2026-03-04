import { create } from "zustand";
import { DEFAULT_ASSETS } from "@/utils/constants";
import { WalletService } from "@/services/wallet.service";

export interface Token {
  symbol: string;
  name: string;
  contractAddress?: string;
  balance: string;
  balanceWei?: string;
  usdValue: string;
  usdPrice: number; // current unit price in USD
  decimals: number;
  logoUrl?: string;
}

export interface WalletState {
  address?: string;
  smartAccountAddress?: string;
  assets: Token[];
  isLoadingBalances: boolean;
  lastUpdated?: Date;
  networkName: string;
  chainId: number;
  balanceError: string | null;

  // Portfolio totals
  totalUSDValue: number;
  change24h: number;
  percentChange24h: number;

  setWalletAddress: (address: string, smartAccountAddress?: string) => void;
  updateTokenBalances: (tokens: Token[]) => void;
  refreshBalances: () => Promise<void>;
  getAssetBySymbol: (symbol: string) => Token | undefined;
  getTotalUSDValue: () => number;
  setBalanceError: (error: string | null) => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  assets: [...DEFAULT_ASSETS],
  isLoadingBalances: false,
  networkName: "Base Sepolia",
  chainId: 84532,
  balanceError: null,
  totalUSDValue: 0,
  change24h: 0,
  percentChange24h: 0,

  setWalletAddress: (address: string, smartAccountAddress?: string) => {
    set({
      address,
      smartAccountAddress,
      balanceError: null,
    });
  },

  updateTokenBalances: (tokens: Token[]) => {
    const updatedAssets = get().assets.map((asset) => {
      const loadedToken = tokens.find((t) => t.symbol === asset.symbol);
      return loadedToken || asset;
    });

    set({
      assets: updatedAssets,
      lastUpdated: new Date(),
      isLoadingBalances: false,
      balanceError: null,
    });
  },

  refreshBalances: async () => {
    const { smartAccountAddress } = get();

    if (!smartAccountAddress) {
      set({ balanceError: "No smart account address available" });
      return;
    }

    set({ isLoadingBalances: true, balanceError: null });

    try {
      const portfolio = await WalletService.getPortfolio();

      set({
        totalUSDValue: portfolio.totalUSD,
        change24h: portfolio.change24h,
        percentChange24h: portfolio.percentChange24h,
      });

      const updatedAssets = get().assets.map((asset) => {
        const portfolioToken = portfolio.tokens.find(
          (t: any) => t.symbol === asset.symbol,
        );

        if (portfolioToken) {
          return {
            ...asset,
            balance: portfolioToken.balance,
            usdValue: `$${portfolioToken.usdValue.toFixed(2)}`,
            usdPrice:
              portfolio.tokenPrices?.[asset.symbol] ?? asset.usdPrice ?? 0,
          };
        }

        return asset;
      });

      set({
        assets: updatedAssets,
        lastUpdated: new Date(),
        isLoadingBalances: false,
        balanceError: null,
      });
    } catch (error: any) {
      console.error("Failed to refresh balances:", error);
      set({
        balanceError: error.message || "Failed to load portfolio",
        isLoadingBalances: false,
      });
    }
  },

  getAssetBySymbol: (symbol: string): Token | undefined => {
    return get().assets.find((asset) => asset.symbol === symbol);
  },

  getTotalUSDValue: (): number => {
    return get().assets.reduce((total, token) => {
      const usdValue = parseFloat(token.usdValue.replace(/[$,]/g, "")) || 0;
      return total + usdValue;
    }, 0);
  },

  setBalanceError: (error: string | null) => {
    set({ balanceError: error });
  },
}));
