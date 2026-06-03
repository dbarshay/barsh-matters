#!/usr/bin/env node
import fs from 'node:fs';

const failures = [];
const pagePath = 'app/admin/backup-restore/page.tsx';
const page = fs.readFileSync(pagePath, 'utf8');
const statusRoute = fs.readFileSync('app/api/admin/backups/status/route.ts', 'utf8');
const runRoute = fs.readFileSync('app/api/admin/backups/run/route.ts', 'utf8');
const previewRoute = fs.readFileSync('app/api/admin/backups/restore-preview/route.ts', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

for (const required of [
  'data-guarded-restore-plan-preview="true"',
  'data-restore-execution-enabled="false"',
  'data-restore-execution-button="disabled"',
  'Restore Execution Disabled',
  'Guarded Restore Plan Preview',
  'Pre-Restore Checklist',
  'Restore execution is intentionally unavailable in the UI.',
  'A restore must be separately approved and run through a guarded terminal workflow.',
  'does not call any guarded restore script',
  'Make a fresh backup immediately before any future restore.',
  'Confirm the working tree is clean before any future restore.',
  'Confirm the target database before any future restore.',
  'Use full PostgreSQL database restore only unless a separate selective-restore workflow is built.',
  'document files are not restored by this database/index backup',
  'restorePlanRows',
  'restorePlanChecklist',
]) {
  if (!page.includes(required)) {
    failures.push(`${pagePath}: missing required guarded restore-plan fragment: ${required}`);
  }
}

const routeTexts = [
  ['status route', statusRoute],
  ['run route', runRoute],
  ['restore preview route', previewRoute],
];

for (const [label, text] of routeTexts) {
  for (const banned of [
    'restore-local-indexes-sqlite-guarded.mjs',
    'restore-local-indexes-postgres-guarded.mjs',
  ]) {
    if (text.includes(banned)) {
      failures.push(`${label}: UI/API route must not call guarded restore script: ${banned}`);
    }
  }
}

for (const banned of [
  'restore-local-indexes-sqlite-guarded.mjs',
  'restore-local-indexes-postgres-guarded.mjs',
  'fetch("/api/admin/backups/restore"',
  'fetch(`/api/admin/backups/restore',
  'runRestoreExecution',
  'executeRestore',
]) {
  if (page.includes(banned)) {
    failures.push(`${pagePath}: banned restore execution reference found: ${banned}`);
  }
}

if (!page.includes('onClick={() => void runRestorePreview()}')) {
  failures.push(`${pagePath}: restore preview button must remain available`);
}

if (!previewRoute.includes('restore-local-indexes-preview.mjs')) {
  failures.push('restore-preview route: must continue using preview script only');
}

if (!statusRoute.includes('restoreExecutionEnabled: false')) {
  failures.push('status route: must continue reporting restoreExecutionEnabled false');
}

if (pkg.scripts?.['verify:admin-guarded-restore-plan-preview-safety'] !== 'node scripts/verify-admin-guarded-restore-plan-preview-safety.mjs') {
  failures.push('package.json: missing verify:admin-guarded-restore-plan-preview-safety script');
}

console.log('RESULT: admin guarded restore-plan preview safety verifier');

if (failures.length) {
  console.log(`FAILURES=${failures.length}`);
  for (const failure of failures) console.log(`FAIL=${failure}`);
  process.exit(1);
}

console.log('FAILURES=0');
console.log('PASS: Guarded Restore Plan is planning-only; no restore execution is callable from UI/API.');
