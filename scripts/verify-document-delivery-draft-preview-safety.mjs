import fs from "node:fs";

let failures = 0;

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

function mustContain(label, text, needle) {
  if (text.includes(needle)) pass(`${label}: found ${needle}`);
  else fail(`${label}: missing ${needle}`);
}

function mustNotContain(label, text, needle) {
  if (!text.includes(needle)) pass(`${label}: does not contain ${needle}`);
  else fail(`${label}: must not contain ${needle}`);
}

const routePath = "app/api/documents/delivery-draft-preview/route.ts";
const helperPath = "lib/documents/delivery.ts";
const packagePath = "package.json";

const route = read(routePath);
const helper = read(helperPath);
const packageJson = read(packagePath);

console.log("=== DOCUMENT DELIVERY DRAFT PREVIEW SAFETY VERIFICATION ===");

mustContain(routePath, route, "export async function POST");
mustContain(routePath, route, 'action: "document-delivery-draft-preview"');
mustContain(routePath, route, "previewOnly: true");
mustContain(routePath, route, "graphReady: true");
mustContain(routePath, route, "createsOutlookDraft: false");
mustContain(routePath, route, "sendsEmail: false");
mustContain(routePath, route, "attachesDocument: false");
mustContain(routePath, route, "clioRecordsChanged: false");
mustContain(routePath, route, "databaseRecordsChanged: false");
mustContain(routePath, route, "printQueueChanged: false");
mustContain(routePath, route, "settledWithEmailRequiredForTo: true");
mustContain(routePath, route, "clioMaildropRequiredForCc: true");
mustContain(routePath, route, "finalizedPdfRequiredForAttachment: true");
mustContain(routePath, route, "microsoftGraphDraftBackendRequiredForRealAttachment: true");
mustContain(routePath, route, "buildDocumentEmailSubject");
mustContain(routePath, route, "buildDocumentEmailBody");

mustNotContain(routePath, route, "sendMail(");
mustNotContain(routePath, route, "messages.send");
mustNotContain(routePath, route, "/sendMail");
mustNotContain(routePath, route, "createUploadSession");
mustNotContain(routePath, route, "uploadBufferToClio");
mustNotContain(routePath, route, "uploadBufferToClioMatterDocuments");
mustNotContain(routePath, route, "prisma.");
mustNotContain(routePath, route, "clioFetch(");

mustContain(helperPath, helper, "DocumentDeliveryContext");
mustContain(helperPath, helper, "buildNoFaultDocumentEmailSubject");
mustContain(helperPath, helper, "buildDocumentEmailBody");
mustContain(helperPath, helper, "buildMailtoHref");

if (packageJson.includes('"verify:document-delivery-draft-preview-safety"')) {
  pass("package.json: verifier registered");
} else {
  fail("package.json: verifier not registered");
}

if (failures) {
  console.error(`=== DOCUMENT DELIVERY DRAFT PREVIEW SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== DOCUMENT DELIVERY DRAFT PREVIEW SAFETY PASSED ===");
