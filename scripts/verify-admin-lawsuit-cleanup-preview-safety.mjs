#!/usr/bin/env node

import fs from "node:fs";

const routePath = "app/api/admin/lawsuits/cleanup-preview/route.ts";
const pagePath = "app/admin/lawsuit-cleanup/page.tsx";
const adminHomePath = "app/admin/page.tsx";

const route = fs.readFileSync(routePath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");
const adminHome = fs.readFileSync(adminHomePath, "utf8");

const failures = [];

function mustContain(label, haystack, needle) {
  if (!haystack.includes(needle)) failures.push(`${label}: missing ${needle}`);
}

function mustNotContain(label, haystack, needle) {
  if (haystack.includes(needle)) failures.push(`${label}: forbidden ${needle}`);
}

mustContain("route imports prisma", route, 'import { prisma } from "@/lib/prisma";');
mustContain("route is GET only", route, "export async function GET");
mustContain("route returns previewOnly", route, "previewOnly: true");
mustContain("route uses ClaimIndex snake_case master field", route, "master_lawsuit_id");
mustContain("route uses ClaimIndex snake_case display field", route, "display_number");
mustContain("route uses ClaimIndex snake_case matter id field", route, "matter_id");
mustContain("route reports no local writes", route, "writesLocalDb: false");
mustContain("route reports no Clio writes", route, "writesClio: false");
mustContain("route reports no Clio deletes", route, "deletesClio: false");
mustContain("route exposes destructiveActionAvailable false", route, "destructiveActionAvailable: false");
mustContain("route safety copy blocks destructive actions", route, "Preview only. This route does not deaggregate matters");

mustNotContain("route must not export POST", route, "export async function POST");
mustNotContain("route must not update ClaimIndex", route, "updateMany");
mustNotContain("route must not delete local rows", route, "deleteMany");
mustNotContain("route must not use Clio", route, "clioFetch");
mustNotContain("route must not import Clio", route, "@/lib/clio");
mustNotContain("route must not call document upload helper", route, "clioDocumentUpload");
mustNotContain("route must not call upload function", route, "uploadDocument");
mustNotContain("route must not queue print jobs", route, "printQueue.create");
mustNotContain("route must not send email", route, "sendMail(");

mustContain("page has admin title", page, "Lawsuit Cleanup / Deaggregate");
mustContain("page calls preview API", page, "/api/admin/lawsuits/cleanup-preview");
mustContain("page displays preview-only warning", page, "Preview only.");
mustContain("page displays cleanup candidates", page, "Cleanup Candidates");
mustContain("page displays kept master children", page, "Kept Master Children");
mustContain("page links back to admin", page, 'href="/admin"');
mustNotContain("page must not call obsolete temporary destructive API", page, "DELETE_EXTRA_LAWSUITS");
mustNotContain("page must not render unguarded delete button", page, "Delete Local Lawsuit");
mustContain("page routes destructive action through guarded confirm API", page, "/api/admin/lawsuits/cleanup-confirm");
mustContain("page requires exact deaggregate/delete confirmation", page, "DEAGGREGATE AND DELETE");
mustContain("page explains child Clio matters are not deleted", page, "It will not delete child/bill Clio matters");

mustContain("admin home links cleanup page", adminHome, 'href: "/admin/lawsuit-cleanup"');
mustContain("admin home labels cleanup page", adminHome, "Lawsuit Cleanup / Deaggregate");

console.log("RESULT: verify Admin Lawsuit Cleanup preview safety");
console.log("ROUTE=" + routePath);
console.log("PAGE=" + pagePath);
console.log("ADMIN_HOME=" + adminHomePath);
console.log("EXPECTS_PREVIEW_ONLY=YES");
console.log("EXPECTS_NO_POST=YES");
console.log("EXPECTS_NO_LOCAL_WRITES=YES");
console.log("EXPECTS_NO_CLIO_WRITES=YES");
console.log("EXPECTS_NO_CLIO_DELETES=YES");
console.log("FAILURES=" + failures.length);

for (const failure of failures) console.log("FAIL=" + failure);

if (failures.length) process.exit(1);
