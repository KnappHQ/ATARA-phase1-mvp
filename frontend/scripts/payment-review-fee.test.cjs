const test = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./lib/loadTs.cjs");

/** Renders the payment review with React Native replaced by plain objects: a logic simulation, not a device. */
const jsx = (type, props, key) => ({ type, props: { ...props, ...(key === undefined ? {} : { key }) } });
const host = (name) => name;
const mocks = {
  "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
  "react-native": { Modal: host("Modal"), Pressable: host("Pressable"), ScrollView: host("ScrollView"), Text: host("Text"), View: host("View") },
  "lucide-react-native": new Proxy({}, { get: (_, name) => host(String(name)) }),
  "@/utils/constants": { COLORS: { white: "#fff" }, NETWORK_NAME: "Base Sepolia" },
};
const { PaymentReview } = createLoader({ mocks })("components/send/PaymentReview.tsx");

const walk = (node) => {
  if (node === null || node === undefined || typeof node === "boolean") return [];
  if (typeof node !== "object") return [node];
  const kids = node.props?.children;
  return [node, ...(kids === undefined ? [] : [kids].flat(Infinity).flatMap(walk))];
};
const textOf = (tree) => walk(tree).filter((p) => typeof p === "string" || typeof p === "number").join("|");
// Line is a custom component: it is not called by this mini runtime, so its label and value props are read.
const lines = (tree) =>
  walk(tree).flatMap((n) => (n && typeof n === "object" && typeof n.type === "function" && "label" in n.props ? [`${n.props.label}: ${n.props.value}`] : []));
const pressables = (tree) => walk(tree).filter((n) => n && typeof n === "object" && n.type === "Pressable");

const base = { visible: true, recipientLabel: "@sam", recipientAddress: "0x" + "ab".repeat(20), amount: "25.00", tokenSymbol: "USDC", busy: false, onCancel() {}, onConfirm() {}, onRetryFee() {} };
const show = (props) => PaymentReview({ ...base, ...props });
const confirm = (tree) => pressables(tree).at(-1);

test("a real fee is shown before confirming, and the payment can be confirmed", () => {
  const tree = show({ fee: { status: "ready", maxFee: 20_000n } });
  assert.ok(lines(tree).includes("Network fee: about $0.02"));
  assert.ok(lines(tree).includes("Leaves your account: 25.00 USDC + fee (max 25.02 USDC)"));
  assert.match(textOf(tree), /Paid in USDC from your balance/);
  assert.equal(confirm(tree).props.disabled, false);
});

test("an unavailable fee blocks confirming, offers Try again and never shows 0", () => {
  const calls = [];
  const tree = show({ fee: { status: "unavailable" }, onRetryFee: () => calls.push("retry") });
  assert.ok(lines(tree).includes("Network fee: Unavailable"));
  assert.equal(confirm(tree).props.disabled, true);
  const retry = pressables(tree).find((n) => textOf(n) === "Try again");
  retry.props.onPress();
  assert.deepEqual(calls, ["retry"]);
  assert.doesNotMatch(lines(tree).join("\n"), /fee: (\$?0|0\b)/i);
});

test("while the fee is being estimated the payment waits", () => {
  const tree = show({ fee: { status: "loading" } });
  assert.ok(lines(tree).includes("Network fee: Estimating…"));
  assert.equal(confirm(tree).props.disabled, true);
});

test("not enough USDC for the amount and the fee blocks confirming and says so", () => {
  const message = "Not enough USDC to cover this amount and the network fee (about $0.02).";
  const tree = show({ fee: { status: "ready", maxFee: 20_000n }, fundsMessage: message });
  assert.match(textOf(tree), /Not enough USDC to cover this amount and the network fee \(about \$0\.02\)\./);
  assert.equal(confirm(tree).props.disabled, true);
});

test("a changed fee reopens the review with the reason", () => {
  const tree = show({ fee: { status: "ready", maxFee: 30_000n }, notice: "The network fee changed. Please check and confirm again." });
  assert.match(textOf(tree), /The network fee changed\. Please check and confirm again\./);
});

test("another token shows the fee in USDC", () => {
  const tree = show({ tokenSymbol: "USDT", amount: "5", fee: { status: "ready", maxFee: 20_000n } });
  assert.ok(lines(tree).includes("Leaves your account: 5 USDT + network fee about $0.02 in USDC"));
});

test("the review never mentions gas, a paymaster or sponsorship", () => {
  for (const fee of [{ status: "ready", maxFee: 20_000n }, { status: "unavailable" }, { status: "loading" }]) {
    assert.doesNotMatch(textOf(show({ fee })), /gas|paymaster|sponsor|paid by ATARA/i);
  }
});
