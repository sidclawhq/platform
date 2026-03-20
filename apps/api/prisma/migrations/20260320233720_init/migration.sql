-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "settings" JSONB NOT NULL DEFAULT '{"default_approval_ttl_seconds": 86400, "default_data_classification": "internal", "notification_email": null}',
    "onboarding_state" JSONB NOT NULL DEFAULT '{}',
    "stripe_customer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "auth_provider" TEXT NOT NULL DEFAULT 'email',
    "auth_provider_id" TEXT,
    "password_hash" TEXT,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "owner_name" TEXT NOT NULL,
    "owner_role" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'dev',
    "authority_model" TEXT NOT NULL,
    "identity_mode" TEXT NOT NULL,
    "delegation_model" TEXT NOT NULL,
    "autonomy_tier" TEXT NOT NULL DEFAULT 'low',
    "lifecycle_state" TEXT NOT NULL DEFAULT 'active',
    "authorized_integrations" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB,
    "next_review_date" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyRule" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "policy_name" TEXT NOT NULL,
    "target_integration" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "resource_scope" TEXT NOT NULL,
    "data_classification" TEXT NOT NULL,
    "policy_effect" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "conditions" JSONB,
    "max_session_ttl" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "policy_version" INTEGER NOT NULL DEFAULT 1,
    "modified_by" TEXT NOT NULL,
    "modified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "trace_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "policy_rule_id" TEXT NOT NULL,
    "requested_operation" TEXT NOT NULL,
    "target_integration" TEXT NOT NULL,
    "resource_scope" TEXT NOT NULL,
    "data_classification" TEXT NOT NULL,
    "authority_model" TEXT NOT NULL,
    "delegated_from" TEXT,
    "policy_effect" TEXT NOT NULL,
    "flag_reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),
    "approver_name" TEXT,
    "decision_note" TEXT,
    "separation_of_duties_check" TEXT NOT NULL DEFAULT 'not_applicable',

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditTrace" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "authority_model" TEXT NOT NULL,
    "requested_operation" TEXT NOT NULL,
    "target_integration" TEXT NOT NULL,
    "resource_scope" TEXT NOT NULL,
    "parent_trace_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "final_outcome" TEXT NOT NULL DEFAULT 'in_progress',

    CONSTRAINT "AuditTrace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "trace_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "approval_request_id" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_type" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "policy_version" INTEGER,
    "correlation_id" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "scopes" JSONB NOT NULL DEFAULT '["*"]',
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "User_tenant_id_idx" ON "User"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenant_id_email_key" ON "User"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "Agent_tenant_id_idx" ON "Agent"("tenant_id");

-- CreateIndex
CREATE INDEX "Agent_lifecycle_state_idx" ON "Agent"("lifecycle_state");

-- CreateIndex
CREATE INDEX "PolicyRule_tenant_id_idx" ON "PolicyRule"("tenant_id");

-- CreateIndex
CREATE INDEX "PolicyRule_agent_id_idx" ON "PolicyRule"("agent_id");

-- CreateIndex
CREATE INDEX "PolicyRule_agent_id_is_active_idx" ON "PolicyRule"("agent_id", "is_active");

-- CreateIndex
CREATE INDEX "ApprovalRequest_tenant_id_idx" ON "ApprovalRequest"("tenant_id");

-- CreateIndex
CREATE INDEX "ApprovalRequest_trace_id_idx" ON "ApprovalRequest"("trace_id");

-- CreateIndex
CREATE INDEX "ApprovalRequest_agent_id_idx" ON "ApprovalRequest"("agent_id");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_idx" ON "ApprovalRequest"("status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_tenant_id_status_idx" ON "ApprovalRequest"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "AuditTrace_tenant_id_idx" ON "AuditTrace"("tenant_id");

-- CreateIndex
CREATE INDEX "AuditTrace_agent_id_idx" ON "AuditTrace"("agent_id");

-- CreateIndex
CREATE INDEX "AuditTrace_final_outcome_idx" ON "AuditTrace"("final_outcome");

-- CreateIndex
CREATE INDEX "AuditTrace_tenant_id_started_at_idx" ON "AuditTrace"("tenant_id", "started_at");

-- CreateIndex
CREATE INDEX "AuditTrace_parent_trace_id_idx" ON "AuditTrace"("parent_trace_id");

-- CreateIndex
CREATE INDEX "AuditEvent_tenant_id_idx" ON "AuditEvent"("tenant_id");

-- CreateIndex
CREATE INDEX "AuditEvent_trace_id_idx" ON "AuditEvent"("trace_id");

-- CreateIndex
CREATE INDEX "AuditEvent_trace_id_timestamp_idx" ON "AuditEvent"("trace_id", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_hash_key" ON "ApiKey"("key_hash");

-- CreateIndex
CREATE INDEX "ApiKey_tenant_id_idx" ON "ApiKey"("tenant_id");

-- CreateIndex
CREATE INDEX "ApiKey_key_hash_idx" ON "ApiKey"("key_hash");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyRule" ADD CONSTRAINT "PolicyRule_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyRule" ADD CONSTRAINT "PolicyRule_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_trace_id_fkey" FOREIGN KEY ("trace_id") REFERENCES "AuditTrace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_policy_rule_id_fkey" FOREIGN KEY ("policy_rule_id") REFERENCES "PolicyRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditTrace" ADD CONSTRAINT "AuditTrace_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditTrace" ADD CONSTRAINT "AuditTrace_parent_trace_id_fkey" FOREIGN KEY ("parent_trace_id") REFERENCES "AuditTrace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_trace_id_fkey" FOREIGN KEY ("trace_id") REFERENCES "AuditTrace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
