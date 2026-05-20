#!/usr/bin/env node
import fs from "node:fs";

const pagePath = "app/matters/page.tsx";
const pkgPath = "package.json";
const text = fs.existsSync(pagePath) ? fs.readFileSync(pagePath, "utf8") : "";
const pkg = fs.existsSync(pkgPath) ? fs.readFileSync(pkgPath, "utf8") : "";

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

for (const marker of [
  "commitMasterSettlementAndLaunchDocuments",
  "Run local settlement preview before committing the settlement",
  "/api/settlements/local-record",
  "await loadMasterSettlementHistory",
  "await createMasterSettlementPaymentDueTickler",
  "await launchMasterDocumentGenerationDialog",
  "setMasterSettlementFormOpen(false)",
  "resetMasterSettlementPreviewForm",
  "Commit Settlement",
  "data-barsh-settlement-commit-flow-marker",
]) {
  if (!text.includes(marker)) fail(`${pagePath} missing marker: ${marker}`);
}

if (!text.includes("Record Settlement")) {
  fail("right-side lawsuit action opener should still include Record Settlement");
}

if (text.includes("data-barsh-settlement-document-preview-strip")) {
  fail("settlement document preview strip should not be embedded in Recorded Settlement panel");
}

const helperIndex = text.indexOf("commitMasterSettlementAndLaunchDocuments");
const helperWindow = helperIndex >= 0 ? text.slice(helperIndex, helperIndex + 9000) : "";

for (const forbidden of [
  "/api/settlements/writeback",
  "/api/settlements/current-values",
  "settlementWritebackPerformed: true",
  "uploadFinalDocumentsToClio",
  "/api/documents/finalize",
  "/api/documents/print-queue",
  "/api/graph/create-draft?confirm=create-graph-draft",
]) {
  if (helperWindow.includes(forbidden)) fail(`commit helper contains forbidden marker ${forbidden}`);
}

if (!pkg.includes("verify:settlement-commit-document-flow-safety")) {
  fail(`${pkgPath} missing verify:settlement-commit-document-flow-safety script`);
}

if (!process.exitCode) {
  pass("settlement commit flow saves locally, creates tickler, keeps Record Settlement opener, and launches document dialog");
}
