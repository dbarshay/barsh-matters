#!/usr/bin/env node

import fs from "node:fs";

const previewRoutePath = "app/api/admin/lawsuits/cleanup-preview/route.ts";
const pagePath = "app/admin/lawsuit-cleanup/page.tsx";

const route = fs.readFileSync(previewRoutePath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");

const failures = [];

function mustContain(label, haystack, needle) {
  if (!haystack.includes(needle)) failures.push(`${label}: missing ${needle}`);
}

function mustNotContain(label, haystack, needle) {
  if (haystack.includes(needle)) failures.push(`${label}: forbidden ${needle}`);
}

mustContain("preview route reads audit log history", route, "prisma.auditLog.findMany");
mustContain("preview route filters cleanup action", route, 'action: "admin-lawsuit-cleanup-confirm"');
mustContain("preview route filters lawsuit entity type", route, 'entityType: "lawsuit"');
mustContain("preview route limits history rows", route, "take: 10");
mustContain("preview route serializes cleanupHistory", route, "cleanupHistory: cleanupHistory.map");
mustContain("preview route remains preview only", route, "previewOnly: true");
mustContain("preview route reports no local writes", route, "writesLocalDb: false");
mustContain("preview route reports no Clio writes", route, "writesClio: false");
mustContain("preview route reports no Clio deletes", route, "deletesClio: false");

mustNotContain("preview route must not write audit log", route, "auditLog.create");
mustNotContain("preview route must not update ClaimIndex", route, "updateMany");
mustNotContain("preview route must not delete local rows", route, "deleteMany");
mustNotContain("preview route must not call Clio", route, "clioFetch");

mustContain("page displays Recent Cleanup History", page, "Recent Cleanup History");
mustContain("page marks history section", page, 'data-barsh-admin-lawsuit-cleanup-history="true"');
mustContain("page says history is read-only", page, "Read-only audit history");
mustContain("page displays cleanup history from preview", page, "cleanupHistory");
mustContain("page displays Clio shell status from history", page, "clioStatus");
mustContain("page displays children cleared", page, "Children Cleared");

mustNotContain("history panel must not rerun cleanup", page, "Rerun Cleanup");
mustNotContain("history panel must not reopen cleanup", page, "Reopen Cleanup");

console.log("RESULT: verify Admin Lawsuit Cleanup history safety");
console.log("PREVIEW_ROUTE=" + previewRoutePath);
console.log("PAGE=" + pagePath);
console.log("EXPECTS_READ_ONLY_AUDIT_HISTORY=YES");
console.log("EXPECTS_NO_ROUTE_WRITES=YES");
console.log("EXPECTS_NO_CLIO_CALLS=YES");
console.log("FAILURES=" + failures.length);

for (const failure of failures) console.log("FAIL=" + failure);

if (failures.length) process.exit(1);
