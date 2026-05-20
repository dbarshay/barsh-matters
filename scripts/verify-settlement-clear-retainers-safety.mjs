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
  "function clearMasterSettlementEntryFields()",
  "currentPrincipalRetainer",
  "currentInterestRetainer",
  "currentProviderDefaults",
  "setMasterSettlementPrincipalFeePercentInput(currentPrincipalRetainer)",
  "setMasterSettlementInterestFeePercentInput(currentInterestRetainer)",
  "setMasterSettlementProviderFeeDefaults(currentProviderDefaults)",
  "void loadMasterSettlementProviderFeeDefaults()",
  "data-barsh-settlement-clear-retainers-marker",
]) {
  if (!text.includes(marker)) fail(`${pagePath} missing marker: ${marker}`);
}

const clearIndex = text.indexOf("function clearMasterSettlementEntryFields()");
const resetIndex = text.indexOf("function resetMasterSettlementPreviewForm()");
const clearWindow = clearIndex >= 0 && resetIndex > clearIndex ? text.slice(clearIndex, resetIndex) : "";

for (const forbidden of [
  'setMasterSettlementPrincipalFeePercentInput("");',
  'setMasterSettlementInterestFeePercentInput("");',
  "setMasterSettlementProviderFeeDefaults(null);",
]) {
  if (clearWindow.includes(forbidden)) fail(`Clear function should not contain ${forbidden}`);
}

if (!pkg.includes("verify:settlement-clear-retainers-safety")) {
  fail(`${pkgPath} missing verify:settlement-clear-retainers-safety script`);
}

if (!process.exitCode) {
  pass("settlement Clear preserves and reloads provider retainer defaults");
}
