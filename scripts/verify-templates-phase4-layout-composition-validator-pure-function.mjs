import { readFileSync } from "node:fs";
import { validateTemplateLayoutComposition, CANONICAL_LAYOUT_ROLES, REJECTED_LAYOUT_ROLE_ALIASES } from "../src/lib/templates/layout-composition-validator.mjs";

const docPath = "docs/templates/templates-phase4-layout-composition-validator-pure-function.md";
const fixturePath = "test/fixtures/templates/layout-composition-validator-fixtures.json";
const sourcePath = "src/lib/templates/layout-composition-validator.mjs";

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
const source = readFileSync(sourcePath, "utf8");
const fixtures = JSON.parse(readFileSync(fixturePath, "utf8"));

requireIncludes(doc, "Templates Phase 4 — Pure Layout Composition Validator", "Phase 4 title");
requireIncludes(doc, "pure function", "pure function wording");
requireIncludes(doc, "not wired into production generation", "no production wiring guardrail");
requireIncludes(doc, "external document-storage interaction", "external storage guardrail");
requireIncludes(source, "export function validateTemplateLayoutComposition", "validator export");
requireIncludes(source, "simpleCoverFaxPage", "canonical simpleCoverFaxPage role");
requireIncludes(source, "LAYOUT_ROLE_REJECTED_ALIAS", "rejected alias error");
requireIncludes(source, "LAYOUT_OUTPUT_ORDER_DEFAULTED", "default output order warning");
requireIncludes(source, "LAYOUT_DEPENDENCY_MISSING_PLEADING_FIELD", "pleading dependency code");

if (!CANONICAL_LAYOUT_ROLES.includes("letterhead")) fail("canonical roles missing letterhead");
if (!CANONICAL_LAYOUT_ROLES.includes("pleadingPaper")) fail("canonical roles missing pleadingPaper");
if (!CANONICAL_LAYOUT_ROLES.includes("simpleCoverFaxPage")) fail("canonical roles missing simpleCoverFaxPage");
if (!REJECTED_LAYOUT_ROLE_ALIASES.includes("simpleCoverPage")) fail("rejected aliases missing simpleCoverPage");

for (const testCase of fixtures.cases) {
  const input = {
    ...testCase.input,
    registry: fixtures.registry,
  };
  const result = validateTemplateLayoutComposition(input);
  if (result.ok !== testCase.expectOk) {
    fail(`${testCase.name}: expected ok=${testCase.expectOk} got ok=${result.ok}`);
  }
  for (const code of testCase.expectErrorCodes || []) {
    if (!result.errors.some((item) => item.code === code)) {
      fail(`${testCase.name}: missing expected error code ${code}; got ${result.errors.map((item) => item.code).join(",")}`);
    }
  }
  for (const code of testCase.expectWarningCodes || []) {
    if (!result.warnings.some((item) => item.code === code)) {
      fail(`${testCase.name}: missing expected warning code ${code}; got ${result.warnings.map((item) => item.code).join(",")}`);
    }
  }
  if (testCase.expectOutputOrder) {
    const actual = result.normalizedComposition?.outputOrder || [];
    if (JSON.stringify(actual) !== JSON.stringify(testCase.expectOutputOrder)) {
      fail(`${testCase.name}: expected output order ${JSON.stringify(testCase.expectOutputOrder)} got ${JSON.stringify(actual)}`);
    }
  }
}

pass("Templates Phase 4 pure validator source, fixtures, and behavior checks passed");
