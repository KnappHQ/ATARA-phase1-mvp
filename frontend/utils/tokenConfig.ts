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
    USDC:
      process.env.EXPO_PUBLIC_USDC_ADDRESS_BASE_SEPOLIA ??
      "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    USDT: process.env.EXPO_PUBLIC_USDT_ADDRESS_BASE_SEPOLIA ?? "",
  },
  "base-mainnet": {
    USDC:
      process.env.EXPO_PUBLIC_USDC_ADDRESS_BASE_MAINNET ??
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    USDT:
      process.env.EXPO_PUBLIC_USDT_ADDRESS_BASE_MAINNET ??
      "",
  },
};

export const getTokenAddress = (
  symbol: Exclude<TokenSymbol, "ETH">,
  network: AppNetwork,
) => DEFAULT_TOKEN_ADDRESSES[network][symbol];

/**
 * Before a balance is read, an asset has no balance and no USD value: empty
 * strings, not "0.00" / "$0.00", which would read as an empty wallet. Every
 * screen treats "" as "not known yet" (see utils/balanceDisplay.ts).
 */
const PLACEHOLDER_BALANCE = "";
const PLACEHOLDER_USD = "";

export const getDefaultAssets = (network: AppNetwork): SupportedAsset[] => {
  const usdcAddress = getTokenAddress("USDC", network);
  const usdtAddress = getTokenAddress("USDT", network);

  const configured: SupportedAsset[] = [
    {
      symbol: "ETH",
      name: "Ethereum",
      balance: PLACEHOLDER_BALANCE,
      usdValue: PLACEHOLDER_USD,
      usdPrice: 0,
      decimals: 18,
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      contractAddress: usdcAddress || undefined,
      balance: PLACEHOLDER_BALANCE,
      usdValue: PLACEHOLDER_USD,
      usdPrice: 0,
      decimals: 6,
    },
    {
      symbol: "USDT",
      name: "Tether USD",
      contractAddress: usdtAddress || undefined,
      balance: PLACEHOLDER_BALANCE,
      usdValue: PLACEHOLDER_USD,
      usdPrice: 0,
      decimals: 6,
    },
  ];
  return configured.filter(asset => asset.symbol === "ETH" || !!asset.contractAddress).sort((a, b) => a.symbol === "USDC" ? -1 : b.symbol === "USDC" ? 1 : 0);
};
