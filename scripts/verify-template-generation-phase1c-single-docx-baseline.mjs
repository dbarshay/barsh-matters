import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
let failed = false;
function pass(message) { console.log(`PASS: ${message}`); }
function fail(message) { failed = true; console.error(`FAIL: ${message}`); }
function exists(rel) { return fs.existsSync(path.join(root, rel)); }
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }
function absent(rel, label = rel) { exists(rel) ? fail(`${label} removed`) : pass(`${label} removed`); }
function present(rel, label = rel) { exists(rel) ? pass(`${label} present`) : fail(`${label} present`); }
function notContains(label, text, needle) { text.includes(needle) ? fail(`${label} does not contain ${needle}`) : pass(`${label} does not contain ${needle}`); }

console.log("RESULT: Template Generation Phase 1C single-DOCX baseline verifier");

present("templates/docx/letters/initial-billing-letter.docx", "Initial Billing Letter single DOCX source");
present("docs/templates/template-generation-phase1b-stale-layout-asset-architecture-removal-manifest.json", "Phase 1B removal manifest");
present("docs/templates/template-generation-phase1c-single-docx-baseline.md", "Phase 1C single-DOCX baseline doc");

absent("app/admin/templates/layout-composition-validation", "layout-composition admin page");
absent("app/api/admin/templates/layout-composition-validation", "layout-composition admin API");
absent("src/lib/templates/layout-composition-validator.mjs", "layout-composition validator");
absent("src/lib/templates/layout-composition-batch-validator.mjs", "layout-composition batch validator");
absent("src/lib/templates/layout-composition-validation-report.mjs", "layout-composition report builder");
absent("src/lib/templates/layout-composition-admin-readiness.mjs", "layout-composition admin readiness");
absent("src/lib/templates/template-layout-composition-registry-source.mjs", "template layout-composition registry source");
absent("docs/template-repository", "old template-repository layout-asset docs directory");
absent("scripts/import-phase47c-letterhead-layout-asset.cjs", "letterhead layout asset import script");
absent("scripts/import-phase48b-pleading-layout-asset.cjs", "pleading layout asset import script");
absent("scripts/verify-templates-layout-composition-validation-suite.mjs", "layout-composition verification suite");
absent("test/fixtures/templates/layout-composition-validator-fixtures.json", "layout-composition validator fixture");
absent("test/fixtures/templates/layout-composition-batch-validator-fixtures.json", "layout-composition batch fixture");

const packageJson = read("package.json");
for (const forbidden of [
  "verify:templates:layout-composition",
  "layout-composition-validation-suite",
  "letterhead-layout-asset",
  "pleading-layout-asset",
  "verify:templates:phase18j-initial-billing-letter-preferred-letter-formatting",
  "verify:templates:phase18k-initial-billing-letter-template-specific-letterhead-overrides"
]) {
  notContains("package scripts", packageJson, forbidden);
}

const builderLibrary = read("src/lib/templates/template-builder-merge-field-library.ts");
for (const token of [
  "{{matter.fileNumber}}",
  "{{matter.providerName}}",
  "{{matter.patientName}}",
  "{{matter.billedAmount}}",
  "{{claim.number}}",
  "{{claim.dateOfLoss}}",
  "{{claim.dateOfService}}",
  "{{claim.denialReason}}",
  "{{claim.balance}}",
  "{{insurer.fullAddressBlock}}",
  "{{adversary.fullAddressBlock}}"
]) {
  builderLibrary.includes(token) ? pass(`canonical Template Builder token retained: ${token}`) : fail(`canonical Template Builder token retained: ${token}`);
}

try {
  execFileSync(process.execPath, ["scripts/verify-template-builder-address-block-format.mjs"], { stdio: "inherit" });
  pass("address blocks still preserve newline rendering in Template Builder preview");
} catch {
  fail("address blocks still preserve newline rendering in Template Builder preview");
}

if (failed) {
  console.error("FAIL: Template Generation Phase 1C single-DOCX baseline verifier failed");
  process.exit(1);
}
console.log("PASS: Template Generation Phase 1C removed stale asset-doc architecture and preserved fresh Initial Billing Letter single-DOCX baseline");
