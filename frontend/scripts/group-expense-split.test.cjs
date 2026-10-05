const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createLoader } = require("./lib/loadTs.cjs");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("addExpense posts who shares the expense, together with custom shares", async () => {
  const posts = [];
  const api = { post: async (url, body) => { posts.push({ url, body }); return { data: { expense: { id: "e1" } } }; } };
  const { GroupService } = createLoader({ mocks: { "./api": { api } } })("services/group.service.ts");

  await GroupService.addExpense("g1", "Dinner", 30, "request-key-0000000001", undefined, ["a", "b"]);
  await GroupService.addExpense("g1", "Taxi", 12, "request-key-0000000002", [{ userId: "a", amount: "6.00" }, { userId: "b", amount: "6.00" }], ["a", "b"]);

  assert.equal(posts[0].url, "/groups/g1/expenses");
  assert.deepEqual(posts[0].body.splitWithUserIds, ["a", "b"]);
  assert.equal(posts[0].body.customSplits, undefined);
  assert.deepEqual(posts[1].body.splitWithUserIds, ["a", "b"]);
  assert.equal(posts[1].body.customSplits.length, 2);
});

test("the store hands the member ids to the service", () => {
  const store = read("stores/useGroupStore.ts");
  assert.match(store, /addExpense: async \(groupId, description, amount, clientRequestId, customSplits, splitWithUserIds\)/);
  assert.match(store, /GroupService\.addExpense\(groupId, description, amount, clientRequestId, customSplits, splitWithUserIds\)/);
});

test("the expense modal always sends the active members, for equal and custom shares", () => {
  const modal = read("components/groupDetails/AddExpenseModal.tsx");
  // `members` comes from groupDetail.members, which the store keeps free of invited people.
  assert.match(modal, /const members = \[\.\.\.\(groupDetail\?\.members \?\? \[\]\)\]/);
  assert.match(read("stores/useGroupStore.ts"), /members: d\.members\.filter\(\(m\) => m\.status !== "INVITED"\)/);
  assert.match(modal, /custom \? breakdown : undefined, members\.map\(\(m\) => m\.id\)\)/);
});

test("a 409 without a server message still tells the person what to do", () => {
  const modal = read("components/groupDetails/AddExpenseModal.tsx");
  assert.match(modal, /status === 409/);
  assert.match(modal, /Wait for invitations to be accepted, or add the expense only for people who are already in the group\./);
});

test("the server's guard for old app builds stays", () => {
  const server = read("../backend/services/group.service.ts");
  assert.match(server, /have not accepted their invitation yet\. Wait for them, or choose who shares this expense\./);
});
