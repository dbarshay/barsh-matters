const fs = require("fs");
const path = require("path");

function assert(name, condition) {
  if (!condition) {
    console.error(`FAIL: ${name}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS: ${name}`);
}

console.log("RUN: Phase 15E static role permission matrix safety verifier");

const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
const matrixPath = path.join(process.cwd(), "lib/admin-permissions/roleMatrix.ts");
const routePath = path.join(process.cwd(), "app/api/admin/permissions/role-matrix/route.ts");
const pagePath = path.join(process.cwd(), "app/admin/permissions/page.tsx");
const docPath = path.join(process.cwd(), "docs/implementation/admin-users-phase15e-static-role-permission-matrix.md");
const proxyPath = path.join(process.cwd(), "proxy.ts");

const matrix = fs.existsSync(matrixPath) ? fs.readFileSync(matrixPath, "utf8") : "";
const route = fs.existsSync(routePath) ? fs.readFileSync(routePath, "utf8") : "";
const page = fs.existsSync(pagePath) ? fs.readFileSync(pagePath, "utf8") : "";
const doc = fs.existsSync(docPath) ? fs.readFileSync(docPath, "utf8") : "";
const proxy = fs.existsSync(proxyPath) ? fs.readFileSync(proxyPath, "utf8") : "";

assert("Phase 15E package script registered", pkg.scripts && pkg.scripts["verify:admin-users-phase15e-static-role-permission-matrix-safety"] === "node scripts/verify-admin-users-phase15e-static-role-permission-matrix-safety.cjs");
assert("role matrix file exists", Boolean(matrix));
assert("role matrix API route exists", Boolean(route));
assert("permissions page exists", Boolean(page));
assert("Phase 15E contract doc exists", Boolean(doc));

for (const marker of [
  "ADMIN_PERMISSION_ROLE_MATRIX",
  "owner_admin",
  "read_only_admin",
  "planning-only",
  "READ_ONLY_ADMIN_ALLOWED",
  "READ_ONLY_ADMIN_BLOCKED",
  "matters.view",
  "lawsuits.view",
  "documents.view",
  "settlements.view",
  "courtCalendar.view",
  "printQueue.view",
  "claimIndex.search",
  "admin.access",
  "matters.payments.post",
  "matters.payments.void",
  "lawsuits.payments.post",
  "lawsuits.payments.void",
  "documents.finalize",
]) {
  assert(`matrix marker present: ${marker}`, matrix.includes(marker));
}

assert("role matrix route is GET-only", route.includes("export async function GET()") && !route.includes("export async function POST("));
assert("role matrix route returns runtimeEnforcementChanged false", route.includes("runtimeEnforcementChanged: false"));
assert("role matrix route reports planning-only", route.includes('matrixMode: "planning-only"'));
assert("role matrix route reports admin-functions-only", route.includes('enforcementScope: "admin-functions-only"'));
assert("role matrix route does not expose passwords", !route.toLowerCase().includes("passwordhash") && !route.toLowerCase().includes("temporarypassword"));
assert("role matrix route does not impersonate", !route.toLowerCase().includes("impersonat"));

for (const marker of [
  "/api/admin/permissions/role-matrix",
  "data-barsh-admin-permissions-role-matrix",
  "data-barsh-admin-permissions-role-matrix-runtime-flag",
  "data-barsh-admin-permissions-role-matrix-role",
  "data-barsh-admin-permissions-role-matrix-key",
  "Static Role Permission Matrix",
  "planning-only",
]) {
  assert(`page role-matrix marker present: ${marker}`, page.includes(marker));
}

assert("page remains GET-only", !page.includes('method: "POST"') && !page.includes("method: 'POST'"));
assert("page does not expose password data", !page.toLowerCase().includes("passwordhash") && !page.toLowerCase().includes("temporarypassword"));
assert("page does not impersonate", !page.toLowerCase().includes("impersonat"));
assert("doc says Phase 15E must not broaden runtime enforcement", doc.includes("Phase 15E must not broaden runtime enforcement."));
assert("doc says no new non-admin route is blocked", doc.includes("No new non-admin route is blocked in Phase 15E."));
assert("doc says no password viewing", doc.includes("No password viewing."));
assert("doc says no impersonation", doc.includes("No impersonation."));
assert("proxy remains admin-only matcher", proxy.includes('"/admin/:path*"') && proxy.includes('"/api/admin/:path*"'));
assert("proxy still avoids matters matcher", !proxy.includes('"/matters/:path*"'));
assert("proxy still avoids lawsuits matcher", !proxy.includes('"/lawsuits/:path*"'));
assert("no middleware.ts added", !fs.existsSync(path.join(process.cwd(), "middleware.ts")));

if (process.exitCode) process.exit(process.exitCode);

console.log("CONTRACT: Phase 15E adds planning-only role matrix/read endpoint/UI only.");
console.log("CONTRACT: Phase 15E does not broaden runtime enforcement beyond admin-functions-only.");
console.log("PASS: Phase 15E static role permission matrix is safe.");
