import fs from "fs";

const routePath = "app/api/graph/local-thread-preview/route.ts";
const route = fs.readFileSync(routePath, "utf8");

function requireContains(label, needle) {
  if (!route.includes(needle)) {
    throw new Error(`Missing ${label}: ${needle}`);
  }
}

function forbidContains(label, needle) {
  if (route.includes(needle)) {
    throw new Error(`Forbidden ${label}: ${needle}`);
  }
}

requireContains("expected master display resolver", "async function expectedMasterDisplayNumber(masterLawsuitId: string)");
requireContains("lawsuit lookup", "prisma.lawsuit.findUnique");
requireContains("master display select", "clioMasterDisplayNumber: true");
requireContains("strict filter flag", "shouldStrictFilterMasterThreads");
requireContains("matter display filter", "{ matterDisplayNumber: mappedMasterDisplayNumber }");
requireContains("clio display filter", "{ clioDisplayNumber: mappedMasterDisplayNumber }");
requireContains("diagnostic query flag", "strictMasterDisplayFilterApplied: shouldStrictFilterMasterThreads");
requireContains("diagnostic mapped display", "mappedMasterDisplayNumber: mappedMasterDisplayNumber || null");
requireContains("read-only flag", "readOnly: true");
requireContains("preview-only flag", "previewOnly: true");
requireContains("no Graph calls", "graphCallsMade: false");
requireContains("no draft creation", "createsOutlookDraft: false");
requireContains("no email sending", "sendsEmail: false");
requireContains("no mailbox read", "readsMailbox: false");
requireContains("no mailbox sync", "syncsMailbox: false");
requireContains("no Clio writes", "clioRecordsChanged: false");
requireContains("no DB writes", "databaseRecordsChanged: false");

forbidContains("create draft", "createDraft");
forbidContains("send mail", "sendMail");
forbidContains("Graph fetch", "graphFetchJson");
forbidContains("Clio fetch", "clioFetch(");
forbidContains("database create", ".create(");
forbidContains("database update", ".update(");
forbidContains("database upsert", ".upsert(");
forbidContains("database delete", ".delete(");

console.log("PASS: master email strict display filter safety verifier passed.");
