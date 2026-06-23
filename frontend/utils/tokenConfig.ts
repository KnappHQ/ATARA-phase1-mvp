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

const DEFAULT_TOKEN_ADDRESSES: Record<AppNetwork, TokenAddressConfig> = {
  "base-sepolia": {
    USDC: process.env.EXPO_PUBLIC_USDC_ADDRESS_BASE_SEPOLIA ?? "",
    USDT: process.env.EXPO_PUBLIC_USDT_ADDRESS_BASE_SEPOLIA ?? "",
  },
  "base-mainnet": {
    USDC:
      process.env.EXPO_PUBLIC_USDC_ADDRESS_BASE_MAINNET ??
      "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    USDT:
      process.env.EXPO_PUBLIC_USDT_ADDRESS_BASE_MAINNET ??
      "0x7c6b91D9Be155A6Db01f749217d76fF02A7227F2",
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
