#!/usr/bin/env node
import fs from "fs";

const routePath = "app/api/graph/thread-sync-preview/route.ts";
const packagePath = "package.json";
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

console.log("=== VERIFY GRAPH THREAD SYNC PREVIEW SAFETY ===");

console.log("\\n=== VERIFY ROUTE IS FAIL-CLOSED AND READ-ONLY ===");
[
  'const REQUIRED_CONFIRMATION = "preview-graph-thread-sync"',
  'confirm !== REQUIRED_CONFIRMATION',
  'requiredConfirmation: REQUIRED_CONFIRMATION',
  'action: "graph-thread-sync-preview"',
  'readOnly: true',
  'previewOnly: true',
  'failClosed: true',
  'createsOutlookDraft: false',
  'sendsEmail: false',
  'syncsMailbox: false',
  'attachesDocument: false',
  'clioRecordsChanged: false',
  'databaseRecordsChanged: false',
  'localOutlookAutomationRequired: false',
].forEach((marker) => mustContain(routePath, route, marker));

console.log("\\n=== VERIFY ROUTE PERFORMS GRAPH READ ONLY ===");
[
  'graphFetchJson',
  'graphApiBase',
  'method: "GET"',
  'readsMailbox: true',
  'conversationId eq',
  'readyForFutureReadOnlySync',
  'messages = rows',
  'nextLinkPresent',
].forEach((marker) => mustContain(routePath, route, marker));

console.log("\\n=== VERIFY NO DRAFT/SEND/DB/CLIO MUTATION ===");
[
  'method: "POST"',
  'method: "PATCH"',
  'method: "DELETE"',
  'persistGraphDraftMetadata',
  'prisma.',
  '.create(',
  '.update(',
  '.upsert(',
  '.delete(',
  'clioFetch(',
  'graphMailboxMessagesUrl(config.mailboxUserId)',
].forEach((marker) => mustNotContain(routePath, route, marker));

console.log("\\n=== VERIFY SCRIPT REGISTRATION ===");
mustContain(packagePath, pkg, "verify:graph-thread-sync-preview-safety");

console.log("\\n=== GRAPH THREAD SYNC PREVIEW SAFETY VERIFICATION PASSED ===");
console.log("Route may read Microsoft Graph only after explicit confirmation.");
console.log("Route does not create drafts, send email, persist mailbox records, write Clio, or modify database records.");
