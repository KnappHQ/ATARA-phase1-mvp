import test from "node:test";
import assert from "node:assert/strict";
import { ethers } from "ethers";
import { sumErc20Transfers, type MinimalLog } from "./chainVerifier";

/**
 * Regression tests for the settlement/sync verification bypass.
 *
 * Run with:  npx tsx --test utils/chainVerifier.test.ts
 *        or: npx ts-node --test utils/chainVerifier.test.ts
 */

const TRANSFER_TOPIC = ethers.utils.id("Transfer(address,address,uint256)");

const REAL_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const FAKE_USDC = "0xDeaDbeefDEAdbeefdEAdbEEFdeadbeEFdEaDbeeF";

const ALICE = "0x1111111111111111111111111111111111111111";
const BOB = "0x2222222222222222222222222222222222222222";
const MALLORY = "0x3333333333333333333333333333333333333333";

const asTopic = (address: string) =>
  ethers.utils.hexZeroPad(address.toLowerCase(), 32);

const transferLog = (
  token: string,
  from: string,
  to: string,
  rawAmount: string,
): MinimalLog => ({
  address: token,
  topics: [TRANSFER_TOPIC, asTopic(from), asTopic(to)],
  data: ethers.utils.hexZeroPad(ethers.BigNumber.from(rawAmount).toHexString(), 32),
});

test("accepts a genuine USDC transfer and reports the on-chain amount", () => {
  const logs = [transferLog(REAL_USDC, ALICE, BOB, "25000000")]; // 25 USDC

  const total = sumErc20Transfers(logs, REAL_USDC, ALICE, BOB);

  assert.notEqual(total, null);
  assert.equal(total!.toString(), "25000000");
});

test("rejects a look-alike token that merely calls itself USDC", () => {
  // The whole exploit: deploy an ERC-20 whose symbol() returns "USDC" and send
  // a large amount. The old check compared symbols, so this passed.
  const logs = [transferLog(FAKE_USDC, ALICE, BOB, "10000000000")];

  assert.equal(sumErc20Transfers(logs, REAL_USDC, ALICE, BOB), null);
});

test("rejects a transfer that went to somebody else", () => {
  const logs = [transferLog(REAL_USDC, ALICE, MALLORY, "25000000")];

  assert.equal(sumErc20Transfers(logs, REAL_USDC, ALICE, BOB), null);
});

test("rejects a third party's transaction the caller did not send", () => {
  const logs = [transferLog(REAL_USDC, MALLORY, BOB, "25000000")];

  assert.equal(sumErc20Transfers(logs, REAL_USDC, ALICE, BOB), null);
});

test("ignores unrelated logs in the same transaction", () => {
  const logs = [
    transferLog(FAKE_USDC, ALICE, BOB, "999999999999"),
    transferLog(REAL_USDC, MALLORY, BOB, "500000"),
    transferLog(REAL_USDC, ALICE, BOB, "1000000"),
    { address: REAL_USDC, topics: ["0xdeadbeef"], data: "0x" },
  ];

  const total = sumErc20Transfers(logs, REAL_USDC, ALICE, BOB);

  assert.equal(total!.toString(), "1000000");
});

test("sums multiple matching transfers within one transaction", () => {
  const logs = [
    transferLog(REAL_USDC, ALICE, BOB, "1000000"),
    transferLog(REAL_USDC, ALICE, BOB, "2500000"),
  ];

  assert.equal(sumErc20Transfers(logs, REAL_USDC, ALICE, BOB)!.toString(), "3500000");
});

test("a transaction with no transfers at all is a refusal, not a zero", () => {
  assert.equal(sumErc20Transfers([], REAL_USDC, ALICE, BOB), null);
});
