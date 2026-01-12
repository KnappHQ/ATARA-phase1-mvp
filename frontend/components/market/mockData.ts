export interface CryptoData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  image?: string;
}

export const CRYPTO_DATA: CryptoData[] = [
  { symbol: "BTC", name: "Bitcoin", price: 43250.5, change24h: 2.45 },
  { symbol: "ETH", name: "Ethereum", price: 2345.8, change24h: -1.23 },
  { symbol: "SOL", name: "Solana", price: 98.45, change24h: 5.67 },
  { symbol: "USDC", name: "USD Coin", price: 1.0, change24h: 0.01 },
  { symbol: "USDT", name: "Tether", price: 1.0, change24h: -0.02 },
  { symbol: "ADA", name: "Cardano", price: 0.52, change24h: 3.21 },
  { symbol: "AVAX", name: "Avalanche", price: 34.67, change24h: -2.45 },
  { symbol: "DOT", name: "Polkadot", price: 6.78, change24h: 1.89 },
];

export interface NewsItem {
  tag: string;
  title: string;
  time: string;
}

export const NEWS_DATA: NewsItem[] = [
  {
    tag: "ETH",
    title: "Ethereum Shanghai upgrade completes successfully",
    time: "2h ago",
  },
  {
    tag: "BTC",
    title: "Bitcoin ETF sees record inflows this week",
    time: "4h ago",
  },
  {
    tag: "SOL",
    title: "Solana network processes 50M daily transactions",
    time: "6h ago",
  },
];

export const formatPrice = (price: number): string => {
  return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatChange = (change: number): string => {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
};
