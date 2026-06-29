import fs from "fs";

const page = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");

let failed = false;
function pass(message) { console.log("PASS:", message); }
function fail(message) { failed = true; console.error("FAIL:", message); }
function has(label, token) { page.includes(token) ? pass(label) : fail(`${label} missing ${token}`); }

has("delivery step badge remains", 'Document Delivery');
has("delivery section exists", 'data-barsh-direct-document-generation-delivery-section="true"');
has("delivery completion copy exists", "Finalization completed for");
has("generate another document button exists", "Generate Another Document");
has("generate another document resets workflow", 'setMatterDocumentWorkflowStage("select");');
has("close button exists in delivery section", "Close");
has("finalize action still moves to delivery", 'setMatterDocumentWorkflowStage("delivery");');
has("result panel remains", 'data-barsh-direct-document-generation-result-panel="true"');
has("header remains locked flow-compatible", 'data-barsh-direct-document-generation-template-dropdown="true"');

console.log("RESULT: direct matter Document Delivery step body verifier");
if (failed) process.exit(1);
