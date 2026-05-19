import fs from "node:fs";

let failures = 0;

function read(path) {
  try {
    return fs.readFileSync(path, "utf8");
  } catch (error) {
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

const routePath = "app/api/graph/config-health/route.ts";
const schemaPath = "prisma/schema.prisma";
const migrationPath = "prisma/migrations/20260519093000_add_graph_email_thread_foundation/migration.sql";
const packagePath = "package.json";

const route = read(routePath);
const schema = read(schemaPath);
const migration = read(migrationPath);
const packageJson = read(packagePath);

console.log("=== GRAPH CONFIG HEALTH SAFETY VERIFICATION ===");

mustContain(routePath, route, "export async function GET");
mustContain(routePath, route, 'action: "graph-config-health"');
mustContain(routePath, route, "readOnly: true");
mustContain(routePath, route, "previewOnly: true");
mustContain(routePath, route, "graphCallsMade: false");
mustContain(routePath, route, "createsOutlookDraft: false");
mustContain(routePath, route, "sendsEmail: false");
mustContain(routePath, route, "readsMailbox: false");
mustContain(routePath, route, "syncsMailbox: false");
mustContain(routePath, route, "clioRecordsChanged: false");
mustContain(routePath, route, "databaseRecordsChanged: false");
mustContain(routePath, route, "MICROSOFT_GRAPH_TENANT_ID");
mustContain(routePath, route, "MICROSOFT_GRAPH_CLIENT_ID");
mustContain(routePath, route, "MICROSOFT_GRAPH_CLIENT_SECRET");
mustContain(routePath, route, "MICROSOFT_GRAPH_MAILBOX_USER_ID");
mustContain(routePath, route, "AZURE_TENANT_ID");
mustContain(routePath, route, "OUTLOOK_DEFAULT_MAILBOX");
mustContain(routePath, route, "Mail.Read");
mustContain(routePath, route, "Mail.ReadWrite");
mustContain(routePath, route, "Mail.Send");

mustNotContain(routePath, route, "fetch(");
mustNotContain(routePath, route, "prisma.");
mustNotContain(routePath, route, "clioFetch(");
mustNotContain(routePath, route, "sendMail");
mustNotContain(routePath, route, "/sendMail");
mustNotContain(routePath, route, "messages/");
mustNotContain(routePath, route, "createUploadSession");
mustNotContain(routePath, route, "export async function POST");
mustNotContain(routePath, route, "export async function PATCH");
mustNotContain(routePath, route, "export async function DELETE");

for (const model of [
  "model EmailThread",
  "model EmailMessage",
  "model EmailAttachment",
  "model EmailSyncState",
  "model EmailMatterLink",
  "model EmailFilingLog",
]) {
  mustContain(schemaPath, schema, model);
  mustContain(migrationPath, migration, `CREATE TABLE IF NOT EXISTS "${model.replace("model ", "")}"`);
}

mustContain(schemaPath, schema, "conversationId");
mustContain(schemaPath, schema, "internetMessageId");
mustContain(schemaPath, schema, "graphMessageId");
mustContain(schemaPath, schema, "matterDisplayNumber");
mustContain(schemaPath, schema, "masterLawsuitId");
mustContain(schemaPath, schema, "clioMaildropEmail");
mustContain(schemaPath, schema, "clioDocumentId");
mustContain(schemaPath, schema, "deltaLink");
mustContain(schemaPath, schema, "EmailAttachment[]");

mustContain(migrationPath, migration, "EmailMessage_threadId_fkey");
mustContain(migrationPath, migration, "EmailAttachment_messageId_fkey");
mustContain(migrationPath, migration, "ON DELETE CASCADE");

if (packageJson.includes('"verify:graph-config-health-safety"')) {
  console.log("PASS package.json exposes verify:graph-config-health-safety script.");
} else {
  console.error("FAIL package.json missing verify:graph-config-health-safety script.");
  failures += 1;
}

if (failures > 0) {
  console.error(`=== GRAPH CONFIG HEALTH SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== GRAPH CONFIG HEALTH SAFETY PASSED ===");
