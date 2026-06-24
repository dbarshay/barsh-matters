import fs from "node:fs";

const checks = [];
const add = (name, ok) => checks.push({ name, ok });

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";

const build = read("app/admin/document-templates/build/page.tsx");

for (const token of [
  "type SortKey",
  "category",
  "fieldLabel",
  "mergeField",
  "exampleOutput",
  "toggleSort",
  "sortIndicator",
  "position: \"sticky\"",
  "top: 0",
  "CopyIcon",
  "navigator.clipboard.writeText",
  "document.execCommand(\"copy\")",
  "aria-label={\"Copy \" + token}",
  "title={copied ? \"Copied\" : \"Copy\"}",
  "Merge Field"
]) {
  add(`Build Template sortable/copy UI contains ${token}`, build.includes(token));
}

add("Copy icon is in merge-field cell", build.includes("<code style={{ fontFamily: \"monospace\" }}>{token}</code>") && build.includes("<CopyIcon />"));
add("Sortable Category header present", build.includes("toggleSort(\"category\")"));
add("Sortable Field Label header present", build.includes("toggleSort(\"fieldLabel\")"));
add("Sortable Merge Field header present", build.includes("toggleSort(\"mergeField\")"));
add("Sortable Example Output header present", build.includes("toggleSort(\"exampleOutput\")"));

const doc3 = read("docs/templates/template-builder-phase3-merge-field-library-readiness.md");
add("Phase 3 doc no longer says General appears last", !doc3.includes("appears last"));

const pkg = JSON.parse(read("package.json"));
add("Package has UI polish verifier script", pkg.scripts && pkg.scripts["verify:template-builder-ui-polish"] === "node scripts/verify-template-builder-ui-polish.mjs");

const failed = checks.filter((check) => check.ok === false);
for (const check of checks) {
  const color = check.ok ? "\\x1b[32mPASS\\x1b[0m" : "\\x1b[31mFAIL\\x1b[0m";
  console.log(`${color}: ${check.name}`);
}
if (failed.length > 0) {
  console.error(`\\n${failed.length} Template Builder UI polish checks failed.`);
  process.exit(1);
}
console.log("\\nPASS: Template Builder Build Template sortable sticky table and copy-icon UI verified.");
