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
    USDC: process.env.BASE_SEPOLIA_USDC_ADDRESS ?? "",
    USDT: process.env.BASE_SEPOLIA_USDT_ADDRESS ?? "",
  },
  "base-mainnet": {
    USDC:
      process.env.BASE_MAINNET_USDC_ADDRESS ??
      "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    USDT:
      process.env.BASE_MAINNET_USDT_ADDRESS ??
      "0x7c6b91D9Be155A6Db01f749217d76fF02A7227F2",
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
