import fs from "node:fs";

const checks = [];
const add = (name, ok, detail = "") => checks.push({ name, ok, detail });

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";

const scanner = read("src/lib/templates/template-builder-token-scan-readiness.ts");
add("Token scan readiness contract exists", scanner.length > 0);
for (const token of [
  "TemplateBuilderTokenScanSeverity",
  "blocking",
  "warning",
  "recognized",
  "TemplateBuilderTokenScanSection",
  "Blocking Issues",
  "Warnings",
  "Recognized Tokens",
  "No Tokens Found",
  "TemplateBuilderTokenLocationKind",
  "Body paragraph",
  "Table cell",
  "Text box",
  "Unknown document location",
  "malformed-token",
  "invalid-modifier-syntax",
  "incompatible-field-type-modifier",
  "unknown-well-formed-token",
  "split-different-style-warning",
  "TEMPLATE_BUILDER_DOCX_SCAN_BOUNDARY",
  "includeBody: true",
  "includeTables: true",
  "includeTextBoxesWhenDetectable: true",
  "ignoreHeaders: true",
  "ignoreFooters: true",
  "detectSplitAcrossWordRuns: true",
  "warnWhenSplitAcrossDifferentlyStyledRuns: true",
  "TEMPLATE_BUILDER_TOKEN_SCAN_POPUP_SECTIONS",
  "TEMPLATE_BUILDER_TOKEN_SCAN_WARNING_ONLY_ACTIONS",
  "Cancel",
  "Continue Anyway",
  "TEMPLATE_BUILDER_TOKEN_SCAN_BLOCKING_ACTIONS",
  "Close",
  "templateBuilderParseTokenParts",
  "templateBuilderModifierSyntaxValid",
  "templateBuilderNormalizeModifierOrder",
  "templateBuilderRecognizesToken",
  "templateBuilderFieldCompatibleWithModifiers",
  "templateBuilderClassifyTokenText",
  "templateBuilderNoTokensFoundIssue",
  "templateBuilderCanProceedWithScanIssues",
  "templateBuilderActivationRequiresWarningOverride",
  "templateBuilderGenerationBlocksOnScanIssues",
  "templateBuilderSampleScanIssues",
]) {
  add(`Token scan contract contains ${token}`, scanner.includes(token));
}

const doc = read("docs/templates/template-builder-phase4-token-scan-readiness.md");
for (const token of [
  "Template Builder Phase 4",
  "does not implement production DOCX upload",
  "Ignore headers",
  "Ignore footers",
  "Detect tokens split across Word runs",
  "Warn, but do not block",
  "Locations are approximate structure locations",
  "Blocking Issues",
  "Warnings",
  "Recognized Tokens",
  "No Tokens Found",
  "Cancel",
  "Continue Anyway",
  "Close",
  "Unknown but well-formed tokens are warning-only",
  "No tokens found is warning-only",
  "Malformed tokens are blocking",
  "Invalid modifier syntax is blocking",
  "Incompatible field-type modifiers are blocking",
  "Tokens must never be exposed in generated documents",
]) {
  add(`Phase 4 doc contains ${token}`, doc.includes(token));
}

const build = read("app/admin/document-templates/build/page.tsx");
add("Build page keeps functional merge-field table after removing visible readiness panels", build.includes("Search merge fields") && build.includes("Merge Field") && build.includes("CopyIcon"));
add("Build page does not expose token scan readiness panel", !build.includes("Token scan readiness"));

const view = read("app/admin/document-templates/view/page.tsx");
add("View page references Phase 4 Make Active token scan readiness", view.includes("Make Active token scan readiness is defined in Phase 4"));

const pkg = JSON.parse(read("package.json"));
add("Package has Phase 4 verifier script", pkg.scripts && pkg.scripts["verify:template-builder-phase4"] === "node scripts/verify-template-builder-phase4-readiness.mjs");

const failed = checks.filter((check) => check.ok === false);
for (const check of checks) {
  const color = check.ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  console.log(`${color}: ${check.name}${check.detail ? " - " + check.detail : ""}`);
}
if (failed.length > 0) {
  console.error(`\n${failed.length} Template Builder Phase 4 readiness checks failed.`);
  process.exit(1);
}
console.log("\nPASS: Template Builder Phase 4 token scan readiness contract verified.");
