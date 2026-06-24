import fs from 'node:fs';

const libraryPath = 'src/lib/templates/template-builder-merge-field-library.ts';
const packagePath = 'package.json';
const source = fs.readFileSync(libraryPath, 'utf8');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const failures = [];
const pass = (message) => console.log('\x1b[32mPASS\x1b[0m:', message);
const fail = (message) => { console.error('\x1b[31mFAIL\x1b[0m:', message); failures.push(message); };
const tokens = [...new Set([...source.matchAll(/\{\{[^}]+\}\}/g)].map((match) => match[0]))].sort();
const hiddenTokens = tokens.filter((token) => token.includes('hidden_'));
const labels = [...source.matchAll(/fieldLabel:\s*['"`]([^'"`]+)['"`]/g)].map((match) => match[1]);
const hiddenLabels = labels.filter((label) => /\bHidden\b/i.test(label));
const removedProviderHiddenTokens = ['{{provider.hidden_street}}', '{{provider.hidden_city}}', '{{provider.hidden_state}}', '{{provider.hidden_zipcode}}'];
if (hiddenLabels.length > 0) fail(`Field labels must not contain Hidden: ${hiddenLabels.join(', ')}`);
else pass('No field labels contain Hidden');
for (const token of removedProviderHiddenTokens) {
  if (tokens.includes(token)) fail(`Removed provider hidden token is still present ${token}`);
  else pass(`Removed provider hidden token absent ${token}`);
}
for (const token of hiddenTokens) pass(`Remaining hidden source token preserved with clean label ${token}`);
if (!packageJson.scripts?.['verify:template-builder-remove-hidden-labels']) fail('Package has hidden-label verifier script');
else pass('Package has hidden-label verifier script');
if (failures.length > 0) { console.error(`\n${failures.length} Template Builder hidden-label checks failed.`); process.exit(1); }
console.log('\nPASS: Template Builder hidden-label verifier aligned with current approved field set.');
