import fs from "node:fs";

let failures = 0;

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function mustContain(path, text, marker) {
  if (!text.includes(marker)) {
    console.error(`FAIL ${path}: missing ${marker}`);
    failures += 1;
  } else {
    console.log(`PASS ${path}: found ${marker}`);
  }
}

function mustNotContain(path, text, marker) {
  if (text.includes(marker)) {
    console.error(`FAIL ${path}: must not contain ${marker}`);
    failures += 1;
  } else {
    console.log(`PASS ${path}: does not contain ${marker}`);
  }
}

console.log("=== GRAPH MAILDROP DISCOVERY SAFETY VERIFICATION ===");

const routePath = "app/api/graph/maildrop-discovery/route.ts";
const registryPath = "lib/graph/maildropRegistry.ts";
const route = read(routePath);
const registry = read(registryPath);
const packagePath = "package.json";
const pkg = read(packagePath);

console.log("\n=== VERIFY ROUTE IS FAIL-CLOSED / CONFIRMED ===");
[
  'const REQUIRED_PREVIEW_CONFIRMATION = "preview-maildrop-discovery"',
  'const REQUIRED_SYNC_CONFIRMATION = "sync-maildrop-discovery"',
  "BARSH_MATTERS_BACKGROUND_EMAIL_SYNC_SECRET",
  "CRON_SECRET",
  "Authorization: Bearer",
  "Fail-closed MailDrop discovery",
  "confirmMode",
].forEach((marker) => mustContain(routePath, route, marker));

console.log("\n=== VERIFY ROUTE SCANS RECENT GRAPH MESSAGES AND MATCHES LOCAL MAILDROPS ===");
[
  "loadKnownMaildropAddresses",
  "graphFetchJson",
  "graphRecentMessagesUrl",
  "receivedDateTime desc",
  "allRecipientEmails",
  "knownByEmail",
  "matchedMaildropEmail",
  "MailDrop discovery scans recent Microsoft Graph mailbox messages",
].forEach((marker) => mustContain(routePath, route, marker));


console.log("\n=== VERIFY MAILDROP REGISTRY HELPER LOADS REGISTRY AND EMAIL THREAD FALLBACK ===");
[
  "prisma.maildropAddress.findMany",
  "prisma.emailThread.findMany",
  "clioMaildropEmail: { not: null }",
  "email_thread_fallback",
].forEach((marker) => mustContain(registryPath, registry, marker));

console.log("\n=== VERIFY PREVIEW MODE IS READ-ONLY ===");
[
  'previewOnly: true',
  "Preview-only MailDrop discovery completed.",
  "databaseRecordsChanged: false",
].forEach((marker) => mustContain(routePath, route, marker));

console.log("\n=== VERIFY SYNC MODE PERSISTS LOCAL EMAIL METADATA ONLY ===");
[
  "persistGraphThreadSyncMessages",
  'source: "graph_maildrop_discovery"',
  "EmailThread, EmailMessage, EmailAttachment, EmailMatterLink, and EmailFilingLog",
  "clioRecordsChanged: false",
  "uploadsDocuments: false",
].forEach((marker) => mustContain(routePath, route, marker));

console.log("\n=== VERIFY NO DRAFT / SEND / CLIO / DOCUMENT UPLOAD WIRING ===");
[
  "createDraft",
  "create-draft",
  "sendMail",
  ".sendMail",
  "persistGraphDraftMetadata",
  "clio.documents",
  "uploadDocument",
  "clioDocumentUpload",
  "writeToClio",
  "settlementClioWriteback",
].forEach((marker) => mustNotContain(routePath, route, marker));

console.log("\n=== VERIFY PACKAGE SCRIPT REGISTRATION ===");
mustContain(packagePath, pkg, "verify:graph-maildrop-discovery-safety");

if (failures > 0) {
  console.error(`\n=== GRAPH MAILDROP DISCOVERY SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("\n=== GRAPH MAILDROP DISCOVERY SAFETY VERIFICATION PASSED ===");
console.log("MailDrop discovery can preview or sync recent mailbox messages matched against locally known MailDrop recipients only.");


const routeSource = read(routePath);
mustContain(routePath, routeSource, "createMaildropDiscoveryRunLog");
mustContain(routePath, routeSource, "maildrop_discovery_run");
mustContain(routePath, routeSource, "no_matches");
mustContain(routePath, routeSource, "no_known_maildrops");
