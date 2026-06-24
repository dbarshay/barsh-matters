import fs from "node:fs";

const checks = [];
const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
const exists = (p) => fs.existsSync(p);
const assert = (name, condition) => checks.push({ name, pass: Boolean(condition) });

const md = read("docs/admin-users/signer-docgen-phase1-exact-runtime-target-map.md");
const jsonText = read("docs/admin-users/signer-docgen-phase1-exact-runtime-target-map.json");
let parsed = null;
try {
  parsed = JSON.parse(jsonText);
} catch {
  parsed = null;
}

const selected = parsed?.selected || {};

assert("Signer docgen Phase 1 markdown exists", md.includes("Exact Runtime Target Map"));
assert("Signer docgen Phase 1 JSON parses", parsed !== null);
assert("QA Phase 3 baseline documented", md.includes("admin-users-qa-phase3-post-patch-gap-closure-report-20260623"));
assert("runtime mutation is false", parsed?.runtimeMutation === false);
assert("candidates found", Number(parsed?.candidateCounts?.all || 0) > 0);
assert("UI candidates found", Array.isArray(selected.generateDocumentsUiCandidates) && selected.generateDocumentsUiCandidates.length > 0);
assert("API candidates found", Array.isArray(selected.documentGenerationApiCandidates) && selected.documentGenerationApiCandidates.length > 0);
assert("template candidates found", Array.isArray(selected.templateResolutionCandidates) && selected.templateResolutionCandidates.length > 0);
assert("signer candidates found", Array.isArray(selected.signerProfileCandidates) && selected.signerProfileCandidates.length > 0);
assert("signer requirements registry exists", selected.signerRequirementsRegistry && exists(selected.signerRequirementsRegistry));
assert("signer write contract exists", selected.signerProfileWriteContract && exists(selected.signerProfileWriteContract));
assert("signer profile route exists", selected.signerProfileRoute && exists(selected.signerProfileRoute));
assert("patch rules prohibit DOCX mutation", md.includes("do not alter DOCX files") && md.includes("letterhead-simple DOCX"));
assert("patch rules preserve Initial Billing Letter bypass", md.includes("Initial Billing Letter static approved header/signature bypass"));
assert("patch rules reject legacy compatibility", md.includes("Do not add legacy token compatibility layers"));

const failed = checks.filter((check) => check.pass === false);
for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"}: ${check.name}`);
}
if (failed.length > 0) process.exit(1);
