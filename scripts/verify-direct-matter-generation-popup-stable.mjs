import fs from "fs";

const page = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");

let failed = false;
function pass(message) { console.log("PASS:", message); }
function fail(message) { failed = true; console.error("FAIL:", message); }
function has(label, token) { page.includes(token) ? pass(label) : fail(`${label} missing ${token}`); }
function lacks(label, token) { !page.includes(token) ? pass(label) : fail(`${label} should not contain ${token}`); }

has("stable select section exists", 'data-barsh-direct-document-generation-select-section="true"');
has("Blank Letterhead template dropdown exists", 'data-barsh-direct-document-generation-template-dropdown="true"');
has("Blank Letterhead dropdown option exists", '<option value="blank-letterhead">Blank Letterhead</option>');
has("selectBlankLetterhead helper exists", "const selectBlankLetterhead = () =>");
has("selectBlankLetterhead advances to signer", 'setMatterDocumentWorkflowStage("signer")');
has("signer-only section exists", 'data-barsh-direct-document-generation-signer-only-section="true"');
has("signer dropdown exists", "<select");
has("David signer display exists", 'displayName: "David M. Barshay"');
has("confirm signer helper exists", "const confirmSignerAndContinue = () =>");
has("confirm signer advances to chooseAction", 'setMatterDocumentWorkflowStage("chooseAction")');
has("actions section exists", 'data-barsh-direct-document-generation-actions-section="true"');
has("actions gated by showActionStep", "{showActionStep && selectedTemplate && (");
has("footer remains", 'data-barsh-direct-document-generation-footer-actions="true"');
lacks("legacy template options removed", 'label: "Bill Schedule"');
lacks("legacy Summons template removed", 'label: "Summons and Complaint"');
lacks("old autocomplete list removed", 'list="matter-document-template-options"');

const selectIndex = page.indexOf('data-barsh-direct-document-generation-select-section="true"');
const signerIndex = page.indexOf('data-barsh-direct-document-generation-signer-only-section="true"');
const actionsIndex = page.indexOf('data-barsh-direct-document-generation-actions-section="true"');
if (selectIndex >= 0 && signerIndex > selectIndex && actionsIndex > signerIndex) pass("select signer actions order is correct");
else fail("select signer actions order is wrong");

console.log("RESULT: direct matter generation popup stable verifier");
if (failed) process.exit(1);
