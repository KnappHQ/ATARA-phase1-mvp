// Server Configuration
export const PORT = Number(process.env.PORT || 4000);
export const DB_CONNECTION_STRING = process.env.DATABASE_URL || "";

// 0x API Constants
export const ZEROX_API_KEY = process.env.ZEROX_API_KEY || "";
export const ZEROX_BASE_URL = "https://api.0x.org";
export const ZEROX_CHAIN_ID = 8453; // Base Mainnet

//auth constants
export const JWT_SECRET = process.env.JWT_SECRET || "";
export const JWT_EXPIRES_IN = "7d";
export const SALT_ROUNDS = 5;

// CoinGecko API Constants
export const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || "";
export const COINGECKO_API_URL = "https://api.coingecko.com/api/v3";
export const DEFAULT_ASSET_IDS = ["bitcoin", "ethereum", "solana"];
export const VS_CURRENCY = "usd";

// RPC Endpoints
export const RPC_URL = `https://base-sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`;

// Alchemy API
export const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY || "";
export const NETWORK = process.env.ALCHEMY_NETWORK || "base-sepolia";
export const ALCHEMY_URL = `https://${NETWORK}.g.alchemy.com/v2/${ALCHEMY_KEY}`;
