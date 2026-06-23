import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { templateLayoutCompositionRegistrySource } from "../src/lib/templates/template-layout-composition-registry-source.mjs";

const repoRoot = process.cwd();
const fixturePath = path.join(repoRoot, "test/fixtures/templates/templates-phase17c-letterhead-simple-base-docx-import-gate.json");
const docPath = path.join(repoRoot, "docs/templates/templates-phase17c-letterhead-simple-base-docx-import-gate.md");
const keepPath = path.join(repoRoot, "templates/docx/base/.gitkeep");
assert.ok(fs.existsSync(fixturePath), "Phase 17C fixture must exist");
assert.ok(fs.existsSync(docPath), "Phase 17C doc must exist");
assert.ok(fs.existsSync(keepPath), "Phase 17C must create only the approved base DOCX drop folder placeholder");

const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
assert.equal(fixture.target.kind, "base-layout-asset");
assert.equal(fixture.target.role, "letterhead");
assert.equal(fixture.target.assetKey, "barsh-letterhead-standard");
assert.equal(fixture.target.dropPath, "templates/docx/base/letterhead-simple.docx");
assert.equal(fixture.target.pendingAllowed, true);
assert.equal(fixture.expectedSafety.generationWired, false);
assert.equal(fixture.expectedSafety.clioStorageCalled, false);
assert.equal(fixture.expectedSafety.docxUploadPerformed, false);
assert.equal(fixture.expectedSafety.docxCreated, false);
assert.equal(fixture.expectedSafety.appApiMutation, false);

const definitions = templateLayoutCompositionRegistrySource.mergeFieldDefinitions;
for (const token of fixture.expectedMergeTokensWhenPresent) {
  assert.ok(Object.hasOwn(definitions, token), `Missing registry merge-field definition for DOCX import gate token: ${token}`);
}

function collectObjects(value, out = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectObjects(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    out.push(value);
    for (const child of Object.values(value)) collectObjects(child, out);
  }
  return out;
}

const layoutAsset = collectObjects(templateLayoutCompositionRegistrySource).find((asset) => asset.role === fixture.target.role && asset.assetKey === fixture.target.assetKey && Array.isArray(asset.requiredMergeFields));
assert.ok(layoutAsset, "Letterhead simple base layout asset contract must exist");
assert.deepEqual(layoutAsset.requiredMergeFields, ["signer.email", "signer.extension", "signer.fax"]);

function decodeXmlText(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, String.fromCharCode(34))
    .replace(/&apos;/g, String.fromCharCode(39));
}

function extractVisibleText(partXml) {
  const textNodePattern = new RegExp("<w:t[^>]*>(.*?)</w:t>", "gs");
  return Array.from(partXml.matchAll(textNodePattern), (match) => decodeXmlText(match[1])).join("");
}

const dropPath = path.join(repoRoot, fixture.target.dropPath);
if (!fs.existsSync(dropPath)) {
  console.log("PASS: Letterhead simple DOCX import gate pending; no DOCX present at templates/docx/base/letterhead-simple.docx");
} else {
  assert.ok(fs.statSync(dropPath).isFile(), "Letterhead simple DOCX drop path must be a file when present");
  const listing = execFileSync("unzip", ["-Z1", dropPath], { encoding: "utf8" });
  const entries = listing.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
  const xmlEntries = entries.filter((entry) => entry.startsWith("word/") && entry.endsWith(".xml"));
  assert.ok(xmlEntries.length > 0, "DOCX must contain Word XML parts");
  const xmlParts = xmlEntries.map((entry) => execFileSync("unzip", ["-p", dropPath, entry], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }));
  const separator = String.fromCharCode(10);
  const rawXml = xmlParts.join(separator);
  const normalizedVisibleText = xmlParts.map((partXml) => extractVisibleText(partXml)).join(separator);
  const searchableText = rawXml + separator + normalizedVisibleText;
  for (const token of fixture.expectedMergeTokensWhenPresent) {
    assert.ok(searchableText.includes(token), `DOCX is missing expected merge-code token: ${token}`);
  }
  for (const token of fixture.forbiddenTokens) {
    assert.ok(!searchableText.includes(token), `DOCX contains forbidden stale merge-code token: ${token}`);
  }
  console.log(`PASS: Letterhead simple DOCX present and merge-code tokens verified across ${xmlEntries.length} Word XML parts using raw XML plus normalized visible text`);
}

const phaseDoc = fs.readFileSync(docPath, "utf8");
assert.ok(phaseDoc.includes("letterhead simple"), "Phase doc must identify the single target base asset");
assert.ok(phaseDoc.includes("does not create, import, upload, or generate a DOCX file"), "Phase doc must preserve no-create/no-import/no-upload/no-generation constraint");
assert.ok(phaseDoc.includes("does not call Clio/storage"), "Phase doc must preserve no-Clio/storage constraint");

const status = process.env.PHASE17C_GIT_STATUS || "";
const forbiddenProductionPrefixes = ["app/", "pages/", "src/app/", "src/pages/", "src/api/", "app/api/"];
for (const line of status.split(String.fromCharCode(10)).filter(Boolean)) {
  const file = line.slice(3);
  assert.ok(!forbiddenProductionPrefixes.some((prefix) => file.startsWith(prefix)), `Phase 17C must not touch production app/API path: ${file}`);
}

console.log("PASS: Templates Phase 17C letterhead simple base DOCX import gate verifier passed");
