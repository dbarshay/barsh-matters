import fs from "node:fs";
import { execFileSync } from "node:child_process";
const checks = [];
const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
const assert = (name, condition) => checks.push({ name, pass: Boolean(condition) });
const md = read("docs/templates/templates-phase19e-vr-response-letterhead-static-override-token-repair.md");
const jsonText = read("docs/templates/templates-phase19e-vr-response-letterhead-static-override-token-repair.json");
const registry = read("src/lib/templates/template-signer-requirements-registry-phase1.ts");
let parsed = null;
try { parsed = JSON.parse(jsonText); } catch { parsed = null; }
assert("Phase 19E markdown exists", md.includes("VR Response Letterhead Static Override Token Repair"));
assert("Phase 19E JSON parses", parsed !== null);
assert("Phase 19D baseline documented", md.includes("templates-phase19d-vr-response-static-override-render-20260624"));
assert("registry contains blank extension override", registry.includes("extension: " + String.fromCharCode(34) + String.fromCharCode(34)));
assert("registry contains fax and email overrides", registry.includes("(516) 706-5055") && registry.includes("info@brlfirm.com"));
assert("docs record visible-token repair", md.includes("signer.extension") && md.includes("signer.fax") && md.includes("signer.email"));
assert("docs record date lowering", md.includes("date needed to be lowered") && md.includes("Lowered the date paragraph"));
assert("JSON records date lowered", parsed && parsed.dateParagraphLowered === true);
assert("test render exists", parsed && parsed.testRenderDocx && fs.existsSync(parsed.testRenderDocx));
try {
  if (!parsed || !parsed.testRenderDocx) throw new Error("missing render path");
  execFileSync("python3", ["-c", "import sys, zipfile; z=zipfile.ZipFile(sys.argv[1]); assert(z.testzip() is None); assert(any(n.startswith(" + String.fromCharCode(39) + "word/header" + String.fromCharCode(39) + ") for n in z.namelist()))", parsed.testRenderDocx], { stdio: "pipe" });
  assert("test render is valid DOCX with header parts", true);
} catch {
  assert("test render is valid DOCX with header parts", false);
}
assert("protected DOCX rule recorded", md.includes("Did not modify templates/docx/base/letterhead-simple.docx"));
const failed = checks.filter((check) => check.pass === false);
for (const check of checks) console.log((check.pass ? "PASS" : "FAIL") + ": " + check.name);
if (failed.length > 0) process.exit(1);
