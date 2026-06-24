import fs from "node:fs";

const checks = [];
const add = (name, ok) => checks.push({ name, ok });

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
const build = read("app/admin/document-templates/build/page.tsx");
const pkg = JSON.parse(read("package.json"));

add("Build Template includes 2026.06.00011 as an example matter option", build.includes("<option value=\"2026.06.00011\">2026.06.00011</option>"));
add("Build Template includes 2026.06.00012 as an example matter option", build.includes("<option value=\"2026.06.00012\">2026.06.00012</option>"));
add("Build Template excludes retired example matter BRL_202600003", !build.includes("<option value=\"BRL_202600003\">"));
add("Build Template excludes retired example matter BRL30236", !build.includes("<option value=\"BRL30236\">"));
add("Build Template excludes retired example matter 2026.06.00002", !build.includes("<option value=\"2026.06.00002\">"));
add("Package has example matter verifier script", pkg.scripts && pkg.scripts["verify:template-builder-example-matter-20260600011"] === "node scripts/verify-template-builder-example-matter-20260600011.mjs");

const failed = checks.filter((check) => check.ok === false);
for (const check of checks) {
  const color = check.ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  console.log(color + ": " + check.name);
}
if (failed.length > 0) {
  console.error(String.fromCharCode(10) + failed.length + " Template Builder example matter checks failed.");
  process.exit(1);
}
console.log(String.fromCharCode(10) + "PASS: Template Builder example matter options verified.");
