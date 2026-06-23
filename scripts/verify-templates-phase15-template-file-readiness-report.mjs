import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { templateLayoutCompositionRegistrySource } from '../src/lib/templates/template-layout-composition-registry-source.mjs';
import { buildTemplateFileReadinessReport, listTemplateRecords } from '../src/lib/templates/template-file-readiness-report.mjs';

const root = process.cwd();
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'test/fixtures/templates/templates-phase15-template-file-readiness-report-fixtures.json'), 'utf8'));

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label} mismatch. actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
  }
}

function assertNoUnsafeExecutableReferences() {
  const executableFiles = [
    'src/lib/templates/template-file-readiness-report.mjs',
    'scripts/verify-templates-phase15-template-file-readiness-report.mjs',
    'scripts/verify-templates-layout-composition-validation-suite.mjs',
  ];
  const unsafeTokens = [
    ['generate', 'Document'],
    ['upload', 'Document'],
    ['document', 'Upload'],
    ['finalize', 'Document'],
    ['api/documents/', 'finalize'],
    ['external', 'Document', 'Storage'],
  ].map((parts) => parts.join(''));
  for (const file of executableFiles) {
    const body = fs.readFileSync(path.join(root, file), 'utf8');
    for (const token of unsafeTokens) {
      if (body.includes(token)) fail(`${file} contains prohibited executable token: ${token}`);
    }
  }
}

const records = listTemplateRecords(templateLayoutCompositionRegistrySource);
if (records.length !== 4) fail(`expected 4 registry templates, found ${records.length}`);

const missingAll = buildTemplateFileReadinessReport(templateLayoutCompositionRegistrySource, {
  approvedTemplatePathPrefixes: fixture.approvedTemplatePathPrefixes,
  physicalFileExists: () => false,
  generatedAt: 'test-fixed-time',
});
assertEqual({
  templateCount: missingAll.templateCount,
  availableCount: missingAll.availableCount,
  missingCount: missingAll.missingCount,
  requiredMissingCount: missingAll.requiredMissingCount,
  unapprovedPathCount: missingAll.unapprovedPathCount,
  generationReady: missingAll.generationReady,
  missingPaths: missingAll.missingPaths,
}, fixture.missingAllExpected, 'missing-all report');

const availableAll = buildTemplateFileReadinessReport(templateLayoutCompositionRegistrySource, {
  approvedTemplatePathPrefixes: fixture.approvedTemplatePathPrefixes,
  physicalFileExists: () => true,
  generatedAt: 'test-fixed-time',
});
assertEqual({
  templateCount: availableAll.templateCount,
  availableCount: availableAll.availableCount,
  missingCount: availableAll.missingCount,
  requiredMissingCount: availableAll.requiredMissingCount,
  unapprovedPathCount: availableAll.unapprovedPathCount,
  generationReady: availableAll.generationReady,
  missingPaths: availableAll.missingPaths,
}, fixture.availableAllExpected, 'available-all report');

const actualFilesystem = buildTemplateFileReadinessReport(templateLayoutCompositionRegistrySource, {
  approvedTemplatePathPrefixes: fixture.approvedTemplatePathPrefixes,
  physicalFileExists: (templatePath) => fs.existsSync(path.join(root, templatePath)),
  generatedAt: 'test-fixed-time',
});
if (actualFilesystem.availableCount !== 0) fail(`expected no physical DOCX files yet, found availableCount=${actualFilesystem.availableCount}`);
if (actualFilesystem.missingCount !== 4) fail(`expected four missing physical DOCX files, found missingCount=${actualFilesystem.missingCount}`);

assertNoUnsafeExecutableReferences();

if (process.exitCode) process.exit(process.exitCode);
console.log('PASS: Templates Phase 15 template file readiness report builder verified');
