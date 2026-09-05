export type AppNetwork = "base-sepolia" | "base-mainnet";

export type SupportedTokenSymbol = "USDC" | "USDT";

export type TokenConfig = {
  address: string;
  symbol: SupportedTokenSymbol;
  decimals: number;
  name: string;
};

/**
 * Canonical mainnet token addresses on Base.
 *
 * These are hardcoded on purpose: they are immutable facts about the chain,
 * not deployment configuration. Previously this file fell back to Base
 * *Sepolia* addresses when the env vars were missing, which would have
 * encoded transfers to a contract that does not exist on mainnet.
 */
const BASE_MAINNET_ADDRESSES: Record<SupportedTokenSymbol, string> = {
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  USDT: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
};

const readEnvAddress = (name: string): string | undefined => {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;

  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) {
    throw new Error(
      `Invalid token address in ${name}: expected a 20-byte hex address, got "${raw}"`,
    );
  }

  return raw;
};

const DEFAULT_TOKEN_ADDRESSES: Record<
  AppNetwork,
  Record<SupportedTokenSymbol, string | undefined>
> = {
  "base-sepolia": {
    // Testnet addresses have no canonical default: they must be configured.
    USDC: readEnvAddress("BASE_SEPOLIA_USDC_ADDRESS"),
    USDT: readEnvAddress("BASE_SEPOLIA_USDT_ADDRESS"),
  },
  "base-mainnet": {
    USDC: readEnvAddress("BASE_MAINNET_USDC_ADDRESS") ?? BASE_MAINNET_ADDRESSES.USDC,
    USDT: readEnvAddress("BASE_MAINNET_USDT_ADDRESS") ?? BASE_MAINNET_ADDRESSES.USDT,
  },
};

const TOKEN_METADATA: Record<
  SupportedTokenSymbol,
  { decimals: number; name: string }
> = {
  USDC: { decimals: 6, name: "USD Coin" },
  USDT: { decimals: 6, name: "Tether USD" },
};

export const isSupportedTokenSymbol = (
  symbol: string,
): symbol is SupportedTokenSymbol => symbol === "USDC" || symbol === "USDT";

/**
 * Resolve a token's configuration, or `undefined` when the token is not
 * configured for this network. Callers MUST treat `undefined` as "refuse the
 * request" - never as "skip verification".
 */
export const getTokenConfig = (
  network: AppNetwork,
  symbol: SupportedTokenSymbol,
): TokenConfig | undefined => {
  const address = DEFAULT_TOKEN_ADDRESSES[network][symbol];
  if (!address) return undefined;

  return {
    address,
    symbol,
    ...TOKEN_METADATA[symbol],
  };
};

export const getKnownTokens = (
  network: AppNetwork,
): Record<SupportedTokenSymbol, TokenConfig> => ({
  USDC: {
    address: DEFAULT_TOKEN_ADDRESSES[network].USDC ?? "",
    symbol: "USDC",
    ...TOKEN_METADATA.USDC,
  },
  USDT: {
    address: DEFAULT_TOKEN_ADDRESSES[network].USDT ?? "",
    symbol: "USDT",
    ...TOKEN_METADATA.USDT,
  },
});
