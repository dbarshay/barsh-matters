import fs from "node:fs";

const page = fs.readFileSync("app/admin/users/page.tsx", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };

for (const token of [
  "data-barsh-admin-users-audit-history-back-live-reload=\"true\"",
  "handleAdminUsersPageShow",
  "PageTransitionEvent",
  "event.persisted",
  "window.addEventListener(\"pageshow\"",
  "window.removeEventListener(\"pageshow\"",
  "closeAdminUsersTransientActionState()",
  "void loadAdminUsersPlanning()",
  "data-barsh-admin-users-audit-history-top-link",
  "/admin/audit-history",
]) must(page.includes(token), "missing audit-history back live reload token: " + token);

const pageShowIndex = page.indexOf("handleAdminUsersPageShow");
const persistedIndex = page.indexOf("event.persisted", pageShowIndex);
const closeIndex = page.indexOf("closeAdminUsersTransientActionState()", pageShowIndex);
const reloadIndex = page.indexOf("void loadAdminUsersPlanning()", pageShowIndex);
must(pageShowIndex >= 0 && persistedIndex > pageShowIndex && closeIndex > persistedIndex && reloadIndex > closeIndex, "pageshow handler must only refresh bfcache returns and then close transient state before reloading live users.");

for (const forbidden of ["window.location.reload()", "history.back()", "router.back()", "window.location.href = \"/admin/users\""]) {
  must(!page.includes(forbidden), "Audit History back repair must not force hard navigation: " + forbidden);
}

must(pkg.scripts?.["verify:admin-users-workflow-phase-e-audit-back-live-reload"] === "node scripts/verify-admin-users-workflow-phase-e-audit-back-live-reload.mjs", "package script missing");

if (failures.length) {
  console.error("FAIL: Admin Users Workflow Phase E audit-history back verifier failed");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("PASS: Admin Users Workflow Phase E audit-history browser-back live reload locked.");
