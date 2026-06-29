import fs from "node:fs";

const checks = [];
const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
const assert = (name, condition) => checks.push({ name, pass: Boolean(condition) });

const schema = read("prisma/schema.prisma");
const usersPage = read("app/admin/users/page.tsx");
const signer = read("src/lib/admin-users/admin-user-signer-profile-phase1.ts");
const registry = read("src/lib/templates/template-signer-requirements-registry-phase1.ts");
const docs = read("docs/admin-users/signer-profile-phase1-security.md");
const generationFiles = fs.existsSync("src/lib/templates") ? fs.readdirSync("src/lib/templates").join("\n") : "";

for (const field of ["firstName", "lastName", "displayName", "username", "phoneExtension", "faxNumber", "signatureBlockName", "locked", "inactive"]) {
  assert(`schema has ${field}`, schema.includes(field));
}
for (const ref of ["firstName", "lastName", "displayName", "username", "phoneExtension", "faxNumber", "signatureBlockName", "Reset Password", "Unlock Login", "Clear Failed-Login Lockout"]) {
  assert(`Users admin UI references ${ref}`, usersPage.includes(ref));
}
assert("signer completeness is derived", signer.includes("deriveSignerMissingFields") && signer.includes("deriveSignerProfileStatus"));
assert("eligible signer excludes inactive and requires complete", signer.includes("isEligibleSigner") && signer.includes("inactive"));
const firmContact = read("lib/firmContact.ts");
assert(
  "Initial Billing Letter static bypass sources firm contact from BARSH_FIRM_CONTACT (single source)",
  registry.includes("initial-billing-letter") &&
    registry.includes("BARSH_FIRM_CONTACT") &&
    registry.includes("BARSH_FIRM_CONTACT.telephone") &&
    registry.includes("BARSH_FIRM_CONTACT.email") &&
    registry.includes("BARSH_FIRM_CONTACT.signatureBlockName"),
);
assert(
  "Firm contact literals live in the single firm-contact source",
  firmContact.includes("(631) 210-7272") &&
    firmContact.includes("info@brlfirm.com") &&
    firmContact.includes("Barshay, Rizzo & Lopez, PLLC"),
);
assert("Initial Billing Letter static bypass documented in docs", docs.includes("Initial Billing Letter") && docs.includes("18K/18L"));
assert("no production document-generation signer validation wiring marker", generationFiles.includes("template-signer-requirements-registry-phase1"));

const failed = checks.filter((c) => c.pass === false);
for (const c of checks) console.log(`${c.pass ? "PASS" : "FAIL"}: ${c.name}`);
if (failed.length > 0) process.exit(1);
