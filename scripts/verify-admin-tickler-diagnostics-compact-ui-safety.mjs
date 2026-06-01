import fs from "node:fs";

const pagePath = "app/admin/ticklers/page.tsx";
const pkgPath = "package.json";

const page = fs.readFileSync(pagePath, "utf8");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

const failures = [];

function mustInclude(label, token) {
  if (!page.includes(token)) failures.push(`${label}: missing ${token}`);
}

mustInclude("compact duplicate diagnostic panel", 'data-barsh-admin-duplicate-settlement-tickler-compact-panel="true"');
mustInclude("compact duplicate diagnostic summary", 'data-barsh-admin-duplicate-settlement-tickler-compact-summary="true"');
mustInclude("compact duplicate diagnostic body", 'data-barsh-admin-duplicate-settlement-tickler-compact-body="true"');
mustInclude("compact duplicate diagnostic label", "Duplicate Tickler Tools");
mustInclude("compact duplicate diagnostic description", "Preview duplicate diagnostics and cleanup plan");
mustInclude("duplicate diagnostic still present", 'data-barsh-admin-duplicate-settlement-tickler-diagnostic="true"');
mustInclude("duplicate diagnostic preview still present", 'data-barsh-admin-duplicate-settlement-tickler-preview-button="true"');
mustInclude("cleanup preview still present", 'data-barsh-admin-duplicate-settlement-tickler-cleanup-preview-button="true"');

if (!page.includes("<details") || !page.includes("</details>")) {
  failures.push("Admin duplicate tickler tools must render as a collapsed details disclosure");
}

if (!pkg.scripts?.["verify:admin-tickler-diagnostics-compact-ui-safety"]) {
  failures.push("package.json missing verify:admin-tickler-diagnostics-compact-ui-safety script");
}

if (failures.length) {
  console.error("FAIL: Admin Tickler diagnostics compact UI verifier");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("PASS: Admin Tickler duplicate diagnostics are compact/collapsible while preserving preview-only tools.");
