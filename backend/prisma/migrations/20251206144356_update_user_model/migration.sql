-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "displayName" TEXT,
ALTER COLUMN "email" DROP NOT NULL;
