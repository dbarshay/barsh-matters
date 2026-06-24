import fs from "node:fs";
import { execFileSync } from "node:child_process";
const checks = [];
const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
const assert = (name, condition) => checks.push({ name, pass: Boolean(condition) });
const md = read("docs/templates/templates-phase19g-vr-response-vr-base-letterhead-header-render.md");
const jsonText = read("docs/templates/templates-phase19g-vr-response-vr-base-letterhead-header-render.json");
const registry = read("src/lib/templates/template-signer-requirements-registry-phase1.ts");
let parsed = null;
try { parsed = JSON.parse(jsonText); } catch { parsed = null; }
assert("Phase 19G markdown exists", md.includes("VR Response VR-Base Letterhead Header Render"));
assert("Phase 19G JSON parses", parsed !== null);
assert("registry contains extension/fax/email overrides", registry.includes("extension: " + String.fromCharCode(34) + String.fromCharCode(34)) && registry.includes("(516) 706-5055") && registry.includes("info@brlfirm.com"));
assert("docs record VR-base render", md.includes("keep VR Response DOCX as the base") && md.includes("import the letterhead-simple header parts"));
assert("docs record comma removal", md.includes("Removed the comma"));
assert("docs record typo fix", md.includes("insterted") && md.includes("inserted"));
assert("test render exists", parsed && parsed.testRenderDocx && fs.existsSync(parsed.testRenderDocx));
try {
  if (!parsed || !parsed.testRenderDocx) throw new Error("missing render path");
  execFileSync("python3", ["-c", "import sys, zipfile; z=zipfile.ZipFile(sys.argv[1]); assert(z.testzip() is None); names=z.namelist(); assert(any(n.startswith(" + String.fromCharCode(39) + "word/header" + String.fromCharCode(39) + ") for n in names)); assert(any(n.startswith(" + String.fromCharCode(39) + "word/media/" + String.fromCharCode(39) + ") for n in names))", parsed.testRenderDocx], { stdio: "pipe" });
  assert("test render valid DOCX with header and media", true);
} catch {
  assert("test render valid DOCX with header and media", false);
}
assert("protected DOCX rule recorded", md.includes("Did not modify templates/docx/base/letterhead-simple.docx"));
const failed = checks.filter((check) => check.pass === false);
for (const check of checks) console.log((check.pass ? "PASS" : "FAIL") + ": " + check.name);
if (failed.length > 0) process.exit(1);
