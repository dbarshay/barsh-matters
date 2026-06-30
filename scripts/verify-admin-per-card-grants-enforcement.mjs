import fs from "node:fs";

// Locks per-card admin grant enforcement: catalog bridge (route -> admin.card.* key) + the signed
// identity carrying granted keys through login/session/adminAuth + the proxy consuming them.

const catalog = fs.readFileSync("lib/admin-permissions/catalog.ts", "utf8");
const auth = fs.readFileSync("lib/adminAuth.ts", "utf8");
const login = fs.readFileSync("app/api/auth/login/route.ts", "utf8");
const session = fs.readFileSync("app/api/auth/session/route.ts", "utf8");
const proxy = fs.readFileSync("proxy.ts", "utf8");

const failures = [];
const must = (cond, msg) => { if (!cond) failures.push(msg); };

// Catalog bridge: operational admin cards present as admin-tier perms; their routes covered.
const cards = [
  ["admin.card.auditHistory", "/admin/audit-history"],
  ["admin.card.documentTemplates", "/api/admin/document-templates/*"],
  ["admin.card.referenceData", "/admin/reference-data"],
  ["admin.card.claimIndex", "/api/admin/claim-index/*"],
  ["admin.card.ticklers", "/api/admin/ticklers/*"],
  ["admin.card.clientsBilling", "/admin/clients"],
  ["admin.card.backupRestore", "/api/admin/backups/*"],
  ["admin.card.readinessDashboard", "/admin/readiness-dashboard"],
  ["admin.card.documentReadiness", "/api/admin/document-readiness/*"],
  ["admin.card.lawsuitCleanup", "/api/admin/lawsuits/*"],
];
for (const [key, scope] of cards) {
  must(catalog.includes(`key: "${key}"`), `catalog has per-card admin permission ${key}`);
  must(catalog.includes(`"${scope}"`), `catalog scopes ${key} to ${scope}`);
}
// The two SECURITY cards must NOT be modeled as grantable admin permissions.
must(!catalog.includes("admin.card.usersRoles"), "Users & Roles card is not a grantable admin permission (stays security/owner-only)");
must(!catalog.includes("admin.card.permissionsReview"), "Permissions Review card is not a grantable admin permission (stays never-block)");

// Login stamps real grants into the signed identity.
must(login.includes('AS "grantedAdminPermissionKeys"') && login.includes('po.action = \'grant\''), "login queries granted admin permission overrides");
must(login.includes("grantedAdminPermissionKeys: user.grantedAdminPermissionKeys"), "login puts granted keys into the signed identity");

// adminAuth carries grants through both cookies + diagnostics.
must(auth.includes("grantedAdminPermissionKeys?: string[]"), "adminAuth identity input carries grantedAdminPermissionKeys");
must((auth.match(/grantedAdminPermissionKeys: Array\.isArray\(/g) || []).length >= 3, "adminAuth sanitizes grants in gate cookie, identity cookie, and diagnostics");

// Session refresh preserves grants.
must(session.includes("grantedAdminPermissionKeys: identityDiagnostics.grantedAdminPermissionKeys"), "session refresh preserves granted keys");

// Proxy consumes real cookie grants (with documented fallback for pre-deploy cookies).
must(proxy.includes("gate?.identity?.grantedAdminPermissionKeys") || proxy.includes("gate.identity.grantedAdminPermissionKeys"), "proxy reads granted keys from the signed identity");
must(proxy.includes('roleKeys.includes("administrator")') && proxy.includes("adminPermissionKeysForTier"), "proxy keeps the all-or-nothing fallback for cookies that predate per-card grants");

if (failures.length) {
  console.error("FAIL: per-card admin grant enforcement");
  for (const f of failures) console.error("- " + f);
  process.exit(1);
}
console.log("PASS: per-card admin grant enforcement (catalog bridge + signed-identity grants + proxy consumption).");
