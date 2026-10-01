-- Two paid offers, ATARA Miles, card events and the card waiting list.
-- Existing accounts are unchanged (all FREE + INACTIVE).
ALTER TYPE "SubscriptionTier" ADD VALUE IF NOT EXISTS 'PLUS';
ALTER TYPE "SubscriptionTier" ADD VALUE IF NOT EXISTS 'MAX';

CREATE TYPE "MilesEntryKind" AS ENUM ('EARN', 'REVERSAL', 'REDEEM');

CREATE TABLE "MilesEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "MilesEntryKind" NOT NULL,
    "miles" INTEGER NOT NULL,
    "spendUsdCents" INTEGER,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilesEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MilesEntry_source_sourceId_kind_key" ON "MilesEntry"("source", "sourceId", "kind");
CREATE INDEX "MilesEntry_userId_createdAt_idx" ON "MilesEntry"("userId", "createdAt");
ALTER TABLE "MilesEntry" ADD CONSTRAINT "MilesEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CardEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CardEvent_provider_eventId_key" ON "CardEvent"("provider", "eventId");

CREATE TABLE "CardWaitlist" (
    "userId" TEXT NOT NULL,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardWaitlist_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "CardWaitlist" ADD CONSTRAINT "CardWaitlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
