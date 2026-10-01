const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.NODE_ENV = "test";
require("ts-node/register");

const { inspectMoonPayConfig, readMoonPayEnv, problemCode, PROBLEM_FIXES, keyKind } = require("../utils/moonpayConfig.ts");
const { errorMiddleware } = require("../middleware/error.middleware.ts");
const { ErrorHandler } = require("../utils/errorHandler.ts");

const API = "pk_test_AbCdEfGhIjKlMnOpQrStUvWxYz012345";
const SECRET = "sk_test_ZyXwVuTsRqPoNmLkJiHgFeDcBa987654";
const WALLET = "0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae";
const base = { apiKey: API, secretKey: SECRET, widgetUrl: "https://buy-sandbox.moonpay.com/", currencyCode: "usdc_base", baseCurrencyCode: "eur", network: "base-sepolia" };

/** The service reads its configuration at import time, so each scenario gets a fresh copy. */
const freshService = (env) => {
  const saved = { ...process.env };
  for (const key of ["MOONPAY_API_KEY", "MOONPAY_SECRET_KEY", "MOONPAY_WIDGET_URL", "MOONPAY_CURRENCY_CODE", "MOONPAY_BASE_CURRENCY_CODE", "ONRAMP_REDIRECT_URL", "ALCHEMY_NETWORK"]) delete process.env[key];
  Object.assign(process.env, env);
  for (const name of Object.keys(require.cache)) {
    if (/\/(utils\/constants|services\/onramp\.service)\.ts$/.test(name)) delete require.cache[name];
  }
  try {
    return require("../services/onramp.service.ts");
  } finally {
    process.env = saved;
  }
};
const GOOD_ENV = { MOONPAY_API_KEY: API, MOONPAY_SECRET_KEY: SECRET };

const captureStderr = (run) => {
  const original = process.stderr.write.bind(process.stderr);
  let captured = "";
  process.stderr.write = (chunk) => { captured += String(chunk); return true; };
  try { return { result: run(), captured: () => captured }; } finally { process.stderr.write = original; }
};

test("a correct sandbox configuration has no problems", () => {
  const report = inspectMoonPayConfig(base);
  assert.deepEqual(report.problems, []);
  assert.equal(report.ok, true);
  assert.equal(report.mode, "sandbox");
  assert.deepEqual(report.apiKey, { present: true, length: API.length, kind: "pk_test" });
  assert.deepEqual(report.secretKey, { present: true, length: SECRET.length, kind: "sk_test" });
  assert.equal(report.widgetHost, "buy-sandbox.moonpay.com");
});

test("every way the keys can be wrong has its own code", () => {
  const problems = (patch) => inspectMoonPayConfig({ ...base, ...patch }).problems;
  assert.deepEqual(problems({ apiKey: "" }), ["api-key-missing"]);
  assert.deepEqual(problems({ secretKey: undefined }), ["secret-missing"]);
  assert.deepEqual(problems({ apiKey: `"${API}"` }), ["api-key-wrapped"]);
  assert.deepEqual(problems({ secretKey: `'${SECRET}'` }), ["secret-wrapped"]);
  assert.deepEqual(problems({ secretKey: `${SECRET}\nEXTRA` }), ["secret-inner-space"]);
  assert.deepEqual(problems({ apiKey: "publishable" }), ["api-key-prefix"]);
  assert.deepEqual(problems({ apiKey: "pk_live_abcdef" }), ["api-key-environment"]);
  assert.deepEqual(problems({ secretKey: "sk_live_abcdef" }), ["secret-environment"]);
  assert.deepEqual(problems({ secretKey: "pk_test_anotherPublishableKey000000" }), ["secret-is-publishable-key"]);
  assert.deepEqual(problems({ secretKey: API }), ["secret-is-publishable-key", "keys-identical"]);
  assert.deepEqual(problems({ secretKey: "wk_test_abcdef" }), ["secret-is-webhook-key"]);
  assert.deepEqual(problems({ secretKey: "garbage" }), ["secret-prefix"]);
  assert.deepEqual(problems({ apiKey: "sk_test_same", secretKey: "sk_test_same" }), ["api-key-prefix", "keys-identical"]);
});

test("a key pasted with surrounding whitespace is a warning, since the server trims it, never a blocker", () => {
  const report = inspectMoonPayConfig({ ...base, apiKey: `  ${API}\n`, secretKey: `\t${SECRET} ` });
  assert.equal(report.ok, true);
  assert.deepEqual(report.warnings.sort(), ["api-key-edge-whitespace", "secret-edge-whitespace"]);
});

test("the environment is chosen by ALCHEMY_NETWORK, and live needs live keys on the live host", () => {
  const live = inspectMoonPayConfig({ ...base, network: "base-mainnet", apiKey: "pk_live_x", secretKey: "sk_live_y", widgetUrl: "https://buy.moonpay.com/" });
  assert.equal(live.mode, "live");
  assert.deepEqual(live.problems, []);
  assert.deepEqual(inspectMoonPayConfig({ ...base, network: "base-mainnet" }).problems, ["api-key-environment", "secret-environment", "widget-host"]);
});

test("the widget URL, the redirect and the currency codes are checked too", () => {
  const problems = (patch) => inspectMoonPayConfig({ ...base, ...patch }).problems;
  assert.deepEqual(problems({ widgetUrl: "https://evil.example/" }), ["widget-host"]);
  assert.deepEqual(problems({ widgetUrl: "http://buy-sandbox.moonpay.com/" }), ["widget-url-invalid"]);
  assert.deepEqual(problems({ widgetUrl: "https://user:pw@buy-sandbox.moonpay.com/" }), ["widget-url-invalid"]);
  assert.deepEqual(problems({ widgetUrl: "not a url" }), ["widget-url-invalid"]);
  assert.deepEqual(problems({ redirectUrl: "http://atara.finance/done" }), ["redirect-not-https"]);
  assert.deepEqual(problems({ redirectUrl: "atara://done" }), ["redirect-not-https"]);
  assert.deepEqual(problems({ redirectUrl: "https://atara.finance/done" }), []);
  assert.deepEqual(problems({ currencyCode: "USDC Base!" }), ["currency-format"]);
  assert.deepEqual(problems({ redirectUrl: "" }), []);
});

test("the report never holds a key's value, not even a fragment of one", () => {
  const report = inspectMoonPayConfig({ ...base, redirectUrl: "https://atara.finance/done" });
  const dump = JSON.stringify(report);
  for (const secret of [API, SECRET]) {
    const tail = secret.slice("sk_test_".length);
    for (let i = 0; i + 6 <= tail.length; i++) assert.equal(dump.includes(tail.slice(i, i + 6)), false, "a fragment of a key is in the report");
  }
  assert.equal(dump.includes("atara.finance"), false, "the redirect value is not reported, only that one is set");
  for (const fix of Object.values(PROBLEM_FIXES)) assert.equal(/pk_[a-z]+_\w{6,}|sk_[a-z]+_\w{6,}/.test(fix), false);
  assert.equal(problemCode("secret-prefix"), "MP-SECRET-PREFIX");
  assert.equal(keyKind("sk_live_whatever"), "sk_live");
  assert.deepEqual(Object.keys(readMoonPayEnv({})).sort(), ["apiKey", "baseCurrencyCode", "currencyCode", "network", "redirectUrl", "secretKey", "widgetUrl"]);
});

test("the signed URL is exactly what the signature covers: a golden value, derived independently", () => {
  const { buildMoonPayWidgetUrl } = freshService(GOOD_ENV);
  const url = buildMoonPayWidgetUrl({ walletAddress: WALLET, baseCurrencyAmount: "50.00" });
  const query = `?apiKey=${API}&currencyCode=usdc_base&baseCurrencyCode=eur&walletAddress=${WALLET}&theme=dark&baseCurrencyAmount=50.00&lockAmount=true`;
  const signature = crypto.createHmac("sha256", SECRET).update(query).digest("base64");
  assert.equal(url, `https://buy-sandbox.moonpay.com/${query}&signature=${encodeURIComponent(signature)}`);
});

test("random inputs always produce a URL that verifies, that no browser or URL parser would alter, and whose parts read back", () => {
  const { buildMoonPayWidgetUrl, verifyMoonPayUrl } = freshService({ ...GOOD_ENV, ONRAMP_REDIRECT_URL: "https://atara.finance/done?from=moonpay&note=a b+c&q=é\"<>" });
  for (let i = 0; i < 200; i++) {
    const address = `0x${crypto.randomBytes(20).toString("hex")}`;
    const amount = i % 3 === 0 ? undefined : (Math.floor(Math.random() * 999_999) / 100 + 0.01).toFixed(2);
    const url = buildMoonPayWidgetUrl({ walletAddress: address, baseCurrencyAmount: amount });
    assert.equal(verifyMoonPayUrl(url, SECRET), true, url);
    const raw = url.slice(url.indexOf("?"));
    assert.equal(/[\s"'<>`#\u0080-￿]/.test(raw), false, "a character a browser would rewrite is in the URL");
    const parsed = new URL(url);
    assert.equal(parsed.search, raw, "parsing and re-serialising changed the query");
    assert.equal(parsed.toString(), url);
    assert.equal(parsed.searchParams.get("walletAddress"), address);
    assert.equal(parsed.searchParams.get("redirectURL"), "https://atara.finance/done?from=moonpay&note=a b+c&q=é\"<>", "redirect was not encoded exactly once");
    assert.equal(parsed.searchParams.get("signature") !== null, true);
    assert.equal(url.lastIndexOf("&signature="), url.indexOf("&signature="), "exactly one signature");
    assert.equal(url.endsWith(`signature=${encodeURIComponent(parsed.searchParams.get("signature"))}`), true, "signature is the last parameter and encoded once");
  }
});

test("any change after signing breaks verification", () => {
  const { buildMoonPayWidgetUrl, verifyMoonPayUrl } = freshService(GOOD_ENV);
  const url = buildMoonPayWidgetUrl({ walletAddress: WALLET, baseCurrencyAmount: "50.00" });
  assert.equal(verifyMoonPayUrl(url, SECRET), true);
  assert.equal(verifyMoonPayUrl(url.replace("50.00", "5000.00"), SECRET), false);
  assert.equal(verifyMoonPayUrl(url.replace("&signature=", "&externalTransactionId=x&signature="), SECRET), false);
  assert.equal(verifyMoonPayUrl(url.replace("&theme=dark", ""), SECRET), false);
  assert.equal(verifyMoonPayUrl(url.replace(WALLET, WALLET.replace(/b/g, "c")), SECRET), false);
  assert.equal(verifyMoonPayUrl(`${url}&redirectURL=https%3A%2F%2Fevil.example`, SECRET), false);
  assert.equal(verifyMoonPayUrl(url, "sk_test_someOtherSecret"), false);
  assert.equal(verifyMoonPayUrl("https://buy-sandbox.moonpay.com/?a=b", SECRET), false);
  assert.equal(verifyMoonPayUrl("not a url", SECRET), false);
  assert.equal(verifyMoonPayUrl(`${url.slice(0, url.lastIndexOf("=") + 1)}%E0%A4%A`, SECRET), false, "a malformed signature does not throw");
});

test("missing or wrong configuration is refused with a fixed code and no secret in the message or the log", () => {
  const cases = [
    [{}, "The on-ramp is not configured yet", "MP-API-KEY-MISSING"],
    [{ MOONPAY_API_KEY: API }, "The on-ramp is not configured yet", "MP-SECRET-MISSING"],
    [{ MOONPAY_API_KEY: API, MOONPAY_SECRET_KEY: API }, "MoonPay keys do not match the configured sandbox environment", "MP-SECRET-IS-PUBLISHABLE-KEY"],
    [{ MOONPAY_API_KEY: "pk_live_AbCdEfGhIjKlMnOpQrStUvWxYz012345", MOONPAY_SECRET_KEY: SECRET }, "MoonPay keys do not match the configured sandbox environment", "MP-API-KEY-ENVIRONMENT"],
    [{ ...GOOD_ENV, MOONPAY_WIDGET_URL: "https://buy.moonpay.com/" }, "The on-ramp URL does not match the configured network", "MP-WIDGET-HOST"],
    [{ ...GOOD_ENV, ONRAMP_REDIRECT_URL: "http://atara.finance/x" }, "The on-ramp is not configured correctly", "MP-REDIRECT-NOT-HTTPS"],
  ];
  for (const [env, message, code] of cases) {
    const { buildMoonPayWidgetUrl } = freshService(env);
    const { result, captured } = captureStderr(() => {
      try { buildMoonPayWidgetUrl({ walletAddress: WALLET }); return null; } catch (error) { return error; }
    });
    assert.ok(result instanceof ErrorHandler, code);
    assert.equal(result.statusCode, 503);
    assert.equal(result.message, message, code);
    assert.equal(result.code, code);
    const logged = captured();
    for (const secret of [API, SECRET]) assert.equal(logged.includes(secret.slice(8)) || result.message.includes(secret.slice(8)), false, `a key leaked for ${code}`);
    assert.match(logged, /moonpay-config-invalid/);
  }
});

test("the code reaches the app in the JSON error, and nothing else about the configuration does", () => {
  let sent;
  const res = { status(code) { this.code = code; return this; }, json(body) { sent = { status: this.code, body }; } };
  errorMiddleware(new ErrorHandler("MoonPay keys do not match the configured sandbox environment", 503, "MP-SECRET-PREFIX"), { method: "POST", path: "/x" }, res, () => {});
  assert.equal(sent.status, 503);
  assert.equal(sent.body.code, "MP-SECRET-PREFIX");
  errorMiddleware(new ErrorHandler("Forbidden", 403), { method: "GET", path: "/x" }, res, () => {});
  assert.equal("code" in sent.body, false, "an error without a code adds no code key");
});

test("a created session is logged with what a diagnosis needs and no key", () => {
  const { buildMoonPayWidgetUrl } = freshService(GOOD_ENV);
  const { captured } = captureStderr(() => buildMoonPayWidgetUrl({ walletAddress: WALLET, baseCurrencyAmount: "10" }));
  const line = JSON.parse(captured().trim().split("\n").pop());
  assert.equal(line.context, "moonpay-session-created");
  assert.equal(line.mode, "sandbox");
  assert.equal(line.apiKeyKind, "pk_test");
  assert.equal(line.secretKeyKind, "sk_test");
  assert.equal(line.apiKeyLength, API.length);
  assert.deepEqual(line.queryParams, ["apiKey", "currencyCode", "baseCurrencyCode", "walletAddress", "theme", "baseCurrencyAmount", "lockAmount"]);
  const text = captured();
  for (const secret of [API, SECRET]) assert.equal(text.includes(secret.slice(8)), false);
  assert.equal(text.includes(WALLET), false, "the wallet address is not logged");
});
