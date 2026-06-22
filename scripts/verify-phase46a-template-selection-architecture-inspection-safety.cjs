const fs = require("fs");
const path = require("path");

let failed = false;
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const exists = (p) => fs.existsSync(path.join(root, p));
const pass = (m) => console.log("PASS: " + m);
const fail = (m) => { failed = true; console.error("FAIL: " + m); };

function contains(label, text, token) {
  text.includes(token) ? pass(label) : fail(`${label} missing token: ${token}`);
}
function notContains(label, text, token) {
  !text.includes(token) ? pass(label) : fail(`${label} contains forbidden token: ${token}`);
}

const docPath = "docs/template-generation-refactor/phase46a-template-selection-architecture-inspection.md";
const directPreviewPath = "app/api/documents/direct-finalize-preview/route.ts";
const masterPreviewPath = "app/api/documents/finalize-preview/route.ts";
const workingDocxPath = "app/api/documents/working-docx/route.ts";
const templatesRoutePath = "app/api/documents/templates/route.ts";
const storedDocxPath = "app/api/documents/templates/stored-docx/route.ts";
const generatePreviewPath = "app/api/documents/generate-preview/route.ts";
const pkgPath = "package.json";

for (const p of [docPath, directPreviewPath, masterPreviewPath, workingDocxPath, templatesRoutePath, storedDocxPath, generatePreviewPath, pkgPath]) {
  exists(p) ? pass(`required file exists: ${p}`) : fail(`missing required file: ${p}`);
}

const doc = exists(docPath) ? read(docPath) : "";
const directPreview = exists(directPreviewPath) ? read(directPreviewPath) : "";
const masterPreview = exists(masterPreviewPath) ? read(masterPreviewPath) : "";
const workingDocx = exists(workingDocxPath) ? read(workingDocxPath) : "";
const templatesRoute = exists(templatesRoutePath) ? read(templatesRoutePath) : "";
const storedDocx = exists(storedDocxPath) ? read(storedDocxPath) : "";
const generatePreview = exists(generatePreviewPath) ? read(generatePreviewPath) : "";
const pkg = exists(pkgPath) ? JSON.parse(read(pkgPath)) : { scripts: {} };

for (const token of [
  "Inspection lock only",
  "database-first",
  "Stored DB DOCX versions",
  "Direct finalize-preview currently has a narrower document plan",
  "Why direct requested `summons-complaint` but selected `harmless-stored-docx-test-template`",
  "requested document-key mismatch should hard-fail instead of falling back silently",
  "This inspection phase documents existing behavior only"
]) {
  contains(`doc captures finding: ${token}`, doc, token);
}

contains("templates route reads database templates first", templatesRoute, "let templates = await readDatabaseTemplates(category)");
contains("templates route falls back only when no category rows exist", templatesRoute, "if (templates.length === 0)");
contains("stored DOCX route uses DocumentTemplateVersion", storedDocx, "documentTemplateVersion.findUnique");
contains("stored DOCX route enforces DB DOCX storage kind", storedDocx, 'version.storageKind !== "db-docx-base64"');
contains("master preview builds stored DB template docs", masterPreview, "buildStoredDbDocxTemplateDocuments");
contains("master preview includes summons placeholder", masterPreview, 'key: "summons-complaint"');
contains("master preview spreads stored DB docs before placeholders", masterPreview, "...storedDbTemplateDocuments");
contains("master preview keeps placeholder docs after stored DB docs", masterPreview, "...placeholderDocuments");
contains("direct preview limits categories to direct/general", directPreview, 'in: ["direct_matter", "general"]');
notContains("direct preview does not hardcode summons placeholder", directPreview, 'key: "summons-complaint"');
contains("working-docx collects requested document keys", workingDocx, "const requestedKeys = asStringArray(body?.documentKeys)");
contains("working-docx first tries requested key", workingDocx, "requestedKeys.includes(clean(document?.key))");
contains("working-docx then falls back to available generated document", workingDocx, "document?.wouldGenerate && document?.availableNow");
contains("generate-preview currently exports GET", generatePreview, "export async function GET");

if (pkg.scripts && pkg.scripts["verify:phase46a-template-selection-architecture-inspection-safety"] === "node scripts/verify-phase46a-template-selection-architecture-inspection-safety.cjs") {
  pass("package Phase 46A verifier script registered");
} else {
  fail("package Phase 46A verifier script missing");
}

for (const [label, text] of [
  ["doc", doc],
  ["verifier", read("scripts/verify-phase46a-template-selection-architecture-inspection-safety.cjs")]
]) {
  for (const forbidden of [
    "confirmUpload: true",
    "CONFIRM_LIVE_TERMINAL_FINALIZE=YES",
    "uploadBufferToClioMatterDocuments(",
    "documentTemplate.create(",
    "documentTemplate.update(",
    "documentTemplateVersion.create(",
    "sendMail",
    "documentPrintQueueItem.create("
  ]) {
    notContains(`${label} no side-effect marker ${forbidden}`, text, forbidden);
  }
}

if (failed) {
  console.error("FAIL: Phase 46A template selection architecture inspection safety verifier failed");
  process.exit(1);
}
console.log("PASS: Phase 46A template selection architecture inspection safety verifier passed");
