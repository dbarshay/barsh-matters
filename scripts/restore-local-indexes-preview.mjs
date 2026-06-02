#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd();
const backupRoot = path.join(repo, 'backups/indexes');
const arg = process.argv[2];

let backupDir = arg;

if (!backupDir) {
  const latest = path.join(backupRoot, 'LATEST_BACKUP.txt');

  if (!fs.existsSync(latest)) {
    console.error('FAIL: no backup directory argument supplied and no LATEST_BACKUP.txt exists');
    process.exit(1);
  }

  backupDir = fs.readFileSync(latest, 'utf8').trim();
}

if (!path.isAbsolute(backupDir)) {
  backupDir = path.resolve(repo, backupDir);
}

const manifestPath = path.join(backupDir, 'manifest.json');

if (!fs.existsSync(manifestPath)) {
  console.error(`FAIL: manifest not found: ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const counts = manifest.database?.postgresArchiveCounts || {};

console.log('RESULT: restore preview only');
console.log(`BACKUP_DIR=${backupDir}`);
console.log(`CREATED_AT=${manifest.createdAt || ''}`);
console.log(`GIT_HEAD=${manifest.gitHead || ''}`);
console.log(`HOSTNAME=${manifest.hostname || ''}`);
console.log(`PLATFORM=${manifest.platform || ''}`);
console.log(`DATABASE_KIND=${manifest.database?.kind || manifest.database?.urlKind || ''}`);
console.log(`DB_URL_SOURCE=${manifest.database?.safeConnectionInfo?.source || ''}`);
console.log(`EXPORTS_ALL_POSTGRES_TABLES_INDEXES_SCHEMA_OBJECTS=${manifest.databasePolicy?.exportsAllPostgresTablesIndexesAndSchemaObjects ? 'YES' : 'NO'}`);
console.log(`FUTURE_PRISMA_MODELS_INCLUDED=${manifest.databasePolicy?.futurePrismaModelsIncludedAutomatically ? 'YES' : 'NO'}`);
console.log(`FUTURE_DATABASE_INDEXES_INCLUDED=${manifest.databasePolicy?.futureDatabaseIndexesIncludedAutomatically ? 'YES' : 'NO'}`);
console.log(`USES_PRISMA_CLIENT=${manifest.databasePolicy?.usesPrismaClient ? 'YES' : 'NO'}`);
console.log(`USES_PG_DUMP=${manifest.databasePolicy?.usesPgDump ? 'YES' : 'NO'}`);
console.log(`POSTGRES_LARGE_OBJECTS_EXCLUDED=${manifest.databasePolicy?.excludesPostgresLargeObjects ? 'YES' : 'NO'}`);
console.log(`BACKS_UP_ACTUAL_DOCUMENT_FOLDERS=${manifest.documentFilePolicy?.backsUpActualDocumentFolders ? 'YES' : 'NO'}`);
console.log(`PULLS_DOCUMENTS_FROM_CLIO=${manifest.documentFilePolicy?.pullsDocumentsFromClio ? 'YES' : 'NO'}`);
console.log(`DOCUMENT_VAULT=${manifest.documentFilePolicy?.documentVault || ''}`);
console.log(`PG_DUMP_FILE=${manifest.database?.postgresDumpFile || ''}`);
console.log(`PG_SCHEMA_FILE=${manifest.database?.postgresSchemaFile || ''}`);
console.log(`PG_ARCHIVE_LIST_FILE=${manifest.database?.postgresArchiveListFile || ''}`);
console.log(`PG_ARCHIVE_ENTRIES=${counts.archiveEntries ?? ''}`);
console.log(`PG_TABLES=${counts.tables ?? ''}`);
console.log(`PG_TABLE_DATA=${counts.tableData ?? ''}`);
console.log(`PG_INDEXES=${counts.indexes ?? ''}`);
console.log(`PG_CONSTRAINTS=${counts.constraints ?? ''}`);
console.log(`PG_SEQUENCES=${counts.sequences ?? ''}`);

const archiveList = manifest.database?.postgresArchiveListFile || path.join(backupDir, 'archive-list.txt');

if (archiveList && fs.existsSync(archiveList)) {
  console.log('');
  console.log('ARCHIVE_LIST_HEAD:');
  const lines = fs.readFileSync(archiveList, 'utf8').split(/\r?\n/);

  for (const line of lines.slice(0, 180)) {
    console.log(line);
  }
}

console.log('');
console.log('RESTORE_POLICY=preview-only');
console.log('NOTE=This script intentionally does not write to the database.');
