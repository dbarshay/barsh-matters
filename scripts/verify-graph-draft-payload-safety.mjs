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

const helperPath = "lib/graph/draft.ts";
const routePath = "app/api/graph/draft-payload-preview/route.ts";
const packagePath = "package.json";

const helper = read(helperPath);
const route = read(routePath);
const packageJson = read(packagePath);

console.log("=== GRAPH DRAFT PAYLOAD SAFETY VERIFICATION ===");

mustContain(helperPath, helper, "buildGraphDraftPayloadPreview");
mustContain(helperPath, helper, "normalizeGraphRecipients");
mustContain(helperPath, helper, "toRecipients");
mustContain(helperPath, helper, "ccRecipients");
mustContain(helperPath, helper, "bccRecipients");
mustContain(helperPath, helper, "singleValueExtendedProperties");
mustContain(helperPath, helper, "BarshMattersMatterDisplayNumber");
mustContain(helperPath, helper, "BarshMattersMasterLawsuitId");
mustContain(helperPath, helper, "BarshMattersClioMatterId");
mustContain(helperPath, helper, "hasMaildropCc");
mustContain(helperPath, helper, "maildropInCcOnly");
mustContain(helperPath, helper, "Clio MailDrop must be included in Cc");
mustContain(helperPath, helper, "Clio MailDrop must not be placed in Bcc");
mustContain(helperPath, helper, "readyForGraphDraftCreate");

mustContain(routePath, route, "export async function POST");
mustContain(routePath, route, 'action: "graph-draft-payload-preview"');
mustContain(routePath, route, "readOnly: true");
mustContain(routePath, route, "previewOnly: true");
mustContain(routePath, route, "graphCallsMade: false");
mustContain(routePath, route, "createsOutlookDraft: false");
mustContain(routePath, route, "sendsEmail: false");
mustContain(routePath, route, "readsMailbox: false");
mustContain(routePath, route, "syncsMailbox: false");
mustContain(routePath, route, "clioRecordsChanged: false");
mustContain(routePath, route, "databaseRecordsChanged: false");
mustContain(routePath, route, "crossPlatformRuntime: true");
mustContain(routePath, route, "localOutlookAutomationRequired: false");
mustContain(routePath, route, "buildGraphDraftPayloadPreview");

mustNotContain(routePath, route, "fetch(");
mustNotContain(routePath, route, "requestMicrosoftGraphAppToken");
mustNotContain(routePath, route, "prisma.");
mustNotContain(routePath, route, "clioFetch(");
mustNotContain(routePath, route, "sendMail");
mustNotContain(routePath, route, "/sendMail");
mustNotContain(routePath, route, "messages/");
mustNotContain(routePath, route, "createUploadSession");
mustNotContain(routePath, route, "export async function GET");
mustNotContain(routePath, route, "export async function PATCH");
mustNotContain(routePath, route, "export async function DELETE");

if (packageJson.includes('"verify:graph-draft-payload-safety"')) {
  console.log("PASS package.json exposes verify:graph-draft-payload-safety script.");
} else {
  console.error("FAIL package.json missing verify:graph-draft-payload-safety script.");
  failures += 1;
}

if (failures > 0) {
  console.error(`=== GRAPH DRAFT PAYLOAD SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== GRAPH DRAFT PAYLOAD SAFETY PASSED ===");
