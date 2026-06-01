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
    fail(`${label}: must not contain ${needle}`);
  }
}

function mustContainAny(label, text, needles) {
  if (needles.some((needle) => text.includes(needle))) {
    pass(`${label}: found one of ${needles.join(" | ")}`);
  } else {
    fail(`${label}: missing one of ${needles.join(" | ")}`);
  }
}

console.log("=== DOCUMENT DELIVERY DRAFT PREVIEW SAFETY VERIFICATION ===");

const pagePath = "app/matters/page.tsx";
const routePath = "app/api/documents/delivery-draft-preview/route.ts";
const graphDraftRoutePath = "app/api/graph/create-draft/route.ts";
const packagePath = "package.json";

const page = read(pagePath);
const route = read(routePath);
const graphDraftRoute = read(graphDraftRoutePath);
const packageJson = read(packagePath);

console.log("");
console.log("=== VERIFY MASTER DOCUMENT DELIVERY UI MARKERS ===");

[
  "masterDocumentDeliveryPreview",
  "data-barsh-document-delivery-preview-panel",
  "Document Delivery",
  "Create Outlook Draft",
  "Open Outlook Draft in Web",
  "Outlook desktop app's Drafts folder",
  "masterDocumentDeliveryToOverride",
  "To recipient override",
  "buildDocumentDeliveryToOverrideRecipient",
  "isValidDocumentDeliveryEmail",
  "manualToOverrideIsValid",
  "displayedWarnings",
  'text.includes("No To recipient")',
  "name@example.com",
  "Enter a valid email address before creating an Outlook draft.",
  "graphDraftPayloadPreview",
  "readDocumentDeliveryGraphPreview",
  "isDocumentDeliveryReadyForGraphDraft",
  "const readyForGraphDraftCreate = isDocumentDeliveryReadyForGraphDraft(previewState)",
  "setMasterDocumentDeliveryPreview",
  "/api/documents/delivery-draft-preview",
  "/api/graph/create-draft?confirm=create-graph-draft",
].forEach((marker) => mustContain(pagePath, page, marker));

console.log("");
console.log("=== VERIFY CURRENT TO-OVERRIDE GRAPH PAYLOAD HANDLING ===");

[
  "const graphDraftPayloadPreview = readDocumentDeliveryGraphPreview(previewState)",
  "buildDocumentDeliveryToOverrideRecipient",
  "manualToOverrideIsValid",
  "masterDocumentDeliveryToOverride.trim()",
  "graphDraftPayloadPreview,",
].forEach((marker) => mustContain(pagePath, page, marker));

mustNotContain(pagePath, page, "Document Email Draft Preview Only");

console.log("");
console.log("=== VERIFY DELIVERY DRAFT PREVIEW ROUTE IS PREVIEW-ONLY ===");

[
  "export async function POST",
  'action: "document-delivery-draft-preview"',
  "previewOnly: true",
  "buildGraphDraftPayloadPreview",
  "graphDraftPayloadPreview",
  "readyForGraphDraftCreate",
  "createsOutlookDraft: false",
  "sendsEmail: false",
  "printQueueChanged: false",
  "clioRecordsChanged: false",
  "databaseRecordsChanged: false",
  "attachesDocument: false",
  "settlementFinalizedPdfDelivery",
].forEach((marker) => mustContain(routePath, route, marker));


mustContain(routePath, route, "previewOnly: true");
mustContain(routePath, route, "createsOutlookDraft: false");
mustContain(routePath, route, "sendsEmail: false");
mustContain(routePath, route, "attachesDocument: false");

[
  'method: "PATCH"',
  'method: "DELETE"',
  "sendMail",
  "messages/send",
  ".create(",
  ".update(",
  ".delete(",
].forEach((marker) => mustNotContain(routePath, route, marker));

console.log("");
console.log("=== VERIFY GRAPH DRAFT CREATION REMAINS EXPLICITLY CONFIRMED / FAIL-CLOSED ===");

[
  'const REQUIRED_CONFIRMATION = "create-graph-draft"',
  "confirm=create-graph-draft",
  "Fail-closed Graph draft creation route.",
].forEach((marker) => mustContain(graphDraftRoutePath, graphDraftRoute, marker));

console.log("");
console.log("=== VERIFY SCRIPT REGISTRATION ===");

mustContain(packagePath, packageJson, "verify:document-delivery-draft-preview-safety");

if (failures > 0) {
  console.error(`\n=== DOCUMENT DELIVERY DRAFT PREVIEW SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("");
console.log("=== DOCUMENT DELIVERY DRAFT PREVIEW SAFETY VERIFICATION PASSED ===");
console.log("Delivery draft preview remains preview-only.");
console.log("Graph draft creation remains explicitly confirmed and routed through the fail-closed create-draft endpoint.");
console.log("The verifier no longer treats unrelated alerts in the large master matters page as delivery-draft-preview failures.");
