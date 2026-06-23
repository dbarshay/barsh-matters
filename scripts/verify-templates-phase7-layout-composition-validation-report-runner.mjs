import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const docPath = "docs/templates/templates-phase7-layout-composition-validation-report-runner.md";
const runnerPath = "scripts/run-template-layout-composition-validation-report.mjs";
const fixturePath = "test/fixtures/templates/layout-composition-validation-report-runner-fixtures.json";

function fail(message) {
  console.error(`\x1b[1;31mFAIL:\x1b[0m ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`\x1b[1;32mPASS:\x1b[0m ${message}`);
}

function requireIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) fail(`missing ${label}: ${needle}`);
}

const doc = readFileSync(docPath, "utf8");
const runnerSource = readFileSync(runnerPath, "utf8");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

requireIncludes(doc, "Templates Phase 7 — Layout Composition Validation Report Runner", "Phase 7 title");
requireIncludes(doc, "isolated file-input validation report runner", "isolated runner wording");
requireIncludes(doc, "not wired into production generation", "no production wiring guardrail");
requireIncludes(doc, "external document-storage interaction", "external storage guardrail");
requireIncludes(runnerSource, "buildTemplateLayoutCompositionValidationReport", "Phase 6 report builder use");
requireIncludes(runnerSource, "--input <path>", "input argument");
requireIncludes(runnerSource, "--format markdown|json", "format argument");
requireIncludes(runnerSource, "--output <path>", "output argument");
requireIncludes(runnerSource, "return exit(report.ok ? 0 : 1)", "validation exit behavior");

const markdownRun = spawnSync("node", [runnerPath, "--input", fixture.inputPath, "--format", "markdown"], {
  encoding: "utf8",
});

if (markdownRun.status !== 1) {
  fail(`expected markdown run exit 1 for failing validation fixture; got ${markdownRun.status}; stderr=${markdownRun.stderr}`);
}

for (const needle of fixture.expectedMarkdownIncludes) {
  requireIncludes(markdownRun.stdout, needle, "markdown runner output");
}

const jsonRun = spawnSync("node", [runnerPath, "--input", fixture.inputPath, "--format", "json"], {
  encoding: "utf8",
});

if (jsonRun.status !== 1) {
  fail(`expected json run exit 1 for failing validation fixture; got ${jsonRun.status}; stderr=${jsonRun.stderr}`);
}

let parsedJson;
try {
  parsedJson = JSON.parse(jsonRun.stdout);
} catch (error) {
  fail(`json runner output is not valid JSON: ${error.message}`);
}

for (const field of fixture.expectedJsonFields) {
  if (!(field in parsedJson)) fail(`json runner output missing field ${field}`);
}

const invalidArgsRun = spawnSync("node", [runnerPath, "--format", "xml"], {
  encoding: "utf8",
});

if (invalidArgsRun.status !== 2) {
  fail(`expected invalid argument exit 2; got ${invalidArgsRun.status}`);
}

const tempDir = mkdtempSync(join(tmpdir(), "template-report-runner-"));
const outputPath = join(tempDir, "report.md");
try {
  const outputRun = spawnSync("node", [runnerPath, "--input", fixture.inputPath, "--format", "markdown", "--output", outputPath], {
    encoding: "utf8",
  });
  if (outputRun.status !== 1) {
    fail(`expected output run exit 1 for failing validation fixture; got ${outputRun.status}`);
  }
  const outputText = readFileSync(outputPath, "utf8");
  requireIncludes(outputText, "# Template Layout Composition Validation Report", "written markdown report");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

pass("Templates Phase 7 validation report runner source, fixtures, and behavior checks passed");
