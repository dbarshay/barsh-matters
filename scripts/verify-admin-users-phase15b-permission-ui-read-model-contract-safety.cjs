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

console.log("RUN: Phase 15B permission UI read-model contract safety verifier");

const docPath = path.join(process.cwd(), "docs/implementation/admin-users-phase15b-permission-ui-read-model-contract.md");
const doc = fs.existsSync(docPath) ? fs.readFileSync(docPath, "utf8") : "";
const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));

assert("Phase 15B verifier package script registered", pkg.scripts && pkg.scripts["verify:admin-users-phase15b-permission-ui-read-model-contract-safety"] === "node scripts/verify-admin-users-phase15b-permission-ui-read-model-contract-safety.cjs");
assert("Phase 15B contract doc exists", Boolean(doc));

for (const marker of [
  "Phase 15B must not broaden runtime enforcement.",
  "admin-functions-only",
  "No password viewing.",
  "No impersonation.",
  "Permission catalog.",
  "Role permission matrix.",
  "User-specific override matrix.",
  "owner_admin",
  "read_only_admin",
  "Jane Doe / read_only_admin",
  "enforced-currently",
  "planned-not-enforced",
  "never-block",
  "view.",
  "edit.",
  "financial.",
  "destructive.",
  "administrative.",
  "allow.",
  "block.",
  "inherited.",
  "not-configured.",
  "matters.view",
  "lawsuits.view",
  "documents.view",
  "settlements.view",
  "courtCalendar.view",
  "printQueue.view",
  "claimIndex.search",
  "matters.payments.post",
  "matters.payments.void",
  "documents.finalize",
  "permission changes must be audit logged",
]) {
  assert(`contract marker present: ${marker}`, doc.includes(marker));
}

const proxyPath = path.join(process.cwd(), "proxy.ts");
const proxy = fs.existsSync(proxyPath) ? fs.readFileSync(proxyPath, "utf8") : "";
assert("proxy still scoped to admin page/API surfaces", proxy.includes("/admin/:path*") && proxy.includes("/api/admin/:path*"));
assert("Phase 15B still avoids regular matters proxy matcher", !proxy.includes("/matters/:path*"));
assert("Phase 15B still avoids regular lawsuits proxy matcher", !proxy.includes("/lawsuits/:path*"));
assert("Phase 15B adds no middleware.ts", !fs.existsSync(path.join(process.cwd(), "middleware.ts")));

if (process.exitCode) process.exit(process.exitCode);

console.log("CONTRACT: Phase 15B defines permission UI/read-model only.");
console.log("CONTRACT: Phase 15B does not broaden enforcement beyond locked admin-functions-only scope.");
console.log("PASS: Phase 15B permission UI read-model contract is safe.");
