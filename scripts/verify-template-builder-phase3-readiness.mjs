import fs from 'node:fs';

const libraryPath = 'src/lib/templates/template-builder-merge-field-library.ts';
const buildPagePath = 'app/admin/document-templates/build/page.tsx';
const docPath = 'docs/templates/template-builder-phase3-readiness.md';
const packagePath = 'package.json';

const library = fs.readFileSync(libraryPath, 'utf8');
const buildPage = fs.readFileSync(buildPagePath, 'utf8');
const doc = fs.existsSync(docPath) ? fs.readFileSync(docPath, 'utf8') : '';
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const failures = [];

const pass = (message) => console.log('\x1b[32mPASS\x1b[0m:', message);
const fail = (message) => { console.error('\x1b[31mFAIL\x1b[0m:', message); failures.push(message); };
const has = (source, needle, message) => source.includes(needle) ? pass(message) : fail(message);
const lacks = (source, needle, message) => !source.includes(needle) ? pass(message) : fail(message);

for (const needle of [
  'TemplateBuilderMergeFieldKind',
  'TemplateBuilderFieldType',
  'TemplateBuilderFormatModifier',
  'TEMPLATE_BUILDER_STARTING_CATEGORIES',
  'TEMPLATE_BUILDER_SUPPORTED_FORMAT_MODIFIERS',
  'TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS',
  'TEMPLATE_BUILDER_CUSTOM_PLACEHOLDER_FIELDS',
  'templateBuilderTokenForCustomLabel',
  'templateBuilderIsCustomToken',
  'templateBuilderCustomTokenConflicts',
  'templateBuilderMoveDeletedCategoryFieldsToGeneral',
]) has(library, needle, 'Merge-field library contains ' + needle);

for (const needle of ['bold', 'italic', 'underline', 'upper', 'lower', 'title', 'date:MM/DD/YYYY', 'date:Month D, YYYY', 'currency']) {
  has(library, needle, 'Merge-field library contains modifier/support ' + needle);
}

for (const removed of [
  '{{patient.lastName}}',
  '{{provider.hidden_street}}',
  '{{provider.hidden_city}}',
  '{{provider.hidden_state}}',
  '{{provider.hidden_zipcode}}',
  '{{matter.dateOfService}}',
  '{{claim.dosStart}}',
  '{{claim.dosEnd}}',
]) lacks(library, removed, 'Merge-field library excludes approved removed token ' + removed);

for (const retained of [
  '{{provider.taxId}}',
  '{{treatingProvider.name}}',
  '{{insurer.name}}',
  '{{insurer.hidden_street}}',
  '{{insurer.hidden_city}}',
  '{{insurer.hidden_state}}',
  '{{insurer.hidden_zipcode}}',
  '{{claim.number}}',
  '{{claim.dateOfLoss}}',
  '{{claim.dateOfService}}',
  '{{claim.amount}}',
  '{{claim.denialReason}}',
  '{{lawsuit.indexNumber}}',
  '{{lawsuit.court}}',
  '{{lawsuit.adversaryAttorney}}',
  '{{lawsuit.dateFiled}}',
  '{{lawsuit.amount}}',
  '{{lawsuit.balance}}',
  '{{cost.indexFee}}',
  '{{cost.serviceFee}}',
  '{{cost.otherCourtCosts}}',
]) has(library, retained, 'Merge-field library keeps approved token ' + retained);

for (const needle of [
  'TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS',
  'TEMPLATE_BUILDER_SUPPORTED_FORMAT_MODIFIERS',
  'Search merge fields',
  'Example matter',
  'Formats for copy',
  'toggleSort',
  'CopyIcon',
  'TrashIcon',
  'Delete Field',
]) has(buildPage, needle, 'Build page contains ' + needle);

for (const removedText of [
  'Phase 3 locks',
  'Category readiness',
  'Custom manual placeholder readiness',
  'Production DOCX upload, token mutation, and matter-side Generate Documents remain intentionally unwired',
]) lacks(buildPage, removedText, 'Build page no longer exposes removed readiness text ' + removedText);

if (doc) {
  has(doc, 'Template Builder Phase 3', 'Phase 3 doc contains Template Builder Phase 3');
  has(doc, 'does not implement production DOCX upload', 'Phase 3 doc documents no production DOCX upload');
}

if (!packageJson.scripts?.['verify:template-builder-phase3']) fail('Package has Phase 3 verifier script');
else pass('Package has Phase 3 verifier script');

if (failures.length > 0) {
  console.error('\n' + failures.length + ' Template Builder Phase 3 readiness checks failed.');
  process.exit(1);
}

console.log('\nPASS: Template Builder Phase 3 readiness verifier aligned with current approved field set.');
