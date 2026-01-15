import { api } from "./api";
import { MarketCoin, NewsItem } from "../types/market";

export const MarketService = {
  getMarketOverview: async (): Promise<MarketCoin[]> => {
    const response = await api.get<{ data: MarketCoin[] }>(
      "/wallet/market-overview"
    );
    return response.data.data;
  },

  getNews: async (): Promise<NewsItem[]> => {
    const response = await api.get<{ data: NewsItem[] }>("/wallet/news");
    return response.data.data;
  },
};
