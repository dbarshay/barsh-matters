#!/usr/bin/env node
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function mustContain(label, text, needle) {
  if (!text.includes(needle)) {
    console.error(`FAIL: ${label}: missing ${needle}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

console.log("RESULT: verify matters results Final Status column safety");

const page = read("app/matters/page.tsx");
const pkg = JSON.parse(read("package.json"));

mustContain("MatterRow carries finalStatus", page, 'finalStatus: "Open" | "Closed";');
mustContain("MatterRow maps finalStatus from row final_status", page, "row?.finalStatus ?? row?.final_status");
mustContain("MatterRow falls back to close reason for Final Status", page, "row?.closeReason ?? row?.close_reason");
mustContain("sort key includes finalStatus", page, '| "finalStatus";');
mustContain("sort value handles finalStatus", page, 'if (key === "finalStatus") return clean(row.finalStatus).toLowerCase();');
mustContain("results table has Final Status header", page, 'sortableClaimResultsHeader("Final Status", "finalStatus")');
mustContain("results table renders row Final Status badge", page, "{row.finalStatus}");
mustContain("results table uses closed final status red badge", page, 'row.finalStatus === "Closed" ? "#fef2f2" : "#dcfce7"');

if (pkg.scripts?.["verify:matters-results-final-status-column-safety"] !== "node scripts/verify-matters-results-final-status-column-safety.mjs") {
  console.error("FAIL: package.json registers verify:matters-results-final-status-column-safety");
  process.exitCode = 1;
} else {
  console.log("PASS: package.json registers verify:matters-results-final-status-column-safety");
}

if (process.exitCode) {
  console.error("FAILURES=1");
  process.exit(1);
}

console.log("FAILURES=0");
