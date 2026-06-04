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

console.log("RESULT: verify shared matter/lawsuit Status options safety");

const options = read("lib/matterStatusOptions.ts");
const directPage = read("app/matter/[id]/page.tsx");
const masterPage = read("app/matters/page.tsx");
const updateMetadataRoute = read("app/api/lawsuits/update-metadata/route.ts");
const pkg = JSON.parse(read("package.json"));

const requiredStatuses = [
  "AAA- DECISION- WIN",
  "AAA- FILED",
  "PRE-LIT- SUBMITTED TO CARRIER",
  "LAWSUIT- SUMMONS SERVED",
  "LAWSUIT- SETTLEMENT- SIGNED STIP RECD",
  "DISCONTINUED WITH PREJUDICE",
  "PAID AFTER SETTLEMENT",
  "PAID VOLUNTARY",
  "ADMIN CLOSE",
  "WC- HP1 DECISION- WIN",
  "TRANSFERRED TO LB",
];

mustContain("shared status list exports canonical options", options, "export const BARSH_MATTER_STATUS_OPTIONS");
for (const status of requiredStatuses) {
  mustContain(`shared status list includes ${status}`, options, status);
}

mustContain("direct matter imports shared status list", directPage, 'import { BARSH_MATTER_STATUS_OPTIONS } from "@/lib/matterStatusOptions";');
mustContain("direct matter Status dropdown uses shared list", directPage, "...BARSH_MATTER_STATUS_OPTIONS");

mustContain("master page imports shared status list", masterPage, 'import { BARSH_MATTER_STATUS_OPTIONS } from "@/lib/matterStatusOptions";');
mustContain("master Status edit uses shared list", masterPage, "BARSH_MATTER_STATUS_OPTIONS.map");
mustContain("master Status card is editable", masterPage, 'openMasterInfoEditDialog("status", "Status", masterDetailedStatusDisplayValue())');
mustContain("master Status persists status field", masterPage, "payload.status = after;");
mustContain("master Status persists matterStatus alias", masterPage, "payload.matterStatus = after;");

mustContain("update-metadata route accepts status", updateMetadataRoute, "body?.status");
mustContain("update-metadata route stores status", updateMetadataRoute, "status: nextStatus");
mustContain("update-metadata route stores matterStatus", updateMetadataRoute, "matterStatus: nextStatus");
mustContain("update-metadata route stores workflowStatus", updateMetadataRoute, "workflowStatus: nextStatus");

if (pkg.scripts?.["verify:shared-matter-status-options-safety"] !== "node scripts/verify-shared-matter-status-options-safety.mjs") {
  console.error("FAIL: package.json registers verify:shared-matter-status-options-safety");
  process.exitCode = 1;
} else {
  console.log("PASS: package.json registers verify:shared-matter-status-options-safety");
}

if (process.exitCode) {
  console.error("FAILURES=1");
  process.exit(1);
}

console.log("FAILURES=0");
