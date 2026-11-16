-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "rateSnapshotPaisa" INTEGER;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "autoConfirmed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SessionEdit" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "previousKwh" DECIMAL(8,3) NOT NULL,
    "newKwh" DECIMAL(8,3) NOT NULL,
    "reason" TEXT,
    "editedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionEdit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SessionEdit_sessionId_idx" ON "SessionEdit"("sessionId");
CREATE INDEX IF NOT EXISTS "SessionEdit_editedById_idx" ON "SessionEdit"("editedById");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_adminId_idx" ON "AdminAuditLog"("adminId");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");
CREATE UNIQUE INDEX IF NOT EXISTS "Dispute_bookingId_key" ON "Dispute"("bookingId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SessionEdit_sessionId_fkey') THEN
    ALTER TABLE "SessionEdit" ADD CONSTRAINT "SessionEdit_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SessionEdit_editedById_fkey') THEN
    ALTER TABLE "SessionEdit" ADD CONSTRAINT "SessionEdit_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminAuditLog_adminId_fkey') THEN
    ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Partial Unique Indexes for Idempotency:
-- Guarantee at the DB level that at most one COMMISSION transaction exists per booking
CREATE UNIQUE INDEX IF NOT EXISTS "wallet_tx_one_commission_per_booking" 
ON "WalletTransaction" ("bookingId") 
WHERE "type" = 'COMMISSION' AND "bookingId" IS NOT NULL;

-- Guarantee at the DB level that at most one TOPUP transaction exists per topup
CREATE UNIQUE INDEX IF NOT EXISTS "wallet_tx_one_topup_per_topup" 
ON "WalletTransaction" ("topupId") 
WHERE "type" = 'TOPUP' AND "topupId" IS NOT NULL;
