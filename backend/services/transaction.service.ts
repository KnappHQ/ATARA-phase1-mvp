import { ethers } from "ethers";
import prisma from "../config/prisma";
import { TxStatus } from "../generated/prisma";
import { ErrorHandler } from "../utils/errorHandler";
import { ALCHEMY_URL, RPC_URL } from "../utils/constants";
import axios from "axios";

const provider = new ethers.JsonRpcProvider(RPC_URL);

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
  metadata: {
    blockTimestamp: string; // We need this for sorting
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
    const normalizedSenderAddress =
      data.senderProfile.publicAddress.toLowerCase();
    const normalizedReceiverAddress = data.receiverAddress.toLowerCase();

    const existingTx = await prisma.transaction.findUnique({
      where: { txHash: normalizedTxHash },
    });

    if (existingTx) {
      throw new ErrorHandler("Transaction already synced", 409);
    }

    const tx = await provider.getTransaction(normalizedTxHash);

    if (!tx) {
      throw new ErrorHandler("Transaction hash not found on the network", 404);
    }

    if (!tx.from || tx.from.toLowerCase() !== normalizedSenderAddress) {
      throw new ErrorHandler(
        "Transaction signer does not match the logged-in user",
        403
      );
    }

    if (!tx.to || tx.to.toLowerCase() !== normalizedReceiverAddress) {
      throw new ErrorHandler(
        "Transaction receiver on-chain does not match the request",
        400
      );
    }

    if (tx.value.toString() !== data.rawAmountWei) {
      throw new ErrorHandler(
        "Transaction amount on-chain does not match the declared amount",
        400
      );
    }

    const calculatedDecimal = ethers.formatEther(data.rawAmountWei);

    if (parseFloat(calculatedDecimal) !== parseFloat(data.amount.toString())) {
      throw new ErrorHandler(
        `Decimal amount mismatch. Wei: ${data.rawAmountWei} equals ${calculatedDecimal} ETH, but received ${data.amount}`,
        400
      );
    }

    const receiver = await prisma.user.findUnique({
      where: { publicAddress: normalizedReceiverAddress },
    });

    // if (!receiver) {
    //   // If the receiver isn't in our app, we can't link them in the relational DB easily.
    //   // For Phase 1, we assume all transfers are between app users.
    //   // If we want to support sending to external wallets, we'd need to make receiverId nullable in schema.
    //   throw new ErrorHandler("Receiver is not a registered user", 404);
    // }

    const transaction = await prisma.transaction.create({
      data: {
        senderId: data.senderProfile.id,
        receiverId: receiver ? receiver.id : null,
        receiverAddress: normalizedReceiverAddress,
        txHash: normalizedTxHash,
        assetSymbol: data.assetSymbol,
        amount: data.amount,
        rawAmountWei: data.rawAmountWei,
        category: data.category,
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
    address: string
  ): Promise<AlchemyTransfer[]> {
    const commonParams = {
      fromBlock: "0x0",
      category: ["external", "erc20"],
      withMetadata: true,
      excludeZeroValue: true,
      maxCount: "0x3e8",
    };

    const makeRequest = (params: any) => ({
      jsonrpc: "2.0",
      id: 1,
      method: "alchemy_getAssetTransfers",
      params: [params],
    });

    try {
      // Parallel Requests: 1. Sent by User, 2. Received by User
      const [sentRes, receivedRes] = await Promise.all([
        axios.post(
          ALCHEMY_URL,
          makeRequest({ ...commonParams, fromAddress: address })
        ),
        axios.post(
          ALCHEMY_URL,
          makeRequest({ ...commonParams, toAddress: address })
        ),
      ]);

      const sent = sentRes.data.result?.transfers || [];
      const received = receivedRes.data.result?.transfers || [];

      return [...sent, ...received];
    } catch (error) {
      console.error("Alchemy Fetch Error:", error);
      return [];
    }
  }

  public async getHistory(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { publicAddress: true },
    });

    if (!user || !user.publicAddress) {
      throw new ErrorHandler("User wallet not found", 404);
    }

    const userAddressLower = user.publicAddress.toLowerCase();

    // Parallel Fetch: Internal DB & External Blockchain
    const [dbTransactions, alchemyTransactions] = await Promise.all([
      prisma.transaction.findMany({
        where: { OR: [{ senderId: userId }, { receiverId: userId }] },
        orderBy: { createdAt: "desc" },
        include: {
          sender: {
            select: { handle: true, profilePicUrl: true, publicAddress: true },
          },
          receiver: {
            select: { handle: true, profilePicUrl: true, publicAddress: true },
          },
        },
      }),

      this.fetchAlchemyHistory(user.publicAddress),
    ]);

    const dbTxHashes = new Set(
      dbTransactions.map((tx) => tx.txHash.toLowerCase())
    );

    // Normalize Alchemy Data to match Prisma Shape
    const externalTransactions = alchemyTransactions
      .filter((tx) => !dbTxHashes.has(tx.hash.toLowerCase()))
      .map((tx) => {
        const isSend = tx.from.toLowerCase() === userAddressLower;

        return {
          id: `ext_${tx.hash}`,
          txHash: tx.hash,
          createdAt: new Date(tx.metadata.blockTimestamp),
          status: "COMPLETED",
          amount: tx.value.toString(),
          assetSymbol: tx.asset,
          category: null,
          userNote: null,

          senderId: isSend ? userId : "external",
          receiverId: isSend ? "external" : userId,

          sender: {
            publicAddress: tx.from,
            handle: null,
            profilePicUrl: null,
          },
          receiver: {
            publicAddress: tx.to,
            handle: null,
            profilePicUrl: null,
          },
        };
      });

    const unifiedHistory = [...dbTransactions, ...externalTransactions].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
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
    userNote?: string
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
