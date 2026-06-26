import fs from "node:fs";

const page = fs.readFileSync("app/admin/users/page.tsx", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };

for (const token of [
  "data-barsh-admin-users-audit-history-back-hard-refresh=\"true\"",
  "adminUsersAuditHistoryReturnReloadKey",
  "barshAdminUsersAuditHistoryReturnReload",
  "markAdminUsersAuditHistoryNavigation",
  "consumeAdminUsersAuditHistoryReturnReload",
  "window.sessionStorage.setItem",
  "window.sessionStorage.getItem",
  "window.sessionStorage.removeItem",
  "onClick={markAdminUsersAuditHistoryNavigation}",
  "window.location.reload()",
  "reloadAdminUsersLivePage",
  "window.addEventListener(\"pageshow\"",
  "document.addEventListener(\"visibilitychange\"",
]) must(page.includes(token), "missing guarded hard-refresh token: " + token);

const linkIndex = page.indexOf("data-barsh-admin-users-audit-history-top-link");
const clickIndex = page.indexOf("onClick={markAdminUsersAuditHistoryNavigation}", linkIndex);
must(linkIndex >= 0 && clickIndex > linkIndex, "Audit History link must mark the return-refresh flag before navigation.");

const helperIndex = page.indexOf("const reloadAdminUsersLivePage");
const consumeIndex = page.indexOf("consumeAdminUsersAuditHistoryReturnReload()", helperIndex);
const reloadIndex = page.indexOf("window.location.reload()", helperIndex);
const softReloadIndex = page.indexOf("void loadAdminUsersPlanning()", helperIndex);
must(helperIndex >= 0 && consumeIndex > helperIndex && reloadIndex > consumeIndex && softReloadIndex > reloadIndex, "live reload helper must consume flag, hard refresh once, otherwise soft reload users data.");

for (const forbidden of ["history.back()", "router.back()", "window.location.href = \"/admin/users\""]) {
  must(!page.includes(forbidden), "guarded audit back repair must not use unsafe navigation: " + forbidden);
}

must(pkg.scripts?.["verify:admin-users-workflow-phase-g-audit-back-hard-refresh"] === "node scripts/verify-admin-users-workflow-phase-g-audit-back-hard-refresh.mjs", "package script missing");

if (failures.length) {
  console.error("FAIL: Admin Users Workflow Phase G audit-history hard-refresh verifier failed");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("PASS: Admin Users Workflow Phase G audit-history guarded hard refresh locked.");
