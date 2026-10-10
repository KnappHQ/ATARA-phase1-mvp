/**
 * What the wallet is worth, and how sure we are.
 *
 * A token amount is a fact read from the chain. Its USD value is a claim that
 * needs a price. When no price could be read, the value is UNKNOWN: it is not
 * a made-up number, and it is not zero. A price kept from an earlier read
 * says so, with its date. Nothing here ever invents a quote.
 */
export type PriceStatus =
  /** Read from the price provider just now. */
  | "live"
  /** The provider failed; this is the last real price, kept with its date. */
  | "stale"
  /** Stablecoin, no real quote: valued at $1 as an estimate, never as a quote. */
  | "pegged_estimate"
  /** No price at all: the amount is known, the USD value is not. */
  | "unavailable";

export interface PriceQuote {
  price: number | null;
  status: PriceStatus;
  /** ISO time of the real quote behind `price`; null when there is none. */
  asOf: string | null;
}

/** A kept price older than this is not shown as a price any more. */
export const MAX_STALE_PRICE_AGE_MS = 24 * 60 * 60 * 1000;

const STABLECOINS = new Set(["USDC", "USDT"]);

interface KeptPrice {
  price: number;
  at: number;
}

const lastGood = new Map<string, KeptPrice>();

/** Test hook: forget every kept price. */
export const resetPriceMemory = () => lastGood.clear();

const isPrice = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/**
 * Turn what the provider answered (`fresh`, null when it failed or sent nothing
 * usable) into a quote. Pure apart from the small last-good-price memory.
 */
export function resolveQuote(
  symbol: string,
  fresh: number | null,
  now: number = Date.now(),
): PriceQuote {
  if (isPrice(fresh)) {
    lastGood.set(symbol, { price: fresh, at: now });
    return { price: fresh, status: "live", asOf: new Date(now).toISOString() };
  }
  const kept = lastGood.get(symbol);
  if (kept && now - kept.at <= MAX_STALE_PRICE_AGE_MS) {
    return { price: kept.price, status: "stale", asOf: new Date(kept.at).toISOString() };
  }
  if (STABLECOINS.has(symbol)) return { price: 1, status: "pegged_estimate", asOf: null };
  return { price: null, status: "unavailable", asOf: null };
}

export interface HoldingInput {
  symbol: string;
  name: string;
  /** Amount held, in token units. */
  amount: number;
  displayDecimals: number;
  decimals: number;
  contractAddress?: string;
  quote: PriceQuote;
  /** Price about 24 hours ago from the provider; null when it could not be read. */
  price24hAgo: number | null;
}

export interface PortfolioToken {
  symbol: string;
  name: string;
  balance: string;
  /** Legacy number for older app builds. 0 when `priceStatus` is "unavailable". */
  usdValue: number;
  /** Legacy number for older app builds. 0 when `priceStatus` is "unavailable". */
  usdPrice: number;
  change24h: number;
  percentChange24h: number;
  decimals: number;
  contractAddress?: string;
  priceStatus: PriceStatus;
  priceAsOf: string | null;
  /** False when the 24 h figures are not real (no old price, or no price now). */
  change24hKnown: boolean;
}

export interface PortfolioValuation {
  /** True when every token that is held has a USD value. */
  complete: boolean;
  /** Held tokens whose USD value is unknown; the total leaves them out. */
  unpricedSymbols: string[];
  /** Held tokens valued with a kept (old) price. */
  staleSymbols: string[];
  /** Held tokens valued with a $1 stablecoin estimate rather than a quote. */
  estimatedSymbols: string[];
  /** Oldest real quote behind the total, ISO; null when all are live. */
  oldestPriceAsOf: string | null;
  /** True when the 24 h change covers every held token. */
  change24hKnown: boolean;
}

export interface Portfolio {
  /** Sum of the values that are known. Check `valuation.complete` before saying "total". */
  totalUSD: number;
  change24h: number;
  percentChange24h: number;
  tokens: PortfolioToken[];
  valuation: PortfolioValuation;
}

export function buildPortfolio(holdings: HoldingInput[]): Portfolio {
  let total = 0;
  const unpriced: string[] = [];
  const stale: string[] = [];
  const estimated: string[] = [];
  let oldest: string | null = null;

  const tokens = holdings.map((h): PortfolioToken => {
    const { price, status, asOf } = h.quote;
    const value = price === null ? 0 : h.amount * price;
    // A 24 h change needs a real price now and one from 24 h ago. A stablecoin
    // estimate has no real "now", so it shows no change rather than a flat 0%.
    const hasChange = price !== null && status !== "pegged_estimate" && isPrice(h.price24hAgo);
    const before = hasChange ? h.amount * (h.price24hAgo as number) : 0;

    if (h.amount > 0) {
      if (price === null) unpriced.push(h.symbol);
      else total += value;
      if (status === "stale") stale.push(h.symbol);
      if (status === "pegged_estimate") estimated.push(h.symbol);
      if (asOf && (oldest === null || asOf < oldest)) oldest = asOf;
    }

    return {
      symbol: h.symbol,
      name: h.name,
      balance: h.amount.toFixed(h.displayDecimals),
      usdValue: value,
      usdPrice: price ?? 0,
      change24h: hasChange ? value - before : 0,
      percentChange24h: hasChange
        ? (((price as number) - (h.price24hAgo as number)) / (h.price24hAgo as number)) * 100
        : 0,
      decimals: h.decimals,
      contractAddress: h.contractAddress,
      priceStatus: status,
      priceAsOf: asOf,
      change24hKnown: hasChange,
    };
  });

  // The total change is only reported when every held token has a real one.
  // A wallet of stablecoin estimates reports none, not "0%".
  const held = tokens.filter((t) => Number(t.balance) > 0);
  const changeKnown = held.length > 0 && held.every((t) => t.change24hKnown);
  const change = changeKnown ? held.reduce((sum, t) => sum + t.change24h, 0) : 0;
  const before = total - change;

  return {
    totalUSD: parseFloat(total.toFixed(2)),
    change24h: parseFloat(change.toFixed(2)),
    percentChange24h: changeKnown && before > 0 ? parseFloat(((change / before) * 100).toFixed(2)) : 0,
    tokens,
    valuation: {
      complete: unpriced.length === 0,
      unpricedSymbols: unpriced,
      staleSymbols: stale,
      estimatedSymbols: estimated,
      oldestPriceAsOf: oldest,
      change24hKnown: changeKnown,
    },
  };
}
