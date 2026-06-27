import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const W2_PATH = path.join(ROOT, "docs/admin-users/admin-users-phase-w2-route-action-classification.json");
const W3_PATH = path.join(ROOT, "docs/admin-users/admin-users-phase-w3-dry-run-permission-simulator.json");
const OUT_JSON = path.join(ROOT, "docs/admin-users/admin-users-phase-w5-classification-review.json");
const OUT_MD = path.join(ROOT, "docs/admin-users/admin-users-phase-w5-classification-review.md");

const w2 = JSON.parse(fs.readFileSync(W2_PATH, "utf8"));
const w3 = JSON.parse(fs.readFileSync(W3_PATH, "utf8"));
const rows = w2.classifications || [];

function hasOp(row, op) {
  return Array.isArray(row.operationFamilies) && row.operationFamilies.includes(op);
}

function issue(row, issueKey, severity, reason, recommendation) {
  return {
    issueKey,
    severity,
    path: row.path,
    areaKey: row.areaKey,
    fileKind: row.fileKind,
    operationFamilies: row.operationFamilies,
    paymentSensitive: row.paymentSensitive,
    adminOnly: row.adminOnly,
    adminCardGrantKey: row.adminCardGrantKey,
    reason,
    recommendation,
  };
}

const issues = [];

for (const row of rows) {
  const low = row.path.toLowerCase();

  if (row.adminOnly && !row.adminCardGrantKey && row.path !== "app/admin/page.tsx") {
    issues.push(issue(
      row,
      "admin_route_without_card_grant",
      "high",
      "Admin-only route is not mapped to a specific Admin-card grant.",
      "Review whether this should map to one of the canonical admin.card.* grants or remain Admin landing/context only."
    ));
  }

  if (row.adminCardGrantKey === "admin.card.clientsBilling" && !row.paymentSensitive) {
    issues.push(issue(
      row,
      "clients_billing_admin_route_not_payment_sensitive",
      "medium",
      "Clients/Billing Admin-card route is not marked payment-sensitive.",
      "Confirm whether this is only Admin-card sensitive or also payment-sensitive for Basic User planning."
    ));
  }

  if (row.paymentSensitive && !hasOp(row, "payment_manage") && !hasOp(row, "void")) {
    issues.push(issue(
      row,
      "payment_sensitive_without_payment_operation",
      "medium",
      "Route is marked payment-sensitive but lacks payment_manage or void operation family.",
      "Review operation family classification for payment/billing pages and APIs."
    ));
  }

  if ((low.includes("preview") || low.includes("dry-run") || low.includes("status") || low.includes("history")) && hasOp(row, "edit")) {
    issues.push(issue(
      row,
      "read_or_preview_route_marked_edit",
      "medium",
      "Preview/status/history style route is marked edit, usually because POST/fetch heuristics are broad.",
      "Review whether this route should remain mutation-classified or be classified as view/search only."
    ));
  }

  if ((low.includes("confirm") || low.includes("apply") || low.includes("create") || low.includes("finalize") || low.includes("void") || low.includes("writeback")) && !hasOp(row, "edit") && !hasOp(row, "create") && !hasOp(row, "finalize") && !hasOp(row, "void")) {
    issues.push(issue(
      row,
      "mutation_named_route_without_mutation_operation",
      "high",
      "Route name suggests mutation but operation families do not include mutation/finalize/void.",
      "Review source and add explicit route classification override if needed."
    ));
  }

  if ((low.includes("settlement") && (low.includes("payment") || low.includes("remittance") || low.includes("fee"))) && !row.paymentSensitive) {
    issues.push(issue(
      row,
      "settlement_financial_route_not_payment_sensitive",
      "high",
      "Settlement financial route is not marked payment-sensitive.",
      "Review whether Basic User should be blocked from this route."
    ));
  }

  if ((low.includes("document") || low.includes("generate") || low.includes("finalize") || low.includes("upload")) && row.areaKey === "home_dashboard") {
    issues.push(issue(
      row,
      "document_route_mapped_home_dashboard",
      "medium",
      "Document/generation/finalization route was mapped to home_dashboard.",
      "Review route area classification."
    ));
  }
}

const byIssueKey = {};
const bySeverity = {};
for (const row of issues) {
  byIssueKey[row.issueKey] = (byIssueKey[row.issueKey] || 0) + 1;
  bySeverity[row.severity] = (bySeverity[row.severity] || 0) + 1;
}

const payload = {
  phase: "admin-users-phase-w5-classification-review",
  basedOnPhaseW2: w2.phase,
  basedOnPhaseW3: w3.phase,
  runtimeEnforcementChanged: false,
  uiHidingActive: false,
  backendRouteBlockingActive: false,
  databaseMutated: false,
  reviewOnly: true,
  totalClassifiedFiles: rows.length,
  issueCount: issues.length,
  byIssueKey,
  bySeverity,
  issues,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2) + "\n");

const md = [
  "# Admin Users Phase W5 - Classification Review Before Enforcement",
  "",
  "Status: review report only.",
  "",
  "No runtime enforcement is enabled.",
  "No UI hiding is enabled.",
  "No backend route blocking is enabled.",
  "No database changes are made.",
  "",
  `Classified files reviewed: ${payload.totalClassifiedFiles}`,
  `Potential classification issues: ${payload.issueCount}`,
  "",
  "## Issue counts",
  "",
  ...Object.entries(byIssueKey).sort().map(([key, count]) => `- ${key}: ${count}`),
  "",
  "## Severity counts",
  "",
  ...Object.entries(bySeverity).sort().map(([key, count]) => `- ${key}: ${count}`),
  "",
  "## High-priority review items",
  "",
  ...issues.filter((row) => row.severity === "high").slice(0, 50).map((row) => `- ${row.path} — ${row.issueKey}: ${row.reason}`),
  "",
  "## Next phase",
  "",
  "Phase W6 should add explicit classification overrides for the reviewed routes before any UI hiding or backend enforcement work.",
  "",
].join("\n");

fs.writeFileSync(OUT_MD, md);

console.log(JSON.stringify({
  phase: payload.phase,
  totalClassifiedFiles: payload.totalClassifiedFiles,
  issueCount: payload.issueCount,
  byIssueKey: payload.byIssueKey,
  bySeverity: payload.bySeverity,
  runtimeEnforcementChanged: payload.runtimeEnforcementChanged,
  uiHidingActive: payload.uiHidingActive,
  backendRouteBlockingActive: payload.backendRouteBlockingActive,
  databaseMutated: payload.databaseMutated,
}, null, 2));
