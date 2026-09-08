export type AppNetwork = "base-sepolia" | "base-mainnet";

export type SupportedTokenSymbol = "USDC" | "USDT";

export type TokenConfig = {
  address: string;
  symbol: SupportedTokenSymbol;
  decimals: number;
  name: string;
};

const DEFAULT_TOKEN_ADDRESSES: Record<
  AppNetwork,
  Record<SupportedTokenSymbol, string>
> = {
  "base-sepolia": {
    USDC:
      process.env.BASE_SEPOLIA_USDC_ADDRESS ??
      "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    USDT: process.env.BASE_SEPOLIA_USDT_ADDRESS ?? "",
  },
  "base-mainnet": {
    USDC:
      process.env.BASE_MAINNET_USDC_ADDRESS ??
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    USDT:
      process.env.BASE_MAINNET_USDT_ADDRESS ??
      "",
  },
};

export const getKnownTokens = (
  network: AppNetwork,
): Record<SupportedTokenSymbol, TokenConfig> => ({
  USDC: {
    address: DEFAULT_TOKEN_ADDRESSES[network].USDC,
    symbol: "USDC",
    decimals: 6,
    name: "USD Coin",
  },
  USDT: {
    address: DEFAULT_TOKEN_ADDRESSES[network].USDT,
    symbol: "USDT",
    decimals: 6,
    name: "Tether USD",
  },
});
