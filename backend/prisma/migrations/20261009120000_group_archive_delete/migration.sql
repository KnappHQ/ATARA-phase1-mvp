-- Archive (per member) and soft delete (per group). Additive: nothing is dropped or rewritten.
ALTER TABLE "Group" ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedById" TEXT;

ALTER TABLE "GroupMember" ADD COLUMN "archivedAt" TIMESTAMP(3);
