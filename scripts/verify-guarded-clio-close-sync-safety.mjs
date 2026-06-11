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

console.log("=== VERIFY GUARDED CLIO CLOSE SYNC SAFETY ===");

const helper = read("lib/clioCloseSync.ts");
const matterClose = read("app/api/matters/close/route.ts");
const lawsuitClose = read("app/api/lawsuits/close/route.ts");
const settlementClose = read("app/api/settlements/close/route.ts");
const packageJson = read("package.json");

mustContain("helper", helper, "export async function syncClioMatterClosed");
mustContain("helper", helper, "export async function syncClioMattersClosed");
mustContain("helper", helper, 'method: "PATCH"');
mustContain("helper", helper, 'status: "Closed"');
mustContain("helper", helper, "/api/v4/matters/");
mustContain("helper", helper, "Golden Rule close-sync helper");
mustNotContain("helper", helper, "upsertClaimIndexFromMatter");
mustNotContain("helper", helper, "ingestMattersFromClioBatch");
mustNotContain("helper", helper, "legacyClioOperationalRouteBlocked");
mustNotContain("helper", helper, "custom_field_values");

mustContain("matter close route", matterClose, 'import { syncClioMatterClosed } from "@/lib/clioCloseSync";');
mustContain("matter close route", matterClose, "const clioCloseSync = await syncClioMatterClosed");
mustContain("matter close route", matterClose, "Local matter close was not committed.");
mustContain("matter close route", matterClose, 'action: "guarded-close-matter"');
mustContain("matter close route", matterClose, "clioCloseSyncAttempted: true");
mustContain("matter close route", matterClose, "clioClosed: true");
mustContain("matter close route", matterClose, "claimIndexUpdated: true");
mustContain("matter close route", matterClose, "auditLogCreated: true");
mustContain("matter close route audit stores workflow", matterClose, 'workflow: "guarded-close-matter"');
mustContain("matter close route stores JSON-safe Clio audit summary", matterClose, "clioCloseSyncAuditSummary(clioCloseSync)");
mustNotContain("matter close route", matterClose, "legacyClioOperationalRouteBlocked");
mustNotContain("matter close route", matterClose, "upsertClaimIndexFromMatter");
mustNotContain("matter close route", matterClose, "ingestMattersFromClioBatch");

mustContain("lawsuit close route", lawsuitClose, 'import { syncClioMattersClosed } from "@/lib/clioCloseSync";');
mustContain("lawsuit close route", lawsuitClose, "const clioCloseSync = await syncClioMattersClosed");
mustContain("lawsuit close route", lawsuitClose, "No Clio matter IDs were available");
mustContain("lawsuit close route", lawsuitClose, "Local lawsuit close was not committed.");
mustContain("lawsuit close route", lawsuitClose, 'action: "guarded-close-lawsuit"');
mustContain("lawsuit close route", lawsuitClose, "clioCloseSyncAttempted: true");
mustContain("lawsuit close route", lawsuitClose, "clioClosed: true");
mustContain("lawsuit close route", lawsuitClose, "childClaimIndexUpdated: true");
mustContain("lawsuit close route", lawsuitClose, "auditLogCreated: true");
mustContain("lawsuit close route audit stores workflow", lawsuitClose, 'workflow: "guarded-close-lawsuit"');
mustContain("lawsuit close route stores JSON-safe Clio audit summary", lawsuitClose, "clioCloseSyncAuditSummary(clioCloseSync)");
mustContain("lawsuit close route", lawsuitClose, "CHILD_CLOSED_REASON");
mustContain("lawsuit close route", lawsuitClose, "Closed Lawsuit");
mustNotContain("lawsuit close route", lawsuitClose, "legacyClioOperationalRouteBlocked");
mustNotContain("lawsuit close route", lawsuitClose, "upsertClaimIndexFromMatter");
mustNotContain("lawsuit close route", lawsuitClose, "ingestMattersFromClioBatch");

mustContain("settlement close shortcut remains blocked", settlementClose, "legacyClioOperationalRouteBlocked");
mustNotContain("settlement close shortcut remains blocked", settlementClose, "syncClioMatterClosed");
mustNotContain("settlement close shortcut remains blocked", settlementClose, "syncClioMattersClosed");

mustContain("package.json", packageJson, "verify:guarded-clio-close-sync-safety");

if (failures) {
  console.error(`=== GUARDED CLIO CLOSE SYNC SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== GUARDED CLIO CLOSE SYNC SAFETY PASSED ===");
console.log("Golden Rule: close workflows now perform guarded Clio operational close-status sync; settlement shortcut remains blocked.");
