#!/usr/bin/env node
import fs from 'node:fs';

const failures = [];
const scriptPath = 'scripts/backup-local-indexes-monitored.mjs';
const script = fs.readFileSync(scriptPath, 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

for (const required of [
  'scripts/backup-local-indexes.mjs',
  'backup-alert-state.json',
  'backup-failed',
  'backup-stale',
  'shouldSuppressAlert',
  'sendGraphMail',
  'https://graph.microsoft.com/v1.0/users/',
  '/sendMail',
  'BARSH_BACKUP_ALERT_TO',
  'BARSH_BACKUP_ALERT_STALE_MINUTES',
  'parseAlertRecipients',
  'alertRecipients',
  '.split(/[;,]/)',
  'new Set(recipients)',
  'toRecipients: alert.recipients.map',
  'ALERT_RECIPIENT_COUNT',
  '--dry-run',
  '--status-only',
  '--send-test-alert',
  '--simulate-failure',
  '--simulate-stale',
  'DEFAULT_ALERT_TO',
  'dbarshay15@gmail.com',
]) {
  if (!script.includes(required)) {
    failures.push(`${scriptPath}: missing monitored backup alert fragment: ${required}`);
  }
}

for (const banned of [
  'clioFetch',
  '@/lib/clio',
  'restore-local-indexes-sqlite-guarded.mjs',
  'restore-local-indexes-postgres-guarded.mjs',
  'unlinkSync',
  'rmSync',
  'rmdirSync',
  'documents/print-queue',
  'generate-preview',
  'finalize-preview',
  'working-docx',
  'create-draft',
  'maildrop',
]) {
  if (script.includes(banned)) {
    failures.push(`${scriptPath}: banned operational/destructive dependency found: ${banned}`);
  }
}

if (pkg.scripts?.['backup:indexes:monitored'] !== 'node scripts/backup-local-indexes-monitored.mjs') {
  failures.push('package.json: missing backup:indexes:monitored script');
}

if (pkg.scripts?.['verify:monitored-backup-email-alert-safety'] !== 'node scripts/verify-monitored-backup-email-alert-safety.mjs') {
  failures.push('package.json: missing verify:monitored-backup-email-alert-safety script');
}

console.log('RESULT: monitored backup email alert safety verifier');

if (failures.length) {
  console.log(`FAILURES=${failures.length}`);
  for (const failure of failures) console.log(`FAIL=${failure}`);
  process.exit(1);
}

console.log('FAILURES=0');
console.log('PASS: Monitored backup wrapper supports multiple alert recipients without restore/delete/Clio/document/print behavior.');
