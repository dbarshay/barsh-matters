import fs from "node:fs";

const checks = [];
const add = (name, ok) => checks.push({ name, ok });

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
const build = read("app/admin/document-templates/build/page.tsx");

for (const token of [
  "Search merge fields",
  "Example matter",
  "Formats for copy",
  "toggleSort",
  "CopyIcon",
  "navigator.clipboard.writeText",
  "position: \"sticky\""
]) {
  add(`Build Template keeps functional table feature: ${token}`, build.includes(token));
}

for (const token of [
  "Category readiness",
  "Custom manual placeholder readiness",
  "Token scan readiness",
  "Ready for Create Template implementation"
]) {
  add(`Build Template removes visible readiness panel: ${token}`, !build.includes(token));
}

const failed = checks.filter((check) => check.ok === false);
for (const check of checks) {
  const color = check.ok ? "\\x1b[32mPASS\\x1b[0m" : "\\x1b[31mFAIL\\x1b[0m";
  console.log(`${color}: ${check.name}`);
}
if (failed.length > 0) {
  console.error(`\\n${failed.length} Build Template panel-removal checks failed.`);
  process.exit(1);
}
console.log("\\nPASS: Build Template readiness panels removed while table functionality remains.");
