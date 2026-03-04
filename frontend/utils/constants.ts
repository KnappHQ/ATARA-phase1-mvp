import {
  ArrowLeftRight,
  MoreHorizontal,
  ShoppingBag,
  Utensils,
  Wine,
} from "lucide-react-native";

export const INFURA_PROJECT_ID = process.env.EXPO_PUBLIC_INFURA_PROJECT_ID;
export const PROVIDER_URL = `https://base-sepolia.infura.io/v3/${INFURA_PROJECT_ID}`;
export const API_URL = `${process.env.EXPO_PUBLIC_API_URL}/api/v1`;
export const CHART_DATA = [30, 45, 35, 60, 55, 70, 75];
export const ACTIVITY_LIMIT = 5;

interface Category {
  id: string;
  label: string;
  icon: any;
}

export const CATEGORIES: Category[] = [
  { id: "drinks", label: "Drinks", icon: Wine },
  { id: "food", label: "Food", icon: Utensils },
  { id: "shopping", label: "Shopping", icon: ShoppingBag },
  { id: "transfer", label: "Transfer", icon: ArrowLeftRight },
  { id: "other", label: "Other", icon: MoreHorizontal },
];

export const COLORS = {
  white: "#FFFFFF",
  black: "#000000",
  gray: "#E0E0E0",
  accent: "#3c83f6",
  bitcoinOrange: "#f7931a",
  sapphire: "#4ade80",
  platinum: "#F5F5F0",
  border: "rgba(255, 255, 255, 0.3)",
  placeholder: "rgba(255, 255, 255, 0.25)",
  checkmark: "rgba(255, 255, 255, 0.7)",
  primary: "#f7f7f3",
  muted: "#8a8375",
  emarald: "#10b981",
};

export const DEFAULT_ASSETS = [
  {
    symbol: "ETH" as const,
    name: "Ethereum",
    balance: "0.0",
    balanceWei: "0",
    usdValue: "$0.00",
    usdPrice: 0,
    decimals: 18,
  },
  {
    symbol: "USDC" as const,
    name: "USD Coin",
    contractAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    balance: "0.00",
    balanceWei: "0",
    usdValue: "$0.00",
    usdPrice: 0,
    decimals: 6,
  },
  {
    symbol: "USDT" as const,
    name: "Tether USD",
    contractAddress: "0x7c6b91D9Be155A6Db01f749217d76fF02A7227F2",
    balance: "0.00",
    balanceWei: "0",
    usdValue: "$0.00",
    usdPrice: 0,
    decimals: 6,
  },
];
