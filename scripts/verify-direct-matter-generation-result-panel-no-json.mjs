import fs from "fs";

const page = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");

let failed = false;
function pass(message) { console.log("PASS:", message); }
function fail(message) { failed = true; console.error("FAIL:", message); }
function has(label, token) { page.includes(token) ? pass(label) : fail(`${label} missing ${token}`); }
function lacks(label, token) { !page.includes(token) ? pass(label) : fail(`${label} should not contain ${token}`); }

has("friendly result panel exists", 'data-barsh-direct-document-generation-result-panel="true"');
has("Word action buttons exist", 'data-barsh-direct-document-generation-word-actions="true"');
has("Open in Word Web button exists", "Open in Word Web");
has("Desktop Word button exists", "Try Desktop Word");
has("Copy Word link button exists", "Copy Word Web Link");
lacks("raw generation JSON stringify removed", "JSON.stringify(matterDocumentFinalizationResult || documentPreview || finalizeUploadResult || {}, null, 2)");
has("stable document dropdown still exists", 'data-barsh-direct-document-generation-template-dropdown="true"');
has("signer step still exists", 'data-barsh-direct-document-generation-signer-only-section="true"');
has("actions section still exists", 'data-barsh-direct-document-generation-actions-section="true"');

console.log("RESULT: direct matter generation result panel no-json verifier");
if (failed) process.exit(1);
