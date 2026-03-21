-- CreateTable
CREATE TABLE "PolicyRuleVersion" (
    "id" TEXT NOT NULL,
    "policy_rule_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "policy_name" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "target_integration" TEXT NOT NULL,
    "resource_scope" TEXT NOT NULL,
    "data_classification" TEXT NOT NULL,
    "policy_effect" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "max_session_ttl" INTEGER,
    "modified_by" TEXT NOT NULL,
    "modified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "change_summary" TEXT,

    CONSTRAINT "PolicyRuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PolicyRuleVersion_policy_rule_id_version_idx" ON "PolicyRuleVersion"("policy_rule_id", "version");

-- AddForeignKey
ALTER TABLE "PolicyRuleVersion" ADD CONSTRAINT "PolicyRuleVersion_policy_rule_id_fkey" FOREIGN KEY ("policy_rule_id") REFERENCES "PolicyRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
