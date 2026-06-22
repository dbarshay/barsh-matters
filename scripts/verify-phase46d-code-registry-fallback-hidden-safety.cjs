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

const routePath = "app/api/documents/templates/route.ts";
const docPath = "docs/template-generation-refactor/phase46d-code-registry-fallback-hidden-by-default.md";
const pkgPath = "package.json";

for (const p of [routePath, docPath, pkgPath]) {
  exists(p) ? pass(`required file exists: ${p}`) : fail(`missing required file: ${p}`);
}

const route = exists(routePath) ? read(routePath) : "";
const doc = exists(docPath) ? read(docPath) : "";
const pkg = exists(pkgPath) ? JSON.parse(read(pkgPath)) : { scripts: {} };

contains("route remains database-first", route, "let templates = await readDatabaseTemplates(category)");
contains("route has explicit query opt-in", route, 'includeFallbackRegistry") === "1"');
contains("route has explicit env opt-in", route, "BARSH_DOCUMENT_TEMPLATE_ALLOW_CODE_REGISTRY_FALLBACK");
contains("route allows fallback only when opted in", route, "templates.length === 0 && allowFallbackRegistry");
contains("route suppresses fallback when no DB rows and no opt-in", route, "fallbackSuppressed = true");
contains("route reports fallback suppressed", route, "fallbackSuppressed");
contains("route reports fallback hidden by default", route, "codeRegistryFallbackHiddenByDefault: true");
contains("route reports opt-in requirement", route, "codeRegistryFallbackRequiresExplicitOptIn: true");
contains("route explains empty normal response", route, "Code-registry fallback templates are hidden by default after test template cleanup");
contains("route still contains fallback helper for explicit opt-in", route, "fallbackRegistryTemplates(category)");

contains("doc states fallback hidden by default", doc, "code-registry fallback templates are hidden by default");
contains("doc states explicit query opt-in", doc, "includeFallbackRegistry=1");
contains("doc states explicit env opt-in", doc, "BARSH_DOCUMENT_TEMPLATE_ALLOW_CODE_REGISTRY_FALLBACK=1");
contains("doc says normal behavior returns empty list", doc, "normal behavior returns an empty template list");
contains("doc states no DB template writes", doc, "create or delete database template rows");

if (pkg.scripts && pkg.scripts["verify:phase46d-code-registry-fallback-hidden-safety"] === "node scripts/verify-phase46d-code-registry-fallback-hidden-safety.cjs") {
  pass("package Phase 46D verifier script registered");
} else {
  fail("package Phase 46D verifier script missing");
}

for (const token of [
  "documentTemplate.create(",
  "documentTemplate.update(",
  "documentTemplate.delete",
  "documentTemplateVersion.create(",
  "confirmUpload: true",
  "CONFIRM_LIVE_TERMINAL_FINALIZE=YES",
  "uploadBufferToClioMatterDocuments(",
  "documentPrintQueueItem.create("
]) {
  notContains(`doc no live/write marker ${token}`, doc, token);
}

if (failed) {
  console.error("FAIL: Phase 46D code-registry fallback hidden safety verifier failed");
  process.exit(1);
}
console.log("PASS: Phase 46D code-registry fallback hidden safety verifier passed");
