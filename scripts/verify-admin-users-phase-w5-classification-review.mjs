import fs from "node:fs";

const failures = [];
const read = (path) => fs.readFileSync(path, "utf8");
const has = (text, token) => text.includes(token);
const must = (ok, message) => {
  if (ok) console.log("PASS:", message);
  else {
    console.error("FAIL:", message);
    failures.push(message);
  }
};

const builder = read("scripts/build-admin-users-phase-w5-classification-review.mjs");
const doc = read("docs/admin-users/admin-users-phase-w5-classification-review.md");
const proof = JSON.parse(read("docs/admin-users/admin-users-phase-w5-classification-review.json"));
const w2 = JSON.parse(read("docs/admin-users/admin-users-phase-w2-route-action-classification.json"));
const w3 = JSON.parse(read("docs/admin-users/admin-users-phase-w3-dry-run-permission-simulator.json"));
const session = read("app/api/auth/session/route.ts");
const pkg = JSON.parse(read("package.json"));

console.log("RUN: Admin Users Phase W5 classification review verifier");

must(has(builder, "admin_route_without_card_grant"), "builder checks admin routes without card grants");
must(has(builder, "clients_billing_admin_route_not_payment_sensitive"), "builder checks clients/billing payment sensitivity");
must(has(builder, "payment_sensitive_without_payment_operation"), "builder checks payment operation mismatch");
must(has(builder, "read_or_preview_route_marked_edit"), "builder checks broad edit heuristic");
must(has(builder, "mutation_named_route_without_mutation_operation"), "builder checks mutation route names");
must(has(builder, "settlement_financial_route_not_payment_sensitive"), "builder checks settlement financial sensitivity");
must(has(builder, "document_route_mapped_home_dashboard"), "builder checks document area mismatch");

must(proof.phase === "admin-users-phase-w5-classification-review", "proof phase is W5");
must(proof.basedOnPhaseW2 === w2.phase, "proof is based on W2");
must(proof.basedOnPhaseW3 === w3.phase, "proof is based on W3");
must(proof.runtimeEnforcementChanged === false, "proof says runtime enforcement unchanged");
must(proof.uiHidingActive === false, "proof says UI hiding inactive");
must(proof.backendRouteBlockingActive === false, "proof says backend route blocking inactive");
must(proof.databaseMutated === false, "proof says database not mutated");
must(proof.reviewOnly === true, "proof says review only");
must(proof.totalClassifiedFiles === w2.totalClassifiedFiles, "proof reviewed all W2 classified files");
must(Number.isInteger(proof.issueCount), "proof has numeric issue count");
must(Array.isArray(proof.issues), "proof has issues array");
must(proof.issues.length === proof.issueCount, "proof issue count matches issues array");
must(typeof proof.byIssueKey === "object", "proof has issue-key counts");
must(typeof proof.bySeverity === "object", "proof has severity counts");

for (const row of proof.issues) {
  must(typeof row.path === "string" && row.path.startsWith("app/"), `issue path is app-relative: ${row.path}`);
  must(["high", "medium", "low"].includes(row.severity), `issue severity valid: ${row.path}`);
  must(typeof row.recommendation === "string" && row.recommendation.length > 0, `issue has recommendation: ${row.path}`);
}

must(has(doc, "review report only"), "doc marks review report only");
must(has(doc, "No runtime enforcement is enabled"), "doc says runtime enforcement disabled");
must(has(doc, "No UI hiding is enabled"), "doc says UI hiding disabled");
must(has(doc, "No backend route blocking is enabled"), "doc says backend blocking disabled");
must(has(doc, "No database changes are made"), "doc says database unchanged");
must(has(doc, "Phase W6 should add explicit classification overrides"), "doc points next to W6 overrides");

must(has(session, 'permissionsMode: "default-admin-allow-all"'), "session remains default-admin-allow-all");
must(pkg.scripts?.["build:admin-users-phase-w5-classification-review"] === "node scripts/build-admin-users-phase-w5-classification-review.mjs", "package build script registered");
must(pkg.scripts?.["verify:admin-users-phase-w5-classification-review"] === "node scripts/verify-admin-users-phase-w5-classification-review.mjs", "package verifier script registered");

if (failures.length) {
  console.error("");
  console.error("FAILURES=" + failures.length);
  process.exit(1);
}

console.log("FAILURES=0");
console.log("PASS: Admin Users Phase W5 classification review is verifier-locked without enforcement.");
