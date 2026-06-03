#!/usr/bin/env node
import fs from 'node:fs';

const requiredFiles = [
  'app/admin/backup-restore/page.tsx',
  'app/api/admin/backups/status/route.ts',
  'app/api/admin/backups/run/route.ts',
  'app/api/admin/backups/restore-preview/route.ts',
  'scripts/verify-admin-backup-restore-preview-safety.mjs',
];

const failures = [];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) failures.push(`${file}: missing`);
}

const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');

const page = read('app/admin/backup-restore/page.tsx');
const adminHome = read('app/admin/page.tsx');
const statusRoute = read('app/api/admin/backups/status/route.ts');
const runRoute = read('app/api/admin/backups/run/route.ts');
const previewRoute = read('app/api/admin/backups/restore-preview/route.ts');
const pkg = JSON.parse(read('package.json') || '{}');

if (!adminHome.includes('href: "/admin/backup-restore"')) {
  failures.push('app/admin/page.tsx: missing Backup / Restore admin card');
}

if (!page.includes('data-barsh-admin-backup-restore="true"')) {
  failures.push('backup restore page: missing marker');
}

if (!page.includes('data-restore-execution-enabled="false"')) {
  failures.push('backup restore page: missing restore execution disabled marker');
}

for (const phrase of [
  'Restore execution is intentionally disabled',
  'Preview-only restore safety',
  'does not execute restores',
  'does not write to the database',
]) {
  if (!page.includes(phrase)) {
    failures.push(`backup restore page: missing safety phrase "${phrase}"`);
  }
}

if (!statusRoute.includes('restoreExecutionEnabled: false')) {
  failures.push('status route: missing restoreExecutionEnabled false');
}

if (!previewRoute.includes('restore-local-indexes-preview.mjs')) {
  failures.push('restore preview route: must call restore-local-indexes-preview.mjs');
}

if (previewRoute.includes('restore-local-indexes-sqlite-guarded.mjs')) {
  failures.push('restore preview route: must not call sqlite guarded restore');
}

if (previewRoute.includes('restore-local-indexes-postgres-guarded.mjs')) {
  failures.push('restore preview route: must not call postgres guarded restore');
}

if (!runRoute.includes('backup-local-indexes.mjs')) {
  failures.push('manual backup route: must call backup-local-indexes.mjs');
}

const bannedPatterns = [
  [/from\s+["'][^"']*clio/i, 'imports Clio module'],
  [/require\(["'][^"']*clio/i, 'requires Clio module'],
  [/CLIO_/i, 'references CLIO env/config'],
  [/graph/i, 'references Graph/email plumbing'],
  [/create-draft/i, 'references email draft route'],
  [/sendGraphMail|sendMail\s*\(|send_email\s*\(|maildrop/i, 'references email/maildrop action'],
  [/finalize-preview|finalize\/route|generate-preview|working-docx|preview-pdf/i, 'references document generation/finalization'],
  [/print-queue(?!Mutation: false)/i, 'references print queue action'],
  [/settlements\/documents-print-queue/i, 'references settlement print queue'],
];

for (const [file, text] of [
  ['app/admin/backup-restore/page.tsx', page],
  ['app/api/admin/backups/status/route.ts', statusRoute],
  ['app/api/admin/backups/run/route.ts', runRoute],
  ['app/api/admin/backups/restore-preview/route.ts', previewRoute],
]) {
  for (const [pattern, label] of bannedPatterns) {
    const sanitized = text
      .replace(/print queue/gi, 'print_queue_copy')
      .replace(/printQueueMutation: false/g, 'print_queue_mutation_false');
    if (pattern.test(sanitized)) {
      failures.push(`${file}: banned dependency/action detected: ${label}`);
    }
  }
}

if (pkg.scripts?.['verify:admin-backup-restore-preview-safety'] !== 'node scripts/verify-admin-backup-restore-preview-safety.mjs') {
  failures.push('package.json: missing verify:admin-backup-restore-preview-safety script');
}

console.log('RESULT: admin backup/restore preview safety verifier');
console.log(`FILES_SCANNED=${requiredFiles.length + 1}`);

if (failures.length) {
  console.log(`FAILURES=${failures.length}`);
  for (const failure of failures) console.log(`FAIL=${failure}`);
  process.exit(1);
}

console.log('FAILURES=0');
console.log('PASS: Admin Backup / Restore is backup + status + restore-preview only.');
