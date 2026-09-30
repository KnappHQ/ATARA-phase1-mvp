const test = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./lib/loadTs.cjs");

const load = createLoader();
const { cardForReport, cardForRecord, cardForOutbox } = load("utils/operationPresentation.ts");
const { buildCallId } = load("utils/callId.ts");

const USDC = "0x036cbd53842c5426634e7929541ec2318f3dcf7e";
const RECIPIENT = "0x5999000000000000000000000000000000c0204c";
const OP_HASH = `0x${"c6".repeat(32)}`;
const TX = `0x${"7a".repeat(32)}`;
const CALL_ID = buildCallId(84532, OP_HASH);
const assets = [{ symbol: "USDC", decimals: 6, contractAddress: USDC }, { symbol: "ETH", decimals: 18, contractAddress: null }];
const payment = { recipient: RECIPIENT, amount: "10000000", token: USDC };
const base = { ids: { callId: CALL_ID, userOpHash: OP_HASH }, evidence: [], payment };
const NOW = 1_800_000_000_000;

const everyState = () => [
  cardForReport({ status: "pending", ...base, releasable: false }, { assets }),
  cardForReport({ status: "unknown", ...base, releasable: false, reason: "unreachable" }, { assets }),
  cardForReport({ status: "unknown", ...base, releasable: true, reason: "not-found" }, { assets }),
  cardForReport({ status: "unknown", ...base, releasable: false, reason: "no-source" }, { assets }),
  cardForReport({ status: "unknown", ...base, releasable: false, reason: "inconclusive" }, { assets }),
  cardForReport({ status: "busy" }, { assets }),
];

test("only a failed report says the payment did not happen; every other state says it may still go through", () => {
  for (const card of everyState()) {
    const text = (card.title + card.body).replace(/does not mean it failed/g, "");
    assert.doesNotMatch(text, /failed|did not go through|did not happen|no money moved/i, card.title);
    if (card.title !== "Another check is already running") assert.match(card.body, /may still|still processing|still (be )?waiting|is still processing/i, card.title);
  }
  const failed = cardForReport({ status: "failed", ...base, reason: "The network included it, but it reverted, so the payment did not happen." }, { assets });
  assert.equal(failed.tone, "bad");
  assert.match(failed.body, /No money moved/);
  assert.deepEqual(failed.actions.map((a) => a.id), ["dismiss"]);
});

test("an unknown payment always tells the owner not to send it again, and never offers to release it too early", () => {
  for (const card of everyState().slice(1, 5)) {
    assert.match(card.body, /do not send it again/i, card.title);
  }
  const early = cardForReport({ status: "unknown", ...base, releasable: false, reason: "not-found" }, { assets });
  assert.equal(early.actions.some((a) => a.id === "release"), false);
  const later = cardForReport({ status: "unknown", ...base, releasable: true, reason: "not-found" }, { assets });
  assert.equal(later.actions.some((a) => a.id === "release"), true);
  assert.equal(later.actions.find((a) => a.id === "release").destructive, true);
});

test("each identifier is shown under its own name and kept whole, so it can be copied", () => {
  const card = cardForReport({ status: "confirmed", ids: { callId: CALL_ID, userOpHash: OP_HASH, transactionHash: TX }, evidence: [], payment, recording: "queued", via: "provider" }, { assets });
  assert.deepEqual(card.details, [
    { label: "Transaction hash", value: TX },
    { label: "Operation hash", value: OP_HASH },
    { label: "Wallet service id", value: CALL_ID },
  ]);
  assert.equal(card.tone, "good");
  assert.match(card.body, /You do not need to pay again/);
  assert.equal(card.payment, "10 USDC to 0x5999…204c");
});

test("the trail of what was checked is readable and holds no address", () => {
  const card = cardForReport(
    {
      status: "unknown",
      ...base,
      releasable: false,
      reason: "not-found",
      evidence: [
        { at: NOW, source: "provider", result: "unknown", note: "the provider does not know this operation id", code: 5730 },
        { at: NOW, source: "chain", result: "unknown", note: "has no trace of this operation in the period searched", fromBlock: 1200, toBlock: 3400 },
      ],
    },
    { assets },
  );
  assert.deepEqual(card.evidence, [
    "Wallet service: the provider does not know this operation id",
    "Base network: has no trace of this operation in the period searched (blocks 1,200–3,400)",
  ]);
});

test("before any check, a stored payment is shown as waiting, and one caught mid-send says so", () => {
  const record = { v: 2, phase: "submitted", id: CALL_ID, chainId: 84532, fingerprint: JSON.stringify([[USDC, "0", `0xa9059cbb${RECIPIENT.slice(2).padStart(64, "0")}${(10_000_000n).toString(16).padStart(64, "0")}`]]), createdAt: NOW, checks: [] };
  const waiting = cardForRecord(record, { assets });
  assert.equal(waiting.title, "Payment awaiting verification");
  assert.equal(waiting.actions[0].label, "Check now");
  assert.match(waiting.body, /New payments from this account wait/);
  const midSend = cardForRecord({ ...record, phase: "submitting", id: undefined }, { assets });
  assert.equal(midSend.title, "Payment being sent");
  assert.match(midSend.body, /not known whether it left this phone/);
  const failed = cardForRecord({ ...record, phase: "failed", failure: { at: NOW, reason: "The network never included this payment and will not try again." } }, { assets });
  assert.equal(failed.tone, "bad");
  assert.match(failed.body, /never included/);
});

test("a saved payment for another network or account is explained and left alone", () => {
  const network = cardForReport({ status: "foreign", reason: "other-network" }, { assets });
  assert.match(network.title, /another network/);
  assert.deepEqual(network.actions, []);
  const account = cardForReport({ status: "foreign", reason: "other-account" }, { assets });
  assert.match(account.body, /nothing was changed/);
});

test("a payment made and not yet recorded says the money is safe and that only the recording is retried", () => {
  const entry = { v: 1, chainId: 84532, account: "0xaa", transactionHash: TX, receiverAddress: RECIPIENT, assetSymbol: "USDC", rawAmountWei: "10000000", confirmedAt: NOW, attempts: 2, state: "queued", lastReason: "The service had an error." };
  const queued = cardForOutbox(entry, { assets });
  assert.match(queued.body, /went through/);
  assert.match(queued.body, /Nothing will be sent again/);
  assert.deepEqual(queued.actions.map((a) => a.id), ["retry-recording"]);
  assert.equal(queued.payment, "10 USDC to 0x5999…204c");
  const rejected = cardForOutbox({ ...entry, state: "rejected", lastReason: "The service already holds a different payment under this transaction." }, { assets });
  assert.match(rejected.body, /the transaction hash below is your proof/);
  assert.deepEqual(rejected.actions, []);
});
