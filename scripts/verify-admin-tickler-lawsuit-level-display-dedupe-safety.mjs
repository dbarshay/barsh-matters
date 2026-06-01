import fs from "node:fs";

const route = fs.readFileSync("app/api/admin/ticklers/search/route.ts", "utf8");
const page = fs.readFileSync("app/admin/ticklers/page.tsx", "utf8");

const failures = [];

function mustInclude(label, haystack, needle) {
  if (!haystack.includes(needle)) failures.push(`missing ${label}: ${needle}`);
}

function mustNotInclude(label, haystack, needle) {
  if (haystack.includes(needle)) failures.push(`forbidden ${label}: ${needle}`);
}

mustInclude("raw enriched ticklers are built", route, "const enrichedTicklersRaw = ticklers.map");
mustInclude("settlement followup dedupe map", route, "const settlementFollowupByKey = new Map");
mustInclude("settlement followups dedupe by kind", route, 'tickler.kind !== "settlement_payment_due_followup"');
mustInclude("settlement followups dedupe by master lawsuit", route, "tickler.caseData?.masterLawsuit || tickler.masterLawsuitId");
mustInclude("settlement followups dedupe by due date", route, "tickler.dueDate ||");
mustInclude("latest tickler wins by createdAt", route, "currentCreated > existingCreated");
mustInclude("raw count exposed", route, "rawCount: enrichedTicklersRaw.length");
mustInclude("deduped count exposed", route, "dedupedCount: enrichedTicklersRaw.length - enrichedTicklers.length");
mustInclude("table displays enriched matter", page, "(tickler as any).caseData?.matter || tickler.displayNumber || tickler.matterId");
mustInclude("table displays enriched master lawsuit", page, "(tickler as any).caseData?.masterLawsuit || tickler.masterLawsuitId");

mustNotInclude("table displays raw displayNumber only", page, "{tickler.displayNumber || tickler.matterId || \"—\"}");
mustNotInclude("table displays raw master lawsuit only", page, "{tickler.masterLawsuitId || \"—\"}");

if (failures.length) {
  console.error("FAIL: admin tickler lawsuit-level display/dedupe verifier failed");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("PASS: admin tickler results display lawsuit-level settlement followups and dedupe duplicate open settlement followups.");
