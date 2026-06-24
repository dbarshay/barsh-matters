import fs from 'node:fs';

const build = fs.readFileSync('app/admin/document-templates/build/page.tsx', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const failures = [];
const pass = (message) => console.log('\\x1b[32mPASS\\x1b[0m:', message);
const fail = (message) => { console.error('\\x1b[31mFAIL\\x1b[0m:', message); failures.push(message); };
const has = (needle, message) => build.includes(needle) ? pass(message) : fail(message);
const lacks = (needle, message) => !build.includes(needle) ? pass(message) : fail(message);

has('useEffect', 'Build Template imports useEffect');
has('const [exampleOutputMap, setExampleOutputMap]', 'Build Template has live example output map state');
has('const [exampleOutputMatter, setExampleOutputMatter]', 'Build Template tracks output map matter ownership');
has('const [examplePreviewStatus, setExamplePreviewStatus]', 'Build Template has live preview status state');
has('/api/admin/document-templates/example-preview?matter=', 'Build Template fetches live preview API');
has('const requestedMatter = exampleMatter;', 'Build Template captures selected matter for each fetch');
has('encodeURIComponent(requestedMatter)', 'Build Template fetch uses captured selected matter');
has('payload.exampleOutputMap ?? payload.resolved ?? {}', 'Build Template reads resolved preview map from payload');
has('const nextMap = payload.exampleOutputMap ?? payload.resolved ?? {};', 'Build Template stores resolved preview map in nextMap');
has('setExampleOutputMap(nextMap);', 'Build Template stores resolved preview map');
has('setExampleOutputMatter(resolvedMatter);', 'Build Template records live output map ownership');
has('if (ignore || requestedMatter !== exampleMatter) return;', 'Build Template ignores stale fetch responses after preview matter changes');
has('exampleOutputMatter === exampleMatter', 'Build Template renders live example output only for current matter');
has('exampleOutputFor(field)', 'Build Template table uses exampleOutputFor');
lacks('field.exampleOutput}</span>', 'Build Template no longer renders static field.exampleOutput directly');
lacks('const staticExample', 'Build Template no longer embeds static example fixture');
if (!pkg.scripts?.['verify:template-builder-live-example-preview-client']) fail('Package has live client verifier script');
else pass('Package has live client verifier script');
if (failures.length > 0) { console.error('\\n' + failures.length + ' live example preview client checks failed.'); process.exit(1); }
console.log('\\nPASS: Template Builder live example preview client wiring verified for matter-owned output switching.');
