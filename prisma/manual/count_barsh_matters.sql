-- Quick counts to gauge scale before any delete.
SELECT
  COUNT(*) AS total_brl_matters,
  COUNT(*) FILTER (WHERE COALESCE(patient_name,'')='' AND COALESCE(claim_number_normalized,'')='' AND COALESCE(provider_name,'')='') AS empty_rows,
  COUNT(*) FILTER (WHERE import_batch IS NOT NULL) AS import_batch_rows
FROM "ClaimIndex"
WHERE display_number ILIKE 'BRL\_%';
