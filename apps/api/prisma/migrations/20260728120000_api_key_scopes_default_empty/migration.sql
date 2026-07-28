-- Fail-closed default for ApiKey.scopes: a key created without explicit
-- scopes must grant nothing, not everything. Existing rows are deliberately
-- untouched — legacy seed keys carrying '["*"]' are handled (and logged) by
-- the auth middleware; rewriting live credentials is a separate operation.
ALTER TABLE "ApiKey" ALTER COLUMN "scopes" SET DEFAULT '[]';
