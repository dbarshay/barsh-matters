import fs from "node:fs";

const page = fs.readFileSync("app/admin/users/page.tsx", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };

for (const token of [
  "data-barsh-admin-users-audit-history-back-cache-bust=\"true\"",
  "markAdminUsersAuditHistoryNavigation",
  "adminUsersLiveReturn",
  "window.history.replaceState",
  "barshAdminUsersAuditHistoryReturn",
  "window.sessionStorage.setItem",
  "preventAdminUsersBackForwardCache",
  "window.addEventListener(\"unload\"",
  "window.removeEventListener(\"unload\"",
  "consumeAdminUsersAuditHistoryReturnReload()",
  "window.location.reload()",
  "onClick={markAdminUsersAuditHistoryNavigation}",
  "/admin/audit-history",
]) must(page.includes(token), "missing Phase H audit-back cache-bust token: " + token);

const markIndex = page.indexOf("function markAdminUsersAuditHistoryNavigation");
const sessionIndex = page.indexOf("window.sessionStorage.setItem", markIndex);
const cacheBustIndex = page.indexOf("adminUsersLiveReturn", markIndex);
const replaceIndex = page.indexOf("window.history.replaceState", markIndex);
must(markIndex >= 0 && sessionIndex > markIndex && cacheBustIndex > sessionIndex && replaceIndex > cacheBustIndex, "Audit History navigation must set return flag and cache-bust the current Users history entry before leaving.");

const unloadIndex = page.indexOf("preventAdminUsersBackForwardCache");
const addUnloadIndex = page.indexOf("window.addEventListener(\"unload\"", unloadIndex);
const removeUnloadIndex = page.indexOf("window.removeEventListener(\"unload\"", unloadIndex);
must(unloadIndex >= 0 && addUnloadIndex > unloadIndex && removeUnloadIndex > addUnloadIndex, "Users page must register and clean up unload bfcache-prevention handler.");

for (const forbidden of ["history.back()", "router.back()", "window.location.href = \"/admin/users\""]) {
  must(!page.includes(forbidden), "Phase H must not use unsafe back navigation: " + forbidden);
}

must(pkg.scripts?.["verify:admin-users-workflow-phase-h-audit-back-cache-bust"] === "node scripts/verify-admin-users-workflow-phase-h-audit-back-cache-bust.mjs", "package script missing");

if (failures.length) {
  console.error("FAIL: Admin Users Workflow Phase H audit-back cache-bust verifier failed");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("PASS: Admin Users Workflow Phase H audit-back cache-bust locked.");
