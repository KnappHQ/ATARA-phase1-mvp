import { ethers } from "ethers";
import axios from "axios";
import prisma from "../config/prisma";
import { ErrorHandler } from "../utils/errorHandler";
import {
  ALCHEMY_URL,
  TRANSACTION_CATEGORIES,
  DEFAULT_CATEGORY,
  NETWORK,
} from "../utils/constants";
import {
  getTokenConfig,
  isSupportedTokenSymbol,
  type AppNetwork,
} from "../utils/tokenConfig";
import { verifyTransfer } from "../utils/chainVerifier";

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

  /**
   * Record an on-chain payment made by the authenticated user.
   *
   * The stored amount is whatever the chain says was transferred - the client's
   * figures are not compared, they are simply not used. A transfer that cannot
   * be verified is refused; it is never recorded on trust.
   */
  public async syncTransaction(data: {
    senderProfile: any;
    receiverAddress: string;
    txHash: string;
    assetSymbol: string;
    category?: string;
    userNote?: string;
  }) {
    const normalizedTxHash = data.txHash.toLowerCase();

    if (!/^0x[a-fA-F0-9]{40}$/.test(data.receiverAddress.trim())) {
      throw new ErrorHandler("Invalid receiver address", 400);
    }
    const normalizedReceiverAddress = data.receiverAddress.trim().toLowerCase();

    const existingTx = await prisma.transaction.findUnique({
      where: { txHash: normalizedTxHash },
    });

    if (existingTx) {
      throw new ErrorHandler("Transaction already synced", 409);
    }

    // ERC-4337: the sender of record is the smart account, not the EOA and
    // certainly not the bundler that appears as `receipt.from`.
    const expectedSender = data.senderProfile.smartAccountAddress;

    if (!expectedSender) {
      throw new ErrorHandler(
        "Your smart account address is not set up yet",
        400,
      );
    }

    if (normalizedReceiverAddress === expectedSender.toLowerCase()) {
      throw new ErrorHandler("Cannot record a transfer to yourself", 400);
    }

    const assetSymbol = data.assetSymbol.toUpperCase();

    let decimals: number;
    let token;

    if (assetSymbol === "ETH") {
      decimals = 18;
    } else {
      if (!isSupportedTokenSymbol(assetSymbol)) {
        throw new ErrorHandler(`Unsupported asset: ${assetSymbol}`, 400);
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

    // Reads the actual movement of value out of the receipt: the token contract
    // address, the sender and the recipient are all checked against what the
    // chain recorded, so a look-alike ERC-20 or a third party's hash is refused.
    const verified = await verifyTransfer({
      txHash: normalizedTxHash,
      expectedFrom: expectedSender,
      expectedTo: normalizedReceiverAddress,
      assetSymbol,
      token,
    });

    if (verified.rawAmount.isZero()) {
      throw new ErrorHandler("Transaction transfers no value", 400);
    }

    const rawAmountWei = verified.rawAmount.toString();
    const amount = ethers.utils.formatUnits(verified.rawAmount, decimals);

    const receiver = await prisma.user.findFirst({
      where: { smartAccountAddress: normalizedReceiverAddress },
    });

    const transaction = await prisma.transaction.create({
      data: {
        senderId: data.senderProfile.id,
        receiverId: receiver ? receiver.id : null,
        receiverAddress: normalizedReceiverAddress,
        txHash: normalizedTxHash,
        assetSymbol,
        amount,
        rawAmountWei,
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
      type: tx.senderId === userId ? ("send" as const) : ("receive" as const),
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
          type: isSend ? ("send" as const) : ("receive" as const),
          isInApp: false,
          counterparty: {
            address: isSend ? tx.to : tx.from,
            handle: null,
            displayName: null,
            profilePicUrl: null,
          },
        };
      });

    return [...inAppTransactions, ...externalTransactions].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
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

  /**
   * Update the user-owned annotations on a transaction.
   *
   * `status` is deliberately not updatable: it records a fact established
   * on-chain at sync time, and letting either party rewrite it made a
   * transaction look confirmed to the settlement logic on request.
   */
  public async updateTransaction(
    userId: string,
    transactionId: string,
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

    return prisma.transaction.update({
      where: { id: transactionId },
      data: {
        category,
        userNote,
      },
    });
  }

  private async fetchAlchemyHistory(
    address: string,
  ): Promise<AlchemyTransfer[]> {
    // `order: "desc"` matters: alchemy_getAssetTransfers defaults to ascending,
    // so without it this returned the 100 OLDEST transfers and an active
    // account's history silently froze on its first 100 transactions.
    const externalParams = {
      fromBlock: "0x0",
      category: ["external", "erc20"],
      order: "desc",
      withMetadata: true,
      excludeZeroValue: true,
      maxCount: "0x64",
    };

    const internalParams = {
      fromBlock: "0x0",
      category: ["internal"],
      order: "desc",
      withMetadata: true,
      excludeZeroValue: true,
      maxCount: "0x64",
    };

    const makeRequest = (params: Record<string, unknown>) => ({
      jsonrpc: "2.0",
      id: 1,
      method: "alchemy_getAssetTransfers",
      params: [params],
    });

    try {
      const [sentRes, receivedRes, sentInternalRes, receivedInternalRes] =
        await Promise.all([
          axios.post(
            ALCHEMY_URL,
            makeRequest({ ...externalParams, fromAddress: address }),
          ),
          axios.post(
            ALCHEMY_URL,
            makeRequest({ ...externalParams, toAddress: address }),
          ),
          axios
            .post(
              ALCHEMY_URL,
              makeRequest({ ...internalParams, fromAddress: address }),
            )
            .catch((error) => {
              console.warn(
                "[Alchemy] Internal sent request unavailable:",
                error?.response?.data?.error?.message ||
                  error?.message ||
                  error,
              );
              return { data: { result: { transfers: [] } } };
            }),
          axios
            .post(
              ALCHEMY_URL,
              makeRequest({ ...internalParams, toAddress: address }),
            )
            .catch((error) => {
              console.warn(
                "[Alchemy] Internal received request unavailable:",
                error?.response?.data?.error?.message ||
                  error?.message ||
                  error,
              );
              return { data: { result: { transfers: [] } } };
            }),
        ]);

      const sent = sentRes.data.result?.transfers || [];
      const received = receivedRes.data.result?.transfers || [];
      const sentInternal = sentInternalRes.data.result?.transfers || [];
      const receivedInternal = receivedInternalRes.data.result?.transfers || [];

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

      for (const tx of [
        ...sent,
        ...received,
        ...sentInternal,
        ...receivedInternal,
      ]) {
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

}

export const transactionService = new TransactionService();
