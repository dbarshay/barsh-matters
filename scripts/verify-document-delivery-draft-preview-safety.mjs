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
const pagePath = "app/matters/page.tsx";

const route = read(routePath);
const helper = read(helperPath);
const packageJson = read(packagePath);
const page = read(pagePath);

console.log("=== DOCUMENT DELIVERY DRAFT PREVIEW SAFETY VERIFICATION ===");

const launchStart = page.indexOf("async function launchMasterDocumentEmail");
const printStart = page.indexOf("function launchMasterDocumentPrint", launchStart);
const launchFunction = launchStart >= 0 && printStart > launchStart ? page.slice(launchStart, printStart) : "";

mustContain(pagePath, page, "masterDocumentDeliveryPreview");
mustContain(pagePath, page, "data-barsh-document-delivery-preview-panel");
mustContain(pagePath, page, "Document Delivery Preview");
mustContain(pagePath, page, "Create Outlook Draft");
mustContain(pagePath, page, "Open Outlook Draft in Web");
mustContain(pagePath, page, "Outlook desktop app's Drafts folder");
mustContain(pagePath, page, "masterDocumentDeliveryToOverride");
mustContain(pagePath, page, "To recipient override");
mustContain(pagePath, page, "buildDocumentDeliveryToOverrideRecipient");
mustContain(pagePath, page, "isValidDocumentDeliveryEmail");
mustContain(pagePath, page, "manualToOverrideIsValid");
mustContain(pagePath, page, "displayedWarnings");
mustContain(pagePath, page, "text.includes(\"No To recipient\")");
mustContain(pagePath, page, "name@example.com");
mustContain(pagePath, page, "Enter a valid email address before creating an Outlook draft.");
mustContain(pagePath, page, "masterDocumentDeliveryToOverride.trim()\n            ? {}\n            : { graphDraftPayloadPreview: readDocumentDeliveryGraphPreview(previewState) }");
mustContain(pagePath, page, "const maildropReady = Boolean(validation?.maildropInCcOnly || validation?.hasMaildropCc)");
mustContain(pagePath, page, "maildropDisplay");
mustContain(pagePath, page, "/api/documents/delivery-draft-preview");
mustContain(pagePath, page, "/api/graph/create-draft?confirm=create-graph-draft");
mustContain(pagePath, page, "allowMetadataOnlyDraft");
mustContain(pagePath, page, "readDocumentDeliveryGraphPreview");
mustContain(pagePath, page, "isDocumentDeliveryReadyForGraphDraft");
mustContain(pagePath, page, "const readyForGraphDraftCreate = isDocumentDeliveryReadyForGraphDraft(previewState)");
mustContain(pagePath, launchFunction, "setMasterDocumentDeliveryPreview");
mustContain(pagePath, launchFunction, "/api/documents/delivery-draft-preview");
mustNotContain(pagePath, launchFunction, "alert(");
mustNotContain(pagePath, page, "Document Email Draft Preview Only");

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
mustContain(routePath, route, "attachments: attachmentCandidates as any[]");
mustContain(routePath, route, "bcc: bcc as any[]");
mustContain(routePath, route, "cc: cc as any[]");
mustContain(routePath, route, "to: to as any[]");
mustContain(routePath, route, "clioMaildropLabel: graphContext.clioMaildropLabel");
mustContain(routePath, route, "clioMaildropEmail: graphContext.clioMaildropEmail");
mustContain(routePath, route, "graphDraftPayloadPreview");
mustContain(routePath, route, "buildGraphDraftPayloadPreview");
mustContain(routePath, route, "const graphContext = context as any");
mustContain(routePath, route, "buildDocumentEmailSubject");
mustContain(routePath, route, "buildDocumentEmailBody");

mustNotContain(routePath, route, "fetch(");
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
