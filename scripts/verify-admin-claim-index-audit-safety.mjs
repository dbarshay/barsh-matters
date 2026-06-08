import fs from "node:fs";

const failures = [];

const routePath = "app/api/admin/claim-index/audit/route.ts";
const pagePath = "app/admin/claim-index/audit/page.tsx";
const viewerPath = "app/admin/claim-index/page.tsx";
const adminPath = "app/admin/page.tsx";
const packagePath = "package.json";

function read(path) {
  if (!fs.existsSync(path)) {
    failures.push(`${path}: missing file`);
    return "";
  }
  return fs.readFileSync(path, "utf8");
}

function mustContain(label, text, needle) {
  if (!text.includes(needle)) failures.push(`${label}: missing ${needle}`);
}

function mustNotContain(label, text, needle) {
  if (text.includes(needle)) failures.push(`${label}: forbidden ${needle}`);
}

const route = read(routePath);
const page = read(pagePath);
const viewer = read(viewerPath);
const admin = read(adminPath);
const pkg = JSON.parse(read(packagePath) || "{}");

for (const required of [
  "export async function GET",
  'import { prisma } from "@/lib/prisma"',
  "prisma.claimIndex.count",
  "prisma.claimIndex.findMany",
  "prisma.claimIndex.groupBy",
  "prisma.lawsuit.findMany",
  "Read-only Admin ClaimIndex data-quality audit",
  "does not update ClaimIndex, restore data, call Clio, generate documents, send email, print, queue, or write the database",
  "missing-display-number",
  "duplicate-display-number",
  "missing-claim-number-raw",
  "missing-claim-number-normalized",
  "missing-patient-name",
  "missing-provider-identity",
  "missing-insurer-name",
  "invalid-final-status",
  "closed-without-close-reason",
  "close-reason-without-closed-final-status",
  "missing-local-lawsuit-for-master-link",
  "child-linked-to-closed-lawsuit-not-closed",
  "negative-claim-amount",
  "negative-balance-amount",
  "payment-greater-than-claim",
  "missing-claim-amount",
  "stale-indexed-at",
  "missing-indexed-at",
]) {
  mustContain(routePath, route, required);
}

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
  "$executeRaw",
  "$queryRaw",
  "clioFetch",
  "restore-preview",
  "restore-confirm",
  "restoreBackup",
  "performRestore",
  "fetch(`/api/admin/backups/restore",
  "fetch('/api/admin/backups/restore",
  "generate-preview",
  "finalize-preview",
  "working-docx",
  "documents/print-queue",
  "sendMail",
  "createDraft",
]) {
  mustNotContain(routePath, route, forbidden);
}

for (const required of [
  'data-barsh-admin-claim-index-audit="read-only"',
  "/api/admin/claim-index/audit",
  "ClaimIndex Data-Quality Audit",
  "Export Audit CSV",
  "Open ClaimIndex Viewer",
  "does not edit matters",
  "restore data",
  "call Clio",
  "generate documents",
  "send email",
  "print",
  "queue",
  "write to the database",
  "data-barsh-admin-claim-index-audit-check",
]) {
  mustContain(pagePath, page, required);
}

for (const forbidden of [
  'method: "POST"',
  "method: 'POST'",
  "fetch(`/api/documents",
  "fetch('/api/documents",
  "fetch(`/api/admin/backups/restore",
  "fetch('/api/admin/backups/restore",
  "clioFetch",
  "sendMail",
  "createDraft",
  "localStorage.setItem",
  "prisma.",
]) {
  mustNotContain(pagePath, page, forbidden);
}

mustContain(viewerPath, viewer, "/admin/claim-index/audit");
mustContain(viewerPath, viewer, "Data-Quality Audit");

mustContain(adminPath, admin, "ClaimIndex Audit");
mustContain(adminPath, admin, "/admin/claim-index/audit");
mustContain(adminPath, admin, "Read-only data-quality and restore-confidence audit");

if (pkg.scripts?.["verify:admin-claim-index-audit-safety"] !== "node scripts/verify-admin-claim-index-audit-safety.mjs") {
  failures.push("package.json: missing verify:admin-claim-index-audit-safety script");
}

console.log("RESULT: admin ClaimIndex audit safety verifier");

if (failures.length) {
  console.log(`FAILURES=${failures.length}`);
  for (const failure of failures) console.log(`FAIL=${failure}`);
  process.exit(1);
}

console.log("FAILURES=0");
console.log("PASS: Admin ClaimIndex data-quality audit is read-only, local-only, verifier-covered, and exposes no restore/Clio/document/email/print/write controls.");
