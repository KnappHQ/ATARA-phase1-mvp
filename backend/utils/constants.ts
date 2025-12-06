export const PORT = process.env.PORT || 4000;
export const DB_CONNECTION_STRING = process.env.DATABASE_URL || "";
export const BASE_TESTNET_RPC =
  process.env.BASE_TESTNET_RPC || "https://sepolia.base.org";
export const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || "";
export const ZEROX_API_KEY = process.env.ZEROX_API_KEY || "";
export const ZEROX_BASE_URL = "https://api.0x.org";
export const ZEROX_CHAIN_ID = 8453; // Base Mainnet

//auth constants
export const JWT_SECRET = process.env.JWT_SECRET || "";
export const JWT_EXPIRES_IN = "7d";
export const SALT_ROUNDS = 5;
