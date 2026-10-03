const test = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./lib/loadTs.cjs");

const fee = createLoader()("utils/networkFee.ts");
const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const quote = (maxAmount, extra = {}) => ({ feePayment: { sponsored: false, tokenAddress: USDC, maxAmount, ...extra } });

test("a fee is shown as a rounded-up amount, as less than a cent, or as unavailable, never as 0", () => {
  assert.equal(fee.formatFee(3_000n), "less than $0.01");
  assert.equal(fee.formatFee(9_999n), "less than $0.01");
  assert.equal(fee.formatFee(10_000n), "about $0.01");
  assert.equal(fee.formatFee(10_001n), "about $0.02");
  assert.equal(fee.formatFee(21_000n), "about $0.03");
  assert.equal(fee.formatFee(1_230_000n), "about $1.23");
  assert.equal(fee.formatFee(0n), "Unavailable");
  assert.equal(fee.formatFee(-5n), "Unavailable");
});

test("USDC amounts are exact: no floating point drift", () => {
  assert.equal(fee.formatUsdc(24_970_000n), "24.97");
  assert.equal(fee.formatUsdc(25_000_000n), "25");
  assert.equal(fee.formatUsdc(1n), "0.000001");
  assert.equal(fee.toBaseUnits("0.1", 6), 100_000n);
  assert.equal(fee.toBaseUnits("0.30000000004", 6), 300_000n, "extra decimals are cut off, never rounded up");
  assert.equal(fee.toBaseUnits("1,000.5", 6), 1_000_500_000n);
  assert.equal(fee.toBaseUnits("", 6), null);
  assert.equal(fee.toBaseUnits(".", 6), null);
  assert.equal(fee.toBaseUnits("abc", 6), null);
  assert.equal(fee.toBaseUnits("-1", 6), null);
  assert.equal(fee.toBaseUnits("5.", 6), 5_000_000n);
});

test("what can be sent is the balance minus the largest fee, never negative", () => {
  assert.equal(fee.maxSendable(25_000_000n, 30_000n), 24_970_000n);
  assert.equal(fee.maxSendable(20_000n, 30_000n), 0n);
  assert.equal(fee.maxSendable(30_000n, 30_000n), 0n);
});

test("checkFee: unknown fee or balance blocks, and amount plus fee must fit for USDC", () => {
  const base = { tokenSymbol: "USDC", amountBase: 25_000_000n, usdcBalance: 25_030_000n };
  assert.deepEqual(fee.checkFee({ ...base, feeState: "ready", maxFee: 30_000n }), { ok: true });
  const tight = fee.checkFee({ ...base, usdcBalance: 25_020_000n, feeState: "ready", maxFee: 30_000n });
  assert.equal(tight.ok, false);
  assert.equal(tight.reason, "not-enough-for-fee");
  assert.equal(tight.maxSendable, 24_990_000n);
  assert.equal(fee.checkFee({ ...base, feeState: "loading", maxFee: null }).reason, "estimating");
  assert.equal(fee.checkFee({ ...base, feeState: "unavailable", maxFee: null }).reason, "unavailable");
  assert.equal(fee.checkFee({ ...base, feeState: "ready", maxFee: 0n }).reason, "unavailable");
  assert.equal(fee.checkFee({ ...base, feeState: "ready", maxFee: 30_000n, usdcBalance: null }).reason, "unavailable");
});

test("sending another token needs only a little USDC for the fee", () => {
  const input = { tokenSymbol: "USDT", amountBase: 5_000_000n, feeState: "ready", maxFee: 30_000n };
  assert.deepEqual(fee.checkFee({ ...input, usdcBalance: 30_000n }), { ok: true });
  assert.equal(fee.checkFee({ ...input, usdcBalance: 29_999n }).reason, "not-enough-usdc-for-fee");
  assert.equal(fee.checkFee({ ...input, usdcBalance: 0n }).reason, "not-enough-usdc-for-fee");
});

test("messages are plain words and name the fee when it is known", () => {
  const short = fee.checkFee({ tokenSymbol: "USDC", amountBase: 25_000_000n, usdcBalance: 25_010_000n, feeState: "ready", maxFee: 20_000n });
  assert.equal(fee.feeCheckMessage(short, 20_000n), "Not enough USDC to cover this amount and the network fee (about $0.02).");
  assert.equal(fee.feeCheckMessage({ ok: false, reason: "not-enough-usdc-for-fee" }, 20_000n), "You need a little USDC (about $0.02) to pay the network fee.");
  assert.match(fee.feeCheckMessage({ ok: false, reason: "unavailable" }, null), /Network fee unavailable/);
  assert.equal(fee.feeCheckMessage({ ok: false, reason: "estimating" }, null), null);
  assert.equal(fee.feeCheckMessage({ ok: true }, 1n), null);
  for (const text of Object.values(fee.FEE_MESSAGES)) assert.doesNotMatch(text, /gas|paymaster|sponsor|userop|AA\d\d|viem|rpc/i);
});

test("a fee that grew by more than a quarter is a change; a quarter or less is not", () => {
  assert.equal(fee.feeChangedTooMuch(20_000n, 25_000n), false);
  assert.equal(fee.feeChangedTooMuch(20_000n, 25_001n), true);
  assert.equal(fee.feeChangedTooMuch(20_000n, 10_000n), false);
});

test("readFeeQuote accepts only an unsponsored USDC quote with a positive maximum", () => {
  assert.equal(fee.readFeeQuote(quote(30_000n), USDC), 30_000n);
  assert.equal(fee.readFeeQuote(quote(30_000n, { tokenAddress: USDC.toLowerCase() }), USDC), 30_000n);
  assert.equal(fee.readFeeQuote(quote(0n), USDC), null);
  assert.equal(fee.readFeeQuote(quote(30_000n, { sponsored: true }), USDC), null);
  assert.equal(fee.readFeeQuote(quote(30_000n, { tokenAddress: "0x0000000000000000000000000000000000000001" }), USDC), null);
  assert.equal(fee.readFeeQuote(quote("30000"), USDC), null);
  assert.equal(fee.readFeeQuote({}, USDC), null);
  assert.equal(fee.readFeeQuote(null, USDC), null);
});

test("the guard stops a payment before signing unless the fee is known, did not jump, and fits", () => {
  const guard = { shownMaxFee: 30_000n, usdcAddress: USDC, usdcBalance: 26_000_000n, payingUsdc: 25_000_000n };
  assert.equal(fee.assertFeeAcceptable(quote(30_000n), guard), 30_000n);
  assert.equal(fee.assertFeeAcceptable(quote(37_500n), guard), 37_500n, "up to +25% is accepted");
  const code = (run) => { try { run(); } catch (error) { assert.equal(error.notSent, true); return error.code; } return null; };
  assert.equal(code(() => fee.assertFeeAcceptable({}, guard)), "FEE_UNAVAILABLE", "no quote");
  assert.equal(code(() => fee.assertFeeAcceptable(quote(30_000n), { ...guard, shownMaxFee: null })), "FEE_UNAVAILABLE", "nothing was shown");
  assert.equal(code(() => fee.assertFeeAcceptable(quote(30_000n), { ...guard, usdcBalance: null })), "FEE_UNAVAILABLE");
  assert.equal(code(() => fee.assertFeeAcceptable(quote(37_501n), guard)), "FEE_CHANGED");
  assert.equal(code(() => fee.assertFeeAcceptable(quote(30_000n), { ...guard, usdcBalance: 25_020_000n })), "FEE_INSUFFICIENT");
  assert.equal(fee.assertFeeAcceptable(quote(30_000n), { ...guard, payingUsdc: 0n, usdcBalance: 30_000n }), 30_000n, "another token: only the fee has to fit");
});

test("fee failures reach the person in plain words", () => {
  assert.equal(fee.feeFailureMessage(new fee.FeeError("FEE_CHANGED", fee.FEE_MESSAGES.FEE_CHANGED)), fee.FEE_MESSAGES.FEE_CHANGED);
  assert.equal(fee.feeFailureMessage({ code: "FEE_UNAVAILABLE" }), fee.FEE_MESSAGES.FEE_UNAVAILABLE);
  assert.equal(fee.feeFailureMessage(new Error("Paymaster rejected the request")), fee.FEE_MESSAGES.SERVICE_DOWN);
  assert.equal(fee.feeFailureMessage(new Error("Network request failed")), null);
});

test("the review lines say what the fee is, or that it is not known, and what leaves the account", () => {
  assert.equal(fee.feeLineLabel("loading", null), "Estimating…");
  assert.equal(fee.feeLineLabel("unavailable", null), "Unavailable");
  assert.equal(fee.feeLineLabel("ready", 0n), "Unavailable");
  assert.equal(fee.feeLineLabel("ready", 20_000n), "about $0.02");
  assert.equal(fee.leavesAccountLabel("25", "USDC", 30_000n), "25 USDC + up to 0.03 USDC fee");
  assert.equal(fee.leavesAccountLabel("5", "USDT", 30_000n), "5 USDT + up to 0.03 USDC fee");
  assert.equal(fee.leavesAccountLabel("25", "USDC", null), "25 USDC + network fee");
});
