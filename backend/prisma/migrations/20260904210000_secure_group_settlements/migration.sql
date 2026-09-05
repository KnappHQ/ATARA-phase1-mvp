-- Record which verified in-app transaction settled each expense split.
-- A transaction can cover several splits in one settlement, while service-level
-- validation prevents it from being reused for another settlement.
ALTER TABLE "GroupExpenseSplit"
ADD COLUMN "settlementTransactionId" TEXT;

CREATE INDEX "GroupExpenseSplit_settlementTransactionId_idx"
ON "GroupExpenseSplit"("settlementTransactionId");
