-- AlterTable: add outcome telemetry + token/cost attribution to AuditTrace
ALTER TABLE "AuditTrace"
  ADD COLUMN "outcome_summary" TEXT,
  ADD COLUMN "error_classification" TEXT,
  ADD COLUMN "exit_code" INTEGER,
  ADD COLUMN "tokens_in" INTEGER,
  ADD COLUMN "tokens_out" INTEGER,
  ADD COLUMN "tokens_cache_read" INTEGER,
  ADD COLUMN "model" TEXT,
  ADD COLUMN "cost_estimate" DECIMAL(12, 8);
