import fs from "node:fs";

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
  failures += 1;
  console.error(`FAIL: ${message}`);
}

function mustContain(label, text, needle) {
  if (text.includes(needle)) pass(`${label} found ${needle}`);
  else fail(`${label} missing ${needle}`);
}

function mustNotContain(label, text, needle) {
  if (!text.includes(needle)) pass(`${label} does not contain ${needle}`);
  else fail(`${label} must not contain marker: ${needle}`);
}

function extractFunctionSource(source, functionName) {
  const startNeedle = `function ${functionName}(`;
  const start = source.indexOf(startNeedle);
  if (start < 0) return "";

  let depth = 0;
  let bodyStarted = false;

  for (let i = start; i < source.length; i += 1) {
    const char = source[i];

    if (char === "{") {
      depth += 1;
      bodyStarted = true;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (bodyStarted && depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }

  return source.slice(start);
}

const pagePath = "app/matters/page.tsx";
const routePath = "app/api/graph/local-thread-preview/route.ts";
const packagePath = "package.json";

const page = read(pagePath);
const route = read(routePath);
const packageJson = read(packagePath);
const masterEmailPanelSource = extractFunctionSource(page, "renderMasterEmailThreadsPanel");

console.log("=== VERIFY MASTER EMAILS UI SAFETY ===");

console.log("\n=== VERIFY UNIFIED MASTER EMAILS UI MARKERS ===");
[
  "Emails",
  "function loadMasterEmailThreadPreview()",
  "fetch(`/api/graph/local-thread-preview?${params.toString()}",
  "function renderMasterEmailThreadsPanel()",
  'activeMasterWorkspaceTab === "email_threads" && renderMasterEmailThreadsPanel()',
  'if (activeMasterWorkspaceTab !== "email_threads") return;',
  "void loadMasterEmailThreadPreview();",
  "Unified Master Lawsuit email area.",
  "Graph-synced messages and MailDrop-linked thread records appear here together",
  "Opening this panel reads local records only",
  "Email records load automatically when this panel opens.",
  "Refresh Emails",
  "MailDrop Present",
  "Open in Outlook",
].forEach((needle) => mustContain(pagePath, page, needle));

console.log("\n=== VERIFY PANEL SOURCE EXTRACTION ===");
mustContain("renderMasterEmailThreadsPanel scope", masterEmailPanelSource, "function renderMasterEmailThreadsPanel()");
mustContain("renderMasterEmailThreadsPanel scope", masterEmailPanelSource, "Refresh Emails");
mustContain("renderMasterEmailThreadsPanel scope", masterEmailPanelSource, "MailDrop Present");

console.log("\n=== VERIFY MANUAL GRAPH SYNC CONTROLS ARE HIDDEN DEBUG SCAFFOLDING ===");
[
  "Preview Graph Updates",
  "Sync Thread to Barsh Matters",
  "Preview This Thread",
  "Sync This Thread",
  "hidden",
  'aria-hidden="true"',
].forEach((needle) => mustContain(pagePath, page, needle));

console.log("\n=== VERIFY LOCAL THREAD PREVIEW ROUTE IS READ-ONLY ===");
[
  'action: "graph-local-thread-preview"',
  "graphCallsMade: false",
  "readsMailbox: false",
  "createsOutlookDraft: false",
  "sendsEmail: false",
  "syncsMailbox: false",
  "clioRecordsChanged: false",
  "databaseRecordsChanged: false",
  "Read-only local email-thread preview.",
].forEach((needle) => mustContain(routePath, route, needle));

console.log("\n=== VERIFY NO DIRECT DRAFT/SEND/CLIO WRITE WIRING IN MASTER EMAILS UI PANEL ===");
[
  'fetch("/api/graph/create-draft"',
  "fetch(`/api/graph/create-draft",
  "confirm=create-graph-draft",
  "sendMail",
  "window.location.href = buildMailtoHref(context);",
].forEach((needle) => mustNotContain("renderMasterEmailThreadsPanel scope", masterEmailPanelSource, needle));

console.log("\n=== VERIFY DOCUMENT DELIVERY DRAFT WIRING MAY EXIST ELSEWHERE ON MASTER PAGE ===");
mustContain(pagePath, page, "Create Outlook Draft");
mustContain(pagePath, page, "confirm=create-graph-draft");

console.log("\n=== VERIFY SCRIPT REGISTRATION ===");
mustContain("package.json", packageJson, '"verify:master-email-thread-ui-safety"');

if (failures > 0) {
  console.error(`=== MASTER EMAILS UI SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== MASTER EMAILS UI SAFETY PASSED ===");
