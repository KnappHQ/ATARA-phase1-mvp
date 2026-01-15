import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Holding, MarketCoin, NewsItem } from "../types/market";
import { MarketService } from "../services/market.service";

interface MarketState {
  // Data
  marketData: MarketCoin[];
  news: NewsItem[];
  holdings: Holding[];

  // Loading & Metadata
  isMarketLoading: boolean;
  isNewsLoading: boolean;
  lastUpdated: Date;

  // Actions
  fetchMarketOverview: () => Promise<void>;
  fetchNews: () => Promise<void>;
  refreshAll: () => Promise<void>;

  addHolding: (holding: Omit<Holding, "id" | "currentPrice">) => void;
  removeHolding: (id: string) => void;
}

export const useMarketStore = create<MarketState>()(
  persist(
    (set, get) => ({
      marketData: [],
      news: [],
      holdings: [],
      isMarketLoading: false,
      isNewsLoading: false,
      lastUpdated: new Date(),

      fetchMarketOverview: async () => {
        set({ isMarketLoading: true });
        try {
          const data = await MarketService.getMarketOverview();
          set({
            marketData: data,
            isMarketLoading: false,
            lastUpdated: new Date(),
          });
        } catch (e) {
          console.error(e);
          set({ isMarketLoading: false });
        }
      },

      fetchNews: async () => {
        set({ isNewsLoading: true });
        try {
          const data = await MarketService.getNews();
          set({ news: data, isNewsLoading: false });
        } catch (e) {
          console.error(e);
          set({ isNewsLoading: false });
        }
      },

      refreshAll: async () => {
        await Promise.all([get().fetchMarketOverview(), get().fetchNews()]);
      },

      addHolding: (newHolding) => {
        set((state) => ({
          holdings: [
            ...state.holdings,
            { ...newHolding, id: Date.now().toString() },
          ],
        }));
      },

      removeHolding: (id) => {
        set((state) => ({
          holdings: state.holdings.filter((h) => h.id !== id),
        }));
      },
    }),
    {
      name: "astra-market-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ holdings: state.holdings }),
    }
  )
);
