import fs from "fs";

const page = fs.readFileSync("app/matters/page.tsx", "utf8");

const required = [
  "masterDocumentHistoryPopupOpen",
  "masterDocumentHistoryLoading",
  "masterDocumentHistoryError",
  "masterDocumentHistoryResult",
  "function openMasterDocumentHistoryPopup()",
  "function closeMasterDocumentHistoryPopup()",
  "function renderMasterDocumentHistoryPopup()",
  "Document Activity",
  "/api/documents/finalization-history?masterLawsuitId=",
  "{renderMasterDocumentHistoryPopup()}",
];

const failures = [];

for (const marker of required) {
  if (!page.includes(marker)) failures.push(`missing required marker: ${marker}`);
}

const helperStart = page.indexOf("function renderMasterDocumentHistoryPopup()");
const helperEnd = page.indexOf("function openMasterAuditHistoryPopup()");
const helperSection = helperStart >= 0 && helperEnd > helperStart ? page.slice(helperStart, helperEnd) : "";

for (const forbidden of [
  "fetch(`/api/graph/create-draft",
  "fetch(`/api/documents/print-queue",
  "fetch(`/api/documents/finalize",
  "sendMail",
  "trackMasterAction(\"Open Master Document Activity\"",
]) {
  if (helperSection.includes(forbidden)) {
    failures.push(`forbidden marker present in history UI section: ${forbidden}`);
  }
}

const historyButtonIndex = page.indexOf("openMasterDocumentHistoryPopup()");
if (historyButtonIndex === -1) failures.push("Document Activity popup trigger not found.");

if (failures.length) {
  console.error("FAIL: master document activity UI verifier failed");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("PASS: master document activity UI is read-only and wired to the local document delivery history route.");
