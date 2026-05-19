import fs from "node:fs";

let failures = 0;

function read(path) {
  try {
    return fs.readFileSync(path, "utf8");
  } catch {
    console.error(`Missing file: ${path}`);
    failures += 1;
    return "";
  }
}

function mustContain(label, text, needle) {
  if (!text.includes(needle)) {
    console.error(`FAIL ${label}: missing ${JSON.stringify(needle)}`);
    failures += 1;
  }
}

function mustNotContain(label, text, needle) {
  if (text.includes(needle)) {
    console.error(`FAIL ${label}: forbidden ${JSON.stringify(needle)}`);
    failures += 1;
  }
}

const clientPath = "lib/graph/client.ts";
const routePath = "app/api/graph/create-draft/route.ts";
const packagePath = "package.json";

const client = read(clientPath);
const route = read(routePath);
const packageJson = read(packagePath);

console.log("=== GRAPH CREATE DRAFT SAFETY VERIFICATION ===");

mustContain(clientPath, client, "graphFetchJson");
mustContain(clientPath, client, "graphMailboxMessagesUrl");
mustContain(clientPath, client, "assertGraphDraftEnvironmentReady");
mustContain(clientPath, client, "requestMicrosoftGraphAppToken");
mustContain(clientPath, client, "https://graph.microsoft.com/v1.0");
mustContain(clientPath, client, "cache: \"no-store\"");

mustContain(routePath, route, "export async function POST");
mustContain(routePath, route, 'action: "graph-create-draft"');
mustContain(routePath, route, 'const REQUIRED_CONFIRMATION = "create-graph-draft"');
mustContain(routePath, route, 'confirm !== REQUIRED_CONFIRMATION');
mustContain(routePath, route, "failClosed: true");
mustContain(routePath, route, "createsOutlookDraft: false");
mustContain(routePath, route, "createsOutlookDraft: true");
mustContain(routePath, route, "sendsEmail: false");
mustContain(routePath, route, "readsMailbox: false");
mustContain(routePath, route, "syncsMailbox: false");
mustContain(routePath, route, "attachesDocument: false");
mustContain(routePath, route, "attachmentUploadDeferred: true");
mustContain(routePath, route, "clioRecordsChanged: false");
mustContain(routePath, route, "databaseRecordsChanged: false");
mustContain(routePath, route, "crossPlatformRuntime: true");
mustContain(routePath, route, "localOutlookAutomationRequired: false");
mustContain(routePath, route, "readyForGraphDraftCreate");
mustContain(routePath, route, "MailDrop in Cc");
mustContain(routePath, route, "no MailDrop in Bcc");
mustContain(routePath, route, "allowMetadataOnlyDraft");
mustContain(routePath, route, "graphFetchJson");
mustContain(routePath, route, "graphMailboxMessagesUrl");
mustContain(routePath, route, "graphMessageId");
mustContain(routePath, route, "internetMessageId");
mustContain(routePath, route, "conversationId");

mustNotContain(routePath, route, "sendMail");
mustNotContain(routePath, route, "/sendMail");
mustNotContain(routePath, route, "createUploadSession");
mustNotContain(routePath, route, "clioFetch(");
mustNotContain(routePath, route, "prisma.");
mustNotContain(routePath, route, "export async function GET");
mustNotContain(routePath, route, "export async function PATCH");
mustNotContain(routePath, route, "export async function DELETE");

if (packageJson.includes('"verify:graph-create-draft-safety"')) {
  console.log("PASS package.json exposes verify:graph-create-draft-safety script.");
} else {
  console.error("FAIL package.json missing verify:graph-create-draft-safety script.");
  failures += 1;
}

if (failures > 0) {
  console.error(`=== GRAPH CREATE DRAFT SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== GRAPH CREATE DRAFT SAFETY PASSED ===");
