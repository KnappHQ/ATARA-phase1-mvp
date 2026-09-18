import { isAddress } from "viem";
import { APP_NETWORK, CHAIN_ID } from "./constants";

export const SAVINGS_LOCK_FACTORY_ADDRESS =
  process.env.EXPO_PUBLIC_SAVINGS_LOCK_FACTORY_ADDRESS || "";
const SAVINGS_CHAIN_ID = 84532;

export const SAVINGS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_SAVINGS === "true";

export const isSavingsConfigured =
  SAVINGS_ENABLED &&
  APP_NETWORK === "base-sepolia" &&
  CHAIN_ID === SAVINGS_CHAIN_ID &&
  !/^0x0{40}$/i.test(SAVINGS_LOCK_FACTORY_ADDRESS) &&
  isAddress(SAVINGS_LOCK_FACTORY_ADDRESS as `0x${string}`);
