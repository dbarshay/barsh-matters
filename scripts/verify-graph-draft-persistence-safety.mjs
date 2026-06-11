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

const helperPath = "lib/graph/emailPersistence.ts";
const routePath = "app/api/graph/create-draft/route.ts";
const packagePath = "package.json";

const helper = read(helperPath);
const route = read(routePath);
const packageJson = read(packagePath);

console.log("=== GRAPH DRAFT PERSISTENCE SAFETY VERIFICATION ===");

mustContain(helperPath, helper, "persistGraphDraftMetadata");
mustContain(helperPath, helper, "prisma.emailThread.upsert");
mustContain(helperPath, helper, "prisma.emailMessage.upsert");
mustContain(helperPath, helper, "prisma.emailAttachment.create");
mustContain(helperPath, helper, "prisma.emailMatterLink.create");
mustContain(helperPath, helper, "prisma.emailFilingLog.create");
mustContain(helperPath, helper, "graphMessageId");
mustContain(helperPath, helper, "internetMessageId");
mustContain(helperPath, helper, "conversationId");
mustContain(helperPath, helper, "mailboxUserPrincipalName");
mustContain(helperPath, helper, "clioMaildropEmail");
mustContain(helperPath, helper, "databaseChanged: true");
mustContain(helperPath, helper, "clioRecordsChanged: false");
mustContain(helperPath, helper, "storageStatus: \"metadata_only\"");
mustContain(helperPath, helper, "graph_draft_created");

mustContain(routePath, route, "persistGraphDraftMetadata");
mustContain(routePath, route, "databaseRecordsChanged: true");
mustContain(routePath, route, "persisted");
mustContain(routePath, route, "draftMetadata");
mustContain(routePath, route, "Outlook draft created through Microsoft Graph and draft metadata persisted locally");
mustContain(routePath, route, "clioRecordsChanged: false");

// The Golden Rule: allowed before local metadata persistence.
mustContain(routePath, route, "clioFetch");
mustContain(routePath, route, "listClioMatterDocuments");
mustContain(routePath, route, "resolveMaildropForGraphDraftMatterId");

mustNotContain(routePath, route, "sendMail");
mustNotContain(routePath, route, "/sendMail");
mustNotContain(routePath, route, "createUploadSession");
mustNotContain(routePath, route, "method: \"PATCH\"");
mustNotContain(routePath, route, "method: \"DELETE\"");
mustNotContain(routePath, route, "updateMatterCustomFields");
mustNotContain(routePath, route, "upsertClaimIndexFromMatter");
mustNotContain(routePath, route, "ingestMattersFromClioBatch");
mustNotContain(helperPath, helper, "clioFetch(");
mustNotContain(helperPath, helper, "sendMail");
mustNotContain(helperPath, helper, "/sendMail");
mustNotContain(helperPath, helper, "createUploadSession");

if (packageJson.includes('"verify:graph-draft-persistence-safety"')) {
  console.log("PASS package.json exposes verify:graph-draft-persistence-safety script.");
} else {
  console.error("FAIL package.json missing verify:graph-draft-persistence-safety script.");
  failures += 1;
}

if (failures > 0) {
  console.error(`=== GRAPH DRAFT PERSISTENCE SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== GRAPH DRAFT PERSISTENCE SAFETY PASSED ===");
console.log("The Golden Rule: Graph draft metadata persistence is local-only; Clio document retrieval/MailDrop context are allowed before persistence.");
