const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.NODE_ENV = "test";
process.env.CARD_WEBHOOK_SECRET = "whsec_test";

require("ts-node/register");
const request = require("supertest");
const app = require("../app.ts").default;
const { parseAtaraEvent, hmacHex, safeEqualHex } = require("../services/card/provider.ts");

const sign = (body) => crypto.createHmac("sha256", process.env.CARD_WEBHOOK_SECRET).update(body).digest("hex");
const post = (provider, body, signature) => {
  const req = request(app).post(`/api/v1/card/webhook/${provider}`).set("Content-Type", "application/json");
  if (signature !== undefined) req.set("x-atara-signature", signature);
  return req.send(body);
};
const purchase = JSON.stringify({ eventId: "evt_1", type: "purchase", userRef: "u1", purchaseId: "p1", amountUsdCents: 2599 });

test("with no card provider configured, every webhook is refused before anything is read", async () => {
  delete process.env.CARD_PROVIDER;
  assert.equal((await post("sandbox", purchase, sign(purchase))).status, 503);
  assert.equal((await post("rain", purchase, sign(purchase))).status, 503);
});

test("Rain's slot refuses everything until it is implemented from Rain's own documentation", async () => {
  process.env.CARD_PROVIDER = "rain";
  assert.equal((await post("rain", purchase, sign(purchase))).status, 503);
  delete process.env.CARD_PROVIDER;
});

test("a webhook for another provider than the configured one is refused", async () => {
  process.env.CARD_PROVIDER = "sandbox";
  assert.equal((await post("rain", purchase, sign(purchase))).status, 503);
  delete process.env.CARD_PROVIDER;
});

test("a missing, wrong or truncated signature is refused with 401", async () => {
  process.env.CARD_PROVIDER = "sandbox";
  const good = sign(purchase);
  for (const signature of [undefined, "", "deadbeef", good.slice(0, -2), `${good}00`, sign(`${purchase} `)]) {
    const response = await post("sandbox", purchase, signature);
    assert.equal(response.status, 401, String(signature));
  }
  delete process.env.CARD_PROVIDER;
});

test("the signature covers the exact bytes: a body altered after signing is refused", async () => {
  process.env.CARD_PROVIDER = "sandbox";
  const signature = sign(purchase);
  const tampered = purchase.replace("2599", "9999");
  assert.equal((await post("sandbox", tampered, signature)).status, 401);
  delete process.env.CARD_PROVIDER;
});

test("the sandbox provider is refused outright in production", async () => {
  const { getCardProvider } = require("../services/card/provider.ts");
  process.env.CARD_PROVIDER = "sandbox";
  const provider = getCardProvider();
  assert.equal(provider.configured(), true); // NODE_ENV is "test" here
  delete process.env.CARD_PROVIDER;
  // The production guard reads NODE_ENV from utils/constants at import time, so it
  // is asserted on the source: a sandbox must never serve real traffic.
  const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "../services/card/provider.ts"), "utf8");
  assert.match(source, /NODE_ENV !== "production" && !!secret/);
  assert.match(source, /if \(NODE_ENV === "production" \|\| !secret\) return false;/);
});

test("events are reduced to the few fields ATARA acts on, and malformed ones are dropped", () => {
  assert.deepEqual(parseAtaraEvent({ eventId: "e", type: "purchase", userRef: "u", purchaseId: "p", amountUsdCents: 100, cardNumber: "4111111111111111", merchant: "X" }), {
    eventId: "e", type: "purchase", userRef: "u", purchaseId: "p", amountUsdCents: 100,
  });
  assert.deepEqual(parseAtaraEvent({ eventId: "e", type: "refund", userRef: "u", purchaseId: "p" }), { eventId: "e", type: "refund", userRef: "u", purchaseId: "p" });
  assert.deepEqual(parseAtaraEvent({ eventId: "e", type: "card_frozen" }), { eventId: "e", type: "other" });
  for (const bad of [
    null, "x", {}, { eventId: "" }, { eventId: "e", type: "purchase" },
    { eventId: "e", type: "purchase", userRef: "u", purchaseId: "p", amountUsdCents: 0 },
    { eventId: "e", type: "purchase", userRef: "u", purchaseId: "p", amountUsdCents: -5 },
    { eventId: "e", type: "purchase", userRef: "u", purchaseId: "p", amountUsdCents: 12.5 },
    { eventId: "e", type: "purchase", userRef: "u", purchaseId: "p", amountUsdCents: "100" },
    { eventId: "e", type: "purchase", userRef: "u", purchaseId: "p", amountUsdCents: 10_000_001 },
    { eventId: "e", type: "refund", userRef: "u" },
  ]) assert.equal(parseAtaraEvent(bad), null, JSON.stringify(bad));
});

test("signature comparison is exact and length-safe", () => {
  assert.equal(safeEqualHex("abc", "abc"), true);
  assert.equal(safeEqualHex("abc", "abd"), false);
  assert.equal(safeEqualHex("abc", "abcd"), false);
  assert.equal(hmacHex("k", Buffer.from("x")).length, 64);
});
