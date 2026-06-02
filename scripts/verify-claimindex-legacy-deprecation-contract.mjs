#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd();

const failures = [];

const required = [
  'CLAIMINDEX_LEGACY_DEPRECATION_CONTRACT.txt',
  'CLAIMINDEX_LOCAL_SOURCE_CONTRACT.txt',
  'CLAIMINDEX_CLEANUP_PLAN.txt',
];

for (const rel of required) {
  if (!fs.existsSync(path.join(repo, rel))) {
    failures.push(`missing required contract/plan file: ${rel}`);
  }
}

const contract = fs.existsSync('CLAIMINDEX_LEGACY_DEPRECATION_CONTRACT.txt')
  ? fs.readFileSync('CLAIMINDEX_LEGACY_DEPRECATION_CONTRACT.txt', 'utf8')
  : '';

for (const phrase of [
  'ClaimIndexRebuildState is legacy',
  'ClaimClusterCache is legacy',
  'app/api/claim-index/rebuild is a quarantined legacy Clio operational route',
  'app/api/advanced-search/hydrate is a quarantined legacy Clio hydration route',
  'Do not delete database schema in this pass',
  'must not query Clio',
  'must not write, update, delete, rebuild, hydrate, or backfill',
  'Treating ClaimClusterCache as source of truth',
  '/api/claim-index/local-index-status is the preferred read-only status route',
  '/api/claim-index/rebuild-status may remain only as a deprecated compatibility shim',
]) {
  if (!contract.includes(phrase)) {
    failures.push(`contract missing phrase: ${phrase}`);
  }
}

const blockedRoutes = [
  'app/api/claim-index/rebuild/route.ts',
  'app/api/advanced-search/hydrate/route.ts',
];

for (const rel of blockedRoutes) {
  const full = path.join(repo, rel);

  if (!fs.existsSync(full)) {
    failures.push(`missing quarantined legacy route: ${rel}`);
    continue;
  }

  const text = fs.readFileSync(full, 'utf8');

  if (!text.includes('legacyClioOperationalRouteBlocked')) {
    failures.push(`${rel}: must remain blocked with legacyClioOperationalRouteBlocked`);
  }

  if (/clioFetch|fetchMatterFromClio|getMatterFromClio|custom_field_values|customFieldValues|ingestMatterFromClio|ingestMattersFromClioBatch/u.test(text)) {
    failures.push(`${rel}: blocked route must not contain active Clio operational/hydration code`);
  }
}

const legacyStatusRoutePath = 'app/api/claim-index/rebuild-status/route.ts';
const localStatusRoutePath = 'app/api/claim-index/local-index-status/route.ts';

const forbiddenWritePatterns = [
  { label: 'POST/PATCH/DELETE method', re: /export\s+async\s+function\s+(POST|PATCH|PUT|DELETE)\b/u },
  { label: 'Prisma create/update/upsert/delete/write operation', re: /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/u },
  { label: 'Clio fetch/helper', re: /clioFetch|fetchMatterFromClio|getMatterFromClio|ingestMatterFromClio|ingestMattersFromClioBatch/u },
  { label: 'Clio custom fields', re: /custom_field_values|customFieldValues/u },
  { label: 'legacy matter-context', re: /\/api\/clio\/matter-context|matter-context/u },
];

if (fs.existsSync(legacyStatusRoutePath)) {
  const text = fs.readFileSync(legacyStatusRoutePath, 'utf8');

  if (!text.includes('Deprecated compatibility shim')) {
    failures.push(`${legacyStatusRoutePath}: expected deprecated compatibility shim text`);
  }

  if (!text.includes('getLocalIndexStatus')) {
    failures.push(`${legacyStatusRoutePath}: expected shim delegation to local-index-status route`);
  }

  if (!/export\s+async\s+function\s+GET\b/u.test(text)) {
    failures.push(`${legacyStatusRoutePath}: expected read-only GET handler`);
  }

  if (/claimIndexRebuildState\.findMany|claimIndexRebuildState\.count|claimIndex\.findMany|claimIndex\.count/u.test(text)) {
    failures.push(`${legacyStatusRoutePath}: compatibility shim must not directly inspect local status tables`);
  }

  for (const rule of forbiddenWritePatterns) {
    if (rule.re.test(text)) {
      failures.push(`${legacyStatusRoutePath}: ${rule.label} is forbidden in deprecated compatibility shim`);
    }
  }
} else {
  failures.push(`missing deprecated compatibility shim: ${legacyStatusRoutePath}`);
}

if (fs.existsSync(localStatusRoutePath)) {
  const text = fs.readFileSync(localStatusRoutePath, 'utf8');

  if (!/export\s+async\s+function\s+GET\b/u.test(text)) {
    failures.push(`${localStatusRoutePath}: expected read-only GET handler`);
  }

  if (!/claimIndex\.findMany|claimIndex\.count|claimIndexRebuildState\.findMany|claimIndexRebuildState\.count/u.test(text)) {
    failures.push(`${localStatusRoutePath}: expected local database status inspection`);
  }

  for (const rule of forbiddenWritePatterns) {
    if (rule.re.test(text)) {
      failures.push(`${localStatusRoutePath}: ${rule.label} is forbidden in read-only local index status route`);
    }
  }
} else {
  failures.push(`missing preferred local index status route: ${localStatusRoutePath}`);
}

const schema = fs.existsSync('prisma/schema.prisma')
  ? fs.readFileSync('prisma/schema.prisma', 'utf8')
  : '';

for (const modelName of ['ClaimIndexRebuildState', 'ClaimClusterCache']) {
  if (!schema.includes(`model ${modelName}`)) {
    failures.push(`schema model missing unexpectedly in non-destructive pass: ${modelName}`);
  }
}

console.log('RESULT: verify ClaimIndex legacy deprecation contract');
console.log('REBUILD_STATUS_COMPATIBILITY_SHIM_ALLOWED=YES');
console.log('LOCAL_INDEX_STATUS_ROUTE_REQUIRED=YES');
console.log(`FAILURES=${failures.length}`);
for (const failure of failures) console.log(`FAIL=${failure}`);

if (failures.length) process.exit(1);
