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

const page = read("app/admin/users/page.tsx");
const route = read("app/api/admin/users/card-grants/route.ts");
const planning = read("app/api/admin/users/planning/route.ts");
const session = read("app/api/auth/session/route.ts");
const doc = read("docs/admin-users/admin-users-phase-v4c-card-grant-ui-wiring.md");
const proof = JSON.parse(read("docs/admin-users/admin-users-phase-v4c-card-grant-ui-wiring.json"));
const pkg = JSON.parse(read("package.json"));

console.log("RUN: Admin Users Phase V4C card-grant UI wiring verifier");

must(has(page, "editAdminCardGrantKeys"), "Users page tracks editable admin card grant keys");
must(has(page, "setEditAdminCardGrantKeys"), "Users page can update grant key state");
must(has(page, "adminUsersPhaseV4CNormalizeGrantKeys"), "Users page normalizes saved grant keys");
must(has(page, "adminUsersPhaseV4CToggleGrantKey"), "Users page toggles card grant keys");
must(has(page, "saveEditAdminCardGrants"), "Users page has saveEditAdminCardGrants function");
must(has(page, 'fetch("/api/admin/users/card-grants"'), "Users page calls card-grants route");
must(has(page, "Preview Card Grants"), "Users page exposes preview card grants button");
must(has(page, "Save Card Grants"), "Users page exposes save card grants button");
must(has(page, 'data-barsh-admin-users-phase-v4c-admin-card-checkbox="true"'), "Users page marks V4C checkboxes");
must(has(page, 'data-barsh-admin-users-phase-v4c-admin-card-actions="true"'), "Users page marks V4C actions");
must(has(page, 'data-barsh-admin-users-phase-v4c-preview-card-grants-button="true"'), "Users page has preview button marker");
must(has(page, 'data-barsh-admin-users-phase-v4c-save-card-grants-button="true"'), "Users page has save button marker");
must(has(page, "grantPermissionKeys: editAdminCardGrantKeys"), "Users page submits selected grant keys");
must(has(page, "apply,"), "Users page supports preview/apply body flag");
must(has(page, "createActorEmail"), "Users page passes owner actor email field");
must(has(page, "editUserIsAdministratorPlanning && !editUserIsOwnerPlanning"), "Users page only shows save actions for non-owner administrator planning");
must(has(page, "editUserIsOwnerPlanning || editAdminCardGrantKeys.includes"), "Owner still shows all-card checked state");
must(has(page, "Runtime enforcement remains disabled") || has(page, "runtime enforcement is still disabled"), "Users page discloses enforcement remains disabled");
must(has(route, 'action: "admin-user-card-grants"'), "V4B card-grants route remains present");
must(has(route, "activeOwnerAdminActor"), "V4B card-grants route still owner-gated");
must(has(route, 'targetRoleKeys.includes("administrator")'), "V4B card-grants route still requires administrator target");
must(has(route, "adminUserPermissionOverride.upsert"), "V4B card-grants route still persists overrides");
must(has(planning, "adminCardGrantKeys"), "planning route still exposes saved grant keys");
must(has(planning, "adminCardGrantPersistenceMode"), "planning route still exposes grant mode");
must(has(doc, "UI wiring only"), "doc marks UI wiring only");
must(proof.runtimeEnforcementChanged === false, "proof says runtime enforcement unchanged");
must(proof.sessionBehaviorChanged === false, "proof says session unchanged");
must(proof.uiWiresCardGrantRoute === true, "proof says UI wires route");
must(proof.previewBeforeApplyAvailable === true, "proof says preview is available");
must(has(session, 'permissionsMode: "default-admin-allow-all"'), "session remains default-admin-allow-all");
must(pkg.scripts?.["verify:admin-users-workflow-phase-v4c-card-grant-ui-wiring"] === "node scripts/verify-admin-users-workflow-phase-v4c-card-grant-ui-wiring.mjs", "package verifier script registered");

if (failures.length) {
  console.error("");
  console.error("FAILURES=" + failures.length);
  process.exit(1);
}

console.log("FAILURES=0");
console.log("PASS: Admin Users Phase V4C card-grant UI wiring is verifier-locked without runtime enforcement changes.");
