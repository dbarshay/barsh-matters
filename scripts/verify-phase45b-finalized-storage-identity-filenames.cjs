const fs = require("fs");

let failed = false;
function pass(message) { console.log("PASS: " + message); }
function fail(message) { failed = true; console.error("FAIL: " + message); }
function mustInclude(label, text, token) {
  if (text.includes(token)) pass(label);
  else fail(label + " missing token: " + token);
}
function mustNotInclude(label, text, token) {
  if (!text.includes(token)) pass(label);
  else fail(label + " unexpectedly includes token: " + token);
}

const route = fs.readFileSync("app/api/documents/finalize/route.ts", "utf8");

for (const token of [
  "function buildStorageIdentityFinalizedPdfFilename(",
  "function stripLegacyLeadingStorageToken(",
  "function normalizeFinalizedGenerationLabel(",
  "function finalizedGenerationSuffix(",
  "finalizedDocumentStorageIdentity",
  'uploadTargetMode === "direct-matter"',
  "directMatterDisplayNumber",
  "directMatterFileNumber",
  "masterLawsuitId",
  "documentGenerationLabel",
  "generationLabel",
  "generationType",
  "Generated",
  "already-uploaded-to-clio",
  "findExistingClioDocumentsByFilename",
  "allowDuplicateUploads",
  "duplicatePreventionDefault",
  "recordDocumentFinalizationAttempt",
]) {
  mustInclude("finalize route contains " + token, route, token);
}

const finalNameCalls = (route.match(/buildStorageIdentityFinalizedPdfFilename\(/g) || []).length;
if (finalNameCalls >= 2) pass("finalize route builds storage-identity PDF filenames for duplicate check and upload");
else fail("expected at least 2 buildStorageIdentityFinalizedPdfFilename calls, found " + finalNameCalls);

mustInclude("direct filenames use BRL_YYYYNNNNN storage identity candidate", route, "directMatterDisplayNumber");
mustInclude("lawsuit filenames use master lawsuit id storage identity candidate", route, "preview?.masterLawsuitId");
if (/\/\^BRL\\\\d\+\$\/i\.test\(first\)/.test(route) || /\/\^BRL\\d\+\$\/i\.test\(first\)/.test(route)) pass("legacy BRL display numbers are stripped from body");
else fail("legacy BRL display numbers are stripped from body");

if (/\/\^BRL_\\\\d\{9\}\$\/i\.test\(first\)/.test(route) || /\/\^BRL_\\d\{9\}\$\/i\.test\(first\)/.test(route)) pass("new direct file numbers are recognized");
else fail("new direct file numbers are recognized");

if (/\/\^\\\\d\{4\}\\\\\.\\\\d\{2\}\\\\\.\\\\d\{5\}\$\/\.test\(first\)/.test(route) || /\/\^\\d\{4\}\\\.\\d\{2\}\\\.\\d\{5\}\$\/\.test\(first\)/.test(route)) pass("lawsuit ids are recognized");
else fail("lawsuit ids are recognized");
mustInclude("original label is normalized for response semantics", route, "/^original$/i.test(label)");
mustInclude("default finalization timestamp suffix is created", route, " - Finalized ");
mustInclude("non-original generation creates labeled Finalized suffix", route, " - ${cleanLabel} - Finalized ");
mustInclude("true duplicate user message is exact", route, "This Document has Previously Been Uploaded. It Will Not Be Uploaded Again");
mustNotInclude("no force duplicate upload default added", route, "allowDuplicateUploads = true");

console.log("RESULT: Phase 45B finalized storage identity filename verifier");
if (failed) process.exit(1);
