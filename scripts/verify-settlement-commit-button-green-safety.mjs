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
]) {
  if (!text.includes(marker)) fail(`${pagePath} missing marker: ${marker}`);
}

if (text.includes("const masterSettlementCommitButtonStyle: React.CSSProperties =")) {
  fail("Commit button style must be a lazy function, not an eager const object");
}

if (!pkg.includes("verify:settlement-commit-button-green-safety")) {
  fail(`${pkgPath} missing verify:settlement-commit-button-green-safety script`);
}

if (!process.exitCode) {
  pass("Commit Settlement button has lazy solid green primary action style markers");
}
