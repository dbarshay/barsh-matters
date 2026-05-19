#!/usr/bin/env node
import fs from "fs";

const page = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");
const route = fs.readFileSync("app/api/graph/local-thread-preview/route.ts", "utf8");

const requiredPageMarkers = [
  '| "email_threads"',
  '{ key: "email_threads", label: "Email / Threads"',
  'const [emailThreadPreviewLoading, setEmailThreadPreviewLoading] = useState(false);',
  'function loadMatterEmailThreadPreview()',
  'fetch(`/api/graph/local-thread-preview?${params.toString()}`)',
  'function renderMatterEmailThreadsPanel()',
  'activeWorkspaceTab === "email_threads" && renderMatterEmailThreadsPanel()',
  'setActiveWorkspaceTab("email_threads")',
  'void loadMatterEmailThreadPreview();',
  'Open read-only local email and Microsoft Graph thread records for this matter.',
  'It does not call Graph, create Outlook drafts, send email, sync the mailbox, attach documents, or write to Clio.',
  'createsOutlookDraft',
  'sendsEmail',
  'readsMailbox',
  'databaseRecordsChanged',
];

const requiredRouteMarkers = [
  'readOnly: true',
  'previewOnly: true',
  'graphCallsMade: false',
  'createsOutlookDraft: false',
  'sendsEmail: false',
  'readsMailbox: false',
  'syncsMailbox: false',
  'attachesDocument: false',
  'clioRecordsChanged: false',
  'databaseRecordsChanged: false',
];

const forbiddenPageMarkers = [
  'fetch(`/api/graph/create-draft',
  'fetch("/api/graph/create-draft',
  "fetch('/api/graph/create-draft",
  'window.location.href = buildMailtoHref(context);\\n  }\\n\\n  function renderMatterEmailThreadsPanel',
];

const missingPage = requiredPageMarkers.filter((marker) => !page.includes(marker));
const missingRoute = requiredRouteMarkers.filter((marker) => !route.includes(marker));
const forbiddenFound = forbiddenPageMarkers.filter((marker) => page.includes(marker));

if (missingPage.length || missingRoute.length || forbiddenFound.length) {
  console.error("FAIL: Direct matter Email / Threads read-only UI safety verification failed.");
  if (missingPage.length) {
    console.error("\\nMissing page markers:");
    for (const marker of missingPage) console.error(`- ${marker}`);
  }
  if (missingRoute.length) {
    console.error("\\nMissing route markers:");
    for (const marker of missingRoute) console.error(`- ${marker}`);
  }
  if (forbiddenFound.length) {
    console.error("\\nForbidden page markers found:");
    for (const marker of forbiddenFound) console.error(`- ${marker}`);
  }
  process.exit(1);
}

console.log("PASS: Direct matter Email / Threads UI is read-only and uses local persisted thread preview only.");
console.log("Verified: no Graph draft creation route is wired into the Email / Threads panel.");
console.log("Verified: local-thread-preview route declares no Graph calls, no email send, no draft creation, no mailbox read/sync, no Clio writes, and no DB writes.");
