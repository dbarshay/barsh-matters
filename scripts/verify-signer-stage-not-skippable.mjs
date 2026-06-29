import fs from "fs";

const page = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");

let failed = false;
function pass(message) { console.log("PASS:", message); }
function fail(message) { failed = true; console.error("FAIL:", message); }
function has(label, token) { page.includes(token) ? pass(label) : fail(`${label} missing ${token}`); }

has("template selection advances to signer", 'setMatterDocumentWorkflowStage("signer")');
has("signer-only section exists", 'data-barsh-direct-document-generation-signer-only-section="true"');
has("continue to actions exists", 'data-barsh-direct-document-generation-continue-to-actions="true"');
has("actions section is separately gated", 'data-barsh-direct-document-generation-actions-section="true"');
has("actions section is gated by showActionStep", '{showActionStep && selectedTemplate && (');
has("stale button guard alert exists", 'Select a signer before generating this document.');

const signerIndex = page.indexOf('data-barsh-direct-document-generation-signer-only-section="true"');
const continueIndex = page.indexOf('data-barsh-direct-document-generation-continue-to-actions="true"');
const actionsIndex = page.indexOf('data-barsh-direct-document-generation-actions-section="true"');

if (signerIndex >= 0 && continueIndex > signerIndex) pass("continue-to-actions occurs after signer section starts");
else fail("continue-to-actions ordering is wrong");

if (actionsIndex > continueIndex) pass("actions section occurs after signer continue control");
else fail("actions section is not after signer continue control");

const matchAdvanceSnippet = page.slice(Math.max(0, page.indexOf("const match = sortedTemplateOptions.find") - 500), page.indexOf("const match = sortedTemplateOptions.find") + 1600);
if (matchAdvanceSnippet.includes('setMatterDocumentWorkflowStage("signer")') && !matchAdvanceSnippet.includes('setMatterDocumentWorkflowStage("chooseAction")')) {
  pass("autocomplete match no longer skips signer");
} else {
  fail("autocomplete match can still skip signer");
}

console.log("RESULT: signer stage not skippable verifier");
if (failed) process.exit(1);
