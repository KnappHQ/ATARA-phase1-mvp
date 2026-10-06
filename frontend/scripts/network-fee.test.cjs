const test = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./lib/loadTs.cjs");

const load = createLoader();
const fee = load("utils/networkFee.ts");
const { createFeeEstimator } = load("utils/feeEstimator.ts");

const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const prepared = (maxAmount, extra = {}) => ({ type: "user-operation-v070", feePayment: { sponsored: false, tokenAddress: USDC, maxAmount, ...extra } });
const usdc = (text) => fee.parseUnits(text, 6);

test("a fee is shown in plain words and is never zero", () => {
  assert.equal(fee.formatNetworkFee(21_000n), "about $0.03", "rounded up: never below the real maximum");
  assert.equal(fee.formatNetworkFee(20_000n), "about $0.02");
  assert.equal(fee.formatNetworkFee(3_000n), "less than $0.01");
  assert.equal(fee.formatNetworkFee(10_000n), "about $0.01");
  for (const missing of [0n, -1n, null, undefined]) assert.equal(fee.formatNetworkFee(missing), "Unavailable");
  assert.doesNotMatch(fee.formatNetworkFee(0n), /\$0/);
});

test("amounts are whole base units, with no float drift on six decimals", () => {
  assert.equal(fee.parseUnits("24.97", 6), 24_970_000n);
  assert.equal(fee.parseUnits("0.1", 6) + fee.parseUnits("0.2", 6), fee.parseUnits("0.3", 6));
  assert.equal(fee.parseUnits("1.1234567", 6), null, "more decimals than the token has");
  assert.equal(fee.parseUnits("abc", 6), null);
  assert.equal(fee.parseUnits("", 6), null);
  assert.equal(fee.formatUnits(24_970_000n, 6, 0), "24.97");
  assert.equal(fee.formatUnits(24_000_000n, 6, 0), "24");
  assert.equal(fee.formatUnits(24_000_000n, 6), "24.00");
  assert.equal(fee.formatUsdc(24_970_000n), "24.97 USDC");
});

test("MAX is the balance minus the largest fee, and needs a real fee", () => {
  assert.equal(fee.maxSendable(usdc("25"), 30_000n), 24_970_000n);
  assert.equal(fee.maxSendable(10_000n, 30_000n), 0n, "a balance below the fee leaves nothing to send");
  for (const none of [null, undefined, 0n]) assert.equal(fee.maxSendable(usdc("25"), none), null, "no guessed fee");
  assert.equal(fee.roundDownToDecimals(24_976_543n, 6, 2), 24_970_000n);
  assert.equal(fee.roundDownToDecimals(5n, 6, 18), 5_000_000_000_000n);
});

test("a USDC send must cover the amount and the fee; another token needs a little USDC", () => {
  const base = { sendingFeeToken: true, tokenBalance: usdc("25"), feeTokenBalance: usdc("25"), maxFee: 30_000n };
  assert.deepEqual(fee.checkFunds({ ...base, amount: usdc("24.97") }), { ok: true });
  const short = fee.checkFunds({ ...base, amount: usdc("25") });
  assert.equal(short.ok, false);
  assert.equal(short.message, "Not enough USDC to cover this amount and the network fee (about $0.03).");
  assert.equal(short.maxSend, 24_970_000n, "the Send max amount");
  assert.deepEqual(fee.checkFunds({ ...base, sendingFeeToken: false, tokenBalance: usdc("500"), amount: usdc("500") }), { ok: true });
  const noUsdc = fee.checkFunds({ ...base, sendingFeeToken: false, feeTokenBalance: 0n, amount: 1n });
  assert.equal(noUsdc.ok, false);
  assert.equal(noUsdc.message, "You need a little USDC (about $0.03) to pay the network fee.");
  assert.equal(noUsdc.maxSend, undefined);
});

test("the review says what leaves the account, with the fee", () => {
  assert.equal(fee.formatLeavesAccount({ amount: "25.00", tokenSymbol: "USDC", maxFee: 30_000n }), "25.00 USDC + fee (max 25.03 USDC)");
  assert.equal(fee.formatLeavesAccount({ amount: "25", tokenSymbol: "USDT", maxFee: 20_000n }), "25 USDT + network fee about $0.02 in USDC");
  assert.equal(fee.formatLeavesAccount({ amount: "25", tokenSymbol: "USDC", maxFee: null }), "25 USDC + network fee", "no number without a real fee");
});

test("the fee may rise 25 percent between the review and the signature, not more", () => {
  assert.equal(fee.feeChangedTooMuch(20_000n, 25_000n), false, "exactly +25%");
  assert.equal(fee.feeChangedTooMuch(20_000n, 25_001n), true);
  assert.equal(fee.feeChangedTooMuch(20_000n, 5_000n), false, "a lower fee never blocks");
});

test("the real quote is read before signing: no real fee, a changed fee or a short balance stop the payment", () => {
  const guard = { shownMaxFee: 20_000n, amount: usdc("10"), sendingFeeToken: true, tokenBalance: usdc("25"), feeTokenBalance: usdc("25") };
  assert.equal(fee.checkPreparedFee(prepared(22_000n), USDC, guard), 22_000n);
  assert.equal(fee.checkPreparedFee(prepared(22_000n), USDC.toLowerCase(), guard), 22_000n);
  assert.throws(() => fee.checkPreparedFee(prepared(22_000n), USDC), (error) => error.code === "FEE_UNAVAILABLE" && error.notSent === true, "no fee was shown: nothing is signed");
  const code = (run) => { try { run(); } catch (error) { assert.equal(error.notSent, true); return error.code; } return null; };
  assert.equal(code(() => fee.checkPreparedFee({ type: "user-operation-v070" }, USDC, guard)), "FEE_UNAVAILABLE", "no feePayment");
  assert.equal(code(() => fee.checkPreparedFee(prepared(0n), USDC, guard)), "FEE_UNAVAILABLE", "a zero fee is not a fee");
  assert.equal(code(() => fee.checkPreparedFee(prepared(20_000n, { sponsored: true }), USDC, guard)), "FEE_UNAVAILABLE", "a sponsored quote is not what was shown");
  assert.equal(code(() => fee.checkPreparedFee(prepared(20_000n, { tokenAddress: "0x" + "1".repeat(40) }), USDC, guard)), "FEE_UNAVAILABLE", "another token");
  assert.equal(code(() => fee.checkPreparedFee(prepared(30_000n), USDC, guard)), "FEE_CHANGED");
  assert.equal(code(() => fee.checkPreparedFee(prepared(24_000n), USDC, { ...guard, amount: usdc("24.99") })), "FEE_CHANGED", "no longer fits the balance");
  assert.equal(code(() => fee.checkPreparedFee(prepared(22_000n), USDC, { ...guard, sendingFeeToken: false, feeTokenBalance: 10n })), "FEE_INSUFFICIENT");
  assert.equal(fee.FEE_MESSAGES.FEE_CHANGED, "The network fee changed. Please check and confirm again.");
});

test("a bare sponsorship answer never passes for a fee", () => {
  assert.equal(fee.usableFee({ feePayment: { sponsored: true, tokenAddress: USDC, maxAmount: 0n } }, USDC), null);
});

test("provider failures about the fee get plain messages", () => {
  assert.equal(fee.classifyFeeFailure("AA21 didn't pay prefund"), "FEE_INSUFFICIENT");
  assert.equal(fee.classifyFeeFailure("AA33 reverted (or OOG)"), "FEE_SERVICE");
  assert.equal(fee.classifyFeeFailure("Gas Manager policy not found"), "FEE_SERVICE");
  assert.equal(fee.classifyFeeFailure("paymaster rejected"), "FEE_SERVICE");
  assert.equal(fee.classifyFeeFailure("Request timed out"), null);
  // Errors of the payment itself are not fee errors: they keep their own cause.
  for (const message of [
    "UserOperation reverted during simulation with reason: Ownable: caller is not the owner",
    "execution reverted: ERC20: transfer amount exceeds balance",
    "AA23 reverted",
    "validation reverted",
    "rate limit reached",
    "Quota exceeded",
  ]) assert.equal(fee.classifyFeeFailure(message), null, message);
  for (const text of Object.values(fee.FEE_MESSAGES)) assert.doesNotMatch(text, /gas|paymaster|sponsor/i);
});

test("the balance of an asset comes from base units when known", () => {
  assert.equal(fee.assetBaseUnits({ balance: "25.00", balanceWei: "25000000", decimals: 6 }), 25_000_000n);
  assert.equal(fee.assetBaseUnits({ balance: "25.5", decimals: 6 }), 25_500_000n);
  assert.equal(fee.assetBaseUnits({ balance: "n/a", decimals: 6 }), null);
  assert.equal(fee.assetBaseUnits(undefined), null);
});

test("the funds check for a draft waits for a real fee and names Send max for USDC only", () => {
  const draft = { tokenSymbol: "USDC", tokenBalance: usdc("25"), feeTokenBalance: usdc("25") };
  assert.deepEqual(fee.assessSend({ ...draft, amountUnits: usdc("25"), maxFee: null }), { fundsMessage: null, maxSend: null });
  const usdcShort = fee.assessSend({ ...draft, amountUnits: usdc("25"), maxFee: 30_000n });
  assert.equal(usdcShort.maxSend, 24_970_000n);
  assert.match(usdcShort.fundsMessage, /Not enough USDC/);
  const other = fee.assessSend({ tokenSymbol: "ETH", tokenBalance: 10n ** 18n, feeTokenBalance: 0n, amountUnits: 1n, maxFee: 30_000n });
  assert.equal(other.maxSend, null);
  assert.match(other.fundsMessage, /You need a little USDC/);
});

test("the estimator shows only the newest answer and never a default fee", async () => {
  const seen = [];
  let resolveFirst;
  const answers = [new Promise((resolve) => (resolveFirst = resolve)), Promise.resolve(30_000n)];
  const estimator = createFeeEstimator(() => answers.shift(), (quote) => seen.push(quote));
  const first = estimator.run();
  const second = estimator.run();
  await second;
  resolveFirst(99n); // an old recipient's slow answer arrives last
  await first;
  assert.deepEqual(seen.at(-1), { status: "ready", maxFee: 30_000n });
  assert.equal(seen.some((quote) => quote.status === "ready" && quote.maxFee === 99n), false);

  for (const bad of [() => Promise.reject(new Error("boom")), () => Promise.resolve(0n), () => Promise.resolve(undefined)]) {
    const states = [];
    await createFeeEstimator(bad, (quote) => states.push(quote)).run();
    assert.deepEqual(states, [{ status: "loading" }, { status: "unavailable" }]);
  }
});

test("no user-facing fee text uses sponsorship words", () => {
  const texts = [
    fee.formatNetworkFee(20_000n),
    fee.formatNetworkFee(null),
    fee.formatLeavesAccount({ amount: "1", tokenSymbol: "USDC", maxFee: 20_000n }),
    fee.formatLeavesAccount({ amount: "1", tokenSymbol: "ETH", maxFee: 20_000n }),
    ...Object.values(fee.FEE_MESSAGES),
  ];
  for (const text of texts) assert.doesNotMatch(text, /gas|paymaster|sponsor/i);
});

test("a balance that was never read is unknown, and says nothing about funds", () => {
  assert.equal(fee.assetBaseUnits({ balance: "", decimals: 6 }), null);
  assert.equal(fee.assetBaseUnits({ balance: "  ", decimals: 6 }), null);
  assert.equal(fee.assetBaseUnits({ balance: "0", decimals: 6 }), 0n, "a real zero stays zero");
  const unknown = { tokenSymbol: "USDC", amountUnits: usdc("5"), maxFee: 30_000n };
  assert.deepEqual(fee.assessSend({ ...unknown, tokenBalance: null, feeTokenBalance: null }), { fundsMessage: null, maxSend: null });
  assert.deepEqual(
    fee.assessSend({ tokenSymbol: "ETH", amountUnits: 1n, maxFee: 30_000n, tokenBalance: 10n ** 18n, feeTokenBalance: null }),
    { fundsMessage: null, maxSend: null },
    "no 'You need a little USDC' while the USDC balance is unread",
  );
  assert.match(fee.assessSend({ tokenSymbol: "ETH", amountUnits: 1n, maxFee: 30_000n, tokenBalance: 10n ** 18n, feeTokenBalance: 0n }).fundsMessage, /little USDC/);
});
