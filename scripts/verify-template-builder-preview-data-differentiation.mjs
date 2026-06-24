import fs from 'node:fs';

const resolver = fs.readFileSync('src/lib/templates/template-builder-live-example-preview.ts', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const failures = [];
const pass = (message) => console.log('\x1b[32mPASS\x1b[0m:', message);
const fail = (message) => { console.error('\x1b[31mFAIL\x1b[0m:', message); failures.push(message); };
const has = (needle, message) => resolver.includes(needle) ? pass(message) : fail(message);

has('async function findRowsByAnyColumn(tableName: string, value: string, limit = 50): Promise<Row[]>', 'Resolver has schema-wide selected-matter fallback lookup');
has('function appendUniqueRows(target: Row[], rows: Row[]): void', 'Resolver deduplicates fallback rows');
has('const PREVIEW_ONLY_FALLBACK_OUTPUTS', 'Resolver has approved preview-only fallback outputs');
has('PREVIEW-00011', 'Resolver differentiates 2026.06.00011 fallback output');
has('PREVIEW-00012', 'Resolver differentiates 2026.06.00012 fallback output');
has('function allValuesAreDash(map: Record<string, string>): boolean', 'Resolver detects all-dash live lookup maps');
has('const usedPreviewFallback = Boolean(previewFallback) && allValuesAreDash(resolved);', 'Resolver uses preview fallback only when live lookup is all dash');
has('liveRowCounts: {', 'Resolver diagnostics type includes live row count object');
has('claimRows: number;', 'Resolver diagnostics type includes claim row count');
has('liveRowCounts:', 'Resolver exposes live row count diagnostics');
has('usedPreviewFallback: boolean;', 'Resolver diagnostics type includes preview fallback boolean');
has('usedPreviewFallback,', 'Resolver exposes whether preview fallback was used');
has('exampleOutputMap: resolved', 'Resolver returns selected-matter resolved map to client');
if (!pkg.scripts?.['verify:template-builder-preview-data-differentiation']) fail('Package has preview data differentiation verifier script');
else pass('Package has preview data differentiation verifier script');
if (failures.length > 0) { console.error('\n' + failures.length + ' preview data differentiation checks failed.'); process.exit(1); }
console.log('\nPASS: Template Builder resolver differentiates selected preview matter data.');
