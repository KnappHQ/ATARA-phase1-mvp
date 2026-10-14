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
import { canonicalizeIp, ipFamily, isPublicIp, type IpFamily } from "../utils/clientIp";

/**
 * Only what MoonPay needs to deliver the purchase: the address to send it to.
 * Our account id and the user's email used to ride along in the URL. Nothing
 * reads them back (there is no MoonPay webhook), and MoonPay collects its own
 * identity details during checkout, from the user, with their consent.
 */
export type MoonPaySessionInput = {
  walletAddress: string;
  baseCurrencyAmount?: string | number | null;
  /**
   * The customer's public IP addresses observed by the backend on THIS request,
   * at most one per family (IPv4, IPv6). Each is hashed into `allowedIpAddress`
   * so the URL only loads on that connection. Never a value sent by the app.
   */
  clientIps?: string[];
};

const isPositiveAmount = (value: string | number | null | undefined) => {
  if (value === undefined || value === null || value === "") return false;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 && amount <= 10_000;
};

export const signMoonPayQuery = (query: string, secretKey: string): string =>
  crypto.createHmac("sha256", secretKey).update(query).digest("base64");

/** HMAC-SHA256 of the canonical IP with the secret key, base64: MoonPay's IP-matching hash. */
export const hashMoonPayIp = (canonicalIp: string, secretKey: string): string =>
  crypto.createHmac("sha256", secretKey).update(canonicalIp).digest("base64");

/**
 * The `allowedIpAddress` value: one hash per IP family actually observed, at most
 * two, comma-separated. Refuses anything else rather than sending a value MoonPay
 * would reject (more than two hashes, or two of the same family, fail validation).
 */
export const buildAllowedIpAddress = (
  clientIps: string[],
  secretKey: string,
): { value: string; families: IpFamily[] } => {
  const seen = new Map<IpFamily, string>();
  for (const raw of clientIps) {
    const ip = canonicalizeIp(raw);
    if (!ip || !isPublicIp(ip)) throw new ErrorHandler("Your connection could not be verified", 503, "MP-IP-UNAVAILABLE");
    const family = ipFamily(ip);
    const already = seen.get(family);
    if (already && already !== ip) throw new ErrorHandler("Your connection could not be verified", 503, "MP-IP-AMBIGUOUS");
    seen.set(family, ip);
  }
  if (seen.size === 0) throw new ErrorHandler("Your connection could not be verified", 503, "MP-IP-UNAVAILABLE");
  const families = [...seen.keys()].sort();
  return { value: families.map((family) => hashMoonPayIp(seen.get(family) as string, secretKey)).join(","), families };
};

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

  // IP matching: added BEFORE signing, so the hash is part of the signed query.
  // Omitted only when the caller observed no IP (tests, diagnostics): a session
  // for a customer always carries it (see createMoonPaySession).
  let ipFamilies: IpFamily[] = [];
  if (input.clientIps && input.clientIps.length > 0) {
    const allowed = buildAllowedIpAddress(input.clientIps, MOONPAY_SECRET_KEY);
    params.push(["allowedIpAddress", allowed.value]);
    ipFamilies = allowed.families;
  }

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
    // How many IP hashes and of which family; never the address or the hash.
    ipHashes: ipFamilies.length,
    ipFamilies,
    warnings: report.warnings,
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

/**
 * A session for a customer: always bound to the IP observed on this request.
 * MoonPay allows omitting `allowedIpAddress` only for a session where iCloud
 * Private Relay was detected in a Safari-based view; the app opens the widget in
 * a WebView (WKWebView), which Private Relay does not route, so it is never omitted.
 */
export const createMoonPaySession = (input: MoonPaySessionInput) => {
  if (!input.clientIps || input.clientIps.length === 0) {
    throw new ErrorHandler("Your connection could not be verified", 503, "MP-IP-UNAVAILABLE");
  }
  return createSession(input);
};

const createSession = (input: MoonPaySessionInput) => ({
  provider: "moonpay",
  network: NETWORK === "base-mainnet" ? "base-mainnet" : "sandbox",
  mode: NETWORK === "base-mainnet" ? "live" : "sandbox",
  currencyCode: MOONPAY_CURRENCY_CODE,
  walletAddress: input.walletAddress,
  url: buildMoonPayWidgetUrl(input),
});
