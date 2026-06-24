import fs from 'node:fs';

const libraryPath = 'src/lib/templates/template-builder-merge-field-library.ts';
const buildPagePath = 'app/admin/document-templates/build/page.tsx';
const packagePath = 'package.json';

const source = fs.readFileSync(libraryPath, 'utf8');
const buildPage = fs.readFileSync(buildPagePath, 'utf8');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const failures = [];

const pass = (message) => console.log('\x1b[32mPASS\x1b[0m:', message);
const fail = (message) => { console.error('\x1b[31mFAIL\x1b[0m:', message); failures.push(message); };

const tokens = [...new Set([...source.matchAll(/mergeField:\s*['"`]([^'"`]+)['"`]/g)].map((match) => match[1]))].sort();
const removedTokens = [
  "{{patient.dateOfBirth}}",
  "{{patient.hidden_street}}",
  "{{patient.hidden_city}}",
  "{{patient.hidden_state}}",
  "{{patient.hidden_zipcode}}",
  "{{treatingProvider.hidden_street}}",
  "{{treatingProvider.hidden_city}}",
  "{{treatingProvider.hidden_state}}",
  "{{treatingProvider.hidden_zipcode}}",
  "{{provider.name}}",
  "{{matter.id}}",
  "{{matter.displayNumber}}",
  "{{matter.closedReason}}",
  "{{patient.firstName}}",
  "{{patient.lastName}}",
  "{{patient.name}}",
  "{{matter.type}}",
  "{{matter.caseType}}",
  "{{matter.finalStatus}}",
  "{{provider.hidden_street}}",
  "{{provider.hidden_city}}",
  "{{provider.hidden_state}}",
  "{{provider.hidden_zipcode}}",
  "{{matter.dateOfService}}",
  "{{claim.dosStart}}",
  "{{claim.dosEnd}}",
  "{{treatingProvider.name}}",
  "{{claim.amount}}"
];
const keptTokens = [
  "{{provider.taxId}}",
  "{{insurer.name}}",
  "{{insurer.street}}",
  "{{insurer.city}}",
  "{{insurer.state}}",
  "{{insurer.zipcode}}",
  "{{claim.number}}",
  "{{claim.dateOfLoss}}",
  "{{claim.dateOfService}}",
  "{{claim.denialReason}}",
  "{{claim.balance}}",
  "{{claim.payments}}",
  "{{lawsuit.indexNumber}}",
    "{{court.name}}",
  "{{court.longName1}}",
  "{{court.longName2}}",
  "{{court.street}}",
  "{{court.city}}",
  "{{court.state}}",
  "{{court.zipcode}}",
  "{{lawsuit.adversaryAttorney}}",
  "{{adversaryAttorney.street}}",
  "{{adversaryAttorney.zipcode}}",
  "{{adversaryAttorney.state}}",
  "{{adversaryAttorney.city}}",
  "{{lawsuit.dateFiled}}",
  "{{lawsuit.amount}}",
  "{{lawsuit.costs}}",
  "{{lawsuit.balance}}",
  "{{cost.indexFee}}",
  "{{cost.serviceFee}}",
  "{{cost.otherCourtCosts}}",
  "{{cost.total}}"
];

for (const token of removedTokens) {
  if (tokens.includes(token)) fail(`Removed non-template-facing field ${token}`);
  else pass(`Removed non-template-facing field ${token}`);
}

for (const token of keptTokens) {
  if (!tokens.includes(token)) fail(`Kept approved available field ${token}`);
  else pass(`Kept approved available field ${token}`);
}

if (tokens.length < keptTokens.length || tokens.length > 60) fail('Curated field count remains controlled after removals');
else pass('Curated field count remains controlled after removals');

if (!buildPage.includes('TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS')) fail('Build Template still uses shared field library');
else pass('Build Template still uses shared field library');

if (!packageJson.scripts?.['verify:template-builder-remove-extra-fields']) fail('Package has extra-field removal verifier script');
else pass('Package has extra-field removal verifier script');

console.log(`MERGE_FIELD_COUNT=${tokens.length}`);

if (failures.length > 0) {
  console.error('\n' + failures.length + ' Template Builder extra-field removal checks failed.');
  process.exit(1);
}

console.log('\nPASS: Template Builder extra-field removal verifier aligned with current approved field set.');
