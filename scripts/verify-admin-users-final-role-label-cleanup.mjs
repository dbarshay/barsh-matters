import fs from "node:fs";

const page = fs.readFileSync("app/admin/users/page.tsx", "utf8");
const session = fs.readFileSync("app/api/auth/session/route.ts", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

const failures = [];
function must(ok, message) {
  if (ok) console.log("PASS:", message);
  else {
    console.error("FAIL:", message);
    failures.push(message);
  }
}

console.log("RUN: verify Admin Users final role label cleanup");

must(page.includes("Administrator Admin-card access can be previewed and saved. Permission enforcement is not active yet."), "summary banner uses user-facing wording");
must(page.includes("Select which Admin cards this Administrator can access. Permission enforcement is not active yet."), "edit panel uses user-facing card-grant wording");
must(!page.includes("Phase V4C: final five-role model is visible"), "summary banner no longer shows phase scaffold wording");
must(!page.includes("Phase V4C: these checkboxes save"), "edit panel no longer shows phase scaffold wording");
must(page.includes("adminUsersPhaseV4FRoleLabel"), "role label helper exists");
must(page.includes("adminUsersPhaseV4FRoleLabels"), "role labels helper exists");
must(page.includes('if (cleanKey === "owner_admin") return "Owner";'), "owner_admin maps to Owner");
must(page.includes('if (cleanKey === "administrator") return "Administrator";'), "administrator maps to Administrator");
must(page.includes("const roleLabels = adminUsersPhaseV4FRoleLabels(user);"), "role display uses display labels");
must(page.includes("<strong>{roleLabels.join(\", \") || \"—\"}</strong>"), "table role display renders labels");
must(page.includes("roleLabelForUser(user)"), "remove-role prompt still uses internal string helper");
must(page.includes('data-barsh-admin-users-phase-v4e-admin-card-label="true"'), "administrator card-label chips remain present");
must(page.includes('data-barsh-admin-users-phase-v4e-role-explanation="true"'), "Role Guide remains present");
must(session.includes('permissionsMode: "default-admin-allow-all"'), "runtime enforcement remains disabled");
must(pkg.scripts?.["verify:admin-users-final-role-label-cleanup"] === "node scripts/verify-admin-users-final-role-label-cleanup.mjs", "package verifier script registered");

if (failures.length) {
  console.error("");
  console.error("FAILURES=" + failures.length);
  process.exit(1);
}

console.log("FAILURES=0");
console.log("PASS: Admin Users role labels and user-facing banner cleanup are locked.");
