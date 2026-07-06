import fs from "fs";

const page = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");

const required = [
  "matterDocumentActivityPopupOpen",
  "matterDocumentActivityLoading",
  "matterDocumentActivityError",
  "matterDocumentActivityResult",
  "function directMatterDisplayNumberForDocumentActivity()",
  "function openMatterDocumentActivityPopup()",
  "function closeMatterDocumentActivityPopup()",
  "function renderMatterDocumentActivityPopup()",
  "Document Activity",
  "/api/documents/finalization-history?matterDisplayNumber=",
  "{renderMatterDocumentActivityPopup()}",
];

const failures = [];

for (const marker of required) {
  if (!page.includes(marker)) failures.push(`missing required marker: ${marker}`);
}

const helperStart = page.indexOf("function renderMatterDocumentActivityPopup()");
const helperEnd = page.indexOf("function renderMatterClioDocumentsPanel()");
const helperSection = helperStart >= 0 && helperEnd > helperStart ? page.slice(helperStart, helperEnd) : "";

for (const forbidden of [
  "fetch(`/api/graph/create-draft",
  "fetch(`/api/documents/print-queue",
  "fetch(`/api/documents/finalize",
  "sendMail",
  "uploadFinalDocumentsToClio",
  "sendMatterDocumentToPrintQueue",
]) {
  if (helperSection.includes(forbidden)) {
    failures.push(`forbidden marker present in direct matter document activity UI section: ${forbidden}`);
  }
}

const activityButtonIndex = page.indexOf("openMatterDocumentActivityPopup()");
const viewButtonIndex = page.indexOf("Open the Direct Matter Clio document picker.");
if (activityButtonIndex === -1) failures.push("Document Activity popup trigger not found.");
if (viewButtonIndex === -1) failures.push("View Documents title not found.");

if (failures.length) {
  console.error("FAIL: direct matter document activity UI verifier failed");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("PASS: direct matter document activity UI is read-only and wired to the local document delivery history route.");
