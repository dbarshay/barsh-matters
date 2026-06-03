#!/usr/bin/env node
import fs from 'node:fs';

const failures = [];
const pagePath = 'app/admin/backup-restore/page.tsx';
const page = fs.readFileSync(pagePath, 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

for (const required of [
  'data-backup-comparison-preview="read-only"',
  'data-backup-comparison-url-state="true"',
  'Compare Backups',
  'Read-only comparison preview for two backup manifests.',
  'This comparison does not restore data, delete backups, run retention cleanup, call Clio, send email, generate documents, or change the print queue.',
  'Baseline backup',
  'Comparison backup',
  'function baselineBackupNameFromUrl',
  'function comparisonBackupNameFromUrl',
  'function adminBackupRestoreUrlForState',
  'function buildBackupCompareRows',
  'function backupCompareWarnings',
  'barshMattersAdminBackupComparison',
  'Git head differs between selected backups.',
  'Table count differs between selected backups.',
  'Index count differs between selected backups.',
  'Database kind differs between selected backups.',
  'Password stored in manifest',
]) {
  if (!page.includes(required)) {
    failures.push(`${pagePath}: missing comparison preview fragment: ${required}`);
  }
}

for (const banned of [
  'restore-local-indexes-sqlite-guarded.mjs',
  'restore-local-indexes-postgres-guarded.mjs',
  'unlinkSync',
  'rmSync',
  'rmdirSync',
  'create-draft',
  'maildrop',
  'finalize-preview',
  'generate-preview',
  'working-docx',
  'documents/print-queue',
  'runRetentionCleanup',
  'deleteBackup',
  'executeRestore',
  'runRestoreExecution',
]) {
  if (page.includes(banned)) {
    failures.push(`${pagePath}: banned destructive/operational reference found: ${banned}`);
  }
}

if (pkg.scripts?.['verify:admin-backup-comparison-preview-safety'] !== 'node scripts/verify-admin-backup-comparison-preview-safety.mjs') {
  failures.push('package.json: missing verify:admin-backup-comparison-preview-safety script');
}

console.log('RESULT: admin backup comparison preview safety verifier');

if (failures.length) {
  console.log(`FAILURES=${failures.length}`);
  for (const failure of failures) console.log(`FAIL=${failure}`);
  process.exit(1);
}

console.log('FAILURES=0');
console.log('PASS: Backup comparison preview is read-only with URL-backed state and no restore/delete/Clio/email/document/print behavior.');
