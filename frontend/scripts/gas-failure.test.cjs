const test = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./lib/loadTs.cjs");

const { isSponsorRefusal } = createLoader()("utils/gasFailure.ts");

test("refusals by the fee sponsor are recognised", () => {
  for (const message of [
    "Paymaster rejected the request",
    "Gas sponsorship limit reached for this policy",
    "request denied by Gas Manager policy",
    "Quota exceeded",
    "insufficient funds for gas * price + value",
  ]) {
    assert.equal(isSponsorRefusal(message), true, message);
  }
});

test("the network refusing the payment itself is not blamed on sponsorship", () => {
  for (const message of [
    "UserOperation reverted during simulation with reason: ERC20: transfer amount exceeds balance",
    "validation reverted: AA23 reverted",
    "AA23 reverted (or OOG)",
    "execution reverted",
    "Network request failed",
  ]) {
    assert.equal(isSponsorRefusal(message), false, message);
  }
});
