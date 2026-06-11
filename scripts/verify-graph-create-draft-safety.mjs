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
mustContain(routePath, route, "clioRecordsChanged: false");
mustContain(routePath, route, "databaseRecordsChanged: false");
mustContain(routePath, route, "readyForGraphDraftCreate");
mustContain(routePath, route, "resolveMaildropForGraphDraftMatterId");
mustContain(routePath, route, "clioMaildropEmail");
mustContain(routePath, route, "let cc = normalizeGraphRecipients");
mustContain(routePath, route, "context.clioMaildropEmail");
mustContain(routePath, route, "email: context.clioMaildropEmail");
mustContain(routePath, route, "graphFetchJson");
mustContain(routePath, route, "graphMailboxMessagesUrl");
mustContain(routePath, route, "graphMessageId");
mustContain(routePath, route, "internetMessageId");
mustContain(routePath, route, "conversationId");

// Rule 1 allowed Clio scope in this route: finalized document retrieval/listing and MailDrop context only.
mustContain(routePath, route, "clioFetch");
mustContain(routePath, route, "listClioMatterDocuments");
mustContain(routePath, route, "/api/v4/documents/");
mustContain(routePath, route, "/api/v4/document_versions/");
mustContain(routePath, route, "downloadAttachmentBytesFromPlan");

mustNotContain(routePath, route, "sendMail");
mustNotContain(routePath, route, "/sendMail");
mustNotContain(routePath, route, "createUploadSession");
mustNotContain(routePath, route, "method: \"PATCH\"");
mustNotContain(routePath, route, "method: \"DELETE\"");
mustNotContain(routePath, route, "updateMatterCustomFields");
mustNotContain(routePath, route, "upsertClaimIndexFromMatter");
mustNotContain(routePath, route, "ingestMattersFromClioBatch");
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
console.log("The Golden Rule: Clio document retrieval and MailDrop context are allowed; Clio matter mutation remains forbidden.");
