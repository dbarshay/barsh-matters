import fs from "node:fs";

let failed = false;
function must(ok, message) {
  if (!ok) {
    failed = true;
    console.error("FAIL: " + message);
  } else {
    console.log("PASS: " + message);
  }
}
function read(path) {
  return fs.readFileSync(path, "utf8");
}

const proxy = read("proxy.ts");
const auth = read("lib/adminAuth.ts");
const login = read("app/api/auth/login/route.ts");
const session = read("app/api/auth/session/route.ts");

must(proxy.includes("roleKeys?: string[]"), "proxy signed gate identity supports roleKeys");
must(proxy.includes('identityRoleKeys.includes("owner_admin")'), "proxy allows signed owner_admin role identity");
must(proxy.includes("identityEmail === OWNER_ADMIN_EMAIL"), "proxy still allows configured owner email");
must(proxy.includes("if (!identityEmail) return NextResponse.next()"), "proxy still allows generic owner recovery session");
must(proxy.includes("return blockedResponse(req)"), "proxy still blocks non-owner identities");
must(auth.includes("roleKeys?: string[]"), "admin auth identity input supports roleKeys");
must(auth.includes("roleKeys: Array.isArray(identity.roleKeys)") || auth.includes("roleKeys: Array.isArray(identity?.roleKeys)"), "admin auth writes roleKeys into signed gate identity");
must(auth.includes("roleKeys: Array.isArray(signedIdentity?.roleKeys)") || auth.includes("roleKeys: signedIdentity"), "admin auth exposes roleKeys diagnostics");
must(login.includes("roleKeys: user.roleKeys"), "login includes roleKeys in signed identity/session response");
must(session.includes("roleKeys: identityDiagnostics.roleKeys"), "session refresh preserves identity roleKeys");
must(!proxy.includes("/matters") && !proxy.includes("/lawsuits"), "proxy remains scoped away from normal matter/lawsuit pages");

if (failed) {
  console.error("RESULT: Admin Users Workflow Phase R owner-role proxy allow verifier failed");
  process.exit(1);
}
console.log("PASS: Admin Users Workflow Phase R owner_role proxy allow locked.");
