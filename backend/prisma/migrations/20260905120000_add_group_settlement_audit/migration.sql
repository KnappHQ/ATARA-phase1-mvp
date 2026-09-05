-- CreateTable
CREATE TABLE "GroupSettlement" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "payeeId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "txHash" TEXT,
    "transactionId" TEXT,
    "assetSymbol" TEXT,
    "amountUsd" DECIMAL(24,8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupSettlement_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "GroupExpenseSplit" ADD COLUMN "settlementId" TEXT;

-- CreateIndex
-- A given on-chain payment, or a given in-app transaction, can clear a debt
-- exactly once. This is the constraint that makes settlement replay impossible.
CREATE UNIQUE INDEX "GroupSettlement_txHash_key" ON "GroupSettlement"("txHash");
CREATE UNIQUE INDEX "GroupSettlement_transactionId_key" ON "GroupSettlement"("transactionId");
CREATE INDEX "GroupSettlement_groupId_payerId_payeeId_idx" ON "GroupSettlement"("groupId", "payerId", "payeeId");

-- AddForeignKey
ALTER TABLE "GroupSettlement" ADD CONSTRAINT "GroupSettlement_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupSettlement" ADD CONSTRAINT "GroupSettlement_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GroupSettlement" ADD CONSTRAINT "GroupSettlement_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GroupExpenseSplit" ADD CONSTRAINT "GroupExpenseSplit_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "GroupSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
