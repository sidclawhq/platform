-- DropIndex
DROP INDEX "User_tenant_id_email_key";

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
