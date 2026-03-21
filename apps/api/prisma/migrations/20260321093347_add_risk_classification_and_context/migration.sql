-- AlterTable
ALTER TABLE "ApprovalRequest" ADD COLUMN     "context_snapshot" JSONB,
ADD COLUMN     "risk_classification" TEXT;
