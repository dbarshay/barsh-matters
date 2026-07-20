-- READ-ONLY. Lists every BRL_ matter with its key fields so we can spot the stale test rows.
-- Run in the Neon SQL Editor. Look for the block of test matters (e.g. empty patient/claim, or a
-- high number range) and note where the real matters end.
SELECT
  matter_id,
  display_number,
  patient_name,
  provider_name,
  insurer_name,
  claim_number_normalized,
  status,
  final_status,
  import_batch,
  indexed_at
FROM "ClaimIndex"
WHERE display_number ILIKE 'BRL\_%'
ORDER BY display_number;
