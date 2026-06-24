import fs from "node:fs";

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
const build = read("app/admin/document-templates/build/page.tsx");
const library = read("src/lib/templates/template-builder-merge-field-library.ts");
const pkg = JSON.parse(read("package.json"));

const count = library.split(String.fromCharCode(10)).filter((line) => line.trim().startsWith("mergeField:")).length;
const checks = [
  ["Build Template no longer shows kind/type description after field label", !build.includes("{field.kind} · {field.fieldType}") && !build.includes("signatureHeader · Text")],
  ["Build Template field label remains visible", build.includes("<span style={{ fontWeight: 800 }}>{field.fieldLabel}</span>")],
  ["Merge-field library remains curated", count >= 40 && count <= 70],
  ["Package has field cleanup verifier script", pkg.scripts && pkg.scripts["verify:template-builder-field-cleanup"] === "node scripts/verify-template-builder-field-cleanup.mjs"],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) {
  const color = ok ? "\\x1b[32mPASS\\x1b[0m" : "\\x1b[31mFAIL\\x1b[0m";
  console.log(color + ": " + name);
}
console.log("MERGE_FIELD_COUNT=" + count);
if (failed.length > 0) process.exit(1);
console.log(String.fromCharCode(10) + "PASS: Template Builder field labels cleaned and curated field count verified.");
