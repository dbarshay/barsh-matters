
CREATE TABLE IF NOT EXISTS "SettlementContact" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "company" TEXT,
  "role" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SettlementContact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SettlementContact_name_email_key" ON "SettlementContact"("name", "email");
CREATE INDEX IF NOT EXISTS "SettlementContact_isActive_idx" ON "SettlementContact"("isActive");

INSERT INTO "SettlementContact" (
  "id",
  "name",
  "email",
  "role",
  "notes",
  "isActive",
  "metadata",
  "createdAt",
  "updatedAt"
)
VALUES (
  'settlement-contact-jane-doe',
  'Jane Doe',
  'dbarshay@brlfirm.com',
  'Settlement Contact',
  'Seeded temporary settlement contact for Barsh Matters settlement workflow testing.',
  true,
  '{"seeded": true, "source": "2026-05-26 settlement workflow testing"}'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("name", "email") DO UPDATE SET
  "role" = EXCLUDED."role",
  "notes" = EXCLUDED."notes",
  "isActive" = true,
  "metadata" = EXCLUDED."metadata",
  "updatedAt" = CURRENT_TIMESTAMP;
