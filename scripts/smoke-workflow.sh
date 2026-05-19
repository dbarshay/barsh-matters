#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
MASTER_LAWSUIT_ID="${MASTER_LAWSUIT_ID:-2026.05.00010}"
MASTER_MATTER_ID="${MASTER_MATTER_ID:-1875147050}"

echo "=== SMOKE TEST BASE URL ==="
echo "$BASE_URL"

echo
echo "=== ROUTE CHECKS ==="
for path in "/" "/lawsuits" "/print-queue" "/matter/${MASTER_MATTER_ID}"; do
  status="$(curl -s -o /tmp/clio-smoke-body.txt -w "%{http_code}" -I "${BASE_URL}${path}")"
  echo "${path}: ${status}"
  if [ "$status" != "200" ]; then
    echo "FAIL: ${path} returned ${status}" >&2
    exit 1
  fi
done

echo
echo "=== PACKET AMOUNT BREAKDOWN CHECK ==="
packet="$(curl -s "${BASE_URL}/api/documents/packet?masterLawsuitId=${MASTER_LAWSUIT_ID}")"

echo "$packet" | jq '{
  ok,
  amountSought: .packet.metadata.amountSought,
  childMatters: [.packet.childMatters[]? | {matterId, displayNumber, claimAmount, balancePresuit}],
  masterMatter: {matterId: .packet.masterMatter.matterId, displayNumber: .packet.masterMatter.displayNumber}
}'

packet_ok="$(echo "$packet" | jq -r '.ok')"
amount_mode="$(echo "$packet" | jq -r '.packet.metadata.amountSought.mode')"
amount_value="$(echo "$packet" | jq -r '.packet.metadata.amountSought.amount')"
selected_count="$(echo "$packet" | jq -r '.packet.metadata.amountSought.breakdown.selectedMatterCount')"
missing_count="$(echo "$packet" | jq -r '.packet.metadata.amountSought.breakdown.missingAmountMatterIds | length')"
excluded_master="$(echo "$packet" | jq -r --argjson id "$MASTER_MATTER_ID" '.packet.metadata.amountSought.breakdown.excludedMasterMatterIds | index($id) != null')"

if [ "$packet_ok" != "true" ]; then
  packet_reason="$(echo "$packet" | jq -r '.packet.metadata.refresh.reason // .packet.refresh.reason // .metadata.refresh.reason // .reason // empty')"
  packet_blocking_count="$(echo "$packet" | jq -r '((.packet.metadata.readiness.blockingErrors // .packet.readiness.blockingErrors // .packet.validation.blockingErrors // .readiness.blockingErrors // []) | length)')"
  packet_has_missing_fixture_errors="$(echo "$packet" | jq -r '[
    (.packet.metadata.readiness.blockingErrors // .packet.readiness.blockingErrors // .packet.validation.blockingErrors // .readiness.blockingErrors // [])[]
  ] | any(. == "No ClaimIndex rows found for MASTER_LAWSUIT_ID." or . == "No master matter found for MASTER_LAWSUIT_ID." or . == "No child bill matters found for MASTER_LAWSUIT_ID.")')"

  if { [ "$packet_reason" = "local-document-packet-no-clio-refresh" ] || [ "$packet_has_missing_fixture_errors" = "true" ]; } && [ "$packet_blocking_count" != "0" ]; then
    echo "WARN: packet endpoint returned structured no-data response for ${MASTER_LAWSUIT_ID}; continuing because production may not contain seeded smoke fixture rows."
  else
    echo "FAIL: packet endpoint did not return ok=true and did not return expected structured no-data response" >&2
    echo "$packet" | jq '{ok, reason: (.packet.metadata.refresh.reason // .packet.refresh.reason // .metadata.refresh.reason // .reason // null), blockingErrors: (.packet.metadata.readiness.blockingErrors // .packet.readiness.blockingErrors // .packet.validation.blockingErrors // .readiness.blockingErrors // [])}' >&2
    exit 1
  fi
else
  if [ "$amount_mode" != "balance_presuit" ]; then
    echo "FAIL: expected amount mode balance_presuit, got ${amount_mode}" >&2
    exit 1
  fi

  if [ "$amount_value" != "0" ]; then
    echo "FAIL: expected restored amount 0, got ${amount_value}" >&2
    exit 1
  fi

  if [ "$selected_count" != "1" ]; then
    echo "FAIL: expected selectedMatterCount 1, got ${selected_count}" >&2
    exit 1
  fi

  if [ "$missing_count" != "0" ]; then
    echo "FAIL: expected no missing amount matter IDs, got ${missing_count}" >&2
    exit 1
  fi

  if [ "$excluded_master" != "true" ]; then
    echo "FAIL: expected master matter ${MASTER_MATTER_ID} to be excluded from amount breakdown" >&2
    exit 1
  fi
fi

echo
echo "=== PRINT QUEUE CHECK ==="
queue="$(curl -s "${BASE_URL}/api/documents/print-queue?status=queued&limit=20")"

echo "$queue" | jq '{
  ok,
  action,
  status,
  count,
  statusCounts,
  rows: [.rows[]? | {
    id,
    masterLawsuitId,
    masterMatterId,
    masterDisplayNumber,
    status,
    documentLabel,
    clioDocumentId
  }]
}'

queue_ok="$(echo "$queue" | jq -r '.ok')"
queued_count="$(echo "$queue" | jq -r '.statusCounts.queued')"
printed_count="$(echo "$queue" | jq -r '.statusCounts.printed')"
hold_count="$(echo "$queue" | jq -r '.statusCounts.hold')"
skipped_count="$(echo "$queue" | jq -r '.statusCounts.skipped')"

if [ "$queue_ok" != "true" ]; then
  echo "FAIL: print queue endpoint did not return ok=true" >&2
  exit 1
fi

if [ "$queued_count" = "null" ] || [ "$printed_count" = "null" ] || [ "$hold_count" = "null" ] || [ "$skipped_count" = "null" ]; then
  echo "FAIL: print queue statusCounts missing expected queued/printed/hold/skipped fields" >&2
  exit 1
fi

echo
echo "=== SMOKE TEST PASSED ==="
