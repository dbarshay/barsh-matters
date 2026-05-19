#!/usr/bin/env node
import fs from "fs";

const verifyProdPath = "scripts/verify-prod.sh";
const packagePath = "package.json";

const verifyProd = fs.readFileSync(verifyProdPath, "utf8");
const pkg = fs.readFileSync(packagePath, "utf8");

function mustContain(label, text, marker) {
  if (!text.includes(marker)) {
    console.error(`FAIL: ${label} missing marker: ${marker}`);
    process.exit(1);
  }
  console.log(`PASS: ${label} found ${marker}`);
}

console.log("=== VERIFY PROD EMAIL THREAD COVERAGE SAFETY ===");

[
  "verify:direct-matter-email-thread-ui-safety",
  "verify:master-email-thread-ui-safety",
  "verify:graph-thread-sync-preview-safety",
  "verify:graph-thread-sync-persistence-safety",
].forEach((marker) => mustContain(verifyProdPath, verifyProd, marker));

mustContain(packagePath, pkg, "verify:direct-matter-email-thread-ui-safety");
mustContain(packagePath, pkg, "verify:master-email-thread-ui-safety");
mustContain(packagePath, pkg, "verify:graph-thread-sync-preview-safety");
mustContain(packagePath, pkg, "verify:graph-thread-sync-persistence-safety");
mustContain(packagePath, pkg, "verify:prod-email-thread-coverage-safety");

console.log("=== VERIFY PROD EMAIL THREAD COVERAGE SAFETY PASSED ===");
console.log("verify:prod now runs Direct Matter email thread UI, Master email thread UI, Graph preview, and Graph sync persistence safety verifiers.");
