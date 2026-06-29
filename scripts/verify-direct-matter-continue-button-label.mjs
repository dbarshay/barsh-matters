import fs from "fs";

const page = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");
const signerIndex = page.indexOf('data-barsh-direct-document-generation-signer-only-section="true"');
const actionsIndex = page.indexOf('data-barsh-direct-document-generation-actions-section="true"');
const signerBlock =
  signerIndex >= 0 && actionsIndex > signerIndex ? page.slice(signerIndex, actionsIndex) : "";

let failed = false;
function pass(message) { console.log("PASS:", message); }
function fail(message) { failed = true; console.error("FAIL:", message); }
function has(label, haystack, token) { haystack.includes(token) ? pass(label) : fail(`${label} missing ${token}`); }
function lacks(label, haystack, token) { !haystack.includes(token) ? pass(label) : fail(`${label} should not contain ${token}`); }

has("signer section remains", page, 'data-barsh-direct-document-generation-signer-only-section="true"');
has("generate action section remains", page, 'data-barsh-direct-document-generation-actions-section="true"');
has("confirm signer handler remains", signerBlock, "confirmSignerAndContinue");
has("signer continue button label is Continue", signerBlock, "Continue");
has("continue button still advances to generate actions", page, 'setMatterDocumentWorkflowStage("chooseAction");');
lacks("old Continue to Generate label removed from signer step", signerBlock, "Continue to Generate");
lacks("old Continue to Generate label removed from page", page, "Continue to Generate");

console.log("RESULT: direct matter Continue button label verifier");
if (failed) process.exit(1);
