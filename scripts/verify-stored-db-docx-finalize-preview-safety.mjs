import fs from "fs";

const route = fs.readFileSync("app/api/documents/finalize-preview/route.ts", "utf8");

const required = [
  'import { prisma } from "@/lib/prisma";',
  "async function buildStoredDbDocxTemplateDocuments",
  "prisma.documentTemplate.findMany",
  'currentVersion?.storageKind === "db-docx-base64"',
  "Boolean(currentVersion?.contentText)",
  "/api/documents/templates/stored-docx?versionId=",
  'templateSource: "barsh-matters-db-template-repository"',
  'repositoryStatus: "stored-db-docx-template"',
  "storedTemplateVersionId",
  "hasStoredDocx: true",
  "const plannedDocuments = (await buildDocumentPlan",
  "...storedDbTemplateDocuments",
  "...placeholderDocuments",
  "document is NonNullable<typeof document>",
];

const forbidden = [
  "documentTemplate.create",
  "documentTemplate.update",
  "documentTemplate.upsert",
  "documentTemplateVersion.create",
  "documentTemplateVersion.update",
  "documentPrintQueueItem.create",
  "sendMail",
  "graph.microsoft.com",
];

const failures = [];

for (const marker of required) {
  if (!route.includes(marker)) failures.push(`missing required marker: ${marker}`);
}

for (const marker of forbidden) {
  if (route.includes(marker)) failures.push(`forbidden marker present: ${marker}`);
}

if (failures.length) {
  console.error("FAIL: stored DB DOCX finalize-preview safety verifier failed");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("PASS: finalize-preview appends stored DB DOCX templates as read-only planned documents while preserving placeholder fallback.");
