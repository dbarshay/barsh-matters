#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const failures = [];

const newRoutePath = 'app/api/claim-index/local-index-status/route.ts';
const legacyRoutePath = 'app/api/claim-index/rebuild-status/route.ts';

for (const rel of [newRoutePath, legacyRoutePath]) {
  if (!fs.existsSync(rel)) {
    failures.push(`missing route: ${rel}`);
  }
}

const read = (rel) => fs.existsSync(rel) ? fs.readFileSync(rel, 'utf8') : '';

const newRoute = read(newRoutePath);
const legacyRoute = read(legacyRoutePath);

if (!newRoute.includes('Local index status route')) {
  failures.push(`${newRoutePath}: missing local index status route header`);
}

if (!newRoute.includes('export async function GET')) {
  failures.push(`${newRoutePath}: expected read-only GET handler`);
}

if (!legacyRoute.includes('Deprecated compatibility shim')) {
  failures.push(`${legacyRoutePath}: missing deprecated compatibility shim header`);
}

if (!legacyRoute.includes('getLocalIndexStatus')) {
  failures.push(`${legacyRoutePath}: should delegate to local-index-status route`);
}

if (/claimIndexRebuildState\.findMany|claimIndexRebuildState\.count/.test(legacyRoute)) {
  failures.push(`${legacyRoutePath}: legacy shim must not directly read ClaimIndexRebuildState`);
}

const forbiddenInBoth = [
  { label: 'write method', re: /export\s+async\s+function\s+(POST|PATCH|PUT|DELETE)\b/u },
  { label: 'write operation', re: /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/u },
  { label: 'Clio fetch/helper', re: /clioFetch|fetchMatterFromClio|getMatterFromClio|ingestMatterFromClio|ingestMattersFromClioBatch/u },
  { label: 'Clio custom fields', re: /custom_field_values|customFieldValues/u },
  { label: 'legacy matter context', re: /\/api\/clio\/matter-context|matter-context/u },
];

for (const [rel, text] of [[newRoutePath, newRoute], [legacyRoutePath, legacyRoute]]) {
  for (const rule of forbiddenInBoth) {
    if (rule.re.test(text)) {
      failures.push(`${rel}: ${rule.label} forbidden in local index status route`);
    }
  }
}

const appFiles = [];
const walk = (dir) => {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      if (['node_modules', '.next', '.git', 'backups'].includes(path.basename(full))) continue;
      walk(full);
      continue;
    }

    if (/\.(ts|tsx|js|mjs)$/.test(full)) appFiles.push(full);
  }
};

walk('app');
walk('lib');

for (const full of appFiles) {
  const rel = full;
  const text = fs.readFileSync(full, 'utf8');
  const lines = text.split(/\r?\n/);

  lines.forEach((line, idx) => {
    if (line.includes('/api/claim-index/rebuild-status') || line.includes('claim-index/rebuild-status')) {
      failures.push(`${rel}:${idx + 1}: app/lib code should call local-index-status, not rebuild-status: ${line.trim()}`);
    }
  });
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!pkg.scripts?.['verify:local-index-status-route-safety']) {
  failures.push('package.json missing verify:local-index-status-route-safety');
}

console.log('RESULT: verify local-index-status route safety');
console.log(`FAILURES=${failures.length}`);
for (const failure of failures) console.log(`FAIL=${failure}`);

if (failures.length) process.exit(1);
