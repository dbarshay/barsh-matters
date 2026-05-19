#!/usr/bin/env bash
set -euo pipefail

echo "=== VERIFY CLEAN WORKING TREE ==="
status="$(git status --short)"

if [ -n "$status" ] && [ "${ALLOW_DIRTY:-0}" != "1" ]; then
  echo "$status"
  echo
  echo "FAIL: working tree is not clean. Commit, stash, or discard changes before production verification." >&2
  exit 1
fi

if [ -n "$status" ]; then
  echo "$status"
  echo "ALLOW_DIRTY=1 set; continuing despite local changes."
else
  echo "clean"
fi

echo
echo "=== VERIFY TOP COMMIT ==="
git log --oneline --decorate -1

echo
echo "=== RUN SETTLEMENT WRITEBACK SAFETY VERIFIER ==="
npm run verify:settlement-writeback-safety

echo
echo "=== RUN SETTLED WITH PERSON-CONTACT SAFETY VERIFIER ==="
npm run verify:settled-with-person-contact-safety

echo
echo "=== RUN PROVIDER FEE DEFAULTS SAFETY VERIFIER ==="
npm run verify:provider-fee-defaults-safety

echo
echo "=== RUN CURRENT SETTLEMENT VALUES SAFETY VERIFIER ==="
npm run verify:current-settlement-values-safety

echo
echo "=== RUN SETTLEMENT WORKFLOW STATUS UI SAFETY VERIFIER ==="
npm run verify:settlement-workflow-status-ui-safety

echo
echo "=== RUN SETTLEMENT CLOSE PREVIEW SAFETY VERIFIER ==="
npm run verify:settlement-close-preview-safety

echo
echo "=== RUN CLOSE PAID SETTLEMENTS SAFETY VERIFIER ==="
npm run verify:close-paid-settlements-safety

echo
echo "=== RUN SETTLEMENT DOCUMENTS PREVIEW SAFETY VERIFIER ==="
npm run verify:settlement-documents-preview-safety

echo
echo "=== RUN SETTLEMENT SUMMARY DOCX SAFETY VERIFIER ==="
npm run verify:settlement-summary-docx-safety

echo
echo "=== RUN PROVIDER REMITTANCE DOCX SAFETY VERIFIER ==="
npm run verify:provider-remittance-docx-safety

echo
echo "=== RUN ATTORNEY FEE DOCX SAFETY VERIFIER ==="
npm run verify:attorney-fee-docx-safety

echo
echo "=== RUN CLAIMINDEX INGEST FIELD COVERAGE SAFETY VERIFIER ==="
npm run verify:claimindex-ingest-field-coverage-safety

echo
echo "=== RUN CLAIMINDEX REBUILD STATUS SAFETY VERIFIER ==="
npm run verify:claimindex-rebuild-status-safety

echo
echo "=== RUN DIRECT MATTER EMAIL THREAD UI SAFETY VERIFIER ==="
npm run verify:direct-matter-email-thread-ui-safety

echo "=== RUN MASTER EMAIL THREAD UI SAFETY VERIFIER ==="
npm run verify:master-email-thread-ui-safety

echo "=== RUN GRAPH THREAD SYNC PREVIEW SAFETY VERIFIER ==="
npm run verify:graph-thread-sync-preview-safety

echo "=== RUN GRAPH THREAD SYNC PERSISTENCE SAFETY VERIFIER ==="
npm run verify:graph-thread-sync-persistence-safety

echo "=== RUN PRODUCTION WORKFLOW SMOKE TEST ==="
npm run smoke:workflow:prod

echo "=== VERIFY LOCAL-FIRST INDIVIDUAL PAYMENT SAFETY ==="
npm run verify:reference-data-safety
npm run verify:reference-import-preview-safety
npm run verify:reference-import-confirm-safety
npm run verify:reference-import-history-safety
npm run verify:reference-import-cleanup-preview-safety
npm run verify:reference-import-cleanup-confirm-safety
npm run verify:local-first-payment-safety
