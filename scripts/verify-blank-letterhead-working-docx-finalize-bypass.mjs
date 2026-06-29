import fs from "fs";

const route = fs.readFileSync("app/api/documents/finalize/route.ts", "utf8");
const fallbackIndex = route.indexOf("const blankLetterheadFinalizeFallbackDocument =");
const postFallback = fallbackIndex >= 0 ? route.slice(fallbackIndex) : "";

let failed = false;
function pass(message) { console.log("PASS:", message); }
function fail(message) { failed = true; console.error("FAIL:", message); }
function has(label, haystack, token) { haystack.includes(token) ? pass(label) : fail(`${label} missing ${token}`); }
function lacks(label, haystack, token) { !haystack.includes(token) ? pass(label) : fail(`${label} should not contain ${token}`); }

has("Blank Letterhead working-docx finalize flag exists", route, "const isBlankLetterheadWorkingDocumentFinalize =");
has("flag is direct matter only", route, 'uploadTargetMode === "direct-matter"');
has("flag requires working document drive item", route, "Boolean(workingDocumentDriveItemId)");
has("flag requires blank-letterhead requested key", route, 'clean(key).toLowerCase() === "blank-letterhead"');
has("flag respects workingDocumentKey", route, 'clean(workingDocumentKey).toLowerCase() === "blank-letterhead"');
has("packet validation gate bypasses only Blank Letterhead working-docx finalize", route, "if (!validation.canGenerate && !isBlankLetterheadWorkingDocumentFinalize)");
has("Blank Letterhead finalize fallback exists", route, "const blankLetterheadFinalizeFallbackDocument =");
has("fallback key is Blank Letterhead", route, 'key: "blank-letterhead"');
has("fallback is generation-capable", route, "wouldGenerate: true");
has("fallback is uploadable to Clio finalization path", route, "wouldUploadToClio: true");
has("fallback records edited working document source", route, "finalizedFromEditedWorkingDocument: true");
has("finalizable planned documents includes fallback", route, "const finalizableDocuments = blankLetterheadFinalizeFallbackDocument ? [blankLetterheadFinalizeFallbackDocument, ...plannedDocuments] : plannedDocuments;");
has("selected documents use finalizableDocuments", route, "const selectedDocuments = finalizableDocuments.filter");
has("document selection uses finalizablePlannedDocuments after fallback", postFallback, "finalizableDocuments.filter");
lacks("old unconditional packet validation gate removed", route, "if (!validation.canGenerate) {");

console.log("RESULT: Blank Letterhead working-docx finalize bypass verifier");
if (failed) process.exit(1);
