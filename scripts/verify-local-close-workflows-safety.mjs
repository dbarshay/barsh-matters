#!/usr/bin/env node
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

let failures = 0;
function pass(message) {
  console.log(`PASS: ${message}`);
}
function fail(message) {
  console.error(`FAIL: ${message}`);
  failures += 1;
}
function mustContain(label, text, needle) {
  text.includes(needle) ? pass(`${label}: found ${needle}`) : fail(`${label}: missing ${needle}`);
}
function mustNotContain(label, text, needle) {
  !text.includes(needle) ? pass(`${label}: avoids ${needle}`) : fail(`${label}: forbidden ${needle}`);
}

console.log("RESULT: verify local/guarded close workflows safety");

const matterClose = read("app/api/matters/close/route.ts");
const lawsuitClose = read("app/api/lawsuits/close/route.ts");
const matterPage = read("app/matter/[id]/page.tsx");
const mattersPage = read("app/matters/page.tsx");
const byMatterRoute = read("app/api/claim-index/by-matter/route.ts");
const pkg = read("package.json");

mustContain("matter close route updates final_status Closed", matterClose, 'final_status: "Closed"');
mustContain("matter close route updates close_reason from selected reason", matterClose, "close_reason: closeReason");
mustContain("matter close route performs guarded Clio close sync", matterClose, "syncClioMatterClosed");
mustContain("matter close route blocks local commit if Clio sync fails", matterClose, "Local matter close was not committed.");
mustContain("matter close route writes audit", matterClose, "auditLog.create");
mustContain("matter close route audit stores Clio sync result", matterClose, "clioCloseSync");
mustContain("matter close route audit stores guarded workflow", matterClose, 'workflow: "guarded-close-matter"');
mustContain("matter close route returns guarded action", matterClose, 'action: "guarded-close-matter"');
mustContain("matter close route reports Clio closed", matterClose, "clioClosed: true");
mustNotContain("matter close route must not use legacy Clio blocked helper", matterClose, "legacyClioOperationalRouteBlocked");
mustNotContain("matter close route must not hydrate ClaimIndex from Clio", matterClose, "upsertClaimIndexFromMatter");
mustNotContain("matter close route must not ingest Clio batch", matterClose, "ingestMattersFromClioBatch");

mustContain("lawsuit close route exists", lawsuitClose, 'export async function POST');
mustContain("lawsuit close route stores master final status", lawsuitClose, 'finalStatus: "Closed"');
mustContain("lawsuit close route stores master close reason", lawsuitClose, "closeReason");
mustContain("lawsuit close route child reason constant", lawsuitClose, 'const CHILD_CLOSED_REASON = "Closed Lawsuit"');
mustContain("lawsuit close route cascades children by master_lawsuit_id", lawsuitClose, "master_lawsuit_id: masterLawsuitId");
mustContain("lawsuit close route sets child final_status closed", lawsuitClose, 'final_status: "Closed"');
mustContain("lawsuit close route sets child close_reason Closed Lawsuit", lawsuitClose, "close_reason: CHILD_CLOSED_REASON");
mustContain("lawsuit close route uses ClaimIndex updateMany", lawsuitClose, "claimIndex.updateMany");
mustContain("lawsuit close route performs guarded Clio close sync", lawsuitClose, "syncClioMattersClosed");
mustContain("lawsuit close route blocks local commit if Clio sync fails", lawsuitClose, "Local lawsuit close was not committed.");
mustContain("lawsuit close route writes audit", lawsuitClose, "auditLog.create");
mustContain("lawsuit close route audit stores Clio sync result", lawsuitClose, "clioCloseSync");
mustContain("lawsuit close route audit stores guarded workflow", lawsuitClose, 'workflow: "guarded-close-lawsuit"');
mustContain("lawsuit close route returns guarded action", lawsuitClose, 'action: "guarded-close-lawsuit"');
mustContain("lawsuit close route reports Clio closed", lawsuitClose, "clioClosed: true");
mustNotContain("lawsuit close route must not use legacy Clio blocked helper", lawsuitClose, "legacyClioOperationalRouteBlocked");
mustNotContain("lawsuit close route must not hydrate ClaimIndex from Clio", lawsuitClose, "upsertClaimIndexFromMatter");
mustNotContain("lawsuit close route must not ingest Clio batch", lawsuitClose, "ingestMattersFromClioBatch");

mustContain("direct matter close modal exists", matterPage, "Close Matter");
mustContain("direct matter close modal uses close route", matterPage, "/api/matters/close");
mustContain("direct matter closed logic uses finalStatus", matterPage, "finalStatus");
mustContain("master Close Lawsuit button is enabled workflow", mattersPage, "Close Lawsuit");
mustContain("master Close Lawsuit modal exists", mattersPage, "Close Lawsuit");
mustContain("master Close Lawsuit modal warns child cascade", mattersPage, "Closed Lawsuit");
mustContain("master Close Lawsuit calls guarded route", mattersPage, "/api/lawsuits/close");

mustContain("by-matter route selects final_status", byMatterRoute, "final_status");
mustContain("by-matter route returns finalStatus alias", byMatterRoute, "finalStatus");
mustContain("package.json registers verify:local-close-workflows-safety", pkg, "verify:local-close-workflows-safety");

console.log(`FAILURES=${failures}`);
if (failures) process.exit(1);
