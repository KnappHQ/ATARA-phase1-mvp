const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createLoader } = require("./lib/loadTs.cjs");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const flow = createLoader()("utils/safetyFlow.ts");

// ------------------------------------------------------------------ the rules

test("a report needs a reason, and details stay within 500 characters", () => {
  assert.equal(flow.reportProblem(flow.emptyReport()), "Choose a reason.");
  assert.equal(flow.reportProblem({ reason: "SPAM", details: "", alsoBlock: false }), null);
  assert.equal(flow.reportProblem({ reason: "SPAM", details: "x".repeat(500), alsoBlock: false }), null);
  assert.match(flow.reportProblem({ reason: "SPAM", details: "x".repeat(501), alsoBlock: false }), /500/);
  assert.equal(flow.emptyReport().alsoBlock, true, "blocking too is the default");
});

test("the reasons are the ones the service accepts, each with a plain label", () => {
  assert.deepEqual(flow.REPORT_REASONS.map((reason) => reason.value), ["SPAM", "SCAM", "HARASSMENT", "INAPPROPRIATE", "IMPERSONATION", "OTHER"]);
  for (const reason of flow.REPORT_REASONS) assert.doesNotMatch(reason.label, /[A-Z]{4,}/);
});

test("the request says where the problem was seen, and for a contact needs no id", () => {
  const draft = { reason: "SCAM", details: "  asked for my key ", alsoBlock: true };
  assert.deepEqual(flow.reportPayload("@bob", draft, { kind: "contact" }), {
    handle: "bob", reason: "SCAM", details: "asked for my key", alsoBlock: true, context: "contact",
  });
  assert.deepEqual(flow.reportPayload("bob", draft, { kind: "payment_note", id: "tx-1" }), {
    handle: "bob", reason: "SCAM", details: "asked for my key", alsoBlock: true, context: "payment_note", contextId: "tx-1",
  });
  assert.equal(flow.reportPayload("bob", draft, { kind: "group", id: "g-1" }).contextId, "g-1");
  assert.equal(flow.reportPayload("bob", draft, { kind: "expense", id: "e-1" }).context, "expense");
});

test("the messages are plain, give the support address and promise 24 hours", () => {
  assert.match(flow.reportThanks(false), /within 24 hours/);
  assert.match(flow.reportThanks(false), /support@atara\.finance/);
  assert.match(flow.reportThanks(true), /They can no longer find you or add you to groups in ATARA\./);
  assert.doesNotMatch(flow.reportThanks(false), /no longer find/);
  assert.match(flow.blockConfirmText("@bob"), /Block @bob\?/);
  assert.match(flow.blockConfirmText("bob"), /add you to groups/);
  assert.match(flow.blockConfirmText("bob"), /stay in your history/);
});

test("a failure is never raw: not available, too many, bad input, offline and unknown each have words", () => {
  const fail = (status, code) => flow.safetyFailureText({ response: status ? { status } : undefined, code });
  assert.match(fail(404), /support@atara\.finance/);
  assert.match(fail(429), /Too many/);
  assert.match(fail(400), /could not be reported/);
  assert.match(fail(undefined, "ERR_NETWORK"), /No connection/);
  assert.match(fail(500), /Something went wrong/);
  for (const text of [fail(404), fail(429), fail(400), fail(500)]) assert.doesNotMatch(text, /status code|axios|Error:/i);
});

// -------------------------------------------------------------------- the calls

test("the app calls the service's report, block and invitation endpoints", async () => {
  const calls = [];
  const api = {
    post: async (url, body) => (calls.push(["post", url, body]), { data: {} }),
    delete: async (url) => (calls.push(["delete", url]), { data: {} }),
    get: async (url) => (calls.push(["get", url]), { data: url.endsWith("blocks") ? { blocks: [{ handle: "bob" }] } : url.endsWith("invitations") ? { invitations: [{ groupId: "g" }] } : {} }),
  };
  const { SafetyService } = createLoader({ mocks: { "./api": { api } } })("services/safety.service.ts");
  await SafetyService.block("@Bob");
  await SafetyService.unblock("@bob");
  await SafetyService.report({ handle: "bob", reason: "SPAM", details: "", alsoBlock: false, context: "contact" });
  assert.deepEqual(await SafetyService.listBlocks(), [{ handle: "bob" }]);
  assert.deepEqual(await SafetyService.getInvitations(), [{ groupId: "g" }]);
  await SafetyService.acceptInvitation("g/1");
  await SafetyService.declineInvitation("g1");
  assert.deepEqual(calls, [
    ["post", "/safety/blocks", { handle: "Bob" }],
    ["delete", "/safety/blocks/bob"],
    ["post", "/safety/reports", { handle: "bob", reason: "SPAM", details: "", alsoBlock: false, context: "contact" }],
    ["get", "/safety/blocks"],
    ["get", "/groups/invitations"],
    ["post", "/groups/g%2F1/invitation/accept", undefined],
    ["delete", "/groups/g1/invitation"],
  ]);
});

test("a malformed answer from the service gives an empty list, not a crash", async () => {
  const api = { get: async () => ({ data: { blocks: "nope", invitations: null } }) };
  const { SafetyService } = createLoader({ mocks: { "./api": { api } } })("services/safety.service.ts");
  assert.deepEqual(await SafetyService.listBlocks(), []);
  assert.deepEqual(await SafetyService.getInvitations(), []);
});

// ------------------------------------------------------------------ the sheet

let slots = [];
let cursor = 0;
const calls = [];
let failWith = null;
const react = {
  useState: (initial) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
    return [slots[index], (next) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
  },
  useEffect: () => undefined,
};
const jsx = (type, props, key) => ({ type, props: { ...props, ...(key === undefined ? {} : { key }) } });
const host = (name) => name;
const mocks = {
  react,
  "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
  "react-native": { ActivityIndicator: host("ActivityIndicator"), Modal: host("Modal"), Pressable: host("Pressable"), ScrollView: host("ScrollView"), Text: host("Text"), TextInput: host("TextInput"), View: host("View") },
  "@/utils/constants": { COLORS: { white: "#fff", black: "#000", accent: "#dfccb1" } },
  "@/services/safety.service": {
    SafetyService: {
      report: async (payload) => { calls.push(["report", payload]); if (failWith) throw failWith; },
      block: async (handle) => { calls.push(["block", handle]); if (failWith) throw failWith; },
    },
  },
};
const { SafetySheet } = createLoader({ mocks })("components/safety/SafetySheet.tsx");

/** Expands the sheet's own small function components so everything it draws can be read. */
const expand = (node) => {
  if (node === null || node === undefined || typeof node === "boolean") return null;
  if (typeof node !== "object") return node;
  if (typeof node.type === "function") return expand(node.type(node.props));
  const kids = node.props?.children;
  return { type: node.type, props: node.props, kids: kids === undefined ? [] : [kids].flat(Infinity).map(expand).filter((k) => k !== null) };
};
const texts = (node) => (node === null || typeof node !== "object" ? [String(node)] : node.kids.flatMap(texts));
const all = (node) => (node === null || typeof node !== "object" ? [] : [node, ...node.kids.flatMap(all)]);
let current;
const draw = (props) => { cursor = 0; current = expand(SafetySheet({ visible: true, handle: "@bob", context: { kind: "contact" }, onClose: () => undefined, ...props })); return current; };
const press = (label) => {
  const target = all(current).find((n) => n.props?.onPress && texts(n).join("").includes(label));
  assert.ok(target, `no button "${label}"`);
  return target.props.onPress();
};
const reset = () => { slots = []; cursor = 0; calls.length = 0; failWith = null; };

test("the sheet opens on a choice between reporting and blocking, and sends nothing yet", () => {
  reset();
  draw();
  const text = texts(current).join("|");
  assert.match(text, /Report @bob/);
  assert.match(text, /Block @bob/);
  assert.deepEqual(calls, []);
});

test("reporting: a reason is required, then the report goes out with where it was seen, and thanks are shown", async () => {
  reset();
  draw({ context: { kind: "payment_note", id: "tx-9" } });
  press("Report @bob");
  draw({ context: { kind: "payment_note", id: "tx-9" } });
  assert.match(texts(current).join("|"), /Spam\|?/);
  const send = all(current).find((n) => n.props?.onPress && texts(n).join("").includes("Send report"));
  assert.equal(send.props.disabled, true, "no reason chosen yet");
  press("Scam or fraud");
  draw({ context: { kind: "payment_note", id: "tx-9" } });
  await press("Send report");
  assert.deepEqual(calls, [["report", { handle: "bob", reason: "SCAM", details: "", alsoBlock: true, context: "payment_note", contextId: "tx-9" }]]);
  draw();
  assert.match(texts(current).join("|"), /within 24 hours/);
});

test("blocking asks for confirmation first, then blocks and says how to undo it", async () => {
  reset();
  let blocked = null;
  draw({ onBlocked: (handle) => (blocked = handle) });
  press("Block @bob");
  draw({ onBlocked: (handle) => (blocked = handle) });
  assert.match(texts(current).join("|"), /Block @bob\?/);
  assert.deepEqual(calls, [], "nothing until the person confirms");
  await press("Block");
  assert.deepEqual(calls, [["block", "bob"]]);
  assert.equal(blocked, "bob");
  draw();
  assert.match(texts(current).join("|"), /Blocked users/);
});

test("when the service fails, the sheet says so in plain words and stays open", async () => {
  reset();
  failWith = { response: { status: 429 } };
  draw();
  press("Report @bob");
  draw();
  press("Spam");
  draw();
  await press("Send report");
  draw();
  const text = texts(current).join("|");
  assert.match(text, /Too many reports/);
  assert.doesNotMatch(text, /within 24 hours/, "no thanks for a report that was not sent");
});

// ---------------------------------------------------------------- the entry points

test("every place another person appears has a way to report or block them", () => {
  const contact = read("app/contact-detail.tsx");
  assert.match(contact, /<SafetySheet/);
  assert.match(contact, /Report or block @\$\{safetyHandle\}/);
  assert.match(contact, /Report this note/);
  assert.match(contact, /Note hidden/);
  const detail = read("app/transaction-detail.tsx");
  assert.match(detail, /<SafetySheet/);
  assert.match(detail, /kind: "payment_note"/);
  const group = read("app/group-details.tsx");
  assert.match(group, /<GroupPeople/);
  assert.match(group, /kind: "group"/);
  assert.match(group, /kind: "expense"/);
  assert.match(read("components/groupDetails/GroupExpenseItem.tsx"), /expense\.paidById !== me/);
  const profile = read("app/(tabs)/profile.tsx");
  assert.match(profile, /router\.push\("\/blocked-users"/);
  assert.match(profile, /mailto:\$\{SUPPORT_EMAIL\}/);
});

test("people who use ATARA only: an external address has no report or block", () => {
  assert.match(read("app/contact-detail.tsx"), /tx\.isInApp && tx\.counterparty\.handle/);
});

test("people invited to a group answer before anything is shared: accept, decline, or decline and block", () => {
  const list = read("components/activity/GroupsListTab.tsx");
  assert.match(list, /<GroupInvitations \/>/);
  const invitations = read("components/activity/GroupInvitations.tsx");
  for (const label of ["Accept", "Decline", "Decline and block"]) assert.ok(invitations.includes(label), label);
  assert.match(invitations, /SafetyService\.block\(invitation\.invitedBy\.handle\)/);
  assert.match(read("app/group-details.tsx"), /only after they accept/);
});

test("the group store keeps invited people out of the members that expenses are split between", () => {
  const store = read("stores/useGroupStore.ts");
  assert.match(store, /members: d\.members\.filter\(\(m\) => m\.status !== "INVITED"\)/);
  assert.match(store, /pendingMembers: d\.members\.filter\(\(m\) => m\.status === "INVITED"\)/);
});

test("the 24-hour promise is worded the same everywhere, and the terms say content may be hidden", () => {
  const sources = [read("utils/tnc.ts"), read("utils/safetyFlow.ts"), read("app/(tabs)/profile.tsx"), read("../backend/routers/legal.routes.ts")];
  for (const source of sources) {
    assert.match(source, /We review reports within 24 hours/);
    assert.doesNotMatch(source, /review every report|Reports are handled within|may remove content/);
  }
  for (const source of [read("utils/tnc.ts"), read("../backend/routers/legal.routes.ts")]) assert.match(source, /may hide content/);
});

test("the legal text says objectionable content is not tolerated and reports are handled within 24 hours", () => {
  const terms = createLoader()("utils/tnc.ts");
  const text = JSON.stringify(terms);
  assert.match(text, /does not tolerate objectionable content/);
  assert.match(text, /within 24 hours/);
  const privacy = JSON.stringify(createLoader()("utils/privacyPolicy.ts"));
  assert.match(privacy, /reports you make about other users/);
});

test("the French text is gone from the group screens", () => {
  for (const file of ["components/groupDetails/GroupExpenseItem.tsx", "components/groupDetails/MemberBalanceList.tsx"]) {
    assert.doesNotMatch(read(file), /Accepter ma part|Te doit|Contester/, file);
  }
});
