import fs from "node:fs";
import { execFileSync } from "node:child_process";
const checks = [];
const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
const assert = (name, condition) => checks.push({ name, pass: Boolean(condition) });
const md = read("docs/templates/templates-phase19d-vr-response-composition-override-render.md");
const jsonText = read("docs/templates/templates-phase19d-vr-response-composition-override-render.json");
const registry = read("src/lib/templates/template-signer-requirements-registry-phase1.ts");
let parsed = null;
try { parsed = JSON.parse(jsonText); } catch { parsed = null; }
assert("Phase 19D markdown exists", md.includes("VR Response Static Override Registry Implementation"));
assert("Phase 19D JSON parses", parsed !== null);
assert("Phase 19C baseline documented", md.includes("templates-phase19c-vr-response-header-composition-override-contract-20260623"));
assert("actual override target documented", md.includes("src/lib/templates/template-signer-requirements-registry-phase1.ts"));
assert("registry contains vr-response", registry.includes("templateId: " + String.fromCharCode(34) + "vr-response" + String.fromCharCode(34)));
assert("registry preserves initial-billing-letter", registry.includes("templateId: " + String.fromCharCode(34) + "initial-billing-letter" + String.fromCharCode(34)));
assert("registry contains approved static override", registry.includes("(631) 210-7272") && registry.includes("(516) 706-5055") && registry.includes("info@brlfirm.com"));
assert("registry contains Angelo static signature", registry.includes("Angelo F. Rizzo, Esquire"));
assert("runtime signer selection disabled", parsed && parsed.requiresRuntimeSignerSelection === false);
assert("test render exists", parsed && parsed.testRenderDocx && fs.existsSync(parsed.testRenderDocx));
try {
  if (!parsed || !parsed.testRenderDocx) throw new Error("missing render path");
  execFileSync("python3", ["-c", "import sys, zipfile; z=zipfile.ZipFile(sys.argv[1]); assert(z.testzip() is None); assert(any(n.startswith(" + String.fromCharCode(39) + "word/header" + String.fromCharCode(39) + ") for n in z.namelist()))", parsed.testRenderDocx], { stdio: "pipe" });
  assert("test render is valid DOCX with header parts", true);
} catch {
  assert("test render is valid DOCX with header parts", false);
}
assert("preserve VR Response DOCX rule", md.includes("Did not modify templates/docx/letters/vr-response.docx"));
assert("preserve Initial Billing Letter rule", md.includes("Did not modify templates/docx/letters/initial-billing-letter.docx"));
assert("preserve letterhead-simple rule", md.includes("Did not modify templates/docx/base/letterhead-simple.docx"));
const failed = checks.filter((check) => check.pass === false);
for (const check of checks) console.log((check.pass ? "PASS" : "FAIL") + ": " + check.name);
if (failed.length > 0) process.exit(1);
