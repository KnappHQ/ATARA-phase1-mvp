/**
 * Is MoonPay configured the way the code needs it, and if not, exactly how not?
 *
 * "signature check failed" is MoonPay's page rejecting a signed URL. From the
 * outside it looks the same whether the cause is a missing variable, the
 * publishable key pasted where the secret belongs, a live key in a sandbox
 * environment, quotes copied from a dashboard, or a mismatch only MoonPay can
 * see. This tells those apart without ever holding a secret in its output: it
 * reports only whether each variable is present, how long it is, which KIND of
 * key it looks like (a public prefix such as "sk_test_"), and fixed problem
 * codes. A value never appears, not even partly.
 *
 * What it cannot prove: that the secret and the publishable key belong to the
 * same MoonPay account. Only MoonPay can say that.
 */

export type KeyKind = "empty" | "pk_test" | "pk_live" | "sk_test" | "sk_live" | "webhook" | "other";

export type MoonPayProblem =
  | "api-key-missing"
  | "secret-missing"
  | "api-key-wrapped"
  | "secret-wrapped"
  | "api-key-inner-space"
  | "secret-inner-space"
  | "api-key-prefix"
  | "api-key-environment"
  | "secret-prefix"
  | "secret-environment"
  | "secret-is-publishable-key"
  | "secret-is-webhook-key"
  | "keys-identical"
  | "widget-url-invalid"
  | "widget-host";

/**
 * Worth knowing, never blocking: the server handles each one (it trims whitespace)
 * or the code before this accepted it and MoonPay may too.
 */
export type MoonPayWarning =
  | "api-key-edge-whitespace"
  | "secret-edge-whitespace"
  | "widget-url-has-query"
  | "redirect-not-https"
  | "currency-format";

export interface MoonPayConfigInput {
  apiKey?: string;
  secretKey?: string;
  widgetUrl?: string;
  redirectUrl?: string;
  currencyCode?: string;
  baseCurrencyCode?: string;
  /** ALCHEMY_NETWORK: "base-mainnet" means live; anything else is sandbox. */
  network: string;
}

export interface KeyReport {
  present: boolean;
  length: number;
  kind: KeyKind;
}

export interface MoonPayConfigReport {
  mode: "sandbox" | "live";
  apiKey: KeyReport;
  secretKey: KeyReport;
  widgetHost: string | null;
  redirectConfigured: boolean;
  problems: MoonPayProblem[];
  warnings: MoonPayWarning[];
  ok: boolean;
}

export const keyKind = (value: string): KeyKind => {
  if (!value) return "empty";
  if (value.startsWith("pk_test_")) return "pk_test";
  if (value.startsWith("pk_live_")) return "pk_live";
  if (value.startsWith("sk_test_")) return "sk_test";
  if (value.startsWith("sk_live_")) return "sk_live";
  if (value.startsWith("wk_")) return "webhook";
  return "other";
};

const WRAPPED = /^(["'`]).*\1$|^["'`]|["'`]$/;
const INNER_SPACE = /\s/;
const allowedHost = (mode: "sandbox" | "live") => (mode === "live" ? "buy.moonpay.com" : "buy-sandbox.moonpay.com");

export const inspectMoonPayConfig = (input: MoonPayConfigInput): MoonPayConfigReport => {
  const mode = input.network === "base-mainnet" ? "live" : "sandbox";
  const rawApi = input.apiKey ?? "";
  const rawSecret = input.secretKey ?? "";
  const api = rawApi.trim();
  const secret = rawSecret.trim();
  const problems: MoonPayProblem[] = [];
  const warnings: MoonPayWarning[] = [];

  if (!api) problems.push("api-key-missing");
  if (!secret) problems.push("secret-missing");

  if (api) {
    if (WRAPPED.test(api)) problems.push("api-key-wrapped");
    if (INNER_SPACE.test(api)) problems.push("api-key-inner-space");
    if (rawApi !== api) warnings.push("api-key-edge-whitespace");
    const kind = keyKind(api);
    if (kind !== (mode === "live" ? "pk_live" : "pk_test") && !problems.includes("api-key-wrapped")) {
      problems.push(kind === "pk_test" || kind === "pk_live" ? "api-key-environment" : "api-key-prefix");
    }
  }
  if (secret) {
    if (WRAPPED.test(secret)) problems.push("secret-wrapped");
    if (INNER_SPACE.test(secret)) problems.push("secret-inner-space");
    if (rawSecret !== secret) warnings.push("secret-edge-whitespace");
    const kind = keyKind(secret);
    if (kind !== (mode === "live" ? "sk_live" : "sk_test") && !problems.includes("secret-wrapped")) {
      if (kind === "pk_test" || kind === "pk_live") problems.push("secret-is-publishable-key");
      else if (kind === "webhook") problems.push("secret-is-webhook-key");
      else problems.push(kind === "sk_test" || kind === "sk_live" ? "secret-environment" : "secret-prefix");
    }
  }
  if (api && secret && api === secret) problems.push("keys-identical");

  let widgetHost: string | null = null;
  const widget = (input.widgetUrl ?? "").trim();
  if (widget) {
    try {
      const url = new URL(widget);
      widgetHost = url.hostname;
      if (url.protocol !== "https:" || url.username || url.password || url.port) problems.push("widget-url-invalid");
      else if (url.hostname !== allowedHost(mode)) problems.push("widget-host");
      if (url.search) warnings.push("widget-url-has-query");
    } catch {
      problems.push("widget-url-invalid");
    }
  }

  const redirect = (input.redirectUrl ?? "").trim();
  if (redirect && !/^https:\/\//i.test(redirect)) warnings.push("redirect-not-https");

  for (const code of [input.currencyCode, input.baseCurrencyCode]) {
    if (code !== undefined && !/^[a-z0-9_]{2,32}$/i.test(code.trim())) {
      if (!warnings.includes("currency-format")) warnings.push("currency-format");
    }
  }

  return {
    mode,
    apiKey: { present: !!api, length: api.length, kind: keyKind(api) },
    secretKey: { present: !!secret, length: secret.length, kind: keyKind(secret) },
    widgetHost,
    redirectConfigured: !!redirect,
    problems,
    warnings,
    ok: problems.length === 0,
  };
};

/** The code the app can show for the first blocking problem, e.g. "MP-SECRET-PREFIX". */
export const problemCode = (problem: MoonPayProblem): string => `MP-${problem.toUpperCase()}`;

/** What to do about each problem. Fixed text: no value is ever interpolated. */
export const PROBLEM_FIXES: Record<MoonPayProblem, string> = {
  "api-key-missing": "Set MOONPAY_API_KEY (the publishable key) on the backend.",
  "secret-missing": "Set MOONPAY_SECRET_KEY (the secret key) on the backend.",
  "api-key-wrapped": "MOONPAY_API_KEY starts or ends with a quote mark. Paste the bare key, without quotes.",
  "secret-wrapped": "MOONPAY_SECRET_KEY starts or ends with a quote mark. Paste the bare key, without quotes.",
  "api-key-inner-space": "MOONPAY_API_KEY contains a space or a line break inside it. Paste it again as one line.",
  "secret-inner-space": "MOONPAY_SECRET_KEY contains a space or a line break inside it. Paste it again as one line.",
  "api-key-prefix": "MOONPAY_API_KEY is not a publishable key (it should start with pk_test_ in sandbox, pk_live_ in live).",
  "api-key-environment": "MOONPAY_API_KEY is a publishable key of the other environment than ALCHEMY_NETWORK selects.",
  "secret-prefix": "MOONPAY_SECRET_KEY is not a secret key (it should start with sk_test_ in sandbox, sk_live_ in live).",
  "secret-environment": "MOONPAY_SECRET_KEY is a secret key of the other environment than ALCHEMY_NETWORK selects.",
  "secret-is-publishable-key": "MOONPAY_SECRET_KEY holds the publishable key (pk_...). Put the secret key (sk_...) there.",
  "secret-is-webhook-key": "MOONPAY_SECRET_KEY holds the webhook key (wk_...). Put the secret key (sk_...) there.",
  "keys-identical": "MOONPAY_API_KEY and MOONPAY_SECRET_KEY hold the same value.",
  "widget-url-invalid": "MOONPAY_WIDGET_URL must be a plain https URL without credentials or port.",
  "widget-host": "MOONPAY_WIDGET_URL points at the other environment than ALCHEMY_NETWORK selects.",
};

export const WARNING_FIXES: Record<MoonPayWarning, string> = {
  "api-key-edge-whitespace": "MOONPAY_API_KEY has whitespace or a line break around it. The server trims it; clean it up anyway.",
  "secret-edge-whitespace": "MOONPAY_SECRET_KEY has whitespace or a line break around it. The server trims it; clean it up anyway.",
  "widget-url-has-query": "MOONPAY_WIDGET_URL carries a query string. The server replaces it; remove it.",
  "redirect-not-https": "ONRAMP_REDIRECT_URL is not an https URL. MoonPay documents https or a Universal Link; it may refuse anything else.",
  "currency-format": "MOONPAY_CURRENCY_CODE or MOONPAY_BASE_CURRENCY_CODE has an unexpected format (MoonPay codes look like usdc_base and eur).",
};

/** The raw environment, untrimmed, so copy-paste whitespace can be reported. */
export const readMoonPayEnv = (env: NodeJS.ProcessEnv = process.env): MoonPayConfigInput => ({
  apiKey: env.MOONPAY_API_KEY,
  secretKey: env.MOONPAY_SECRET_KEY,
  widgetUrl: env.MOONPAY_WIDGET_URL ?? "https://buy-sandbox.moonpay.com/",
  redirectUrl: env.ONRAMP_REDIRECT_URL,
  currencyCode: env.MOONPAY_CURRENCY_CODE ?? "usdc_base",
  baseCurrencyCode: env.MOONPAY_BASE_CURRENCY_CODE ?? "eur",
  network: env.ALCHEMY_NETWORK || "base-sepolia",
});
