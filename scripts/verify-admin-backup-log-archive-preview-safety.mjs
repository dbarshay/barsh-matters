#!/usr/bin/env node
import fs from 'node:fs';

const failures = [];
const pagePath = 'app/admin/backup-restore/page.tsx';
const statusRoutePath = 'app/api/admin/backups/status/route.ts';
const page = fs.readFileSync(pagePath, 'utf8');
const statusRoute = fs.readFileSync(statusRoutePath, 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

for (const required of [
  'backupLogArchivePreview',
  'read-only-backup-log-archive-preview',
  'archiveExecutionEnabled: false',
  'filePreviewStats',
  'proposedArchiveDisplayPath',
  'containsOldErrors',
  'lastMonitoredSuccessLine',
  'lastErrorLine',
  'archiveExecution: false',
  'truncateLog: false',
  'moveLog: false',
  'deleteLog: false',
  'restoreExecution: false',
  'backupDeletion: false',
  'retentionCleanup: false',
  'sendAlert: false',
  'clioWrite: false',
  'documentGeneration: false',
  'printQueueMutation: false',
]) {
  if (!statusRoute.includes(required)) {
    failures.push(`${statusRoutePath}: missing log archive preview route fragment: ${required}`);
  }
}

for (const required of [
  'data-backup-log-archive-preview="read-only"',
  'data-log-archive-execution-enabled="false"',
  'data-log-truncate-enabled="false"',
  'data-log-delete-enabled="false"',
  'Backup Log Archive Preview',
  'Read-only preview for cleaning up old scheduled-backup log noise.',
  'It does not archive, truncate, move, delete, restore data, send alerts, call Clio, generate documents, or change the print queue.',
  'Preview only.',
  'Old errors present',
  'Proposed archive',
  'Guarded action: archive <strong>launchd.err.log only</strong>.',
  'data-stderr-log-archive-action="guarded"',
  'data-stdout-log-archive-enabled="false"',
  'data-backup-deletion-enabled="false"',
  'function formatBytes',
]) {
  if (!page.includes(required)) {
    failures.push(`${pagePath}: missing log archive preview UI fragment: ${required}`);
  }
}

for (const [file, text] of [
  [pagePath, page],
  [statusRoutePath, statusRoute],
]) {
  for (const banned of [
    'renameSync',
    'truncateSync',
    'unlinkSync',
    'rmSync',
    'rmdirSync',
    'createWriteStream',
    'writeFileSync(',
    'restore-local-indexes-sqlite-guarded.mjs',
    'restore-local-indexes-postgres-guarded.mjs',
    'sendGraphMail',
    'sendMail(',
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

if (pkg.scripts?.['verify:admin-backup-log-archive-preview-safety'] !== 'node scripts/verify-admin-backup-log-archive-preview-safety.mjs') {
  failures.push('package.json: missing verify:admin-backup-log-archive-preview-safety script');
}

console.log('RESULT: admin backup log archive preview safety verifier');

if (failures.length) {
  console.log(`FAILURES=${failures.length}`);
  for (const failure of failures) console.log(`FAIL=${failure}`);
  process.exit(1);
}

console.log('FAILURES=0');
console.log('PASS: Backup log archive preview is read-only and has no archive/truncate/delete/restore/send/Clio/document/print behavior.');
