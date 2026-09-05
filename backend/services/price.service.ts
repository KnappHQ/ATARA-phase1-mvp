import axios from "axios";
import { ErrorHandler } from "../utils/errorHandler";
import { ALCHEMY_KEY } from "../utils/constants";

/**
 * Server-side USD pricing.
 *
 * Settlement valuation must never use a price supplied by the caller - that
 * turns "how much do I owe" into a number the debtor chooses. It must also
 * never silently fall back to an invented figure: when the price is unknown,
 * the settlement is refused.
 */

const PRICES_URL = "https://api.g.alchemy.com/prices/v1";
const CACHE_TTL_MS = 60_000;

/** Stablecoins are valued at par for settlement purposes. */
const PAR_VALUE_SYMBOLS = new Set(["USDC", "USDT", "USD"]);

type CacheEntry = { price: number; fetchedAt: number };
const cache = new Map<string, CacheEntry>();

const fetchPrice = async (symbol: string): Promise<number> => {
  if (!ALCHEMY_KEY) {
    throw new ErrorHandler(
      "Price feed is not configured. Settlement cannot be valued.",
      503,
    );
  }

  const response = await axios.get(
    `${PRICES_URL}/tokens/by-symbol?symbols=${encodeURIComponent(symbol)}`,
    { headers: { Authorization: `Bearer ${ALCHEMY_KEY}` }, timeout: 8000 },
  );

  const value = response.data?.data?.[0]?.prices?.[0]?.value;
  const price = parseFloat(value);

  if (!Number.isFinite(price) || price <= 0) {
    throw new ErrorHandler(
      `No usable market price available for ${symbol}. Please retry.`,
      503,
    );
  }

  return price;
};

/**
 * Current USD price for a settlement asset.
 * Throws (503) rather than returning a guess when the price is unavailable.
 */
export const getUsdPrice = async (symbol: string): Promise<number> => {
  const normalized = symbol.toUpperCase();

  if (PAR_VALUE_SYMBOLS.has(normalized)) {
    return 1;
  }

  const cached = cache.get(normalized);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.price;
  }

  try {
    const price = await fetchPrice(normalized);
    cache.set(normalized, { price, fetchedAt: Date.now() });
    return price;
  } catch (error) {
    if (error instanceof ErrorHandler) throw error;
    throw new ErrorHandler(
      `Unable to price ${normalized} right now. Please retry.`,
      503,
    );
  }
};
