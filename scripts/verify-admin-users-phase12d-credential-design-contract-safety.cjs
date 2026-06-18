#!/usr/bin/env node
const fs = require("fs");
function read(path){ if(fs.existsSync(path) === false){ console.error("FAIL missing "+path); process.exit(1); } return fs.readFileSync(path,"utf8"); }
function assert(label, ok){ if(ok === false){ console.error("FAIL: "+label); process.exit(1); } console.log("PASS: "+label); }
const doc = read("docs/admin-users-permissions/phase12d-credential-design-contract.md");
const pkg = JSON.parse(read("package.json"));
const adminAuth = read("lib/adminAuth.ts");
const login = read("app/api/auth/login/route.ts");
const session = read("app/api/auth/session/route.ts");
const permissions = read("lib/adminPermissions.ts");
const planning = read("lib/adminUsersPlanning.ts");
assert("Phase 12D npm script registered", pkg.scripts && pkg.scripts["verify:admin-users-phase12d-credential-design-contract-safety"] === "node scripts/verify-admin-users-phase12d-credential-design-contract-safety.cjs");
["Phase 12D is verifier-only","Username mode: separate username only","Username convention: first initial + last name","Jane Doe = JDoe","Owner email: dbarshay15@gmail.com","Owner username: dbarshay","Jane Doe email: jane.doe.limited@example.com","Jane Doe planned username: JDoe","Password setup method: owner bootstrap first","minimum 10 characters","one uppercase letter","one lowercase letter","one number","one symbol","BARSH_ADMIN_PASSWORD fallback remains available","Failed-login behavior: log failed attempts only","2FA: reserve and plan","Usernames should be editable later","AdminUser.id","globally unique case-insensitively","Email uniqueness remains preserved","bcryptjs","Owner recovery/bootstrap path","/admin","/admin/permissions","/api/admin/permissions","/api/admin/permissions/check","Phase 12E","Phase 12F","Phase 12G","Phase 12H"].forEach((text)=>assert("contract contains "+text, doc.includes(text)));
assert("legacy gate cookie remains", adminAuth.includes("barsh_admin_gate"));
assert("identity cookie remains separate", adminAuth.includes("barsh_admin_identity"));
assert("BARSH_ADMIN_PASSWORD support remains", adminAuth.includes("BARSH_ADMIN_PASSWORD"));
assert("login route keeps legacy fallback and can evolve to username/password", login.includes("configuredAdminPassword") && login.includes("setAdminGateCookie(response)"));
assert("login route does not bind identity cookie before Phase 12H", login.includes("ADMIN_IDENTITY_COOKIE_NAME") === false);
assert("session route remains diagnostic", session.includes("identityDiagnostics"));
assert("session route does not query AdminUser", /prisma\.adminUser|adminUser\.find|SELECT[\s\S]*AdminUser/i.test(session) === false);
assert("permissions source still includes never-block route /admin", permissions.includes("/admin"));
assert("permissions source still includes never-block route /admin/permissions", permissions.includes("/admin/permissions"));
assert("planning retains owner email", planning.includes("dbarshay15@gmail.com"));
assert("planning retains owner_admin", planning.includes("owner_admin"));
assert("planning retains read_only_admin", planning.includes("read_only_admin"));
console.log("PASS: Phase 12D design contract remains locked and forward-compatible.");
