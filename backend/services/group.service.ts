import prisma from "../config/prisma";
import { ErrorHandler } from "../utils/errorHandler";
import { ethers } from "ethers";
import { Prisma } from "@prisma/client";
import { splitExpense } from "../utils/expenseAmounts";
import { getKnownTokens, type AppNetwork } from "../utils/tokenConfig";
import { NETWORK } from "../utils/constants";
import { verifyTokenPayment } from "./paymentProof.service";

interface MemberBalance {
  userId: string;
  handle: string;
  displayName: string | null;
  profilePicUrl: string | null;
  smartAccountAddress: string | null;
  owedByMe: number;
  owedToMe: number;
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
  userNetBalance: number;
  assetSymbol: string;
}

class GroupService {
  private async assertMember(
    groupId: string,
    userId: string,
    db: Prisma.TransactionClient = prisma,
  ) {
    const member = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member)
      throw new ErrorHandler("You are not a member of this group", 403);
  }

  private async assertCreator(
    groupId: string,
    userId: string,
    db: Prisma.TransactionClient = prisma,
  ) {
    const group = await db.group.findUnique({
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
    if (
      handles.length > 49 ||
      handles.some(
        (h) =>
          typeof h !== "string" ||
          !/^[a-zA-Z0-9_]{1,32}$/.test(h.replace(/^@/, "")),
      )
    )
      throw new ErrorHandler("Invalid member handles (maximum 49)", 400);
    handles = [
      ...new Set(handles.map((h) => h.replace(/^@/, "").toLowerCase())),
    ];
    const users = await prisma.user.findMany({
      where: { handle: { in: handles }, deletedAt: null },
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
        assetSymbol: "USDC",
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
                  where: { settled: false, decision: "ACCEPTED" },
                },
              },
            },
          },
        },
      },
    });

    return memberships.map(({ group }) => {
      let owedToMe = 0;
      let owedByMe = 0;

      for (const expense of group.expenses) {
        for (const split of expense.splits) {
          if (expense.paidById === userId && split.userId !== userId) {
            owedToMe += Number(split.amount);
          } else if (split.userId === userId && expense.paidById !== userId) {
            owedByMe += Number(split.amount);
          }
        }
      }

      return {
        id: group.id,
        name: group.name,
        description: group.description,
        createdById: group.createdById,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
        memberCount: group._count.members,
        assetSymbol: group.assetSymbol,
        userNetBalance: parseFloat((owedToMe - owedByMe).toFixed(8)),
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
                smartAccountAddress: true,
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
    const owedBy: Record<string, number> = {};
    const owedTo: Record<string, number> = {};

    for (const expense of group.expenses) {
      for (const split of expense.splits) {
        if (split.settled || split.decision !== "ACCEPTED") continue;

        const paidById = expense.paidById;
        const splitUserId = split.user.id;
        const splitAmount = Number(split.amount);

        if (paidById === requestingUserId && splitUserId !== requestingUserId) {
          owedTo[splitUserId] = (owedTo[splitUserId] ?? 0) + splitAmount;
          balanceMap[splitUserId] =
            (balanceMap[splitUserId] ?? 0) + splitAmount;
        } else if (
          splitUserId === requestingUserId &&
          paidById !== requestingUserId
        ) {
          owedBy[paidById] = (owedBy[paidById] ?? 0) + splitAmount;
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
        smartAccountAddress: m.user.smartAccountAddress ?? null,
        owedByMe: Number((owedBy[m.userId] ?? 0).toFixed(8)),
        owedToMe: Number((owedTo[m.userId] ?? 0).toFixed(8)),
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
    return prisma.$transaction(
      async (db) => {
        await this.assertCreator(groupId, requestingUserId, db);

        if (await db.groupExpense.count({ where: { groupId } }))
          throw new ErrorHandler(
            "A group with expense history cannot be deleted",
            409,
          );
        await db.group.delete({ where: { id: groupId } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
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
    return prisma.$transaction(
      async (db) => {
        const group = await db.group.findUnique({
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
        const unsettled = await db.groupExpenseSplit.count({
          where: {
            settled: false,
            expense: { groupId },
            OR: [
              { userId: targetUserId },
              { expense: { paidById: targetUserId } },
            ],
          },
        });
        if (unsettled > 0) {
          throw new ErrorHandler(
            "This member has unsettled expenses in the group. Please settle up before removing.",
            400,
          );
        }

        await db.groupMember.delete({
          where: { groupId_userId: { groupId, userId: targetUserId } },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  public async addExpense(
    groupId: string,
    payerId: string,
    description: string,
    amount: number | string,
    splitWithUserIds?: string[],
    customSplits?: { userId: string; amount: unknown }[],
    clientRequestId?: string,
  ) {
    return prisma.$transaction(
      async (db) => {
        await this.assertMember(groupId, payerId, db);
        if (!description.trim() || description.length > 240)
          throw new ErrorHandler("Description: 1–240 characters", 400);
        if (!clientRequestId || !/^[a-zA-Z0-9-]{16,64}$/.test(clientRequestId))
          throw new ErrorHandler(
            "An idempotency key is required; update the app",
            400,
          );
        const members = await db.groupMember.findMany({
          where: { groupId },
          select: { userId: true },
        });
        const ids = splitWithUserIds?.length
          ? splitWithUserIds
          : members.map((m) => m.userId);
        if (ids.some((id) => !members.some((m) => m.userId === id)))
          throw new ErrorHandler("Unknown group member", 400);
        const shares = splitExpense(amount, ids, customSplits);
        const group = await db.group.findUniqueOrThrow({
          where: { id: groupId },
        });
        const existing = await db.groupExpense.findUnique({
          where: {
            groupId_paidById_clientRequestId: {
              groupId,
              paidById: payerId,
              clientRequestId,
            },
          },
          include: { splits: true },
        });
        if (existing) {
          const same =
            existing.description === description &&
            existing.amount.equals(String(amount)) &&
            existing.splits.length === shares.length &&
            shares.every((s) =>
              existing.splits.some(
                (e) => e.userId === s.userId && e.amount.equals(s.amount),
              ),
            );
          if (!same)
            throw new ErrorHandler(
              "This request key already refers to another expense",
              409,
            );
          return existing;
        }
        return db.groupExpense.create({
          data: {
            groupId,
            paidById: payerId,
            description,
            amount,
            assetSymbol: group.assetSymbol,
            clientRequestId,
            splits: {
              create: shares.map((s) => ({
                ...s,
                settled: s.userId === payerId || Number(s.amount) === 0,
                settledAt:
                  s.userId === payerId || Number(s.amount) === 0
                    ? new Date()
                    : null,
                decision:
                  s.userId === payerId || Number(s.amount) === 0
                    ? "ACCEPTED"
                    : "PENDING",
                decidedAt:
                  s.userId === payerId || Number(s.amount) === 0
                    ? new Date()
                    : null,
              })),
            },
          },
          include: {
            paidBy: { select: { id: true, handle: true, displayName: true } },
            splits: true,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  public async decideSplit(
    expenseId: string,
    userId: string,
    decision: string,
  ) {
    if (!["ACCEPTED", "DISPUTED"].includes(decision))
      throw new ErrorHandler("Accept or dispute your share", 400);
    return prisma.$transaction(
      async (db) => {
        const split = await db.groupExpenseSplit.findUnique({
          where: { expenseId_userId: { expenseId, userId } },
        });
        if (!split || split.settled)
          throw new ErrorHandler(
            "This share is unavailable or already settled",
            409,
          );
        const locked = await db.settlementIntent.findFirst({
          where: {
            senderId: userId,
            splitIds: { has: split.id },
            settledAt: null,
            expiresAt: { gt: new Date() },
          },
        });
        if (locked)
          throw new ErrorHandler(
            "A payment is being reviewed. Wait for its quote to expire before changing this share",
            409,
          );
        return db.groupExpenseSplit.update({
          where: { id: split.id },
          data: {
            decision: decision as "ACCEPTED" | "DISPUTED",
            decidedAt: new Date(),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
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
    return prisma.$transaction(
      async (db) => {
        const expense = await db.groupExpense.findUnique({
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

        const accepted = await db.groupExpenseSplit.count({
          where: {
            expenseId,
            userId: { not: expense.paidById },
            OR: [
              { decision: "ACCEPTED" },
              { settlementTransactionId: { not: null } },
            ],
          },
        });
        if (accepted)
          throw new ErrorHandler(
            "An acknowledged or paid expense must remain in the history",
            409,
          );
        await db.groupExpense.delete({ where: { id: expenseId } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  public async getSettleAllAmount(
    groupId: string,
    userId: string,
    targetUserId: string,
  ) {
    await this.assertMember(groupId, userId);
    await this.assertMember(groupId, targetUserId);
    const splits = await prisma.groupExpenseSplit.findMany({
      where: {
        userId,
        settled: false,
        decision: "ACCEPTED",
        expense: { groupId, paidById: targetUserId },
      },
    });
    return splits
      .reduce((sum, s) => sum.add(s.amount), new Prisma.Decimal(0))
      .toNumber();
  }

  public async createSettlementIntent(
    groupId: string,
    userId: string,
    targetUserId: string,
  ) {
    await this.assertMember(groupId, userId);
    await this.assertMember(groupId, targetUserId);
    if (userId === targetUserId)
      throw new ErrorHandler("Cannot settle with yourself", 400);
    return prisma.$transaction(
      async (db) => {
        const group = await db.group.findUniqueOrThrow({
          where: { id: groupId },
        });
        if (group.assetSymbol !== "USDC")
          throw new ErrorHandler(
            "Legacy USD expenses need an agreed conversion. Create a USDC group for direct settlement",
            409,
          );
        const recipient = await db.user.findUnique({
          where: { id: targetUserId, deletedAt: null },
        });
        if (!recipient?.smartAccountAddress)
          throw new ErrorHandler(
            "This account is no longer available for payment",
            409,
          );
        const active = await db.settlementIntent.findFirst({
          where: {
            groupId,
            senderId: userId,
            receiverId: targetUserId,
            settledAt: null,
            expiresAt: { gt: new Date() },
          },
        });
        if (active) return active;
        const splits = await db.groupExpenseSplit.findMany({
          where: {
            userId,
            settled: false,
            decision: "ACCEPTED",
            expense: { groupId, paidById: targetUserId },
          },
        });
        if (!splits.length)
          throw new ErrorHandler("No accepted shares to pay", 409);
        return db.settlementIntent.create({
          data: {
            groupId,
            senderId: userId,
            receiverId: targetUserId,
            splitIds: splits.map((s) => s.id),
            amount: splits.reduce(
              (sum, s) => sum.add(s.amount),
              new Prisma.Decimal(0),
            ),
            expiresAt: new Date(Date.now() + 10 * 60_000),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  public async settleAllWithMemberByInternalTx(
    groupId: string,
    userId: string,
    targetUserId: string,
    transactionId: string,
    intentId?: string,
  ) {
    if (!intentId)
      throw new ErrorHandler("A reviewed payment quote is required", 400);
    const [intent, tx, sender, recipient] = await Promise.all([
      prisma.settlementIntent.findUnique({ where: { id: intentId } }),
      prisma.transaction.findUnique({ where: { id: transactionId } }),
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.user.findUnique({ where: { id: targetUserId } }),
    ]);
    if (
      !intent ||
      intent.senderId !== userId ||
      intent.receiverId !== targetUserId ||
      intent.groupId !== groupId ||
      !tx ||
      tx.senderId !== userId ||
      !sender?.smartAccountAddress ||
      !recipient?.smartAccountAddress
    )
      throw new ErrorHandler("Invalid settlement reference", 403);
    if (tx.assetSymbol !== "USDC" || tx.status !== "COMPLETED")
      throw new ErrorHandler("Use a confirmed USDC payment", 400);
    const token = getKnownTokens(NETWORK as AppNetwork).USDC;
    const proof = await verifyTokenPayment({
      txHash: tx.txHash,
      token: token.address,
      sender: sender.smartAccountAddress,
      recipient: recipient.smartAccountAddress,
    });
    if (
      !proof.rawAmount.eq(
        ethers.utils.parseUnits(intent.amount.toString(), token.decimals),
      )
    )
      throw new ErrorHandler("Payment does not match the quoted amount", 400);
    if (
      proof.confirmedAt.getTime() <
        Math.floor(intent.createdAt.getTime() / 1000) * 1000 ||
      proof.confirmedAt > intent.expiresAt
    )
      throw new ErrorHandler(
        "Payment is outside this quote's validity period; contact support with the receipt",
        409,
      );
    return prisma.$transaction(
      async (db) => {
        const used = await db.paymentUse.findUnique({
          where: {
            chainId_txHash: { chainId: proof.chainId, txHash: proof.txHash },
          },
        });
        if (used?.referenceId === intentId) return { settled: true }; // Safe retry after a lost response.
        if (used)
          throw new ErrorHandler(
            "This payment has already settled another request",
            409,
          );
        const oldUse = await db.groupExpenseSplit.findFirst({
          where: { settlementTransactionId: transactionId },
        });
        if (oldUse)
          throw new ErrorHandler("This payment has already been used", 409);
        const splits = await db.groupExpenseSplit.findMany({
          where: {
            id: { in: intent.splitIds },
            userId,
            settled: false,
            decision: "ACCEPTED",
          },
        });
        if (splits.length !== intent.splitIds.length)
          throw new ErrorHandler(
            "The quoted shares changed; contact support with the receipt",
            409,
          );
        await db.paymentUse.create({
          data: {
            chainId: proof.chainId,
            txHash: proof.txHash,
            purpose: "GROUP",
            referenceId: intentId,
          },
        });
        const result = await db.groupExpenseSplit.updateMany({
          where: {
            id: { in: intent.splitIds },
            settled: false,
            decision: "ACCEPTED",
          },
          data: {
            settled: true,
            settledAt: proof.confirmedAt,
            settlementTransactionId: transactionId,
          },
        });
        if (result.count !== intent.splitIds.length)
          throw new ErrorHandler("Concurrent settlement; retry", 409);
        await db.settlementIntent.update({
          where: { id: intentId },
          data: { settledAt: proof.confirmedAt },
        });
        return { settled: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  public async contactBalances(userId: string, address: string) {
    if (!ethers.utils.isAddress(address))
      throw new ErrorHandler("Invalid contact address", 400);
    const contact = await prisma.user.findFirst({
      where: { smartAccountAddress: { equals: address, mode: "insensitive" } },
    });
    if (!contact || contact.id === userId) return [];
    const splits = await prisma.groupExpenseSplit.findMany({
      where: {
        settled: false,
        decision: "ACCEPTED",
        OR: [
          { userId, expense: { paidById: contact.id } },
          { userId: contact.id, expense: { paidById: userId } },
        ],
      },
      include: { expense: { select: { paidById: true, assetSymbol: true } } },
    });
    const balances: Record<
      string,
      { assetSymbol: string; owedByMe: number; owedToMe: number }
    > = {};
    for (const s of splits) {
      const unit = s.expense.assetSymbol;
      balances[unit] ??= { assetSymbol: unit, owedByMe: 0, owedToMe: 0 };
      if (s.userId === userId) balances[unit].owedByMe += Number(s.amount);
      else balances[unit].owedToMe += Number(s.amount);
    }
    return Object.values(balances).map((b) => ({
      ...b,
      owedByMe: Number(b.owedByMe.toFixed(8)),
      owedToMe: Number(b.owedToMe.toFixed(8)),
    }));
  }
}

export const groupService = new GroupService();
