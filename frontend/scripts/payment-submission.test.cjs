const test = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./lib/loadTs.cjs");

const load = createLoader();
const { createPaymentOperations } = load("services/paymentOperations.ts");
const { submitAndConfirm, fingerprintOf, wasRefused } = load("services/paymentSubmission.ts");
const { buildCallId } = load("utils/callId.ts");
const { runExclusiveOperation } = load("utils/exclusiveOperation.ts");
const { keyForOperation } = load("utils/operationRecord.ts");

const CHAIN = 84532;
const USDC = "0x036cbd53842c5426634e7929541ec2318f3dcf7e";
const RECIPIENT = "0x5999000000000000000000000000000000c0204c";
const ACCOUNT = "0xaaaa00000000000000000000000000000000000a";
const OTHER = "0xbbbb00000000000000000000000000000000000b";
const OP_HASH = `0x${"c6".repeat(32)}`;
const TX = `0x${"7a".repeat(32)}`;
const CALL_ID = buildCallId(CHAIN, OP_HASH);
const T0 = 1_800_000_000_000;

const transferData = (to, amount) =>
  `0xa9059cbb${to.slice(2).toLowerCase().padStart(64, "0")}${amount.toString(16).padStart(64, "0")}`;
const calls = (amount = 10_000_000n) => [{ target: USDC, value: 0n, data: transferData(RECIPIENT, amount) }];
const CONFIRMED = { statusCode: 200, receipts: [{ transactionHash: TX }] };

const fakeStorage = () => {
  const map = new Map();
  return {
    map,
    getItem: async (key) => (map.has(key) ? map.get(key) : null),
    setItem: async (key, value) => void map.set(key, value),
    removeItem: async (key) => void map.delete(key),
    getAllKeys: async () => [...map.keys()],
  };
};

const rpcError = (message, extra = {}) => Object.assign(new Error(message), extra);

/** A wallet service double that remembers what it was asked, in order. */
const setup = ({ statuses = [CONFIRMED], prepared, send, sign, prepare, storage = fakeStorage() } = {}) => {
  let clock = T0;
  let statusCalls = 0;
  const log = [];
  const provider = {
    getCallsStatus: async () => {
      const answer = statuses[Math.min(statusCalls++, statuses.length - 1)];
      if (answer instanceof Error) throw answer;
      return answer;
    },
  };
  const ops = createPaymentOperations({
    storage,
    chainId: CHAIN,
    provider,
    chain: { findUserOperation: async () => ({ status: "not-found", fromBlock: 1, toBlock: 2, complete: true }) },
    now: () => clock,
    symbolForToken: () => "USDC",
    lock: runExclusiveOperation,
  });
  const client = {
    prepareCalls: async (params) => {
      log.push("prepare");
      if (prepare) return prepare(params);
      return prepared ?? { type: "user-operation-v070", details: { data: { hash: OP_HASH } }, signatureRequest: {} };
    },
    signPreparedCalls: async (value) => {
      log.push("sign");
      if (sign) return sign(value);
      return { ...value, signature: { type: "secp256k1", data: "0x00" } };
    },
    sendPreparedCalls: async (params) => {
      log.push("send");
      // Whatever happens next, the intent must already be on the phone.
      const stored = JSON.parse(storage.map.get(keyForOperation(CHAIN, ACCOUNT)) ?? "null");
      log.push(stored ? `stored:${stored.phase}:${stored.userOpHash ?? "no-hash"}` : "stored:none");
      if (send) return send(params);
      return { id: CALL_ID };
    },
    sendCalls: async () => {
      log.push("sendCalls");
      const stored = JSON.parse(storage.map.get(keyForOperation(CHAIN, ACCOUNT)) ?? "null");
      log.push(stored ? `stored:${stored.phase}:${stored.userOpHash ?? "no-hash"}` : "stored:none");
      return { id: CALL_ID };
    },
  };
  const run = (overrides = {}) =>
    submitAndConfirm({
      client,
      ops,
      account: ACCOUNT,
      calls: calls(),
      overrides: { paymaster: { policyId: "policy-1" } },
      sleep: async (ms) => void (clock += ms),
      now: () => clock,
      waitMs: 10_000,
      pollMs: 2_500,
      ...overrides,
    });
  return { run, ops, storage, log, client, tick: (ms) => (clock += ms) };
};

const stored = (storage, account = ACCOUNT) => JSON.parse(storage.map.get(keyForOperation(CHAIN, account)) ?? "null");

test("the payment is stored, with its hash, before the request that can move money is sent", async () => {
  const { run, log, storage, ops } = setup();
  const result = await run();
  assert.deepEqual(log.slice(0, 4), ["prepare", "sign", "send", `stored:submitting:${OP_HASH}`]);
  assert.equal(result.hash, TX);
  assert.equal(result.userOpHash, OP_HASH);
  assert.equal(stored(storage), null, "cleared once proven");
  const [entry] = await ops.outbox.list(ACCOUNT);
  assert.equal(entry.transactionHash, TX, "queued for recording before the pending record went away");
});

test("a request that may have been accepted is kept, and nothing can be sent on top of it", async () => {
  const { run, storage, log } = setup({ send: () => Promise.reject(rpcError("Request timed out", { name: "TimeoutError" })) });
  await assert.rejects(run(), (error) => error.isPendingVerification === true);
  const record = stored(storage);
  assert.equal(record.phase, "submitting");
  assert.equal(record.userOpHash, OP_HASH);
  assert.equal(record.checks.at(-1).source, "send");

  const before = log.length;
  await assert.rejects(run(), (error) => error.isPendingVerification === true && error.notSent === true);
  assert.equal(log.slice(before).includes("prepare"), false, "the second attempt asked the provider for nothing");
});

test("a request the provider refused outright leaves nothing behind, so the retry with gas can proceed", async () => {
  const { run, storage } = setup({ send: () => Promise.reject(rpcError("policy limit reached", { code: -32000 })) });
  await assert.rejects(run(), /policy limit/);
  assert.equal(stored(storage), null);
});

test("declining to sign, or a preparation error, sends nothing and stores nothing", async () => {
  const declined = setup({ sign: () => Promise.reject(new Error("User rejected")) });
  await assert.rejects(declined.run(), /User rejected/);
  assert.equal(stored(declined.storage), null);
  assert.equal(declined.log.includes("send"), false);

  const paymaster = setup({ prepare: () => Promise.reject(new Error("paymaster policy rejected")) });
  await assert.rejects(paymaster.run(), /paymaster policy/);
  assert.equal(stored(paymaster.storage), null);
});

test("an explicit failure while waiting is reported as failed and frees the account", async () => {
  const { run, storage } = setup({ statuses: [{ statusCode: 110 }, { statusCode: 500 }] });
  await assert.rejects(run(), (error) => error.definitiveFailure === true && /reverted/.test(error.message));
  assert.equal(stored(storage), null);
});

test("waiting that runs out is not a failure: the payment stays recorded with its id", async () => {
  const { run, storage } = setup({ statuses: [{ statusCode: 100 }] });
  await assert.rejects(run(), (error) => error.isPendingVerification === true && !error.definitiveFailure);
  const record = stored(storage);
  assert.equal(record.phase, "submitted");
  assert.equal(record.id, CALL_ID);
});

test("an earlier payment that has since confirmed is answered with, and the same request is not sent twice", async () => {
  const { run, storage, log, ops } = setup();
  await ops.inLock.begin(ACCOUNT, { fingerprint: fingerprintOf(calls()) });
  await ops.inLock.markSubmitted(ACCOUNT, { id: CALL_ID });
  const result = await run();
  assert.equal(result.hash, TX);
  assert.equal(log.includes("prepare"), false);
  assert.equal(stored(storage), null);
});

test("a different payment waits while an earlier one is unverified", async () => {
  const { run, log, ops } = setup({ statuses: [{ statusCode: 100 }] });
  await ops.inLock.begin(ACCOUNT, { fingerprint: fingerprintOf(calls(1n)) });
  await ops.inLock.markSubmitted(ACCOUNT, { id: CALL_ID });
  await assert.rejects(run(), (error) => error.isPendingVerification === true);
  assert.equal(log.includes("prepare"), false);
});

test("the same payment from another account on this phone is refused while the first is unverified", async () => {
  const { run, log, ops } = setup({ statuses: [{ statusCode: 100 }] });
  await ops.inLock.begin(OTHER, { fingerprint: fingerprintOf(calls()) });
  await ops.inLock.markSubmitted(OTHER, { id: buildCallId(CHAIN, `0x${"d1".repeat(32)}`) });
  await assert.rejects(run(), /Another account on this iPhone/);
  assert.equal(log.includes("prepare"), false);
});

test("a prepared shape that is not split is still recorded before it is sent", async () => {
  const { run, log } = setup({ prepared: { type: "paymaster-permit" } });
  await run();
  assert.deepEqual(log.slice(0, 3), ["prepare", "sendCalls", "stored:submitting:no-hash"]);
});

test("only an answer from the provider counts as a refusal", () => {
  assert.equal(wasRefused(rpcError("bad", { code: -32602 })), true);
  assert.equal(wasRefused(rpcError("x", { status: 401 })), true);
  assert.equal(wasRefused(rpcError("Request timed out", { name: "TimeoutError" })), false);
  assert.equal(wasRefused(rpcError("fetch failed")), false);
  assert.equal(wasRefused(rpcError("x", { status: 503 })), false);
  assert.equal(wasRefused(new Error("something unexpected")), false);
});
