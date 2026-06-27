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

const sourcePath = "src/lib/admin-users/admin-users-permission-enforcement-phase-w8.ts";
const source = read(sourcePath);
const doc = read("docs/admin-users/admin-users-phase-w8-enforcement-kill-switch-scaffold.md");
const proof = JSON.parse(read("docs/admin-users/admin-users-phase-w8-enforcement-kill-switch-scaffold.json"));
const session = read("app/api/auth/session/route.ts");
const pkg = JSON.parse(read("package.json"));

const appFiles = [];
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${item.name}`;
    if (item.isDirectory()) {
      if (!["node_modules", ".next", ".git"].includes(item.name)) walk(full);
    } else if (/\.(ts|tsx|mjs|js)$/.test(full)) {
      appFiles.push(full);
    }
  }
}
walk("app");

console.log("RUN: Admin Users Phase W8 enforcement kill-switch scaffold verifier");

must(has(source, "ADMIN_USERS_PHASE_W8_ENFORCEMENT_KILL_SWITCH_SCAFFOLD"), "W8 scaffold marker exists");
must(has(source, "BARSH_ADMIN_USERS_PERMISSION_ENFORCEMENT"), "W8 kill-switch env key exists");
must(has(source, "adminUsersPhaseW8IsPermissionEnforcementEnabled"), "W8 kill-switch helper exists");
must(has(source, "adminUsersPhaseW8DryRunDecision"), "W8 dry-run decision helper exists");
must(has(source, "routeBlockingActive: false"), "W8 helper keeps route blocking inactive");
must(has(source, "uiHidingActive: false"), "W8 helper keeps UI hiding inactive");
must(has(source, "databaseMutated: false"), "W8 helper records no database mutation");
must(has(source, "dryRunOnly: true"), "W8 helper marks dry-run only");
must(has(source, 'actor.roleKeys.includes("owner_admin")'), "W8 keeps owner allow branch");
must(has(source, "Owner is allowed everything and remains protected from lockout"), "W8 owner no-lockout reason exists");

for (const roleKey of ["owner_admin", "administrator", "full_user", "basic_user", "view_only"]) {
  must(has(source, roleKey), `W8 helper references role ${roleKey}`);
}

for (const op of ["payment_manage", "admin_manage", "void", "generate", "finalize", "upload"]) {
  must(has(source, op), `W8 helper references operation ${op}`);
}

const routeImports = appFiles.filter((file) => read(file).includes("admin-users-permission-enforcement-phase-w8"));
must(routeImports.length === 0, "W8 helper is not imported by app routes/pages");

must(proof.phase === "admin-users-phase-w8-enforcement-kill-switch-scaffold", "proof phase is W8");
must(proof.basedOnPhaseW7 === "admin-users-phase-w7-apply-classification-overrides", "proof is based on W7");
must(proof.runtimeEnforcementChanged === false, "proof says runtime enforcement unchanged");
must(proof.routeBlockingActive === false, "proof says route blocking inactive");
must(proof.uiHidingActive === false, "proof says UI hiding inactive");
must(proof.databaseMutated === false, "proof says database not mutated");
must(proof.sessionModeChanged === false, "proof says session mode unchanged");
must(proof.helperWiredIntoRoutes === false, "proof says helper is not route-wired");
must(proof.dryRunOnly === true, "proof says dry-run only");
must(proof.killSwitchEnvKey === "BARSH_ADMIN_USERS_PERMISSION_ENFORCEMENT", "proof records kill-switch env key");

must(has(doc, "scaffold only"), "doc marks scaffold only");
must(has(doc, "No runtime enforcement is enabled"), "doc says runtime enforcement disabled");
must(has(doc, "No route imports or calls this helper"), "doc says helper is not wired");
must(has(doc, "No UI hiding is enabled"), "doc says UI hiding disabled");
must(has(doc, "No backend route blocking is enabled"), "doc says route blocking disabled");
must(has(doc, "No database changes are made"), "doc says database unchanged");
must(has(doc, "owner no-lockout tests"), "doc requires future owner no-lockout tests");

must(has(session, 'permissionsMode: "default-admin-allow-all"'), "session remains default-admin-allow-all");
must(pkg.scripts?.["verify:admin-users-phase-w8-enforcement-kill-switch-scaffold"] === "node scripts/verify-admin-users-phase-w8-enforcement-kill-switch-scaffold.mjs", "package verifier script registered");

if (failures.length) {
  console.error("");
  console.error("FAILURES=" + failures.length);
  process.exit(1);
}

console.log("FAILURES=0");
console.log("PASS: Admin Users Phase W8 enforcement kill-switch scaffold is verifier-locked without route wiring.");
