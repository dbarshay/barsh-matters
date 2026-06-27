import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const W2_JSON = path.join(ROOT, "docs/admin-users/admin-users-phase-w2-route-action-classification.json");
const OUT_JSON = path.join(ROOT, "docs/admin-users/admin-users-phase-w3-dry-run-permission-simulator.json");
const OUT_MD = path.join(ROOT, "docs/admin-users/admin-users-phase-w3-dry-run-permission-simulator.md");

const w2 = JSON.parse(fs.readFileSync(W2_JSON, "utf8"));
const classifications = w2.classifications || [];

const actors = [
  {
    actorKey: "owner-baseline",
    displayName: "Owner Baseline",
    roleKeys: ["owner_admin"],
    adminCardGrantKeys: [],
  },
  {
    actorKey: "administrator-selected-cards",
    displayName: "Administrator Selected Admin Cards",
    roleKeys: ["administrator"],
    adminCardGrantKeys: [
      "admin.card.clientsBilling",
      "admin.card.documentTemplates",
      "admin.card.ticklers",
    ],
  },
  {
    actorKey: "full-user-baseline",
    displayName: "Full User Baseline",
    roleKeys: ["full_user"],
    adminCardGrantKeys: [],
  },
  {
    actorKey: "basic-user-baseline",
    displayName: "Basic User Baseline",
    roleKeys: ["basic_user"],
    adminCardGrantKeys: [],
  },
  {
    actorKey: "view-only-baseline",
    displayName: "View Only Baseline",
    roleKeys: ["view_only"],
    adminCardGrantKeys: [],
  },
];

const mutationOps = [
  "create",
  "edit",
  "delete",
  "archive",
  "generate",
  "finalize",
  "upload",
  "email",
  "run",
  "void",
  "payment_manage",
  "admin_manage",
];

function hasAnyRole(actor, roleKeys) {
  return roleKeys.some((roleKey) => actor.roleKeys.includes(roleKey));
}

function hasMutation(row) {
  return (row.operationFamilies || []).some((op) => mutationOps.includes(op));
}

function simulate(actor, row) {
  const reasons = [];

  if (hasAnyRole(actor, ["owner_admin"])) {
    reasons.push("Owner allows all classified areas and operations.");
    return decision(actor, row, "allow", reasons);
  }

  if (row.adminOnly) {
    if (hasAnyRole(actor, ["administrator"])) {
      if (!row.adminCardGrantKey) {
        reasons.push("Administrator may reach Admin screen context; route is not mapped to a selected Admin-card grant.");
        return decision(actor, row, "allow", reasons);
      }
      if (actor.adminCardGrantKeys.includes(row.adminCardGrantKey)) {
        reasons.push("Administrator has selected Admin-card grant.");
        return decision(actor, row, "allow", reasons);
      }
      reasons.push("Administrator lacks selected Admin-card grant.");
      return decision(actor, row, "block", reasons);
    }
    reasons.push("Non-admin role cannot access Admin-only route.");
    return decision(actor, row, "block", reasons);
  }

  if (hasAnyRole(actor, ["administrator", "full_user"])) {
    reasons.push("Role allows non-admin access, including payment-sensitive functions.");
    return decision(actor, row, "allow", reasons);
  }

  if (hasAnyRole(actor, ["basic_user"])) {
    if (row.paymentSensitive || (row.operationFamilies || []).includes("payment_manage") || (row.operationFamilies || []).includes("void")) {
      reasons.push("Basic User blocks payment, billing, invoice, void, and settlement-payment functions.");
      return decision(actor, row, "block", reasons);
    }
    reasons.push("Basic User allows non-admin, non-payment-sensitive functions.");
    return decision(actor, row, "allow", reasons);
  }

  if (hasAnyRole(actor, ["view_only"])) {
    if (row.paymentSensitive || hasMutation(row)) {
      reasons.push("View Only blocks payment-sensitive and mutation/action operations.");
      return decision(actor, row, "block", reasons);
    }
    reasons.push("View Only allows non-admin view/search-style operations.");
    return decision(actor, row, "allow", reasons);
  }

  reasons.push("No recognized role allowed this route.");
  return decision(actor, row, "block", reasons);
}

function decision(actor, row, value, reasons) {
  return {
    actorKey: actor.actorKey,
    displayName: actor.displayName,
    roleKeys: actor.roleKeys,
    path: row.path,
    areaKey: row.areaKey,
    operationFamilies: row.operationFamilies,
    paymentSensitive: row.paymentSensitive,
    adminOnly: row.adminOnly,
    adminCardGrantKey: row.adminCardGrantKey,
    decision: value,
    reasons,
    dryRunOnly: true,
    enforcementActive: false,
    uiHidingActive: false,
  };
}

function summarize(actor, rows) {
  return {
    actorKey: actor.actorKey,
    displayName: actor.displayName,
    roleKeys: actor.roleKeys,
    allowCount: rows.filter((row) => row.decision === "allow").length,
    blockCount: rows.filter((row) => row.decision === "block").length,
    blockedAdminCount: rows.filter((row) => row.decision === "block" && row.adminOnly).length,
    blockedPaymentCount: rows.filter((row) => row.decision === "block" && row.paymentSensitive).length,
    blockedMutationCount: rows.filter((row) => row.decision === "block" && hasMutation(row)).length,
  };
}

const results = [];
const summaries = [];

for (const actor of actors) {
  const actorResults = classifications.map((row) => simulate(actor, row));
  results.push(...actorResults);
  summaries.push(summarize(actor, actorResults));
}

const payload = {
  phase: "admin-users-phase-w3-dry-run-permission-simulator",
  generatedAt: new Date().toISOString(),
  basedOnPhaseW2: w2.phase,
  runtimeEnforcementChanged: false,
  uiHidingActive: false,
  databaseMutated: false,
  dryRunOnly: true,
  actorCount: actors.length,
  classificationCount: classifications.length,
  resultCount: results.length,
  actors,
  summaries,
  sampleBlockedRoutes: results
    .filter((row) => row.decision === "block")
    .slice(0, 50),
};

fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2) + "\n");

const lines = [
  "# Admin Users Phase W3 - Dry-Run Permission Simulator",
  "",
  "Status: dry-run simulator only.",
  "",
  "No runtime enforcement is enabled.",
  "No UI hiding is enabled.",
  "No backend route blocking is enabled.",
  "No database changes are made.",
  "",
  `Based on W2 classification: ${w2.phase}`,
  `Classified files evaluated: ${classifications.length}`,
  `Simulated actors: ${actors.length}`,
  `Dry-run results: ${results.length}`,
  "",
  "## Actor summaries",
  "",
  "| Actor | Roles | Allowed | Blocked | Blocked Admin | Blocked Payment | Blocked Mutation |",
  "|---|---:|---:|---:|---:|---:|---:|",
  ...summaries.map((row) => `| ${row.displayName} | ${row.roleKeys.join(", ")} | ${row.allowCount} | ${row.blockCount} | ${row.blockedAdminCount} | ${row.blockedPaymentCount} | ${row.blockedMutationCount} |`),
  "",
  "## Expected dry-run behavior",
  "",
  "- Owner allows every classified route/action.",
  "- Administrator allows non-admin routes and only selected Admin-card routes.",
  "- Full User allows non-admin routes, including payment-sensitive routes, and blocks Admin-only routes.",
  "- Basic User allows non-admin, non-payment routes and blocks Admin/payment-sensitive routes.",
  "- View Only allows non-admin view/search-style routes and blocks mutations, payment-sensitive routes, and Admin-only routes.",
  "",
  "## Next phase",
  "",
  "Phase W4 should expose this simulator in Admin Users or a read-only admin planning view. It should still not enforce blocks.",
  "",
];

fs.writeFileSync(OUT_MD, lines.join("\n"));
console.log(JSON.stringify({
  phase: payload.phase,
  actorCount: payload.actorCount,
  classificationCount: payload.classificationCount,
  resultCount: payload.resultCount,
  summaries: payload.summaries,
  runtimeEnforcementChanged: payload.runtimeEnforcementChanged,
  uiHidingActive: payload.uiHidingActive,
  databaseMutated: payload.databaseMutated,
}, null, 2));
