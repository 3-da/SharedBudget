-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApprovalAction" ADD VALUE 'SKIP_MONTH';
ALTER TYPE "ApprovalAction" ADD VALUE 'UNSKIP_MONTH';

-- AlterTable
ALTER TABLE "expense_payment_statuses" ADD COLUMN     "paidAmount" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "isFixed" BOOLEAN NOT NULL DEFAULT true;
