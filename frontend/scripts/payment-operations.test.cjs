const test = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./lib/loadTs.cjs");

const load = createLoader();
const { createPaymentOperations } = load("services/paymentOperations.ts");
const { buildCallId } = load("utils/callId.ts");
const { runExclusiveOperation } = load("utils/exclusiveOperation.ts");
const { keyForOperation } = load("utils/operationRecord.ts");
const { outboxKey } = load("utils/operationOutbox.ts");

const CHAIN = 84532;
const USDC = "0x036cbd53842c5426634e7929541ec2318f3dcf7e";
const RECIPIENT = "0x5999000000000000000000000000000000c0204c";
const ACCOUNT_A = "0xaaaa00000000000000000000000000000000000a";
const ACCOUNT_B = "0xbbbb00000000000000000000000000000000000b";
const OP_HASH = `0x${"c6".repeat(32)}`;
const TX = `0x${"7a".repeat(32)}`;
const CALL_ID = buildCallId(CHAIN, OP_HASH);
const T0 = 1_800_000_000_000;

const transferData = (to, amount) =>
  `0xa9059cbb${to.slice(2).toLowerCase().padStart(64, "0")}${amount.toString(16).padStart(64, "0")}`;
const fingerprintFor = (amount, to = RECIPIENT) => JSON.stringify([[USDC, "0", transferData(to, amount)]]);
const FP = fingerprintFor(10_000_000n);

const fakeStorage = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: async (key) => (map.has(key) ? map.get(key) : null),
    setItem: async (key, value) => void map.set(key, value),
    removeItem: async (key) => void map.delete(key),
    getAllKeys: async () => [...map.keys()],
  };
};

const rpcError = (message, extra = {}) => Object.assign(new Error(message), extra);
const CONFIRMED = { statusCode: 200, receipts: [{ transactionHash: TX, status: "0x1" }] };

const setup = ({ storage = fakeStorage(), provider, chain, now = T0 + 60_000, user = "user-1" } = {}) => {
  let clock = now;
  const reports = [];
  const ops = createPaymentOperations({
    storage,
    chainId: CHAIN,
    provider,
    chain,
    now: () => clock,
    symbolForToken: (token) => (token.toLowerCase() === USDC ? "USDC" : undefined),
    currentUserId: () => user,
    report: (event, facts) => reports.push([event, facts]),
    lock: runExclusiveOperation,
  });
  return { ops, storage, reports, tick: (ms) => (clock += ms), setNow: (value) => (clock = value) };
};

const seed = (storage, account, record) =>
  storage.setItem(keyForOperation(CHAIN, account), typeof record === "string" ? record : JSON.stringify(record));

const providerAnswering = (...answers) => {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    getCallsStatus: async () => {
      const answer = answers[Math.min(calls++, answers.length - 1)];
      if (answer instanceof Error) throw answer;
      return answer;
    },
  };
};
const chainAnswering = (answer) => ({ findUserOperation: async () => answer });

test("recovers a payment stored by an older build and records it without asking for a reinstall", async () => {
  for (const legacy of [
    CALL_ID, // bare id
    JSON.stringify({ id: CALL_ID, fingerprint: FP }),
    JSON.stringify({ id: CALL_ID, fingerprint: FP, createdAt: T0 }),
  ]) {
    const { ops, storage } = setup({ provider: providerAnswering(CONFIRMED) });
    await seed(storage, ACCOUNT_A, legacy);
    const report = await ops.check(ACCOUNT_A);
    assert.equal(report.status, "confirmed");
    assert.equal(report.ids.transactionHash, TX);
    assert.equal(report.ids.userOpHash, OP_HASH);
    assert.equal(storage.map.has(keyForOperation(CHAIN, ACCOUNT_A)), false, "pending record cleared once proven");
    const queued = await ops.outbox.list(ACCOUNT_A);
    if (legacy === CALL_ID) {
      // Nothing says what was paid: the payment cannot be recorded, but it is proven and the wallet is free.
      assert.equal(report.recording, "not-possible");
      assert.equal(queued.length, 0);
    } else {
      assert.equal(report.recording, "queued");
      assert.equal(queued.length, 1);
      assert.equal(queued[0].transactionHash, TX);
      assert.equal(queued[0].receiverAddress, RECIPIENT);
      assert.equal(queued[0].assetSymbol, "USDC");
      assert.equal(queued[0].rawAmountWei, "10000000");
    }
  }
});

test("a timeout or an unreachable provider never marks the payment failed and keeps every proof", async () => {
  const { ops, storage } = setup({
    provider: providerAnswering(rpcError("Request timed out", { name: "TimeoutError" })),
    chain: chainAnswering({ status: "unreadable", error: { kind: "network", summary: "this phone could not reach the provider" } }),
  });
  await seed(storage, ACCOUNT_A, { id: CALL_ID, fingerprint: FP, createdAt: T0 });
  const report = await ops.check(ACCOUNT_A);
  assert.equal(report.status, "unknown");
  assert.equal(report.reason, "unreachable");
  assert.equal(report.releasable, false);
  assert.equal(report.ids.callId, CALL_ID);
  assert.equal(report.ids.userOpHash, OP_HASH);
  const stored = JSON.parse(storage.map.get(keyForOperation(CHAIN, ACCOUNT_A)));
  assert.equal(stored.id, CALL_ID);
  assert.equal(stored.fingerprint, FP);
  assert.equal(stored.checks.length, 2);
});

test("an id the provider forgot is not a failure, and the chain can still prove the payment", async () => {
  const forgotten = rpcError("Unknown bundle id", { code: 5730 });
  const chainProof = {
    status: "found",
    success: true,
    transactionHash: TX,
    blockNumber: 42,
    sender: ACCOUNT_A,
    transfer: { kind: "matched", token: USDC, recipient: RECIPIENT, amount: "10000000" },
  };
  const notFound = setup({ provider: providerAnswering(forgotten), chain: chainAnswering({ status: "not-found", fromBlock: 1, toBlock: 2, complete: true }) });
  await seed(notFound.storage, ACCOUNT_A, { id: CALL_ID, fingerprint: FP, createdAt: T0 });
  const open = await notFound.ops.check(ACCOUNT_A);
  assert.equal(open.status, "unknown");
  assert.equal(open.reason, "not-found");
  assert.ok(notFound.storage.map.has(keyForOperation(CHAIN, ACCOUNT_A)), "still kept");

  const proven = setup({ provider: providerAnswering(forgotten), chain: chainAnswering(chainProof) });
  await seed(proven.storage, ACCOUNT_A, { id: CALL_ID, fingerprint: FP, createdAt: T0 });
  const report = await proven.ops.check(ACCOUNT_A);
  assert.equal(report.status, "confirmed");
  assert.equal(report.via, "chain");
  assert.equal(report.ids.transactionHash, TX);
  assert.equal((await proven.ops.outbox.list(ACCOUNT_A))[0].transactionHash, TX);
});

test("only an explicit answer that the payment did not happen is a failure, and it is explained and kept", async () => {
  for (const [statusCode, text] of [[400, /never included/], [500, /reverted/]]) {
    const { ops, storage } = setup({ provider: providerAnswering({ statusCode }) });
    await seed(storage, ACCOUNT_A, { id: CALL_ID, fingerprint: FP, createdAt: T0 });
    const report = await ops.check(ACCOUNT_A);
    assert.equal(report.status, "failed");
    assert.match(report.reason, text);
    // The failure is remembered without another network call.
    const offline = createPaymentOperations({ storage, chainId: CHAIN, now: () => T0 });
    assert.equal((await offline.check(ACCOUNT_A)).status, "failed");
    // ...and it does not block the next payment, which replaces it.
    assert.deepEqual(await ops.inLock.beforeSend(ACCOUNT_A, FP), { action: "proceed" });
    await ops.dismissFailure(ACCOUNT_A);
    assert.equal(storage.map.has(keyForOperation(CHAIN, ACCOUNT_A)), false);
  }
  const reverted = setup({
    provider: providerAnswering(rpcError("no", { code: 5730 })),
    chain: chainAnswering({ status: "found", success: false, transactionHash: TX, blockNumber: 1, sender: ACCOUNT_A, transfer: { kind: "not-applicable" } }),
  });
  await seed(reverted.storage, ACCOUNT_A, { id: CALL_ID, fingerprint: FP, createdAt: T0 });
  const report = await reverted.ops.check(ACCOUNT_A);
  assert.equal(report.status, "failed");
  assert.equal(report.ids.transactionHash, TX);
});

test("a provider that still processes the payment leaves it pending and blocks the next one", async () => {
  const { ops, storage } = setup({ provider: providerAnswering({ statusCode: 110 }) });
  await seed(storage, ACCOUNT_A, { id: CALL_ID, fingerprint: FP, createdAt: T0 });
  const report = await ops.check(ACCOUNT_A);
  assert.equal(report.status, "pending");
  const gate = await ops.inLock.beforeSend(ACCOUNT_A, fingerprintFor(1n));
  assert.equal(gate.action, "blocked");
  assert.equal(gate.reason, "unverified");
});

test("repeated checks are stable, bounded, and never duplicate the recording", async () => {
  const { ops, storage } = setup({ provider: providerAnswering(rpcError("x", { name: "TimeoutError" })) });
  await seed(storage, ACCOUNT_A, { id: CALL_ID, fingerprint: FP, createdAt: T0 });
  for (let i = 0; i < 20; i++) await ops.check(ACCOUNT_A);
  assert.ok(JSON.parse(storage.map.get(keyForOperation(CHAIN, ACCOUNT_A))).checks.length <= 8);

  const confirmed = setup({ provider: providerAnswering(CONFIRMED) });
  await seed(confirmed.storage, ACCOUNT_A, { id: CALL_ID, fingerprint: FP, createdAt: T0 });
  await confirmed.ops.check(ACCOUNT_A);
  await seed(confirmed.storage, ACCOUNT_A, { id: CALL_ID, fingerprint: FP, createdAt: T0 });
  await confirmed.ops.check(ACCOUNT_A);
  assert.equal((await confirmed.ops.outbox.list(ACCOUNT_A)).length, 1);
});

test("a confirmed transfer whose recording fails is retried by recording only, across restarts", async () => {
  const { ops, storage, tick } = setup({ provider: providerAnswering(CONFIRMED) });
  await seed(storage, ACCOUNT_A, { id: CALL_ID, fingerprint: FP, createdAt: T0 });
  await ops.check(ACCOUNT_A);

  const posted = [];
  const down = async (entry) => {
    posted.push(entry.transactionHash);
    return { kind: "retry", status: 503, reason: "The service had an error." };
  };
  assert.deepEqual(await ops.outbox.flush(ACCOUNT_A, down), { recorded: 0, waiting: 1, rejected: 0, recordedIds: {} });
  // Backoff: not tried again straight away, unless the owner asks.
  assert.deepEqual(await ops.outbox.flush(ACCOUNT_A, down), { recorded: 0, waiting: 1, rejected: 0, recordedIds: {} });
  assert.equal(posted.length, 1);
  await ops.outbox.flush(ACCOUNT_A, down, { force: true });
  assert.equal(posted.length, 2);

  // The app is closed and reopened: a new instance over the same storage.
  const reopened = createPaymentOperations({ storage, chainId: CHAIN, now: () => T0 + 999_999_999 });
  assert.equal((await reopened.outbox.list(ACCOUNT_A)).length, 1);
  const summary = await reopened.outbox.flush(ACCOUNT_A, async () => ({ kind: "recorded", backendTransactionId: "b-1" }));
  assert.deepEqual(summary, { recorded: 1, waiting: 0, rejected: 0, recordedIds: { [TX]: "b-1" } });
  assert.equal((await reopened.outbox.list(ACCOUNT_A)).length, 0);
  assert.ok(tick);
});

test("a recording the service refuses for good stops retrying but is kept for the owner", async () => {
  const { ops, storage } = setup({ provider: providerAnswering(CONFIRMED) });
  await seed(storage, ACCOUNT_A, { id: CALL_ID, fingerprint: FP, createdAt: T0 });
  await ops.check(ACCOUNT_A);
  const summary = await ops.outbox.flush(ACCOUNT_A, async () => ({ kind: "rejected", status: 409, reason: "The service already holds a different payment under this transaction." }));
  assert.equal(summary.rejected, 1);
  const stored = JSON.parse(storage.map.get(outboxKey(CHAIN, ACCOUNT_A, TX)));
  assert.equal(stored.state, "rejected");
  assert.equal((await ops.outbox.list(ACCOUNT_A)).length, 1);
  assert.deepEqual(await ops.outbox.flush(ACCOUNT_A, async () => assert.fail("must not post again"), { force: true }), { recorded: 0, waiting: 0, rejected: 1, recordedIds: {} });
});

test("what only the payer's screen knows is added to the queued recording", async () => {
  const { ops, storage } = setup({ provider: providerAnswering(CONFIRMED) });
  await seed(storage, ACCOUNT_A, { id: CALL_ID, fingerprint: FP, createdAt: T0 });
  await ops.check(ACCOUNT_A);
  await ops.outbox.enrich(ACCOUNT_A, TX, { note: "Lunch", recipientHandle: "sam" });
  const [entry] = await ops.outbox.list(ACCOUNT_A);
  assert.equal(entry.note, "Lunch");
  assert.equal(entry.recipientHandle, "sam");
  assert.equal(entry.userId, "user-1");
});

test("a record under the wrong network or account is neither used nor erased", async () => {
  const { ops, storage } = setup({ provider: providerAnswering(CONFIRMED) });
  const otherNetwork = { id: buildCallId(8453, OP_HASH), fingerprint: FP, createdAt: T0 };
  await seed(storage, ACCOUNT_A, otherNetwork);
  assert.deepEqual(await ops.check(ACCOUNT_A), { status: "foreign", reason: "other-network" });
  assert.equal((await ops.inLock.beforeSend(ACCOUNT_A, FP)).action, "blocked");
  assert.equal(storage.map.get(keyForOperation(CHAIN, ACCOUNT_A)), JSON.stringify(otherNetwork));

  const wrongAccount = { v: 2, phase: "submitted", id: CALL_ID, account: ACCOUNT_B, chainId: CHAIN, fingerprint: FP, checks: [] };
  await seed(storage, ACCOUNT_A, wrongAccount);
  assert.deepEqual(await ops.check(ACCOUNT_A), { status: "foreign", reason: "other-account" });
  assert.ok(storage.map.has(keyForOperation(CHAIN, ACCOUNT_A)));
});

test("each account keeps its own payment: switching accounts mixes nothing", async () => {
  const otherHash = `0x${"d1".repeat(32)}`;
  const provider = {
    getCallsStatus: async ({ id }) => (id === CALL_ID ? CONFIRMED : { statusCode: 100 }),
  };
  const { ops, storage } = setup({ provider });
  await seed(storage, ACCOUNT_A, { id: CALL_ID, fingerprint: FP, createdAt: T0 });
  await seed(storage, ACCOUNT_B, { id: buildCallId(CHAIN, otherHash), fingerprint: fingerprintFor(5_000_000n), createdAt: T0 });
  assert.equal((await ops.check(ACCOUNT_B)).status, "pending");
  assert.equal((await ops.check(ACCOUNT_A)).status, "confirmed");
  assert.ok(storage.map.has(keyForOperation(CHAIN, ACCOUNT_B)), "B is untouched by A's confirmation");
  assert.equal((await ops.outbox.list(ACCOUNT_B)).length, 0);
  assert.equal((await ops.outbox.list(ACCOUNT_A)).length, 1);
});

test("the same payment cannot be sent from another account while one is unproven, but a different one can", async () => {
  const { ops, storage } = setup({ provider: providerAnswering({ statusCode: 100 }) });
  await seed(storage, ACCOUNT_A, { id: CALL_ID, fingerprint: FP, createdAt: T0 });
  const same = await ops.inLock.beforeSend(ACCOUNT_B, FP);
  assert.equal(same.action, "blocked");
  assert.equal(same.reason, "other-account");
  assert.equal(same.otherAccount, ACCOUNT_A);
  assert.deepEqual(await ops.inLock.beforeSend(ACCOUNT_B, fingerprintFor(10_000_001n)), { action: "proceed" });
  assert.deepEqual(await ops.inLock.beforeSend(ACCOUNT_B, fingerprintFor(10_000_000n, "0x1111000000000000000000000000000000000001")), { action: "proceed" });
});

test("retrying the very payment that turns out confirmed answers with the first one and sends nothing", async () => {
  const { ops, storage } = setup({ provider: providerAnswering(CONFIRMED) });
  await seed(storage, ACCOUNT_A, { id: CALL_ID, fingerprint: FP, createdAt: T0 });
  assert.deepEqual(await ops.inLock.beforeSend(ACCOUNT_A, FP), { action: "reuse", transactionHash: TX });
  assert.equal((await ops.outbox.list(ACCOUNT_A)).length, 1);

  const other = setup({ provider: providerAnswering(CONFIRMED) });
  await seed(other.storage, ACCOUNT_A, { id: CALL_ID, fingerprint: FP, createdAt: T0 });
  const gate = await other.ops.inLock.beforeSend(ACCOUNT_A, fingerprintFor(1n));
  assert.equal(gate.action, "blocked", "a different payment waits until the owner has seen the first one");
});

test("two payments with the same amount and recipient stay two payments", async () => {
  const { ops, storage } = setup({ provider: providerAnswering(CONFIRMED) });
  const secondTx = `0x${"8b".repeat(32)}`;
  await seed(storage, ACCOUNT_A, { id: CALL_ID, fingerprint: FP, createdAt: T0 });
  await ops.check(ACCOUNT_A);
  const second = setup({
    storage,
    provider: providerAnswering({ statusCode: 200, receipts: [{ transactionHash: secondTx }] }),
  });
  await seed(storage, ACCOUNT_A, { id: buildCallId(CHAIN, `0x${"e2".repeat(32)}`), fingerprint: FP, createdAt: T0 + 1000 });
  await second.ops.check(ACCOUNT_A);
  const queued = await second.ops.outbox.list(ACCOUNT_A);
  assert.deepEqual(queued.map((entry) => entry.transactionHash).sort(), [TX, secondTx].sort());
});

test("the intent is stored before anything is sent, so a crash mid-send cannot lead to a second payment", async () => {
  const { ops, storage } = setup({
    provider: providerAnswering(rpcError("Unknown", { code: 5730 })),
    chain: chainAnswering({ status: "not-found", fromBlock: 1, toBlock: 2, complete: true }),
  });
  await ops.inLock.begin(ACCOUNT_A, { fingerprint: FP, userOpHash: OP_HASH });
  // The app dies here. On restart the phone refuses another payment.
  const stored = JSON.parse(storage.map.get(keyForOperation(CHAIN, ACCOUNT_A)));
  assert.equal(stored.phase, "submitting");
  assert.equal(stored.chainId, CHAIN);
  assert.equal(stored.account, ACCOUNT_A);
  assert.equal((await ops.inLock.beforeSend(ACCOUNT_A, FP)).action, "blocked");

  // Without a call id, the chain is asked with the hash that was known before sending.
  const chain = { findUserOperation: async (search) => (search.userOpHash === OP_HASH ? { status: "found", success: true, transactionHash: TX, blockNumber: 3, sender: ACCOUNT_A, transfer: { kind: "matched", token: USDC, recipient: RECIPIENT, amount: "10000000" } } : { status: "not-found", fromBlock: 0, toBlock: 1, complete: true }) };
  const recovered = createPaymentOperations({ storage, chainId: CHAIN, chain, now: () => T0 + 5000 });
  const report = await recovered.check(ACCOUNT_A);
  assert.equal(report.status, "confirmed");
  assert.equal(report.via, "chain");

  await ops.inLock.begin(ACCOUNT_B, { fingerprint: FP });
  await ops.inLock.abandon(ACCOUNT_B);
  assert.equal(storage.map.has(keyForOperation(CHAIN, ACCOUNT_B)), false, "a request the provider refused outright leaves nothing behind");
});

test("markSubmitted keeps the call id and the hash inside it", async () => {
  const { ops, storage } = setup();
  await ops.inLock.begin(ACCOUNT_A, { fingerprint: FP });
  await ops.inLock.markSubmitted(ACCOUNT_A, { id: CALL_ID });
  const stored = JSON.parse(storage.map.get(keyForOperation(CHAIN, ACCOUNT_A)));
  assert.equal(stored.phase, "submitted");
  assert.equal(stored.id, CALL_ID);
  assert.equal(stored.userOpHash, OP_HASH);
  assert.equal(stored.userId, "user-1");
});

test("a check that collides with a running send reports busy instead of an error", async () => {
  const { ops, storage } = setup({ provider: providerAnswering(CONFIRMED) });
  await seed(storage, ACCOUNT_A, { id: CALL_ID, fingerprint: FP, createdAt: T0 });
  let release;
  const held = runExclusiveOperation(ops.lockKey(ACCOUNT_A), () => new Promise((resolve) => (release = resolve)));
  assert.deepEqual(await ops.check(ACCOUNT_A), { status: "busy" });
  release();
  await held;
  assert.equal((await ops.check(ACCOUNT_A)).status, "confirmed");
});

test("releasing is allowed only after a wait, keeps the payment on a watch list, and reports it if it lands", async () => {
  const { ops, storage, setNow } = setup({
    provider: providerAnswering(rpcError("Unknown", { code: 5730 })),
    chain: chainAnswering({ status: "not-found", fromBlock: 1, toBlock: 2, complete: true }),
    now: T0 + 60_000,
  });
  await seed(storage, ACCOUNT_A, { id: CALL_ID, fingerprint: FP, createdAt: T0 });
  assert.equal((await ops.check(ACCOUNT_A)).releasable, false);
  setNow(T0 + 31 * 60_000);
  assert.equal((await ops.check(ACCOUNT_A)).releasable, true);

  await ops.release(ACCOUNT_A);
  assert.equal(storage.map.has(keyForOperation(CHAIN, ACCOUNT_A)), false);
  assert.deepEqual(await ops.inLock.beforeSend(ACCOUNT_A, FP), { action: "proceed" });
  assert.deepEqual(await ops.checkReleased(ACCOUNT_A), { landed: [] });

  const late = createPaymentOperations({
    storage,
    chainId: CHAIN,
    provider: providerAnswering(CONFIRMED),
    now: () => T0 + 40 * 60_000,
  });
  const { landed } = await late.checkReleased(ACCOUNT_A);
  assert.equal(landed.length, 1);
  assert.equal(landed[0].ids.transactionHash, TX);
  assert.equal((await late.outbox.list(ACCOUNT_A)).length, 1);
  assert.deepEqual(await late.checkReleased(ACCOUNT_A), { landed: [] }, "reported once");
});

test("records from before this version, which have no date, may be released", async () => {
  const { ops, storage } = setup({ provider: providerAnswering(rpcError("Unknown", { code: 5730 })) });
  await seed(storage, ACCOUNT_A, { id: CALL_ID, fingerprint: FP });
  assert.equal((await ops.check(ACCOUNT_A)).releasable, true);
});

test("lists what is unresolved on every account of this phone, for warnings before removal", async () => {
  const { ops, storage } = setup();
  await seed(storage, ACCOUNT_A, { id: CALL_ID, fingerprint: FP, createdAt: T0 });
  await seed(storage, ACCOUNT_B, { v: 2, phase: "failed", id: CALL_ID, fingerprint: FP, checks: [], failure: { at: T0, reason: "x" } });
  await storage.setItem(`atara.pending-call-bundle.8453.${ACCOUNT_A}`, JSON.stringify({ id: CALL_ID }));
  const found = await ops.listUnresolved();
  assert.deepEqual(found.map((item) => item.account), [ACCOUNT_A]);
});

test("nothing is reported when nothing is pending", async () => {
  const { ops } = setup();
  assert.deepEqual(await ops.check(ACCOUNT_A), { status: "none" });
  assert.deepEqual(await ops.inLock.beforeSend(ACCOUNT_A, FP), { action: "proceed" });
});

test("evidence and reports never carry addresses, ids or raw messages", async () => {
  const secret = "https://base-sepolia.g.alchemy.com/v2/SECRETKEY";
  const { ops, storage, reports } = setup({ provider: providerAnswering(rpcError(`fetch failed for ${secret}`, { name: "HttpRequestError" })) });
  await seed(storage, ACCOUNT_A, { id: CALL_ID, fingerprint: FP, createdAt: T0 });
  const report = await ops.check(ACCOUNT_A);
  const dump = JSON.stringify([report.evidence, reports, storage.map.get(keyForOperation(CHAIN, ACCOUNT_A))]);
  assert.equal(dump.includes("SECRETKEY"), false);
  assert.equal(dump.includes("alchemy.com"), false);
});
