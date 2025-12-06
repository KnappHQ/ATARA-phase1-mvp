import prisma from "../config/prisma";
import { ErrorHandler } from "../utils/errorHandler";

class TransactionService {
  public async transferFunds(
    senderId: string,
    receiverHandle: string,
    amount: number,
    assetSymbol: string,
    category?: string,
    userNote?: string
  ) {
    if (amount <= 0) {
      throw new ErrorHandler("Transfer amount must be greater than zero", 400);
    }

    const receiver = await prisma.user.findUnique({
      where: { handle: receiverHandle },
    });

    if (!receiver) {
      throw new ErrorHandler(
        `User with handle @${receiverHandle} not found`,
        404
      );
    }

    if (receiver.id === senderId) {
      throw new ErrorHandler("Cannot send money to yourself", 400);
    }

    const transaction = await prisma.$transaction(async (tx) => {
      // Check Sender Balance
      const senderWallet = await tx.wallet.findUnique({
        where: {
          userId_assetSymbol: {
            userId: senderId,
            assetSymbol: assetSymbol,
          },
        },
      });

      if (!senderWallet || senderWallet.balance.toNumber() < amount) {
        throw new ErrorHandler(`Insufficient ${assetSymbol} balance`, 400);
      }

      // Deduct from Sender
      await tx.wallet.update({
        where: {
          userId_assetSymbol: {
            userId: senderId,
            assetSymbol: assetSymbol,
          },
        },
        data: {
          balance: {
            decrement: amount,
          },
        },
      });

      // Add to Receiver (Upsert handles if they don't have this asset wallet yet)
      await tx.wallet.upsert({
        where: {
          userId_assetSymbol: {
            userId: receiver.id,
            assetSymbol: assetSymbol,
          },
        },
        update: {
          balance: {
            increment: amount,
          },
        },
        create: {
          userId: receiver.id,
          assetSymbol: assetSymbol,
          balance: amount,
        },
      });

      // Create Ledger Record
      const newTx = await tx.transaction.create({
        data: {
          senderId,
          receiverId: receiver.id,
          assetSymbol,
          amount,
          category,
          userNote,
          status: "COMPLETED",
        },
      });

      return newTx;
    });

    return transaction;
  }

  public async updateTransaction(
    userId: string,
    transactionId: string,
    category?: string,
    userNote?: string
  ) {
    // Check if transaction exists and belongs to user (either sender or receiver can edit for now)
    const existingTx = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!existingTx) {
      throw new ErrorHandler("Transaction not found", 404);
    }

    // Allow user to edit if they are the sender OR the receiver
    if (existingTx.senderId !== userId && existingTx.receiverId !== userId) {
      throw new ErrorHandler("Not authorized to edit this transaction", 403);
    }

    const updatedTx = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        category,
        userNote,
      },
    });

    return updatedTx;
  }
}

export const transactionService = new TransactionService();
