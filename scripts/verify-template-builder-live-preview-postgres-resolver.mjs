import fs from 'node:fs';

const resolver = fs.readFileSync('src/lib/templates/template-builder-live-example-preview.ts', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const failures = [];

const pass = (message) => console.log('\x1b[32mPASS\x1b[0m:', message);
const fail = (message) => { console.error('\x1b[31mFAIL\x1b[0m:', message); failures.push(message); };
const has = (needle, message) => resolver.includes(needle) ? pass(message) : fail(message);
const lacks = (needle, message) => !resolver.includes(needle) ? pass(message) : fail(message);
const hasRegex = (pattern, message) => pattern.test(resolver) ? pass(message) : fail(message);
const lacksRegex = (pattern, message) => !pattern.test(resolver) ? pass(message) : fail(message);

has('information_schema.columns', 'Resolver has PostgreSQL information_schema column discovery');
has('pragma table_info', 'Resolver still has SQLite PRAGMA fallback after PostgreSQL attempt');
has('quoteIdent', 'Resolver has identifier escaping helper');
has('quoteLiteral', 'Resolver has literal escaping helper');
has('async function safeRawRows(sql: string): Promise<Row[]>', 'Resolver has safe raw SQL helper');
has('return await rawRows(sql);', 'safeRawRows attempts raw query first');
has('return [];', 'safeRawRows degrades failed table lookups to empty rows');
has('CAST(" + quoteIdent(column) + " AS TEXT) = " + quoteLiteral(value)', 'Resolver casts unknown lookup columns to text');
has('return await safeRawRows("select * from " + quoteIdent(tableName) + " where " + where + " limit " + String(limit));', 'Resolver findRows executes built SQL safely without placeholder list');
lacks('quoteIdent(column) + " = " + quoteLiteral(value)', 'Resolver no longer compares unknown column types directly to matter key text');
lacksRegex(/\$queryRawUnsafe\s*<[^>]+>\s*\([^)]*\?/, 'Resolver does not use SQLite question-mark SQL placeholders in query calls');
lacksRegex(/where[^\n]+\?/, 'Resolver does not build SQL where clauses with question-mark placeholders');
hasRegex(/claimTables\s*=\s*tables\.filter\(\(table\)\s*=>\s*\/claimindex\|claim\|matter\/i\.test\(table\)\)/, 'Resolver still searches ClaimIndex/claim/matter tables');
hasRegex(/providerTables\s*=\s*tables\.filter\(\(table\)\s*=>\s*\/providerclientinfo\|provider\|client\/i\.test\(table\)\)/, 'Resolver still searches ProviderClientInfo/provider/client tables');
has('tableColumns(tableName)', 'Resolver uses schema-aware tableColumns helper');
has('findRows(tableName: string, value: string, candidateColumns: string[]', 'Resolver uses dynamic findRows helper');

if (!pkg.scripts?.['verify:template-builder-live-preview-postgres-resolver']) fail('Package has PostgreSQL resolver verifier');
else pass('Package has PostgreSQL resolver verifier');

if (failures.length > 0) {
  console.error('\n' + failures.length + ' PostgreSQL resolver checks failed.');
  process.exit(1);
}

console.log('\nPASS: Template Builder live preview PostgreSQL resolver verified for current safe schema-aware implementation.');
