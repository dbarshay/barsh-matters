#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const schemaPath = path.join(repo, "prisma", "schema.prisma");
const backupRoot = path.join(repo, "backups", "indexes");
const latestPath = path.join(backupRoot, "LATEST_BACKUP.txt");

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

if (!fs.existsSync(schemaPath)) {
  fail(`Prisma schema not found: ${schemaPath}`);
  process.exit(process.exitCode || 1);
}

if (!fs.existsSync(latestPath)) {
  fail(`Latest backup pointer not found: ${latestPath}`);
  process.exit(process.exitCode || 1);
}

const latestBackupDir = fs.readFileSync(latestPath, "utf8").trim();
const manifestPath = path.join(latestBackupDir, "manifest.json");
const archiveListPath = path.join(latestBackupDir, "archive-list.txt");
const dumpPath = path.join(latestBackupDir, "database.dump");
const schemaSqlPath = path.join(latestBackupDir, "schema.sql");

console.log("RESULT: Admin backup Prisma model archive coverage verifier");
console.log(`LATEST_BACKUP_DIR=${latestBackupDir}`);

for (const requiredPath of [manifestPath, archiveListPath, dumpPath, schemaSqlPath]) {
  if (!fs.existsSync(requiredPath)) {
    fail(`Required latest backup file missing: ${requiredPath}`);
  } else {
    pass(`Required latest backup file exists: ${path.basename(requiredPath)}`);
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

const schema = fs.readFileSync(schemaPath, "utf8");
const manifest = readJson(manifestPath);
const archiveList = fs.readFileSync(archiveListPath, "utf8");

const models = [...schema.matchAll(/^model\s+(\w+)\s+\{([\s\S]*?)^\}/gm)].map((match) => {
  const model = match[1];
  const body = match[2];
  const mapMatch = body.match(/@@map\("([^"]+)"\)/);
  return {
    model,
    table: mapMatch ? mapMatch[1] : model,
  };
});

if (!models.length) {
  fail("No Prisma models were found.");
} else {
  pass(`Found ${models.length} Prisma models in schema.prisma.`);
}

const requiredDatabasePolicy = {
  usesPgDump: true,
  usesPgRestoreForPreviewAndGuardedRestore: true,
  exportsAllPostgresTablesIndexesAndSchemaObjects: true,
  futurePrismaModelsIncludedAutomatically: true,
  futureDatabaseIndexesIncludedAutomatically: true,
  usesPrismaClient: false,
};

for (const [key, expected] of Object.entries(requiredDatabasePolicy)) {
  const actual = manifest.databasePolicy?.[key];
  if (actual !== expected) {
    fail(`Manifest databasePolicy.${key} expected ${expected} but found ${actual}`);
  } else {
    pass(`Manifest databasePolicy.${key}=${expected}`);
  }
}

const requiredDocumentFilePolicy = {
  backsUpActualDocumentFolders: false,
  pullsDocumentsFromClio: false,
  documentVault: "Clio",
  localDocumentMetadataRowsMayBeIncluded: true,
};

for (const [key, expected] of Object.entries(requiredDocumentFilePolicy)) {
  const actual = manifest.documentFilePolicy?.[key];
  if (actual !== expected) {
    fail(`Manifest documentFilePolicy.${key} expected ${JSON.stringify(expected)} but found ${JSON.stringify(actual)}`);
  } else {
    pass(`Manifest documentFilePolicy.${key}=${JSON.stringify(expected)}`);
  }
}

const counts = manifest.database?.postgresArchiveCounts || {};
if (!Number.isFinite(Number(counts.tableData)) || Number(counts.tableData) < models.length) {
  fail(`Manifest tableData count ${counts.tableData} is less than Prisma model count ${models.length}.`);
} else {
  pass(`Manifest tableData count ${counts.tableData} is compatible with Prisma model count ${models.length}.`);
}

for (const { model, table } of models) {
  const tableDataPattern = new RegExp(`\\bTABLE DATA\\b[^\\n]*\\bpublic\\s+${escapeRegExp(table)}\\b`);
  const tableSchemaPattern = new RegExp(`\\bTABLE\\b(?! DATA)[^\\n]*\\bpublic\\s+${escapeRegExp(table)}\\b`);

  const hasTableData = tableDataPattern.test(archiveList);
  const hasTableSchema = tableSchemaPattern.test(archiveList) || hasTableData;

  if (!hasTableSchema) {
    fail(`Prisma model ${model} table ${table} is missing TABLE schema entry from latest archive-list.txt.`);
  } else {
    pass(`Prisma model ${model} table ${table} has schema/archive coverage.`);
  }

  if (!hasTableData) {
    fail(`Prisma model ${model} table ${table} is missing TABLE DATA entry from latest archive-list.txt.`);
  } else {
    pass(`Prisma model ${model} table ${table} has TABLE DATA coverage.`);
  }
}

if (process.exitCode) {
  console.error("FAIL: Admin backup Prisma model archive coverage verifier failed.");
  process.exit(process.exitCode);
}

console.log("PASS: Admin backup includes every current Prisma model table in latest archive-list table data.");
console.log("PASS: Admin backup manifest keeps document-vault exclusion explicit.");
