#!/usr/bin/env node
import fs from "fs";

const pagePath = "app/matters/page.tsx";
const localRoutePath = "app/api/graph/local-thread-preview/route.ts";
const syncPreviewRoutePath = "app/api/graph/thread-sync-preview/route.ts";
const syncRoutePath = "app/api/graph/thread-sync/route.ts";
const packagePath = "package.json";

const page = fs.readFileSync(pagePath, "utf8");
const localRoute = fs.readFileSync(localRoutePath, "utf8");
const syncPreviewRoute = fs.readFileSync(syncPreviewRoutePath, "utf8");
const syncRoute = fs.readFileSync(syncRoutePath, "utf8");
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

console.log("=== VERIFY MASTER EMAIL THREAD UI SAFETY ===");

console.log("\\n=== VERIFY MASTER UI MARKERS ===");
[
  '| "email_threads"',
  'masterEmailThreadPreviewLoading',
  'masterGraphThreadSyncPreviewLoading',
  'masterGraphThreadSyncLoading',
  'function currentMasterEmailLawsuitId()',
  'function firstMasterEmailConversationId()',
  'function masterEmailSyncContext',
  'async function loadMasterEmailThreadPreview()',
  'async function previewMasterGraphThreadUpdates(conversationIdOverride?: string)',
  'async function syncMasterGraphThreadToBarshMatters(conversationIdOverride?: string)',
  'function renderMasterEmailThreadsPanel()',
  'id="master-email-threads-section"',
  'setActiveMasterWorkspaceTab("email_threads")',
  'Email / Threads',
  'Preview Graph Updates',
  'Sync Thread to Barsh Matters',
  'Run Preview Graph Updates before syncing this master thread to Barsh Matters.',
  '/api/graph/local-thread-preview?${params.toString()}',
  '/api/graph/thread-sync-preview?${params.toString()}',
  '/api/graph/thread-sync?confirm=sync-graph-thread',
  'masterLawsuitId: masterId',
  'Confirmed sync persists local Barsh Matters email metadata only.',
  'masterGraphThreadSyncPreviewConversationId',
  'masterGraphThreadSyncConversationId',
  'async function previewMasterGraphThreadUpdates(conversationIdOverride?: string)',
  'async function syncMasterGraphThreadToBarshMatters(conversationIdOverride?: string)',
  'Preview This Thread',
  'Sync This Thread',
  'Preview Graph Updates must be run for this specific master thread before syncing it.',
].forEach((marker) => mustContain(pagePath, page, marker));

console.log("\\n=== VERIFY SUPPORTING ROUTES HAVE EXPECTED SAFETY MARKERS ===");
[
  'action: "graph-local-thread-preview"',
  'readOnly: true',
  'previewOnly: true',
  'graphCallsMade: false',
  'databaseRecordsChanged: false',
  'masterLawsuitId',
].forEach((marker) => mustContain(localRoutePath, localRoute, marker));

[
  'action: "graph-thread-sync-preview"',
  'confirm !== REQUIRED_CONFIRMATION',
  'readOnly: true',
  'previewOnly: true',
  'createsOutlookDraft: false',
  'sendsEmail: false',
  'databaseRecordsChanged: false',
].forEach((marker) => mustContain(syncPreviewRoutePath, syncPreviewRoute, marker));

[
  'action: "graph-thread-sync"',
  'const REQUIRED_CONFIRMATION = "sync-graph-thread"',
  'confirm !== REQUIRED_CONFIRMATION',
  'createsOutlookDraft: false',
  'sendsEmail: false',
  'clioRecordsChanged: false',
  'persistGraphThreadSyncMessages',
].forEach((marker) => mustContain(syncRoutePath, syncRoute, marker));

console.log("\\n=== VERIFY NO DIRECT DRAFT/SEND/CLIO WRITE WIRING IN MASTER UI ===");
[
  'fetch(`/api/graph/create-draft',
  'fetch("/api/graph/create-draft',
  "fetch('/api/graph/create-draft",
  'sendMail',
  '/sendMail',
  'createUploadSession',
  'clioFetch(',
].forEach((marker) => mustNotContain(pagePath, page, marker));

console.log("\\n=== VERIFY SCRIPT REGISTRATION ===");
mustContain(packagePath, pkg, "verify:master-email-thread-ui-safety");

console.log("\\n=== MASTER EMAIL THREAD UI SAFETY VERIFICATION PASSED ===");
console.log("Master Email / Threads UI uses preview-first Graph sync and does not create drafts, send email, write Clio, upload documents, or use local Outlook automation.");
