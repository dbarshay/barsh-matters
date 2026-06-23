import fs from "node:fs";

const checks = [];
const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
const assert = (name, condition) => checks.push({ name, pass: Boolean(condition) });

const schema = read("prisma/schema.prisma");
const password = read("src/lib/auth/admin-user-password-security-phase1.ts");
const docs = read("docs/admin-users/signer-profile-phase1-security.md");

assert("password policy minimum length", password.includes("password.length < 8"));
assert("password policy uppercase", password.includes("[A-Z]"));
assert("password policy lowercase", password.includes("[a-z]"));
assert("password policy number", password.includes("[0-9]"));
assert("password policy symbol", password.includes("[^A-Za-z0-9]"));
assert("temporary password generation exists", password.includes("generateTemporaryPassword"));
assert("forced-change flag schema exists", schema.includes("forcePasswordChange"));
assert("failed-login count schema exists", schema.includes("failedLoginCount"));
assert("failed-login lock timestamp schema exists", schema.includes("failedLoginLockedAt"));
assert("failed-login threshold is 5", password.includes("FAILED_LOGIN_LOCKOUT_THRESHOLD = 5"));
assert("password hash field exists", schema.includes("passwordHash"));
assert("no plaintext password field", schema.includes("plainTextPassword") === false && schema.includes("plaintextPassword") === false);
assert("password history schema exists", schema.includes("passwordHistoryJson"));
assert("password history last-three prevention exists", password.includes("PASSWORD_HISTORY_LIMIT = 3") && password.includes("passwordReusesLastThree"));
assert("documentation says never log passwords", docs.includes("never be logged") || docs.includes("Never log") || docs.includes("never stored in plaintext"));

const failed = checks.filter((c) => c.pass === false);
for (const c of checks) console.log(`${c.pass ? "PASS" : "FAIL"}: ${c.name}`);
if (failed.length > 0) process.exit(1);
