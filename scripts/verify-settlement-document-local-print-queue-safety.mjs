import fs from "node:fs";

const failures = [];

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function mustInclude(path, needle, label = needle) {
  const text = read(path);
  if (!text.includes(needle)) failures.push(`${path}: missing ${label}`);
}

function mustNotInclude(path, needle, label = needle) {
  const text = read(path);
  if (text.includes(needle)) failures.push(`${path}: forbidden ${label}`);
}

const routePath = "app/api/settlements/documents-print-queue-local/route.ts";
const pagePath = "app/matters/page.tsx";

if (!fs.existsSync(routePath)) {
  failures.push(`${routePath}: missing route`);
} else {
  mustInclude(routePath, "settlement-document-print-queue-local");
  mustInclude(routePath, "prisma.documentFinalization.findUnique");
  mustInclude(routePath, "local-settlement-finalized-placeholder");
  mustInclude(routePath, "prisma.documentPrintQueueItem.findUnique");
  mustInclude(routePath, "prisma.documentPrintQueueItem.create");
  mustInclude(routePath, "uniqueQueueKey");
  mustInclude(routePath, "noPdfPretended: true");
  mustInclude(routePath, "finalizedPdfGenerated: false");
  mustInclude(routePath, "persistentFileCreated: false");
  mustInclude(routePath, "clioRecordsChanged: false");
  mustInclude(routePath, "clioDocumentsUploaded: false");
  mustInclude(routePath, "emailsSent: false");
  mustInclude(routePath, "outlookDraftsCreated: false");
  mustNotInclude(routePath, "uploadDocumentToClio", "Clio document upload");
  mustNotInclude(routePath, "graphFetchJson", "Graph draft call");
  mustNotInclude(routePath, "fs.writeFile", "persistent filesystem write");
}

mustInclude(pagePath, "masterDocumentPrintQueueLoading");
mustInclude(pagePath, "masterDocumentPrintQueueResult");
mustInclude(pagePath, "/api/settlements/documents-print-queue-local");
mustInclude(pagePath, "confirmAdd: true");
mustInclude(pagePath, "Sent to Print Queue");
mustInclude(pagePath, "No PDF was generated, no Clio upload occurred, no Outlook draft was created, and no email was sent.");

if (failures.length) {
  console.error("FAIL: settlement document local print queue safety verifier");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("PASS: settlement document local print queue safety verifier");
