import fs from "node:fs";

const routePath = "app/api/admin/ticklers/search/route.ts";
const schemaPath = "prisma/schema.prisma";
const pagePath = "app/matters/page.tsx";

const route = fs.readFileSync(routePath, "utf8");
const schema = fs.readFileSync(schemaPath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");

const failures = [];

function mustInclude(label, haystack, needle) {
  if (!haystack.includes(needle)) failures.push(`missing ${label}: ${needle}`);
}

function mustNotInclude(label, haystack, needle) {
  if (haystack.includes(needle)) failures.push(`forbidden ${label}: ${needle}`);
}

mustInclude("LocalWorkflowTickler model", schema, "model LocalWorkflowTickler");
mustInclude("tickler kind field", schema, "kind               String");
mustInclude("tickler status field", schema, "status             String");
mustInclude("tickler priority field", schema, "priority           String");
mustInclude("tickler master lawsuit field", schema, "masterLawsuitId");
mustInclude("tickler matter field", schema, "matterId");
mustInclude("tickler display number field", schema, "displayNumber");
mustInclude("tickler settlement record field", schema, "settlementRecordId");
mustInclude("tickler due date field", schema, "dueDate");
mustInclude("tickler metadata field", schema, "metadata           Json?");
mustInclude("kind index", schema, "@@index([kind])");
mustInclude("status index", schema, "@@index([status])");
mustInclude("due date index", schema, "@@index([dueDate])");

mustInclude("admin route action", route, 'action: "admin-generic-tickler-search"');
mustInclude("administrator safety flag", route, "administratorFunction: true");
mustInclude("read-only safety flag", route, "readOnly: true");
mustInclude("local-only safety flag", route, "localOnly: true");
mustInclude("no matter page runner flag", route, "matterPageRunner: false");
mustInclude("local tickler search", route, "prisma.localWorkflowTickler.findMany");
mustInclude("kind query filter", route, 'url.searchParams.get("kind")');
mustInclude("status query filter", route, 'url.searchParams.get("status")');
mustInclude("priority query filter", route, 'url.searchParams.get("priority")');
mustInclude("master lawsuit query filter", route, 'url.searchParams.get("masterLawsuitId")');
mustInclude("matter query filter", route, 'url.searchParams.get("matterId")');
mustInclude("display number query filter", route, 'url.searchParams.get("displayNumber")');
mustInclude("settlement record query filter", route, 'url.searchParams.get("settlementRecordId")');
mustInclude("due date query filter", route, 'url.searchParams.get("dueDate")');
mustInclude("due before query filter", route, 'url.searchParams.get("dueBefore")');
mustInclude("due after query filter", route, 'url.searchParams.get("dueAfter")');
mustInclude("keyword query filter", route, 'url.searchParams.get("q")');
mustInclude("available kind filters", route, "availableFilters");
mustInclude("admin note says does not run ticklers", route, "does not run or process ticklers");

mustInclude("matter page still displays payment due follow-up", page, "Payment Due Follow-Up");
mustInclude("matter page still uses date-label helper", page, "masterSettlementPaymentDueFollowUpLabel");

mustNotInclude("route create side effect", route, ".create(");
mustNotInclude("route update side effect", route, ".update(");
mustNotInclude("route delete side effect", route, ".delete");
mustNotInclude("route Clio fetch", route, "clioFetch");
mustNotInclude("route email side effect", route, "createMessage");
mustInclude("print queue unchanged safety flag", route, "printQueueChanged: false");
mustNotInclude("route print queue create side effect", route, "printQueue.create");
mustNotInclude("route print queue update side effect", route, "printQueue.update");
mustNotInclude("route print queue delete side effect", route, "printQueue.delete");
mustNotInclude("matter page run ticklers button", page, "Run Ticklers");
mustNotInclude("matter page process ticklers button", page, "Process Ticklers");
mustNotInclude("matter page create tickler button", page, "Create Payment Due Tickler");

if (failures.length) {
  console.error("FAIL: admin generic tickler search route safety verifier failed");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("PASS: admin generic tickler search route supports kind/status/context filters and is read-only/local-only with no matter-page runner.");
