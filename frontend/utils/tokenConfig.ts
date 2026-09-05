export type AppNetwork = "base-sepolia" | "base-mainnet";

export type TokenSymbol = "ETH" | "USDC" | "USDT";

export type SupportedAsset = {
  symbol: TokenSymbol;
  name: string;
  contractAddress?: string;
  balance: string;
  balanceWei?: string;
  usdValue: string;
  usdPrice: number;
  decimals: number;
  logoUrl?: string;
};

type TokenAddressConfig = Record<Exclude<TokenSymbol, "ETH">, string>;

/**
 * Canonical Base mainnet token addresses.
 *
 * These used to default to Base *Sepolia* addresses, which on mainnet would
 * have encoded transfers to a contract that does not exist there.
 */
const BASE_MAINNET_ADDRESSES: TokenAddressConfig = {
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  USDT: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
};

const DEFAULT_TOKEN_ADDRESSES: Record<AppNetwork, TokenAddressConfig> = {
  "base-sepolia": {
    USDC: process.env.EXPO_PUBLIC_USDC_ADDRESS_BASE_SEPOLIA ?? "",
    USDT: process.env.EXPO_PUBLIC_USDT_ADDRESS_BASE_SEPOLIA ?? "",
  },
  "base-mainnet": {
    USDC:
      process.env.EXPO_PUBLIC_USDC_ADDRESS_BASE_MAINNET ||
      BASE_MAINNET_ADDRESSES.USDC,
    USDT:
      process.env.EXPO_PUBLIC_USDT_ADDRESS_BASE_MAINNET ||
      BASE_MAINNET_ADDRESSES.USDT,
  },
};

export const getTokenAddress = (
  symbol: Exclude<TokenSymbol, "ETH">,
  network: AppNetwork,
) => DEFAULT_TOKEN_ADDRESSES[network][symbol];

export const getDefaultAssets = (network: AppNetwork): SupportedAsset[] => {
  const usdcAddress = getTokenAddress("USDC", network);
  const usdtAddress = getTokenAddress("USDT", network);

  return [
    {
      symbol: "ETH",
      name: "Ethereum",
      balance: "0.0",
      balanceWei: "0",
      usdValue: "$0.00",
      usdPrice: 0,
      decimals: 18,
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      contractAddress: usdcAddress || undefined,
      balance: "0.00",
      balanceWei: "0",
      usdValue: "$0.00",
      usdPrice: 0,
      decimals: 6,
    },
    {
      symbol: "USDT",
      name: "Tether USD",
      contractAddress: usdtAddress || undefined,
      balance: "0.00",
      balanceWei: "0",
      usdValue: "$0.00",
      usdPrice: 0,
      decimals: 6,
    },
  ];
};
