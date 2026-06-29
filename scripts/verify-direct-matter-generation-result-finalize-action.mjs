import fs from "fs";

const page = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");

let failed = false;
function pass(message) { console.log("PASS:", message); }
function fail(message) { failed = true; console.error("FAIL:", message); }
function has(label, token) { page.includes(token) ? pass(label) : fail(`${label} missing ${token}`); }
function lacks(label, token) { !page.includes(token) ? pass(label) : fail(`${label} should not contain ${token}`); }

has("friendly result panel remains", 'data-barsh-direct-document-generation-result-panel="true"');
has("Finalize action marker exists", 'data-barsh-direct-document-generation-result-finalize-action="true"');
has("Finalize Document label exists", "Finalize Document");
has("Finalize action calls finalizeMatterDocumentFromStep2", "finalizeMatterDocumentFromStep2(selectedTemplate)");
has("Finalize action disables during loading", "documentPreviewLoading || finalizeUploadLoading");
has("Word actions remain", 'data-barsh-direct-document-generation-word-actions="true"');
has("Open in Word Web remains", "Open in Word Web");
has("stable dropdown remains", 'data-barsh-direct-document-generation-template-dropdown="true"');
has("signer-only section remains", 'data-barsh-direct-document-generation-signer-only-section="true"');
lacks("raw generation JSON remains hidden", "JSON.stringify(matterDocumentFinalizationResult || documentPreview || finalizeUploadResult || {}, null, 2)");

console.log("RESULT: direct matter result finalize action verifier");
if (failed) process.exit(1);
