const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createLoader } = require("./lib/loadTs.cjs");

const load = createLoader();
const { vaultCreationGate, describeVaultGate, planHighlights, nextAllowanceStep, formatPrice, formatRate, formatUsd } = load("utils/entitlements.ts");
const { cardScreenFor, CARD_FUNDS_NOTICE, QR_ALTERNATIVE_NOTICE } = load("utils/cardScreen.ts");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

const plan = (id, extra = {}) => ({
  id,
  name: { FREE: "ATARA", PLUS: "ATARA Plus", MAX: "ATARA Max" }[id],
  priceEurCents: { FREE: 0, PLUS: 499, MAX: 1299 }[id],
  limits: { FREE: { vaults: 1, vaultMembers: 4 }, PLUS: { vaults: 5, vaultMembers: 10 }, MAX: { vaults: 20, vaultMembers: 10 } }[id],
  sponsoredSendsPerMonth: { FREE: 10, PLUS: 60, MAX: 500 }[id],
  spendStepUsdCents: { FREE: 5000, PLUS: 2500, MAX: 0 }[id],
  spendBonusCap: { FREE: 20, PLUS: 60, MAX: 0 }[id],
  milesPerUsd: { FREE: 1, PLUS: 2, MAX: 3 }[id],
  feeBps: { FREE: { transfer: 0, ramp: 50, card_fx: 90, swap: 40 }, PLUS: { transfer: 0, ramp: 30, card_fx: 50, swap: 25 }, MAX: { transfer: 0, ramp: 10, card_fx: 20, swap: 15 } }[id],
  ...extra,
});
const plans = ["FREE", "PLUS", "MAX"].map((id) => plan(id));

test("a Free account is stopped at its Vault limit and told which plan raises it", () => {
  const gate = vaultCreationGate({ plans, plan: "FREE", vaultsOwned: 1, members: 3 });
  assert.deepEqual(gate, { allowed: false, reason: "vault-limit", limit: 1, suggestPlan: "PLUS" });
  assert.equal(describeVaultGate(gate, plans), "Your plan allows 1 Vault. ATARA Plus raises it.");
  assert.deepEqual(vaultCreationGate({ plans, plan: "FREE", vaultsOwned: 0, members: 3 }), { allowed: true });
});

test("the member limit is checked too, and the suggestion is a plan that actually fits", () => {
  const gate = vaultCreationGate({ plans, plan: "FREE", vaultsOwned: 0, members: 6 });
  assert.deepEqual(gate, { allowed: false, reason: "member-limit", limit: 4, suggestPlan: "PLUS" });
  assert.match(describeVaultGate(gate, plans), /up to 4 members/);
  // Nothing in any plan allows 11 members (the contract's own limit), so nothing is suggested.
  assert.equal(vaultCreationGate({ plans, plan: "MAX", vaultsOwned: 0, members: 11 }).suggestPlan, null);
});

test("the top plan at its limit is told the truth, not offered something that does not exist", () => {
  const gate = vaultCreationGate({ plans, plan: "MAX", vaultsOwned: 20, members: 3 });
  assert.deepEqual(gate, { allowed: false, reason: "vault-limit", limit: 20, suggestPlan: null });
  assert.equal(describeVaultGate(gate, plans), "Your plan allows 20 Vaults.");
  assert.equal(vaultCreationGate({ plans, plan: "PLUS", vaultsOwned: 5, members: 3 }).suggestPlan, "MAX");
});

test("a limit the app cannot read never stops anyone", () => {
  assert.deepEqual(vaultCreationGate({ plans: null, plan: null, vaultsOwned: 99, members: 99 }), { allowed: true });
  assert.deepEqual(vaultCreationGate({ plans, plan: null, vaultsOwned: 99, members: 99 }), { allowed: true });
  assert.deepEqual(vaultCreationGate({ plans, plan: "GOLD", vaultsOwned: 99, members: 99 }), { allowed: true });
  // The count is unknown (the chain read failed): only the member limit can apply.
  assert.deepEqual(vaultCreationGate({ plans, plan: "FREE", vaultsOwned: null, members: 3 }), { allowed: true });
  assert.equal(vaultCreationGate({ plans, plan: "FREE", vaultsOwned: null, members: 6 }).allowed, false);
});

test("the plan cards say what each plan gives, and promise no fee on sending to people", () => {
  for (const p of plans) {
    const lines = planHighlights(p).join("\n");
    assert.match(lines, /Vault/);
    assert.match(lines, /mile/);
    assert.doesNotMatch(lines, /transfer fee|send fee/i);
  }
  assert.match(planHighlights(plans[2]).join("\n"), /fair use/);
  assert.match(planHighlights(plans[0]).join("\n"), /10 sends a month/);
  assert.equal(formatPrice(0), "Free");
  assert.equal(formatPrice(499), "€4.99/month");
  assert.equal(formatRate(0), "No fee");
  assert.equal(formatRate(90), "0.90 %");
  assert.equal(formatUsd(123456), "$1,234.56");
});

test("the card spend still needed for the next covered send is exact, and stops at the cap", () => {
  assert.deepEqual(nextAllowanceStep(plans[0], 0), { toGoUsdCents: 5000 });
  assert.deepEqual(nextAllowanceStep(plans[0], 4200), { toGoUsdCents: 800 });
  assert.deepEqual(nextAllowanceStep(plans[0], 5000), { toGoUsdCents: 5000 });
  assert.equal(nextAllowanceStep(plans[0], 5000 * 20), null);
  assert.equal(nextAllowanceStep(plans[2], 100), null); // Max: spend adds nothing
  assert.equal(nextAllowanceStep(undefined, 100), null);
});

test("until a card issuer is connected, the only offer is to be told when it opens", () => {
  assert.deepEqual(cardScreenFor(null), { kind: "coming-soon", joined: false });
  assert.deepEqual(cardScreenFor({ available: false, state: "unavailable", canAddToWallet: false, waitlisted: true }), { kind: "coming-soon", joined: true });
  // Even a sandbox-looking state is not offered as a real card while the issuer is not available.
  assert.deepEqual(cardScreenFor({ available: false, state: "not_applied", canAddToWallet: false, waitlisted: false }), { kind: "coming-soon", joined: false });
});

test("each real card state shows what exists, and Apple Wallet only when the issuer supports it", () => {
  const on = (state, extra = {}) => cardScreenFor({ available: true, state, canAddToWallet: false, waitlisted: false, ...extra });
  assert.deepEqual(on("not_applied"), { kind: "not-applied" });
  assert.deepEqual(on("pending"), { kind: "pending" });
  assert.deepEqual(on("active", { last4: "4242", canAddToWallet: true }), { kind: "active", last4: "4242", canAddToWallet: true });
  assert.deepEqual(on("active"), { kind: "active", last4: undefined, canAddToWallet: false });
  assert.deepEqual(on("frozen", { last4: "4242" }), { kind: "frozen", last4: "4242" });
});

test("the card screen says where the money is, and keeps the QR payment", () => {
  assert.match(CARD_FUNDS_NOTICE, /held by the card issuer, not in your ATARA wallet/);
  assert.match(CARD_FUNDS_NOTICE, /you confirm each top-up yourself/);
  assert.match(QR_ALTERNATIVE_NOTICE, /QR code still works and is unchanged/);
  const screen = read("app/card.tsx");
  assert.match(screen, /router\.push\("\/pay-merchant" as never\)/);
  // The existing QR payment is still wired on the home screen, untouched.
  assert.match(read("app/(tabs)/index.tsx"), /onPayMerchant=\{\(\) => router\.push\("\/pay-merchant"\)\}/);
  assert.match(read("app/(tabs)/index.tsx"), /router\.push\("\/card" as never\)/);
});

test("the app can read the offers and ask for the waiting list, and can change nothing else", () => {
  const service = read("services/subscription.service.ts");
  const calls = [...service.matchAll(/api\.(get|post|put|patch|delete)\("([^"]+)"/g)].map((m) => `${m[1]} ${m[2]}`).sort();
  assert.deepEqual(calls, ["get /card/status", "get /plans", "get /subscription/me", "post /card/waitlist"]);
  // Billing is off until a purchase flow exists, and the button says so.
  const plansScreen = read("app/plans.tsx");
  assert.match(plansScreen, /EXPO_PUBLIC_BILLING_ENABLED === "true"/);
  assert.match(plansScreen, /"Available soon"/);
});

test("one account's miles are never shown under another account", () => {
  const hook = read("hooks/useEntitlements.ts");
  assert.match(hook, /if \(owner\.current !== userId\) return;/);
  assert.match(hook, /setMine\(null\)/);
});

test("the Vault limit is a convenience that fails open", () => {
  const screen = read("app/vault-create.tsx");
  assert.match(screen, /vaultCreationGate\(\{ plans, plan: mine\?\.plan \?\? null, vaultsOwned, members: members\.length \}\)/);
  assert.match(screen, /catch \{ vaultsOwned = null; \}/);
});
