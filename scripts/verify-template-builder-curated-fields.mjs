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
const requiredTokens = [
  '{{provider.taxId}}', '{{treatingProvider.name}}', '{{insurer.name}}', '{{insurer.hidden_street}}', '{{insurer.hidden_city}}', '{{insurer.hidden_state}}', '{{insurer.hidden_zipcode}}',
  '{{claim.number}}', '{{claim.dateOfLoss}}', '{{claim.dateOfService}}', '{{claim.amount}}', '{{claim.denialReason}}',
  '{{lawsuit.indexNumber}}', '{{lawsuit.court}}', '{{lawsuit.adversaryAttorney}}', '{{lawsuit.dateFiled}}', '{{lawsuit.amount}}', '{{lawsuit.balance}}',
  '{{cost.indexFee}}', '{{cost.serviceFee}}', '{{cost.otherCourtCosts}}',
];
const blockedTokens = [
  '{{adminUser.passwordHash}}', '{{adminUser.twoFactorPhone}}', '{{adminUserPermissionOverride.permissionKey}}', '{{documentTemplate.storagePath}}', '{{adminRolePermission.permissionKey}}',
  '{{provider.name}}', '{{patient.name}}', '{{patient.firstName}}', '{{patient.lastName}}', '{{patient.dateOfBirth}}',
  '{{matter.id}}', '{{matter.displayNumber}}', '{{matter.type}}', '{{matter.caseType}}', '{{matter.finalStatus}}', '{{matter.closedReason}}', '{{matter.dateOfService}}',
  '{{provider.hidden_street}}', '{{provider.hidden_city}}', '{{provider.hidden_state}}', '{{provider.hidden_zipcode}}', '{{claim.dosStart}}', '{{claim.dosEnd}}',
];
for (const token of requiredTokens) !tokens.includes(token) ? fail(`Curated library includes ${token}`) : pass(`Curated library includes ${token}`);
for (const token of blockedTokens) tokens.includes(token) ? fail(`Curated library excludes blocked token ${token}`) : pass(`Curated library excludes blocked token ${token}`);
if (tokens.length < requiredTokens.length || tokens.length > 60) fail('Curated field count is controlled, not schema-wide');
else pass('Curated field count is controlled, not schema-wide');
const duplicateTokens = tokens.filter((token, index, all) => all.indexOf(token) !== index);
if (duplicateTokens.length > 0) fail(`Merge-field library merge fields are unique: ${duplicateTokens.join(', ')}`);
else pass('Merge-field library merge fields are unique');
if (buildPage.includes('field.typeDescription') || buildPage.includes('field.kindDescription')) fail('Build Template no longer shows field kind/type descriptions');
else pass('Build Template no longer shows field kind/type descriptions');
if (!packageJson.scripts?.['verify:template-builder-curated-fields']) fail('Package has curated-field verifier script');
else pass('Package has curated-field verifier script');
console.log(`MERGE_FIELD_COUNT=${tokens.length}`);
if (failures.length > 0) { console.error(`\n${failures.length} Template Builder curated-field checks failed.`); process.exit(1); }
console.log('\nPASS: Template Builder curated field verifier aligned with current approved field set.');
