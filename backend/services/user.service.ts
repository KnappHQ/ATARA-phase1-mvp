import prisma from "../config/prisma";
import { ErrorHandler } from "../utils/errorHandler";
import { USER_SEARCH_SELECT, buildSearchFilter } from "../utils/userSearch";

class UserService {
  public async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        handle: true,
        email: true,
        profilePicUrl: true,
        displayName: true,
        smartAccountAddress: true,
        authProvider: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        subscriptionProvider: true,
        subscriptionProductId: true,
        subscriptionExpiresAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new ErrorHandler("User not found", 404);
    }

    return user;
  }

  public async updateProfile(
    userId: string,
    data: {
      handle?: string;
      email?: string;
      profilePicUrl?: string;
      displayName?: string;
    },
  ) {
    if (data.handle) {
      const handleExists = await prisma.user.findFirst({
        where: {
          handle: data.handle,
          NOT: { id: userId },
        },
      });

      if (handleExists) {
        throw new ErrorHandler("Handle already taken", 409);
      }
    }

    if (data.email) {
      const emailExists = await prisma.user.findFirst({
        where: {
          email: data.email,
          NOT: { id: userId },
        },
      });

      if (emailExists) {
        throw new ErrorHandler("Email already exists", 409);
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        handle: data.handle,
        email: data.email,
        profilePicUrl: data.profilePicUrl,
        displayName: data.displayName,
      },
      select: {
        id: true,
        handle: true,
        email: true,
        profilePicUrl: true,
        displayName: true,
        smartAccountAddress: true,
        authProvider: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        subscriptionProvider: true,
        subscriptionProductId: true,
        subscriptionExpiresAt: true,
      },
    });

    return updatedUser;
  }

  public async deleteAccount(userId: string) {
    await prisma.$transaction(async (tx) => {
      await tx.feedback.updateMany({
        where: { userId },
        data: { userId: null, handle: null },
      });

      // Remove share/payment-link records that directly identify this account.
      // Keep PaymentUse rows: their opaque reference IDs are part of the
      // anti-replay ledger and prevent a previously used chain receipt from
      // being accepted again after account deletion.
      const createdGroupIds = (
        await tx.group.findMany({
          where: { createdById: userId },
          select: { id: true },
        })
      ).map((group) => group.id);

      await tx.paymentRequest.deleteMany({ where: { creatorId: userId } });
      await tx.settlementIntent.deleteMany({
        where: {
          OR: [
            { senderId: userId },
            { receiverId: userId },
            ...(createdGroupIds.length
              ? [{ groupId: { in: createdGroupIds } }]
              : []),
          ],
        },
      });

      await tx.transaction.updateMany({
        where: { receiverId: userId },
        data: { receiverId: null },
      });
      await tx.transaction.deleteMany({ where: { senderId: userId } });

      await tx.groupExpenseSplit.deleteMany({ where: { userId } });
      await tx.groupExpense.deleteMany({ where: { paidById: userId } });
      await tx.group.deleteMany({ where: { createdById: userId } });
      await tx.groupMember.deleteMany({ where: { userId } });

      await tx.user.delete({ where: { id: userId } });
    });
  }

  public async searchUsers(query: string) {
    const where = buildSearchFilter(query);

    // Too short to be a lookup. Returning nothing beats returning a slice of
    // the directory.
    if (!where) {
      return [];
    }

    return prisma.user.findMany({
      where,
      take: 5,
      select: USER_SEARCH_SELECT,
    });
  }

  public async getRecentContacts(userId: string, limit: number = 100) {
    const recentTx = await prisma.transaction.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: { not: null } },
          { receiverId: userId },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        senderId: true,
        receiverId: true,
        sender: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            profilePicUrl: true,
            publicAddress: true,
            smartAccountAddress: true,
          },
        },
        receiver: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            profilePicUrl: true,
            publicAddress: true,
            smartAccountAddress: true,
          },
        },
      },
      take: limit * 4,
    });

    const seen = new Set<string>();
    const contacts = [];

    for (const tx of recentTx) {
      const counterparty = tx.senderId === userId ? tx.receiver : tx.sender;
      if (!counterparty || seen.has(counterparty.id)) continue;
      seen.add(counterparty.id);
      contacts.push(counterparty);
      if (contacts.length === limit) break;
    }

    return contacts;
  }

  public async getUserByHandle(
    handle: string,
    includePrivate: boolean = false,
  ) {
    const selectFields = {
      id: true,
      handle: true,
      displayName: true,
      profilePicUrl: true,
      publicAddress: true,
      smartAccountAddress: true,
      ...(includePrivate && { email: true }),
    };

    const user = await prisma.user.findUnique({
      where: { handle: handle.toLowerCase() },
      select: selectFields,
    });

    if (!user) {
      throw new ErrorHandler("User not found", 404);
    }

    return user;
  }
}

export const userService = new UserService();
