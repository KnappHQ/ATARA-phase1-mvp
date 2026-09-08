const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

process.env.MOONPAY_API_KEY = "pk_test_atara";
process.env.MOONPAY_SECRET_KEY = "sk_test_atara";
process.env.MOONPAY_WIDGET_URL = "https://buy-sandbox.moonpay.com/";

require("ts-node/register");
const { buildMoonPayWidgetUrl } = require("../services/onramp.service.ts");

test("signs the complete MoonPay query without exposing the secret", () => {
  const unsignedAddress = "0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae";
  const signedUrl = buildMoonPayWidgetUrl({
    walletAddress: unsignedAddress,
    userId: "user-123",
    email: "demo@example.com",
    baseCurrencyAmount: "50.00",
  });
  const signatureMarker = "&signature=";
  const markerIndex = signedUrl.indexOf(signatureMarker);
  assert.ok(markerIndex > 0);
  const unsignedUrl = signedUrl.slice(0, markerIndex);
  const signature = decodeURIComponent(signedUrl.slice(markerIndex + signatureMarker.length));
  const expected = crypto.createHmac("sha256", "sk_test_atara").update(new URL(unsignedUrl).search).digest("base64");
  assert.equal(signature, expected);
  assert.equal(signedUrl.includes("sk_test_atara"), false);
});

test("rejects a non-wallet destination", () => {
  assert.throws(
    () => buildMoonPayWidgetUrl({ walletAddress: "not-an-address", userId: "user" }),
    /valid smart account address/,
  );
});
