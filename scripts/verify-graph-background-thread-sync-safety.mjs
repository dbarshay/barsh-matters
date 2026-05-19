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

console.log("=== GRAPH BACKGROUND THREAD SYNC SAFETY VERIFICATION ===");

const routePath = "app/api/graph/background-thread-sync/route.ts";
const route = read(routePath);
const packagePath = "package.json";
const pkg = read(packagePath);

console.log("\n=== VERIFY ROUTE IS FAIL-CLOSED / SCHEDULER-GUARDED ===");
[
  'const REQUIRED_CONFIRMATION = "background-graph-thread-sync"',
  "BARSH_MATTERS_BACKGROUND_EMAIL_SYNC_SECRET",
  "CRON_SECRET",
  "Authorization: Bearer",
  "Fail-closed background Graph thread sync",
  "requestIsConfirmed",
].forEach((marker) => mustContain(routePath, route, marker));

console.log("\n=== VERIFY ROUTE READS KNOWN LOCAL THREADS AND GRAPH ONLY BY CONVERSATION ID ===");
[
  "prisma.emailThread.findMany",
  "conversationId: { not: \"\" }",
  "graphFetchJson",
  "graphApiBase",
  "conversationId eq",
  "graphThreadMessagesUrl(config.mailboxUserId, conversationId",
  "Background known-thread sync only.",
].forEach((marker) => mustContain(routePath, route, marker));

console.log("\n=== VERIFY ROUTE PERSISTS LOCAL EMAIL METADATA ONLY ===");
[
  "persistGraphThreadSyncMessages",
  'source: "graph_background_thread_sync"',
  "EmailThread, EmailMessage, EmailAttachment, EmailMatterLink, and EmailFilingLog",
  "databaseRecordsChanged:",
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
mustContain(packagePath, pkg, "verify:graph-background-thread-sync-safety");

if (failures > 0) {
  console.error(`\n=== GRAPH BACKGROUND THREAD SYNC SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("\n=== GRAPH BACKGROUND THREAD SYNC SAFETY VERIFICATION PASSED ===");
console.log("Background sync route is limited to known local conversationId threads and persists local email metadata only.");
