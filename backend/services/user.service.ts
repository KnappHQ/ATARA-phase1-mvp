import { safetyService } from "./safety.service";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import prisma from "../config/prisma";
import { ErrorHandler } from "../utils/errorHandler";
import { USER_SEARCH_SELECT, buildSearchFilter } from "../utils/userSearch";

class UserService {
  public async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
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
    await prisma.$transaction(
      async (tx) => {
        // The text goes too: people write their name, email or a payment
        // detail into feedback, and unlinking the row does not unwrite that.
        await tx.feedback.updateMany({
          where: { userId },
          data: { userId: null, handle: null, message: "" },
        });
        // Reports this person made are kept for review, but unlinked from them,
        // with the text they wrote erased. Their blocks go with the account.
        await tx.userReport.updateMany({
          where: { reporterId: userId },
          data: { reporterId: null, details: "" },
        });
        await tx.userBlock.deleteMany({
          where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
        });

        // Retain shared ledger rows and replay protection. Deleting an account
        // must never erase another member's expenses, payments or acknowledged debt.
        const account = await tx.user.findUniqueOrThrow({
          where: { id: userId },
        });
        if (account.publicAddress) {
          await tx.authChallenge.deleteMany({
            where: { address: account.publicAddress },
          });
        }
        await tx.paymentRequest.deleteMany({
          where: { creatorId: userId, paidAt: null },
        });
        // A paid request stays, so its payment cannot be replayed against a
        // new one, but what the person wrote on it does not need to.
        await tx.paymentRequest.updateMany({
          where: { creatorId: userId, paidAt: { not: null } },
          data: { note: "" },
        });
        await tx.settlementIntent.deleteMany({
          where: {
            settledAt: null,
            OR: [{ senderId: userId }, { receiverId: userId }],
          },
        });
        await tx.recoveryCode.deleteMany({ where: { userId } });
        // Loyalty points and a place on a waiting list are worth nothing once
        // the person is gone, and a card event keeps only that it happened.
        await tx.milesEntry.deleteMany({ where: { userId } });
        await tx.cardWaitlist.deleteMany({ where: { userId } });
        await tx.cardEvent.updateMany({ where: { userId }, data: { userId: null } });
        await tx.user.update({
          where: { id: userId },
          data: {
            deletedAt: new Date(),
            handle: `deleted_${crypto.randomBytes(6).toString("hex")}`,
            displayName: "Deleted account",
            email: null,
            profilePicUrl: null,
            authProvider: null,
            publicAddress: null,
            smartAccountAddress: null,
            totpSecretEncrypted: null,
            totpPendingSecret: null,
            totpPendingCreatedAt: null,
            totpEnabled: false,
            recoveryPhone: null,
            recoveryPhoneVerifiedAt: null,
            subscriptionTier: "FREE",
            subscriptionStatus: "INACTIVE",
            subscriptionProvider: null,
            subscriptionProductId: null,
            subscriptionExpiresAt: null,
            tokenVersion: { increment: 1 },
          },
        });
        // Let a remaining member administer the group after its creator leaves.
        const groups = await tx.group.findMany({
          where: { createdById: userId },
          select: { id: true },
        });
        for (const group of groups) {
          const successor = await tx.groupMember.findFirst({
            where: {
              groupId: group.id,
              status: "ACTIVE",
              userId: { not: userId },
              user: { deletedAt: null },
            },
            orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
          });
          if (successor)
            await tx.group.update({
              where: { id: group.id },
              data: { createdById: successor.userId },
            });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  public async searchUsers(query: string, requesterId?: string) {
    const where = buildSearchFilter(query);

    // Too short to be a lookup. Returning nothing beats returning a slice of
    // the directory.
    if (!where) {
      return [];
    }

    // Someone who blocked you, or whom you blocked, is not in your search.
    const blocked = requesterId ? [...(await safetyService.blockedBothWays(requesterId))] : [];

    return prisma.user.findMany({
      where: {
        AND: [where, { deletedAt: null }, ...(blocked.length ? [{ id: { notIn: blocked } }] : [])],
      },
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
            deletedAt: true,
            handle: true,
            displayName: true,
            profilePicUrl: true,
            smartAccountAddress: true,
          },
        },
        receiver: {
          select: {
            id: true,
            deletedAt: true,
            handle: true,
            displayName: true,
            profilePicUrl: true,
            smartAccountAddress: true,
          },
        },
      },
      take: limit * 4,
    });

    const blocked = await safetyService.blockedBothWays(userId);
    const seen = new Set<string>();
    const contacts = [];

    for (const tx of recentTx) {
      const counterparty = tx.senderId === userId ? tx.receiver : tx.sender;
      if (
        !counterparty ||
        counterparty.deletedAt ||
        !counterparty.smartAccountAddress ||
        blocked.has(counterparty.id) ||
        seen.has(counterparty.id)
      )
        continue;
      seen.add(counterparty.id);
      contacts.push(counterparty);
      if (contacts.length === limit) break;
    }

    return contacts;
  }

  public async getUserByHandle(
    handle: string,
    includePrivate: boolean = false,
    requesterId?: string,
  ) {
    const selectFields = {
      id: true,
      handle: true,
      displayName: true,
      profilePicUrl: true,
      // The owner (signer) address is not returned about anyone: it is the key
      // that controls the account, and nothing in the app needs it. Linking it
      // to a @handle only helps someone map the owner across the chain.
      smartAccountAddress: true,
      ...(includePrivate && { email: true }),
    };

    const user = await prisma.user.findUnique({
      where: { handle: handle.toLowerCase(), deletedAt: null },
      select: selectFields,
    });

    // A block reads exactly like an account that does not exist.
    if (!user || (requesterId && user.id !== requesterId && (await safetyService.isBlockedEitherWay(requesterId, user.id)))) {
      throw new ErrorHandler("User not found", 404);
    }

    return user;
  }
}

export const userService = new UserService();
