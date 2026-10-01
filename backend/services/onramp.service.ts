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
import { logError, logInfo } from "../utils/logger";
import { inspectMoonPayConfig, problemCode } from "../utils/moonpayConfig";

/**
 * Only what MoonPay needs to deliver the purchase: the address to send it to.
 * Our account id and the user's email used to ride along in the URL. Nothing
 * reads them back (there is no MoonPay webhook), and MoonPay collects its own
 * identity details during checkout, from the user, with their consent.
 */
export type MoonPaySessionInput = {
  walletAddress: string;
  baseCurrencyAmount?: string | number | null;
};

const isPositiveAmount = (value: string | number | null | undefined) => {
  if (value === undefined || value === null || value === "") return false;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 && amount <= 10_000;
};

export const signMoonPayQuery = (query: string, secretKey: string): string =>
  crypto.createHmac("sha256", secretKey).update(query).digest("base64");

/**
 * Builds a signed MoonPay URL. The complete query string is signed before the
 * signature is appended, so the mobile app never receives the secret key.
 */
export const buildMoonPayWidgetUrl = (input: MoonPaySessionInput): string => {
  if (!isAddress(input.walletAddress)) {
    throw new ErrorHandler("A valid smart account address is required", 400);
  }
  // Every way the configuration can be wrong is named, with a fixed code the app
  // and the logs can show. Nothing about a key's value is ever reported.
  const report = inspectMoonPayConfig({
    apiKey: MOONPAY_API_KEY,
    secretKey: MOONPAY_SECRET_KEY,
    widgetUrl: MOONPAY_WIDGET_URL,
    redirectUrl: ONRAMP_REDIRECT_URL,
    currencyCode: MOONPAY_CURRENCY_CODE,
    baseCurrencyCode: MOONPAY_BASE_CURRENCY_CODE,
    network: NETWORK,
  });
  if (!report.ok) {
    logError("moonpay-config-invalid", new Error(report.problems.join(",")), { report });
    const first = report.problems[0];
    const code = problemCode(first);
    if (first === "api-key-missing" || first === "secret-missing") {
      throw new ErrorHandler("The on-ramp is not configured yet", 503, code);
    }
    if (first === "widget-url-invalid" || first === "widget-host") {
      throw new ErrorHandler("The on-ramp URL does not match the configured network", 503, code);
    }
    if (first === "redirect-not-https" || first === "currency-format") {
      throw new ErrorHandler("The on-ramp is not configured correctly", 503, code);
    }
    throw new ErrorHandler(`MoonPay keys do not match the configured ${report.mode} environment`, 503, code);
  }

  const url = new URL(MOONPAY_WIDGET_URL);
  const params: Array<[string, string]> = [
    ["apiKey", MOONPAY_API_KEY],
    ["currencyCode", MOONPAY_CURRENCY_CODE],
    ["baseCurrencyCode", MOONPAY_BASE_CURRENCY_CODE],
    ["walletAddress", input.walletAddress],
    ["theme", "dark"],
  ];

  if (isPositiveAmount(input.baseCurrencyAmount)) {
    params.push(["baseCurrencyAmount", String(input.baseCurrencyAmount)]);
    params.push(["lockAmount", "true"]);
  }
  if (ONRAMP_REDIRECT_URL) params.push(["redirectURL", ONRAMP_REDIRECT_URL]);

  // URLSearchParams applies URL encoding to each value. MoonPay signs the
  // leading '?' and the encoded query, then expects a URL-encoded base64 sig.
  url.search = new URLSearchParams(params).toString();
  const signature = signMoonPayQuery(url.search, MOONPAY_SECRET_KEY);
  const signed = `${url.toString()}&signature=${encodeURIComponent(signature)}`;

  // One line per session, with what a diagnosis needs and no secret: if MoonPay
  // later rejects this URL, the log shows the backend did produce one, for which
  // environment, with which kinds of keys.
  logInfo("moonpay-session-created", {
    mode: report.mode,
    widgetHost: report.widgetHost,
    redirectConfigured: report.redirectConfigured,
    apiKeyKind: report.apiKey.kind,
    secretKeyKind: report.secretKey.kind,
    apiKeyLength: report.apiKey.length,
    secretKeyLength: report.secretKey.length,
    queryParams: params.map(([name]) => name),
  });
  return signed;
};

/**
 * Recomputes the signature of a finished URL the way MoonPay does: the raw query
 * string, from the leading "?" up to the final "&signature=", signed with the
 * secret and compared with the URL-decoded signature. A URL that fails this was
 * altered after signing, or signed over something other than what it carries.
 */
export const verifyMoonPayUrl = (signedUrl: string, secretKey: string): boolean => {
  const marker = "&signature=";
  const at = signedUrl.lastIndexOf(marker);
  const queryStart = signedUrl.indexOf("?");
  if (at < 0 || queryStart < 0 || queryStart > at) return false;
  let given: string;
  try {
    given = decodeURIComponent(signedUrl.slice(at + marker.length));
  } catch {
    return false;
  }
  const expected = signMoonPayQuery(signedUrl.slice(queryStart, at), secretKey);
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
};

export const createMoonPaySession = (input: MoonPaySessionInput) => ({
  provider: "moonpay",
  network: NETWORK === "base-mainnet" ? "base-mainnet" : "sandbox",
  mode: NETWORK === "base-mainnet" ? "live" : "sandbox",
  currencyCode: MOONPAY_CURRENCY_CODE,
  walletAddress: input.walletAddress,
  url: buildMoonPayWidgetUrl(input),
});
