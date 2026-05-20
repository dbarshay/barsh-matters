#!/usr/bin/env node
import fs from "node:fs";

const routePath = "app/api/settlements/local-history/route.ts";
const pkgPath = "package.json";

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

const route = fs.existsSync(routePath) ? fs.readFileSync(routePath, "utf8") : "";
const pkg = fs.existsSync(pkgPath) ? fs.readFileSync(pkgPath, "utf8") : "";

if (!route) fail(`${routePath} missing`);

const requiredRouteText = [
  'action: "local-settlement-history"',
  'sourceOfTruth: "barsh-matters-local"',
  "prisma.localSettlementRecord.findMany",
  "LocalSettlementRecord",
  "LocalSettlementRow",
  "readOnly: true",
  "clioRecordsChanged: false",
  "databaseRecordsChanged: false",
  "documentsGenerated: false",
  "printQueueChanged: false",
  "mattersClosed: false",
  "settlementWritebackPerformed: false",
];

for (const text of requiredRouteText) {
  if (!route.includes(text)) fail(`${routePath} missing ${text}`);
}

const forbiddenRouteText = [
  "fetch(",
  "clioDocumentUpload",
  "uploadFinalDocumentsToClio",
  "prisma.localSettlementRecord.create",
  "prisma.localSettlementRecord.update",
  "prisma.localSettlementRecord.delete",
  "prisma.localSettlementRow.create",
  "prisma.localSettlementRow.update",
  "prisma.localSettlementRow.delete",
  "printQueue.create",
  "matter.update",
];

for (const text of forbiddenRouteText) {
  if (route.includes(text)) fail(`${routePath} contains forbidden write/side-effect marker: ${text}`);
}

if (!pkg.includes("verify:local-settlement-history-safety")) {
  fail(`${pkgPath} missing verify:local-settlement-history-safety script`);
}

if (!process.exitCode) {
  pass("local settlement history route is read-only, local-first, and side-effect safe");
}
