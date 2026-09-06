-- Security center: TOTP, recovery phone metadata and one-time recovery codes.
ALTER TABLE "User"
ADD COLUMN "totpSecretEncrypted" TEXT,
ADD COLUMN "totpPendingSecret" TEXT,
ADD COLUMN "totpPendingCreatedAt" TIMESTAMP(3),
ADD COLUMN "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "recoveryPhone" TEXT,
ADD COLUMN "recoveryPhoneVerifiedAt" TIMESTAMP(3);

CREATE TABLE "RecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecoveryCode_userId_usedAt_idx" ON "RecoveryCode"("userId", "usedAt");

ALTER TABLE "RecoveryCode"
ADD CONSTRAINT "RecoveryCode_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
