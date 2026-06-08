import fs from "node:fs";

const failures = [];

const routePath = "app/api/admin/document-readiness/audit/route.ts";
const pagePath = "app/admin/document-readiness/audit/page.tsx";
const adminPath = "app/admin/page.tsx";
const lawsuitAuditPath = "app/admin/lawsuits/audit/page.tsx";
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
const admin = read(adminPath);
const lawsuitAudit = read(lawsuitAuditPath);
const pkgText = read(packagePath);
const pkg = pkgText ? JSON.parse(pkgText) : {};

const routeRequired = [
  "export async function GET",
  'import { prisma } from "@/lib/prisma"',
  "prisma.lawsuit.findMany",
  "prisma.claimIndex.findMany",
  "prisma.documentTemplate.count",
  "prisma.documentTemplateVersion.count",
  "prisma.documentTemplateMergeField.count",
  "prisma.documentFinalization.count",
  "prisma.documentPrintQueueItem.count",
  "Read-only Admin Document Generation Readiness Audit",
  "only reads local Prisma tables",
  "no-linked-child-matters",
  "missing-master-clio-shell",
  "partial-master-clio-shell",
  "missing-venue",
  "missing-selected-court-details",
  "other-venue-missing-text",
  "missing-adversary-attorney",
  "missing-adversary-attorney-details",
  "invalid-amount-sought-mode",
  "custom-amount-missing",
  "filed-lawsuit-missing-index-aaa",
  "child-missing-patient",
  "child-missing-provider",
  "child-missing-insurer",
  "child-missing-claim-number",
  "child-missing-claim-amount",
  "child-missing-date-of-service",
  "child-missing-bill-number",
  "no-local-document-templates",
  "no-local-template-versions",
  "no-finalized-document-history",
];

for (const required of routeRequired) mustContain(routePath, route, required);

const routeForbidden = [
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
  "graph.microsoft.com",
  "createUploadSession",
  "Packer.toBuffer",
  "new Document(",
  "uploadDocumentToClio",
  "working-docx",
  "preview-pdf",
  "finalize-preview",
  "finalize/",
  "print-queue-preview",
  "documents/print-queue",
  "sendMail",
  "createDraft",
  "restore-preview",
  "restore-confirm",
  "performRestore",
];

for (const forbidden of routeForbidden) mustNotContain(routePath, route, forbidden);

const pageRequired = [
  'data-barsh-admin-document-readiness-audit="read-only"',
  "/api/admin/document-readiness/audit",
  "Document Generation Readiness Audit",
  "Export Audit CSV",
  "Lawsuit / Master Audit",
  "ClaimIndex Audit",
  "does not call Clio",
  "call Graph",
  "create working documents",
  "generate documents",
  "finalize documents",
  "upload documents",
  "send email",
  "print",
  "queue",
  "restore data",
  "update records",
  "delete records",
  "write to the database",
  "data-barsh-admin-document-readiness-audit-check",
];

for (const required of pageRequired) mustContain(pagePath, page, required);

const pageForbidden = [
  'method: "POST"',
  "method: 'POST'",
  "fetch(`/api/documents",
  "fetch('/api/documents",
  "fetch(`/api/admin/backups/restore",
  "fetch('/api/admin/backups/restore",
  "clioFetch",
  "graph.microsoft.com",
  "sendMail",
  "createDraft",
  "localStorage.setItem",
  "prisma.",
];

for (const forbidden of pageForbidden) mustNotContain(pagePath, page, forbidden);

mustContain(adminPath, admin, "Document Readiness Audit");
mustContain(adminPath, admin, "/admin/document-readiness/audit");
mustContain(adminPath, admin, "Read-only audit for document-generation readiness");

mustContain(lawsuitAuditPath, lawsuitAudit, "/admin/document-readiness/audit");
mustContain(lawsuitAuditPath, lawsuitAudit, "Document Readiness Audit");

if (pkg.scripts?.["verify:admin-document-readiness-audit-safety"] !== "node scripts/verify-admin-document-readiness-audit-safety.mjs") {
  failures.push("package.json: missing verify:admin-document-readiness-audit-safety script");
}

console.log("RESULT: admin Document Generation Readiness Audit safety verifier");

if (failures.length) {
  console.log(`FAILURES=${failures.length}`);
  for (const failure of failures) console.log(`FAIL=${failure}`);
  process.exit(1);
}

console.log("FAILURES=0");
console.log("PASS: Admin Document Generation Readiness Audit is read-only, local-only, verifier-covered, and exposes no Clio/Graph/document-generation/finalization/upload/email/print/queue/restore/write controls.");
