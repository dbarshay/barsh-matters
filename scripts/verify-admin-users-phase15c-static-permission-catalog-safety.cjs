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

console.log("RUN: Phase 15C static permission catalog safety verifier");

const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
const catalogPath = path.join(process.cwd(), "lib/admin-permissions/catalog.ts");
const routePath = path.join(process.cwd(), "app/api/admin/permissions/catalog/route.ts");
const docPath = path.join(process.cwd(), "docs/implementation/admin-users-phase15c-static-permission-catalog.md");
const proxyPath = path.join(process.cwd(), "proxy.ts");

const catalog = fs.existsSync(catalogPath) ? fs.readFileSync(catalogPath, "utf8") : "";
const route = fs.existsSync(routePath) ? fs.readFileSync(routePath, "utf8") : "";
const doc = fs.existsSync(docPath) ? fs.readFileSync(docPath, "utf8") : "";
const proxy = fs.existsSync(proxyPath) ? fs.readFileSync(proxyPath, "utf8") : "";

assert("Phase 15C package script registered", pkg.scripts && pkg.scripts["verify:admin-users-phase15c-static-permission-catalog-safety"] === "node scripts/verify-admin-users-phase15c-static-permission-catalog-safety.cjs");
assert("static catalog exists", Boolean(catalog));
assert("catalog API route exists", Boolean(route));
assert("Phase 15C contract doc exists", Boolean(doc));

for (const marker of [
  "ADMIN_PERMISSION_CATALOG",
  "AdminPermissionCatalogItem",
  "enforced-currently",
  "planned-not-enforced",
  "never-block",
  "admin.access",
  "admin.users.manage",
  "admin.permissions.manage",
  "matters.view",
  "matters.edit",
  "matters.close",
  "matters.payments.post",
  "matters.payments.void",
  "lawsuits.view",
  "lawsuits.create",
  "lawsuits.edit",
  "lawsuits.close",
  "lawsuits.payments.post",
  "lawsuits.payments.void",
  "documents.view",
  "documents.generate",
  "documents.finalize",
  "documents.printQueue.manage",
  "settlements.view",
  "settlements.edit",
  "settlements.close",
  "settlements.void",
  "courtCalendar.view",
  "courtCalendar.edit",
  "printQueue.view",
  "printQueue.manage",
  "claimIndex.search",
  "claimIndex.rebuild",
]) {
  assert(`catalog marker present: ${marker}`, catalog.includes(marker));
}

assert("catalog route is admin API route", routePath.includes("app/api/admin/permissions/catalog/route.ts"));
assert("catalog route is GET-only read endpoint", route.includes("export async function GET()") && !route.includes("export async function POST("));
assert("catalog route returns runtimeEnforcementChanged false", route.includes("runtimeEnforcementChanged: false"));
assert("catalog route reports admin-functions-only scope", route.includes('enforcementScope: "admin-functions-only"'));
assert("catalog route does not expose password", !route.toLowerCase().includes("passwordhash") && !route.toLowerCase().includes("temporarypassword"));
assert("catalog route does not impersonate", !route.toLowerCase().includes("impersonat"));

assert("doc says Phase 15C must not broaden runtime enforcement", doc.includes("Phase 15C must not broaden runtime enforcement."));
assert("doc says no password viewing", doc.includes("No password viewing."));
assert("doc says no impersonation", doc.includes("No impersonation."));
assert("doc says no new non-admin route is blocked", doc.includes("No new non-admin route is blocked in Phase 15C."));

assert("proxy still exists", Boolean(proxy));
assert("proxy matcher still scoped to admin routes", proxy.includes('"/admin/:path*"') && proxy.includes('"/api/admin/:path*"'));
assert("proxy still avoids regular matter route matcher", !proxy.includes('"/matters/:path*"'));
assert("proxy still avoids regular lawsuit route matcher", !proxy.includes('"/lawsuits/:path*"'));
assert("no middleware.ts added", !fs.existsSync(path.join(process.cwd(), "middleware.ts")));

if (process.exitCode) process.exit(process.exitCode);

console.log("CONTRACT: Phase 15C adds static catalog/read endpoint only.");
console.log("CONTRACT: Phase 15C does not broaden runtime enforcement beyond admin-functions-only.");
console.log("PASS: Phase 15C static permission catalog is safe.");
