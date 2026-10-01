import crypto from "crypto";
import { NODE_ENV } from "../../utils/constants";

/**
 * What the card integration must provide, whichever company issues the card.
 *
 * ATARA does not talk to the card issuer from this file. The interface is the
 * contract a real integration (Rain) fills in; `sandbox` fills it with a
 * deterministic stand-in so the whole path (webhook, signature, idempotence,
 * miles, screens) can be built and tested before any contract exists.
 *
 * NOTHING HERE IS RAIN'S API. Its endpoints, payloads and signature scheme were
 * not available to read while this was written, and none were guessed: the
 * `rain` entry reports itself as not configured until someone implements it from
 * Rain's own documentation. See docs/MONETIZATION_AND_CARD_PLAN.md.
 */

export type CardState = "unavailable" | "not_applied" | "pending" | "active" | "frozen";

export interface CardStatus {
  state: CardState;
  /** Apple Wallet provisioning is possible: the card exists and the issuer supports it. */
  canAddToWallet: boolean;
  last4?: string;
}

/** A card event reduced to what ATARA acts on. No card number, no merchant detail. */
export type NormalizedCardEvent =
  | { eventId: string; type: "purchase"; userRef: string; purchaseId: string; amountUsdCents: number }
  | { eventId: string; type: "refund"; userRef: string; purchaseId: string }
  | { eventId: string; type: "other"; userRef?: string };

export interface CardProvider {
  readonly name: string;
  /** True only when everything needed to serve real traffic is configured. */
  configured(): boolean;
  /** Checks the signature over the RAW body. Never parses first. */
  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean;
  /** Reads a verified body. Null when it is not something ATARA understands. */
  parseEvent(body: unknown): NormalizedCardEvent | null;
  status(userId: string): Promise<CardStatus>;
}

const MAX_PURCHASE_USD_CENTS = 100_000_00; // $100,000: a sanity ceiling, not a spending limit

const headerValue = (headers: Record<string, string | string[] | undefined>, name: string): string | undefined => {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
};

export const hmacHex = (secret: string, body: Buffer): string =>
  crypto.createHmac("sha256", secret).update(body).digest("hex");

/** Constant-time comparison of two hex strings of any length. */
export const safeEqualHex = (a: string, b: string): boolean => {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

const parseIntegerCents = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value > 0 && value <= MAX_PURCHASE_USD_CENTS ? value : null;

/** ATARA's own event shape, used by the sandbox and by tests. */
export const parseAtaraEvent = (body: unknown): NormalizedCardEvent | null => {
  if (!body || typeof body !== "object") return null;
  const event = body as Record<string, unknown>;
  const eventId = typeof event.eventId === "string" && event.eventId.length > 0 && event.eventId.length <= 128 ? event.eventId : null;
  if (!eventId) return null;
  const userRef = typeof event.userRef === "string" && event.userRef.length > 0 && event.userRef.length <= 128 ? event.userRef : undefined;
  const purchaseId = typeof event.purchaseId === "string" && event.purchaseId.length > 0 && event.purchaseId.length <= 128 ? event.purchaseId : null;

  if (event.type === "purchase") {
    const amount = parseIntegerCents(event.amountUsdCents);
    if (!userRef || !purchaseId || amount === null) return null;
    return { eventId, type: "purchase", userRef, purchaseId, amountUsdCents: amount };
  }
  if (event.type === "refund") {
    if (!userRef || !purchaseId) return null;
    return { eventId, type: "refund", userRef, purchaseId };
  }
  return { eventId, type: "other", ...(userRef ? { userRef } : {}) };
};

const unavailableStatus: CardStatus = { state: "unavailable", canAddToWallet: false };

/** The default: no card, every webhook refused. */
const unavailable: CardProvider = {
  name: "unavailable",
  configured: () => false,
  verifyWebhook: () => false,
  parseEvent: () => null,
  status: async () => unavailableStatus,
};

/** Stand-in for tests and demos. Refused in production. */
const sandbox = (secret: string | undefined): CardProvider => ({
  name: "sandbox",
  configured: () => NODE_ENV !== "production" && !!secret,
  verifyWebhook: (rawBody, headers) => {
    if (NODE_ENV === "production" || !secret) return false;
    const signature = headerValue(headers, "x-atara-signature");
    return !!signature && safeEqualHex(signature, hmacHex(secret, rawBody));
  },
  parseEvent: parseAtaraEvent,
  status: async () => ({ state: "not_applied", canAddToWallet: false }),
});

/**
 * Rain, once it is implemented from Rain's documentation. Until then it is
 * deliberately unusable: it refuses every webhook and reports no card, rather
 * than guessing a signature scheme and accepting forged events.
 */
const rain: CardProvider = {
  name: "rain",
  configured: () => false,
  verifyWebhook: () => false,
  parseEvent: () => null,
  status: async () => unavailableStatus,
};

export const getCardProvider = (): CardProvider => {
  switch ((process.env.CARD_PROVIDER || "").toLowerCase()) {
    case "sandbox":
      return sandbox(process.env.CARD_WEBHOOK_SECRET);
    case "rain":
      return rain;
    default:
      return unavailable;
  }
};
