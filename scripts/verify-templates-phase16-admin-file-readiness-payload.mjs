import fs from "node:fs";
import path from "node:path";
import { templateLayoutCompositionRegistrySource } from "../src/lib/templates/template-layout-composition-registry-source.mjs";
import { buildTemplateLayoutCompositionAdminReadinessPayload } from "../src/lib/templates/layout-composition-admin-readiness.mjs";

const root = process.cwd();

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

const sourcePath = "src/lib/templates/layout-composition-admin-readiness.mjs";
const source = fs.readFileSync(path.join(root, sourcePath), "utf8");

if (source.includes("template-file-readiness-report.mjs") === false) {
  fail("admin readiness builder does not import template file readiness report builder");
}

if (source.includes("templateFileReadiness") === false) {
  fail("admin readiness payload does not expose templateFileReadiness");
}

let payload = null;
try {
  payload = buildTemplateLayoutCompositionAdminReadinessPayload(templateLayoutCompositionRegistrySource);
} catch (error) {
  fail(`admin readiness payload builder threw: ${error.message}`);
}

const readiness = payload ? payload.templateFileReadiness : null;
if (readiness == null) fail("templateFileReadiness payload is missing");

if (readiness) {
  if (readiness.templateCount !== 4) fail(`expected templateCount=4, found ${readiness.templateCount}`);
  if (readiness.availableCount !== 0) fail(`expected availableCount=0, found ${readiness.availableCount}`);
  if (readiness.missingCount !== 4) fail(`expected missingCount=4, found ${readiness.missingCount}`);
  if (readiness.requiredMissingCount !== 4) fail(`expected requiredMissingCount=4, found ${readiness.requiredMissingCount}`);
  if (readiness.generationReady !== false) fail("expected generationReady=false while required DOCX files are absent");
  if (Array.isArray(readiness.requiredMissingPaths) === false) fail("requiredMissingPaths must be an array");
  if (readiness.requiredMissingPaths.length !== 4) fail(`expected four requiredMissingPaths, found ${readiness.requiredMissingPaths.length}`);
}

function assertNoUnsafeExecutableReferences() {
  const executableFiles = [
    sourcePath,
    "scripts/verify-templates-phase16-admin-file-readiness-payload.mjs",
    "scripts/verify-templates-layout-composition-validation-suite.mjs",
  ];
  const unsafeTokens = [
    ["generate", "Document"],
    ["upload", "Document"],
    ["document", "Upload"],
    ["finalize", "Document"],
    ["api/documents/", "finalize"],
    ["external", "Document", "Storage"],
  ].map((parts) => parts.join(""));
  for (const file of executableFiles) {
    const body = fs.readFileSync(path.join(root, file), "utf8");
    for (const token of unsafeTokens) {
      if (body.includes(token)) fail(`${file} contains prohibited executable token: ${token}`);
    }
  }
}

assertNoUnsafeExecutableReferences();

if (process.exitCode) process.exit(process.exitCode);
console.log("PASS: Templates Phase 16 admin file-readiness payload verified");
