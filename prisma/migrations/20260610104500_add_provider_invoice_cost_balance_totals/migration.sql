-- Add frozen provider invoice cost-balance/remittance totals.
-- Additive and idempotent because some local databases may be patched before migration deploy.

ALTER TABLE "ProviderClientInvoice"
  ADD COLUMN IF NOT EXISTS "baseNetRemitToProvider" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "costBalanceThisRemittancePeriod" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "costBalanceDeductionCap" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "costBalanceAdjustmentToNetRemit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "costBalanceLedgerBefore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "costBalanceLedgerChange" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "costBalanceLedgerAfter" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "netRemitToProviderTotal" DOUBLE PRECISION NOT NULL DEFAULT 0;
