#!/usr/bin/env node
import fs from 'node:fs';

const failures = [];
const pagePath = 'app/admin/backup-restore/page.tsx';
const routePath = 'app/api/admin/backups/archive-error-log/route.ts';
const page = fs.readFileSync(pagePath, 'utf8');
const route = fs.readFileSync(routePath, 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

for (const required of [
  'data-stderr-log-archive-action="guarded"',
  'data-stdout-log-archive-enabled="false"',
  'data-backup-deletion-enabled="false"',
  'data-archive-error-log-button="guarded"',
  'ARCHIVE ERROR LOG',
  'archiveErrorLogConfirm !== "ARCHIVE ERROR LOG"',
  'fetch("/api/admin/backups/archive-error-log"',
  'launchd.err.log only',
  'does not touch stdout, backups, manifests, database dumps, restore workflows, alert state, Clio, email, documents, or the print queue',
]) {
  if (!page.includes(required)) {
    failures.push(`${pagePath}: missing guarded archive UI fragment: ${required}`);
  }
}

for (const required of [
  'REQUIRED_CONFIRMATION = "ARCHIVE ERROR LOG"',
  'mode: "guarded-stderr-log-archive"',
  'const stderrLogPath = path.join(logRoot, "launchd.err.log")',
  'launchd.err.log.archived-',
  'fs.renameSync(stderrLogPath, archivePath)',
  'fs.writeFileSync(stderrLogPath, "")',
  'onlyLaunchdErrLog: true',
  'touchedStdoutLog: false',
  'touchedBackups: false',
  'touchedManifests: false',
  'touchedDatabaseDumps: false',
  'restoreExecution: false',
  'backupDeletion: false',
  'retentionCleanup: false',
  'alertStateMutation: false',
  'clioWrite: false',
  'email: false',
  'documentGeneration: false',
  'printQueueMutation: false',
]) {
  if (!route.includes(required)) {
    failures.push(`${routePath}: missing guarded archive route fragment: ${required}`);
  }
}

for (const banned of [
  'launchd.out.log',
  'LATEST_BACKUP',
  'database.dump',
  'schema.sql',
  'archive-list.txt',
  'backup-alert-state.json',
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
  if (route.includes(banned)) {
    failures.push(`${routePath}: banned non-stderr/destructive/operational reference found: ${banned}`);
  }
}

if (pkg.scripts?.['verify:admin-backup-log-archive-action-safety'] !== 'node scripts/verify-admin-backup-log-archive-action-safety.mjs') {
  failures.push('package.json: missing verify:admin-backup-log-archive-action-safety script');
}

console.log('RESULT: admin backup log archive action safety verifier');

if (failures.length) {
  console.log(`FAILURES=${failures.length}`);
  for (const failure of failures) console.log(`FAIL=${failure}`);
  process.exit(1);
}

console.log('FAILURES=0');
console.log('PASS: Guarded log archive action only archives launchd.err.log with exact confirmation and no restore/delete/Clio/email/document/print behavior.');
