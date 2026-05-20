#!/usr/bin/env node
import fs from "fs";

const pagePath = "app/admin/audit-history/page.tsx";
const landingPath = "app/page.tsx";

const page = fs.readFileSync(pagePath, "utf8");
const landing = fs.readFileSync(landingPath, "utf8");

const checks = [
  ["admin audit page exists", fs.existsSync(pagePath)],
  ["admin audit marker exists", page.includes('data-barsh-admin-audit-history="true"')],
  ["admin audit page read-only copy", page.includes("Read-only") || page.includes("read-only")],
  ["admin audit page uses audit-log API", page.includes("/api/audit-log?limit=100")],
  ["admin audit page has no writes", !page.includes('method: "POST"') && !page.includes("method: 'POST'")],
  ["admin audit page says no Clio writes", page.includes("does not write Clio")],
  ["landing has openAuditHistoryAdmin", landing.includes("openAuditHistoryAdmin")],
  ["landing admin menu includes Audit / History", landing.includes("📜 Audit / History")],
  ["landing audit routes to admin page", landing.includes("/admin/audit-history")],
  ["landing Audit / History is admin gated", landing.includes("Open Audit / History") && landing.includes("runAdministratorGate")],
];

let failed = false;
for (const [label, ok] of checks) {
  if (ok) console.log(`PASS: ${label}`);
  else {
    console.log(`FAIL: ${label}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("PASS: admin audit history page and landing menu verifier");
