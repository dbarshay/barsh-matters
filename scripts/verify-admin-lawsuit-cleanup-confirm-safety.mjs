#!/usr/bin/env node

import fs from "node:fs";

const routePath = "app/api/admin/lawsuits/cleanup-confirm/route.ts";
const previewRoutePath = "app/api/admin/lawsuits/cleanup-preview/route.ts";
const pagePath = "app/admin/lawsuit-cleanup/page.tsx";

const route = fs.readFileSync(routePath, "utf8");
const previewRoute = fs.readFileSync(previewRoutePath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");

const failures = [];

function mustContain(label, haystack, needle) {
  if (!haystack.includes(needle)) failures.push(`${label}: missing ${needle}`);
}

function mustNotContain(label, haystack, needle) {
  if (haystack.includes(needle)) failures.push(`${label}: forbidden ${needle}`);
}

mustContain("confirm route imports prisma", route, 'import { prisma } from "@/lib/prisma";');
mustContain("confirm route imports clioFetch", route, 'import { clioFetch } from "@/lib/clio";');
mustContain("confirm route exports POST", route, "export async function POST");
mustContain("confirm route protects keep master", route, 'const KEEP_MASTER = "2026.05.00001"');
mustContain("confirm route requires exact confirmation", route, "DEAGGREGATE AND DELETE");
mustContain("confirm route limits Clio shell mapping source", route, "barsh-matters-create-lawsuit-confirm");
mustContain("confirm route requires deleteClioShell when shell exists", route, "deleteClioShell=true is required");
mustContain("confirm route deletes Clio matter shell endpoint", route, "/api/v4/matters/");
mustContain("confirm route clears ClaimIndex master link", route, "master_lawsuit_id: null");
mustContain("confirm route deletes local Lawsuit row", route, "tx.lawsuit.delete");
mustContain("confirm route writes audit log", route, "tx.auditLog.create");
mustContain("confirm route supplies required AuditLog entityType", route, 'entityType: "lawsuit"');
mustContain("confirm route audits no child Clio deletion", route, "noChildClioMatterDeletion: true");
mustContain("confirm route reports child Clio matters not deleted", route, "deletedChildClioMatters: false");
mustContain("confirm route reports writes local DB true on success", route, "writesLocalDb: true");
mustContain("confirm route reports Clio delete status", route, "clioDeleteResult");

mustContain("confirm route may snapshot child display_number for audit only", route, "display_number");
mustNotContain("confirm route must not delete Clio by child display number", route, "display_number).json");
mustNotContain("confirm route must not delete Clio from child rows", route, "deleteMappedClioShell(row");
mustNotContain("confirm route must not delete Clio from child matter id", route, "deleteMappedClioShell(child");
mustNotContain("confirm route must not delete all Clio matters", route, "/api/v4/matters.json");
mustNotContain("confirm route must not upload documents", route, "clioDocumentUpload");
mustNotContain("confirm route must not send email", route, "sendMail(");
mustNotContain("confirm route must not queue print jobs", route, "printQueue.create");

mustNotContain("preview route remains GET-only", previewRoute, "export async function POST");
mustContain("preview route remains preview-only", previewRoute, "previewOnly: true");
mustContain("preview route still reports no local writes", previewRoute, "writesLocalDb: false");
mustContain("preview route still reports no Clio writes", previewRoute, "writesClio: false");
mustContain("preview route still reports no Clio deletes", previewRoute, "deletesClio: false");

mustContain("page calls cleanup confirm route", page, "/api/admin/lawsuits/cleanup-confirm");
mustContain("page sends POST for confirm route", page, 'method: "POST"');
mustContain("page requires exact confirmation text", page, "DEAGGREGATE AND DELETE");
mustContain("page always requests Clio shell deletion", page, "deleteClioShell: true");
mustContain("page says child Clio matters are not deleted", page, "It will not delete child/bill Clio matters");
mustContain("page has destructive button label", page, "Confirm Deaggregate / Delete Shell");
mustContain("page reloads preview after cleanup", page, "await loadPreview();");

console.log("RESULT: verify Admin Lawsuit Cleanup confirm safety");
console.log("ROUTE=" + routePath);
console.log("PREVIEW_ROUTE=" + previewRoutePath);
console.log("PAGE=" + pagePath);
console.log("EXPECTS_EXACT_CONFIRMATION=YES");
console.log("EXPECTS_CLIO_MASTER_SHELL_ONLY=YES");
console.log("EXPECTS_NO_CHILD_CLIO_DELETE=YES");
console.log("EXPECTS_LOCAL_DEAGGREGATE_AND_LAWSUIT_DELETE=YES");
console.log("EXPECTS_AUDIT_LOG=YES");
console.log("FAILURES=" + failures.length);

for (const failure of failures) console.log("FAIL=" + failure);

if (failures.length) process.exit(1);
