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

console.log("RUN: Phase 15 final closeout safety verifier");

const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
const docPath = path.join(process.cwd(), "docs/implementation/admin-users-phase15-final-closeout.md");
const pagePath = path.join(process.cwd(), "app/admin/permissions/page.tsx");
const catalogPath = path.join(process.cwd(), "lib/admin-permissions/catalog.ts");
const matrixPath = path.join(process.cwd(), "lib/admin-permissions/roleMatrix.ts");
const catalogRoutePath = path.join(process.cwd(), "app/api/admin/permissions/catalog/route.ts");
const matrixRoutePath = path.join(process.cwd(), "app/api/admin/permissions/role-matrix/route.ts");
const proxyPath = path.join(process.cwd(), "proxy.ts");

const doc = fs.existsSync(docPath) ? fs.readFileSync(docPath, "utf8") : "";
const page = fs.existsSync(pagePath) ? fs.readFileSync(pagePath, "utf8") : "";
const catalog = fs.existsSync(catalogPath) ? fs.readFileSync(catalogPath, "utf8") : "";
const matrix = fs.existsSync(matrixPath) ? fs.readFileSync(matrixPath, "utf8") : "";
const catalogRoute = fs.existsSync(catalogRoutePath) ? fs.readFileSync(catalogRoutePath, "utf8") : "";
const matrixRoute = fs.existsSync(matrixRoutePath) ? fs.readFileSync(matrixRoutePath, "utf8") : "";
const proxy = fs.existsSync(proxyPath) ? fs.readFileSync(proxyPath, "utf8") : "";

assert("Phase 15 final package script registered", pkg.scripts && pkg.scripts["verify:admin-users-phase15-final-closeout-safety"] === "node scripts/verify-admin-users-phase15-final-closeout-safety.cjs");
assert("Phase 15 final closeout doc exists", Boolean(doc));
assert("Phase 15 catalog exists", Boolean(catalog));
assert("Phase 15 role matrix exists", Boolean(matrix));
assert("Phase 15 catalog API exists", Boolean(catalogRoute));
assert("Phase 15 role matrix API exists", Boolean(matrixRoute));
assert("Phase 15 permissions UI exists", Boolean(page));

for (const script of [
  "verify:admin-users-phase15a-permission-inventory-contract-safety",
  "verify:admin-users-phase15b-permission-ui-read-model-contract-safety",
  "verify:admin-users-phase15c-static-permission-catalog-safety",
  "verify:admin-users-phase15d-read-only-permission-catalog-ui-safety",
  "verify:admin-users-phase15e-static-role-permission-matrix-safety",
]) {
  assert(`Phase 15 script registered: ${script}`, Boolean(pkg.scripts && pkg.scripts[script]));
}

for (const marker of [
  "Phase 15A",
  "Phase 15B",
  "Phase 15C",
  "Phase 15D",
  "Phase 15E",
  "admin-functions-only",
  "does not",
  "No password viewing",
  "No impersonation",
  "/api/admin/permissions/catalog",
  "/api/admin/permissions/role-matrix",
]) {
  assert(`closeout marker present: ${marker}`, doc.includes(marker));
}

assert("catalog route remains GET-only", catalogRoute.includes("export async function GET()") && !catalogRoute.includes("export async function POST("));
assert("role matrix route remains GET-only", matrixRoute.includes("export async function GET()") && !matrixRoute.includes("export async function POST("));
assert("catalog route says runtimeEnforcementChanged false", catalogRoute.includes("runtimeEnforcementChanged: false"));
assert("role matrix route says runtimeEnforcementChanged false", matrixRoute.includes("runtimeEnforcementChanged: false"));
assert("role matrix remains planning-only", matrix.includes("planning-only") && matrixRoute.includes('matrixMode: "planning-only"'));
assert("permissions page remains read-only", page.includes('data-barsh-admin-permissions-page="read-only"'));
assert("permissions page uses catalog endpoint", page.includes("/api/admin/permissions/catalog"));
assert("permissions page uses role matrix endpoint", page.includes("/api/admin/permissions/role-matrix"));
assert("permissions page does not POST", !page.includes('method: "POST"') && !page.includes("method: 'POST'"));

const combined = [doc, page, catalog, matrix, catalogRoute, matrixRoute].join("\n").toLowerCase();
const runtimeCombined = [page, catalog, matrix, catalogRoute, matrixRoute].join("\\n").toLowerCase();

assert("Phase 15 runtime files do not expose password hashes", !runtimeCombined.includes("passwordhash") && !runtimeCombined.includes("temporarypassword"));
assert("Phase 15 runtime files do not add impersonation", !runtimeCombined.includes("impersonat"));

assert("proxy remains admin-only matcher", proxy.includes('"/admin/:path*"') && proxy.includes('"/api/admin/:path*"'));
assert("proxy still avoids matters matcher", !proxy.includes('"/matters/:path*"'));
assert("proxy still avoids lawsuits matcher", !proxy.includes('"/lawsuits/:path*"'));
assert("no middleware.ts added", !fs.existsSync(path.join(process.cwd(), "middleware.ts")));

if (process.exitCode) process.exit(process.exitCode);

console.log("CONTRACT: Phase 15 is read-model/planning/UI only.");
console.log("CONTRACT: Phase 15 does not broaden runtime enforcement beyond admin-functions-only.");
console.log("PASS: Phase 15 final closeout safety verifier passed.");
