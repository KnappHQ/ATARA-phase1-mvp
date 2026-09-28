import { createPublicClient, erc20Abi, http, type Address } from "viem";
import { base, baseSepolia } from "viem/chains";

import { APP_NETWORK } from "./constants";
import type { OnChainReading } from "./walletBalance";

/**
 * Base's own public RPC. Deliberately neither ATARA's service nor Alchemy: this
 * path exists for the moment those are unavailable, so it must not depend on
 * them. Overridable for a private node.
 */
const RPC_URL =
  process.env.EXPO_PUBLIC_CHAIN_RPC_URL?.trim() ||
  (APP_NETWORK === "base-mainnet"
    ? "https://mainnet.base.org"
    : "https://sepolia.base.org");

const client = createPublicClient({
  chain: APP_NETWORK === "base-mainnet" ? base : baseSepolia,
  transport: http(RPC_URL, { timeout: 8_000 }),
});

type ReadableAsset = { symbol: string; contractAddress?: string; decimals: number };

/** Reads each asset's balance for `owner` directly from the chain. */
export const readOnChainBalances = async (
  owner: string,
  assets: ReadableAsset[],
): Promise<OnChainReading[]> => {
  const address = owner as Address;
  return Promise.all(
    assets.map(async (asset) => {
      const raw =
        asset.symbol === "ETH" || !asset.contractAddress
          ? await client.getBalance({ address })
          : await client.readContract({
              address: asset.contractAddress as Address,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [address],
            });
      return {
        symbol: asset.symbol,
        balanceWei: raw.toString(),
        decimals: asset.decimals,
      };
    }),
  );
};
