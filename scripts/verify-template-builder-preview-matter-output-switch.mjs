import fs from 'node:fs';

const buildPage = fs.readFileSync('app/admin/document-templates/build/page.tsx', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const failures = [];
const pass = (message) => console.log('\x1b[32mPASS\x1b[0m:', message);
const fail = (message) => { console.error('\x1b[31mFAIL\x1b[0m:', message); failures.push(message); };
const has = (needle, message) => buildPage.includes(needle) ? pass(message) : fail(message);
const lacks = (needle, message) => !buildPage.includes(needle) ? pass(message) : fail(message);

has('const [exampleOutputMatter, setExampleOutputMatter] = useState<string | null>(null);', 'Build Template tracks which matter produced the live output map');
has('const requestedMatter = exampleMatter;', 'Build Template captures requested matter for each fetch');
has('setExampleOutputMap({});', 'Build Template clears stale example output immediately on matter change');
has('setExampleOutputMatter(null);', 'Build Template clears live output ownership immediately on matter change');
has('setExamplePreviewStatus("Loading live preview for " + requestedMatter + "…");', 'Build Template uses the existing status setter for loading state');
has('if (ignore || requestedMatter !== exampleMatter) return;', 'Build Template blocks stale fetch responses from overwriting newer selections');
has('setExampleOutputMatter(resolvedMatter);', 'Build Template records the matter returned by the live preview API');
has('exampleOutputMatter === exampleMatter', 'Build Template only renders live output for the currently selected matter');
has('payload.exampleOutputMap ?? payload.resolved ?? {}', 'Build Template accepts live output map from either response field');
has('setExamplePreviewStatus("Live preview loaded for " + resolvedMatter);', 'Build Template status reflects the matter that owns the loaded output');
lacks('setLivePreviewStatus(', 'Build Template does not call undefined setLivePreviewStatus');
lacks('TemplateBuilderCanonicalMergeField', 'Build Template does not reference missing TemplateBuilderCanonicalMergeField type');
has('function exampleOutputFor(field: (typeof TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS)[number])', 'Build Template uses inferred canonical-field element type');
if (!pkg.scripts?.['verify:template-builder-preview-matter-output-switch']) fail('Package has preview matter output switch verifier script');
else pass('Package has preview matter output switch verifier script');
if (failures.length > 0) { console.error('\n' + failures.length + ' preview matter output switch checks failed.'); process.exit(1); }
console.log('\nPASS: Template Builder preview output is keyed to the selected example matter.');
