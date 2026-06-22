const fs = require("fs");
const path = require("path");

let failed = false;
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const exists = (p) => fs.existsSync(path.join(root, p));
const pass = (m) => console.log("PASS: " + m);
const fail = (m) => { failed = true; console.error("FAIL: " + m); };
const contains = (label, text, token) => text.includes(token) ? pass(label) : fail(`${label} missing token: ${token}`);
const notContains = (label, text, token) => !text.includes(token) ? pass(label) : fail(`${label} contains forbidden token: ${token}`);

const routePath = "app/api/documents/working-docx/route.ts";
const docPath = "docs/template-generation-refactor/phase46b-requested-document-key-mismatch-guard.md";
const pkgPath = "package.json";

for (const p of [routePath, docPath, pkgPath]) {
  exists(p) ? pass(`required file exists: ${p}`) : fail(`missing required file: ${p}`);
}

const route = exists(routePath) ? read(routePath) : "";
const doc = exists(docPath) ? read(docPath) : "";
const pkg = exists(pkgPath) ? JSON.parse(read(pkgPath)) : { scripts: {} };

contains("route creates requestedDocument variable", route, "const requestedDocument =");
contains("route still reads documentKeys", route, "const requestedKeys = asStringArray(body?.documentKeys)");
contains("route hard-fails when requested key missing", route, "requestedKeys.length > 0 && !requestedDocument");
contains("route returns HTTP 422 for mismatch", route, "{ status: 422 }");
contains("route explains unavailable key", route, "Requested document key is not available for this matter/template context.");
contains("route returns requested keys", route, "requestedKeys,");
contains("route returns available document keys", route, "availableDocumentKeys");
contains("route returns planned document count", route, "plannedDocumentCount: plannedDocuments.length");
contains("route locks no fallback on requested mismatch", route, "allowsFallbackWhenRequestedKeyMissing: false");
contains("route documents fallback only without requested keys", route, "fallbackOnlyWhenNoRequestedKeys: true");
contains("route still permits fallback when no keys requested", route, "requestedDocument ||");
contains("route still falls back to available generation-ready doc", route, "document?.wouldGenerate && document?.availableNow");

contains("doc captures silent substitution problem", doc, "silent document substitution");
contains("doc captures summons to harmless issue", doc, "direct proof requested `summons-complaint`");
contains("doc captures HTTP 422 behavior", doc, "return HTTP 422");
contains("doc captures fallback-only-when-no-requested-keys rule", doc, "When no `documentKeys` are supplied");

if (pkg.scripts && pkg.scripts["verify:phase46b-requested-document-key-mismatch-guard"] === "node scripts/verify-phase46b-requested-document-key-mismatch-guard.cjs") {
  pass("package Phase 46B verifier script registered");
} else {
  fail("package Phase 46B verifier script missing");
}

for (const token of [
  "confirmUpload: true",
  "CONFIRM_LIVE_TERMINAL_FINALIZE=YES",
  "uploadBufferToClioMatterDocuments(",
  "documentTemplate.create(",
  "documentTemplate.update(",
  "documentTemplateVersion.create(",
  "documentPrintQueueItem.create("
]) {
  notContains(`doc no live/write marker ${token}`, doc, token);
}

if (failed) {
  console.error("FAIL: Phase 46B requested document-key mismatch guard verifier failed");
  process.exit(1);
}
console.log("PASS: Phase 46B requested document-key mismatch guard verifier passed");
