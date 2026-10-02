const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createLoader } = require("./lib/loadTs.cjs");

// --------------------------------------------------------------- the data layer

let apiResult;
const calls = [];
const apiMock = {
  api: {
    get: async (url) => { calls.push(`get ${url}`); return apiResult(url); },
    post: async (url, body) => { calls.push(`post ${url}`); return apiResult(url, body); },
  },
};
const load = createLoader({ mocks: { "./api": apiMock } });
const { SubscriptionService } = load("services/subscription.service.ts");
const { loadEntitlementParts } = load("utils/entitlementsLoader.ts");
const { classifyFailure, describeFailure, withTimeout, settle, InvalidResponseError } = load("utils/loadState.ts");
const { parsePlans, parseMine, parseCardStatus } = load("utils/subscriptionParsers.ts");
const { buildPlansView } = load("utils/plansScreen.ts");
const { buildCardView, CARD_FUNDS_NOTICE, QR_ALTERNATIVE_NOTICE } = load("utils/cardScreen.ts");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });
const networkError = () => Object.assign(new Error("Network Error"), { code: "ERR_NETWORK", request: {} });
const timeoutError = () => Object.assign(new Error("timeout of 10000ms exceeded"), { code: "ECONNABORTED" });

const PLANS = {
  plans: [
    { id: "FREE", name: "ATARA", priceEurCents: 0, sponsoredSendsPerMonth: 10, milesPerUsd: 1, feeBps: { transfer: 0, ramp: 50, card_fx: 90, swap: 40 } },
    { id: "PLUS", name: "ATARA Plus", priceEurCents: 499, sponsoredSendsPerMonth: 60, milesPerUsd: 2, feeBps: { transfer: 0, ramp: 30, card_fx: 50, swap: 25 } },
    { id: "MAX", name: "ATARA Max", priceEurCents: 1299, sponsoredSendsPerMonth: 500, milesPerUsd: 3, feeBps: { transfer: 0, ramp: 10, card_fx: 20, swap: 15 } },
  ],
  milesPerSponsoredSend: 20,
};
const ME = { plan: "FREE", reason: "free", miles: { balance: 120, monthlyCardSpendUsdCents: 0, sponsoredAllowance: 10, sendsThisMonth: 2 } };
const CARD = { available: false, state: "unavailable", canAddToWallet: false, waitlisted: false };
const happy = (url) => ({ data: url === "/plans" ? PLANS : url === "/subscription/me" ? ME : CARD });

const collect = async (service, deadline) => {
  const parts = {};
  await loadEntitlementParts(service, (part) => { parts[part.name] = part.result; }, deadline);
  return parts;
};
const realService = () => ({ getPlans: SubscriptionService.getPlans, getMine: SubscriptionService.getMine, getCardStatus: SubscriptionService.getCardStatus });

test("API success: the three answers are read and validated", async () => {
  apiResult = happy;
  const parts = await collect(realService());
  assert.equal(parts.plans.status, "ok");
  assert.deepEqual(parts.plans.data.plans.map((p) => p.id), ["FREE", "PLUS", "MAX"]);
  assert.equal(parts.mine.data.milesBalance, 120);
  assert.equal(parts.card.data.state, "unavailable");
  // Prices and fee rates are not carried into the app at all.
  assert.equal(JSON.stringify(parts.plans).includes("priceEurCents"), false);
  assert.equal("limits" in parts.plans.data.plans[0], false);
});

test("an older service (404), a refusal (401), a server error (500), no network, a timeout and invalid JSON are each a value", async () => {
  const cases = [
    [() => { throw httpError(404); }, "not-found"],
    [() => { throw httpError(401); }, "unauthorized"],
    [() => { throw httpError(403); }, "unauthorized"],
    [() => { throw httpError(500); }, "server"],
    [() => { throw httpError(503); }, "server"],
    [() => { throw networkError(); }, "offline"],
    [() => { throw timeoutError(); }, "timeout"],
    [() => ({ data: "<html>Bad gateway</html>" }), "invalid"],
    [() => ({ data: null }), "invalid"],
    [() => ({ data: { plans: "nope" } }), "invalid"],
    [() => ({ data: { plan: "GOLD", miles: { balance: 1 } } }), "invalid"],
    [() => ({ data: { state: "teleported" } }), "invalid"],
  ];
  for (const [respond, kind] of cases) {
    apiResult = respond;
    const parts = await collect(realService());
    for (const name of ["plans", "mine", "card"]) {
      assert.equal(parts[name].status, "failed", `${kind}: ${name}`);
      // Whichever endpoint it was, the failure is classified; an invalid body is "invalid" only where the shape is wrong.
      assert.ok(["not-found", "unauthorized", "server", "offline", "timeout", "invalid"].includes(parts[name].failure));
    }
    if (kind !== "invalid") assert.equal(parts.plans.failure, kind);
  }
});

test("one endpoint failing does not hold up or spoil the others", async () => {
  apiResult = (url) => { if (url === "/plans") throw httpError(404); return happy(url); };
  const parts = await collect(realService());
  assert.equal(parts.plans.status, "failed");
  assert.equal(parts.plans.failure, "not-found");
  assert.equal(parts.mine.status, "ok");
  assert.equal(parts.card.status, "ok");
});

test("a request that never answers is cut off at the deadline, so nothing loads for ever", async () => {
  const never = () => new Promise(() => {});
  const started = Date.now();
  const parts = await collect({ getPlans: never, getMine: never, getCardStatus: never }, 40);
  assert.ok(Date.now() - started < 1000);
  for (const name of ["plans", "mine", "card"]) assert.deepEqual(parts[name], { status: "failed", failure: "timeout" });
  await assert.rejects(withTimeout(never(), 10), /within 10 ms/);
  assert.deepEqual(await settle(() => never(), 10), { status: "failed", failure: "timeout" });
});

test("failures are described in fixed sentences, never with the error's own text", () => {
  for (const kind of ["offline", "timeout", "not-found", "unauthorized", "server", "invalid", "unknown"]) {
    const text = describeFailure(kind);
    assert.ok(text.length > 10);
    assert.doesNotMatch(text, /axios|Error:|ECONN|http/i);
  }
  assert.equal(classifyFailure(new Error("who knows")), "unknown");
  assert.equal(classifyFailure(new InvalidResponseError("plans")), "invalid");
  assert.equal(classifyFailure(undefined), "unknown");
  assert.equal(classifyFailure(httpError(418)), "unknown");
});

test("parsers drop unknown plans, bound what they keep, and refuse a body with nothing usable", () => {
  const parsed = parsePlans({ plans: [{ id: "GOLD", name: "x" }, { id: "PLUS", name: "P".repeat(80) }, null, 5], milesPerSponsoredSend: "20" });
  assert.deepEqual(parsed.plans.map((p) => p.id), ["PLUS"]);
  assert.equal(parsed.plans[0].name.length, 40);
  assert.equal(parsed.milesPerSponsoredSend, null);
  assert.throws(() => parsePlans({ plans: [{ id: "GOLD", name: "x" }] }), /Unexpected response/);
  assert.equal(parseMine({ plan: "MAX", miles: { balance: 12.9 } }).milesBalance, 12);
  assert.throws(() => parseMine({ plan: "MAX", miles: { balance: -1 } }));
  assert.throws(() => parseMine({ plan: "MAX" }));
  assert.equal(parseCardStatus({ state: "active", available: true, last4: "4242<script>" }).last4, undefined);
  assert.equal(parseCardStatus({ state: "active", available: true, last4: "4242", canAddToWallet: true }).last4, "4242");
});

test("the app asks for the offers and the waiting list, and can change nothing else", async () => {
  const service = read("services/subscription.service.ts");
  const found = [...service.matchAll(/api\.(get|post|put|patch|delete)\("([^"]+)"/g)].map((m) => `${m[1]} ${m[2]}`).sort();
  assert.deepEqual(found, ["get /card/status", "get /plans", "get /subscription/me", "post /card/waitlist"]);
  calls.length = 0;
  apiResult = () => ({ data: { success: true } });
  await SubscriptionService.joinCardWaitlist();
  assert.deepEqual(calls, ["post /card/waitlist"]);
});

// ------------------------------------------------------------ Plans & Miles view

const text = (view) => JSON.stringify(view);

test("Plans & Miles shows Free as current, Plus and Max as coming soon, and Miles at 0, even with no API at all", () => {
  for (const load of [{ status: "loading" }, { status: "ready" }, { status: "unavailable", failure: "not-found" }]) {
    const view = buildPlansView({ load, plans: null, mine: null });
    assert.equal(view.heading, "ATARA Plans");
    assert.deepEqual(view.plans.map((p) => [p.name, p.badge]), [["ATARA", "Current plan"], ["ATARA Plus", "Coming soon"], ["ATARA Max", "Coming soon"]]);
    assert.deepEqual(view.plans.map((p) => p.action), [null, "Available soon", "Available soon"]);
    assert.equal(view.miles.balanceLabel, "Miles balance: 0");
    assert.equal(view.miles.status, "Card rewards coming soon");
  }
});

test("while loading and when unavailable, the notice says so and the content is still there", () => {
  const loading = buildPlansView({ load: { status: "loading" }, plans: null, mine: null });
  assert.deepEqual(loading.notice, { kind: "loading", text: "Loading your plan…", canRetry: false });
  for (const [failure, words] of [["not-found", /not available yet/], ["offline", /offline/], ["timeout", /too long/], ["server", /problem/], ["unauthorized", /Sign in again/], ["invalid", /does not understand/]]) {
    const view = buildPlansView({ load: { status: "unavailable", failure }, plans: null, mine: null });
    assert.equal(view.notice.kind, "unavailable");
    assert.equal(view.notice.canRetry, true);
    assert.match(view.notice.text, words);
    assert.match(view.notice.text, /Live details are unavailable right now/);
    assert.equal(view.plans.length, 3);
  }
  assert.equal(buildPlansView({ load: { status: "ready" }, plans: null, mine: null }).notice, null);
});

test("API success adds the backend's planned benefits, without prices, fee rates or Vaults, and never invents a subscription", () => {
  const plans = parsePlans(PLANS).plans;
  const view = buildPlansView({ load: { status: "ready" }, plans, mine: parseMine(ME) });
  assert.equal(view.miles.balanceLabel, "Miles balance: 120");
  const plus = view.plans.find((p) => p.id === "PLUS");
  assert.equal(plus.planned, true);
  assert.ok(plus.highlights.includes("2× ATARA Miles on card spending"));
  assert.ok(plus.highlights.some((line) => /monthly allowance of sends with network fees covered \(60\)/.test(line)));
  assert.ok(plus.highlights.includes("Lower card currency-conversion fee"));
  assert.equal(view.plans.find((p) => p.id === "MAX").highlights[0], "3× ATARA Miles on card spending");
  const dump = text(view);
  assert.doesNotMatch(dump, /vault/i);
  assert.doesNotMatch(dump, /€|\$|%|per month|\/month|price/i);
  assert.equal(view.plans.filter((p) => p.badge === "Current plan").length, 1);
  assert.equal(view.plans.find((p) => p.badge === "Current plan").id, "FREE");
});

test("the server alone decides the current plan: a paid plan shows only if it says so", () => {
  const plans = parsePlans(PLANS).plans;
  const paid = buildPlansView({ load: { status: "ready" }, plans, mine: { plan: "PLUS", milesBalance: 0, monthlyCardSpendUsdCents: 0 } });
  assert.deepEqual(paid.plans.map((p) => p.badge), ["Coming soon", "Current plan", "Coming soon"]);
  // Without its answer, nothing paid is ever shown as owned.
  const unknown = buildPlansView({ load: { status: "unavailable", failure: "server" }, plans, mine: null });
  assert.equal(unknown.plans.filter((p) => p.badge === "Current plan").map((p) => p.id).join(), "FREE");
});

test("a plan with no data yet says so instead of showing an empty card", () => {
  const view = buildPlansView({ load: { status: "ready" }, plans: parsePlans({ plans: [{ id: "FREE", name: "ATARA" }] }).plans, mine: null });
  for (const id of ["PLUS", "MAX"]) assert.deepEqual(view.plans.find((p) => p.id === id).highlights, ["Details will appear here when this plan opens."]);
});

// ------------------------------------------------------------------- ATARA Card

test("the card screen says Coming soon, with no Rain, no card status, a failed request, or while loading", () => {
  const cases = [
    { load: { status: "loading" }, status: null },
    { load: { status: "unavailable", failure: "not-found" }, status: null },
    { load: { status: "unavailable", failure: "server" }, status: null },
    { load: { status: "ready" }, status: { available: false, state: "unavailable", canAddToWallet: false, waitlisted: false } },
    // Rain disabled: even a state that looks real is not shown as a card while the issuer is not available.
    { load: { status: "ready" }, status: { available: false, state: "active", canAddToWallet: true, last4: "4242", waitlisted: false } },
  ];
  for (const input of cases) {
    const view = buildCardView(input);
    assert.equal(view.heading, "ATARA Card");
    assert.equal(view.phase, "coming-soon");
    assert.deepEqual(view.card, { title: "Virtual Visa card", badge: "Coming soon", body: "Spend your digital assets anywhere Visa is accepted." });
    assert.deepEqual(view.applePay, { badge: "Coming soon", body: "Apple Pay will be available once the card launches." });
    assert.deepEqual(view.miles, { title: "ATARA Miles", body: "Earn rewards when the card launches." });
    assert.deepEqual(view.action, { id: "notify", label: "Notify me", disabled: false });
    assert.equal(view.qr.title, "Payment QR");
    assert.equal(view.qr.action, "Pay a merchant");
    // No card number, no fake Visa, no simulated Apple Pay.
    assert.equal("last4" in view.card, false);
    assert.doesNotMatch(JSON.stringify(view), /\b\d{4} \d{4}\b|Active|Available"/);
  }
});

test("the card screen says what the failure was, and offers a retry, without hiding the content", () => {
  const view = buildCardView({ load: { status: "unavailable", failure: "offline" }, status: null });
  assert.equal(view.notice.kind, "unavailable");
  assert.match(view.notice.text, /Live card status is unavailable right now\. You seem to be offline\./);
  assert.equal(view.notice.canRetry, true);
  assert.deepEqual(buildCardView({ load: { status: "loading" }, status: null }).notice, { kind: "loading", text: "Checking the card status…", canRetry: false });
  assert.equal(buildCardView({ load: { status: "ready" }, status: null }).notice, null);
});

test("waitlist state: Notify me, then 'You're on the list' and disabled", () => {
  const status = (waitlisted) => ({ available: false, state: "unavailable", canAddToWallet: false, waitlisted });
  assert.equal(buildCardView({ load: { status: "ready" }, status: status(false) }).action.id, "notify");
  assert.deepEqual(buildCardView({ load: { status: "ready" }, status: status(true) }).action, { id: "joined", label: "You’re on the list", disabled: true });
});

test("only a real, available card is shown as one, and Apple Pay only when the issuer supports it", () => {
  const real = (state, extra = {}) => buildCardView({ load: { status: "ready" }, status: { available: true, state, canAddToWallet: false, waitlisted: false, ...extra } });
  assert.equal(real("not_applied").card.badge, "Ready to request");
  assert.equal(real("pending").card.badge, "Under review");
  const active = real("active", { last4: "4242", canAddToWallet: true });
  assert.equal(active.card.badge, "Active");
  assert.equal(active.card.last4, "4242");
  assert.equal(active.applePay.badge, "Available");
  assert.equal(real("active", { last4: "4242" }).applePay.badge, "Coming soon");
  assert.equal(real("frozen").card.badge, "Frozen");
  assert.equal(active.action, null);
});

test("the card screen says where the money is and keeps the QR payment", () => {
  const view = buildCardView({ load: { status: "ready" }, status: null });
  assert.match(CARD_FUNDS_NOTICE, /held by the card issuer, not in your ATARA wallet/);
  assert.match(CARD_FUNDS_NOTICE, /you confirm each top-up yourself/);
  assert.match(QR_ALTERNATIVE_NOTICE, /QR code still works and is unchanged/);
  assert.equal(view.fundsNotice, CARD_FUNDS_NOTICE);
});

// ------------------------------------------------------------- wiring and Vault

test("the screens render from the view models, handle the failures, and are reachable", () => {
  const plans = read("app/plans.tsx");
  assert.match(plans, /buildPlansView\(\{ load: plansLoad, plans, mine \}\)/);
  assert.match(plans, /<LoadNotice notice=\{view\.notice\} onRetry=\{refresh\} \/>/);
  assert.match(plans, /edges=\{\["top", "bottom"\]\}/);
  const card = read("app/card.tsx");
  assert.match(card, /buildCardView\(\{ load: cardLoad, status: card \}\)/);
  assert.match(card, /<LoadNotice notice=\{view\.notice\} onRetry=\{refresh\} \/>/);
  assert.match(card, /router\.push\("\/pay-merchant" as never\)/);
  // The existing QR payment is still on the home screen, untouched.
  assert.match(read("app/(tabs)/index.tsx"), /onPayMerchant=\{\(\) => router\.push\("\/pay-merchant"\)\}/);
  // The waitlist failing is said, not hidden.
  assert.match(card, /useAlertStore\.getState\(\)\.error\("Could not add you to the list"/);
});

test("the hook never loads for ever and never mixes accounts", () => {
  const hook = read("hooks/useEntitlements.ts");
  assert.match(hook, /failure: "unauthorized"/);
  assert.match(hook, /if \(!current\(\)\) return;/);
  assert.match(hook, /loadEntitlementParts\(SubscriptionService/);
});

test("Vault is postponed: off in every build, not part of any plan, and its entry points stay gated", () => {
  const eas = JSON.parse(read("eas.json"));
  const flags = Object.entries(eas.build).map(([name, profile]) => [name, profile.env?.EXPO_PUBLIC_ENABLE_VAULTS]);
  for (const [name, flag] of flags) if (flag !== undefined) assert.equal(flag, "false", `${name} enables Vaults`);
  assert.ok(flags.some(([, flag]) => flag === "false"));
  for (const file of ["app/(tabs)/index.tsx", "app/(tabs)/_layout.tsx", "app/(tabs)/vaults.tsx", "app/vault-create.tsx", "app/vault-detail.tsx", "components/BottomNav.tsx"]) {
    assert.match(read(file), /EXPO_PUBLIC_ENABLE_VAULTS === "true"/, file);
  }
  for (const file of ["app/plans.tsx", "app/card.tsx", "utils/plansScreen.ts", "utils/cardScreen.ts", "services/subscription.service.ts"]) {
    const code = read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(code, /vault/i, `${file} mentions Vault outside comments`);
  }
  // The plan gate added for Vault creation is gone: the create screen is as it was.
  assert.doesNotMatch(read("app/vault-create.tsx"), /useEntitlements|vaultCreationGate/);
});
