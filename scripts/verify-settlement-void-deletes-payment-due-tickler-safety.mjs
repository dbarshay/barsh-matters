import fs from "node:fs";

const route = fs.readFileSync("app/api/settlements/local-void/route.ts", "utf8");
const page = fs.readFileSync("app/matters/page.tsx", "utf8");
const failures = [];

function mustInclude(label, haystack, needle) {
  if (!haystack.includes(needle)) failures.push(`missing ${label}: ${needle}`);
}

function mustNotInclude(label, haystack, needle) {
  if (haystack.includes(needle)) failures.push(`still contains ${label}: ${needle}`);
}

mustInclude("void route deletes related ticklers", route, "tx.localWorkflowTickler.deleteMany");
mustInclude("void route limits deletion to settlement payment due ticklers", route, 'kind: "settlement_payment_due_followup"');
mustInclude("void route deletes by settlement record id", route, "{ settlementRecordId: existing.id }");
mustInclude("void route excludes final tickler statuses", route, 'notIn: ["completed", "voided", "cancelled"]');
mustInclude("void response exposes deleted tickler count", route, "workflowTicklersDeleted");
mustInclude("void note says payment-due ticklers deleted", route, "deleted related open settlement payment due ticklers only");

mustInclude("new settlement still auto-creates payment due tickler", page, "await createMasterSettlementPaymentDueTickler(savedSettlementRecordId);");
mustInclude("page still displays payment due follow-up", page, "Payment Due Follow-Up");
mustInclude("page still displays payment due date-label helper", page, "masterSettlementPaymentDueFollowUpLabel");
mustInclude("page still formats payment due date", page, "formatSettlementTicklerDate");

mustNotInclude("old void tickler updateMany status mutation", route, "tx.localWorkflowTickler.updateMany");
mustNotInclude("old workflowTicklersVoided response", route, "workflowTicklersVoided");
mustNotInclude("old ticklersUpdated return", route, "ticklersUpdated");
mustNotInclude("manual create tickler button", page, "Create Payment Due Tickler");

if (failures.length) {
  console.error("FAIL: settlement void deletes payment-due tickler verifier failed");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("PASS: voided settlements delete related open settlement payment due ticklers while new settlements auto-create their own ticklers.");
