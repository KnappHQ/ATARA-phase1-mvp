const assert = require("node:assert/strict");
const test = require("node:test");

if (!process.env.TEST_DATABASE_URL) {
  test.skip("archive and delete a group against a real database (requires TEST_DATABASE_URL)", () => {});
} else {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
  require("ts-node/register");
  const prisma = require("../config/prisma.ts").default;
  const { groupService } = require("../services/group.service.ts");

  const suffix = Date.now().toString(36);
  const ids = { a: `ga-${suffix}`, b: `gb-${suffix}`, c: `gc-${suffix}` };
  const handle = (key) => `${key}_${suffix}`;
  // Unique per run: addresses are unique in the database.
  const stamp = Date.now().toString(16);
  const address = (index) => `0x${stamp.padStart(38, "9")}${String(index).padStart(2, "0")}`;
  let counter = 0;
  const key = () => `lifecycle-key-${suffix}-${String(++counter).padStart(4, "0")}`;

  const failsWith = async (promise, status, text) => {
    await assert.rejects(promise, (error) => {
      assert.equal(error.statusCode, status, error.message);
      if (text) assert.match(error.message, text);
      return true;
    });
  };

  // A group of a (creator) and b, both active.
  const newGroup = async (name) => {
    const group = await groupService.createGroup(ids.a, name, undefined, [handle("b")]);
    await groupService.acceptInvitation(group.id, ids.b);
    return group;
  };
  const listFor = async (userId) => groupService.getMyGroups(userId);

  test.before(async () => {
    await prisma.user.createMany({
      data: Object.entries(ids).map(([k, id], index) => ({
        id,
        handle: handle(k),
        displayName: `Person ${k}`,
        smartAccountAddress: address(index + 1),
      })),
    });
  });

  test.after(async () => {
    const userIds = Object.values(ids);
    await prisma.settlementIntent.deleteMany({ where: { senderId: { in: userIds } } });
    await prisma.transaction.deleteMany({ where: { senderId: { in: userIds } } });
    await prisma.group.deleteMany({ where: { createdById: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  test("archiving hides the group for me only, and restoring brings it back", async () => {
    const group = await newGroup("Archive me");
    assert.equal((await listFor(ids.a)).find((g) => g.id === group.id).archivedAt, null);

    await groupService.archiveGroup(group.id, ids.b);
    const mine = (await listFor(ids.b)).find((g) => g.id === group.id);
    const theirs = (await listFor(ids.a)).find((g) => g.id === group.id);
    assert.ok(mine.archivedAt, "b sees it as archived");
    assert.equal(theirs.archivedAt, null, "a is not affected");
    // History is kept: the group is still readable and still has its members.
    assert.equal((await groupService.getGroupDetails(group.id, ids.b)).id, group.id);

    await groupService.unarchiveGroup(group.id, ids.b);
    assert.equal((await listFor(ids.b)).find((g) => g.id === group.id).archivedAt, null);
  });

  test("only active members can archive or restore", async () => {
    const group = await newGroup("Members only");
    await failsWith(groupService.archiveGroup(group.id, ids.c), 403);
    await failsWith(groupService.unarchiveGroup(group.id, ids.c), 403);
    // An invited person has no group yet.
    await groupService.addMembers(group.id, ids.a, [handle("c")]);
    await failsWith(groupService.archiveGroup(group.id, ids.c), 403);
  });

  test("a group with money still owed cannot be deleted", async () => {
    const group = await newGroup("Owes money");
    await groupService.addExpense(group.id, ids.a, "Dinner", "20", [ids.a, ids.b], undefined, key());
    await failsWith(groupService.deleteGroup(group.id, ids.a), 409, /Settle balances first/);
    assert.ok((await listFor(ids.b)).some((g) => g.id === group.id), "still listed");
  });

  test("a payment in progress blocks deleting, and an expired one does not", async () => {
    const group = await newGroup("Paying");
    const intent = await prisma.settlementIntent.create({
      data: {
        groupId: group.id, senderId: ids.b, receiverId: ids.a, amount: "5", splitIds: [],
        expiresAt: new Date(Date.now() + 5 * 60_000),
      },
    });
    await failsWith(groupService.deleteGroup(group.id, ids.a), 409, /payment is still in progress/);
    await prisma.settlementIntent.update({ where: { id: intent.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await groupService.deleteGroup(group.id, ids.a);
  });

  test("only the creator can delete", async () => {
    const group = await newGroup("Creator only");
    await failsWith(groupService.deleteGroup(group.id, ids.b), 403, /creator/i);
    await failsWith(groupService.deleteGroup(group.id, ids.c), 403);
  });

  test("deleting a settled group hides it for everyone and erases no history", async () => {
    const group = await newGroup("Done");
    const expense = await groupService.addExpense(group.id, ids.a, "Taxi", "10", [ids.a, ids.b], undefined, key());
    // Both shares are settled: b paid a back.
    await prisma.groupExpenseSplit.updateMany({ where: { expenseId: expense.id }, data: { settled: true, settledAt: new Date() } });
    await prisma.transaction.create({
      data: {
        senderId: ids.b, receiverId: ids.a, receiverAddress: address(1), txHash: `0x${suffix}`.padEnd(66, "2"),
        assetSymbol: "USDC", amount: "5", status: "COMPLETED",
      },
    });

    await groupService.deleteGroup(group.id, ids.a);

    for (const userId of [ids.a, ids.b]) {
      assert.ok(!(await listFor(userId)).some((g) => g.id === group.id), "gone from the list");
      await failsWith(groupService.getGroupDetails(group.id, userId), 404);
      await failsWith(groupService.archiveGroup(group.id, userId), 404);
    }
    // Soft delete: nothing was removed.
    const row = await prisma.group.findUnique({ where: { id: group.id } });
    assert.ok(row.deletedAt);
    assert.equal(row.deletedById, ids.a);
    assert.equal(await prisma.groupExpense.count({ where: { groupId: group.id } }), 1);
    assert.equal(await prisma.groupExpenseSplit.count({ where: { expenseId: expense.id } }), 2);
    assert.equal(await prisma.groupMember.count({ where: { groupId: group.id } }), 2);
    assert.equal(await prisma.transaction.count({ where: { senderId: ids.b, txHash: `0x${suffix}`.padEnd(66, "2") } }), 1);
    // A second delete finds nothing.
    await failsWith(groupService.deleteGroup(group.id, ids.a), 404);
  });

  test("a deleted group stops showing in invitations and contact balances", async () => {
    const group = await groupService.createGroup(ids.a, "Invite then delete", undefined, [handle("c")]);
    assert.equal((await groupService.getInvitations(ids.c)).filter((i) => i.groupId === group.id).length, 1);
    await groupService.deleteGroup(group.id, ids.a);
    assert.equal((await groupService.getInvitations(ids.c)).filter((i) => i.groupId === group.id).length, 0);
    await failsWith(groupService.acceptInvitation(group.id, ids.c), 404);
  });

  test("money owed in a deleted group never shows as a balance", async () => {
    const group = await newGroup("Balance");
    const expense = await groupService.addExpense(group.id, ids.a, "Lunch", "8", [ids.a, ids.b], undefined, key());
    await prisma.groupExpenseSplit.updateMany({ where: { expenseId: expense.id, userId: ids.b }, data: { decision: "ACCEPTED" } });
    const bAddress = address(2);
    assert.ok((await groupService.contactBalances(ids.a, bAddress)).length > 0, "owed while the group lives");
    // Settle it, then delete: the contact shows nothing from this group.
    await prisma.groupExpenseSplit.updateMany({ where: { expenseId: expense.id }, data: { settled: true, settledAt: new Date() } });
    await groupService.deleteGroup(group.id, ids.a);
    assert.equal((await groupService.contactBalances(ids.a, bAddress)).length, 0);
  });
}
