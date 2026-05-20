#!/usr/bin/env node
import fs from "node:fs";

const routePath = "app/api/settlements/documents-preview/route.ts";
const pkgPath = "package.json";

const route = fs.existsSync(routePath) ? fs.readFileSync(routePath, "utf8") : "";
const pkg = fs.existsSync(pkgPath) ? fs.readFileSync(pkgPath, "utf8") : "";

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

for (const marker of [
  'action: "settlement-documents-preview"',
  'sourceOfTruth: "barsh-matters-local"',
  "prisma.localSettlementRecord.findFirst",
  "settlement-summary",
  "provider-remittance-breakdown",
  "attorney-fee-breakdown",
  "canGenerateSettlementDocuments",
  "LocalSettlementRecord",
  "LocalSettlementRow",
  "clioRecordsChanged: false",
  "databaseRecordsChanged: false",
  "documentsGenerated: false",
  "printQueueChanged: false",
  "persistentFilesCreated: false",
  "mattersClosed: false",
  "emailsSent: false",
  "settlementWritebackPerformed: false",
]) {
  if (!route.includes(marker)) fail(`${routePath} missing marker: ${marker}`);
}

const forbiddenOperationalMarkers = [
  "/api/settlements/current-values",
  "currentValuesRes",
  "currentValuesJson",
  "prisma.claimIndex.findMany",
  "prisma.localSettlementRecord.create",
  "prisma.localSettlementRecord.update",
  "prisma.localSettlementRow.create",
  "prisma.localSettlementRow.update",
  "documentsGenerated: true",
  "printQueueChanged: true",
  "emailsSent: true",
  "clioRecordsChanged: true",
  "settlementWritebackPerformed: true",
];

for (const forbidden of forbiddenOperationalMarkers) {
  if (route.includes(forbidden)) fail(`${routePath} contains forbidden operational marker: ${forbidden}`);
}

if (/fetch\s*\(/.test(route)) {
  fail(`${routePath} contains forbidden fetch call`);
}

if (/prisma\.(?!localSettlementRecord\b)/.test(route)) {
  fail(`${routePath} contains a prisma model other than localSettlementRecord`);
}

if (!pkg.includes("verify:local-settlement-documents-preview-safety")) {
  fail(`${pkgPath} missing verify:local-settlement-documents-preview-safety script`);
}

if (!process.exitCode) {
  pass("local settlement documents preview is local-first and side-effect safe");
}
