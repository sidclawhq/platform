-- Widen cost_estimate so long sessions / future price bumps don't overflow.
-- Decimal(12,8) → Decimal(14,6): max value $99,999,999.999999 (plenty), 6-decimal
-- precision which is more than enough for LLM cost aggregates.
ALTER TABLE "AuditTrace"
  ALTER COLUMN "cost_estimate" TYPE DECIMAL(14, 6);

-- Indexes for telemetry analytics and error filtering. Without these the
-- Analytics + Compliance pages full-scan AuditTrace.
CREATE INDEX IF NOT EXISTS "AuditTrace_tenant_error_idx"
  ON "AuditTrace" ("tenant_id", "error_classification")
  WHERE "error_classification" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "AuditTrace_tenant_model_idx"
  ON "AuditTrace" ("tenant_id", "model")
  WHERE "model" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "AuditTrace_tenant_started_cost_idx"
  ON "AuditTrace" ("tenant_id", "started_at")
  WHERE "cost_estimate" IS NOT NULL;
