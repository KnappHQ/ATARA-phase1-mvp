import { ethers } from "ethers";
import prisma from "../config/prisma";
import type { TxStatus } from "@prisma/client";
import { ErrorHandler } from "../utils/errorHandler";
import {
  ALCHEMY_URL,
  TRANSACTION_CATEGORIES,
  DEFAULT_CATEGORY,
} from "../utils/constants";
import axios from "axios";

interface AlchemyTransfer {
  blockNum: string;
  uniqueId: string;
  hash: string;
  from: string;
  to: string;
  value: number;
  erc721TokenId: string | null;
  erc1155Metadata: any | null;
  tokenId: string | null;
  asset: string;
  category: string;
  rawContract: {
    value: string | null;
    address: string | null;
    decimal: string | null;
  };
  metadata: {
    blockTimestamp: string;
  };
}

class TransactionService {
  public async resolveHandle(handle: string) {
    const user = await prisma.user.findUnique({
      where: { handle },
      select: {
        id: true,
        handle: true,
        publicAddress: true,
        smartAccountAddress: true,
        displayName: true,
        profilePicUrl: true,
      },
    });

    if (!user) {
      throw new ErrorHandler(`User @${handle} not found`, 404);
    }

    return user;
  }

  public async syncTransaction(data: {
    senderProfile: any;
    receiverAddress: string;
    txHash: string;
    amount: number | string;
    rawAmountWei: string;
    assetSymbol: string;
    category?: string;
    userNote?: string;
  }) {
    const normalizedTxHash = data.txHash.toLowerCase();
    const normalizedReceiverAddress = data.receiverAddress.toLowerCase();

    const existingTx = await prisma.transaction.findUnique({
      where: { txHash: normalizedTxHash },
    });

    if (existingTx) {
      throw new ErrorHandler("Transaction already synced", 409);
    }

    const alchemyProvider = new ethers.providers.JsonRpcProvider(ALCHEMY_URL);
    const receipt =
      await alchemyProvider.getTransactionReceipt(normalizedTxHash);

    if (!receipt) {
      throw new ErrorHandler(
        "Transaction receipt not found on the network. It may still be pending.",
        404,
      );
    }

    if (receipt.status !== 1) {
      throw new ErrorHandler("Transaction failed on-chain", 400);
    }

    // For ERC-4337 smart account txs via Alchemy Bundler, tx.from is the bundler
    // and tx.to is the EntryPoint — not the actual sender/receiver. receipt.status === 1
    // is sufficient to confirm the UserOperation executed successfully.

    // Validate that rawAmountWei and amount are consistent
    const calculatedDecimal = ethers.utils.formatEther(data.rawAmountWei);
    if (
      data.assetSymbol === "ETH" &&
      Math.abs(
        parseFloat(calculatedDecimal) - parseFloat(data.amount.toString()),
      ) > 0.0001
    ) {
      throw new ErrorHandler(
        `Decimal amount mismatch. Wei: ${data.rawAmountWei} equals ${calculatedDecimal} ETH, but received ${data.amount}`,
        400,
      );
    }

    const receiver = await prisma.user.findFirst({
      where: { smartAccountAddress: normalizedReceiverAddress },
    });

    const transaction = await prisma.transaction.create({
      data: {
        senderId: data.senderProfile.id,
        receiverId: receiver ? receiver.id : null,
        receiverAddress: normalizedReceiverAddress,
        txHash: normalizedTxHash,
        assetSymbol: data.assetSymbol,
        amount: data.amount,
        rawAmountWei: data.rawAmountWei,
        category:
          data.category &&
          (TRANSACTION_CATEGORIES as readonly string[]).includes(data.category)
            ? data.category
            : DEFAULT_CATEGORY,
        userNote: data.userNote,
        status: "COMPLETED",
      },
      include: {
        sender: { select: { handle: true } },
        receiver: { select: { handle: true } },
      },
    });

    return transaction;
  }

  private async fetchAlchemyHistory(
    address: string,
  ): Promise<AlchemyTransfer[]> {
    const commonParams = {
      fromBlock: "0x0",
      category: ["external"],
      withMetadata: true,
      excludeZeroValue: true,
      maxCount: "0x64",
    };

    const makeRequest = (params: any) => ({
      jsonrpc: "2.0",
      id: 1,
      method: "alchemy_getAssetTransfers",
      params: [params],
    });

    try {
      const [sentRes, receivedRes] = await Promise.all([
        axios.post(
          ALCHEMY_URL,
          makeRequest({ ...commonParams, fromAddress: address }),
        ),
        axios.post(
          ALCHEMY_URL,
          makeRequest({ ...commonParams, toAddress: address }),
        ),
      ]);

      const sent = sentRes.data.result?.transfers || [];
      const received = receivedRes.data.result?.transfers || [];

      if (sentRes.data.error) {
        console.error("[Alchemy] Sent request error:", sentRes.data.error);
      }
      if (receivedRes.data.error) {
        console.error(
          "[Alchemy] Received request error:",
          receivedRes.data.error,
        );
      }

      const seen = new Set<string>();
      const all: AlchemyTransfer[] = [];
      for (const tx of [...sent, ...received]) {
        if (!seen.has(tx.uniqueId)) {
          seen.add(tx.uniqueId);
          all.push(tx);
        }
      }

      return all;
    } catch (error) {
      console.error("[Alchemy] Fetch Error:", error);
      return [];
    }
  }

  public async getHistory(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { smartAccountAddress: true },
    });

    if (!user) {
      throw new ErrorHandler("User not found", 404);
    }

    const walletAddress = user.smartAccountAddress;

    if (!walletAddress) {
      throw new ErrorHandler("User has no smart account address", 400);
    }

    const walletAddressLower = walletAddress.toLowerCase();

    const [dbTransactions, alchemyTransactions] = await Promise.all([
      prisma.transaction.findMany({
        where: { OR: [{ senderId: userId }, { receiverId: userId }] },
        orderBy: { createdAt: "desc" },
        include: {
          sender: {
            select: {
              handle: true,
              displayName: true,
              profilePicUrl: true,
              smartAccountAddress: true,
            },
          },
          receiver: {
            select: {
              handle: true,
              displayName: true,
              profilePicUrl: true,
              smartAccountAddress: true,
            },
          },
        },
      }),

      this.fetchAlchemyHistory(walletAddress),
    ]);

    const dbTxHashes = new Set(
      dbTransactions.map((tx) => tx.txHash.toLowerCase()),
    );

    const inAppTransactions = dbTransactions.map((tx) => ({
      id: tx.id,
      txHash: tx.txHash,
      timestamp: tx.createdAt.toISOString(),
      status: tx.status,
      amount: tx.amount.toString(),
      assetSymbol: tx.assetSymbol,
      category: tx.category,
      userNote: tx.userNote,
      type: tx.senderId === userId ? "send" : "receive",
      isInApp: true,
      counterparty: {
        address:
          tx.senderId === userId
            ? tx.receiverAddress
            : tx.sender.smartAccountAddress,
        handle:
          tx.senderId === userId
            ? tx.receiver?.handle || null
            : tx.sender.handle,
        displayName:
          tx.senderId === userId
            ? tx.receiver?.displayName || null
            : tx.sender.displayName || null,
        profilePicUrl:
          tx.senderId === userId
            ? tx.receiver?.profilePicUrl || null
            : tx.sender.profilePicUrl || null,
      },
    }));

    const externalTransactions = alchemyTransactions
      .filter((tx) => !dbTxHashes.has(tx.hash.toLowerCase()))
      .map((tx) => {
        const isSend = tx.from.toLowerCase() === walletAddressLower;

        return {
          id: `ext_${tx.uniqueId}`,
          txHash: tx.hash,
          timestamp: tx.metadata.blockTimestamp,
          status: "COMPLETED",
          amount: tx.value.toString(),
          assetSymbol: tx.asset || "ETH",
          category: tx.category,
          userNote: null,
          type: isSend ? "send" : "receive",
          isInApp: false,
          counterparty: {
            address: isSend ? tx.to : tx.from,
            handle: null,
            displayName: null,
            profilePicUrl: null,
          },
        };
      });

    const unifiedHistory = [...inAppTransactions, ...externalTransactions].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return unifiedHistory;
  }

  public async getTransactionById(transactionId: string, userId: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        sender: { select: { handle: true } },
        receiver: { select: { handle: true } },
      },
    });

    if (!transaction) {
      throw new ErrorHandler("Transaction not found", 404);
    }

    if (transaction.senderId !== userId && transaction.receiverId !== userId) {
      throw new ErrorHandler("Not authorized to view this transaction", 403);
    }

    return transaction;
  }

  public async updateTransaction(
    userId: string,
    transactionId: string,
    status?: TxStatus,
    category?: string,
    userNote?: string,
  ) {
    const existingTx = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!existingTx) {
      throw new ErrorHandler("Transaction not found", 404);
    }

    if (existingTx.senderId !== userId && existingTx.receiverId !== userId) {
      throw new ErrorHandler("Not authorized to edit this transaction", 403);
    }

    const updatedTx = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status,
        category,
        userNote,
      },
    });

    return updatedTx;
  }
}

export const transactionService = new TransactionService();
