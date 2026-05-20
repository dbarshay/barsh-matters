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
  "data-barsh-settlement-commit-button-green-marker",
  "function masterSettlementCommitButtonStyle()",
  "const canCommit = masterSettlementCanCommit();",
  "Commit Settlement",
  "masterSettlementCanCommit",
  "#16a34a",
  "#15803d",
  "#ffffff",
  "...masterSettlementCommitButtonStyle()",
]) {
  if (!text.includes(marker)) fail(`${pagePath} missing marker: ${marker}`);
}

const labelAnchor = '{masterSettlementRecordSaveLoading ? "Committing..." : "Commit Settlement"}';
const idx = text.indexOf(labelAnchor);
if (idx < 0) {
  fail("actual Commit Settlement button label expression not found");
}

const start = idx >= 0 ? text.lastIndexOf("<button", idx) : -1;
const end = idx >= 0 ? text.indexOf("</button>", idx) : -1;
const buttonBlock = start >= 0 && end >= 0 ? text.slice(start, end + "</button>".length) : "";

if (!buttonBlock.includes("commitMasterSettlementAndLaunchDocuments")) {
  fail("actual Commit Settlement button does not call commitMasterSettlementAndLaunchDocuments");
}

if (!buttonBlock.includes("...masterSettlementCommitButtonStyle()")) {
  fail("actual Commit Settlement button does not spread masterSettlementCommitButtonStyle()");
}

if (text.includes("const masterSettlementCommitButtonStyle: React.CSSProperties =")) {
  fail("Commit button style must be a lazy function, not an eager const object");
}

if (!pkg.includes("verify:settlement-commit-button-green-safety")) {
  fail(`${pkgPath} missing verify:settlement-commit-button-green-safety script`);
}

if (!process.exitCode) {
  pass("actual Commit Settlement button uses solid green primary action styling");
}
