#!/usr/bin/env node
import fs from 'node:fs';

const required = [
  'scripts/backup-local-indexes.mjs',
  'scripts/restore-local-indexes-preview.mjs',
  'scripts/restore-local-indexes-postgres-guarded.mjs',
  'scripts/restore-local-indexes-sqlite-guarded.mjs',
  'scripts/inventory-claim-index-schema.mjs',
  'scripts/verify-claim-index-local-source-contract.mjs',
  'scripts/windows-register-index-backup-task.ps1',
  'CLAIMINDEX_LOCAL_SOURCE_CONTRACT.txt',
  'backups/indexes/.gitkeep',
  'backups/indexes/backup-cloud-target.example.txt',
];

const failures = [];

for (const rel of required) {
  if (!fs.existsSync(rel)) {
    failures.push(`missing ${rel}`);
  }
}

const backupScript = fs.existsSync('scripts/backup-local-indexes.mjs')
  ? fs.readFileSync('scripts/backup-local-indexes.mjs', 'utf8')
  : '';

const restorePreviewScript = fs.existsSync('scripts/restore-local-indexes-preview.mjs')
  ? fs.readFileSync('scripts/restore-local-indexes-preview.mjs', 'utf8')
  : '';

const restorePostgresScript = fs.existsSync('scripts/restore-local-indexes-postgres-guarded.mjs')
  ? fs.readFileSync('scripts/restore-local-indexes-postgres-guarded.mjs', 'utf8')
  : '';

if (/@prisma\/client|new PrismaClient/u.test(backupScript)) {
  failures.push('backup script must not instantiate Prisma Client because this project uses Prisma client engine mode');
}

if (/from\s+['"][^'"]*clio|\/api\/clio|custom_field_values|matter-context/u.test(backupScript)) {
  failures.push('backup script appears to contain Clio operational dependency');
}

if (/deleteMany|createMany|upsert|updateMany|prisma\.\w+\.(?:create|update|delete)/u.test(restorePreviewScript)) {
  failures.push('restore preview script must remain preview-only and non-writing');
}

if (!restorePostgresScript.includes('CONFIRM_RESTORE=YES_RESTORE_LOCAL_POSTGRES_DATABASE')) {
  failures.push('guarded PostgreSQL restore missing confirmation phrase');
}

if (!backupScript.includes('EXPORTS_ALL_POSTGRES_TABLES_INDEXES_SCHEMA_OBJECTS=YES')) {
  failures.push('backup script missing all-PostgreSQL-table/index/schema backup guarantee');
}

if (!backupScript.includes('FUTURE_DATABASE_INDEXES_INCLUDED=YES')) {
  failures.push('backup script missing future database index guarantee');
}

if (!backupScript.includes('USES_PRISMA_CLIENT=NO')) {
  failures.push('backup script missing no-Prisma-client marker');
}

if (!backupScript.includes('USES_PG_DUMP=YES')) {
  failures.push('backup script missing pg_dump marker');
}

if (!backupScript.includes('POSTGRES_LARGE_OBJECTS_EXCLUDED=YES') || !backupScript.includes("'-B'")) {
  failures.push('backup script missing PostgreSQL large-object exclusion policy');
}

if (!backupScript.includes('BACKS_UP_ACTUAL_DOCUMENT_FOLDERS=NO')) {
  failures.push('backup script missing no-document-folder-backup policy');
}

if (!backupScript.includes('PULLS_DOCUMENTS_FROM_CLIO=NO')) {
  failures.push('backup script missing no-Clio-document-pull policy');
}

if (!backupScript.includes('documentVault:')) {
  failures.push('backup script missing document vault policy');
}

if (!backupScript.includes('recentAllBackupsHours')) {
  failures.push('backup script missing tiered 24-hour recent retention metadata');
}

if (!backupScript.includes('dailyBackupsDays')) {
  failures.push('backup script missing 30-day daily retention metadata');
}

if (!backupScript.includes('CLOUD_TARGET.txt') || !backupScript.includes('BARSH_INDEX_BACKUP_CLOUD_DIR')) {
  failures.push('backup script missing cloud mirror configuration support');
}

const gitignore = fs.existsSync('.gitignore') ? fs.readFileSync('.gitignore', 'utf8') : '';

if (!gitignore.includes('backups/indexes/*') || !gitignore.includes('!backups/indexes/.gitkeep')) {
  failures.push('.gitignore does not protect backup payloads correctly');
}

const contract = fs.existsSync('CLAIMINDEX_LOCAL_SOURCE_CONTRACT.txt')
  ? fs.readFileSync('CLAIMINDEX_LOCAL_SOURCE_CONTRACT.txt', 'utf8')
  : '';

for (const phrase of [
  'all current/future local PostgreSQL database tables/indexes',
  'does not copy actual document folders',
  'does not pull document files from Clio',
  'PostgreSQL backups use pg_dump/pg_restore',
  'Microsoft Graph email sync UI copy is allowed',
]) {
  if (!contract.includes(phrase)) {
    failures.push(`contract missing phrase: ${phrase}`);
  }
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const scripts = pkg.scripts || {};

for (const name of [
  'verify:claim-index-local-source-contract',
  'verify:index-backup-safety',
  'inventory:claim-index-schema',
  'backup:indexes',
  'restore:indexes-preview',
  'restore:indexes-postgres-guarded',
  'restore:indexes-sqlite-guarded',
]) {
  if (!scripts[name]) failures.push(`package.json missing script ${name}`);
}

console.log('RESULT: verify index backup safety');
console.log('DATABASE_BACKUP_MODE=postgresql-native-pg-dump');
console.log(`FAILURES=${failures.length}`);

for (const failure of failures) {
  console.log(`FAIL=${failure}`);
}

if (failures.length) process.exit(1);
