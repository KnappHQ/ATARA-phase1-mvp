import { create } from "zustand";
import * as Sentry from "@sentry/react-native";
import { CHAIN_ID, DEFAULT_ASSETS, NETWORK_NAME } from "@/utils/constants";
import { WalletService } from "@/services/wallet.service";
import { readOnChainBalances } from "@/utils/chainBalance";
import { mergeOnChainBalances } from "@/utils/walletBalance";

/**
 * Where the balances on screen came from. "service" is ATARA's portfolio API,
 * with USD prices. "chain" is a direct read from Base when that API failed:
 * real token amounts, no prices. null means nothing has been read yet, so the
 * zeros on screen are placeholders, not a balance.
 */
export type BalanceSource = "service" | "chain" | null;

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
  smartAccountAddress?: string;
  assets: Token[];
  isLoadingBalances: boolean;
  lastUpdated?: Date;
  networkName: string;
  chainId: number;
  balanceError: string | null;
  balanceSource: BalanceSource;
  totalUSDValue: number;
  change24h: number;
  percentChange24h: number;

  setWalletAddress: (smartAccountAddress: string) => void;
  reset: () => void;
  updateTokenBalances: (tokens: Token[]) => void;
  refreshBalances: () => Promise<void>;
  getAssetBySymbol: (symbol: string) => Token | undefined;
  getTotalUSDValue: () => number;
  setBalanceError: (error: string | null) => void;
}

export const useWalletStore = create<WalletState>((set, get) => {
  let balanceRequest = 0;
  const emptyPortfolio = () => ({
    assets: DEFAULT_ASSETS.map(asset => ({ ...asset })),
    totalUSDValue: 0,
    change24h: 0,
    percentChange24h: 0,
    lastUpdated: undefined,
    isLoadingBalances: false,
    balanceError: null,
    balanceSource: null as BalanceSource,
  });
  return ({
  assets: [...DEFAULT_ASSETS],
  isLoadingBalances: false,
  networkName: NETWORK_NAME,
  chainId: CHAIN_ID,
  balanceError: null,
  balanceSource: null,
  totalUSDValue: 0,
  change24h: 0,
  percentChange24h: 0,

  setWalletAddress: (smartAccountAddress: string) => {
    if (get().smartAccountAddress?.toLowerCase() === smartAccountAddress.toLowerCase()) return;
    balanceRequest++;
    set({
      ...emptyPortfolio(),
      smartAccountAddress,
      balanceError: null,
    });
  },

  reset: () => {
    balanceRequest++;
    set({ ...emptyPortfolio(), smartAccountAddress: undefined });
  },

  updateTokenBalances: (tokens: Token[]) => {
    const updatedAssets = [...get().assets];

    tokens.forEach((token) => {
      const existingIndex = updatedAssets.findIndex(
        (asset) => asset.symbol === token.symbol,
      );

      if (existingIndex >= 0) {
        updatedAssets[existingIndex] = {
          ...updatedAssets[existingIndex],
          ...token,
        };
      } else {
        updatedAssets.push(token);
      }
    });

    set({
      assets: updatedAssets,
      lastUpdated: new Date(),
      isLoadingBalances: false,
      balanceError: null,
    });
  },

  refreshBalances: async () => {
    const request = ++balanceRequest;
    const { smartAccountAddress } = get();

    if (!smartAccountAddress) {
      set({ balanceError: "No smart account address available" });
      return;
    }

    set({ isLoadingBalances: true, balanceError: null });

    try {
      const portfolio = await WalletService.getPortfolio();
      if (request !== balanceRequest) return;

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
            usdPrice: portfolioToken.usdPrice ?? asset.usdPrice ?? 0,
          };
        }

        // The service answered and does not list this token: nothing is held, a
        // real zero (the placeholder was "not read yet", which is not the same).
        return { ...asset, balance: "0", usdValue: "$0.00", balanceWei: "0" };
      });

      portfolio.tokens.forEach((portfolioToken: any) => {
        if (updatedAssets.some((asset) => asset.symbol === portfolioToken.symbol)) {
          return;
        }

        updatedAssets.push({
          symbol: portfolioToken.symbol,
          name: portfolioToken.name ?? portfolioToken.symbol,
          balance: String(portfolioToken.balance ?? "0"),
          usdValue: `$${Number(portfolioToken.usdValue ?? 0).toFixed(2)}`,
          usdPrice: Number(portfolioToken.usdPrice ?? 0),
          decimals: Number(portfolioToken.decimals ?? 18),
          contractAddress: portfolioToken.contractAddress,
          logoUrl: portfolioToken.logoUrl,
        });
      });

      set({
        assets: updatedAssets,
        lastUpdated: new Date(),
        isLoadingBalances: false,
        balanceError: null,
        balanceSource: "service",
      });
    } catch (error: any) {
      if (request !== balanceRequest) return;
      console.error("Failed to refresh balances:", error?.message);
      Sentry.captureException(error);

      // The money is on Base, not at ATARA. When ATARA's portfolio API is
      // unavailable, read the amounts from the chain instead of leaving
      // placeholder zeros that look like an empty wallet — and that the send
      // screen would treat as one, blocking every payment.
      try {
        const readings = await readOnChainBalances(smartAccountAddress, get().assets);
        if (request !== balanceRequest) return;
        set({
          assets: mergeOnChainBalances(get().assets, readings),
          lastUpdated: new Date(),
          isLoadingBalances: false,
          balanceError: null,
          balanceSource: "chain",
        });
      } catch (chainError: any) {
        if (request !== balanceRequest) return;
        Sentry.captureException(chainError);
        // Keep whatever was last read successfully; only the error changes.
        set({
          balanceError:
            "Balance unavailable. Neither ATARA's service nor the Base network could be reached.",
          isLoadingBalances: false,
        });
      }
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
  });
});
