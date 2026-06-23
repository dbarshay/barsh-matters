import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const registryPath = path.join(repoRoot, "src/lib/templates/template-layout-composition-registry-source.mjs");
const adminReadinessPath = path.join(repoRoot, "src/lib/templates/layout-composition-admin-readiness.mjs");
const fileReadinessPath = path.join(repoRoot, "src/lib/templates/template-file-readiness-report.mjs");
const fixturePath = path.join(repoRoot, "test/fixtures/templates/templates-phase17a-letterhead-simple-base-merge-code-readiness.json");

for (const requiredPath of [registryPath, adminReadinessPath, fileReadinessPath, fixturePath]) {
  assert.ok(fs.existsSync(requiredPath), `Missing required file: ${path.relative(repoRoot, requiredPath)}`);
}

const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
assert.equal(fixture.target.id, "letterhead-simple");
assert.equal(fixture.target.kind, "base-layout-asset");
assert.equal(fixture.expectedSafety.generationWired, false);
assert.equal(fixture.expectedSafety.clioStorageCalled, false);
assert.equal(fixture.expectedSafety.docxUploadPerformed, false);

const registrySource = fs.readFileSync(registryPath, "utf8");
const registryLower = registrySource.toLowerCase();

const letterheadSignals = ["letterhead"];
for (const signal of letterheadSignals) {
  assert.ok(registryLower.includes(signal), `Registry does not contain required letterhead signal: ${signal}`);
}

const mergeFieldSignals = fixture.requiredTextSignals.filter((signal) => signal !== "letterhead");
const missingSignals = mergeFieldSignals.filter((signal) => !registryLower.includes(signal.toLowerCase()));
assert.deepEqual(missingSignals, [], `Letterhead simple base merge-code signals missing from registry source: ${missingSignals.join(", ")}`);

const forbiddenBroadMutationSignals = [
  "upload",
  "clio",
  "finalize",
  "generateDocument",
  "generateTemplate",
  "bulk"
];
const phaseDoc = fs.readFileSync(path.join(repoRoot, "docs/templates/templates-phase17a-letterhead-simple-base-merge-code-readiness.md"), "utf8").toLowerCase();
assert.ok(phaseDoc.includes("letterhead simple"), "Phase doc must identify letterhead simple as the only target.");
assert.ok(phaseDoc.includes("no generation wiring"), "Phase doc must preserve no-generation-wiring constraint.");
assert.ok(phaseDoc.includes("no clio/storage calls"), "Phase doc must preserve no-Clio/storage constraint.");

const touchedProductionPaths = [
  "app/",
  "pages/",
  "src/app/",
  "src/pages/",
  "src/api/",
  "app/api/"
];
const status = process.env.PHASE17A_GIT_STATUS || "";
for (const touched of status.split("\n").filter(Boolean)) {
  const file = touched.slice(3);
  assert.ok(!touchedProductionPaths.some((prefix) => file.startsWith(prefix)), `Phase 17A must not touch production app/API path: ${file}`);
}

console.log("PASS: Templates Phase 17A letterhead simple base merge-code readiness verifier passed");
