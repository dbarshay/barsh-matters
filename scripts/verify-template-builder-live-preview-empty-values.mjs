import fs from 'node:fs';

const buildPage = fs.readFileSync('app/admin/document-templates/build/page.tsx', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const failures = [];

const pass = (message) => console.log('\x1b[32mPASS\x1b[0m:', message);
const fail = (message) => { console.error('\x1b[31mFAIL\x1b[0m:', message); failures.push(message); };
const has = (needle, message) => buildPage.includes(needle) ? pass(message) : fail(message);
const lacks = (needle, message) => !buildPage.includes(needle) ? pass(message) : fail(message);

has('Object.prototype.hasOwnProperty.call(exampleOutputMap, field.mergeField)', 'Build Template uses live map ownership check');
has('return exampleOutputMap[field.mergeField] || "—";', 'Build Template renders em dash for empty live preview values');
lacks('exampleOutputMap[field.mergeField] || field.exampleOutput', 'Build Template does not fall back from empty live value to static example');
has('exampleOutputMatter === exampleMatter', 'Build Template only uses live values owned by the selected matter');
has('return field.exampleOutput || "—";', 'Build Template uses static fallback only while no owned live payload is available');
has('setExampleOutputMap({});', 'Build Template clears stale live output on matter change');
has('setExampleOutputMatter(null);', 'Build Template clears live output ownership on matter change');
has('setExampleOutputMatter(resolvedMatter);', 'Build Template records ownership of loaded live payload');

if (!packageJson.scripts?.['verify:template-builder-live-preview-empty-values']) fail('Package has empty-value verifier script');
else pass('Package has empty-value verifier script');

if (failures.length > 0) {
  console.error('\n' + failures.length + ' Template Builder live preview empty-value checks failed.');
  process.exit(1);
}

console.log('\nPASS: Template Builder live preview empty-value behavior is aligned with matter-owned live output.');
