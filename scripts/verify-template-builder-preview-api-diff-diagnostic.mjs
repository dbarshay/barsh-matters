import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const buildPage = fs.readFileSync('app/admin/document-templates/build/page.tsx', 'utf8');
const failures = [];
const pass = (message) => console.log('\\x1b[32mPASS\\x1b[0m:', message);
const fail = (message) => { console.error('\\x1b[31mFAIL\\x1b[0m:', message); failures.push(message); };

if (buildPage.includes('exampleOutputMatter === exampleMatter')) pass('Client is guarded against stale identical-looking payload ownership');
else fail('Client is guarded against stale identical-looking payload ownership');
if (pkg.scripts?.['verify:template-builder-preview-api-diff-diagnostic']) pass('Package has preview API diff diagnostic script');
else fail('Package has preview API diff diagnostic script');

if (failures.length > 0) { console.error('\\n' + failures.length + ' preview API diagnostic checks failed.'); process.exit(1); }
console.log('\\nPASS: Preview API differentiation remains a runtime diagnostic, while client stale-state protection is verified.');
