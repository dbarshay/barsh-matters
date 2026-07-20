-- STEP 1 (READ-ONLY): confirm exactly what will be deleted before running the DELETE.
-- Rule: any BRL_ matter whose number is greater than 202600050 (real matters are 202600001–202600050).
SELECT COUNT(*) AS will_delete
FROM "ClaimIndex"
WHERE display_number ILIKE 'BRL\_%'
  AND NULLIF(regexp_replace(display_number, '\D', '', 'g'), '')::bigint > 202600050;

-- And list them so you can eyeball that they are all test rows:
SELECT display_number, patient_name, provider_name, claim_number_normalized, status
FROM "ClaimIndex"
WHERE display_number ILIKE 'BRL\_%'
  AND NULLIF(regexp_replace(display_number, '\D', '', 'g'), '')::bigint > 202600050
ORDER BY NULLIF(regexp_replace(display_number, '\D', '', 'g'), '')::bigint;
