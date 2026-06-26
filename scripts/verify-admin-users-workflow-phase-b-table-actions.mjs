import fs from "node:fs";
const page = fs.readFileSync("app/admin/users/page.tsx", "utf8");
const api = fs.readFileSync("app/api/admin/users/planning/route.ts", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };

for (const token of ["data-barsh-admin-users-table","Display Name","User Name","Role","Last Sign-in","data-barsh-admin-users-create-top-button","data-barsh-admin-users-audit-history-top-link","Open Audit History","data-barsh-admin-users-edit-row-button","data-barsh-admin-users-reset-password-row-button","data-barsh-admin-users-activate-2fa-row-button","data-barsh-admin-users-2fa-enforced-label","data-barsh-admin-users-lock-row-button","data-barsh-admin-users-signout-row-button"]) must(page.includes(token), "missing table/top-action token: " + token);
for (const editToken of ["data-barsh-admin-users-edit-panel","data-barsh-admin-users-edit-first-name","data-barsh-admin-users-edit-last-name","data-barsh-admin-users-edit-display-name","data-barsh-admin-users-edit-username","data-barsh-admin-users-edit-email","data-barsh-admin-users-edit-phone-extension","data-barsh-admin-users-edit-fax-number","data-barsh-admin-users-edit-signature-block-name","data-barsh-admin-users-edit-two-factor-phone","data-barsh-admin-users-edit-role-assign","data-barsh-admin-users-edit-role-remove","data-barsh-admin-users-edit-save-button","saveEditAdminUserPanel","openEditAdminUserPanel"]) must(page.includes(editToken), "missing edit panel token: " + editToken);
for (const promptToken of ["window.prompt(\"Display Name\"","window.prompt(\"User Name\"","Role to assign while editing. Leave blank for no assignment."]) must(!page.includes(promptToken), "prompt-based edit workflow must not remain: " + promptToken);
for (const route of ["/api/admin/users/signer-profile","/api/admin/users/password-reset","/api/admin/users/lockout","/api/auth/signout","/api/admin/users/assign-role","/api/admin/users/remove-role","/admin/audit-history"]) must(page.includes(route), "required action route/link missing: " + route);
for (const removed of ["data-barsh-admin-users-lockout-card","data-barsh-admin-users-assign-role-control","data-barsh-admin-users-remove-role-control","data-barsh-admin-users-permission-override-control","data-barsh-admin-users-write-controls-preview","data-barsh-admin-users-planning-users","data-barsh-admin-users-planning-roles","data-barsh-admin-users-top-actions","data-barsh-admin-users-audit-visibility"]) must(!page.includes(removed), "removed panel still present: " + removed);
must(api.includes("lastLoginAt: user.lastLoginAt"), "planning API must expose lastLoginAt");
must(page.includes("credentials: \"same-origin\""), "guarded fetches must explicitly carry same-origin credentials");
for (const forbiddenOverride of ["overridePreviewReady","overrideResult","overrideTargetEmail","overridePermissionKey","overrideAction","overrideReason","overrideActorEmail","setOverride","submitPermissionOverride","/api/admin/users/permission-override"]) must(!page.includes(forbiddenOverride), "Permission Override leftover must not remain in Users landing: " + forbiddenOverride);

const summaryIndex = page.indexOf("data-barsh-admin-users-planning-summary");
const auditTopIndex = page.indexOf("data-barsh-admin-users-audit-history-top-link");
const createTopIndex = page.indexOf("data-barsh-admin-users-create-top-button");
const tableIndex = page.indexOf("data-barsh-admin-users-table");
must(summaryIndex >= 0 && auditTopIndex > summaryIndex && createTopIndex > auditTopIndex && createTopIndex < tableIndex, "Audit History and Create User buttons must be in the summary row before the table.");

for (const rowActionStyleToken of ["data-barsh-admin-users-edit-row-button","data-barsh-admin-users-reset-password-row-button","data-barsh-admin-users-activate-2fa-row-button","data-barsh-admin-users-lock-row-button","data-barsh-admin-users-signout-row-button"]) {
  const idx = page.indexOf(rowActionStyleToken + "=\"true\"");
  const start = page.lastIndexOf("<button", idx);
  const end = page.indexOf("</button>", idx);
  const block = page.slice(start, end);
  must(block.includes("...primaryButtonStyle") && block.includes("color: \"#ffffff\""), "Row action button must use unified primary blue/white style: " + rowActionStyleToken);
  must(!block.includes("secondaryButtonStyle"), "Row action button must not use secondary style: " + rowActionStyleToken);
}

for (const removedRoleButton of ["data-barsh-admin-users-role-assign-row-button","data-barsh-admin-users-role-remove-row-button",">Assign</button>",">Remove</button>"]) must(!page.includes(removedRoleButton), "Role column assign/remove button must not remain: " + removedRoleButton);
for (const forbidden of ["graphFetchJson","sendMail(","legacyClioOperationalRouteBlocked","DocumentTemplate"]) must(!page.includes(forbidden), "forbidden workflow token present: " + forbidden);
must(pkg.scripts?.["verify:admin-users-workflow-phase-b-table-actions"] === "node scripts/verify-admin-users-workflow-phase-b-table-actions.mjs", "package script missing");

if (failures.length) { console.error("FAIL: Admin Users Workflow Phase C edit panel verifier failed"); for (const failure of failures) console.error(" - " + failure); process.exit(1); }
console.log("PASS: Admin Users Workflow Phase C edit panel UI locked.");
