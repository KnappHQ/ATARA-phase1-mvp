import prisma from "../config/prisma";
import { ErrorHandler } from "../utils/errorHandler";

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
      },
    });

    return updatedUser;
  }

  public async deleteAccount(userId: string) {
    await prisma.$transaction(async (tx) => {
      // Keep anonymous feedback content, but remove its link to the user.
      await tx.feedback.updateMany({
        where: { userId },
        data: { userId: null, handle: null },
      });

      // Preserve incoming transfers for the sender while removing the deleted
      // account as their identified recipient. Sent transfers are deleted.
      await tx.transaction.updateMany({
        where: { receiverId: userId },
        data: { receiverId: null },
      });
      await tx.transaction.deleteMany({ where: { senderId: userId } });

      // Remove group data owned by or directly tied to the account. Cascades
      // on groups/expenses take care of their dependent rows.
      await tx.groupExpenseSplit.deleteMany({ where: { userId } });
      await tx.groupExpense.deleteMany({ where: { paidById: userId } });
      await tx.group.deleteMany({ where: { createdById: userId } });
      await tx.groupMember.deleteMany({ where: { userId } });

      await tx.user.delete({ where: { id: userId } });
    });
  }

  public async searchUsers(query: string) {
    const cleanQuery = query.replace("@", "").toLowerCase();

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { handle: { contains: cleanQuery, mode: "insensitive" } },
          { displayName: { contains: cleanQuery, mode: "insensitive" } },
          {
            smartAccountAddress: { contains: cleanQuery, mode: "insensitive" },
          },
        ],
      },
      take: 5,
      select: {
        id: true,
        handle: true,
        displayName: true,
        profilePicUrl: true,
        publicAddress: true,
        smartAccountAddress: true,
      },
    });

    return users;
  }

  // The recipient picker uses this list for the @ suggestions. Keep enough
  // counterparties to cover the account's contact history, then sort locally
  // in the client for an alphabetical, instant picker.
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
