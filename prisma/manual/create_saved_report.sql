-- Additive only: creates the SavedReport table + indexes. Drops nothing.
CREATE TABLE IF NOT EXISTS "SavedReport" (
  "id"            TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "description"   TEXT,
  "baseEntity"    TEXT NOT NULL DEFAULT 'matter',
  "config"        JSONB NOT NULL,
  "ownerId"       TEXT,
  "ownerEmail"    TEXT,
  "ownerUsername" TEXT,
  "isShared"      BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SavedReport_ownerId_idx" ON "SavedReport"("ownerId");
CREATE INDEX IF NOT EXISTS "SavedReport_isShared_idx" ON "SavedReport"("isShared");
