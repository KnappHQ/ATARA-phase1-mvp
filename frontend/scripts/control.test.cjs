const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

/**
 * Loads a dependency-light TypeScript module the same way the other script
 * tests do. Relative imports are resolved by transpiling the target too, so a
 * pure helper can reuse another pure helper without pulling React Native in.
 */
const load = (relativePath, cache = {}) => {
  const file = path.join(__dirname, "..", relativePath);
  if (cache[file]) return cache[file];
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  cache[file] = exports;
  const localRequire = (specifier) => {
    if (!specifier.startsWith(".")) throw new Error(`Unexpected import ${specifier}`);
    const target = path.relative(path.join(__dirname, ".."), path.join(path.dirname(file), specifier));
    return load(`${target}.ts`, cache);
  };
  new Function("exports", "require", code)(exports, localRequire);
  return exports;
};

const { assessServiceNetwork } = load("utils/networkGuard.ts");
const { compareDerivedAddress } = load("utils/addressVerification.ts");
const { mergeOnChainBalances, splitUsd } = load("utils/walletBalance.ts");

test("ATARA's service being down does not stop a payment", () => {
  assert.equal(assessServiceNetwork(undefined, 84532), "unknown");
  assert.equal(assessServiceNetwork(null, 84532), "unknown");
  assert.equal(assessServiceNetwork("84532", 84532), "unknown");
});

test("a service on another network still blocks the payment", () => {
  assert.equal(assessServiceNetwork(8453, 84532), "mismatch");
  assert.equal(assessServiceNetwork(84532, 84532), "match");
});

test("the stored address is verified against the signer's derivation", () => {
  const address = "0xAbCdEf0000000000000000000000000000000001";
  assert.equal(compareDerivedAddress(address, address.toLowerCase()), "verified");
  assert.equal(
    compareDerivedAddress(address, "0x0000000000000000000000000000000000000002"),
    "mismatch",
  );
});

test("a check that could not run is never reported as a mismatch", () => {
  assert.equal(compareDerivedAddress("0x1", null), "unverified");
  assert.equal(compareDerivedAddress(undefined, "0x1"), "unverified");
});

test("balances read from the chain replace placeholder zeros", () => {
  const assets = [
    { symbol: "USDC", balance: "0.00", balanceWei: "0", usdValue: "$0.00" },
    { symbol: "ETH", balance: "0.0", balanceWei: "0", usdValue: "$0.00" },
  ];
  const merged = mergeOnChainBalances(assets, [
    { symbol: "USDC", balanceWei: "125500000", decimals: 6 },
    { symbol: "ETH", balanceWei: "1000000000000000", decimals: 18 },
  ]);
  assert.equal(merged[0].balance, "125.5");
  assert.equal(merged[0].balanceWei, "125500000");
  assert.equal(merged[1].balance, "0.001");
  // No price is invented when the price service is the thing that failed.
  assert.equal(merged[0].usdValue, "$0.00");
});

test("an unreadable chain value leaves the asset untouched", () => {
  const assets = [{ symbol: "USDC", balance: "7", balanceWei: "7000000" }];
  const merged = mergeOnChainBalances(assets, [
    { symbol: "USDC", balanceWei: "not-a-number", decimals: 6 },
  ]);
  assert.deepEqual(merged, assets);
});

test("dollar amounts always show exactly two cents digits", () => {
  // The home screen used to print $12.50 as "$12.5.00".
  assert.deepEqual(splitUsd(12.5), { whole: "12", cents: "50" });
  assert.deepEqual(splitUsd(1234.567), { whole: "1,234", cents: "57" });
  assert.deepEqual(splitUsd(0), { whole: "0", cents: "00" });
  assert.deepEqual(splitUsd(Number.NaN), { whole: "0", cents: "00" });
});
