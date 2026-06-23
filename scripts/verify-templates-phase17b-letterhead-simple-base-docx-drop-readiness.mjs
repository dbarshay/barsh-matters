import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { templateLayoutCompositionRegistrySource } from "../src/lib/templates/template-layout-composition-registry-source.mjs";

const repoRoot = process.cwd();
const fixturePath = path.join(repoRoot, "test/fixtures/templates/templates-phase17b-letterhead-simple-base-docx-drop-readiness.json");
const docPath = path.join(repoRoot, "docs/templates/templates-phase17b-letterhead-simple-base-docx-drop-readiness.md");
assert.ok(fs.existsSync(fixturePath), "Phase 17B fixture must exist");
assert.ok(fs.existsSync(docPath), "Phase 17B doc must exist");

const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
assert.equal(fixture.target.kind, "base-layout-asset");
assert.equal(fixture.target.role, "letterhead");
assert.equal(fixture.target.assetKey, "barsh-letterhead-standard");
assert.equal(fixture.target.dropPath, "templates/docx/base/letterhead-simple.docx");
assert.equal(fixture.expectedSafety.generationWired, false);
assert.equal(fixture.expectedSafety.clioStorageCalled, false);
assert.equal(fixture.expectedSafety.docxUploadPerformed, false);
assert.equal(fixture.expectedSafety.appApiMutation, false);

const definitions = templateLayoutCompositionRegistrySource.mergeFieldDefinitions;
for (const field of fixture.baseDocExpectedMergeFields) {
  assert.ok(Object.hasOwn(definitions, field), `Missing registry merge-field definition: ${field}`);
}
for (const field of fixture.forbiddenMergeFields) {
  assert.ok(!Object.hasOwn(definitions, field), `Forbidden stale merge-field definition should not exist: ${field}`);
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
assert.ok(layoutAsset, "Letterhead simple layout asset must exist");
assert.equal(layoutAsset.active, true);
assert.equal(layoutAsset.appliesTo, "firstPage");
assert.deepEqual(layoutAsset.requiredMergeFields, ["signer.email", "signer.extension", "signer.fax"]);
assert.ok(fixture.baseDocExpectedMergeFields.includes("letter.reLine"), "Letterhead simple base DOCX contract must expect letter.reLine");
assert.ok(fixture.baseDocExpectedMergeFields.includes("addressee.name"), "Letterhead simple base DOCX contract must expect addressee.name");
assert.ok(!layoutAsset.requiredMergeFields.includes("letter.reLine"), "Shared letterhead dependency must not force letter.reLine onto non-letter compositions");
assert.ok(!layoutAsset.requiredMergeFields.includes("re.line"), "Letterhead simple must use letter.reLine, not stale re.line");

const dropPath = path.join(repoRoot, fixture.target.dropPath);
assert.ok(fs.existsSync(path.dirname(dropPath)), "Phase 17B drop directory must exist");

const phaseDoc = fs.readFileSync(docPath, "utf8");
assert.ok(phaseDoc.includes("letterhead simple"), "Phase doc must identify the single target base asset");
assert.ok(phaseDoc.includes("No generation wiring."), "Phase doc must preserve no-generation-wiring constraint");
assert.ok(phaseDoc.includes("No upload."), "Phase doc must preserve no-upload constraint");
assert.ok(phaseDoc.includes("No Clio/storage call."), "Phase doc must preserve no-Clio/storage constraint");

const status = process.env.PHASE17B_GIT_STATUS || "";
const forbiddenProductionPrefixes = ["app/", "pages/", "src/app/", "src/pages/", "src/api/", "app/api/"];
for (const line of status.split("\n").filter(Boolean)) {
  const file = line.slice(3);
  assert.ok(!forbiddenProductionPrefixes.some((prefix) => file.startsWith(prefix)), `Phase 17B must not touch production app/API path: ${file}`);
}

console.log("PASS: Templates Phase 17B letterhead simple base DOCX drop-readiness verifier passed");
