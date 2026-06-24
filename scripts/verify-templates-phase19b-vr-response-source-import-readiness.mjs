import fs from "node:fs";
import { execFileSync } from "node:child_process";

const checks = [];
const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
const assert = (name, condition) => checks.push({ name, pass: Boolean(condition) });

const md = read("docs/templates/templates-phase19b-vr-response-source-import-readiness.md");
const jsonText = read("docs/templates/templates-phase19b-vr-response-source-import-readiness.json");
let parsed = null;
try {
  parsed = JSON.parse(jsonText);
} catch {
  parsed = null;
}

const targetDocx = "templates/docx/letters/vr-response.docx";
const tokens = Array.isArray(parsed?.tokens) ? parsed.tokens : [];
assert("Templates Phase 19B markdown exists", md.includes("VR Response Source Import / Readiness"));
assert("Templates Phase 19B JSON parses", parsed !== null);
assert("signer-docgen Phase 1 baseline documented", md.includes("signer-docgen-phase1-exact-runtime-target-map-20260623"));
assert("target VR Response DOCX exists", fs.existsSync(targetDocx));
assert("template id is vr-response", parsed?.templateId === "vr-response");
assert("runtime signer selection disabled", parsed?.requiresRuntimeSignerSelection === false);
assert("hard-coded Angelo signature preserved", md.includes("Angelo F. Rizzo, Esquire"));
assert("billing-letter header override required", parsed?.requiresInitialBillingLetterHeaderOverride === true);
assert("approved fax override recorded", md.includes("Fax: (516) 706-5055"));
assert("approved email override recorded", md.includes("Email: info@brlfirm.com"));
assert("canonical tokens recorded", tokens.includes("{{letter.date}}") && tokens.includes("{{matter.fileNumber}}") && tokens.includes("{{claim.dosRange}}"));
assert("token normalization documented", md.includes("Token normalization") && md.includes("{{ letter.date }}"));
assert("legacy tokens absent", Array.isArray(parsed?.legacyTokens) && parsed.legacyTokens.length === 0);
assert("initial billing letter preserve rule", md.includes("Do not modify `templates/docx/letters/initial-billing-letter.docx`"));
assert("letterhead-simple preserve rule", md.includes("Do not modify `templates/docx/base/letterhead-simple.docx`"));

try {
  execFileSync("python3", ["-c", "import zipfile; zipfile.ZipFile('templates/docx/letters/vr-response.docx').testzip()"], { stdio: "pipe" });
  assert("VR Response DOCX is a valid zip package", true);
} catch {
  assert("VR Response DOCX is a valid zip package", false);
}

const failed = checks.filter((check) => check.pass === false);
for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"}: ${check.name}`);
}
if (failed.length > 0) process.exit(1);
