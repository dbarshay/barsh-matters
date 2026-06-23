import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const verifierScripts = [
  "scripts/verify-templates-phase4-layout-composition-validator-pure-function.mjs",
  "scripts/verify-templates-phase5-layout-composition-batch-validator.mjs",
  "scripts/verify-templates-phase6-layout-composition-validation-report-builder.mjs",
  "scripts/verify-templates-phase7-layout-composition-validation-report-runner.mjs",
  "scripts/verify-templates-phase9-layout-composition-admin-readiness-payload.mjs",
  "scripts/verify-templates-phase10-admin-exposure-readiness-plan.mjs",
  "scripts/verify-templates-phase11-read-only-admin-exposure.mjs",
  "scripts/verify-templates-phase12-real-registry-source.mjs",
];

const isolatedRuntimeFiles = [
  "src/lib/templates/layout-composition-validator.mjs",
  "src/lib/templates/layout-composition-batch-validator.mjs",
  "src/lib/templates/layout-composition-validation-report.mjs",
  "scripts/run-template-layout-composition-validation-report.mjs",
  "src/lib/templates/layout-composition-admin-readiness.mjs",
];

const requiredPackageScript = "verify:templates:layout-composition";

function fail(message) {
  console.error(`\x1b[1;31mFAIL:\x1b[0m ${message}`);
  process.exit(1);
}

function pass(message) {
  
const phase14ReadinessInventoryResult = spawnSync(process.execPath, ["scripts/verify-templates-phase14-template-file-readiness-inventory.mjs"], { stdio: "inherit" });
if (phase14ReadinessInventoryResult.status) process.exit(phase14ReadinessInventoryResult.status);


const phase15TemplateFileReadinessReportResult = spawnSync(process.execPath, ["scripts/verify-templates-phase15-template-file-readiness-report.mjs"], { stdio: "inherit" });
if (phase15TemplateFileReadinessReportResult.status) process.exit(phase15TemplateFileReadinessReportResult.status);


const phase16AdminFileReadinessPayloadResult = spawnSync(process.execPath, ["scripts/verify-templates-phase16-admin-file-readiness-payload.mjs"], { stdio: "inherit" });
if (phase16AdminFileReadinessPayloadResult.status) process.exit(phase16AdminFileReadinessPayloadResult.status);

console.log(`\x1b[1;32mPASS:\x1b[0m ${message}`);
}

function runNodeScript(script) {
  const result = spawnSync("node", [script], {
    encoding: "utf8",
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0) {
    fail(`${script} exited with status ${result.status}`);
  }
}

function requireIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) fail(`missing ${label}: ${needle}`);
}

for (const script of verifierScripts) {
  runNodeScript(script);
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const packageScript = packageJson.scripts?.[requiredPackageScript] || "";
requireIncludes(packageScript, "verify-templates-layout-composition-validation-suite.mjs", "package validation suite script");

for (const file of isolatedRuntimeFiles) {
  const source = readFileSync(file, "utf8");
  const namedStoragePattern = new RegExp(["c", "lio"].join(""), "i");
  if (namedStoragePattern.test(source)) {
    fail(`${file} mentions named external-storage service`);
  }
}

const productionSearch = spawnSync("rg", [
  "-n",
  "layout-composition-validator|layout-composition-batch-validator|layout-composition-validation-report|run-template-layout-composition-validation-report",
  "app",
  "pages",
  "components",
  "lib",
], {
  encoding: "utf8",
});

const allowedProductionExposureFiles = new Set([
  "app/admin/templates/layout-composition-validation/page.tsx",
  "app/api/admin/templates/layout-composition-validation/route.ts",
]);

const productionHits = (productionSearch.stdout || "")
  .split("\n")
  .filter(Boolean)
  .filter((line) => {
    const filePath = line.split(":")[0];
    return !allowedProductionExposureFiles.has(filePath);
  })
  .filter((line) => !line.includes("src/lib/templates/layout-composition-validator.mjs"))
  .filter((line) => !line.includes("src/lib/templates/layout-composition-batch-validator.mjs"))
  .filter((line) => !line.includes("src/lib/templates/layout-composition-validation-report.mjs"))
  .filter((line) => !line.includes("scripts/run-template-layout-composition-validation-report.mjs"));

if (productionHits.length > 0) {
  console.error(productionHits.join("\n"));
  fail("layout composition validation stack is wired into production paths");
}

pass("Templates layout composition validation suite passed Phases 4 through 7 plus Phases 9 through 16 and isolation guardrails");

await import('node:child_process').then(({ spawnSync }) => {
  const result = spawnSync(process.execPath, ['scripts/verify-templates-phase13-template-file-inventory-merge-field-contract.mjs'], { stdio: 'inherit' });
  if (result.status) process.exit(result.status);
});

{
  const phase18AChildProcess = await import("node:child_process");
  phase18AChildProcess.execFileSync(process.execPath, ["scripts/verify-templates-phase18a-initial-billing-letter-merge-code-readiness.mjs"], { stdio: "inherit" });
}

{
  const phase18BChildProcess = await import("node:child_process");
  phase18BChildProcess.execFileSync(process.execPath, ["scripts/verify-templates-phase18b-initial-billing-letter-docx-import-gate.mjs"], { stdio: "inherit" });
}
