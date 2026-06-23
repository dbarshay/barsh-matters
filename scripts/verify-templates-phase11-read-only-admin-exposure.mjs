import { readFileSync } from "node:fs";

const fixture = JSON.parse(readFileSync("test/fixtures/templates/templates-phase11-read-only-admin-exposure-fixtures.json", "utf8"));
const page = readFileSync(fixture.page, "utf8");
const api = readFileSync(fixture.api, "utf8");
const doc = readFileSync("docs/templates/templates-phase11-read-only-admin-exposure.md", "utf8");

function fail(message) {
  console.error(`\x1b[1;31mFAIL:\x1b[0m ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`\x1b[1;32mPASS:\x1b[0m ${message}`);
}

function includes(haystack, needle, label) {
  if (!haystack.includes(needle)) fail(`missing ${label}: ${needle}`);
}

includes(doc, "Templates Phase 11 - Read-Only Admin Exposure", "Phase 11 title");
includes(doc, fixture.route, "admin route doc");
includes(doc, fixture.apiRoute, "api route doc");
includes(page, "buildTemplateLayoutCompositionAdminReadinessPayload", "page payload builder use");
includes(page, "layout-composition-batch-validator-fixtures.json", "page fixture source");
includes(api, "buildTemplateLayoutCompositionAdminReadinessPayload", "api payload builder use");
includes(api, "layout-composition-batch-validator-fixtures.json", "api fixture source");
includes(api, "NextResponse.json", "api json response");

for (const method of fixture.requiredApiMethods) {
  includes(api, `export async function ${method}`, `api ${method} method`);
}

for (const text of fixture.requiredText) {
  includes(doc, text, `doc guardrail ${text}`);
}

if (/writeFile|unlink|rmSync/.test(api + page)) {
  fail("page/API appears to contain filesystem mutation behavior");
}

if (/generateDocument|finalize|uploadDocument|createDocument/.test(api + page)) {
  fail("page/API appears to call document generation, finalization, or upload behavior");
}

pass("Templates Phase 11 read-only admin exposure checks passed");
