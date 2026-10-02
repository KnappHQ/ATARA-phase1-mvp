const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { createLoader } = require("./lib/loadTs.cjs");

const flow = createLoader()("utils/onrampFlow.ts");
const {
  INITIAL_ONRAMP, onrampReducer, isBusy, validateCheckoutUrl, classifyOnrampError, runCheckout, scheduleBalanceRefresh,
  BALANCE_REFRESH_SCHEDULE_MS, CREATE_SESSION_TIMEOUT_MS,
} = flow;
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

const SECRET = "sk_test_ZyXwVuTsRqPoNmLkJiHgFeDcBa987654";
const API = "pk_test_AbCdEfGhIjKlMnOpQrStUvWxYz012345";
const WALLET = "0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae";
/** A URL built the way the backend builds it, signed independently here. */
const signedUrl = (extra = "") => {
  const query = `?apiKey=${API}&currencyCode=usdc_base&baseCurrencyCode=eur&walletAddress=${WALLET}&theme=dark&baseCurrencyAmount=50.00&lockAmount=true${extra}`;
  const signature = crypto.createHmac("sha256", SECRET).update(query).digest("base64");
  return `https://buy-sandbox.moonpay.com/${query}&signature=${encodeURIComponent(signature)}`;
};
const GOOD = signedUrl();

const run = async (deps, amount = "50.00") => {
  const events = [];
  let state = INITIAL_ONRAMP;
  const phases = [state.phase];
  await runCheckout(deps, amount, (event) => {
    events.push(event.type);
    state = onrampReducer(state, event);
    phases.push(state.phase);
  });
  return { events, state, phases };
};
const httpError = (status, data) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });

// --------------------------------------------------------------- the URL it opens

test("config validation: the URL the backend hands out is accepted, and nothing else is", () => {
  assert.deepEqual(validateCheckoutUrl(GOOD), { ok: true });
  const reason = (value) => validateCheckoutUrl(value).reason;
  assert.equal(reason(GOOD.replace("buy-sandbox", "buy")), "host");
  assert.equal(reason(GOOD.replace("buy-sandbox.moonpay.com", "evil.example")), "host");
  assert.equal(reason(GOOD.replace("buy-sandbox.moonpay.com", "buy-sandbox.moonpay.com.evil.example")), "host");
  assert.equal(reason(GOOD.replace("https://", "http://")), "not-https");
  assert.equal(reason(GOOD.replace("https://", "javascript:alert(1)//")), "not-https");
  assert.equal(reason("atara://moonpay"), "not-https");
  assert.equal(reason("https://user:pw@buy-sandbox.moonpay.com/?signature=x&apiKey=a&walletAddress=b"), "malformed");
  assert.equal(reason("https://buy-sandbox.moonpay.com:8443/?apiKey=a&walletAddress=b&signature=x"), "malformed");
});

test("a URL without its signature last, with two, or without the essentials is refused before anything opens", () => {
  const reason = (value) => validateCheckoutUrl(value).reason;
  assert.equal(reason(GOOD.slice(0, GOOD.lastIndexOf("&signature="))), "unsigned");
  assert.equal(reason(`${GOOD}&theme=light`), "unsigned", "a parameter after the signature");
  assert.equal(reason(`${GOOD}&signature=again`), "unexpected");
  assert.equal(reason("https://buy-sandbox.moonpay.com/?signature=abc"), "unexpected");
  assert.equal(reason("https://buy-sandbox.moonpay.com/"), "malformed");
  assert.equal(reason(""), "malformed");
  assert.equal(reason(undefined), "malformed");
  assert.equal(reason(`${GOOD} `), "malformed", "whitespace");
  assert.equal(reason(GOOD + "a".repeat(5000)), "malformed", "absurd length");
});

test("malformed callback: a redirect value with odd characters survives untouched and the URL is still accepted", () => {
  const encoded = encodeURIComponent("https://atara.finance/done?from=moonpay&note=a b+c&q=é\"<>");
  assert.deepEqual(validateCheckoutUrl(signedUrl(`&redirectURL=${encoded}`)), { ok: true });
});

test("signing input is deterministic and the app never changes the URL: openBrowser receives it byte for byte", async () => {
  const opened = [];
  await run({ createSession: async () => ({ url: GOOD, mode: "sandbox" }), openBrowser: async (url) => { opened.push(url); return { type: "cancel" }; } });
  assert.deepEqual(opened, [GOOD]);
  assert.equal(signedUrl(), signedUrl(), "same inputs, same URL");
  // The app source never rebuilds, normalises or appends to the checkout URL.
  const screen = read("app/add-crypto.tsx");
  assert.doesNotMatch(screen, /encodeURI|new URL\(|URLSearchParams|\.searchParams|session\.url\s*\+/);
  assert.match(screen, /openBrowser: \(url\) =>\s*WebBrowser\.openBrowserAsync\(url,/);
});

// ------------------------------------------------------------------ the whole flow

test("success return: start, opened, returned, and the screen is free", async () => {
  const { phases, state } = await run({ createSession: async () => ({ url: GOOD, mode: "sandbox" }), openBrowser: async () => ({ type: "dismiss" }) });
  assert.deepEqual(phases, ["idle", "creating", "open", "returned"]);
  assert.equal(isBusy(state), false);
});

test("user closes (cancel or dismiss): same, no error", async () => {
  for (const type of ["cancel", "dismiss", "opened", undefined]) {
    const { state } = await run({ createSession: async () => ({ url: GOOD, mode: "sandbox" }), openBrowser: async () => (type ? { type } : undefined) });
    assert.equal(state.phase, "returned", String(type));
    assert.equal(state.failure, undefined);
  }
});

test("a browser that cannot be opened is an error with a reference, not a spinner", async () => {
  const { state, phases } = await run({ createSession: async () => ({ url: GOOD, mode: "sandbox" }), openBrowser: async () => { throw new Error("no browser"); } });
  assert.deepEqual(phases, ["idle", "creating", "open", "failed"]);
  assert.deepEqual(state.failure, { message: "Could not open MoonPay. Try again.", code: "APP-BROWSER-OPEN" });
  assert.equal(isBusy(state), false);
});

test("timeout: a session that never comes back is cut off, said, and the button is free again", async () => {
  const started = Date.now();
  const { state, phases } = await run({ createSession: () => new Promise(() => {}), openBrowser: async () => assert.fail("must not open"), createTimeoutMs: 30 });
  assert.ok(Date.now() - started < 1000);
  assert.deepEqual(phases, ["idle", "creating", "failed"]);
  assert.match(state.failure.message, /took too long/);
  assert.equal(isBusy(state), false);
  assert.ok(CREATE_SESSION_TIMEOUT_MS > 0 && CREATE_SESSION_TIMEOUT_MS <= 20_000);
});

test("no infinite loading: if the browser's own promise never settles, the screen is already free", async () => {
  let state = INITIAL_ONRAMP;
  const pending = runCheckout(
    { createSession: async () => ({ url: GOOD, mode: "sandbox" }), openBrowser: () => new Promise(() => {}) },
    "50.00",
    (event) => { state = onrampReducer(state, event); },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(state.phase, "open");
  assert.equal(isBusy(state), false, "nothing spins while the browser is open");
  // Coming back to the app moves on without the browser ever answering.
  state = onrampReducer(state, { type: "returned" });
  assert.equal(state.phase, "returned");
  void pending;
});

test("errors from the service: not configured, mis-set up (with its reference), offline, 401, unknown", () => {
  assert.deepEqual(classifyOnrampError(httpError(503, { message: "The on-ramp is not configured yet", code: "MP-API-KEY-MISSING" })), {
    message: "MoonPay is not configured yet. To test ATARA, get test USDC from the Circle faucet above.", code: "MP-API-KEY-MISSING",
  });
  const mis = classifyOnrampError(httpError(503, { message: "MoonPay keys do not match the configured sandbox environment", code: "MP-SECRET-PREFIX" }));
  assert.equal(mis.code, "MP-SECRET-PREFIX");
  assert.match(mis.message, /not set up correctly on our side/);
  assert.doesNotMatch(mis.message, /sk_|pk_/);
  assert.equal(classifyOnrampError(httpError(503, { message: "The on-ramp URL does not match the configured network", code: "MP-WIDGET-HOST" })).code, "MP-WIDGET-HOST");
  assert.match(classifyOnrampError(Object.assign(new Error("Network Error"), { code: "ERR_NETWORK", request: {} })).message, /offline/);
  assert.match(classifyOnrampError(Object.assign(new Error("x"), { code: "ECONNABORTED" })).message, /too long/);
  assert.match(classifyOnrampError(httpError(401, {})).message, /Sign in again/);
  assert.match(classifyOnrampError(httpError(500, {})).message, /problem/);
  assert.equal(classifyOnrampError(httpError(409, { message: "Your smart account is not ready yet. Finish wallet setup first." })).message, "Your smart account is not ready yet. Finish wallet setup first.");
  // A code that is not one of ours is dropped, never shown.
  assert.equal(classifyOnrampError(httpError(503, { message: "The on-ramp is not configured yet", code: "<script>alert(1)</script>" })).code, undefined);
  assert.equal("code" in classifyOnrampError(new Error("???")), false);
});

test("missing secret, live checkout in the beta, and a bad URL are each refused with their own reference and nothing is opened", async () => {
  const opened = [];
  const deps = (session) => ({ createSession: async () => session, openBrowser: async (url) => { opened.push(url); } });
  let result = await run({ createSession: async () => { throw httpError(503, { message: "The on-ramp is not configured yet", code: "MP-SECRET-MISSING" }); }, openBrowser: async (url) => opened.push(url) });
  assert.equal(result.state.failure.code, "MP-SECRET-MISSING");
  result = await run(deps({ url: GOOD, mode: "live" }));
  assert.equal(result.state.failure.code, "APP-CHECKOUT-LIVE");
  result = await run(deps({ url: GOOD.replace("buy-sandbox", "buy"), mode: "sandbox" }));
  assert.equal(result.state.failure.code, "APP-CHECKOUT-HOST");
  assert.match(result.state.failure.message, /not the expected MoonPay address/);
  result = await run(deps({ url: "not a url", mode: "sandbox" }));
  assert.equal(result.state.failure.code, "APP-CHECKOUT-MALFORMED");
  result = await run(deps({ url: GOOD.slice(0, GOOD.lastIndexOf("&signature=")), mode: "sandbox" }));
  assert.equal(result.state.failure.code, "APP-CHECKOUT-UNSIGNED");
  assert.deepEqual(opened, []);
});

test("the reducer cannot get stuck: only 'creating' is busy, and every busy state can reach a free one", () => {
  const events = [{ type: "start" }, { type: "opened" }, { type: "returned" }, { type: "failed", message: "m" }, { type: "reset" }];
  const seen = new Set();
  const explore = (state, depth) => {
    seen.add(JSON.stringify(state));
    if (isBusy(state)) {
      // From a busy state, each outcome event frees the screen.
      for (const event of [{ type: "opened" }, { type: "returned" }, { type: "failed", message: "m" }, { type: "reset" }]) {
        assert.equal(isBusy(onrampReducer(state, event)), false, `${state.phase} + ${event.type} is still busy`);
      }
    }
    if (depth === 0) return;
    for (const event of events) explore(onrampReducer(state, event), depth - 1);
  };
  explore(INITIAL_ONRAMP, 5);
  assert.ok(seen.size >= 5);
  // A second tap during preparation does nothing; a stray 'opened' from idle does nothing.
  const creating = onrampReducer(INITIAL_ONRAMP, { type: "start" });
  assert.equal(onrampReducer(creating, { type: "start" }), creating);
  assert.equal(onrampReducer(INITIAL_ONRAMP, { type: "opened" }), INITIAL_ONRAMP);
  assert.equal(onrampReducer(INITIAL_ONRAMP, { type: "returned" }), INITIAL_ONRAMP);
});

test("after coming back the balance is re-read on a short schedule, failures are swallowed, and it can be cancelled", () => {
  const scheduled = [];
  const cleared = [];
  const timers = { set: (fn, ms) => { scheduled.push([fn, ms]); return scheduled.length - 1; }, clear: (handle) => cleared.push(handle) };
  let refreshes = 0;
  const cancel = scheduleBalanceRefresh(() => { refreshes++; throw new Error("balance failed"); }, timers);
  assert.deepEqual(scheduled.map(([, ms]) => ms), [...BALANCE_REFRESH_SCHEDULE_MS]);
  assert.ok(BALANCE_REFRESH_SCHEDULE_MS.at(-1) <= 60_000, "it stops within a minute");
  for (const [fn] of scheduled) fn();
  assert.equal(refreshes, scheduled.length);
  cancel();
  assert.deepEqual(cleared, scheduled.map((_, index) => index));
  // An async failure is swallowed too.
  const [second] = [];
  void second;
  const again = [];
  scheduleBalanceRefresh(() => Promise.reject(new Error("x")), { set: (fn) => again.push(fn), clear: () => {} })();
  again.forEach((fn) => fn());
});

// ----------------------------------------------------------------- the screen

test("the Add crypto screen uses the flow, frees itself, and keeps its close and back controls reachable", () => {
  const screen = read("app/add-crypto.tsx");
  assert.match(screen, /useReducer\(onrampReducer, INITIAL_ONRAMP\)/);
  assert.match(screen, /const isOpening = isBusy\(checkout\);/);
  assert.doesNotMatch(screen, /setIsOpening/);
  assert.match(screen, /await runCheckout\(/);
  // The browser: full screen, with the native Close button.
  assert.match(screen, /presentationStyle: WebBrowser\.WebBrowserPresentationStyle\.FULL_SCREEN/);
  assert.match(screen, /dismissButtonStyle: "close"/);
  // Safe area: the screen sits inside SafeAreaView on top and bottom, and its Back button is labelled, 44pt and has hit slop.
  assert.match(screen, /import \{ SafeAreaView \} from "react-native-safe-area-context"/);
  assert.match(screen, /<SafeAreaView className="flex-1 bg-black" edges=\{\["top", "bottom"\]\}>/);
  assert.match(screen, /accessibilityLabel="Back"\s*hitSlop=\{8\}\s*className="w-11 h-11/);
  // Coming back to the app ends the wait; an explicit way out exists while MoonPay is open.
  assert.match(screen, /AppState\.addEventListener\("change"/);
  assert.match(screen, /I’m back/);
  assert.match(screen, /scheduleBalanceRefresh\(\(\) => useWalletStore\.getState\(\)\.refreshBalances\(\)\)/);
  // The failure is shown with its reference.
  assert.match(screen, /Reference: \$\{checkout\.failure\.code\}/);
});

test("every new screen and the Add crypto screen sit inside the safe area and expose a labelled way back", () => {
  for (const file of ["app/plans.tsx", "app/card.tsx", "app/add-crypto.tsx"]) {
    const source = read(file);
    assert.match(source, /SafeAreaView[^>]*edges=\{\["top", "bottom"\]\}/, file);
    assert.match(source, /accessibilityLabel="Back"/, file);
    assert.match(source, /w-11 h-11/, `${file}: the back button is 44 points`);
  }
});
