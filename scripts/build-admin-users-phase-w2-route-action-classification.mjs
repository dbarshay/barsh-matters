import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, "app");
const OUT_JSON = path.join(ROOT, "docs/admin-users/admin-users-phase-w2-route-action-classification.json");
const OUT_MD = path.join(ROOT, "docs/admin-users/admin-users-phase-w2-route-action-classification.md");

const adminCardRules = [
  ["/admin/users", "admin.card.usersRoles"],
  ["/admin/permissions", "admin.card.permissionsReview"],
  ["/admin/audit", "admin.card.auditHistory"],
  ["/admin/document-templates", "admin.card.documentTemplates"],
  ["/admin/templates", "admin.card.documentTemplates"],
  ["/admin/reference", "admin.card.referenceData"],
  ["/admin/claim", "admin.card.claimIndex"],
  ["/admin/tickler", "admin.card.ticklers"],
  ["/admin/client", "admin.card.clientsBilling"],
  ["/admin/billing", "admin.card.clientsBilling"],
  ["/admin/backup", "admin.card.backupRestore"],
  ["/admin/readiness", "admin.card.readinessDashboard"],
  ["/admin/document-readiness", "admin.card.documentReadiness"],
  ["/admin/lawsuit-cleanup", "admin.card.lawsuitCleanup"],
];

const paymentMarkers = ["billing", "payment", "payments", "invoice", "invoices", "void", "remittance", "settlement-payment", "settlement_status", "settlement-status"];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name === "node_modules" || item.name === ".next" || item.name === ".git") continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, "/");
}

function fileKind(file) {
  if (file.endsWith("/page.tsx") || file.endsWith("/page.ts")) return "page";
  if (file.endsWith("/route.ts") || file.endsWith("/route.tsx")) return "api_route";
  if (file.endsWith("/layout.tsx") || file.endsWith("/layout.ts")) return "layout";
  if (file.includes("/actions/") || file.endsWith("actions.ts") || file.endsWith("actions.tsx")) return "server_action";
  return "component_or_other";
}

function isTrackedAppFile(file) {
  return (
    file.endsWith("/page.tsx") ||
    file.endsWith("/page.ts") ||
    file.endsWith("/route.ts") ||
    file.endsWith("/route.tsx") ||
    file.endsWith("/layout.tsx") ||
    file.endsWith("/layout.ts") ||
    file.endsWith("actions.ts") ||
    file.endsWith("actions.tsx")
  );
}

function paymentSensitive(clean) {
  const low = clean.toLowerCase();
  return paymentMarkers.some((marker) => low.includes(marker));
}

function adminCardGrantKey(clean) {
  const low = clean.toLowerCase();
  const matched = adminCardRules.find(([needle]) => low.includes(needle));
  return matched ? matched[1] : null;
}

function areaKey(clean) {
  const low = clean.toLowerCase();
  const adminGrant = adminCardGrantKey(clean);
  if (low.includes("/admin/") && adminGrant) return "admin_cards";
  if (low.includes("/admin/")) return "admin_screen";
  if (low.includes("billing") || low.includes("invoice") || low.includes("payment")) return "client_billing_payments";
  if (low.includes("settlement") && low.includes("payment")) return "settlement_payment_status";
  if (low.includes("lawsuit")) return "lawsuits";
  if (low.includes("matter") || low.includes("claim")) return "individual_matters";
  if (low.includes("generate")) return "document_generation";
  if (low.includes("document") || low.includes("template")) return "documents";
  if (low.includes("print-queue") || low.includes("print_queue")) return "print_queue";
  if (low.includes("maildrop") || low.includes("email")) return "maildrop_email";
  if (low.includes("clio") || low.includes("finalize") || low.includes("finalization") || low.includes("upload")) return "clio_storage_finalize";
  if (low.includes("tickler")) return "ticklers_non_admin";
  if (low.includes("report") || low.includes("export")) return "reports_exports";
  return "home_dashboard";
}

function operations(clean, text) {
  const low = clean.toLowerCase();
  const ops = new Set(["view"]);
  if (low.includes("search") || text.includes("searchParams")) ops.add("search");
  if (low.includes("generate") || text.includes("generate")) ops.add("generate");
  if (low.includes("finalize") || low.includes("finalization") || text.includes("finalize")) ops.add("finalize");
  if (low.includes("upload") || text.includes("upload")) ops.add("upload");
  if (low.includes("download") || text.includes("download")) ops.add("download");
  if (low.includes("print") || text.includes("print")) ops.add("print");
  if (low.includes("email") || low.includes("maildrop") || text.includes("sendEmail")) ops.add("email");
  if (paymentSensitive(clean)) ops.add("payment_manage");
  if (low.includes("/admin/")) ops.add("admin_manage");

  if (
    text.includes("export async function POST") ||
    text.includes(".create(") ||
    text.includes(".createMany(")
  ) ops.add("create");

  if (
    text.includes("export async function POST") ||
    text.includes("export async function PUT") ||
    text.includes("export async function PATCH") ||
    text.includes(".create(") ||
    text.includes(".update(") ||
    text.includes(".upsert(") ||
    text.includes(".createMany(") ||
    text.includes(".updateMany(") ||
    text.includes("formAction") ||
    text.includes("onSubmit") ||
    text.includes("fetch(")
  ) ops.add("edit");

  if (text.includes("export async function DELETE") || text.includes(".delete(") || text.includes(".deleteMany(")) ops.add("delete");
  if (low.includes("archive") || text.includes("archive")) ops.add("archive");
  if (low.includes("void") || text.includes("void")) ops.add("void");
  if (low.includes("run") || text.includes("run")) ops.add("run");

  return Array.from(ops).sort();
}

const files = walk(APP_DIR).map(rel).filter(isTrackedAppFile).sort();

const classifications = files.map((file) => {
  const text = fs.readFileSync(path.join(ROOT, file), "utf8");
  const clean = file.replaceAll("\\\\", "/");
  return {
    path: clean,
    fileKind: fileKind(clean),
    areaKey: areaKey(clean),
    operationFamilies: operations(clean, text),
    paymentSensitive: paymentSensitive(clean),
    adminOnly: clean.toLowerCase().includes("/admin/"),
    adminCardGrantKey: adminCardGrantKey(clean),
    enforcementActive: false,
    uiHidingActive: false,
    notes: ["Phase W2 classification only. No blocking is enabled."],
  };
});

const summary = {
  phase: "admin-users-phase-w2-route-action-classification",
  generatedAt: new Date().toISOString(),
  runtimeEnforcementChanged: false,
  uiHidingActive: false,
  databaseMutated: false,
  totalClassifiedFiles: classifications.length,
  byFileKind: {},
  byArea: {},
  paymentSensitiveCount: 0,
  adminOnlyCount: 0,
  adminCardGrantKeys: [],
};

for (const row of classifications) {
  summary.byFileKind[row.fileKind] = (summary.byFileKind[row.fileKind] || 0) + 1;
  summary.byArea[row.areaKey] = (summary.byArea[row.areaKey] || 0) + 1;
  if (row.paymentSensitive) summary.paymentSensitiveCount += 1;
  if (row.adminOnly) summary.adminOnlyCount += 1;
  if (row.adminCardGrantKey && !summary.adminCardGrantKeys.includes(row.adminCardGrantKey)) {
    summary.adminCardGrantKeys.push(row.adminCardGrantKey);
  }
}
summary.adminCardGrantKeys.sort();

const payload = { ...summary, classifications };
fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2) + "\n");

const md = [
  "# Admin Users Phase W2 - Route / Page / Action Classification",
  "",
  "Status: classification only.",
  "",
  "No runtime enforcement is enabled.",
  "No UI hiding is enabled.",
  "No backend route blocking is enabled.",
  "No database changes are made.",
  "",
  `Total classified files: ${summary.totalClassifiedFiles}`,
  "",
  "## Summary by file kind",
  "",
  ...Object.entries(summary.byFileKind).sort().map(([key, value]) => `- ${key}: ${value}`),
  "",
  "## Summary by area",
  "",
  ...Object.entries(summary.byArea).sort().map(([key, value]) => `- ${key}: ${value}`),
  "",
  "## Sensitive/admin counts",
  "",
  `- Payment-sensitive files: ${summary.paymentSensitiveCount}`,
  `- Admin-only files: ${summary.adminOnlyCount}`,
  "",
  "## Admin card grant keys observed",
  "",
  ...(summary.adminCardGrantKeys.length ? summary.adminCardGrantKeys.map((key) => `- ${key}`) : ["- None observed"]),
  "",
  "## Next phase",
  "",
  "Phase W3 should build a dry-run simulator that evaluates this classification against users and roles without enforcing blocks.",
  "",
].join("\n");

fs.writeFileSync(OUT_MD, md);
console.log(JSON.stringify(summary, null, 2));
