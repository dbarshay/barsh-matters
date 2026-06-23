import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const registryModulePath = path.join(root, 'src/lib/templates/template-layout-composition-registry-source.mjs');
const fixturePath = path.join(root, 'test/fixtures/templates/templates-phase14-template-file-readiness-inventory-fixtures.json');
const registryModule = await import(pathToFileURL(registryModulePath).href + `?phase14=${Date.now()}`);
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function templateList(registry) {
  if (Array.isArray(registry.templates)) return registry.templates;
  if (Array.isArray(registry.templateRecords)) return registry.templateRecords;
  if (registry.templatesById && typeof registry.templatesById === 'object') return Object.values(registry.templatesById);
  return [];
}

function pickRegistry(mod) {
  const candidates = [mod.default, ...Object.values(mod)].filter(Boolean);
  const registries = candidates.filter((candidate) => candidate && typeof candidate === 'object' && templateList(candidate).length);
  return registries[0] || null;
}

function templateId(template) {
  return template.id || template.templateId || template.key || template.slug;
}

function assertNoUnsafeExecutableReferences() {
  const executableFiles = [
    'src/lib/templates/template-layout-composition-registry-source.mjs',
    'scripts/verify-templates-phase14-template-file-readiness-inventory.mjs',
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

const registry = pickRegistry(registryModule);
if (registry == null) fail('registry source export was not found');
const templates = registry ? templateList(registry) : [];
const approvedPrefixes = fixture.approvedTemplatePathPrefixes;
const expectedPaths = fixture.expectedTemplatePaths;
const expectedMissing = fixture.expectedMissingTemplatePaths;

if (templates.length === 0) fail('registry has no templates');

const registryPaths = [];
for (const template of templates) {
  const id = templateId(template);
  if (id == null) { fail('template record is missing id/templateId/key/slug'); continue; }
  const templateFile = template.templateFile;
  if (templateFile == null || typeof templateFile !== 'object') { fail(`${id} missing templateFile object`); continue; }
  if (templateFile.kind !== 'docx') fail(`${id} templateFile.kind must be docx`);
  if (typeof templateFile.path !== 'string' || templateFile.path.length === 0) fail(`${id} templateFile.path must be a non-empty string`);
  if (typeof templateFile.required !== 'boolean') fail(`${id} templateFile.required must be boolean`);
  if (path.isAbsolute(templateFile.path)) fail(`${id} templateFile.path must be relative`);
  if (approvedPrefixes.some((prefix) => templateFile.path.startsWith(prefix)) === false) fail(`${id} templateFile.path is outside approved roots: ${templateFile.path}`);
  registryPaths.push(templateFile.path);
}

const sortedRegistryPaths = [...registryPaths].sort();
const sortedExpectedPaths = [...expectedPaths].sort();
if (JSON.stringify(sortedRegistryPaths) !== JSON.stringify(sortedExpectedPaths)) {
  fail(`registry template paths do not match Phase 14 fixture. registry=${JSON.stringify(sortedRegistryPaths)} fixture=${JSON.stringify(sortedExpectedPaths)}`);
}

const missingPaths = registryPaths.filter((templatePath) => fs.existsSync(path.join(root, templatePath)) === false).sort();
const existingPaths = registryPaths.filter((templatePath) => fs.existsSync(path.join(root, templatePath))).sort();
const sortedExpectedMissing = [...expectedMissing].sort();
if (fixture.requirePhysicalDocxFiles === true && missingPaths.length > 0) {
  fail(`physical DOCX files are required but missing: ${JSON.stringify(missingPaths)}`);
}
if (fixture.requirePhysicalDocxFiles === false && JSON.stringify(missingPaths) !== JSON.stringify(sortedExpectedMissing)) {
  fail(`missing DOCX readiness inventory changed. missing=${JSON.stringify(missingPaths)} expected=${JSON.stringify(sortedExpectedMissing)}`);
}

assertNoUnsafeExecutableReferences();

if (process.exitCode) process.exit(process.exitCode);
console.log(`PASS: Templates Phase 14 readiness inventory verified; existing=${existingPaths.length}; missing=${missingPaths.length}`);
