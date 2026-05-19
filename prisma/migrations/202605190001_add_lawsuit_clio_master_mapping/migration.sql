-- Add explicit Clio master matter mapping fields for Barsh Matters master lawsuits.
-- These fields map local masterLawsuitId values such as 2026.05.00001 to
-- Clio-assigned matter IDs and BRLXXXXX display numbers.

ALTER TABLE "Lawsuit"
ADD COLUMN IF NOT EXISTS "clioMasterMatterId" INTEGER,
ADD COLUMN IF NOT EXISTS "clioMasterDisplayNumber" TEXT,
ADD COLUMN IF NOT EXISTS "clioMasterMatterDescription" TEXT,
ADD COLUMN IF NOT EXISTS "clioMasterMappedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "clioMasterMappingSource" TEXT;

CREATE INDEX IF NOT EXISTS "Lawsuit_clioMasterMatterId_idx"
ON "Lawsuit"("clioMasterMatterId");

CREATE INDEX IF NOT EXISTS "Lawsuit_clioMasterDisplayNumber_idx"
ON "Lawsuit"("clioMasterDisplayNumber");
