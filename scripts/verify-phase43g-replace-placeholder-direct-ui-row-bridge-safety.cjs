const fs = require("fs");
const path = require("path");
let failed = false;
const pass = (m) => console.log("PASS: " + m);
const fail = (m) => { failed = true; console.error("FAIL: " + m); };
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const exists = (p) => fs.existsSync(path.join(root, p));
function contains(label, text, token) { text.includes(token) ? pass(label) : fail(label + " missing token: " + token); }
function notContains(label, text, token) { !text.includes(token) ? pass(label) : fail(label + " contains forbidden token: " + token); }

const docPath = "docs/clio-storage-refactor/phase43g-replace-placeholder-direct-ui-row-bridge.md";
for (const f of [docPath, "app/matters/page.tsx", "package.json"]) {
  exists(f) ? pass("required Phase 43G file exists: " + f) : fail("missing required Phase 43G file: " + f);
}

const doc = read(docPath);
const page = read("app/matters/page.tsx");
const pkg = JSON.parse(read("package.json"));

for (const token of [
  "Phase 43G",
  "Replace Placeholder Direct UI Row Bridge",
  "directMatterSingleMasterDryRunSurfaceRow()",
  "first non-master direct matter row",
  "confirmUpload: false",
  "singleMasterDryRun: true",
  "singleMasterResolveFolders: true",
  "no live upload is enabled"
]) contains("doc contains " + token, doc, token);

for (const token of [
  "function directMatterSingleMasterDryRunSurfaceRow(): MatterRow | null",
  "const directRows = rows.filter",
  "!row.isMaster",
  "!row.is_master",
  "return directRows[0] || rows[0] || null",
  "const phase43fDirectMatterDryRunRow = directMatterSingleMasterDryRunSurfaceRow()",
  "phase43fDirectMatterDryRunRow ? renderDirectMatterSingleMasterDryRunControlForRow(phase43fDirectMatterDryRunRow) : null",
  "phase43f-direct-matter-ui-surface-attachment",
  "directMatterSingleMasterDryRunControlEnabled = false"
]) contains("matters page contains Phase 43G row bridge token " + token, page, token);

notContains("matters page no longer uses inline rows[0] placeholder in Phase 43F attachment", page, "rows[0] ? renderDirectMatterSingleMasterDryRunControlForRow(rows[0] as MatterRow) : null");

const resolverStart = page.indexOf("function directMatterSingleMasterDryRunSurfaceRow");
const resolverEnd = page.indexOf("function renderDirectMatterSingleMasterDryRunControlForRow", resolverStart);
const resolverBlock = resolverStart >= 0 && resolverEnd > resolverStart ? page.slice(resolverStart, resolverEnd) : "";
contains("resolver block captured", resolverBlock, "directMatterSingleMasterDryRunSurfaceRow");
contains("resolver block filters rows", resolverBlock, "rows.filter");
contains("resolver block excludes master rows", resolverBlock, "!row.isMaster");
contains("resolver block falls back safely", resolverBlock, "return directRows[0] || rows[0] || null");
notContains("resolver block does not include masterLawsuitId", resolverBlock, "masterLawsuitId");
notContains("resolver block does not call finalize", resolverBlock, "/api/documents/finalize");

const bridgeStart = page.indexOf("function renderDirectMatterSingleMasterDryRunControlForRow");
const bridgeEnd = page.indexOf("function masterDocumentPreviewText", bridgeStart);
const bridgeBlock = bridgeStart >= 0 && bridgeEnd > bridgeStart ? page.slice(bridgeStart, bridgeEnd) : "";
contains("bridge block still passes row id", bridgeBlock, "directMatterId: row.id");
contains("bridge block still passes row display number", bridgeBlock, "directMatterDisplayNumber: row.displayNumber");
contains("bridge block still forces no upload", bridgeBlock, "confirmUpload: false");
contains("bridge block still forces dry-run", bridgeBlock, "singleMasterDryRun: true");
notContains("bridge block still does not include masterLawsuitId", bridgeBlock, "masterLawsuitId");
notContains("bridge block still does not hard-code confirmUpload true", bridgeBlock, "confirmUpload: true");

contains("package Phase 43G verifier registered", JSON.stringify(pkg.scripts || {}), "verify:phase43g-replace-placeholder-direct-ui-row-bridge-safety");
console.log("CONTRACT: Phase 43G replaces placeholder row bridge, still disabled/no-upload.");
console.log("RESULT: Phase 43G replace placeholder direct UI row bridge verifier");
if (failed) process.exit(1);
