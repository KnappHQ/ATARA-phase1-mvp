import crypto from "crypto";
import { ethers } from "ethers";
import { Prisma } from "@prisma/client";
import prisma from "../config/prisma";
import { cents } from "../utils/expenseAmounts";
import { ErrorHandler } from "../utils/errorHandler";
import { getKnownTokens, type AppNetwork } from "../utils/tokenConfig";
import { NETWORK } from "../utils/constants";
import { paymentChainId, verifyTokenPayment, verifyReceiptSigner } from "./paymentProof.service";

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
export const validateRequestToken = (token: string) => {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new ErrorHandler("Payment request not found", 404);
  return token;
};
export const paymentRequestService = {
  async create(userId: string, amount: unknown, note: unknown) {
    const origin = process.env.PUBLIC_PAYMENT_ORIGIN;
    if (!origin || !/^https:\/\/[^/?#]+$/.test(origin)) throw new ErrorHandler("Payment links await configuration of the public HTTPS service", 503);
    if (paymentChainId !== 84532 && process.env.ENABLE_MAINNET_PAYMENT_REQUESTS !== "true")
      throw new ErrorHandler("Payment requests are currently available on Base Sepolia only", 503);
    if (typeof note !== "string" || note.length > 140) throw new ErrorHandler("Use a note of up to 140 characters", 400);
    const amountString = (cents(amount) / 100).toFixed(2);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.smartAccountAddress || !ethers.utils.isAddress(user.smartAccountAddress)) throw new ErrorHandler("Wallet unavailable", 409);
    const token = crypto.randomBytes(32).toString("hex");
    const request = await prisma.paymentRequest.create({ data: {
      tokenHash: hash(token), creatorId: userId, recipientAddress: user.smartAccountAddress.toLowerCase(),
      amount: amountString, note, chainId: paymentChainId, tokenAddress: getKnownTokens(NETWORK as AppNetwork).USDC.address,
      expiresAt: new Date(Date.now() + 24 * 3600_000),
    } });
    return { id: request.id, url: `${origin}/api/v1/requests/pay/${token}`, amount: amountString, assetSymbol: "USDC", expiresAt: request.expiresAt, chainId: request.chainId };
  },
  async resolve(token: string) {
    validateRequestToken(token);
    const request = await prisma.paymentRequest.findUnique({ where: { tokenHash: hash(token) } });
    if (!request) throw new ErrorHandler("Payment request not found", 404);
    return request;
  },
  async publicDetails(token: string) {
    const request = await this.resolve(token);
    return { amount: request.amount.toString(), assetSymbol: "USDC", recipientAddress: request.recipientAddress,
      note: request.note, chainId: request.chainId, tokenAddress: request.tokenAddress, expiresAt: request.expiresAt,
      status: request.paidAt ? "PAID" : request.cancelledAt ? "CANCELLED" : request.expiresAt < new Date() ? "EXPIRED" : "OPEN",
      txHash: request.txHash,
      confirmationMessage: `ATARA receipt confirmation\nRequest: ${request.id}\nChain: ${request.chainId}\nRecipient: ${request.recipientAddress}\nAmount: ${request.amount.toString()} USDC`,
      uri: `ethereum:${request.tokenAddress}@${request.chainId}/transfer?address=${request.recipientAddress}&uint256=${ethers.utils.parseUnits(request.amount.toString(), 6).toString()}`,
    };
  },
  async cancel(id: string, userId: string) {
    const result = await prisma.paymentRequest.updateMany({ where: { id, creatorId: userId, paidAt: null, cancelledAt: null }, data: { cancelledAt: new Date() } });
    if (result.count !== 1) throw new ErrorHandler("Request unavailable, already paid or cancelled", 409);
  },
  async confirm(token: string, txHash: string, payerAddress: string, signature: string) {
    const request = await this.resolve(token);
    if (request.chainId !== paymentChainId) throw new ErrorHandler("This request belongs to another network", 409);
    if (typeof txHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new ErrorHandler("Invalid transaction hash", 400);
    const details = await this.publicDetails(token);
    await verifyReceiptSigner(payerAddress, `${details.confirmationMessage}\nTransaction: ${txHash.toLowerCase()}`, signature);
    const proof = await verifyTokenPayment({ txHash, token: request.tokenAddress, recipient: request.recipientAddress, sender: payerAddress });
    if (!proof.rawAmount.eq(ethers.utils.parseUnits(request.amount.toString(), 6))) throw new ErrorHandler("Payment amount does not match this request", 400);
    if (proof.confirmedAt.getTime() < Math.floor(request.createdAt.getTime() / 1000) * 1000 || proof.confirmedAt > request.expiresAt)
      throw new ErrorHandler("Payment outside the request period. Keep the receipt and contact the recipient", 409);
    return prisma.$transaction(async db => {
      const fresh = await db.paymentRequest.findUniqueOrThrow({ where: { id: request.id } });
      if (fresh.paidAt && fresh.txHash === proof.txHash) return { success: true, txHash: proof.txHash };
      if (fresh.paidAt || (fresh.cancelledAt && proof.confirmedAt > fresh.cancelledAt)) throw new ErrorHandler("Request already paid or cancelled. Keep the receipt", 409);
      const used = await db.paymentUse.findUnique({ where: { chainId_txHash: { chainId: proof.chainId, txHash: proof.txHash } } });
      if (used) throw new ErrorHandler("This payment has already been used", 409);
      const legacy = await db.transaction.findUnique({ where: { txHash: proof.txHash } });
      if (legacy && await db.groupExpenseSplit.count({ where: { settlementTransactionId: legacy.id } }))
        throw new ErrorHandler("This payment already settled a group expense", 409);
      await db.paymentUse.create({ data: { chainId: proof.chainId, txHash: proof.txHash, purpose: "REQUEST", referenceId: request.id } });
      await db.paymentRequest.update({ where: { id: request.id }, data: { txHash: proof.txHash, paidAt: proof.confirmedAt } });
      return { success: true, txHash: proof.txHash };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  },
};
