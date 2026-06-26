import fs from "node:fs";
const page = fs.readFileSync("app/admin/users/page.tsx", "utf8");
const api = fs.readFileSync("app/api/admin/users/planning/route.ts", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };
for (const token of ["data-barsh-admin-users-table","Display Name","User Name","Role","Last Sign-in","data-barsh-admin-users-create-top-button","data-barsh-admin-users-edit-row-button","data-barsh-admin-users-reset-password-row-button","data-barsh-admin-users-activate-2fa-row-button","data-barsh-admin-users-2fa-enforced-label","data-barsh-admin-users-lock-row-button","data-barsh-admin-users-signout-row-button","data-barsh-admin-users-role-assign-row-button","data-barsh-admin-users-role-remove-row-button"]) must(page.includes(token), "missing table/action token: " + token);
for (const removed of ["data-barsh-admin-users-lockout-card","data-barsh-admin-users-assign-role-control","data-barsh-admin-users-remove-role-control","data-barsh-admin-users-permission-override-control","data-barsh-admin-users-write-controls-preview","data-barsh-admin-users-planning-users","data-barsh-admin-users-planning-roles"]) must(!page.includes(removed), "removed panel still present: " + removed);
for (const route of ["/api/admin/users/signer-profile","/api/admin/users/password-reset","/api/admin/users/lockout","/api/auth/signout","/api/admin/users/assign-role","/api/admin/users/remove-role"]) must(page.includes(route), "row action missing route: " + route);
must(api.includes("lastLoginAt: user.lastLoginAt"), "planning API must expose lastLoginAt");
for (const forbiddenOverride of ["overridePreviewReady","overrideResult","overrideTargetEmail","overridePermissionKey","overrideAction","overrideReason","overrideActorEmail","setOverride","submitPermissionOverride","/api/admin/users/permission-override"]) must(!page.includes(forbiddenOverride), "Permission Override leftover must not remain in Users landing: " + forbiddenOverride);

for (const removedCopy of ["Administrator Management","Manage administrator users, roles, signer profiles, two-factor setup fields, lockout status, password resets, and effective permissions.","Changes remain guarded by preview/apply controls, active owner_admin actor checks, and sole-owner no-lockout protection.","Enforcement Disabled: persisted users, roles, role permissions, and effective permissions are still displayed for review only.","They are not used to block pages or API functions in this phase.","Administrator Users","All users are managed from the table below. Row actions use the existing guarded backend routes."]) must(!page.includes(removedCopy), "removed visible copy still present: " + removedCopy);
for (const forbiddenOverride of ["overridePreviewReady","overrideResult","overrideTargetEmail","overridePermissionKey","overrideAction","overrideReason","overrideActorEmail","setOverride","submitPermissionOverride","/api/admin/users/permission-override"]) must(!page.includes(forbiddenOverride), "Permission Override leftover must not remain in Users landing: " + forbiddenOverride);

for (const forbidden of ["graphFetchJson","sendMail(","legacyClioOperationalRouteBlocked","DocumentTemplate"]) must(!page.includes(forbidden), "forbidden workflow token present: " + forbidden);
must(pkg.scripts?.["verify:admin-users-workflow-phase-b-table-actions"] === "node scripts/verify-admin-users-workflow-phase-b-table-actions.mjs", "package script missing");

const summaryIndex = page.indexOf("data-barsh-admin-users-planning-summary");
const createTopIndex = page.indexOf("data-barsh-admin-users-create-top-button");
const tableIndex = page.indexOf("data-barsh-admin-users-table");
const auditIndex = page.indexOf("Admin Users Audit Visibility");
must(summaryIndex >= 0 && createTopIndex > summaryIndex && createTopIndex < tableIndex, "Create User button must be in the Users/Roles/Enforcement summary row.");
must(auditIndex > tableIndex, "Admin Users Audit Visibility box must be below the users table.");
must(!page.includes("data-barsh-admin-users-top-actions"), "Separate top-actions panel must not remain.");
for (const removedCopy of ["Administrator Management","Manage administrator users, roles, signer profiles, two-factor setup fields, lockout status, password resets, and effective permissions.","Changes remain guarded by preview/apply controls, active owner_admin actor checks, and sole-owner no-lockout protection.","Enforcement Disabled: persisted users, roles, role permissions, and effective permissions are still displayed for review only.","They are not used to block pages or API functions in this phase."]) must(!page.includes(removedCopy), "removed visible copy still present: " + removedCopy);
for (const forbiddenOverride of ["overridePreviewReady","overrideResult","overrideTargetEmail","overridePermissionKey","overrideAction","overrideReason","overrideActorEmail","setOverride","submitPermissionOverride","/api/admin/users/permission-override"]) must(!page.includes(forbiddenOverride), "Permission Override leftover must not remain in Users landing: " + forbiddenOverride);

if (failures.length) { console.error("FAIL: Admin Users Workflow Phase B verifier failed"); for (const failure of failures) console.error(" - " + failure); process.exit(1); }
console.log("PASS: Admin Users Workflow Phase B table-first action UI locked.");
