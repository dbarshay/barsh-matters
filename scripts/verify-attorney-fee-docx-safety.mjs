#!/usr/bin/env node

import fs from "fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function mustContain(label, text, needle) {
  if (text.includes(needle)) {
    pass(`${label}: found ${needle}`);
  } else {
    fail(`${label}: missing ${needle}`);
  }
}

function mustNotContain(label, text, needle) {
  if (!text.includes(needle)) {
    pass(`${label}: does not contain ${needle}`);
  } else {
    fail(`${label}: unexpectedly contains ${needle}`);
  }
}

console.log("=== VERIFY ATTORNEY FEE BREAKDOWN DOCX ROUTE SAFETY ===");

const attorneyFeeRoute = read("app/api/settlements/attorney-fee-breakdown/route.ts");
const previewRoute = read("app/api/settlements/documents-preview/route.ts");
const templateRegistry = read("lib/documents/templateRegistry.ts");
const packageJson = read("package.json");
const verifyProd = read("scripts/verify-prod.sh");

console.log("");
console.log("=== VERIFY ROUTE-ONLY DOCX GENERATION ===");
mustContain("attorney fee route", attorneyFeeRoute, 'action: "attorney-fee-breakdown-docx"');
mustContain("attorney fee route", attorneyFeeRoute, "generatedDocxResponseOnly: true");
mustContain("attorney fee route", attorneyFeeRoute, "routeOnly: true");
mustContain("attorney fee route", attorneyFeeRoute, "Packer.toBuffer(doc)");
mustContain("attorney fee route", attorneyFeeRoute, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
mustContain("attorney fee route", attorneyFeeRoute, "Content-Disposition");
mustContain("attorney fee route", attorneyFeeRoute, 'if (base.toLowerCase().endsWith(".docx")) return base;');
mustContain("attorney fee route", attorneyFeeRoute, "return `${base}.docx`;");
mustContain("attorney fee route", attorneyFeeRoute, "/api/settlements/documents-preview");
mustContain("attorney fee route", attorneyFeeRoute, 'method: "GET"');
mustContain("attorney fee route", attorneyFeeRoute, 'cache: "no-store"');

console.log("");
console.log("=== VERIFY NO CLIO / DATABASE / FILE / PRINT QUEUE MUTATION ===");
mustContain("attorney fee route", attorneyFeeRoute, "noClioRecordsChanged: true");
mustContain("attorney fee route", attorneyFeeRoute, "noDatabaseRecordsChanged: true");
mustContain("attorney fee route", attorneyFeeRoute, "noDocumentUploadPerformed: true");
mustContain("attorney fee route", attorneyFeeRoute, "noPrintQueueRecordsChanged: true");
mustContain("attorney fee route", attorneyFeeRoute, "noPersistentFilesCreated: true");
mustNotContain("attorney fee route", attorneyFeeRoute, "clioFetch(");
mustNotContain("attorney fee route", attorneyFeeRoute, "uploadBufferToClioMatterDocuments");
mustNotContain("attorney fee route", attorneyFeeRoute, "listClioMatterDocuments");
mustNotContain("attorney fee route", attorneyFeeRoute, "prisma.");
mustNotContain("attorney fee route", attorneyFeeRoute, ".create(");
mustNotContain("attorney fee route", attorneyFeeRoute, ".update(");
mustNotContain("attorney fee route", attorneyFeeRoute, ".delete(");
mustNotContain("attorney fee route", attorneyFeeRoute, "writeFile");
mustNotContain("attorney fee route", attorneyFeeRoute, "appendFile");
mustNotContain("attorney fee route", attorneyFeeRoute, "mkdir(");
mustNotContain("attorney fee route", attorneyFeeRoute, "printQueue");
mustNotContain("attorney fee route", attorneyFeeRoute, 'method: "PATCH"');
mustNotContain("attorney fee route", attorneyFeeRoute, 'method: "POST"');
mustNotContain("attorney fee route", attorneyFeeRoute, 'method: "DELETE"');

console.log("");
console.log("=== VERIFY TEMPLATE REGISTRY ADVERTISES ROUTE-ONLY SETTLEMENT DOCX OPTIONS ===");
mustContain("template registry", templateRegistry, "buildSettlementPlannedDocuments");
mustContain("template registry", templateRegistry, "Settlement Summary");
mustContain("template registry", templateRegistry, "Provider Remittance Breakdown");
mustContain("template registry", templateRegistry, "Attorney Fee Breakdown");
mustContain("template registry", templateRegistry, 'generationEndpoint: "/api/settlements/settlement-summary"');
mustContain("template registry", templateRegistry, 'generationEndpoint: "/api/settlements/provider-remittance-breakdown"');
mustContain("template registry", templateRegistry, 'generationEndpoint: "/api/settlements/attorney-fee-breakdown"');
mustContain("template registry", templateRegistry, "routeOnly: true");

console.log("");
console.log("=== VERIFY DOCUMENTS PREVIEW ROUTE DELEGATES PLANNED DOCUMENTS TO TEMPLATE REGISTRY ===");
mustContain("settlement documents preview route", previewRoute, "buildSettlementPlannedDocuments");
mustContain("settlement documents preview route", previewRoute, "plannedDocuments");
mustContain("settlement documents preview route", previewRoute, 'action: "settlement-documents-preview"');
mustContain("settlement documents preview route", previewRoute, "previewOnly: true");
mustContain("settlement documents preview route", previewRoute, "readOnly: true");
mustContain("settlement documents preview route", previewRoute, "documentsGenerated: false");
mustContain("settlement documents preview route", previewRoute, "persistentFilesCreated: false");
mustContain("settlement documents preview route", previewRoute, "printQueueChanged: false");
mustNotContain("settlement documents preview route", previewRoute, "/api/settlements/current-values");
mustNotContain("settlement documents preview route", previewRoute, "live-clio-read");
mustNotContain("settlement documents preview route", previewRoute, "clioFetch(");
mustNotContain("settlement documents preview route", previewRoute, "MATTER_CF.");

console.log("");
console.log("=== VERIFY SCRIPT REGISTRATION ===");
mustContain("package.json", packageJson, "verify:attorney-fee-docx-safety");
mustContain("verify-prod.sh", verifyProd, "verify:attorney-fee-docx-safety");

if (process.exitCode) {
  console.error("");
  console.error("=== ATTORNEY FEE BREAKDOWN DOCX SAFETY VERIFICATION FAILED ===");
  process.exit(process.exitCode);
}

console.log("");
console.log("=== ATTORNEY FEE BREAKDOWN DOCX SAFETY VERIFICATION PASSED ===");
console.log("No Clio records were changed by this verifier.");
console.log("No database writes were made by this verifier.");
console.log("No documents were uploaded by this verifier.");
console.log("No persistent files were created by this verifier.");
console.log("No print queue records were changed by this verifier.");
