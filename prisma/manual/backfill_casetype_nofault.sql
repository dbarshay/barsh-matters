-- Backfill Case Type = 'No-Fault' for every real (BRL_) matter that currently has no case_type.
-- STEP 1 (verify): how many will change.
SELECT COUNT(*) AS will_set_nofault
FROM "ClaimIndex"
WHERE display_number ILIKE 'BRL\_%'
  AND (case_type IS NULL OR TRIM(case_type) = '');

-- STEP 2 (apply): run after the count looks right.
UPDATE "ClaimIndex"
SET case_type = 'No-Fault'
WHERE display_number ILIKE 'BRL\_%'
  AND (case_type IS NULL OR TRIM(case_type) = '');
