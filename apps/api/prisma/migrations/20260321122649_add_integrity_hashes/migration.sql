-- AlterTable
ALTER TABLE "AuditEvent" ADD COLUMN     "integrity_hash" TEXT;

-- AlterTable
ALTER TABLE "AuditTrace" ADD COLUMN     "integrity_hash" TEXT;
