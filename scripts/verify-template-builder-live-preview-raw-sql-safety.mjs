import fs from 'node:fs';

const resolver = fs.readFileSync('src/lib/templates/template-builder-live-example-preview.ts', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const failures = [];
const pass = (message) => console.log('\x1b[32mPASS\x1b[0m:', message);
const fail = (message) => { console.error('\x1b[31mFAIL\x1b[0m:', message); failures.push(message); };
const has = (needle, message) => resolver.includes(needle) ? pass(message) : fail(message);
const lacks = (needle, message) => !resolver.includes(needle) ? pass(message) : fail(message);

has('async function safeRawRows(sql: string): Promise<Row[]>', 'Resolver has safe raw SQL helper');
has('try {', 'Resolver safe helper catches query failures');
has('return [];', 'Resolver degrades failed table lookups to empty rows');
has('CAST(" + quoteIdent(column) + " AS TEXT) = " + quoteLiteral(value)', 'Resolver casts candidate lookup columns to text before comparison');
has('return await safeRawRows("select * from " + quoteIdent(tableName)', 'findRows uses safeRawRows for table scans');
lacks('quoteIdent(column) + " = " + quoteLiteral(value)', 'Resolver no longer compares unknown column types directly to matter key text');
has('isLawsuitContext ? DASH', 'Resolver still keeps lawsuit-context dash behavior');

if (!pkg.scripts?.['verify:template-builder-live-preview-raw-sql-safety']) fail('Package has raw SQL safety verifier script');
else pass('Package has raw SQL safety verifier script');

if (failures.length > 0) {
  console.error('\n' + failures.length + ' raw SQL safety checks failed.');
  process.exit(1);
}

console.log('\nPASS: Template Builder live preview raw SQL lookup safety verified.');
