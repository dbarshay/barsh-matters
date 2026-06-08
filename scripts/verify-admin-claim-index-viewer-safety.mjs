import fs from "node:fs";

const checks = [];
const failures = [];

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireIncludes(path, content, needle, message = needle) {
  checks.push(`require ${path} includes ${message}`);
  if (!content.includes(needle)) {
    failures.push(`${path}: missing ${message}`);
  }
}

function requireNotIncludes(path, content, needle, message = needle) {
  checks.push(`require ${path} excludes ${message}`);
  if (content.includes(needle)) {
    failures.push(`${path}: found forbidden ${message}`);
  }
}

function requireRegex(path, content, regex, message = String(regex)) {
  checks.push(`require ${path} matches ${message}`);
  if (!regex.test(content)) {
    failures.push(`${path}: missing pattern ${message}`);
  }
}

const routePath = "app/api/admin/claim-index/search/route.ts";
const pagePath = "app/admin/claim-index/page.tsx";
const adminHomePath = "app/admin/page.tsx";
const packagePath = "package.json";

for (const path of [routePath, pagePath, adminHomePath, packagePath]) {
  if (!fs.existsSync(path)) failures.push(`${path}: file does not exist`);
}

if (!failures.length) {
  const route = read(routePath);
  const page = read(pagePath);
  const adminHome = read(adminHomePath);
  const pkg = read(packagePath);

  requireIncludes(routePath, route, "export async function GET", "GET-only route export");
  requireIncludes(routePath, route, 'import { prisma } from "@/lib/prisma";', "named prisma import");
  requireNotIncludes(routePath, route, 'import prisma from "@/lib/prisma";', "forbidden default prisma import");
  requireIncludes(routePath, route, "prisma.claimIndex.findMany", "ClaimIndex read query");
  requireIncludes(routePath, route, "prisma.claimIndex.count", "ClaimIndex count query");
  requireIncludes(routePath, route, "readOnly: true", "readOnly response marker");
  requireIncludes(routePath, route, "does not update ClaimIndex, restore data, call Clio", "route safety copy");
  requireIncludes(routePath, route, "take: limit", "bounded result limit");
  requireIncludes(routePath, route, "Math.min(Math.max(Math.trunc(parsed), 1), 500)", "500-row maximum");

  for (const forbidden of [
    "export async function POST",
    "export async function PUT",
    "export async function PATCH",
    "export async function DELETE",
    ".create(",
    ".createMany(",
    ".update(",
    ".updateMany(",
    ".upsert(",
    ".delete(",
    ".deleteMany(",
    "$transaction",
    "fetch(",
    "clio",
    "ClioClient",
    "restore:indexes",
    "pg_restore",
    "CONFIRM_RESTORE",
  ]) {
    requireNotIncludes(routePath, route, forbidden, forbidden);
  }

  requireIncludes(pagePath, page, 'data-barsh-admin-claim-index-viewer="true"', "page marker");
  requireIncludes(pagePath, page, 'data-claim-index-read-only="true"', "read-only page marker");
  requireIncludes(pagePath, page, 'data-restore-execution-enabled="false"', "restore disabled marker");
  requireIncludes(pagePath, page, 'data-clio-operations-enabled="false"', "Clio disabled marker");
  requireIncludes(pagePath, page, "Read-only audit view of the local Barsh Matters ClaimIndex table.", "read-only header copy");
  requireIncludes(pagePath, page, "Export CSV", "client-side CSV export");
  requireIncludes(pagePath, page, "window.history.pushState", "URL-backed search state");
  requireIncludes(pagePath, page, "popstate", "Back/Forward URL state handling");
  requireIncludes(pagePath, page, "/api/admin/claim-index/search", "admin ClaimIndex API usage");

  for (const forbidden of [
    "method: \"POST\"",
    "method: 'POST'",
    "fetch(\"/api/claim-index/rebuild",
    "fetch('/api/claim-index/rebuild",
    "restore-preview",
    "restoreExecution",
    "Run Restore",
    "Update ClaimIndex",
    "Save",
    "Delete",
    "Confirm",
    "write to Clio",
  ]) {
    requireNotIncludes(pagePath, page, forbidden, forbidden);
  }

  requireIncludes(adminHomePath, adminHome, 'label: "ClaimIndex Viewer"', "Admin home card label");
  requireIncludes(adminHomePath, adminHome, 'href: "/admin/claim-index"', "Admin home card href");
  requireIncludes(adminHomePath, adminHome, "Read-only audit/search view of the local ClaimIndex table", "Admin home card read-only description");

  requireIncludes(packagePath, pkg, '"verify:admin-claim-index-viewer-safety"', "package verifier script");

  requireRegex(routePath, route, /orderBy:\s*\[\{\s*\[sort\]: direction\s*\},\s*\{\s*matter_id: "asc"\s*\}\]/s, "safe sorted orderBy");
}

if (failures.length) {
  console.error("FAIL: Admin ClaimIndex Viewer safety verification failed.");
  for (const failure of failures) console.error(` - ${failure}`);
  console.error(`Checks run: ${checks.length}`);
  process.exit(1);
}

console.log("PASS: Admin ClaimIndex Viewer is read-only and safety markers are present.");
console.log(`Checks run: ${checks.length}`);
