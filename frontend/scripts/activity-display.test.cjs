const test = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./lib/loadTs.cjs");

const jsx = (type, props, key) => ({ type, props: { ...props, ...(key === undefined ? {} : { key }) } });
let dimensions = { width: 393, fontScale: 1 };
const host = (name) => name;
const mocks = {
  "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
  "react-native": {
    Text: host("Text"),
    View: host("View"),
    Pressable: host("Pressable"),
    TouchableOpacity: host("TouchableOpacity"),
    useWindowDimensions: () => dimensions,
  },
  moti: { MotiView: host("MotiView") },
  "lucide-react-native": new Proxy({}, { get: (_, name) => host(String(name)) }),
  "expo-haptics": { impactAsync: () => {}, ImpactFeedbackStyle: {} },
  "expo-router": { useRouter: () => ({ push: () => {} }) },
  "@/utils/constants": { COLORS: { accent: "#dfccb1", platinum: "#eee", white: "#fff" } },
  "@/stores/useTransactionHistoryStore": {},
  "./ActivitySkeleton": { TransactionsSkeleton: host("Skeleton") },
};
const load = createLoader({ mocks });
const { rowLayout, STACK_FROM_FONT_SCALE, STACK_BELOW_WIDTH } = load("utils/rowLayout.ts");
const { hideRecorded, dedupeHistory } = load("utils/historyMerge.ts");
const { RowHeader } = load("components/activity/RowHeader.tsx");
const { TransactionItem } = load("components/activity/TransactionItem.tsx");
const { ActivityList } = load("components/homeScreen/ActivityList.tsx");

const walk = (node) => {
  if (node === null || node === undefined || typeof node === "boolean") return [];
  if (typeof node !== "object") return [node];
  const kids = node.props?.children;
  return [node, ...(kids === undefined ? [] : [kids].flat(Infinity).flatMap(walk))];
};
const elements = (tree) => walk(tree).filter((n) => n && typeof n === "object");
const textOf = (node) => walk(node).filter((p) => typeof p === "string" || typeof p === "number").join("");
const style = (node) => Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));

const header = (extra = {}) =>
  RowHeader({
    name: "@a-very-long-handle-that-would-not-fit-on-one-line",
    address: "0x5999…204c",
    amount: "-10,000.000000 USDC",
    amountColor: "#fff",
    ...extra,
  });

test("name, address and amount each have their own zone, and the name is the one that gives way", () => {
  dimensions = { width: 393, fontScale: 1 };
  const tree = header();
  const [container] = elements(tree);
  assert.equal(style(container).flexDirection, "row");
  const identity = elements(tree).find((n) => n.props.testID === "row-identity");
  const amount = elements(tree).find((n) => n.props.testID === "row-amount");
  assert.ok(identity && amount);
  // The amount is not inside the identity zone, and the identity zone is the flexible one.
  assert.equal(elements(identity).includes(amount), false);
  assert.equal(style(identity).flex, 1);
  assert.equal(style(identity).minWidth, 0);
  // The name is cut with an ellipsis; the address has its own line, cut in the middle.
  const [name, address] = elements(identity).filter((n) => n.type === "Text");
  assert.equal(name.props.numberOfLines, 1);
  assert.equal(name.props.ellipsizeMode, "tail");
  assert.equal(address.props.numberOfLines, 1);
  assert.equal(address.props.ellipsizeMode, "middle");
  assert.equal(textOf(name), "@a-very-long-handle-that-would-not-fit-on-one-line");
  assert.equal(textOf(address), "0x5999…204c");
  // The amount keeps its width but cannot take the row, and shrinks its text before it wraps or overlaps.
  assert.equal(style(amount).flexShrink, 0);
  assert.equal(style(amount).maxWidth, "45%");
  assert.equal(amount.props.adjustsFontSizeToFit, true);
  assert.equal(amount.props.numberOfLines, 1);
  assert.equal(textOf(amount), "-10,000.000000 USDC");
});

test("with larger text or a narrow phone, the amount goes below the name instead of beside it", () => {
  for (const dims of [{ width: 393, fontScale: 1.5 }, { width: 320, fontScale: 1 }, { width: 393, fontScale: STACK_FROM_FONT_SCALE }]) {
    dimensions = dims;
    const tree = header();
    assert.equal(style(elements(tree)[0]).flexDirection, "column", JSON.stringify(dims));
    const amount = elements(tree).find((n) => n.props.testID === "row-amount");
    assert.equal(style(amount).maxWidth, undefined);
    assert.equal(style(amount).textAlign, undefined);
  }
  assert.equal(rowLayout(1, STACK_BELOW_WIDTH).stacked, false);
  assert.equal(rowLayout(1, STACK_BELOW_WIDTH - 1).stacked, true);
  assert.equal(rowLayout(1.2, 393).stacked, false);
});

test("text growth is capped everywhere in a row so one row cannot fill the screen", () => {
  dimensions = { width: 393, fontScale: 2 };
  const texts = elements(header()).filter((n) => n.type === "Text");
  assert.ok(texts.length >= 3);
  for (const text of texts) assert.equal(text.props.maxFontSizeMultiplier, 1.6);
});

const tx = (extra = {}) => ({
  id: "1",
  type: "send",
  counterparty: { name: "@sam", address: "0x5999000000000000000000000000000000c0204c", showAddress: true },
  formattedAmount: "-10.000000 USDC",
  userNote: "Lunch with the whole team, again, at the place near the station",
  displayDate: "Sep 30, 10:12 AM",
  displayDateShort: "Sep 30",
  ...extra,
});

test("the Activity rows use the zoned header, with the address shortened and on its own line", () => {
  dimensions = { width: 320, fontScale: 1.5 };
  const card = TransactionItem({ transaction: tx(), index: 0, onPress: () => {} });
  const cardHeader = elements(card).find((n) => n.type === RowHeader);
  assert.equal(cardHeader.props.name, "@sam");
  assert.equal(cardHeader.props.address, "0x5999...204c");
  assert.equal(cardHeader.props.amount, "-10.000000 USDC");

  const list = ActivityList({ transactions: [tx(), tx({ id: "2", counterparty: { name: "@sam", address: "0x5999000000000000000000000000000000c0204c", showAddress: false } })], isLoading: false });
  const headers = elements(list).filter((n) => n.type === RowHeader);
  assert.equal(headers.length, 2);
  assert.equal(headers[0].props.address, "0x5999...204c");
  assert.equal(headers[1].props.address, null, "no address line when the name already says who it is");
});

test("a note and a date never squeeze the amount: they are on the row below", () => {
  dimensions = { width: 393, fontScale: 1 };
  const card = TransactionItem({ transaction: tx(), index: 0, onPress: () => {} });
  const texts = elements(card).filter((n) => n.type === "Text");
  const note = texts.find((n) => textOf(n).startsWith("Lunch"));
  assert.equal(note.props.numberOfLines, 1);
  assert.equal(note.props.maxFontSizeMultiplier, 1.6);
});

test("the same amount to the same person on two occasions stays two payments", () => {
  const rows = [
    { id: "a", txHash: "0xAAA", amount: "10", to: "0x1" },
    { id: "b", txHash: "0xBBB", amount: "10", to: "0x1" },
  ];
  assert.equal(dedupeHistory(rows).length, 2);
  assert.equal(dedupeHistory([...rows, { ...rows[0] }]).length, 2, "the same record listed twice is one");
  const queued = [
    { transactionHash: "0xaaa", amount: "10" },
    { transactionHash: "0xccc", amount: "10" },
  ];
  // Only the hash decides, and case does not matter.
  assert.deepEqual(hideRecorded(queued, rows).map((entry) => entry.transactionHash), ["0xccc"]);
  assert.equal(hideRecorded(queued, []).length, 2);
});
