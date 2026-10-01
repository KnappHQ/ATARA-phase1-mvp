const assert = require("node:assert/strict");
const test = require("node:test");
require("ts-node/register");
const { applyPlanOverrides, getPlan, resetPlansCache, MILES_PER_SPONSORED_SEND } = require("../utils/plans.ts");
const { resolveEntitlement } = require("../utils/entitlements.ts");
const { computeFee, formatBps } = require("../utils/fees.ts");
const { milesForSpend, sponsorshipAllowance, decideSponsorship, monthKey } = require("../utils/miles.ts");

const NOW = new Date("2026-10-15T12:00:00Z");

test("Free stays useful, paid offers only add, and no plan takes a fee on transfers between users", () => {
  const [free, plus, max] = ["FREE", "PLUS", "MAX"].map(getPlan);
  assert.equal(free.priceEurCents, 0);
  assert.ok(plus.priceEurCents > 0 && max.priceEurCents > plus.priceEurCents);
  for (const key of ["vaults", "vaultMembers"]) {
    assert.ok(free.limits[key] >= 1);
    assert.ok(plus.limits[key] >= free.limits[key] && max.limits[key] >= plus.limits[key]);
  }
  assert.ok(plus.sponsorship.monthlySends > free.sponsorship.monthlySends);
  assert.ok(max.milesPerUsd > plus.milesPerUsd && plus.milesPerUsd > free.milesPerUsd);
  for (const plan of [free, plus, max]) {
    assert.equal(plan.feeBps.transfer, 0);
    // Paying more never raises a fee.
  }
  for (const kind of ["ramp", "card_fx", "swap"]) assert.ok(free.feeBps[kind] >= plus.feeBps[kind] && plus.feeBps[kind] >= max.feeBps[kind]);
  // The deployed vault contract allows 10 members; no plan may promise more.
  for (const plan of [free, plus, max]) assert.ok(plan.limits.vaultMembers <= 10);
});

test("an override changes only what is valid, and reports what it ignored", () => {
  const { plans, ignored } = applyPlanOverrides(
    JSON.stringify({
      PLUS: { priceEurCents: 599, limits: { vaults: 8, vaultMembers: 50 }, feeBps: { ramp: 20, swap: 9999 } },
      FREE: { priceEurCents: 100 },
      MAX: { name: "" },
      BOGUS: {},
    }),
  );
  assert.equal(plans.PLUS.priceEurCents, 599);
  assert.equal(plans.PLUS.limits.vaults, 8);
  assert.equal(plans.PLUS.feeBps.ramp, 20);
  // Past the contract's limit, past the fee ceiling, a paid Free, an empty name: all refused.
  assert.equal(plans.PLUS.limits.vaultMembers, 10);
  assert.equal(plans.PLUS.feeBps.swap, 25);
  assert.equal(plans.FREE.priceEurCents, 0);
  assert.notEqual(plans.MAX.name, "");
  assert.deepEqual(ignored.sort(), ["FREE.priceEurCents", "MAX.name", "PLUS.feeBps.swap", "PLUS.limits.vaultMembers"]);
});

test("a broken override never takes the service down", () => {
  for (const raw of ["{", "[]", "null", "42", "", undefined]) {
    const { plans } = applyPlanOverrides(raw);
    assert.equal(plans.FREE.priceEurCents, 0);
    assert.equal(plans.PLUS.priceEurCents, 499);
  }
  process.env.PLANS_OVERRIDE_JSON = '{"PLUS":{"priceEurCents":700}}';
  resetPlansCache();
  assert.equal(getPlan("PLUS").priceEurCents, 700);
  delete process.env.PLANS_OVERRIDE_JSON;
  resetPlansCache();
  assert.equal(getPlan("PLUS").priceEurCents, 499);
});

test("only an active or grace-period subscription that has not expired gives its offer", () => {
  const future = new Date(NOW.getTime() + 86_400_000);
  const past = new Date(NOW.getTime() - 1000);
  assert.deepEqual(resolveEntitlement({ subscriptionTier: "PLUS", subscriptionStatus: "ACTIVE", subscriptionExpiresAt: future }, NOW), { plan: "PLUS", reason: "active" });
  assert.deepEqual(resolveEntitlement({ subscriptionTier: "MAX", subscriptionStatus: "GRACE_PERIOD", subscriptionExpiresAt: future }, NOW), { plan: "MAX", reason: "grace" });
  assert.deepEqual(resolveEntitlement({ subscriptionTier: "MAX", subscriptionStatus: "ACTIVE" }, NOW), { plan: "MAX", reason: "active" });
  for (const status of ["INACTIVE", "PAUSED", "CANCELED", "EXPIRED", "SOMETHING", null, undefined]) {
    assert.equal(resolveEntitlement({ subscriptionTier: "MAX", subscriptionStatus: status, subscriptionExpiresAt: future }, NOW).plan, "FREE", String(status));
  }
  assert.deepEqual(resolveEntitlement({ subscriptionTier: "PLUS", subscriptionStatus: "ACTIVE", subscriptionExpiresAt: past }, NOW), { plan: "FREE", reason: "expired" });
  assert.equal(resolveEntitlement({ subscriptionTier: "PLUS", subscriptionStatus: "ACTIVE", subscriptionExpiresAt: "not a date" }, NOW).plan, "FREE");
  assert.deepEqual(resolveEntitlement({ subscriptionTier: "GOLD", subscriptionStatus: "ACTIVE" }, NOW), { plan: "FREE", reason: "unknown-tier" });
  assert.equal(resolveEntitlement({}, NOW).plan, "FREE");
});

test("the first-generation PREMIUM tier is read as PLUS, and nobody is moved up by it", () => {
  assert.equal(resolveEntitlement({ subscriptionTier: "PREMIUM", subscriptionStatus: "ACTIVE" }, NOW).plan, "PLUS");
  // Every existing account is FREE + INACTIVE, and stays Free.
  assert.equal(resolveEntitlement({ subscriptionTier: "FREE", subscriptionStatus: "INACTIVE" }, NOW).plan, "FREE");
});

test("fees are integer, rounded down, and zero where there is no rate", () => {
  const usdc = (dollars) => BigInt(Math.round(dollars * 1_000_000));
  const fx = computeFee({ kind: "card_fx", plan: "FREE", amountBaseUnits: usdc(100) });
  assert.equal(fx.bps, 90);
  assert.equal(fx.feeBaseUnits, 900_000n);
  assert.equal(fx.netBaseUnits, usdc(100) - 900_000n);
  // 0.9 % of 1 base unit is 0.009 of a base unit: never rounded up to 1.
  assert.equal(computeFee({ kind: "card_fx", plan: "FREE", amountBaseUnits: 1n }).feeBaseUnits, 0n);
  assert.equal(computeFee({ kind: "transfer", plan: "FREE", amountBaseUnits: usdc(1_000_000) }).feeBaseUnits, 0n);
  // A higher offer never pays more for the same amount.
  const amount = usdc(1234.56);
  for (const kind of ["ramp", "card_fx", "swap"]) {
    const [a, b, c] = ["FREE", "PLUS", "MAX"].map((plan) => computeFee({ kind, plan, amountBaseUnits: amount }).feeBaseUnits);
    assert.ok(a >= b && b >= c, kind);
  }
  // fee + net always equals the amount.
  for (const n of [1n, 99n, 12345678901234567890n]) {
    const q = computeFee({ kind: "ramp", plan: "PLUS", amountBaseUnits: n });
    assert.equal(q.feeBaseUnits + q.netBaseUnits, n);
  }
  assert.throws(() => computeFee({ kind: "ramp", plan: "FREE", amountBaseUnits: -1n }));
  assert.equal(formatBps(90), "0.90 %");
});

test("miles: whole dollars only, by plan, and nothing for refunds or junk", () => {
  assert.equal(milesForSpend(2599, "FREE"), 25);
  assert.equal(milesForSpend(2599, "PLUS"), 50);
  assert.equal(milesForSpend(2599, "MAX"), 75);
  assert.equal(milesForSpend(99, "MAX"), 0);
  for (const bad of [0, -500, 1.5, NaN, Infinity]) assert.equal(milesForSpend(bad, "MAX"), 0);
});

test("card spend raises the month's allowance, up to a cap", () => {
  assert.equal(sponsorshipAllowance("FREE", 0), 10);
  assert.equal(sponsorshipAllowance("FREE", 4999), 10);
  assert.equal(sponsorshipAllowance("FREE", 5000), 11);
  assert.equal(sponsorshipAllowance("FREE", 10_000_000), 30); // 10 + cap 20
  assert.equal(sponsorshipAllowance("PLUS", 25_000), 70); // 60 + 10
  assert.equal(sponsorshipAllowance("MAX", 10_000_000), 500); // fair-use ceiling, spend adds nothing
});

test("sponsorship: allowance first, then miles, then the person pays, and it says why", () => {
  const base = { plan: "FREE", monthlySpendUsdCents: 0, milesBalance: 0 };
  assert.deepEqual(decideSponsorship({ ...base, sponsoredThisMonth: 0 }), { sponsor: true, via: "allowance", remaining: 9 });
  assert.deepEqual(decideSponsorship({ ...base, sponsoredThisMonth: 9 }), { sponsor: true, via: "allowance", remaining: 0 });
  assert.deepEqual(decideSponsorship({ ...base, sponsoredThisMonth: 10, milesBalance: 45 }), { sponsor: true, via: "miles", milesCost: MILES_PER_SPONSORED_SEND, milesLeft: 25 });
  assert.deepEqual(decideSponsorship({ ...base, sponsoredThisMonth: 10, milesBalance: 19 }), { sponsor: false, reason: "no-allowance-no-miles", milesNeeded: 20, milesShort: 1 });
  // Spending on the card this month reopens the allowance.
  assert.equal(decideSponsorship({ ...base, sponsoredThisMonth: 10, monthlySpendUsdCents: 5000 }).via, "allowance");
  // A corrupt balance never grants anything.
  for (const milesBalance of [-100, NaN]) assert.equal(decideSponsorship({ ...base, sponsoredThisMonth: 10, milesBalance }).sponsor, false);
});

test("allowances reset on the first of the month, UTC", () => {
  assert.equal(monthKey(new Date("2026-10-31T23:59:59Z")), "2026-10");
  assert.equal(monthKey(new Date("2026-11-01T00:00:00Z")), "2026-11");
});
