import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { initialBillingLetterMergeCodeReadinessContract as readiness, initialBillingLetterDocxImportGateContract as gate } from "../src/lib/templates/template-layout-composition-registry-source.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(root, "test/fixtures/templates/templates-phase18b-initial-billing-letter-docx-import-gate-fixtures.json");
const docPath = path.join(root, "docs/templates/templates-phase18b-initial-billing-letter-docx-import-gate.md");
const docxPath = path.join(root, "templates/docx/letters/initial-billing-letter.docx");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const doc = fs.readFileSync(docPath, "utf8");
function fail(message) { throw new Error(message); }
function eq(actual, expected, label) { if (actual === expected) return; fail(label + " mismatch"); }
function same(actual, expected, label) { if (JSON.stringify(actual) === JSON.stringify(expected)) return; fail(label + " mismatch"); }
function has(text, value, label) { if (text.includes(value)) return; fail(label + " missing " + value); }
if (fs.existsSync(docxPath) === false) fail("committed DOCX missing");
eq(fixture.templateId, "initial-billing-letter", "template id");
eq(fixture.documentKind, "letter", "document kind");
eq(fixture.matterScope, "individual", "matter scope");
eq(fixture.committedDocxPath, "templates/docx/letters/initial-billing-letter.docx", "committed path");
eq(fixture.layoutDependency, "letterhead-simple", "layout dependency");
eq(fixture.testMatterFileNumber, "BRL_202600003", "test matter");
eq(fixture.generationWired, false, "generation flag");
eq(fixture.clioCallsAllowed, false, "Clio flag");
eq(fixture.storageCallsAllowed, false, "storage flag");
eq(fixture.normalizedVisibleTextRequired, true, "normalized visible text flag");
eq(fixture.legacyTokensAllowedUntilTransformPhase, true, "legacy token phase flag");
same(fixture.legacyTokenInventory, readiness.legacyTokenInventory, "Phase 18A legacy token continuity");
same(fixture.requiredStandardTokens, readiness.requiredStandardTokens, "Phase 18A standard token continuity");
same(gate.legacyTokenInventory, fixture.legacyTokenInventory, "registry gate legacy tokens");
same(gate.requiredStandardTokens, fixture.requiredStandardTokens, "registry gate standard tokens");
const py = "import zipfile,xml.etree.ElementTree as ET,re,sys; ns=\"{http://schemas.openxmlformats.org/wordprocessingml/2006/main}\"; parts=[]; z=zipfile.ZipFile(sys.argv[1]); names=[n for n in z.namelist() if n.startswith(\"word/\") and n.endswith(\".xml\") and (n.endswith(\"/document.xml\") or \"/header\" in n or \"/footer\" in n)];\\nfor n in names:\\n root=ET.fromstring(z.read(n));\\n [parts.append(node.text or \"\") for node in root.iter(ns+\"t\")]; parts.append(\" \")\\ntext=re.sub(r\"\\\\s+\",\" \",\"\".join(parts)).strip(); tokens=sorted(set(re.findall(r\"<<\\\\s*([^<>]+?)\\\\s*>>\", text))); print(str(len(names))); print(str(len(text))); print(\"\\\\n\".join([\"<<\"+t+\">>\" for t in tokens])); print(\"__TEXT__\"); print(text)";
const extracted = execFileSync("python3", ["-c", py, docxPath], { encoding: "utf8" });
const [head, visibleText] = extracted.split("__TEXT__\\n");
const lines = head.trim().split(/\\n/);
const xmlPartCount = Number(lines[0]);
const visibleChars = Number(lines[1]);
const tokens = lines.slice(2);
eq(xmlPartCount, fixture.docxXmlPartCount, "XML part count");
eq(visibleChars, fixture.visibleTextCharacterCount, "visible text character count");
same(tokens, fixture.legacyTokenInventory, "normalized visible legacy token inventory");
for (const token of fixture.legacyTokenInventory) has(doc, token, "doc legacy token coverage");
for (const token of fixture.requiredStandardTokens) has(doc, token, "doc standard token coverage");
for (const phrase of fixture.requiredVisiblePhrases) {
  has(visibleText, phrase, "DOCX visible phrase");
  has(doc, phrase, "readiness doc visible phrase");
}
has(doc, "normalized visible Word text", "normalized text documentation");
has(doc, "Generation remains unwired", "generation non-goal");
has(doc, "Clio and storage calls remain prohibited", "storage non-goal");
console.log("PASS: Templates Phase 18B Initial Billing Letter DOCX import gate verified");
