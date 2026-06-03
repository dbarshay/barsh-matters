#!/usr/bin/env node
import fs from 'node:fs';

const failures = [];
const pagePath = 'app/admin/backup-restore/page.tsx';
const statusRoutePath = 'app/api/admin/backups/status/route.ts';
const page = fs.readFileSync(pagePath, 'utf8');
const statusRoute = fs.readFileSync(statusRoutePath, 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

for (const required of [
  'backupAlertState',
  'read-only-backup-alert-state',
  'backup-alert-state.json',
  'duplicateSuppressionActive',
  'sendEmail: false',
  'restoreExecution: false',
  'backupDeletion: false',
  'retentionCleanup: false',
  'clioWrite: false',
  'documentGeneration: false',
  'printQueueMutation: false',
]) {
  if (!statusRoute.includes(required)) {
    failures.push(`${statusRoutePath}: missing backup alert state route fragment: ${required}`);
  }
}

for (const required of [
  'data-backup-alert-state="read-only"',
  'data-send-alert-enabled="false"',
  'data-alert-state-file-write-enabled="false"',
  'Backup Alert State',
  'Read-only alert state from the monitored backup wrapper.',
  'This panel shows the last alert and duplicate-suppression state only.',
  'It does not send email, edit alert state, restore data, delete backups, run retention cleanup, call Clio, generate documents, or change the print queue.',
  'Duplicate suppression active',
  'Send controls',
  'DISABLED',
  'Recipients:',
  'Duplicate suppression uses the stored alert key',
]) {
  if (!page.includes(required)) {
    failures.push(`${pagePath}: missing backup alert state UI fragment: ${required}`);
  }
}

for (const [file, text] of [
  [pagePath, page],
  [statusRoutePath, statusRoute],
]) {
  for (const banned of [
    'sendGraphMail',
    'sendMail',
    'writeJson',
    'writeFileSync',
    'unlinkSync',
    'rmSync',
    'rmdirSync',
    'restore-local-indexes-sqlite-guarded.mjs',
    'restore-local-indexes-postgres-guarded.mjs',
    'clioFetch',
    '@/lib/clio',
    'documents/print-queue',
    'finalize-preview',
    'generate-preview',
    'working-docx',
  ]) {
    if (text.includes(banned)) {
      failures.push(`${file}: banned destructive/operational reference found: ${banned}`);
    }
  }
}

if (pkg.scripts?.['verify:admin-backup-alert-state-safety'] !== 'node scripts/verify-admin-backup-alert-state-safety.mjs') {
  failures.push('package.json: missing verify:admin-backup-alert-state-safety script');
}

console.log('RESULT: admin backup alert state safety verifier');

if (failures.length) {
  console.log(`FAILURES=${failures.length}`);
  for (const failure of failures) console.log(`FAIL=${failure}`);
  process.exit(1);
}

console.log('FAILURES=0');
console.log('PASS: Backup alert state panel is read-only and has no send/edit/restore/delete/Clio/document/print behavior.');
