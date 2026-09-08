-- CreateEnum
CREATE TYPE "SplitDecision" AS ENUM ('PENDING', 'ACCEPTED', 'DISPUTED');

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "assetSymbol" TEXT NOT NULL DEFAULT 'USD';

-- AlterTable
ALTER TABLE "GroupExpense" ADD COLUMN     "clientRequestId" TEXT;

-- AlterTable
ALTER TABLE "GroupExpenseSplit" ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "decision" "SplitDecision" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "chainId" INTEGER,
ADD COLUMN     "confirmedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SettlementIntent" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "amount" DECIMAL(24,8) NOT NULL,
    "splitIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "SettlementIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentUse" (
    "chainId" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentUse_pkey" PRIMARY KEY ("chainId","txHash")
);

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "recipientAddress" TEXT NOT NULL,
    "amount" DECIMAL(24,8) NOT NULL,
    "note" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "txHash" TEXT,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SettlementIntent_senderId_groupId_expiresAt_idx" ON "SettlementIntent"("senderId", "groupId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentUse_referenceId_key" ON "PaymentUse"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_tokenHash_key" ON "PaymentRequest"("tokenHash");

-- CreateIndex
CREATE INDEX "PaymentRequest_creatorId_createdAt_idx" ON "PaymentRequest"("creatorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GroupExpense_groupId_paidById_clientRequestId_key" ON "GroupExpense"("groupId", "paidById", "clientRequestId");
