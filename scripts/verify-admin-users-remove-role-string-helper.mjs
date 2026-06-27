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

console.log("RUN: verify remove-role string helper");

must(page.includes("function roleLabelForUser(user: any): string"), "plain roleLabelForUser string helper still exists");
must(page.includes("const currentRoles = roleLabelForUser(user);"), "removeRoleFromRow uses plain string role helper");
must(!page.includes("const currentRoles = adminUsersPhaseV4ERoleDisplay(user);"), "removeRoleFromRow no longer uses JSX role display");
must(page.includes("{adminUsersPhaseV4ERoleDisplay(user)}"), "Users table still uses enhanced role/card display");
must(page.includes('data-barsh-admin-users-phase-v4e-admin-card-label="true"'), "Administrator card-label chips remain present");
must(page.includes('data-barsh-admin-users-phase-v4e-role-explanation="true"'), "Role Guide remains present");
must(session.includes('permissionsMode: "default-admin-allow-all"'), "runtime enforcement remains disabled");
must(pkg.scripts?.["verify:admin-users-remove-role-string-helper"] === "node scripts/verify-admin-users-remove-role-string-helper.mjs", "package verifier script registered");

if (failures.length) {
  console.error("");
  console.error("FAILURES=" + failures.length);
  process.exit(1);
}

console.log("FAILURES=0");
console.log("PASS: remove-role prompt uses string helper while table keeps Administrator card-label display.");
