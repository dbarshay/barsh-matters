#!/usr/bin/env node
import fs from "node:fs";

const pagePath = "app/matters/page.tsx";
const pkgPath = "package.json";
const text = fs.existsSync(pagePath) ? fs.readFileSync(pagePath, "utf8") : "";
const pkg = fs.existsSync(pkgPath) ? fs.readFileSync(pkgPath, "utf8") : "";

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

for (const marker of [
  "Calculate Settlement",
  "Commit Settlement",
  "Record Settlement",
  "function masterSettlementCanCommit()",
  "masterSettlementLocalPreview?.ok",
  "masterSettlementLocalPreview?.settlementRecordPayload",
  "commitMasterSettlementAndLaunchDocuments",
  "data-barsh-settlement-calculate-commit-marker",
]) {
  if (!text.includes(marker)) fail(`${pagePath} missing marker: ${marker}`);
}

for (const forbidden of [
  "Preview Local Settlement",
  "Save Local Settlement",
  "Record Local Settlement",
]) {
  if (text.includes(forbidden)) fail(`${pagePath} still contains forbidden label: ${forbidden}`);
}

if (!pkg.includes("verify:settlement-calculate-commit-labels-safety")) {
  fail(`${pkgPath} missing verify:settlement-calculate-commit-labels-safety script`);
}

if (!process.exitCode) {
  pass("settlement popup uses Calculate Settlement before Commit Settlement");
}
