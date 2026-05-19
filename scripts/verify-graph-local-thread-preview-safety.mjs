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

const routePath = "app/api/graph/local-thread-preview/route.ts";
const packagePath = "package.json";

const route = read(routePath);
const packageJson = read(packagePath);

console.log("=== GRAPH LOCAL THREAD PREVIEW SAFETY VERIFICATION ===");

mustContain(routePath, route, "export async function GET");
mustContain(routePath, route, 'action: "graph-local-thread-preview"');
mustContain(routePath, route, "readOnly: true");
mustContain(routePath, route, "previewOnly: true");
mustContain(routePath, route, "graphCallsMade: false");
mustContain(routePath, route, "createsOutlookDraft: false");
mustContain(routePath, route, "sendsEmail: false");
mustContain(routePath, route, "readsMailbox: false");
mustContain(routePath, route, "syncsMailbox: false");
mustContain(routePath, route, "attachesDocument: false");
mustContain(routePath, route, "clioRecordsChanged: false");
mustContain(routePath, route, "databaseRecordsChanged: false");
mustContain(routePath, route, "crossPlatformRuntime: true");
mustContain(routePath, route, "localOutlookAutomationRequired: false");
mustContain(routePath, route, "prisma.emailThread.findMany");
mustContain(routePath, route, "prisma.emailMatterLink.findMany");
mustContain(routePath, route, "prisma.emailFilingLog.findMany");
mustContain(routePath, route, "clioMaildropEmailPresent");
mustContain(routePath, route, "webLinkPresent");
mustContain(routePath, route, "Read-only local email-thread preview");

mustNotContain(routePath, route, "requestMicrosoftGraphAppToken");
mustNotContain(routePath, route, "graphFetchJson");
mustNotContain(routePath, route, "fetch(");
mustNotContain(routePath, route, "sendMail");
mustNotContain(routePath, route, "/sendMail");
mustNotContain(routePath, route, "createUploadSession");
mustNotContain(routePath, route, "clioFetch(");
mustNotContain(routePath, route, ".create(");
mustNotContain(routePath, route, ".update(");
mustNotContain(routePath, route, ".upsert(");
mustNotContain(routePath, route, ".delete(");
mustNotContain(routePath, route, "export async function POST");
mustNotContain(routePath, route, "export async function PATCH");
mustNotContain(routePath, route, "export async function DELETE");

if (packageJson.includes('"verify:graph-local-thread-preview-safety"')) {
  console.log("PASS package.json exposes verify:graph-local-thread-preview-safety script.");
} else {
  console.error("FAIL package.json missing verify:graph-local-thread-preview-safety script.");
  failures += 1;
}

if (failures > 0) {
  console.error(`=== GRAPH LOCAL THREAD PREVIEW SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== GRAPH LOCAL THREAD PREVIEW SAFETY PASSED ===");
