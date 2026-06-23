import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hiddenFieldMergeSourceMappingContract as contract } from "../src/lib/templates/template-layout-composition-registry-source.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(root, "test/fixtures/templates/templates-phase18d-hidden-field-merge-source-mapping-contract-fixtures.json");
const docPath = path.join(root, "docs/templates/templates-phase18d-hidden-field-merge-source-mapping-contract.md");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const doc = fs.readFileSync(docPath, "utf8");
function fail(message) { throw new Error(message); }
function eq(actual, expected, label) { if (actual === expected) return; fail(`${label} mismatch: expected ${expected}, received ${actual}`); }
function same(actual, expected, label) { if (JSON.stringify(actual) === JSON.stringify(expected)) return; fail(`${label} mismatch`); }
function has(text, value, label) { if (text.includes(value)) return; fail(`${label} missing ${value}`); }
eq(fixture.phase, "Templates Phase 18D", "phase");
eq(fixture.hiddenFieldsMustBeMappable, true, "hidden fields mappable flag");
eq(fixture.generationWired, false, "generation flag");
eq(fixture.storageCallsAllowed, false, "storage flag");
eq(fixture.clioCallsAllowed, false, "Clio flag");
eq(fixture.dbMutationAllowed, false, "DB mutation flag");
same(contract.knownHiddenFieldSources, fixture.knownHiddenFieldSources, "registry known hidden field sources");
same(contract.composedMergeSources, fixture.composedMergeSources, "registry composed merge sources");
const source = fixture.knownHiddenFieldSources.find((item) => item.sourceTable === "ReferenceEntity" && item.sourceColumn === "details");
if (source === undefined) fail("ReferenceEntity.details hidden source missing");
eq(source.jsonRoot, "_hiddenImportFields", "hidden import root");
eq(source.entityType, "insurer_company", "entity type");
const requiredPaths = [
  "ReferenceEntity.details._hiddenImportFields.hidden_street",
  "ReferenceEntity.details._hiddenImportFields.hidden_city",
  "ReferenceEntity.details._hiddenImportFields.hidden_state",
  "ReferenceEntity.details._hiddenImportFields.hidden_zipcode",
  "ReferenceEntity.details._hiddenImportFields.hidden_website",
  "ReferenceEntity.details._hiddenImportFields.hidden_domicile",
  "ReferenceEntity.details._hiddenImportFields.hidden_group_name",
  "ReferenceEntity.details._hiddenImportFields.hidden_naic_number"
];
const actualPaths = source.fields.map((field) => field.path);
for (const requiredPath of requiredPaths) {
  if (actualPaths.includes(requiredPath) === false) fail(`missing hidden field path ${requiredPath}`);
  has(doc, requiredPath, "doc hidden field path coverage");
}
const mailing = fixture.composedMergeSources.find((item) => item.mergeCode === "insurer.mailingAddress");
if (mailing === undefined) fail("insurer.mailingAddress composed source missing");
same(mailing.sourcePaths, requiredPaths.slice(0, 4), "insurer mailing address source path order");
eq(mailing.phase18CTestValue, "3100 Sanders Road, Suite 201\nNorthbrook, Illinois 60062", "Phase 18C address continuity");
eq(fixture.phase18CContinuity.templateId, "initial-billing-letter", "Phase 18C template continuity");
eq(fixture.phase18CContinuity.testMatterFileNumber, "BRL_202600003", "Phase 18C matter continuity");
eq(fixture.phase18CContinuity.insurerName, "Allstate Indemnity Company", "Phase 18C insurer continuity");
has(doc, "All hidden fields from all relevant data-source tables must be discoverable and mappable", "core rule documentation");
has(doc, "ReferenceEntity.details._hiddenImportFields", "source family documentation");
has(doc, "No database mutation", "non-goal documentation");
console.log("PASS: Templates Phase 18D hidden field merge-source mapping contract verified");
