import { isAddress } from "viem";
import { APP_NETWORK, CHAIN_ID } from "./constants";

export const VAULT_RPC_URL =
  process.env.EXPO_PUBLIC_VAULT_RPC_URL || "https://sepolia.base.org";
export const VAULT_FACTORY_ADDRESS =
  process.env.EXPO_PUBLIC_VAULT_FACTORY_ADDRESS || "";
export const VAULT_CHAIN_ID = 84532;
export const VAULT_USDC_DECIMALS = 6;

export const isVaultConfigured =
  APP_NETWORK === "base-sepolia" &&
  CHAIN_ID === VAULT_CHAIN_ID &&
  !/^0x0{40}$/i.test(VAULT_FACTORY_ADDRESS) &&
  isAddress(VAULT_FACTORY_ADDRESS as `0x${string}`);
