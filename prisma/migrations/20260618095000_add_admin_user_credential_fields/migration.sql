-- Phase 12E: AdminUser credential storage fields only.
-- No login behavior, session binding, credential bootstrap, password hashing, or permission enforcement is activated by this migration.

ALTER TABLE "AdminUser" ADD COLUMN "username" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN "normalizedUsername" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN "passwordSetAt" TIMESTAMP(3);
ALTER TABLE "AdminUser" ADD COLUMN "passwordChangeRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AdminUser" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "AdminUser" ADD COLUMN "lastFailedLoginAt" TIMESTAMP(3);
ALTER TABLE "AdminUser" ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AdminUser" ADD COLUMN "twoFactorRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AdminUser" ADD COLUMN "twoFactorMethod" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN "twoFactorConfiguredAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "AdminUser_normalizedUsername_key" ON "AdminUser"("normalizedUsername");
CREATE INDEX "AdminUser_username_idx" ON "AdminUser"("username");
CREATE INDEX "AdminUser_passwordChangeRequired_idx" ON "AdminUser"("passwordChangeRequired");
CREATE INDEX "AdminUser_lastLoginAt_idx" ON "AdminUser"("lastLoginAt");
