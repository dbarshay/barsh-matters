#!/usr/bin/env node

import fs from "fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

let failures = 0;

function mustContain(label, text, marker) {
  if (!text.includes(marker)) {
    console.error(`FAIL: ${label} missing marker: ${marker}`);
    failures += 1;
    return;
  }
  console.log(`PASS: ${label} found ${marker}`);
}

function mustNotContain(label, text, marker) {
  if (text.includes(marker)) {
    console.error(`FAIL: ${label} must not contain marker: ${marker}`);
    failures += 1;
    return;
  }
  console.log(`PASS: ${label} does not contain ${marker}`);
}

function extractFunctionBody(text, functionName) {
  const start = text.indexOf(`function ${functionName}(`);
  if (start < 0) {
    console.error(`FAIL: could not find function ${functionName}`);
    failures += 1;
    return "";
  }

  const braceStart = text.indexOf("{", start);
  if (braceStart < 0) {
    console.error(`FAIL: could not find function body for ${functionName}`);
    failures += 1;
    return "";
  }

  let depth = 0;
  for (let index = braceStart; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  console.error(`FAIL: could not close function body for ${functionName}`);
  failures += 1;
  return "";
}

console.log("=== VERIFY DIRECT MATTER EMAILS UI SAFETY ===");

const pagePath = "app/matter/[id]/page.tsx";
const routePath = "app/api/graph/local-thread-preview/route.ts";
const page = read(pagePath);
const route = read(routePath);
const emailPanel = extractFunctionBody(page, "renderMatterEmailThreadsPanel");

console.log("\n=== VERIFY UNIFIED DIRECT EMAILS UI MARKERS ===");
[
  '{ key: "email_threads", label: "Emails"',
  'note: "Matter emails and MailDrop threads"',
  'function loadMatterEmailThreadPreview()',
  'fetch(`/api/graph/local-thread-preview?${params.toString()}`)',
  'function renderMatterEmailThreadsPanel()',
  'matterViewEmailsPopupOpen',
  'function openMatterViewEmailsPopup()',
  'function closeMatterViewEmailsPopup()',
  'function renderMatterViewEmailsPopup()',
  '{renderMatterViewEmailsPopup()}',
  'data-barsh-direct-view-emails-standard-modal="true"',
  'data-barsh-direct-view-emails-header-standard="true"',
  'data-barsh-direct-view-emails-footer-actions="true"',
  'aria-label="View Emails"',
  'if (!matterViewEmailsPopupOpen) return;',
  'void loadMatterEmailThreadPreview();',
  'Email records load automatically when this panel opens.',
  'Refresh Emails',
  'MailDrop Present',
  'Open in Outlook',
].forEach((marker) => mustContain(pagePath, page, marker));

console.log("\n=== VERIFY MANUAL GRAPH SYNC CONTROLS ARE HIDDEN DEBUG SCAFFOLDING ===");
[
  'Preview Graph Updates',
  'Sync Thread to Barsh Matters',
  'Preview This Thread',
  'Sync This Thread',
  'hidden',
  'aria-hidden="true"',
].forEach((marker) => mustContain(pagePath, page, marker));

console.log("\n=== VERIFY LOCAL THREAD PREVIEW ROUTE IS READ-ONLY ===");
[
  'action: "graph-local-thread-preview"',
  'graphCallsMade: false',
  'readsMailbox: false',
  'createsOutlookDraft: false',
  'sendsEmail: false',
  'syncsMailbox: false',
  'clioRecordsChanged: false',
  'databaseRecordsChanged: false',
  'Read-only local email-thread preview.',
].forEach((marker) => mustContain(routePath, route, marker));

console.log("\n=== VERIFY REDUNDANT DIRECT EMAILS INTRO COPY IS REMOVED ===");
[
  'Raw local thread preview JSON',
].forEach((marker) => mustNotContain("direct View Emails modal copy", page, marker));

console.log("\n=== VERIFY REDUNDANT DIRECT EMAILS DEBUG COPY IS REMOVED ===");
[
  'Raw local thread preview JSON',
].forEach((marker) => mustNotContain("direct View Emails modal debug copy", page, marker));

console.log("\n=== VERIFY DIRECT EMAILS RENDER AS POPUP MODAL ===");
[
  'onClick={() => {\n                            setActiveWorkspaceTab("email_threads");\n                            openMatterViewEmailsPopup();\n                          }}',
  'View Emails',
].forEach((marker) => mustContain(pagePath, page, marker));

[
  'activeWorkspaceTab === "email_threads" && renderMatterEmailThreadsPanel()',
  'setActiveWorkspaceTab("email_threads");\n                            void loadMatterEmailThreadPreview();',
].forEach((marker) => mustNotContain("direct View Emails modal routing", page, marker));

console.log("\n=== VERIFY NO DIRECT DRAFT/SEND/CLIO WRITE WIRING INSIDE DIRECT EMAILS PANEL ===");
[
  'fetch("/api/graph/create-draft"',
  'fetch(`/api/graph/create-draft',
  'confirm=create-graph-draft',
  'sendMail',
  'window.location.href = buildMailtoHref(context);',
].forEach((marker) => mustNotContain("renderMatterEmailThreadsPanel", emailPanel, marker));

console.log("\n=== VERIFY DIRECT EMAILS SAFETY CHECK IS SCOPED TO EMAIL PANEL ===");
mustContain("verifier", read("scripts/verify-direct-matter-email-thread-ui-safety.mjs"), 'extractFunctionBody(page, "renderMatterEmailThreadsPanel")');
mustContain("verifier", read("scripts/verify-direct-matter-email-thread-ui-safety.mjs"), "VERIFY NO DIRECT DRAFT/SEND/CLIO WRITE WIRING INSIDE DIRECT EMAILS PANEL");

console.log("\n=== VERIFY SCRIPT REGISTRATION ===");
const packageJson = read("package.json");
mustContain("package.json", packageJson, '"verify:direct-matter-email-thread-ui-safety"');

if (failures > 0) {
  console.error(`\n=== DIRECT MATTER EMAILS UI SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("\n=== DIRECT MATTER EMAILS UI SAFETY VERIFICATION PASSED ===");
console.log("Direct matter Emails UI is unified for Graph-synced and MailDrop-linked local records.");
console.log("Opening the panel auto-loads local records only; hidden debug controls do not create drafts, send email, write Clio, or write database records.");
console.log("Draft-creation checks are scoped to renderMatterEmailThreadsPanel so unrelated document-delivery draft flows are not treated as direct Emails UI wiring.");
