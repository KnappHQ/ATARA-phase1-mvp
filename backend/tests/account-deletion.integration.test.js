const assert = require("node:assert/strict");
const test = require("node:test");

if (!process.env.TEST_DATABASE_URL) {
  test.skip("account deletion keeps the shared ledger (requires TEST_DATABASE_URL)", () => {});
} else {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  require("ts-node/register");
  const prisma = require("../config/prisma.ts").default;
  const { userService } = require("../services/user.service.ts");

  test("account deletion keeps shared expenses, splits and transactions", async (t) => {
    const suffix = Date.now().toString(36);
    const deletedId = `deleted-${suffix}`;
    const survivorId = `survivor-${suffix}`;
    const groupId = `group-${suffix}`;
    const expenseId = `expense-${suffix}`;

    t.after(async () => {
      await prisma.paymentUse.deleteMany({
        where: { referenceId: { contains: suffix } },
      });
      await prisma.transaction.deleteMany({
        where: { senderId: { in: [deletedId, survivorId] } },
      });
      await prisma.group.deleteMany({ where: { id: groupId } });
      await prisma.user.deleteMany({
        where: { id: { in: [deletedId, survivorId] } },
      });
      await prisma.$disconnect();
    });

    await prisma.user.createMany({
      data: [
        {
          id: deletedId,
          handle: `owner_${suffix}`,
          publicAddress: "0x1000000000000000000000000000000000000001",
          smartAccountAddress: "0x2000000000000000000000000000000000000001",
        },
        {
          id: survivorId,
          handle: `member_${suffix}`,
          publicAddress: "0x1000000000000000000000000000000000000002",
          smartAccountAddress: "0x2000000000000000000000000000000000000002",
        },
      ],
    });
    await prisma.group.create({
      data: {
        id: groupId,
        name: "Shared dinner",
        createdById: deletedId,
        assetSymbol: "USDC",
        members: { create: [{ userId: deletedId }, { userId: survivorId }] },
        expenses: {
          create: {
            id: expenseId,
            paidById: deletedId,
            description: "Dinner",
            amount: "20",
            assetSymbol: "USDC",
            splits: {
              create: [
                { userId: survivorId, amount: "10", decision: "ACCEPTED" },
              ],
            },
          },
        },
      },
    });
    await prisma.transaction.create({
      data: {
        senderId: deletedId,
        receiverId: survivorId,
        receiverAddress: "0x2000000000000000000000000000000000000002",
        txHash: `0x${suffix.padStart(64, "0")}`,
        assetSymbol: "USDC",
        amount: "3",
        status: "COMPLETED",
      },
    });

    await userService.deleteAccount(deletedId);

    const [account, group, expense, split, transaction] = await Promise.all([
      prisma.user.findUnique({ where: { id: deletedId } }),
      prisma.group.findUnique({ where: { id: groupId } }),
      prisma.groupExpense.findUnique({ where: { id: expenseId } }),
      prisma.groupExpenseSplit.findFirst({
        where: { expenseId, userId: survivorId },
      }),
      prisma.transaction.findFirst({
        where: { senderId: deletedId, receiverId: survivorId },
      }),
    ]);

    assert.ok(account.deletedAt);
    assert.equal(account.publicAddress, null);
    assert.equal(account.smartAccountAddress, null);
    assert.equal(group.createdById, survivorId);
    assert.ok(expense);
    assert.ok(split);
    assert.ok(transaction);
  });
}
