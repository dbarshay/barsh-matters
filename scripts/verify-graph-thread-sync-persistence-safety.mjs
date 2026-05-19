#!/usr/bin/env node
import fs from "fs";

const helperPath = "lib/graph/emailPersistence.ts";
const routePath = "app/api/graph/thread-sync/route.ts";
const packagePath = "package.json";

const helper = fs.readFileSync(helperPath, "utf8");
const route = fs.readFileSync(routePath, "utf8");
const pkg = fs.readFileSync(packagePath, "utf8");

function mustContain(label, text, marker) {
  if (!text.includes(marker)) {
    console.error(`FAIL: ${label} missing marker: ${marker}`);
    process.exit(1);
  }
  console.log(`PASS: ${label} found ${marker}`);
}

function mustNotContain(label, text, marker) {
  if (text.includes(marker)) {
    console.error(`FAIL: ${label} must not contain marker: ${marker}`);
    process.exit(1);
  }
  console.log(`PASS: ${label} does not contain ${marker}`);
}

console.log("=== VERIFY GRAPH THREAD SYNC PERSISTENCE SAFETY ===");

console.log("\\n=== VERIFY ROUTE IS FAIL-CLOSED AND CONFIRMED ===");
[
  'export async function POST',
  'const REQUIRED_CONFIRMATION = "sync-graph-thread"',
  'confirm !== REQUIRED_CONFIRMATION',
  'requiredConfirmation: REQUIRED_CONFIRMATION',
  'action: "graph-thread-sync"',
  'failClosed: true',
  'createsOutlookDraft: false',
  'sendsEmail: false',
  'attachesDocument: false',
  'clioRecordsChanged: false',
  'localOutlookAutomationRequired: false',
  '/api/graph/thread-sync-preview',
].forEach((marker) => mustContain(routePath, route, marker));

console.log("\\n=== VERIFY ROUTE READS GRAPH AND PERSISTS ONLY LOCAL EMAIL METADATA ===");
[
  'graphFetchJson',
  'graphApiBase',
  'method: "GET"',
  'readsMailbox: true',
  'syncsMailbox: true',
  'databaseRecordsChanged: true',
  'persistGraphThreadSyncMessages',
  'localContextForConversation',
  'prisma.emailThread.findFirst',
].forEach((marker) => mustContain(routePath, route, marker));

console.log("\\n=== VERIFY HELPER UPSERTS LOCAL EMAIL RECORDS ONLY ===");
[
  'persistGraphThreadSyncMessages',
  'prisma.emailThread.upsert',
  'prisma.emailMessage.upsert',
  'prisma.emailMatterLink.findFirst',
  'prisma.emailMatterLink.create',
  'prisma.emailFilingLog.create',
  'graph_thread_sync_persisted',
  'databaseChanged: true',
  'clioRecordsChanged: false',
  'attachmentMetadataOnly: true',
].forEach((marker) => mustContain(helperPath, helper, marker));

console.log("\\n=== VERIFY NO EMAIL SEND / DRAFT CREATE / CLIO / DOCUMENT UPLOAD ===");
[
  'sendMail',
  '/sendMail',
  'createUploadSession',
  'clioFetch(',
  'uploadBufferToClio',
  'uploadBufferToClioMatterDocuments',
  'method: "PATCH"',
  'method: "DELETE"',
].forEach((marker) => {
  mustNotContain(routePath, route, marker);
  mustNotContain(helperPath, helper, marker);
});

mustNotContain(routePath, route, 'method: "POST",');
mustNotContain(routePath, route, 'graphMailboxMessagesUrl(config.mailboxUserId)');

console.log("\\n=== VERIFY SCRIPT REGISTRATION ===");
mustContain(packagePath, pkg, "verify:graph-thread-sync-persistence-safety");

console.log("\\n=== GRAPH THREAD SYNC PERSISTENCE SAFETY VERIFICATION PASSED ===");
console.log("Confirmed sync can persist normalized local email metadata only after explicit confirmation.");
console.log("Confirmed sync does not create drafts, send email, write Clio, upload documents, or use local Outlook automation.");
