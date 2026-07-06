#!/usr/bin/env node
import fs from "node:fs";

function read(p) {
  return fs.readFileSync(p, "utf8");
}
let failures = 0;
const pass = (m) => console.log(`PASS: ${m}`);
const fail = (m) => {
  console.error(`FAIL: ${m}`);
  failures += 1;
};
const must = (label, text, needle) =>
  text.includes(needle) ? pass(`${label}: ${needle}`) : fail(`${label}: missing ${needle}`);

console.log("=== VERIFY CARISK MANAGEMENT REPORT SAFETY ===");

const schema = read("prisma/schema.prisma");
const lib = read("lib/import/cariskManagementReport.ts");
const emailLib = read("lib/import/cariskReportEmail.ts");
const confirm = read("app/api/import/carisk/confirm/route.ts");
const commit = read("app/api/import/reconcile/commit/route.ts");
const reportRoute = read("app/api/import/carisk/report/route.ts");
const sendRoute = read("app/api/import/carisk/report/send/route.ts");
const page = read("app/admin/import/carisk/report/page.tsx");
const vercel = read("vercel.json");
const pkg = read("package.json");

// Schema: tracker keyed by unique CIC#.
must("schema model", schema, "model CariskManagementReportItem {");
must("schema unique cic", schema, "cicNumber       String   @unique");

// Persist lib: add/keep + graduate + list.
must("lib upsert saved-incomplete", lib, "export async function upsertSavedIncomplete");
must("lib graduate off report", lib, "export async function removeCicsFromReport");
must("lib list open", lib, "export async function listOpenReport");
must("lib graduate marks removed", lib, 'status: "removed"');

// Wiring: confirm parks Saved Incomplete + graduates created; commit graduates committed carisk.
must("confirm parks saved-incomplete", confirm, "upsertSavedIncomplete(savedIncomplete)");
must("confirm graduates created", confirm, "removeCicsFromReport(actions.filter");
must("commit graduates carisk cic", commit, "removeCicsFromReport(cics)");

// Email: build + send via Graph to configured recipient.
must("email builds html", emailLib, "export async function buildReportHtml");
must("email sends via graph", emailLib, "/sendMail");
must("email recipient env", emailLib, "CARISK_REPORT_RECIPIENT");

// Send route: weekly cron (GET+bearer) + admin button (POST).
must("send cron GET authorized", sendRoute, "CRON_SECRET");
must("send admin POST gated", sendRoute, "isAdminRequestAuthorized(req)");
must("report route flag-gated", reportRoute, "isImportEnabled()");

// Friday schedule + UI.
must("vercel friday cron", vercel, '"schedule": "0 12 * * 5"');
must("vercel cron path", vercel, "/api/import/carisk/report/send");
must("admin page send button", page, "Send report email now");

must("package.json registers verifier", pkg, "verify:carisk-report-safety");

if (failures) {
  console.error(`=== CARISK REPORT SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}
console.log("=== CARISK REPORT SAFETY PASSED ===");
