const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const load = (relativePath, cache = {}) => {
  const file = path.join(__dirname, "..", relativePath);
  if (cache[file]) return cache[file];
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  cache[file] = exports;
  new Function("exports", "require", code)(exports, (specifier) => {
    if (!specifier.startsWith(".")) throw new Error(`Unexpected import ${specifier}`);
    const target = path.relative(path.join(__dirname, ".."), path.join(path.dirname(file), specifier));
    return load(`${target}.ts`, cache);
  });
  return exports;
};

const {
  STALE_AFTER_MS,
  describePendingPayment,
  formatPendingPayment,
  isStale,
  parseStoredOperation,
} = load("utils/pendingOperation.ts");

const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const RECIPIENT = "0x5999000000000000000000000000000000c0204c";
const transferData = (to, amount) =>
  `0xa9059cbb${to.slice(2).toLowerCase().padStart(64, "0")}${amount.toString(16).padStart(64, "0")}`;
const fingerprint = JSON.stringify([[USDC.toLowerCase(), "0", transferData(RECIPIENT, 10_000_000n)]]);
const tokens = [
  { symbol: "USDC", decimals: 6, contractAddress: USDC },
  { symbol: "ETH", decimals: 18, contractAddress: null },
];

test("reads every shape a pending record has been stored in", () => {
  assert.deepEqual(parseStoredOperation("bundle-1"), { id: "bundle-1" });
  assert.deepEqual(parseStoredOperation(JSON.stringify({ id: "b", fingerprint })), {
    id: "b",
    fingerprint,
    createdAt: undefined,
  });
  assert.equal(parseStoredOperation(JSON.stringify({ id: "b", fingerprint, createdAt: 5 })).createdAt, 5);
});

test("says which payment is blocking, so the owner can look for it", () => {
  const payment = describePendingPayment({ id: "b", fingerprint });
  assert.deepEqual(payment, { recipient: RECIPIENT, amount: "10000000", token: USDC.toLowerCase() });
  assert.equal(formatPendingPayment(payment, tokens), "10 USDC to 0x5999…204c");

  const eth = describePendingPayment({
    id: "b",
    fingerprint: JSON.stringify([[RECIPIENT, "1000000000000000", "0x"]]),
  });
  assert.equal(formatPendingPayment(eth, tokens), "0.001 ETH to 0x5999…204c");
});

test("an unreadable record is still described, never guessed", () => {
  assert.equal(describePendingPayment({ id: "b" }), null);
  assert.equal(describePendingPayment({ id: "b", fingerprint: "not json" }), null);
  assert.equal(describePendingPayment({ id: "b", fingerprint: JSON.stringify([[USDC, "0", "0x1234"]]) }), null);
});

test("an operation can be released only once it is old enough to be stale", () => {
  const now = 1_000_000_000_000;
  assert.equal(isStale({ id: "b", createdAt: now - 60_000 }, now), false);
  assert.equal(isStale({ id: "b", createdAt: now - STALE_AFTER_MS }, now), true);
  // Written before createdAt existed, so at least as old as this update.
  assert.equal(isStale({ id: "b" }, now), true);
});

test("the provider not knowing an old operation no longer locks the phone for good", () => {
  // Behaviour is covered in payment-operations.test.cjs; this pins the wiring.
  const service = fs.readFileSync(path.join(__dirname, "../services/smartAccount.service.ts"), "utf8");
  assert.match(service, /async releasePendingOperation\(\)/);
  assert.match(service, /submitAndConfirm\(/);
  const submission = fs.readFileSync(path.join(__dirname, "../services/paymentSubmission.ts"), "utf8");
  // The intent is written before the request that could move money is sent.
  assert.ok(submission.indexOf("ops.inLock.begin(") < submission.indexOf("client.sendPreparedCalls("));
  const activity = fs.readFileSync(path.join(__dirname, "../app/(tabs)/activity.tsx"), "utf8");
  // Released only from the owner's explicit choice, after the warning.
  assert.match(activity, /text: "Release",\s*style: "destructive"/);
});
