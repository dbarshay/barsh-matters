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

const route = read("app/api/admin/users/planning/route.ts");
const page = read("app/admin/users/page.tsx");
const roleModel = read("src/lib/admin-users/admin-users-final-role-model-phase-v1.ts");
const doc = read("docs/admin-users/admin-users-phase-v2-final-role-ui-card-planning.md");
const proof = JSON.parse(read("docs/admin-users/admin-users-phase-v2-final-role-ui-card-planning.json"));
const session = read("app/api/auth/session/route.ts");
const pkg = JSON.parse(read("package.json"));

console.log("RUN: Admin Users Phase V2 final role UI/card planning verifier");

must(has(route, "ADMIN_USERS_PHASE_V1_FINAL_ROLE_DEFINITIONS"), "planning route imports final role definitions");
must(has(route, "ADMIN_USERS_PHASE_V1_ADMIN_CARDS"), "planning route imports final admin cards");
must(has(route, "finalRoleModel"), "planning route exposes finalRoleModel");
must(has(route, "runtimeEnforcementChanged: false"), "planning route declares no runtime enforcement change");
must(has(route, "databaseMutated: false"), "planning route declares no DB mutation");
must(has(route, "phase-v1-final-role-contract"), "planning route labels final-role source");

for (const roleKey of ["owner_admin", "administrator", "full_user", "basic_user", "view_only"]) {
  must(has(roleModel, `"${roleKey}"`), `Phase V1 role model still contains ${roleKey}`);
  must(proof.finalRoleKeys.includes(roleKey), `Phase V2 proof includes ${roleKey}`);
}

must(has(page, "finalRoleModel"), "Users page reads finalRoleModel");
must(has(page, "finalRoleOptions"), "Users page defines finalRoleOptions");
must(has(page, "phaseV2RoleOptions"), "Users page defines Phase V2 role options");
must(has(page, "function adminRoleOptions(): any[]") && has(page, "return phaseV2RoleOptions;"), "role picklists prefer final role options");
must(has(page, 'data-barsh-admin-users-phase-v2-final-role-picklist="true"'), "assign role picklist has Phase V2 marker");
must(has(page, 'data-barsh-admin-users-phase-v2-final-role-remove-picklist="true"'), "remove role picklist has Phase V2 marker");
must(has(page, "Final Roles:") && has(page, "Admin Cards:"), "Users summary shows final role/admin card counts");
must(has(page, 'data-barsh-admin-users-phase-v2-final-role-model-note="true"'), "Users page shows Phase V2 planning note");

must(has(page, 'data-barsh-admin-users-phase-v2-admin-card-planning="true"'), "Administrator card planning panel present");
must(has(page, 'data-barsh-admin-users-phase-v2-admin-card-checkboxes="true"'), "Administrator card checkbox group present");
must(has(page, 'data-barsh-admin-users-phase-v2-admin-card-checkbox="true"'), "Administrator card checkbox marker present");
const phaseV4CCardGrantUiPresent = has(page, 'data-barsh-admin-users-phase-v4c-admin-card-checkbox="true"') && has(page, 'fetch("/api/admin/users/card-grants"');
must(has(page, "readOnly disabled") || phaseV4CCardGrantUiPresent, "Administrator card checkboxes are read-only in V2 or editable through later V4C guarded route");
must(has(page, "editUserIsAdministratorPlanning"), "Administrator planning visibility is role-aware");
must(has(page, "editUserIsOwnerPlanning"), "Owner planning visibility is role-aware");
must(has(page, "owner_all_cards") && has(page, "administrator_selected_cards"), "Owner and Administrator card planning modes present");

for (const cardKey of ["users_roles", "permissions_review", "audit_history", "document_templates", "reference_data", "claim_index", "ticklers", "clients_billing", "backup_restore", "readiness_dashboard", "document_readiness", "lawsuit_cleanup"]) {
  must(has(roleModel, `key: "${cardKey}"`), `Phase V1 admin card remains present: ${cardKey}`);
}

must(has(doc, "Read-model and UI planning only"), "Phase V2 doc marks planning-only status");
must(has(doc, "does not save Administrator card grants"), "Phase V2 doc says card grants are not saved");
must(has(doc, "does not activate runtime permission enforcement"), "Phase V2 doc says enforcement is not activated");
must(proof.runtimeEnforcementChanged === false, "proof JSON says runtime enforcement unchanged");
must(proof.databaseMutated === false, "proof JSON says database not mutated");
must(proof.sessionBehaviorChanged === false, "proof JSON says session behavior unchanged");
must(proof.rolePicklistsPreferFinalRoleModel === true, "proof JSON says role picklists prefer final model");
must(proof.administratorCardPlanningSavesGrants === false, "proof JSON says card planning does not save grants");

must(has(session, 'permissionsMode: "default-admin-allow-all"'), "session remains default-admin-allow-all");
must(!has(page, "/api/admin/users/card-grants") || phaseV4CCardGrantUiPresent, "no card grant write route introduced before V4C, or later V4C guarded route is present");
must(!has(page, "method: \"PUT\"") && !has(page, "method: 'PUT'"), "Users page does not introduce PUT writes");
must(pkg.scripts?.["verify:admin-users-workflow-phase-v2-final-role-ui-card-planning"] === "node scripts/verify-admin-users-workflow-phase-v2-final-role-ui-card-planning.mjs", "package verifier script registered");

if (failures.length) {
  console.error("");
  console.error("FAILURES=" + failures.length);
  process.exit(1);
}

console.log("FAILURES=0");
console.log("PASS: Admin Users Phase V2 final role UI/card planning is verifier-locked without runtime enforcement or card-grant writes.");
