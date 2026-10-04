const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createLoader } = require("./lib/loadTs.cjs");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const FLAG = "EXPO_PUBLIC_ENABLE_CARD_PURCHASE";

const flagWith = (value) => {
  const previous = process.env[FLAG];
  if (value === undefined) delete process.env[FLAG];
  else process.env[FLAG] = value;
  try {
    return createLoader()("utils/featureFlags.ts").CARD_PURCHASE_ENABLED;
  } finally {
    if (previous === undefined) delete process.env[FLAG];
    else process.env[FLAG] = previous;
  }
};

const walk = (dir) =>
  fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(rel);
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [rel] : [];
  });

test("card purchase is off unless the variable is exactly \"true\"", () => {
  assert.equal(flagWith(undefined), false);
  assert.equal(flagWith(""), false);
  assert.equal(flagWith("false"), false);
  assert.equal(flagWith("1"), false);
  assert.equal(flagWith("TRUE"), false);
  assert.equal(flagWith("true"), true);
});

test("the variable is read in one place, and the unused provider variable is not the switch", () => {
  const readers = ["app", "components", "utils", "services", "stores", "providers"]
    .flatMap(walk)
    .filter((file) => read(file).includes(FLAG));
  assert.deepEqual(readers, [path.join("utils", "featureFlags.ts")]);
  assert.doesNotMatch(read("utils/featureFlags.ts").replace(/\/\*[\s\S]*?\*\//, ""), /ONRAMP_PROVIDER/);
});

test("Home tile and the receive screen name no MoonPay outside the flag", () => {
  const tile = read("components/homeScreen/CryptoActions.tsx");
  assert.equal((tile.match(/MoonPay/g) || []).length, 1);
  assert.match(tile, /CARD_PURCHASE_ENABLED\s*\n?\s*\?\s*"Via MoonPay"/);
  assert.match(tile, /"Add money"/);
  assert.match(tile, /"Receive test USDC"/);
  assert.doesNotMatch(read("app/add-crypto.tsx"), /MoonPay|OnrampService|runCheckout/);
});

test("the flag-off screen has a muted coming-soon line and no buy control", () => {
  const screen = read("app/add-crypto.tsx");
  assert.match(screen, /Buying by card: coming soon\./);
  const off = screen.slice(screen.indexOf("CARD_PURCHASE_ENABLED ? ("));
  assert.doesNotMatch(off, /Pressable|TextInput|onPress/);
});

test("the receive QR is drawn on the phone and never on an address mismatch", () => {
  const screen = read("app/add-crypto.tsx");
  assert.match(screen, /addressUsable = !!walletAddress && verification !== "mismatch"/);
  assert.match(screen, /addressUsable && walletAddress \?[\s\S]{0,200}QRCodeStyled/);
  assert.match(screen, /buildReceiveUri\(walletAddress, CHAIN_ID\)/);
});

test("on an address mismatch the receive screen also hides the copy box and the faucet, which copies the address", () => {
  const screen = read("app/add-crypto.tsx");
  assert.match(screen, /const addressUsable = !!walletAddress && verification !== "mismatch"/);
  // Each of the three ways to hand the address out is behind addressUsable.
  assert.match(screen, /\{addressUsable && walletAddress \? \(\s*<View className="items-center mt-4">/);
  assert.match(screen, /\{addressUsable && walletAddress \? \(\s*<Pressable[\s\S]{0,120}Copy my receiving address/);
  assert.match(screen, /\{isTestnet && addressUsable \? \(/);
  assert.match(screen, /if \(!isTestnet \|\| !walletAddress \|\| !addressUsable\) return;/);
  // And nothing else copies it.
  assert.equal((screen.match(/Clipboard\.setStringAsync/g) ?? []).length, 2);
});

test("OnrampService and MoonPay URLs are only reachable from the card purchase component", () => {
  const files = ["app", "components", "utils", "services", "stores", "providers"].flatMap(walk);
  const importers = files.filter((file) => /from "@\/services\/onramp\.service"|services\/onramp\.service"/.test(read(file)));
  assert.deepEqual(importers, [path.join("components", "addMoney", "CardPurchaseSection.tsx")]);
  const moonpayUrl = files.filter((file) => /moonpay\.com/.test(read(file)));
  assert.deepEqual(moonpayUrl.filter((file) => !/onrampFlow\.ts$|privacyPolicy\.ts$|sovereignty\.tsx$/.test(file)), []);
});

test("the card purchase component keeps its checkout hooks and is the only place that calls createSession", () => {
  const card = read("components/addMoney/CardPurchaseSection.tsx");
  assert.match(card, /AppState\.addEventListener/);
  assert.match(card, /scheduleBalanceRefresh/);
  assert.match(card, /OnrampService\.createSession/);
});
