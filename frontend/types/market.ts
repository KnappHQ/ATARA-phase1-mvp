export interface MarketCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  price_change_percentage_24h: number;
}

export interface NewsItem {
  title: string;
  description: string;
  url: string;
  source: string;
  published_at: string;
  image_url?: string;
}

export interface Holding {
  id: string; // Unique ID for the list
  symbol: string;
  name: string;
  quantity: number;
  purchasePrice: number;
  
  // Computed on Frontend
  currentPrice?: number;
  currentValue?: number;
  profitLoss?: number;
  profitLossPercent?: number;
}