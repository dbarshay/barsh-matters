import fs from "node:fs";

const routePath = "app/api/admin/email-automation-status/route.ts";
const adminPath = "app/admin/reference-data/page.tsx";
const packagePath = "package.json";

function read(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`Missing required file: ${path}`);
  }
  return fs.readFileSync(path, "utf8");
}

function assertIncludes(content, needle, label) {
  if (!content.includes(needle)) {
    throw new Error(`Missing ${label}: ${needle}`);
  }
}

function assertExcludes(content, needles, label) {
  for (const needle of needles) {
    if (content.includes(needle)) {
      throw new Error(`Unsafe ${label}: ${needle}`);
    }
  }
}

const route = read(routePath);
const admin = read(adminPath);
const pkg = JSON.parse(read(packagePath));

assertIncludes(route, "export async function GET", "read-only GET handler");
assertIncludes(route, "prisma.emailFilingLog.findMany", "EmailFilingLog read usage");
assertIncludes(route, "prisma.maildropAddress", "MaildropAddress read usage");
assertIncludes(route, "graph_background_thread_sync", "known-thread source");
assertIncludes(route, "graph_maildrop_discovery", "MailDrop discovery source");
assertIncludes(route, "createsDrafts: false", "draft safety flag");
assertIncludes(route, "sendsEmail: false", "send safety flag");
assertIncludes(route, "writesClio: false", "Clio write safety flag");
assertIncludes(route, "uploadsDocuments: false", "document upload safety flag");
assertIncludes(route, "automationHealth", "automation health helper");
assertIncludes(route, "graph_thread_sync_persisted", "existing persisted sync log action");
assertIncludes(route, "callsGraph: false", "Graph call safety flag");
assertIncludes(route, "callsClio: false", "Clio call safety flag");

assertExcludes(route, [
  "createDraft",
  "sendMail",
  "messages/send",
  ".send(",
  "clioApi",
  "getClio",
  "fetchClio",
  "updateClio",
  "writeClio",
  "uploadDocument",
  "documents/upload",
  "export async function POST",
  "export async function PUT",
  "export async function PATCH",
  "export async function DELETE",
], "behavior in email automation status route");

assertIncludes(admin, "Email Automation Status", "admin status panel title");
assertIncludes(admin, "/api/admin/email-automation-status", "admin status route fetch");
assertIncludes(admin, "data-email-automation-status-panel", "admin status panel marker");
assertIncludes(admin, "Refresh Status", "read-only refresh button");
assertIncludes(admin, "Health:", "admin health display");

assertExcludes(admin, [
  "/api/graph/background-thread-sync",
  "/api/graph/maildrop-discovery",
  "createDraft",
  "sendMail",
  "messages/send",
  "Send Email",
  "Create Draft",
], "manual automation controls in admin panel");

if (!pkg.scripts?.["verify:email-automation-status-safety"]) {
  throw new Error("Missing package script verify:email-automation-status-safety");
}

console.log("PASS: email automation status route and admin panel are read-only and safety-guarded.");
