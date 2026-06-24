import fs from "node:fs";

const checks = [];
const add = (name, ok) => checks.push({ name, ok });

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
const resolver = read("src/lib/templates/template-builder-live-example-preview.ts");
const pkg = JSON.parse(read("package.json"));

for (const token of [
  "{{matter.fileNumber}}",
  "{{matter.providerName}}",
  "{{matter.patientName}}",
  "{{matter.claimNumber}}",
  "{{matter.dateOfService}}",
  "{{matter.billedAmount}}"
]) {
  add("Resolver allowed tokens include " + token, resolver.includes("\"" + token + "\""));
  add("Resolver populates " + token, resolver.includes("put(resolved, \"" + token + "\""));
}

add("Resolver reuses claimNumber for claim and matter aliases", resolver.includes("const claimNumber = text(from(source") && resolver.includes("put(resolved, \"{{claim.number}}\", claimNumber);"));
add("Resolver reuses previewDateOfService for claim and matter aliases", resolver.includes("const previewDateOfService = rows.length > 1") && resolver.includes("put(resolved, \"{{claim.dateOfService}}\", previewDateOfService);"));
add("Resolver reuses previewBilledAmount for claim and matter aliases", resolver.includes("const previewBilledAmount = rows.length > 1") && resolver.includes("put(resolved, \"{{claim.amount}}\", previewBilledAmount);"));
add("Package has matter-token verifier script", pkg.scripts && pkg.scripts["verify:template-builder-live-preview-matter-tokens"] === "node scripts/verify-template-builder-live-preview-matter-tokens.mjs");

const failed = checks.filter((check) => check.ok === false);
for (const check of checks) {
  const color = check.ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  console.log(color + ": " + check.name);
}
if (failed.length > 0) {
  console.error(String.fromCharCode(10) + failed.length + " Template Builder live preview matter-token checks failed.");
  process.exit(1);
}
console.log(String.fromCharCode(10) + "PASS: Template Builder live preview resolves visible matter.* tokens.");
