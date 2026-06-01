#!/usr/bin/env node

import fs from "fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

let failures = 0;

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  failures += 1;
}

function mustContain(label, text, marker) {
  if (!text.includes(marker)) {
    fail(`${label}: missing ${marker}`);
    return;
  }
  pass(`${label}: found ${marker}`);
}

function mustNotContain(label, text, marker) {
  if (text.includes(marker)) {
    fail(`${label}: must not contain ${marker}`);
    return;
  }
  pass(`${label}: does not contain ${marker}`);
}

function mustMatch(label, text, regex, description) {
  if (!regex.test(text)) {
    fail(`${label}: missing ${description}`);
    return;
  }
  pass(`${label}: found ${description}`);
}

console.log("=== VERIFY VERIFIER CONTRACT LOCKS ===");

const pkg = read("package.json");

console.log("");
console.log("=== VERIFY LOCKED VERIFIERS ARE IN VERIFY:PROD ===");
[
  "verify:settlement-history-display-contract",
  "verify:settlement-payment-due-tickler-open-only-safety",
  "verify:settlement-finalized-email-safety",
  "verify:settlement-void-safety",
  "verify:settlement-percent-normalization-safety",
  "verify:document-delivery-draft-preview-safety",
  "verify:document-delivery-preview-ui-safety",
  "verify:direct-matter-email-thread-ui-safety",
  "verify:maildrop-address-registry-safety",
  "verify:verifier-contract-locks"
].forEach((marker) => mustContain("package.json verify:prod", pkg, marker));

console.log("");
console.log("=== VERIFY DISABLED LEGACY SETTLEMENT ROUTE VERIFIERS LOCK DISABLED CONTRACT ===");
[
  "scripts/verify-settlement-writeback-safety.mjs",
  "scripts/verify-provider-fee-defaults-safety.mjs",
  "scripts/verify-current-settlement-values-safety.mjs"
].forEach((file) => {
  const text = read(file);
  mustContain(file, text, 'action: "legacy-clio-settlement-route-disabled"');
  mustContain(file, text, "disabled: true");
  mustContain(file, text, 'sourceOfTruth: "barsh-matters-local"');
  mustContain(file, text, "return NextResponse.json(disabledPayload, { status: 410 });");
  mustContain(file, text, "settlementWritebackPerformed: false");

  // These stale markers should be explicitly blocked by the verifier where relevant.
  if (file.includes("writeback")) {
    mustContain(file, text, "assertNotContains");
    mustContain(file, text, "confirmWrite");
  } else {
    mustContain(file, text, "mustNotContain");
  }
  if (file.includes("current-settlement-values")) {
    mustContain(file, text, 'source: "live-clio-read"');
  }
  if (file.includes("provider-fee-defaults")) {
    mustContain(file, text, "custom_field_values{id,field_name,value,custom_field}");
  }
});

console.log("");
console.log("=== VERIFY SETTLEMENT DOCX VERIFIERS LOCK TEMPLATE REGISTRY CONTRACT ===");
[
  "scripts/verify-settlement-documents-preview-safety.mjs",
  "scripts/verify-settlement-summary-docx-safety.mjs",
  "scripts/verify-provider-remittance-docx-safety.mjs",
  "scripts/verify-attorney-fee-docx-safety.mjs"
].forEach((file) => {
  const text = read(file);
  mustContain(file, text, "lib/documents/templateRegistry.ts");
  mustContain(file, text, "buildSettlementPlannedDocuments");
  mustContain(file, text, 'generationEndpoint: "/api/settlements/settlement-summary"');
  mustContain(file, text, 'generationEndpoint: "/api/settlements/provider-remittance-breakdown"');
  mustContain(file, text, 'generationEndpoint: "/api/settlements/attorney-fee-breakdown"');
  mustContain(file, text, "routeOnly: true");
  mustNotContain(file, text, "VERIFY PREVIEW ROUTE ADVERTISES ONLY");
});

console.log("");
console.log("=== VERIFY DIRECT EMAIL VERIFIER IS SCOPED TO EMAIL PANEL ===");
{
  const text = read("scripts/verify-direct-matter-email-thread-ui-safety.mjs");
  mustContain("direct email verifier", text, 'extractFunctionBody(page, "renderMatterEmailThreadsPanel")');
  mustContain("direct email verifier", text, "VERIFY NO DIRECT DRAFT/SEND/CLIO WRITE WIRING INSIDE DIRECT EMAILS PANEL");
  mustNotContain("direct email verifier", text, "VERIFY NO DIRECT DRAFT/SEND/CLIO WRITE WIRING IN DIRECT EMAILS UI");
}

console.log("");
console.log("=== VERIFY DOCUMENT DELIVERY VERIFIERS LOCK CURRENT UI / FAIL-CLOSED GRAPH CONTRACT ===");
{
  const text = read("scripts/verify-document-delivery-draft-preview-safety.mjs");
  mustContain("document delivery draft verifier", text, "Document Delivery");
  mustContain("document delivery draft verifier", text, "/api/graph/create-draft?confirm=create-graph-draft");
  mustContain("document delivery draft verifier", text, 'const REQUIRED_CONFIRMATION = "create-graph-draft"');
  mustContain("document delivery draft verifier", text, "Fail-closed Graph draft creation route.");
  mustContain("document delivery draft verifier", text, "Document Email Draft Preview Only");
  mustNotContain("document delivery draft verifier", text, 'mustNotContain(pagePath, page, "alert(")');
}

{
  const text = read("scripts/verify-document-delivery-preview-ui-safety.mjs");
  mustContain("document delivery UI verifier", text, "Document Delivery");
  mustContain("document delivery UI verifier", text, "Preview only.  No Outlook draft is created unless Create Outlook Draft is clicked.");
  mustContain("document delivery UI verifier", text, "Create Outlook Draft");
  mustContain("document delivery UI verifier", text, "Document Email Draft Preview Only");
}

console.log("");
console.log("=== VERIFY MAILDROP REGISTRY VERIFIER ACCEPTS CURRENT PRISMA FORMAT ===");
{
  const text = read("scripts/verify-maildrop-address-registry-safety.mjs");
  mustContain("MailDrop registry verifier", text, "mustMatch(");
  mustMatch(
    "MailDrop registry verifier",
    text,
    /clioMaildropEmail\\s\+String\\\?\?\\s\+@unique/,
    "escaped clioMaildropEmail String/String? @unique regex"
  );
  mustContain("MailDrop registry verifier", text, 'CREATE UNIQUE INDEX "MaildropAddress_clioMaildropEmail_key"');
  mustNotContain("MailDrop registry verifier", text, 'clioMaildropEmail   String   @unique"');
}

console.log("");
console.log("=== VERIFY SETTLEMENT TICKLERS ARE OPEN-ONLY ===");
{
  const text = read("scripts/verify-settlement-payment-due-tickler-open-only-safety.mjs");
  mustContain("settlement tickler open-only verifier", text, '(includeCompleted ? {} : { status: "open" })');
  mustContain("settlement tickler open-only verifier", text, 'status: "open"');
  mustContain("settlement tickler open-only verifier", text, 'status: { not: "completed" }');
}

if (failures > 0) {
  console.error(`\n=== VERIFIER CONTRACT LOCKS FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("");
console.log("=== VERIFIER CONTRACT LOCKS PASSED ===");
console.log("Updated verifier contracts are locked against stale Clio-read/write, stale preview-route, stale broad-scope, and stale UI-heading expectations.");
