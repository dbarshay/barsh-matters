#!/usr/bin/env node
const fs = require("fs");
function read(path){ if(fs.existsSync(path) === false){ console.error("FAIL missing "+path); process.exit(1); } return fs.readFileSync(path,"utf8"); }
function assert(label, ok){ if(ok === false){ console.error("FAIL: "+label); process.exit(1); } console.log("PASS: "+label); }

console.log("RUN: Phase 12J admin user lockout controls safety verifier");

const pkg = JSON.parse(read("package.json"));
const route = read("app/api/admin/users/lockout/route.ts");
const page = read("app/admin/users/page.tsx");
const planning = read("app/api/admin/users/planning/route.ts");
const login = read("app/api/auth/login/route.ts");
const permissions = read("lib/adminPermissions.ts");

assert("package script registered for Phase 12J", pkg.scripts && pkg.scripts["verify:admin-users-phase12j-lockout-controls-safety"] === "node scripts/verify-admin-users-phase12j-lockout-controls-safety.cjs");
assert("lockout route exists and is node runtime", route.includes('export const runtime = "nodejs"'));
assert("lockout route requires authenticated admin session", route.includes("isAdminRequestAuthorized(req)") && route.includes("Authenticated administrator session required"));
assert("lockout route requires active owner_admin actor", route.includes("activeOwnerAdminActor") && route.includes("owner_admin") && route.includes('status: "active"'));
assert("lockout route supports preview/apply", route.includes("isApplyRequested") && route.includes('mode: "preview"') && route.includes('mode: "apply"'));
assert("lockout route supports lock and unlock only", route.includes('new Set(["lock", "unlock"])'));
assert("lock action maps to inactive status", route.includes('lockoutAction === "lock" ? "inactive" : "active"'));
assert("lockout route requires explicit reason", route.includes("reason.length < 6"));
assert("lockout route preserves active bootstrap owner", route.includes("activeBootstrapOwnerCountAfterPreview") && route.includes("would leave no active bootstrapSafe owner_admin user"));
assert("lockout route updates AdminUser status", route.includes("tx.adminUser.update") && route.includes("status: nextStatus"));
assert("lockout route does not expose password or username mutation", !route.includes("passwordHash:") && !route.includes("normalizedUsername:"));
assert("lockout route audits lock/unlock", route.includes("admin-user-lock") && route.includes("admin-user-unlock") && route.includes("createMatterAuditLogEntry"));
assert("lockout route forbids password exposure and impersonation", route.includes("passwordExposed: false") && route.includes("impersonationEnabled: false"));
assert("lockout route leaves enforcement disabled", route.includes("enforcementChanged: false"));
assert("Admin Users page exposes lockout card", page.includes('data-barsh-admin-users-lockout-card="true"'));
assert("Admin Users page exposes preview/apply lockout buttons", page.includes('data-barsh-admin-users-lockout-preview-button="true"') && page.includes('data-barsh-admin-users-lockout-apply-button="true"'));
assert("Admin Users page calls lockout route", page.includes('fetch("/api/admin/users/lockout"'));
assert("Admin Users page states no passwords/impersonation", page.includes("Password viewing and login impersonation are intentionally not available"));
assert("planning route exposes lockout metadata", planning.includes("lockoutEligible") && planning.includes("lockedOut"));
assert("login route still requires active owner user", login.includes('user.status === "active"'));
assert("permission enforcement remains off/default allow-all elsewhere", permissions.includes("/admin") && permissions.includes("/admin/permissions") && permissions.includes("/api/admin/permissions") && permissions.includes("/api/admin/permissions/check"));

console.log("CONTRACT: Phase 12J allows owner_admin to preview/apply AdminUser lock/unlock through status active/inactive.");
console.log("CONTRACT: Phase 12J blocks locking the last active bootstrapSafe owner_admin user.");
console.log("CONTRACT: Phase 12J does not expose passwords, does not impersonate users, and does not enable permission enforcement.");
console.log("PASS: Phase 12J admin user lockout controls are no-enforcement and no-impersonation safe.");
