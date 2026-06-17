#!/usr/bin/env node
import fs from "node:fs";

const failures = [];

function read(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
}

const registry = read("lib/adminPermissions.ts");
const adminHome = read("app/admin/page.tsx");
const pkg = JSON.parse(read("package.json"));

const requiredPermissionKeys = [
  "admin.home.view",
  "admin.readiness.view",
  "admin.claimIndex.view",
  "admin.claimIndex.audit",
  "admin.lawsuits.audit",
  "admin.documentReadiness.audit",
  "admin.lawsuitCleanup.view",
  "admin.lawsuitCleanup.confirm",
  "admin.ticklers.view",
  "admin.ticklers.run",
  "admin.clients.view",
  "admin.clients.edit",
  "admin.invoices.view",
  "admin.invoices.create",
  "admin.invoices.finalize",
  "admin.invoices.void",
  "admin.referenceData.view",
  "admin.referenceData.import",
  "admin.auditHistory.view",
  "admin.documentTemplates.view",
  "admin.documentTemplates.manage",
  "admin.backups.view",
  "admin.backups.run",
  "admin.backups.restorePreview",
];

for (const key of requiredPermissionKeys) {
  if (!registry.includes(key)) failures.push(`lib/adminPermissions.ts missing permission key: ${key}`);
}

for (const required of [
  "export type AdminPermissionKey",
  "ADMIN_PERMISSION_DEFINITIONS",
  "ADMIN_ROUTE_PERMISSIONS",
  "defaultAdminPermissionAllowed",
  "adminPermissionForRoute",
  "enforcementPlanned: false",
]) {
  if (!registry.includes(required)) failures.push(`lib/adminPermissions.ts missing registry fragment: ${required}`);
}

for (const href of [
  "/admin/readiness-dashboard",
  "/admin/claim-index",
  "/admin/claim-index/audit",
  "/admin/lawsuits/audit",
  "/admin/document-readiness/audit",
  "/admin/lawsuit-cleanup",
  "/admin/ticklers",
  "/admin/clients",
  "/admin/reference-data",
  "/admin/audit-history",
  "/admin/document-templates",
  "/admin/backup-restore",
]) {
  if (!adminHome.includes(`href: "${href}"`)) failures.push(`app/admin/page.tsx missing expected admin card href: ${href}`);
  if (!registry.includes(`pattern: "${href}"`)) failures.push(`lib/adminPermissions.ts missing route permission mapping for admin card: ${href}`);
}

for (const apiPattern of [
  "/api/admin/claim-index/search",
  "/api/admin/clients/:id",
  "/api/admin/clients/:id/invoice/create",
  "/api/admin/clients/:id/invoice/:invoiceId/finalize",
  "/api/admin/clients/:id/invoice/:invoiceId/void",
  "/api/admin/lawsuits/cleanup-confirm",
  "/api/admin/backups/run",
  "/api/admin/backups/restore-preview",
  "/api/admin/ticklers/run",
]) {
  if (!registry.includes(`pattern: "${apiPattern}"`)) failures.push(`lib/adminPermissions.ts missing important API permission mapping: ${apiPattern}`);
}

if (pkg.scripts?.["verify:admin-permissions-registry-safety"] !== "node scripts/verify-admin-permissions-registry-safety.mjs") {
  failures.push("package.json missing verify:admin-permissions-registry-safety script");
}

console.log("RESULT: admin permissions registry safety verifier");

if (failures.length) {
  console.log(`FAILURES=${failures.length}`);
  for (const failure of failures) console.log(`FAIL=${failure}`);
  process.exit(1);
}

console.log("FAILURES=0");
console.log("PASS: admin permission registry maps current admin pages and major admin API functions without enforcing blocks yet.");
