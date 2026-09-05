import { ethers } from "ethers";
import prisma from "../config/prisma";
import { ErrorHandler } from "../utils/errorHandler";
import { NETWORK } from "../utils/constants";
import { verifyTransfer } from "../utils/chainVerifier";
import {
  getTokenConfig,
  isSupportedTokenSymbol,
  type AppNetwork,
} from "../utils/tokenConfig";
import { getUsdPrice } from "./price.service";

const SETTLE_TOLERANCE = 0.02;

/** Native ETH is priced and scaled like an 18-decimal token. */
const ETH_DECIMALS = 18;

type SettlementParties = {
  payerAddress: string;
  payeeAddress: string;
};

/**
 * Resolve the on-chain identities of both sides of a settlement.
 *
 * Addresses come from the database, never from the request: the whole point is
 * that the payer cannot tell us who they paid.
 */
async function loadSettlementParties(
  payerId: string,
  payeeId: string,
): Promise<SettlementParties> {
  const users = await prisma.user.findMany({
    where: { id: { in: [payerId, payeeId] } },
    select: { id: true, smartAccountAddress: true, handle: true },
  });

  const payer = users.find((u) => u.id === payerId);
  const payee = users.find((u) => u.id === payeeId);

  if (!payer?.smartAccountAddress) {
    throw new ErrorHandler("Your smart account address is not set up yet", 400);
  }

  if (!payee?.smartAccountAddress) {
    throw new ErrorHandler(
      `@${payee?.handle ?? "member"} has no smart account address, so an on-chain settlement cannot be verified.`,
      400,
    );
  }

  return {
    payerAddress: payer.smartAccountAddress,
    payeeAddress: payee.smartAccountAddress,
  };
}

/**
 * Establish what an on-chain payment is actually worth, in USD.
 *
 * Every input that decides the outcome - the recipient, the token, the amount,
 * the price - is resolved server-side. The caller supplies only the hash and
 * which asset to look for.
 */
async function valueSettlementTx(params: {
  txHash: string;
  assetSymbol: string;
  parties: SettlementParties;
}): Promise<{ usdValue: number; decimalAmount: string }> {
  const assetSymbol = params.assetSymbol.toUpperCase();

  let decimals: number;
  let token;

  if (assetSymbol === "ETH") {
    decimals = ETH_DECIMALS;
  } else {
    if (!isSupportedTokenSymbol(assetSymbol)) {
      throw new ErrorHandler(`Unsupported settlement asset: ${assetSymbol}`, 400);
    }

    token = getTokenConfig(NETWORK as AppNetwork, assetSymbol);

    if (!token) {
      throw new ErrorHandler(
        `${assetSymbol} is not configured for this network`,
        400,
      );
    }

    decimals = token.decimals;
  }

  const verified = await verifyTransfer({
    txHash: params.txHash,
    expectedFrom: params.parties.payerAddress,
    expectedTo: params.parties.payeeAddress,
    assetSymbol,
    token,
  });

  const decimalAmount = ethers.utils.formatUnits(verified.rawAmount, decimals);
  const priceUsd = await getUsdPrice(assetSymbol);

  return {
    usdValue: parseFloat(decimalAmount) * priceUsd,
    decimalAmount,
  };
}

function assertCoversDebt(usdValue: number, requiredUsd: number) {
  if (usdValue < requiredUsd * (1 - SETTLE_TOLERANCE)) {
    throw new ErrorHandler(
      `Insufficient settlement. $${requiredUsd.toFixed(2)} is owed, but the transaction only transfers $${usdValue.toFixed(2)}.`,
      400,
    );
  }
}

/** Postgres unique-violation, i.e. this payment already cleared a debt. */
function isReplay(error: any): boolean {
  return error?.code === "P2002";
}

function replayError(): ErrorHandler {
  return new ErrorHandler(
    "This payment has already been used to settle a balance.",
    409,
  );
}

interface MemberBalance {
  userId: string;
  handle: string;
  displayName: string | null;
  profilePicUrl: string | null;
  smartAccountAddress: string | null;
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
                  where: { settled: false },
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
        smartAccountAddress: m.user.smartAccountAddress ?? null,
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
  ) {
    const split = await prisma.groupExpenseSplit.findUnique({
      where: { expenseId_userId: { expenseId, userId: requestingUserId } },
      select: {
        settled: true,
        amount: true,
        expense: { select: { groupId: true, paidById: true } },
      },
    });

    if (!split) {
      throw new ErrorHandler("You do not have a split in this expense", 404);
    }

    if (split.settled) {
      throw new ErrorHandler("Your share is already settled", 409);
    }

    const { groupId, paidById } = split.expense;

    if (paidById === requestingUserId) {
      throw new ErrorHandler("You cannot settle a share you paid for", 400);
    }

    await this.assertMember(groupId, requestingUserId);

    const requiredUsd = Number(split.amount);
    const parties = await loadSettlementParties(requestingUserId, paidById);

    const { usdValue } = await valueSettlementTx({
      txHash,
      assetSymbol,
      parties,
    });

    assertCoversDebt(usdValue, requiredUsd);

    try {
      return await prisma.$transaction(async (tx) => {
        const settlement = await tx.groupSettlement.create({
          data: {
            groupId,
            payerId: requestingUserId,
            payeeId: paidById,
            method: "onchain",
            txHash: txHash.toLowerCase(),
            assetSymbol: assetSymbol.toUpperCase(),
            amountUsd: usdValue,
          },
        });

        // Guarded by `settled: false` so a concurrent request cannot settle
        // the same split twice.
        const updated = await tx.groupExpenseSplit.updateMany({
          where: { expenseId, userId: requestingUserId, settled: false },
          data: {
            settled: true,
            settledAt: new Date(),
            settlementId: settlement.id,
          },
        });

        if (updated.count === 0) {
          throw new ErrorHandler("Your share is already settled", 409);
        }

        return settlement;
      });
    } catch (error) {
      if (isReplay(error)) throw replayError();
      throw error;
    }
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
  ) {
    await this.assertMember(groupId, requestingUserId);
    await this.assertMember(groupId, targetUserId);

    if (requestingUserId === targetUserId) {
      throw new ErrorHandler("Cannot settle with yourself", 400);
    }

    const totalOwedUsd = await this.getSettleAllAmount(
      groupId,
      requestingUserId,
      targetUserId,
    );

    if (totalOwedUsd === 0) {
      throw new ErrorHandler(
        "You have no unsettled balance with this member",
        409,
      );
    }

    const parties = await loadSettlementParties(requestingUserId, targetUserId);

    const { usdValue } = await valueSettlementTx({
      txHash,
      assetSymbol,
      parties,
    });

    assertCoversDebt(usdValue, totalOwedUsd);

    try {
      await prisma.$transaction(async (tx) => {
        const settlement = await tx.groupSettlement.create({
          data: {
            groupId,
            payerId: requestingUserId,
            payeeId: targetUserId,
            method: "onchain",
            txHash: txHash.toLowerCase(),
            assetSymbol: assetSymbol.toUpperCase(),
            amountUsd: usdValue,
          },
        });

        await tx.groupExpenseSplit.updateMany({
          where: {
            userId: requestingUserId,
            settled: false,
            expense: { groupId, paidById: targetUserId },
          },
          data: {
            settled: true,
            settledAt: new Date(),
            settlementId: settlement.id,
          },
        });
      });
    } catch (error) {
      if (isReplay(error)) throw replayError();
      throw error;
    }
  }

  public async markAsSettledManually(
    groupId: string,
    requestingUserId: string,
    targetUserId: string,
  ) {
    await this.assertMember(groupId, requestingUserId);
    await this.assertMember(groupId, targetUserId);

    if (requestingUserId === targetUserId) {
      throw new ErrorHandler("Cannot settle with yourself", 400);
    }

    const totalOwedUsd = await this.getSettleAllAmount(
      groupId,
      requestingUserId,
      targetUserId,
    );

    if (totalOwedUsd === 0) {
      throw new ErrorHandler(
        "You have no unsettled balance with this member",
        409,
      );
    }

    await prisma.$transaction(async (tx) => {
      const settlement = await tx.groupSettlement.create({
        data: {
          groupId,
          payerId: requestingUserId,
          payeeId: targetUserId,
          method: "manual",
          amountUsd: totalOwedUsd,
        },
      });

      await tx.groupExpenseSplit.updateMany({
        where: {
          userId: requestingUserId,
          settled: false,
          expense: { groupId, paidById: targetUserId },
        },
        data: {
          settled: true,
          settledAt: new Date(),
          settlementId: settlement.id,
        },
      });
    });
  }

  public async settleAllWithMemberByInternalTx(
    groupId: string,
    requestingUserId: string,
    targetUserId: string,
    transactionId: string,
  ) {
    await this.assertMember(groupId, requestingUserId);
    await this.assertMember(groupId, targetUserId);

    if (requestingUserId === targetUserId) {
      throw new ErrorHandler("Cannot settle with yourself", 400);
    }

    const totalOwedUsd = await this.getSettleAllAmount(
      groupId,
      requestingUserId,
      targetUserId,
    );

    if (totalOwedUsd === 0) {
      throw new ErrorHandler(
        "You have no unsettled balance with this member",
        409,
      );
    }

    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        senderId: true,
        receiverId: true,
        receiverAddress: true,
        amount: true,
        assetSymbol: true,
        status: true,
      },
    });

    if (!tx) throw new ErrorHandler("Transaction not found", 404);

    if (tx.senderId !== requestingUserId) {
      throw new ErrorHandler("Transaction does not belong to you", 403);
    }

    if (tx.status !== "COMPLETED") {
      throw new ErrorHandler("Transaction has not been confirmed yet", 400);
    }

    // The payment must actually have gone to the member being settled with.
    const { payeeAddress } = await loadSettlementParties(
      requestingUserId,
      targetUserId,
    );

    const paidTheRightPerson =
      tx.receiverId === targetUserId ||
      tx.receiverAddress.toLowerCase() === payeeAddress.toLowerCase();

    if (!paidTheRightPerson) {
      throw new ErrorHandler(
        "That transaction was not sent to this member.",
        400,
      );
    }

    // `amount` was verified against the chain when the transaction was synced,
    // so it can be valued here without re-reading the chain. The price is still
    // resolved server-side.
    const priceUsd = await getUsdPrice(tx.assetSymbol);
    const usdValue = Number(tx.amount) * priceUsd;

    assertCoversDebt(usdValue, totalOwedUsd);

    try {
      await prisma.$transaction(async (dbTx) => {
        const settlement = await dbTx.groupSettlement.create({
          data: {
            groupId,
            payerId: requestingUserId,
            payeeId: targetUserId,
            method: "internal_tx",
            transactionId,
            assetSymbol: tx.assetSymbol,
            amountUsd: usdValue,
          },
        });

        await dbTx.groupExpenseSplit.updateMany({
          where: {
            userId: requestingUserId,
            settled: false,
            expense: { groupId, paidById: targetUserId },
          },
          data: {
            settled: true,
            settledAt: new Date(),
            settlementId: settlement.id,
          },
        });
      });
    } catch (error) {
      if (isReplay(error)) throw replayError();
      throw error;
    }
  }
}

export const groupService = new GroupService();
