import { ethers } from "ethers";
import prisma from "../config/prisma";
import { ErrorHandler } from "../utils/errorHandler";
import { ALCHEMY_URL } from "../utils/constants";

const SETTLE_TOLERANCE = 0.02;

async function verifySettlementTx(data: {
  txHash: string;
  assetSymbol: string;
  amount: number;
  rawAmountWei: string;
  tokenPriceUsd: number;
  requiredUsd: number;
}) {
  const normalizedHash = data.txHash.toLowerCase();
  const alchemyProvider = new ethers.JsonRpcProvider(ALCHEMY_URL);
  const receipt = await alchemyProvider.getTransactionReceipt(normalizedHash);

  if (!receipt) {
    throw new ErrorHandler(
      "Transaction not found on-chain. It may still be pending.",
      404,
    );
  }

  if (receipt.status !== 1) {
    throw new ErrorHandler("Transaction failed on-chain", 400);
  }

  if (data.assetSymbol === "ETH") {
    const calculatedDecimal = ethers.formatEther(data.rawAmountWei);
    if (Math.abs(parseFloat(calculatedDecimal) - data.amount) > 0.0001) {
      throw new ErrorHandler(
        `Decimal amount mismatch. Wei: ${data.rawAmountWei} equals ${calculatedDecimal} ETH, but received ${data.amount}`,
        400,
      );
    }
  }

  const usdValueSent = data.amount * data.tokenPriceUsd;
  if (usdValueSent < data.requiredUsd * (1 - SETTLE_TOLERANCE)) {
    throw new ErrorHandler(
      `Insufficient settlement. Required $${data.requiredUsd.toFixed(2)} USD but transaction only covers $${usdValueSent.toFixed(2)} USD (${data.amount} ${data.assetSymbol} at $${data.tokenPriceUsd}/${data.assetSymbol}).`,
      400,
    );
  }
}

interface MemberBalance {
  userId: string;
  handle: string;
  displayName: string | null;
  profilePicUrl: string | null;
  netBalance: number; // positive = they owe me, negative = I owe them
}

interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  memberCount: number;
  myUnsettledAmount: number; // total USD I still owe across all expenses in this group
}

class GroupService {
  private async assertMember(groupId: string, userId: string) {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member)
      throw new ErrorHandler("You are not a member of this group", 403);
  }

  private async assertCreator(groupId: string, userId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { createdById: true },
    });
    if (!group) throw new ErrorHandler("Group not found", 404);
    if (group.createdById !== userId)
      throw new ErrorHandler(
        "Only the group creator can perform this action",
        403,
      );
  }

  private async resolveHandles(handles: string[]) {
    const users = await prisma.user.findMany({
      where: { handle: { in: handles } },
      select: { id: true, handle: true },
    });

    const found = new Set(users.map((u) => u.handle));
    const missing = handles.filter((h) => !found.has(h));
    if (missing.length > 0) {
      throw new ErrorHandler(
        `User(s) not found: ${missing.map((h) => `@${h}`).join(", ")}`,
        404,
      );
    }

    return users;
  }

  public async createGroup(
    creatorId: string,
    name: string,
    description?: string,
    memberHandles?: string[],
  ) {
    const memberUserIds: string[] = [];

    if (memberHandles && memberHandles.length > 0) {
      const resolved = await this.resolveHandles(memberHandles);
      resolved.forEach((u) => {
        if (u.id !== creatorId) memberUserIds.push(u.id);
      });
    }

    const group = await prisma.group.create({
      data: {
        name,
        description: description || null,
        createdById: creatorId,
        members: {
          create: [
            { userId: creatorId }, // creator is always a member
            ...memberUserIds.map((uid) => ({ userId: uid })),
          ],
        },
      },
      include: {
        creator: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            profilePicUrl: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                handle: true,
                displayName: true,
                profilePicUrl: true,
              },
            },
          },
        },
      },
    });

    return group;
  }

  public async getMyGroups(userId: string): Promise<GroupSummary[]> {
    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            _count: { select: { members: true } },
            expenses: {
              include: {
                splits: {
                  where: { userId, settled: false },
                  select: { amount: true },
                },
              },
            },
          },
        },
      },
    });

    return memberships.map(({ group }) => {
      const myUnsettledAmount = group.expenses
        .flatMap((e) => e.splits)
        .reduce((sum, s) => sum + Number(s.amount), 0);

      return {
        id: group.id,
        name: group.name,
        description: group.description,
        createdById: group.createdById,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
        memberCount: group._count.members,
        myUnsettledAmount: parseFloat(myUnsettledAmount.toFixed(8)),
      };
    });
  }

  public async getGroupDetails(groupId: string, requestingUserId: string) {
    await this.assertMember(groupId, requestingUserId);

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        creator: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            profilePicUrl: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                handle: true,
                displayName: true,
                profilePicUrl: true,
              },
            },
          },
        },
        expenses: {
          orderBy: { createdAt: "desc" },
          include: {
            paidBy: {
              select: {
                id: true,
                handle: true,
                displayName: true,
                profilePicUrl: true,
              },
            },
            splits: {
              include: {
                user: {
                  select: {
                    id: true,
                    handle: true,
                    displayName: true,
                    profilePicUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!group) throw new ErrorHandler("Group not found", 404);

    const balanceMap: Record<string, number> = {};

    for (const expense of group.expenses) {
      for (const split of expense.splits) {
        if (split.settled) continue;

        const paidById = expense.paidById;
        const splitUserId = split.user.id;
        const splitAmount = Number(split.amount);

        if (paidById === requestingUserId && splitUserId !== requestingUserId) {
          balanceMap[splitUserId] =
            (balanceMap[splitUserId] ?? 0) + splitAmount;
        } else if (
          splitUserId === requestingUserId &&
          paidById !== requestingUserId
        ) {
          balanceMap[paidById] = (balanceMap[paidById] ?? 0) - splitAmount;
        }
      }
    }

    const memberBalances: MemberBalance[] = group.members
      .filter((m) => m.userId !== requestingUserId)
      .map((m) => ({
        userId: m.user.id,
        handle: m.user.handle,
        displayName: m.user.displayName,
        profilePicUrl: m.user.profilePicUrl,
        netBalance: parseFloat((balanceMap[m.userId] ?? 0).toFixed(8)),
      }));

    return { ...group, memberBalances };
  }

  public async updateGroup(
    groupId: string,
    requestingUserId: string,
    data: { name?: string; description?: string },
  ) {
    await this.assertCreator(groupId, requestingUserId);

    return prisma.group.update({
      where: { id: groupId },
      data: {
        name: data.name,
        description: data.description,
      },
      select: { id: true, name: true, description: true, updatedAt: true },
    });
  }

  public async deleteGroup(groupId: string, requestingUserId: string) {
    await this.assertCreator(groupId, requestingUserId);

    await prisma.group.delete({ where: { id: groupId } });
  }

  public async addMembers(
    groupId: string,
    requestingUserId: string,
    handles: string[],
  ) {
    await this.assertMember(groupId, requestingUserId);

    const users = await this.resolveHandles(handles);

    const existing = await prisma.groupMember.findMany({
      where: { groupId, userId: { in: users.map((u) => u.id) } },
      select: { userId: true },
    });
    const existingIds = new Set(existing.map((m) => m.userId));
    const toAdd = users.filter((u) => !existingIds.has(u.id));

    if (toAdd.length === 0) {
      throw new ErrorHandler("All specified users are already members", 409);
    }

    await prisma.groupMember.createMany({
      data: toAdd.map((u) => ({ groupId, userId: u.id })),
    });

    return toAdd;
  }

  public async removeMember(
    groupId: string,
    requestingUserId: string,
    targetUserId: string,
  ) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { createdById: true },
    });
    if (!group) throw new ErrorHandler("Group not found", 404);

    const isCreator = group.createdById === requestingUserId;
    const isSelf = targetUserId === requestingUserId;

    if (!isCreator && !isSelf) {
      throw new ErrorHandler(
        "Only the group creator can remove other members",
        403,
      );
    }

    if (targetUserId === group.createdById) {
      throw new ErrorHandler("The group creator cannot be removed", 400);
    }

    // Check for unsettled splits for this member
    const unsettled = await prisma.groupExpenseSplit.count({
      where: { userId: targetUserId, settled: false, expense: { groupId } },
    });
    if (unsettled > 0) {
      throw new ErrorHandler(
        "This member has unsettled expenses in the group. Please settle up before removing.",
        400,
      );
    }

    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });
  }

  public async addExpense(
    groupId: string,
    payerId: string,
    description: string,
    amount: number,
    splitWithUserIds?: string[], // if omitted, splits among all current members
  ) {
    const assetSymbol = "USD"; // expenses are always recorded in USD
    await this.assertMember(groupId, payerId);

    let splitUserIds: string[];

    if (splitWithUserIds && splitWithUserIds.length > 0) {
      const members = await prisma.groupMember.findMany({
        where: { groupId, userId: { in: splitWithUserIds } },
        select: { userId: true },
      });
      if (members.length !== splitWithUserIds.length) {
        throw new ErrorHandler(
          "One or more specified users are not group members",
          400,
        );
      }
      const idSet = new Set([payerId, ...splitWithUserIds]);
      splitUserIds = [...idSet];
    } else {
      const allMembers = await prisma.groupMember.findMany({
        where: { groupId },
        select: { userId: true },
      });
      splitUserIds = allMembers.map((m) => m.userId);
    }

    const perPersonAmount = parseFloat(
      (amount / splitUserIds.length).toFixed(8),
    );

    const expense = await prisma.groupExpense.create({
      data: {
        groupId,
        paidById: payerId,
        description,
        amount,
        assetSymbol,
        splits: {
          create: splitUserIds.map((uid) => ({
            userId: uid,
            amount: perPersonAmount,
            settled: uid === payerId, // payer's own split auto-settled
            settledAt: uid === payerId ? new Date() : null,
          })),
        },
      },
      include: {
        paidBy: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            profilePicUrl: true,
          },
        },
        splits: {
          include: {
            user: {
              select: {
                id: true,
                handle: true,
                displayName: true,
                profilePicUrl: true,
              },
            },
          },
        },
      },
    });

    return expense;
  }

  public async getExpenses(groupId: string, requestingUserId: string) {
    await this.assertMember(groupId, requestingUserId);

    return prisma.groupExpense.findMany({
      where: { groupId },
      orderBy: { createdAt: "desc" },
      include: {
        paidBy: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            profilePicUrl: true,
          },
        },
        splits: {
          include: {
            user: {
              select: {
                id: true,
                handle: true,
                displayName: true,
                profilePicUrl: true,
              },
            },
          },
        },
      },
    });
  }

  public async deleteExpense(expenseId: string, requestingUserId: string) {
    const expense = await prisma.groupExpense.findUnique({
      where: { id: expenseId },
      include: {
        group: { select: { createdById: true } },
      },
    });

    if (!expense) throw new ErrorHandler("Expense not found", 404);

    const isGroupCreator = expense.group.createdById === requestingUserId;
    const isPayer = expense.paidById === requestingUserId;

    if (!isPayer && !isGroupCreator) {
      throw new ErrorHandler(
        "Only the expense payer or group creator can delete this expense",
        403,
      );
    }

    await prisma.groupExpense.delete({ where: { id: expenseId } });
  }

  public async settleMyShare(
    expenseId: string,
    requestingUserId: string,
    txHash: string,
    assetSymbol: string,
    amount: number,
    rawAmountWei: string,
    tokenPriceUsd: number,
  ) {
    const split = await prisma.groupExpenseSplit.findUnique({
      where: { expenseId_userId: { expenseId, userId: requestingUserId } },
      select: { settled: true, amount: true },
    });

    if (!split) {
      throw new ErrorHandler("You do not have a split in this expense", 404);
    }

    if (split.settled) {
      throw new ErrorHandler("Your share is already settled", 409);
    }

    await verifySettlementTx({
      txHash,
      assetSymbol,
      amount,
      rawAmountWei,
      tokenPriceUsd,
      requiredUsd: Number(split.amount),
    });

    return prisma.groupExpenseSplit.update({
      where: { expenseId_userId: { expenseId, userId: requestingUserId } },
      data: { settled: true, settledAt: new Date() },
    });
  }

  public async getSettleAllAmount(
    groupId: string,
    requestingUserId: string,
    targetUserId: string,
  ): Promise<number> {
    await this.assertMember(groupId, requestingUserId);
    await this.assertMember(groupId, targetUserId);

    const splits = await prisma.groupExpenseSplit.findMany({
      where: {
        userId: requestingUserId,
        settled: false,
        expense: { groupId, paidById: targetUserId },
      },
      select: { amount: true },
    });

    return parseFloat(
      splits
        .reduce((sum: number, s: { amount: any }) => sum + Number(s.amount), 0)
        .toFixed(2),
    );
  }

  public async settleAllWithMember(
    groupId: string,
    requestingUserId: string,
    targetUserId: string,
    txHash: string,
    assetSymbol: string,
    amount: number,
    rawAmountWei: string,
    tokenPriceUsd: number,
  ) {
    await this.assertMember(groupId, requestingUserId);
    await this.assertMember(groupId, targetUserId);

    const owedSplits = await prisma.groupExpenseSplit.findMany({
      where: {
        userId: requestingUserId,
        settled: false,
        expense: { groupId, paidById: targetUserId },
      },
      select: { amount: true },
    });

    const totalOwedUsd = parseFloat(
      owedSplits
        .reduce((sum: number, s: { amount: any }) => sum + Number(s.amount), 0)
        .toFixed(2),
    );

    if (totalOwedUsd === 0) {
      throw new ErrorHandler(
        "You have no unsettled balance with this member",
        409,
      );
    }

    await verifySettlementTx({
      txHash,
      assetSymbol,
      amount,
      rawAmountWei,
      tokenPriceUsd,
      requiredUsd: totalOwedUsd,
    });

    await prisma.groupExpenseSplit.updateMany({
      where: {
        userId: requestingUserId,
        settled: false,
        expense: { groupId, paidById: targetUserId },
      },
      data: { settled: true, settledAt: new Date() },
    });
  }
}

export const groupService = new GroupService();
