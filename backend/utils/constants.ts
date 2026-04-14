// Server Configuration
export const PORT = Number(process.env.PORT || 4000);
export const NODE_ENV = process.env.NODE_ENV || "development";
export const DB_CONNECTION_STRING = process.env.DATABASE_URL || "";

export const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

//auth constants
export const JWT_SECRET = process.env.JWT_SECRET || "";
export const JWT_EXPIRES_IN = "7d";
export const SALT_ROUNDS = 5;

// CoinGecko API Constants
export const DEFAULT_ASSET_IDS = ["bitcoin", "ethereum", "solana"];
export const VS_CURRENCY = "usd";

// SMTP / Email
export const SMTP_HOST = process.env.SMTP_HOST || "";
export const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
export const SMTP_SECURE = process.env.SMTP_SECURE === "true";
export const SMTP_USER = process.env.SMTP_USER || "";
export const SMTP_PASS = process.env.SMTP_PASS || "";
export const FEEDBACK_RECIPIENT_EMAIL =
  process.env.FEEDBACK_RECIPIENT_EMAIL || "";

// Transaction Categories
export const TRANSACTION_CATEGORIES = [
  "drinks",
  "food",
  "shopping",
  "transfer",
  "other",
] as const;
export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];
export const DEFAULT_CATEGORY: TransactionCategory = "transfer";

// Alchemy API
export const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY || "";
export const NETWORK = process.env.ALCHEMY_NETWORK || "base-sepolia";
export const ALCHEMY_URL = `https://${NETWORK}.g.alchemy.com/v2/${ALCHEMY_KEY}`;
