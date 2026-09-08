import crypto from "node:crypto";
import { isAddress } from "ethers/lib/utils";
import {
  MOONPAY_API_KEY,
  MOONPAY_BASE_CURRENCY_CODE,
  MOONPAY_CURRENCY_CODE,
  MOONPAY_SECRET_KEY,
  MOONPAY_WIDGET_URL,
  ONRAMP_REDIRECT_URL,
  NETWORK,
} from "../utils/constants";
import { ErrorHandler } from "../utils/errorHandler";

export type MoonPaySessionInput = {
  walletAddress: string;
  userId: string;
  email?: string | null;
  baseCurrencyAmount?: string | number | null;
};

const isPositiveAmount = (value: string | number | null | undefined) => {
  if (value === undefined || value === null || value === "") return false;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 && amount <= 10_000;
};

/**
 * Builds a signed MoonPay URL. The complete query string is signed before the
 * signature is appended, so the mobile app never receives the secret key.
 */
export const buildMoonPayWidgetUrl = (input: MoonPaySessionInput): string => {
  if (!isAddress(input.walletAddress)) {
    throw new ErrorHandler("A valid smart account address is required", 400);
  }
  if (!MOONPAY_API_KEY || !MOONPAY_SECRET_KEY) {
    throw new ErrorHandler("The on-ramp is not configured yet", 503);
  }

  const url = new URL(MOONPAY_WIDGET_URL);
  // A beta checkout must never charge real money or imply delivery to Sepolia.
  const allowedHost =
    NETWORK === "base-mainnet" ? "buy.moonpay.com" : "buy-sandbox.moonpay.com";
  if (
    url.protocol !== "https:" ||
    url.hostname !== allowedHost ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new ErrorHandler(
      "The on-ramp URL does not match the configured network",
      503,
    );
  }
  const params: Array<[string, string]> = [
    ["apiKey", MOONPAY_API_KEY],
    ["currencyCode", MOONPAY_CURRENCY_CODE],
    ["baseCurrencyCode", MOONPAY_BASE_CURRENCY_CODE],
    ["walletAddress", input.walletAddress],
    ["theme", "dark"],
    ["externalCustomerId", input.userId],
  ];

  if (input.email) params.push(["email", input.email]);
  if (isPositiveAmount(input.baseCurrencyAmount)) {
    params.push(["baseCurrencyAmount", String(input.baseCurrencyAmount)]);
    params.push(["lockAmount", "true"]);
  }
  if (ONRAMP_REDIRECT_URL) params.push(["redirectURL", ONRAMP_REDIRECT_URL]);

  // URLSearchParams applies URL encoding to each value. MoonPay signs the
  // leading '?' and the encoded query, then expects a URL-encoded base64 sig.
  url.search = new URLSearchParams(params).toString();
  const signature = crypto
    .createHmac("sha256", MOONPAY_SECRET_KEY)
    .update(url.search)
    .digest("base64");

  return `${url.toString()}&signature=${encodeURIComponent(signature)}`;
};

export const createMoonPaySession = (input: MoonPaySessionInput) => ({
  provider: "moonpay",
  network: NETWORK === "base-mainnet" ? "base-mainnet" : "sandbox",
  mode: NETWORK === "base-mainnet" ? "live" : "sandbox",
  currencyCode: MOONPAY_CURRENCY_CODE,
  walletAddress: input.walletAddress,
  url: buildMoonPayWidgetUrl(input),
});
