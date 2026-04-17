-- Partial unique index on AuditTrace — exactly one drift_sentinel trace per
-- (tenant, agent). Race in persistSignal is caught at DB level as a final
-- defense even if two hourly runs slip past the transaction ordering.
CREATE UNIQUE INDEX IF NOT EXISTS "AuditTrace_drift_sentinel_unique_idx"
  ON "AuditTrace" ("tenant_id", "agent_id")
  WHERE "final_outcome" = 'drift_sentinel';

-- Index for the drift-detection dedup lookup — recentAlertSignatures queries
-- AuditEvent by (tenant_id, agent_id, event_type='drift_detected', timestamp
-- >= since). Without this it full-scans the AuditEvent table on every
-- hourly run per agent.
CREATE INDEX IF NOT EXISTS "AuditEvent_tenant_agent_type_ts_idx"
  ON "AuditEvent" ("tenant_id", "agent_id", "event_type", "timestamp");

-- Note on zero-downtime: these CREATE INDEX statements take an ACCESS
-- EXCLUSIVE-lite lock (ShareLock) that blocks writes but not reads on the
-- AuditEvent/AuditTrace tables. For production clusters with millions of
-- rows, replace with CREATE INDEX CONCURRENTLY in a manual pre-deploy
-- step (Prisma can't emit CONCURRENTLY). Example:
--   ALTER INDEX IF EXISTS "AuditEvent_tenant_agent_type_ts_idx" RENAME TO ...;
--   DROP INDEX CONCURRENTLY IF EXISTS "AuditEvent_tenant_agent_type_ts_idx";
--   CREATE INDEX CONCURRENTLY "AuditEvent_tenant_agent_type_ts_idx" ON ...;
