import fs from "node:fs";

const header = fs.readFileSync("app/components/BarshHeaderActions.tsx", "utf8");
const home = fs.readFileSync("app/page.tsx", "utf8");
const matters = fs.existsSync("app/matters/page.tsx") ? fs.readFileSync("app/matters/page.tsx", "utf8") : "";
const matterDetail = fs.existsSync("app/matter/[id]/page.tsx") ? fs.readFileSync("app/matter/[id]/page.tsx", "utf8") : "";
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };

for (const token of [
  "data-barsh-header-administrator-link=\"true\"",
  "href=\"/admin\"",
  "onClick={onAdministratorClick}",
  "Open Administrator Home.",
  "{administratorContent}",
]) must(header.includes(token), "missing Administrator header link token: " + token);

for (const forbidden of [
  "Administrator functions require password access.",
  "<button\n          type=\"button\"\n          onClick={onAdministratorClick}",
]) must(!header.includes(forbidden), "Administrator header must not render as handler-only button: " + forbidden);

must(home.includes("function openAdministratorMenu") && home.includes('window.location.href = "/admin"'), "Home page Administrator handler should still target /admin.");
must(home.includes("<BarshHeaderActions onAdministratorClick={openAdministratorMenu} />"), "Home page should still wire Administrator action.");
must(matters.includes("openAdministratorMenu") ? matters.includes('window.location.href = "/admin"') : true, "Matters page Administrator handler should target /admin when present.");
must(matterDetail.includes("openAdministratorMenu") ? matterDetail.includes('window.location.href = "/admin"') : true, "Matter detail Administrator handler should target /admin when present.");

must(pkg.scripts?.["verify:admin-users-workflow-phase-q-administrator-header-link"] === "node scripts/verify-admin-users-workflow-phase-q-administrator-header-link.mjs", "package script missing");

if (failures.length) {
  console.error("FAIL: Admin Users Workflow Phase Q Administrator header link verifier failed");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("PASS: Admin Users Workflow Phase Q Administrator header link locked.");
