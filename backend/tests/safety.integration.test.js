const assert = require("node:assert/strict");
const test = require("node:test");

if (!process.env.TEST_DATABASE_URL) {
  test.skip("report, block and group consent against a real database (requires TEST_DATABASE_URL)", () => {});
} else {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
  require("ts-node/register");
  const prisma = require("../config/prisma.ts").default;
  const { safetyService } = require("../services/safety.service.ts");
  const { groupService } = require("../services/group.service.ts");
  const { userService } = require("../services/user.service.ts");
  const { transactionService } = require("../services/transaction.service.ts");

  const suffix = Date.now().toString(36);
  const ids = { a: `a-${suffix}`, b: `b-${suffix}`, c: `c-${suffix}` };
  const handle = (key) => `${key}_${suffix}`;
  let createdGroups = [];

  const failsWith = async (promise, status, text) => {
    await assert.rejects(promise, (error) => {
      assert.equal(error.statusCode, status, error.message);
      if (text) assert.match(error.message, text);
      return true;
    });
  };

  test.before(async () => {
    await prisma.user.createMany({
      data: Object.entries(ids).map(([key, id], index) => ({
        id,
        handle: handle(key),
        displayName: `Person ${key}`,
        smartAccountAddress: `0x${(index + 1).toString(16).padStart(40, "7")}`,
      })),
    });
    // Alchemy is not reachable from tests: the history is the in-app part only.
    transactionService.fetchAlchemyHistory = async () => [];
  });

  test.after(async () => {
    const userIds = Object.values(ids);
    await prisma.userReport.deleteMany({ where: { OR: [{ reporterId: { in: userIds } }, { reportedId: { in: userIds } }] } });
    await prisma.transaction.deleteMany({ where: { senderId: { in: userIds } } });
    await prisma.group.deleteMany({ where: { createdById: { in: userIds } } });
    await prisma.userBlock.deleteMany({ where: { OR: [{ blockerId: { in: userIds } }, { blockedId: { in: userIds } }] } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  test("a block hides each person from the other's search, lookup and contacts", async () => {
    // Before the block both can find each other.
    assert.equal((await userService.searchUsers(handle("b"), ids.a)).length, 1);
    assert.equal((await userService.getUserByHandle(handle("b"), false, ids.a)).id, ids.b);
    await prisma.transaction.create({
      data: {
        senderId: ids.b, receiverId: ids.a, receiverAddress: "0x" + "7".repeat(40), txHash: `0x${suffix}`.padEnd(66, "1"),
        assetSymbol: "USDC", amount: "1", userNote: "hello a", status: "COMPLETED",
      },
    });
    assert.equal((await userService.getRecentContacts(ids.a)).some((c) => c.id === ids.b), true);
    assert.equal((await transactionService.getHistory(ids.a)).transactions?.[0]?.userNote ?? (await transactionService.getHistory(ids.a))[0]?.userNote, "hello a");

    // A blocks B.
    await safetyService.block(ids.a, handle("b"));
    await safetyService.block(ids.a, handle("b")); // twice: still one block
    assert.equal(await prisma.userBlock.count({ where: { blockerId: ids.a, blockedId: ids.b } }), 1);

    // Neither finds the other, and the answer is the same as for a missing account.
    assert.equal((await userService.searchUsers(handle("b"), ids.a)).length, 0);
    assert.equal((await userService.searchUsers(handle("a"), ids.b)).length, 0, "the blocked person cannot find the blocker");
    await failsWith(userService.getUserByHandle(handle("b"), false, ids.a), 404, /User not found/);
    await failsWith(userService.getUserByHandle(handle("a"), false, ids.b), 404, /User not found/);
    await failsWith(transactionService.resolveHandle(handle("a"), ids.b), 404);
    assert.equal((await userService.getRecentContacts(ids.a)).some((c) => c.id === ids.b), false);
    assert.equal((await userService.getRecentContacts(ids.b)).some((c) => c.id === ids.a), false);
    // Someone else still finds both, and looking yourself up still works.
    assert.equal((await userService.searchUsers(handle("b"), ids.c)).length, 1);
    assert.equal((await userService.getUserByHandle(handle("a"), false, ids.a)).id, ids.a);

    // The old note is hidden, the payment is not.
    const history = await transactionService.getHistory(ids.a);
    const rows = history.transactions ?? history;
    const row = rows.find((item) => item.isInApp);
    assert.equal(row.userNote, null);
    assert.equal(row.noteHidden, true);
    assert.equal(row.amount, "1");

    // Unblocking restores everything.
    await safetyService.unblock(ids.a, handle("b"));
    assert.equal((await userService.searchUsers(handle("b"), ids.a)).length, 1);
    assert.deepEqual(await safetyService.listBlocks(ids.a), []);
  });

  test("a blocked person cannot be put into a group, in either direction, and it reads as not found", async () => {
    await safetyService.block(ids.a, handle("b"));
    await failsWith(groupService.createGroup(ids.a, "G", undefined, [handle("b")]), 404, /not found/i);
    await failsWith(groupService.createGroup(ids.b, "G", undefined, [handle("a")]), 404, /not found/i);
    const group = await groupService.createGroup(ids.c, "Open", undefined, [handle("a")]);
    createdGroups.push(group.id);
    await groupService.acceptInvitation(group.id, ids.a);
    // A is in the group and has blocked B: A cannot add B to it.
    await failsWith(groupService.addMembers(group.id, ids.a, [handle("b")]), 404, /not found/i);
    await safetyService.unblock(ids.a, handle("b"));
  });

  test("someone added to a group is only invited: they see nothing and nothing can be assigned to them until they accept", async () => {
    const group = await groupService.createGroup(ids.a, "Trip", "desc", [handle("b")]);
    createdGroups.push(group.id);
    const member = (id) => prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: id } } });
    assert.equal((await member(ids.a)).status, "ACTIVE", "the creator");
    const invited = await member(ids.b);
    assert.equal(invited.status, "INVITED");
    assert.equal(invited.invitedById, ids.a);

    // B sees the invitation, but not the group.
    const invitations = await groupService.getInvitations(ids.b);
    assert.equal(invitations.length, 1);
    assert.deepEqual([invitations[0].groupId, invitations[0].invitedBy.handle], [group.id, handle("a")]);
    assert.equal((await groupService.getMyGroups(ids.b)).length, 0);
    await failsWith(groupService.getGroupDetails(group.id, ids.b), 403);

    // Nothing can be assigned to B yet.
    const key = (n) => `req-${suffix}-${n}`.padEnd(20, "0");
    await failsWith(groupService.addExpense(group.id, ids.a, "Taxi", "10", [ids.a, ids.b], undefined, key(1)), 409, /has not accepted/);
    // Without naming anyone, an expense is shared among the members who accepted: B is left out.
    const equal = await groupService.addExpense(group.id, ids.a, "Coffee", "4", undefined, undefined, key(2));
    assert.deepEqual(equal.splits.map((split) => split.userId), [ids.a]);

    // Accepting makes B a member and shares possible.
    await groupService.acceptInvitation(group.id, ids.b);
    assert.equal((await member(ids.b)).status, "ACTIVE");
    assert.equal((await groupService.getMyGroups(ids.b)).length, 1);
    assert.equal((await groupService.getInvitations(ids.b)).length, 0);
    const expense = await groupService.addExpense(group.id, ids.a, "Taxi", "10", [ids.a, ids.b], undefined, key(3));
    assert.equal(expense.splits.length, 2);
  });

  test("declining removes the invitation, and blocking the person who invited also removes it", async () => {
    const declined = await groupService.createGroup(ids.a, "Declined", undefined, [handle("c")]);
    createdGroups.push(declined.id);
    await groupService.declineInvitation(declined.id, ids.c);
    assert.equal(await prisma.groupMember.count({ where: { groupId: declined.id, userId: ids.c } }), 0);
    await failsWith(groupService.acceptInvitation(declined.id, ids.c), 404);

    const second = await groupService.createGroup(ids.a, "Unwanted", undefined, [handle("c")]);
    createdGroups.push(second.id);
    await safetyService.block(ids.c, handle("a"));
    assert.equal(await prisma.groupMember.count({ where: { groupId: second.id, userId: ids.c } }), 0, "blocking the inviter ends the invitation");
    await safetyService.unblock(ids.c, handle("a"));
  });

  test("an expense cannot be assigned across a block, whoever blocked", async () => {
    const group = await groupService.createGroup(ids.a, "Pair", undefined, [handle("b")]);
    createdGroups.push(group.id);
    await groupService.acceptInvitation(group.id, ids.b);
    await safetyService.block(ids.b, handle("a")); // the person who would receive the share blocks the payer
    const key = `req-${suffix}-blocked`.padEnd(20, "0");
    await failsWith(groupService.addExpense(group.id, ids.a, "Dinner", "20", [ids.a, ids.b], undefined, key), 400, /can't include/);
    await safetyService.unblock(ids.b, handle("a"));
    await safetyService.block(ids.a, handle("b")); // and the other way round
    await failsWith(groupService.addExpense(group.id, ids.a, "Dinner", "20", [ids.a, ids.b], undefined, key), 400, /can't include/);
    await safetyService.unblock(ids.a, handle("b"));
  });

  test("a report is stored with a snapshot, can be reviewed, and survives both accounts' deletion rules", async () => {
    const reporter = { id: ids.a, handle: handle("a") };
    const { id } = await safetyService.report(reporter, { handle: handle("b"), reason: "harassment", details: "keeps adding me to groups", alsoBlock: true });
    const row = await prisma.userReport.findUnique({ where: { id } });
    assert.deepEqual([row.reporterId, row.reportedId, row.reportedHandle, row.reason, row.status], [ids.a, ids.b, handle("b"), "HARASSMENT", "OPEN"]);
    assert.equal(await prisma.userBlock.count({ where: { blockerId: ids.a, blockedId: ids.b } }), 1, "alsoBlock blocks");

    const open = await safetyService.listReports("OPEN", 200);
    assert.ok(open.some((report) => report.id === id && report.reporter.handle === handle("a")));
    const updated = await safetyService.setReportStatus(id, "REVIEWED");
    assert.equal(updated.status, "REVIEWED");
    assert.ok(updated.reviewedAt);
    assert.equal((await safetyService.listReports("OPEN", 200)).some((report) => report.id === id), false);
    await failsWith(safetyService.setReportStatus(id, "DELETED"), 400);
    await failsWith(safetyService.setReportStatus("no-such-report", "REVIEWED"), 404);

    // The reporter deletes their account: the report stays, unlinked, its text erased.
    await userService.deleteAccount(ids.a);
    const after = await prisma.userReport.findUnique({ where: { id } });
    assert.equal(after.reporterId, null);
    assert.equal(after.details, "");
    assert.equal(after.reportedHandle, handle("b"));
    assert.equal(await prisma.userBlock.count({ where: { OR: [{ blockerId: ids.a }, { blockedId: ids.a }] } }), 0, "their blocks go with the account");
  });
}
