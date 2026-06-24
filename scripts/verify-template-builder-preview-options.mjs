import fs from "node:fs";

const checks = [];
const add = (name, ok) => checks.push({ name, ok });

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
const build = read("app/admin/document-templates/build/page.tsx");
const pkg = JSON.parse(read("package.json"));

const exampleSelectMatch = build.match(/<select[^>]*value=\{exampleMatter\}[\s\S]*?>([\s\S]*?)<\/select>/);
const exampleSelect = exampleSelectMatch ? exampleSelectMatch[1] : "";
const options = [...exampleSelect.matchAll(/<option value="([^"]+)">/g)].map((match) => match[1]);

add("Example preview select exists", Boolean(exampleSelectMatch));
add("Default preview matter is 2026.06.00011", build.includes("useState(\"2026.06.00011\")"));
add("Preview dropdown includes 2026.06.00011", options.includes("2026.06.00011"));
add("Preview dropdown includes 2026.06.00012", options.includes("2026.06.00012"));
add("Preview dropdown excludes BRL_202600003", !options.includes("BRL_202600003"));
add("Preview dropdown excludes BRL30236", !options.includes("BRL30236"));
add("Preview dropdown excludes 2026.06.00002", !options.includes("2026.06.00002"));
add("Preview dropdown has exactly two options", options.length === 2);
add("Package has preview option verifier script", pkg.scripts && pkg.scripts["verify:template-builder-preview-options"] === "node scripts/verify-template-builder-preview-options.mjs");

const failed = checks.filter((check) => check.ok === false);
for (const check of checks) {
  const color = check.ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  console.log(color + ": " + check.name);
}
if (failed.length > 0) {
  console.error(String.fromCharCode(10) + failed.length + " Template Builder preview option checks failed.");
  process.exit(1);
}
console.log(String.fromCharCode(10) + "PASS: Template Builder preview options restricted to 2026.06.00011 and 2026.06.00012.");
