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

console.log("=== VERIFY PROVIDER REMITTANCE BREAKDOWN DOCX ROUTE SAFETY ===");

const providerRemittanceRoute = read("app/api/settlements/provider-remittance-breakdown/route.ts");
const previewRoute = read("app/api/settlements/documents-preview/route.ts");
const templateRegistry = read("lib/documents/templateRegistry.ts");
const packageJson = read("package.json");
const verifyProd = read("scripts/verify-prod.sh");

console.log("");
console.log("=== VERIFY ROUTE-ONLY DOCX GENERATION ===");
mustContain("provider remittance route", providerRemittanceRoute, 'action: "provider-remittance-breakdown-docx"');
mustContain("provider remittance route", providerRemittanceRoute, "generatedDocxResponseOnly: true");
mustContain("provider remittance route", providerRemittanceRoute, "routeOnly: true");
mustContain("provider remittance route", providerRemittanceRoute, "Packer.toBuffer(doc)");
mustContain("provider remittance route", providerRemittanceRoute, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
mustContain("provider remittance route", providerRemittanceRoute, "Content-Disposition");
mustContain("provider remittance route", providerRemittanceRoute, 'if (base.toLowerCase().endsWith(".docx")) return base;');
mustContain("provider remittance route", providerRemittanceRoute, "return `${base}.docx`;");
mustContain("provider remittance route", providerRemittanceRoute, "/api/settlements/documents-preview");
mustContain("provider remittance route", providerRemittanceRoute, 'method: "GET"');
mustContain("provider remittance route", providerRemittanceRoute, 'cache: "no-store"');

console.log("");
console.log("=== VERIFY NO CLIO / DATABASE / FILE / PRINT QUEUE MUTATION ===");
mustContain("provider remittance route", providerRemittanceRoute, "noClioRecordsChanged: true");
mustContain("provider remittance route", providerRemittanceRoute, "noDatabaseRecordsChanged: true");
mustContain("provider remittance route", providerRemittanceRoute, "noDocumentUploadPerformed: true");
mustContain("provider remittance route", providerRemittanceRoute, "noPrintQueueRecordsChanged: true");
mustContain("provider remittance route", providerRemittanceRoute, "noPersistentFilesCreated: true");
mustNotContain("provider remittance route", providerRemittanceRoute, "clioFetch(");
mustNotContain("provider remittance route", providerRemittanceRoute, "uploadBufferToClioMatterDocuments");
mustNotContain("provider remittance route", providerRemittanceRoute, "listClioMatterDocuments");
mustNotContain("provider remittance route", providerRemittanceRoute, "prisma.");
mustNotContain("provider remittance route", providerRemittanceRoute, ".create(");
mustNotContain("provider remittance route", providerRemittanceRoute, ".update(");
mustNotContain("provider remittance route", providerRemittanceRoute, ".delete(");
mustNotContain("provider remittance route", providerRemittanceRoute, "writeFile");
mustNotContain("provider remittance route", providerRemittanceRoute, "appendFile");
mustNotContain("provider remittance route", providerRemittanceRoute, "mkdir(");
mustNotContain("provider remittance route", providerRemittanceRoute, "printQueue");
mustNotContain("provider remittance route", providerRemittanceRoute, 'method: "PATCH"');
mustNotContain("provider remittance route", providerRemittanceRoute, 'method: "POST"');
mustNotContain("provider remittance route", providerRemittanceRoute, 'method: "DELETE"');

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
mustContain("package.json", packageJson, "verify:provider-remittance-docx-safety");
mustContain("verify-prod.sh", verifyProd, "verify:provider-remittance-docx-safety");

if (process.exitCode) {
  console.error("");
  console.error("=== PROVIDER REMITTANCE BREAKDOWN DOCX SAFETY VERIFICATION FAILED ===");
  process.exit(process.exitCode);
}

console.log("");
console.log("=== PROVIDER REMITTANCE BREAKDOWN DOCX SAFETY VERIFICATION PASSED ===");
console.log("No Clio records were changed by this verifier.");
console.log("No database writes were made by this verifier.");
console.log("No documents were uploaded by this verifier.");
console.log("No persistent files were created by this verifier.");
console.log("No print queue records were changed by this verifier.");
