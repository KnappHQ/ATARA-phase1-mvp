const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createLoader } = require("./lib/loadTs.cjs");

const load = createLoader();
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const split = load("utils/expenseSplit.ts");
const life = load("utils/groupLifecycle.ts");

// ---- who owes what ---------------------------------------------------------

test("amounts are read in whole cents and nothing else is accepted", () => {
  assert.equal(split.toCents("12.5"), 1250);
  assert.equal(split.toCents("0.01"), 1);
  assert.equal(split.toCents("12,50"), 1250);
  for (const bad of ["", "abc", "1.234", "-5", "1e3", "12345678"]) assert.equal(split.toCents(bad), null, bad);
});

test("an equal split gives the leftover cents to the first people, like the server", () => {
  assert.deepEqual(split.equalShares(5000, ["b", "a"]), { a: 2500, b: 2500 });
  assert.deepEqual(split.equalShares(1000, ["c", "a", "b"]), { a: 334, b: 333, c: 333 });
  const shares = split.equalShares(10001, ["a", "b", "c", "d"]);
  assert.equal(Object.values(shares).reduce((s, v) => s + v, 0), 10001);
});

test("custom amounts must add up to the total, with a clear message", () => {
  const base = { mode: "custom", totalCents: 5000, ids: ["a", "b"], unit: "USDC" };
  const ok = split.computeSplit({ ...base, typed: { a: "20", b: "30" } });
  assert.deepEqual(ok.shares, { a: 2000, b: 3000 });
  assert.equal(ok.error, null);
  const under = split.computeSplit({ ...base, typed: { a: "20", b: "25" } });
  assert.equal(under.shares, null);
  assert.match(under.error, /Still to allocate 5\.00 USDC/);
  const over = split.computeSplit({ ...base, typed: { a: "40", b: "30" } });
  assert.match(over.error, /Over allocated by 20\.00 USDC/);
  assert.match(split.computeSplit({ ...base, typed: { a: "1.234", b: "1" } }).error, /two decimals/);
});

test("percentages must add up to 100 and every cent is given out", () => {
  const base = { mode: "percent", totalCents: 1000, ids: ["a", "b", "c"], unit: "USDC" };
  const ok = split.computeSplit({ ...base, typed: { a: "33.33", b: "33.33", c: "33.34" } });
  assert.equal(ok.error, null);
  assert.equal(Object.values(ok.shares).reduce((s, v) => s + v, 0), 1000);
  const bad = split.computeSplit({ ...base, typed: { a: "50", b: "30", c: "10" } });
  assert.equal(bad.shares, null);
  assert.match(bad.error, /Percentages must add up to 100% \(now 90%\)/);
  assert.match(split.computeSplit({ ...base, typed: { a: "101", b: "0", c: "0" } }).error, /between 0 and 100/);
  const half = split.computeSplit({ mode: "percent", totalCents: 5000, ids: ["a", "b"], typed: { a: "50", b: "50" }, unit: "USDC" });
  assert.deepEqual(half.shares, { a: 2500, b: 2500 });
});

test("the summary says who owes the payer what", () => {
  const lines = split.summaryLines({ me: 2500, alex: 2500 }, { me: "tanguy", alex: "alex" }, "me", "USDC");
  assert.deepEqual(lines.map((l) => l.text), ["@alex owes you 25.00 USDC", "Your share: 25.00 USDC"]);
});

test("the payer always shares, and an expense needs someone else", () => {
  assert.deepEqual(split.sharingIds({ a: true, b: false, me: true }, "me"), ["a", "me"]);
  assert.deepEqual(split.sharingIds({ a: false }, "me"), ["me"]);
  assert.equal(split.hasSomeoneElse(["me"], "me"), false);
  assert.equal(split.hasSomeoneElse(["a", "me"], "me"), true);
});

test("only custom and percentage splits send their own amounts", () => {
  assert.equal(split.customSplitsToSend("equal", { a: 1, b: 2 }), undefined);
  assert.equal(split.customSplitsToSend("custom", null), undefined);
  assert.deepEqual(split.customSplitsToSend("percent", { b: 1500, a: 3500 }), [
    { userId: "a", amount: "35.00" },
    { userId: "b", amount: "15.00" },
  ]);
});

// ---- archive and delete -----------------------------------------------------

test("groups are separated into active and archived", () => {
  const { active, archived } = life.splitGroups([{ id: "1", archivedAt: null }, { id: "2", archivedAt: "2026-10-09" }, { id: "3" }]);
  assert.deepEqual(active.map((g) => g.id), ["1", "3"]);
  assert.deepEqual(archived.map((g) => g.id), ["2"]);
});

test("delete is for the creator, and refused while anyone owes", () => {
  assert.deepEqual(life.deleteGuard({ isCreator: false, memberBalances: [] }), { visible: false, allowed: false, reason: null });
  assert.deepEqual(life.deleteGuard({ isCreator: true, memberBalances: [{ owedByMe: 0, owedToMe: 0 }] }), { visible: true, allowed: true, reason: null });
  const owes = life.deleteGuard({ isCreator: true, memberBalances: [{ owedByMe: 0, owedToMe: 5 }] });
  assert.equal(owes.allowed, false);
  assert.equal(owes.reason, "Settle balances first");
  assert.equal(life.deleteGuard({ isCreator: true, memberBalances: [{ owedByMe: 0.001, owedToMe: 0 }] }).allowed, true);
});

// ---- wiring ------------------------------------------------------------------

test("group details offers Archive to everyone and Delete to the creator, each behind a confirmation", () => {
  const screen = read("app/group-details.tsx");
  assert.match(screen, /Alert\.alert\(ARCHIVE_TITLE, ARCHIVE_BODY/);
  assert.match(screen, /text: "Delete group",\s*style: "destructive"/);
  assert.match(screen, /groupDetail\.createdById === myId && \(/);
  assert.match(screen, /Alert\.alert\(SETTLE_FIRST, SETTLE_FIRST_BODY\)/);
  assert.match(screen, /Add first expense/);
});

test("the list keeps archived groups apart and offers Restore", () => {
  assert.match(read("components/activity/GroupsListTab.tsx"), /<ArchivedGroups groups=\{archived\} \/>/);
  const archived = read("components/activity/ArchivedGroups.tsx");
  assert.match(archived, /Archived \(\{groups\.length\}\)/);
  assert.match(archived, />Restore</);
});

test("the service calls the archive and delete routes", async () => {
  const calls = [];
  const api = {
    post: async (url) => { calls.push(["post", url]); return {}; },
    delete: async (url) => { calls.push(["delete", url]); return {}; },
  };
  const { GroupService } = createLoader({ mocks: { "./api": { api } } })("services/group.service.ts");
  await GroupService.archiveGroup("g1");
  await GroupService.unarchiveGroup("g1");
  await GroupService.deleteGroup("g1");
  assert.deepEqual(calls, [["post", "/groups/g1/archive"], ["delete", "/groups/g1/archive"], ["delete", "/groups/g1"]]);
});

// ---- the add-expense flow ----------------------------------------------------

test("adding an expense asks who paid, then how it is split, then shows a summary", () => {
  const modal = read("components/groupDetails/AddExpenseModal.tsx");
  assert.match(modal, /"Who paid\?"/);
  assert.match(modal, /"Split how\?"/);
  assert.match(modal, /: "Review"/);
  assert.match(modal, /label: "Equal"/);
  assert.match(modal, /label: "Custom amounts"/);
  assert.match(modal, /label: "%"/);
  assert.match(modal, /You paid/);
  assert.match(modal, /Add expense/);
  // The payer is only ever the person adding the expense.
  assert.match(modal, /recorded as paid by you/);
});

test("invited people are shown but cannot be given a share, and who shares is sent to the server", () => {
  const modal = read("components/groupDetails/AddExpenseModal.tsx");
  assert.match(modal, /Invited · can't share yet/);
  assert.match(modal, /groupDetail\?\.pendingMembers/);
  assert.match(modal, /splitWithUserIds: ids/);
  assert.match(modal, /customSplits: customSplitsToSend\(mode, split\.shares\)/);
  // The idempotent retry from #77 is kept.
  assert.match(modal, /status >= 500 \? attempt : null/);
  assert.match(modal, /Wait for invitations to be accepted/);
});
