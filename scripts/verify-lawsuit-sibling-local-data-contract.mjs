#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd();

const requiredFiles = [
  'CLAIMINDEX_CLEANUP_PLAN.txt',
  'CLAIMINDEX_LOCAL_SOURCE_CONTRACT.txt',
  'app/api/lawsuits/local-generation-preview/route.ts',
  'app/api/lawsuits/local-generation-create/route.ts',
  'app/api/claim-index/search-grouped/route.ts',
];

const failures = [];

for (const rel of requiredFiles) {
  if (!fs.existsSync(path.join(repo, rel))) {
    failures.push(`missing required file: ${rel}`);
  }
}

const cleanupPlan = fs.existsSync('CLAIMINDEX_CLEANUP_PLAN.txt')
  ? fs.readFileSync('CLAIMINDEX_CLEANUP_PLAN.txt', 'utf8')
  : '';

for (const phrase of [
  'the lawsuit must preserve links to the child/direct matters',
  'resolve sibling/child details from local Barsh Matters data',
  'Search must be local-only',
  'Search must not fallback to Clio',
]) {
  if (!cleanupPlan.includes(phrase)) {
    failures.push(`CLAIMINDEX_CLEANUP_PLAN.txt missing phrase: ${phrase}`);
  }
}

const searchRoute = fs.existsSync('app/api/claim-index/search-grouped/route.ts')
  ? fs.readFileSync('app/api/claim-index/search-grouped/route.ts', 'utf8')
  : '';

for (const marker of ['noClioRead', 'noClioWrite', 'noClioHydration']) {
  if (!searchRoute.includes(marker)) {
    failures.push(`search-grouped route missing marker: ${marker}`);
  }
}

const localRoutes = [
  'app/api/lawsuits/local-generation-preview/route.ts',
  'app/api/lawsuits/local-generation-create/route.ts',
];

for (const rel of localRoutes) {
  if (!fs.existsSync(rel)) continue;

  const text = fs.readFileSync(rel, 'utf8');

  if (/\/api\/clio\/matter-context|custom_field_values|customFieldValues|fetchMatterFromClio|getMatterFromClio|Clio API source of truth/i.test(text)) {
    failures.push(`${rel}: local lawsuit generation route contains forbidden Clio operational/hydration language`);
  }

  if (!/ClaimIndex|claimIndex|matter|matters|matterId|matterIds|selected/i.test(text)) {
    failures.push(`${rel}: route does not appear to reference local matter/ClaimIndex selection data`);
  }
}

console.log('RESULT: verify lawsuit sibling local-data contract');
console.log(`FAILURES=${failures.length}`);
for (const failure of failures) console.log(`FAIL=${failure}`);

if (failures.length) process.exit(1);
