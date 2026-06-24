import fs from "node:fs";

const checks = [];
const add = (name, ok) => checks.push({ name, ok });

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
const resolver = read("src/lib/templates/template-builder-live-example-preview.ts");
const pkg = JSON.parse(read("package.json"));

add("Resolver has PostgreSQL information_schema column discovery", resolver.includes("information_schema.columns"));
add("Resolver still has SQLite PRAGMA fallback only after PostgreSQL attempt", resolver.includes("PRAGMA table_info"));
add("Resolver has identifier escaping helper", resolver.includes("function identifier(value: string): string"));
add("Resolver has literal escaping helper", resolver.includes("function literal(value: string): string"));
add("Resolver no longer uses SQLite question-mark placeholders", !resolver.includes(" AS TEXT) = ?"));
add("Resolver findRows executes built SQL without placeholder list", resolver.includes("return await prisma.$queryRawUnsafe(sql)"));
add("Resolver still queries ClaimIndex", resolver.includes("findRows(\"ClaimIndex\""));
add("Resolver still queries ProviderClientInfo", resolver.includes("findRows(\"ProviderClientInfo\""));
add("Package has PostgreSQL resolver verifier", pkg.scripts && pkg.scripts["verify:template-builder-live-preview-postgres-resolver"] === "node scripts/verify-template-builder-live-preview-postgres-resolver.mjs");

const failed = checks.filter((check) => check.ok === false);
for (const check of checks) {
  const color = check.ok ? "\\x1b[32mPASS\\x1b[0m" : "\\x1b[31mFAIL\\x1b[0m";
  console.log(color + ": " + check.name);
}
if (failed.length > 0) {
  console.error(String.fromCharCode(10) + failed.length + " PostgreSQL resolver checks failed.");
  process.exit(1);
}
console.log(String.fromCharCode(10) + "PASS: Template Builder live preview PostgreSQL resolver repair verified.");
