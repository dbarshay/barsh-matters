import fs from "node:fs";

let failures = 0;

function read(path) {
  try {
    return fs.readFileSync(path, "utf8");
  } catch {
    console.error(`FAIL ${path}: missing file`);
    failures += 1;
    return "";
  }
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

const pagePath = "app/matters/page.tsx";
const packagePath = "package.json";

const page = read(pagePath);
const packageJson = read(packagePath);

console.log("=== DOCUMENT DELIVERY PREVIEW UI SAFETY VERIFICATION ===");

console.log("\n=== VERIFY NEW IN-POPUP DOCUMENT DELIVERY PREVIEW PANEL ===");
[
  "data-barsh-document-delivery-preview-panel",
  "Document Delivery",
  "Preview only.  No Outlook draft is created unless Create Outlook Draft is clicked.",
  "Create Outlook Draft",
  "Open Outlook Draft in Web",
  "Outlook desktop app's Drafts folder",
  "To recipient override",
  "Enter a valid email address such as name@example.com",
  "Enter a valid email address before creating an Outlook draft.",
  "Graph draft creation available",
  "Safety flags",
  "Creates Outlook draft from preview alone: No",
  "Sends email: No",
  "Writes Clio: No",
  "Uploads document: No",
  "Prints or queues document: No",
  "MailDrop in Cc only",
].forEach((needle) => mustContain(pagePath, page, needle));

console.log("\n=== VERIFY EMAIL DOCUMENT ACTION USES PREVIEW PANEL, NOT BROWSER ALERT ===");
[
  "masterDocumentDeliveryPreview",
  "setMasterDocumentDeliveryPreview",
  "masterDocumentDeliveryPreviewLoading",
  "masterDocumentDraftCreateLoading",
  "masterDocumentDeliveryToOverride",
  "launchMasterDocumentEmail",
  "/api/documents/delivery-draft-preview",
  "/api/graph/create-draft?confirm=create-graph-draft",
  "isValidDocumentDeliveryEmail",
  "isDocumentDeliveryReadyForGraphDraft",
  "buildDocumentDeliveryToOverrideRecipient",
  "displayedWarnings",
  "text.includes(\"No To recipient\")",
].forEach((needle) => mustContain(pagePath, page, needle));

console.log("\n=== VERIFY REMOVED LEGACY ALERT COPY IS NOT REQUIRED / NOT PRESENT ===");
[
  "Document Email Draft Preview Only",
  "Ready for future Graph draft creation",
].forEach((needle) => mustNotContain(pagePath, page, needle));

console.log("\n=== VERIFY NO MAILTO FALLBACK OR SENDMAIL WIRING IN DELIVERY PANEL ===");
[
  "window.location.href = buildMailtoHref(context);",
  "sendMail",
  "/sendMail",
].forEach((needle) => mustNotContain(pagePath, page, needle));

console.log("\n=== VERIFY SCRIPT REGISTRATION ===");
mustContain("package.json", packageJson, '"verify:document-delivery-preview-ui-safety"');

if (failures > 0) {
  console.error(`=== DOCUMENT DELIVERY PREVIEW UI SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== DOCUMENT DELIVERY PREVIEW UI SAFETY PASSED ===");
