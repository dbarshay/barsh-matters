import fs from "fs";

const page = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");
const start = page.indexOf("async function finalizeMatterDocumentFromStep2");
const endCandidates = [
  page.indexOf("\n  async function ", start + 10),
  page.indexOf("\n  function ", start + 10),
].filter((index) => index > start);
const end = endCandidates.length ? Math.min(...endCandidates) : page.length;
const block = page.slice(start, end);

let failed = false;
function pass(message) { console.log("PASS:", message); }
function fail(message) { failed = true; console.error("FAIL:", message); }
function has(label, token) { block.includes(token) ? pass(label) : fail(`${label} missing ${token}`); }
function lacks(label, token) { !block.includes(token) ? pass(label) : fail(`${label} should not contain ${token}`); }

has("finalize uses mutable working document", "let workingDocument = matterDocumentFinalizationResult?.workingDocument || null;");
has("finalize uses mutable working drive item id", "let workingDocumentDriveItemId = textValue(workingDocument?.driveItemId);");
has("finalize creates working docx when missing", 'const workingResponse = await fetch("/api/documents/working-docx",');
has("working docx create confirms create", "confirmCreate: true,");
has("working docx create stays direct matter", 'uploadTargetMode: "direct-matter",');
has("working docx create sends normalized display number", "directMatterDisplayNumber,");
has("working docx create sends signer email", "signerEmail: matterDocumentSignerEmail.trim() ||");
has("working docx create sends selected key", "documentKeys: [effectiveSelectedDocumentKey].filter(Boolean),");
has("working docx result is retained", "setMatterDocumentFinalizationResult(workingJson);");
has("finalize still posts to finalize route", 'const res = await fetch("/api/documents/finalize",');
has("finalize sends working document drive item id", "workingDocumentDriveItemId,");
lacks("old Edit-first alert removed from finalize function", "Use Edit Document first, save in Word Web, then click Finalize Document.");

console.log("RESULT: direct matter Step 3 finalize without edit verifier");
if (failed) process.exit(1);
