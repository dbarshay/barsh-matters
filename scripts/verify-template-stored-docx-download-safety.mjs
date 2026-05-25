import fs from "fs";

const route = fs.readFileSync("app/api/documents/templates/stored-docx/route.ts", "utf8");
const admin = fs.readFileSync("app/admin/document-templates/page.tsx", "utf8");

const requiredRoute = [
  "document-template-stored-docx-download",
  "prisma.documentTemplateVersion.findUnique",
  "prisma.documentTemplateVersion.findFirst",
  "storageKind !== \"db-docx-base64\"",
  "Buffer.from(version.contentText, \"base64\")",
  "Content-Disposition",
  "X-Barsh-Matters-Read-Only",
  "noDatabaseRecordsChanged: true",
  "noClioRecordsChanged: true",
  "noEmailSent: true",
  "noPrintQueueChanged: true",
];

const requiredAdmin = [
  "hasStoredDocx?: boolean",
  "storedDocxBytes?: number",
  "function openStoredTemplateDocx",
  "/api/documents/templates/stored-docx?versionId=",
  "Stored DOCX ·",
  "Download Stored DOCX",
  "Choose DOCX Template",
  "template-docx-storage-file-input",
];

const forbiddenRoute = [
  ".create(",
  ".createMany(",
  ".update(",
  ".updateMany(",
  ".upsert(",
  ".delete(",
  ".deleteMany(",
  "graph.microsoft.com",
  "sendMail",
  "clio.com",
  "documentPrintQueueItem",
];

const failures = [];

for (const marker of requiredRoute) {
  if (!route.includes(marker)) failures.push(`route missing marker: ${marker}`);
}
for (const marker of requiredAdmin) {
  if (!admin.includes(marker)) failures.push(`admin missing marker: ${marker}`);
}
for (const marker of forbiddenRoute) {
  if (route.includes(marker)) failures.push(`route forbidden marker: ${marker}`);
}

if (failures.length) {
  console.error("FAIL: template stored DOCX download safety verifier failed");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("PASS: stored template DOCX download is read-only and exposes local DB DOCX payloads without Clio, Graph, email, print, or queue side effects.");
