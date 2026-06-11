import fs from "fs";

let failures = 0;

function read(path) {
  try {
    return fs.readFileSync(path, "utf8");
  } catch {
    console.error(`FAIL: missing file ${path}`);
    failures += 1;
    return "";
  }
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  failures += 1;
}

function mustContain(label, text, needle) {
  text.includes(needle) ? pass(`${label}: found ${needle}`) : fail(`${label}: missing ${needle}`);
}

function mustNotContain(label, text, needle) {
  !text.includes(needle) ? pass(`${label}: avoids ${needle}`) : fail(`${label}: forbidden ${needle}`);
}

const pkg = JSON.parse(read("package.json"));

console.log("=== VERIFY THE GOLDEN RULE CLIO BOUNDARY SAFETY ===");

const requiredScripts = [
  "verify:create-lawsuit-clio-shell-contract",
  "verify:clio-document-list-readonly-safety",
  "verify:clio-document-list-ui-safety",
  "verify:clio-maildrop-resolve-source-scope-safety",
  "verify:graph-create-draft-safety",
  "verify:graph-draft-persistence-safety",
  "verify:local-close-workflows-safety",
];

for (const script of requiredScripts) {
  if (pkg.scripts?.[script]) pass(`package.json registers ${script}`);
  else fail(`package.json missing ${script}`);
}

const graphDraft = read("app/api/graph/create-draft/route.ts");
mustContain("Graph draft", graphDraft, "clioFetch");
mustContain("Graph draft", graphDraft, "listClioMatterDocuments");
mustContain("Graph draft", graphDraft, "resolveMaildropForGraphDraftMatterId");
mustContain("Graph draft", graphDraft, "clioMaildropEmail");
mustContain("Graph draft", graphDraft, "let cc = normalizeGraphRecipients");
mustContain("Graph draft", graphDraft, "context.clioMaildropEmail");
mustContain("Graph draft", graphDraft, "email: context.clioMaildropEmail");
mustContain("Graph draft", graphDraft, "clioRecordsChanged: false");
mustContain("Graph draft", graphDraft, "/api/v4/documents/");
mustContain("Graph draft", graphDraft, "/api/v4/document_versions/");
mustNotContain("Graph draft", graphDraft, "updateMatterCustomFields");
mustNotContain("Graph draft", graphDraft, "upsertClaimIndexFromMatter");
mustNotContain("Graph draft", graphDraft, "ingestMattersFromClioBatch");
mustNotContain("Graph draft", graphDraft, "method: \"PATCH\"");
mustNotContain("Graph draft", graphDraft, "method: \"DELETE\"");

const templateRoutes = [
  "app/api/documents/templates/route.ts",
  "app/api/documents/templates/detail/route.ts",
  "app/api/documents/templates/import-preview/route.ts",
  "app/api/documents/templates/import-confirm/route.ts",
  "app/api/documents/templates/replace-version/route.ts",
  "app/api/documents/templates/stored-docx/route.ts",
];

for (const file of templateRoutes) {
  const text = read(file);
  mustNotContain(file, text, "@/lib/clio");
  mustNotContain(file, text, "clioFetch(");
  mustNotContain(file, text, "uploadDocumentToClio");
  mustNotContain(file, text, "/api/v4/documents");
}

const legacyBlocked = read("lib/legacyClioOperationalRouteBlocked.ts");
mustContain("legacy Clio block helper", legacyBlocked, "writesClio: false");
mustContain("legacy Clio block helper", legacyBlocked, "updatesClaimIndex: false");

const blockedRoutes = [
  "app/api/aggregate/route.ts",
  "app/api/deaggregate/route.ts",
  "app/api/aggregation/build-lawsuit/route.ts",
  "app/api/aggregation/from-search/route.ts",
  "app/api/aggregation/add-matters/route.ts",
  "app/api/aggregation/expand-claim/route.ts",
  "app/api/aggregation/find-siblings/route.ts",
  "app/api/claim-index/rebuild/route.ts",
  "app/api/claim-index/refresh-cluster/route.ts",
  "app/api/advanced-search/hydrate/route.ts",
];

for (const file of blockedRoutes) {
  const text = read(file);
  mustContain(file, text, "legacyClioOperationalRouteBlocked");
}

const matterClose = read("app/api/matters/close/route.ts");
mustContain("matter close", matterClose, "noClioWrite: true");
mustContain("matter close", matterClose, "noClioRead: true");
// Temporary current-state marker: close decision is local-first today.
// The Golden Rule requires future guarded Clio close sync from Barsh Matters close workflows.
pass("matter close current-state inspected; The Golden Rule requires Clio close sync implementation next.");

const settlementClose = read("app/api/settlements/close/route.ts");
mustContain("settlement close shortcut", settlementClose, "legacyClioOperationalRouteBlocked");
pass("settlement close shortcut remains blocked; close sync belongs in guarded Close Matter / Close Lawsuit workflows.");

console.log("");
console.log("GOLDEN_RULE_CLIO_BOUNDARY=Clio owns IDs/numbers/document vault/MailDrop/operational close status; Barsh Matters owns workflows/local records/templates.");
console.log("ALLOWED_CLIO_SCOPE=matter shell creation, lawsuit shell creation, document storage/retrieval, MailDrop, guarded close-status sync.");
console.log("BLOCKED_CLIO_SCOPE=legacy hidden aggregation/deaggregation, generic hidden matter mutation, ClaimIndex hydration dependency, settlement close shortcut.");
console.log("DOCUMENT_TEMPLATE_SOURCE_OF_TRUTH=Barsh Matters local DocumentTemplate tables and DB-stored DOCX versions.");
console.log("MAILDROP_RECIPIENT_RULE=MailDrop belongs in visible CC, not hidden BCC, so reply threads preserve the filing address.");

if (failures) {
  console.error(`=== GOLDEN RULE CLIO BOUNDARY SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== GOLDEN RULE CLIO BOUNDARY SAFETY PASSED ===");
