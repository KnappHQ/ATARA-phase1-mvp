const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createLoader } = require("./lib/loadTs.cjs");

const display = createLoader()("utils/balanceDisplay.ts");
const tokenConfig = createLoader({ allow: [] })("utils/tokenConfig.ts");
const source = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

// ------------------------------------------------------------------ the rules

test("a balance that was never read is Unavailable, never 0", () => {
  for (const placeholder of ["", "  ", undefined, null, "0.00", "0"]) {
    assert.equal(display.formatAssetBalance(placeholder, false), "Unavailable", String(placeholder));
  }
  assert.equal(display.formatAssetBalance("not a number", true), "Unavailable");
  assert.equal(display.formatAssetBalance("", true), "Unavailable", "an empty reading is not a zero either");
  assert.equal(display.formatAssetUsd("$0.00", false), "Unavailable", "no price: the USD value is not $0.00");
  assert.equal(display.formatAssetUsd("", true), "Unavailable");
});

test("a real zero still shows as zero, and real amounts are formatted", () => {
  assert.equal(display.formatAssetBalance("0", true), "0");
  assert.equal(display.formatAssetBalance("0.00", true), "0");
  assert.equal(display.formatAssetBalance("1234.5", true), "1,234.5");
  assert.equal(display.formatAssetBalance("0.123456789", true), "0.123457");
  assert.equal(display.formatAssetUsd("$0.00", true), "$0.00");
  assert.equal(display.formatAssetUsd("$1,234.5", true), "$1,234.50");
});

test("amounts are known once something was read; USD values only when the price service answered", () => {
  assert.equal(display.balancesKnown(null), false);
  assert.equal(display.balancesKnown("chain"), true);
  assert.equal(display.balancesKnown("service"), true);
  assert.equal(display.usdValuesKnown("chain"), false, "read from the chain: amounts yes, prices no");
  assert.equal(display.usdValuesKnown("service"), true);
  assert.equal(display.usdValuesKnown(null), false);
});

test("the default assets carry no balance and no USD value until one is read", () => {
  const assets = tokenConfig.getDefaultAssets("base-sepolia");
  assert.ok(assets.length >= 2);
  for (const asset of assets) {
    assert.equal(asset.balance, "", `${asset.symbol} balance`);
    assert.equal(asset.usdValue, "", `${asset.symbol} usdValue`);
    assert.equal(asset.balanceWei, undefined, `${asset.symbol} balanceWei`);
  }
});

// -------------------------------------------------------------- the carousel

let slots = [];
const jsx = (type, props) => ({ type, props });
const host = (name) => name;
const chain = new Proxy(function () {}, { get: () => () => chain, apply: () => chain });
const mocks = {
  react: { useMemo: (fn) => fn() },
  "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
  "react-native": { Text: host("Text"), View: host("View") },
  "expo-haptics": { impactAsync: () => undefined, ImpactFeedbackStyle: { Light: "light" } },
  "lucide-react-native": new Proxy({}, { get: (_, name) => host(String(name)) }),
  "react-native-gesture-handler": { Gesture: { Pan: () => chain }, GestureDetector: host("GestureDetector") },
  "react-native-reanimated": { __esModule: true, default: { View: host("Animated.View") }, runOnJS: (fn) => fn },
};
const { AssetBalanceCarousel } = createLoader({ mocks })("components/homeScreen/AssetBalanceCarousel.tsx");
const walk = (node) => {
  if (node === null || node === undefined || typeof node === "boolean") return [];
  if (typeof node !== "object") return [String(node)];
  const kids = node.props?.children;
  return kids === undefined ? [] : [kids].flat(Infinity).flatMap(walk);
};
const shown = (props) => walk(AssetBalanceCarousel({ selectedIndex: 0, onSelect: () => undefined, ...props })).join("|");
const usdc = (balance, usdValue) => ({ symbol: "USDC", name: "USD Coin", balance, usdValue, usdPrice: 1, decimals: 6 });

test("while nothing has been read the carousel says Unavailable and shows no 0", () => {
  const text = shown({ assets: [usdc("", "")], balancesKnown: false, usdKnown: false });
  assert.match(text, /Unavailable/);
  assert.doesNotMatch(text, /\b0\b|\$0\.00|USDC\|/);
});

test("when the read failed after placeholders, the carousel is still not a zero", () => {
  const text = shown({ assets: [usdc("0.00", "$0.00")], balancesKnown: false, usdKnown: false });
  assert.match(text, /Unavailable/);
  assert.doesNotMatch(text, /\$0\.00/);
});

test("a real zero (balance read and actually zero) shows 0 and $0.00", () => {
  const text = shown({ assets: [usdc("0", "$0.00")], balancesKnown: true, usdKnown: true });
  assert.match(text, /\|0\|/);
  assert.match(text, /≈ \$0\.00/);
  assert.doesNotMatch(text, /Unavailable/);
});

test("amounts read from the chain show the amount and say the USD value is unavailable", () => {
  const text = shown({ assets: [usdc("12.5", "")], balancesKnown: true, usdKnown: false });
  assert.match(text, /12\.5/);
  assert.match(text, /USD value unavailable/);
  assert.doesNotMatch(text, /\$0\.00/);
});

test("a real balance with prices shows both", () => {
  const text = shown({ assets: [usdc("40.01", "$40.01")], balancesKnown: true, usdKnown: true });
  assert.match(text, /40\.01/);
  assert.match(text, /≈ \$40\.01/);
});

// ------------------------------------------------- the screens that use them

test("the home balance never falls back to a literal 0, and passes what it knows to the carousel", () => {
  const home = source("components/homeScreen/BalanceRevealSection.tsx");
  assert.doesNotMatch(home, /\?\?\s*"0"/);
  assert.match(home, /balancesKnown=\{balancesKnown\(balanceSource\)\}/);
  assert.match(home, /usdKnown=\{usdValuesKnown\(balanceSource\)\}/);
});

test("Pay a merchant shows Unavailable instead of 0.00 and does not call an unknown balance too small", () => {
  const screen = source("app/pay-merchant.tsx");
  assert.doesNotMatch(screen, /"0\.00"/);
  assert.match(screen, /balanceText === UNAVAILABLE \? null : decimalToBaseUnits/);
  assert.match(screen, /balanceInBaseUnits !== null && !hasBalance/, "no 'exceeds your balance' while the balance is unknown");
  assert.match(screen, /Balance unavailable right now/);
});

test("the carousel has no zero fallback of its own", () => {
  const carousel = source("components/homeScreen/AssetBalanceCarousel.tsx");
  assert.doesNotMatch(carousel, /\|\|\s*"0"|"\$0\.00"/);
});

test("once ATARA's service answered, a token it does not list is a real zero, not a placeholder", () => {
  const store = source("stores/useWalletStore.ts");
  assert.match(store, /does not list this token: nothing is held, a\s+\/\/ real zero/);
  assert.match(store, /return \{ \.\.\.asset, balance: "0", usdValue: "\$0\.00", balanceWei: "0" \};/);
});

test("the Send screen's balance line says Balance unavailable until a balance is read, and nothing else in it changed", () => {
  const screen = source("components/send/AmountStep.tsx");
  assert.match(screen, /!balancesKnown\(balanceSource\)\s*\? "Balance unavailable"/);
  assert.match(screen, /usdValuesKnown\(balanceSource\)/);
  assert.match(screen, /: "· USD value unavailable"/);
  // The balance used by the send logic is still the token's own, unchanged.
  assert.match(screen, /const currentBalance = parseAmount\(selectedToken\.balance\);/);
  assert.match(screen, /validateBalance\(amountValue, currentBalance\)/);
});
