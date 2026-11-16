-- CreateEnum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PreferredMode') THEN
        CREATE TYPE "PreferredMode" AS ENUM ('DRIVER', 'HOST');
    END IF;
END $$;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "cancelledById" TEXT;

-- AlterTable
ALTER TABLE "Charger" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferredMode" "PreferredMode";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Booking_cancelledById_idx" ON "Booking"("cancelledById");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'Booking_cancelledById_fkey'
    ) THEN
        ALTER TABLE "Booking" ADD CONSTRAINT "Booking_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
