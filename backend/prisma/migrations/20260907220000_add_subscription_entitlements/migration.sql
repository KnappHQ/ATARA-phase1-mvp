-- Provider-neutral subscription state for future ATARA+ entitlements.
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PREMIUM');
CREATE TYPE "SubscriptionStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'GRACE_PERIOD', 'PAUSED', 'CANCELED', 'EXPIRED');

ALTER TABLE "User"
ADD COLUMN "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
ADD COLUMN "subscriptionProvider" TEXT,
ADD COLUMN "subscriptionProductId" TEXT,
ADD COLUMN "subscriptionExpiresAt" TIMESTAMP(3);
