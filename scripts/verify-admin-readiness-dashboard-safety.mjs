import fs from "node:fs";

const failures = [];

const pagePath = "app/admin/readiness-dashboard/page.tsx";
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

const page = read(pagePath);
const admin = read(adminPath);
const pkgText = read(packagePath);
const pkg = pkgText ? JSON.parse(pkgText) : {};

const pageRequired = [
  'data-barsh-admin-readiness-dashboard="read-only"',
  "Admin Readiness Dashboard",
  "/api/admin/claim-index/audit",
  "/api/admin/lawsuits/audit",
  "/api/admin/document-readiness/audit",
  "/admin/claim-index/audit",
  "/admin/lawsuits/audit",
  "/admin/document-readiness/audit",
  "Refresh Dashboard",
  "Findings Summary",
  "Open Detail Audit",
  "existing read-only Admin audit endpoints",
  "does not edit",
  "save",
  "restore",
  "call Clio",
  "call Graph",
  "generate documents",
  "finalize documents",
  "upload documents",
  "send email",
  "print",
  "queue",
  "delete records",
  "write to the database",
  "data-barsh-admin-readiness-dashboard-card",
];

for (const required of pageRequired) mustContain(pagePath, page, required);

const pageForbidden = [
  'method: "POST"',
  "method: 'POST'",
  "method: \"PUT\"",
  "method: 'PUT'",
  "method: \"PATCH\"",
  "method: 'PATCH'",
  "method: \"DELETE\"",
  "method: 'DELETE'",
  "fetch(`/api/documents",
  "fetch('/api/documents",
  "fetch(`/api/admin/backups/restore",
  "fetch('/api/admin/backups/restore",
  "fetch(`/api/admin/lawsuits/cleanup-confirm",
  "fetch('/api/admin/lawsuits/cleanup-confirm",
  "clioFetch",
  "graph.microsoft.com",
  "sendMail",
  "createDraft",
  "localStorage.setItem",
  "prisma.",
];

for (const forbidden of pageForbidden) mustNotContain(pagePath, page, forbidden);

mustContain(adminPath, admin, "Readiness Dashboard");
mustContain(adminPath, admin, "/admin/readiness-dashboard");
mustContain(adminPath, admin, "Single read-only dashboard for ClaimIndex, Lawsuit/master, and document-generation readiness");

if (pkg.scripts?.["verify:admin-readiness-dashboard-safety"] !== "node scripts/verify-admin-readiness-dashboard-safety.mjs") {
  failures.push("package.json: missing verify:admin-readiness-dashboard-safety script");
}

console.log("RESULT: admin Readiness Dashboard safety verifier");

if (failures.length) {
  console.log(`FAILURES=${failures.length}`);
  for (const failure of failures) console.log(`FAIL=${failure}`);
  process.exit(1);
}

console.log("FAILURES=0");
console.log("PASS: Admin Readiness Dashboard is read-only, uses existing audit endpoints, and exposes no restore/Clio/Graph/document/email/print/queue/write controls.");
