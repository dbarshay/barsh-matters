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
  "masterSettlementDocumentsPreview",
  "masterSettlementDocumentsPreviewLoading",
  "loadMasterSettlementDocumentsPreview",
  "/api/settlements/documents-preview?",
  "data-barsh-settlement-document-preview-strip",
  "Settlement Documents",
  "Local-first settlement document plan",
  "Preview Settlement Documents",
  "plannedDocuments",
]) {
  if (!text.includes(marker)) fail(`${pagePath} missing ${marker}`);
}

const stripIndex = text.indexOf("data-barsh-settlement-document-preview-strip");
const stripWindow = stripIndex >= 0 ? text.slice(stripIndex, stripIndex + 14000) : "";

for (const forbidden of [
  "/api/settlements/current-values",
  "/api/settlements/writeback",
  "/api/documents/finalize",
  "/api/documents/print-queue",
  "/api/graph/create-draft",
  "createMasterDocumentOutlookDraft",
  "uploadFinalDocumentsToClio",
  "documentsGenerated: true",
  "printQueueChanged: true",
  "emailsSent: true",
]) {
  if (stripWindow.includes(forbidden)) fail(`document preview UI strip contains forbidden side-effect marker ${forbidden}`);
}

if (!pkg.includes("verify:settlement-document-preview-ui-safety")) {
  fail(`${pkgPath} missing verify:settlement-document-preview-ui-safety script`);
}

if (!process.exitCode) {
  pass("settlement document preview UI is local-first and side-effect safe");
}
