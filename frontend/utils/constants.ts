import { Contact } from "@/stores/useContactStore";
import {
  ArrowLeftRight,
  MoreHorizontal,
  ShoppingBag,
  Utensils,
  Wine,
} from "lucide-react-native";
import { truncateAddress } from "./format";
import { getDefaultAssets } from "./tokenConfig";

export type AppNetwork = "base-sepolia" | "base-mainnet";

export const APP_NETWORK: AppNetwork =
  process.env.EXPO_PUBLIC_NETWORK === "base-mainnet"
    ? "base-mainnet"
    : "base-sepolia";

export const IS_MAINNET = APP_NETWORK === "base-mainnet";
export const CHAIN_ID = IS_MAINNET ? 8453 : 84532;
export const NETWORK_NAME = IS_MAINNET ? "Base Mainnet" : "Base Sepolia";

export const API_URL = `${process.env.EXPO_PUBLIC_API_URL}/api/v1`;
export const NOTION_LEGAL_URL =
  "https://www.notion.so/ATARA-L-gal-7e2600d5ec90443fb86748254be86885?source=copy_link";
export const TX_EXPLORER_BASE_URL = IS_MAINNET
  ? "https://basescan.org/tx"
  : "https://sepolia.basescan.org/tx";
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

export const DEFAULT_ASSETS = getDefaultAssets(APP_NETWORK);
