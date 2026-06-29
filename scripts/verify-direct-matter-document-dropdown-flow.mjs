import fs from "fs";

const page = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");

let failed = false;
function pass(message) { console.log("PASS:", message); }
function fail(message) { failed = true; console.error("FAIL:", message); }
function has(label, token) { page.includes(token) ? pass(label) : fail(`${label} missing ${token}`); }
function lacks(label, token) { !page.includes(token) ? pass(label) : fail(`${label} should not contain ${token}`); }

has("document dropdown marker exists", 'data-barsh-direct-document-generation-template-dropdown="true"');
has("dropdown placeholder exists", '<option value="">Select document template</option>');
has("Blank Letterhead dropdown option exists", '<option value="blank-letterhead">Blank Letterhead</option>');
has("dropdown uses selected template key", 'value={matterSelectedDocumentTemplateKey}');
has("dropdown selects Blank Letterhead via helper", 'selectBlankLetterhead();');
has("selected document summary exists", 'data-barsh-direct-document-generation-selected-document-summary="true"');
has("selectBlankLetterhead advances to signer", 'setMatterDocumentWorkflowStage("signer")');
has("signer-only section still exists", 'data-barsh-direct-document-generation-signer-only-section="true"');
has("actions section still exists", 'data-barsh-direct-document-generation-actions-section="true"');
lacks("old card token removed", 'data-barsh-direct-document-generation-template-card="blank-letterhead"');

const dropdownIndex = page.indexOf('data-barsh-direct-document-generation-template-dropdown="true"');
const signerIndex = page.indexOf('data-barsh-direct-document-generation-signer-only-section="true"');
const actionsIndex = page.indexOf('data-barsh-direct-document-generation-actions-section="true"');
if (dropdownIndex >= 0 && signerIndex > dropdownIndex && actionsIndex > signerIndex) pass("dropdown signer actions order is correct");
else fail("dropdown signer actions order is wrong");

console.log("RESULT: direct matter document dropdown flow verifier");
if (failed) process.exit(1);
