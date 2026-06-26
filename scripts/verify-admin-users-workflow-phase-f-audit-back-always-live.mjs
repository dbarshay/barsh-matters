import fs from "node:fs";

const page = fs.readFileSync("app/admin/users/page.tsx", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };

for (const token of [
  "data-barsh-admin-users-audit-history-back-always-live=\"true\"",
  "reloadAdminUsersLivePage",
  "handleAdminUsersPageShow",
  "handleAdminUsersVisibilityChange",
  "document.visibilityState === \"visible\"",
  "window.addEventListener(\"pageshow\"",
  "window.removeEventListener(\"pageshow\"",
  "document.addEventListener(\"visibilitychange\"",
  "document.removeEventListener(\"visibilitychange\"",
  "closeAdminUsersTransientActionState()",
  "void loadAdminUsersPlanning()",
  "data-barsh-admin-users-audit-history-top-link",
  "/admin/audit-history",
]) must(page.includes(token), "missing audit-history always-live token: " + token);

for (const staleGate of ["if (!event.persisted) return", "PageTransitionEvent"]) {
  must(!page.includes(staleGate), "persisted-only stale-back gate must not remain: " + staleGate);
}

const showIndex = page.indexOf("const handleAdminUsersPageShow");
const reloadIndex = page.indexOf("reloadAdminUsersLivePage();", showIndex);
must(showIndex >= 0 && reloadIndex > showIndex, "pageshow must always reload live Users page state after returning from Audit History.");

const visibilityIndex = page.indexOf("const handleAdminUsersVisibilityChange");
const visibleIndex = page.indexOf("document.visibilityState === \"visible\"", visibilityIndex);
const visibilityReloadIndex = page.indexOf("reloadAdminUsersLivePage();", visibilityIndex);
must(visibilityIndex >= 0 && visibleIndex > visibilityIndex && visibilityReloadIndex > visibleIndex, "visibilitychange must reload live Users page state when the tab becomes visible.");

must(page.includes("window.location.reload()"), "Audit History back repair must hard refresh once when returning from the separate audit route.");
must(page.includes("consumeAdminUsersAuditHistoryReturnReload()"), "Hard refresh must be guarded by the audit-history return flag.");
must(page.indexOf("consumeAdminUsersAuditHistoryReturnReload()") < page.indexOf("window.location.reload()"), "Hard refresh must be guarded before reload.");
for (const forbidden of ["history.back()", "router.back()", "window.location.href = \"/admin/users\""]) {
  must(!page.includes(forbidden), "Audit History back repair must not force unsafe navigation: " + forbidden);
}

must(pkg.scripts?.["verify:admin-users-workflow-phase-f-audit-back-always-live"] === "node scripts/verify-admin-users-workflow-phase-f-audit-back-always-live.mjs", "package script missing");

if (failures.length) {
  console.error("FAIL: Admin Users Workflow Phase F audit-history always-live verifier failed");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("PASS: Admin Users Workflow Phase F audit-history browser-back always-live reload locked.");
