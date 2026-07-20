-- STEP 2 (DESTRUCTIVE — run only after verify_test_matters.sql shows the expected count).
-- Removes stale test matters (display_number number > 202600050). Real matters (…001–…050) are kept.
DELETE FROM "ClaimIndex"
WHERE display_number ILIKE 'BRL\_%'
  AND NULLIF(regexp_replace(display_number, '\D', '', 'g'), '')::bigint > 202600050;
