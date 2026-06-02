#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

const repo = process.cwd();
const backupRoot = path.join(repo, 'backups/indexes');
fs.mkdirSync(backupRoot, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(backupRoot, stamp);
fs.mkdirSync(backupDir, { recursive: true });

const RECENT_HOURS = Number(process.env.BARSH_INDEX_BACKUP_RECENT_HOURS || 24);
const DAILY_DAYS = Number(process.env.BARSH_INDEX_BACKUP_DAILY_DAYS || 30);

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};

  const out = {};
  const text = fs.readFileSync(filePath, 'utf8');

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    let value = match[2].trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    out[match[1]] = value;
  }

  return out;
};

const envLocal = parseEnvFile(path.join(repo, '.env.local'));
const env = parseEnvFile(path.join(repo, '.env'));

const getDatabaseUrl = () => {
  const candidates = [
    ['process.DIRECT_URL', process.env.DIRECT_URL],
    ['.env.local DIRECT_URL', envLocal.DIRECT_URL],
    ['.env DIRECT_URL', env.DIRECT_URL],
    ['process.DATABASE_URL', process.env.DATABASE_URL],
    ['.env.local DATABASE_URL', envLocal.DATABASE_URL],
    ['.env DATABASE_URL', env.DATABASE_URL],
  ];

  for (const [source, value] of candidates) {
    if (value && value.trim()) {
      return { source, value: value.trim() };
    }
  }

  return { source: '', value: '' };
};

const findExecutable = (name, envName) => {
  const candidates = [];

  if (process.env[envName]) candidates.push(process.env[envName]);

  if (process.platform === 'win32') {
    try {
      const found = execSync(`where ${name}`, { encoding: 'utf8' })
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      candidates.push(...found);
    } catch {
      // ignore
    }
  } else {
    try {
      const found = execSync(`command -v ${name}`, {
        encoding: 'utf8',
        shell: '/bin/zsh',
      }).trim();

      if (found) candidates.push(found);
    } catch {
      // ignore
    }
  }

  candidates.push(
    `/opt/homebrew/bin/${name}`,
    `/opt/homebrew/opt/libpq/bin/${name}`,
    `/opt/homebrew/opt/postgresql@17/bin/${name}`,
    `/opt/homebrew/opt/postgresql@16/bin/${name}`,
    `/opt/homebrew/opt/postgresql@15/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/usr/local/opt/libpq/bin/${name}`,
    `/usr/local/opt/postgresql@17/bin/${name}`,
    `/usr/local/opt/postgresql@16/bin/${name}`,
    `/usr/local/opt/postgresql@15/bin/${name}`,
    `/Applications/Postgres.app/Contents/Versions/latest/bin/${name}`
  );

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }

  throw new Error(`${name} not found. Install PostgreSQL command-line tools or set ${envName} to the full path.`);
};

const safeConnectionInfo = (rawUrl, source) => {
  try {
    const u = new URL(rawUrl);

    return {
      source,
      protocol: u.protocol.replace(':', ''),
      host: u.hostname || '',
      port: u.port || '',
      database: decodeURIComponent(u.pathname.replace(/^\//, '')),
      usernamePresent: Boolean(u.username),
      passwordStoredInManifest: false,
      schemaParam: u.searchParams.get('schema') || '',
    };
  } catch {
    return {
      source,
      protocol: rawUrl.split(':')[0] || 'unknown',
      host: '',
      port: '',
      database: '',
      usernamePresent: false,
      passwordStoredInManifest: false,
      schemaParam: '',
    };
  }
};

const normalizePostgresUrlForLibpq = (rawUrl) => {
  try {
    const u = new URL(rawUrl);
    const schema = u.searchParams.get('schema') || '';

    const allowedParams = new Set([
      'sslmode',
      'sslcert',
      'sslkey',
      'sslrootcert',
      'connect_timeout',
      'application_name',
      'keepalives',
      'keepalives_idle',
      'keepalives_interval',
      'keepalives_count',
      'target_session_attrs',
      'gssencmode',
      'channel_binding',
    ]);

    for (const key of [...u.searchParams.keys()]) {
      if (!allowedParams.has(key)) {
        u.searchParams.delete(key);
      }
    }

    return {
      url: u.toString(),
      schema,
      strippedPrismaParams: true,
    };
  } catch {
    return {
      url: rawUrl,
      schema: '',
      strippedPrismaParams: false,
    };
  }
};

const runTool = (bin, args, label) => {
  const result = spawnSync(bin, args, {
    encoding: 'utf8',
    env: process.env,
  });

  if (result.status !== 0) {
    console.error(`FAIL: ${label} failed`);
    console.error(`COMMAND=${bin} ${args.map((arg) => (arg.includes('://') ? '[DATABASE_URL_REDACTED]' : arg)).join(' ')}`);

    if (result.stdout) console.error(result.stdout);
    if (result.stderr) console.error(result.stderr);

    process.exit(result.status || 1);
  }

  return result.stdout || '';
};

const getCloudTarget = () => {
  if (process.env.BARSH_INDEX_BACKUP_CLOUD_DIR && process.env.BARSH_INDEX_BACKUP_CLOUD_DIR.trim()) {
    return process.env.BARSH_INDEX_BACKUP_CLOUD_DIR.trim();
  }

  const targetFile = path.join(backupRoot, 'CLOUD_TARGET.txt');
  if (fs.existsSync(targetFile)) {
    const target = fs.readFileSync(targetFile, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))[0];

    if (target) return target;
  }

  return '';
};

const safeCopyDir = (source, destination) => {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(source, destination, { recursive: true, force: true });
};

const parseBackupDirTime = (dirName, fullPath) => {
  const fromName = dirName.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3.$4Z');
  const parsed = new Date(fromName);

  if (!Number.isNaN(parsed.getTime())) return parsed;

  return new Date(fs.statSync(fullPath).mtimeMs);
};

const pruneTieredRetention = (root) => {
  if (!fs.existsSync(root)) {
    return {
      totalBefore: 0,
      retained: 0,
      pruned: 0,
      recentHours: RECENT_HOURS,
      dailyDays: DAILY_DAYS,
    };
  }

  const now = Date.now();
  const recentCutoff = now - RECENT_HOURS * 60 * 60 * 1000;
  const dailyCutoff = now - DAILY_DAYS * 24 * 60 * 60 * 1000;

  const dirs = fs.readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(d.name))
    .map((d) => {
      const full = path.join(root, d.name);
      const manifestPath = path.join(full, 'manifest.json');
      let createdAt = null;

      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          createdAt = manifest.createdAt ? new Date(manifest.createdAt) : null;
        } catch {
          createdAt = null;
        }
      }

      if (!createdAt || Number.isNaN(createdAt.getTime())) {
        createdAt = parseBackupDirTime(d.name, full);
      }

      return { name: d.name, full, createdAt, time: createdAt.getTime() };
    })
    .sort((a, b) => a.time - b.time);

  const keep = new Set();

  for (const dir of dirs) {
    if (dir.time >= recentCutoff) {
      keep.add(dir.full);
    }
  }

  const dailyRepresentatives = new Map();

  for (const dir of dirs) {
    if (dir.time < recentCutoff && dir.time >= dailyCutoff) {
      const day = dir.createdAt.toISOString().slice(0, 10);
      dailyRepresentatives.set(day, dir);
    }
  }

  for (const dir of dailyRepresentatives.values()) {
    keep.add(dir.full);
  }

  const toDelete = dirs.filter((dir) => !keep.has(dir.full));

  for (const dir of toDelete) {
    fs.rmSync(dir.full, { recursive: true, force: true });
  }

  return {
    totalBefore: dirs.length,
    retained: keep.size,
    pruned: toDelete.length,
    recentHours: RECENT_HOURS,
    dailyDays: DAILY_DAYS,
  };
};

const stringify = (value) => JSON.stringify(value, null, 2);

const main = () => {
  const { source: dbUrlSource, value: dbUrl } = getDatabaseUrl();

  const manifest = {
    createdAt: new Date().toISOString(),
    repo,
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    gitHead: null,
    backupDir,
    type: 'barsh-matters-postgresql-native-database-index-backup',
    retentionPolicy: {
      intervalSeconds: 900,
      recentAllBackupsHours: RECENT_HOURS,
      dailyBackupsDays: DAILY_DAYS,
      description: 'Keep all 15-minute backups for the last 24 hours by default, then one daily backup for 30 days by default.',
    },
    databasePolicy: {
      usesPgDump: true,
      usesPgRestoreForPreviewAndGuardedRestore: true,
      exportsAllPostgresTablesIndexesAndSchemaObjects: true,
      futurePrismaModelsIncludedAutomatically: true,
      futureDatabaseIndexesIncludedAutomatically: true,
      usesPrismaClient: false,
      excludesPostgresLargeObjects: true,
      reason: 'Future ClaimIndex/search/lawsuit/reference/workflow tables and database indexes should be restorable without editing this script.',
    },
    documentFilePolicy: {
      backsUpActualDocumentFolders: false,
      pullsDocumentsFromClio: false,
      documentVault: 'Clio',
      localDocumentMetadataRowsMayBeIncluded: true,
      postgresLargeObjectsExcluded: true,
    },
    note: 'Local PostgreSQL database/index backup. Clio is not queried. pg_dump captures database tables, data, schema objects, and indexes. Actual document folders are not crawled or copied. PostgreSQL large objects are excluded.',
    restoreNotes: [
      'Use restore:indexes-preview before any restore.',
      'Use restore:indexes-postgres-guarded only when a full PostgreSQL restore is intended.',
      'Selective table restoration should be added only after reviewing schema relationships and corruption scope.',
    ],
    database: {
      kind: '',
      safeConnectionInfo: {},
      postgresDumpFile: '',
      postgresSchemaFile: '',
      postgresArchiveListFile: '',
      postgresArchiveCounts: {},
    },
    cloudMirror: {
      configured: false,
      target: '',
      copied: false,
      error: '',
      retention: null,
    },
  };

  try {
    manifest.gitHead = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    manifest.gitHead = null;
  }

  if (!dbUrl) {
    console.error('FAIL: DATABASE_URL/DIRECT_URL not found in process env, .env.local, or .env');
    process.exit(1);
  }

  const kind = dbUrl.split(':')[0] || 'unknown';
  manifest.database.kind = kind;
  manifest.database.safeConnectionInfo = safeConnectionInfo(dbUrl, dbUrlSource);

  if (!/^postgres(?:ql)?$/i.test(kind)) {
    console.error(`FAIL: backup script currently supports PostgreSQL DATABASE_URL/DIRECT_URL. Found kind: ${kind}`);
    process.exit(1);
  }

  const pgDump = findExecutable('pg_dump', 'PG_DUMP_BIN');
  const pgRestore = findExecutable('pg_restore', 'PG_RESTORE_BIN');

  const normalized = normalizePostgresUrlForLibpq(dbUrl);
  const pgUrl = normalized.url;
  const schemaArgs = normalized.schema ? [`--schema=${normalized.schema}`] : [];

  const dumpFile = path.join(backupDir, 'database.dump');
  const schemaFile = path.join(backupDir, 'schema.sql');
  const archiveListFile = path.join(backupDir, 'archive-list.txt');

  manifest.database.postgresDumpFile = dumpFile;
  manifest.database.postgresSchemaFile = schemaFile;
  manifest.database.postgresArchiveListFile = archiveListFile;
  manifest.database.normalizedConnectionForPgTools = {
    prismaSpecificQueryParamsStripped: normalized.strippedPrismaParams,
    schemaArgUsed: normalized.schema || '',
    urlStoredInManifest: false,
  };

  runTool(pgDump, [
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    '-B',
    `--file=${dumpFile}`,
    ...schemaArgs,
    pgUrl,
  ], 'pg_dump custom backup');

  runTool(pgDump, [
    '--schema-only',
    '--no-owner',
    '--no-privileges',
    '-B',
    `--file=${schemaFile}`,
    ...schemaArgs,
    pgUrl,
  ], 'pg_dump schema backup');

  const archiveList = runTool(pgRestore, ['--list', dumpFile], 'pg_restore archive listing');
  fs.writeFileSync(archiveListFile, archiveList);

  const archiveLines = archiveList.split(/\r?\n/).filter(Boolean);

  const counts = {
    archiveEntries: archiveLines.length,
    tables: archiveLines.filter((line) => /\bTABLE\b/.test(line) && !/\bTABLE DATA\b/.test(line)).length,
    tableData: archiveLines.filter((line) => /\bTABLE DATA\b/.test(line)).length,
    indexes: archiveLines.filter((line) => /\bINDEX\b/.test(line)).length,
    constraints: archiveLines.filter((line) => /\bCONSTRAINT\b/.test(line)).length,
    sequences: archiveLines.filter((line) => /\bSEQUENCE\b/.test(line)).length,
  };

  manifest.database.postgresArchiveCounts = counts;

  fs.writeFileSync(path.join(backupDir, 'manifest.json'), stringify(manifest) + '\n');
  fs.writeFileSync(path.join(backupRoot, 'LATEST_BACKUP.txt'), `${backupDir}\n`);

  const cloudTarget = getCloudTarget();

  if (cloudTarget) {
    manifest.cloudMirror.configured = true;
    manifest.cloudMirror.target = cloudTarget;

    try {
      const cloudDest = path.join(cloudTarget, stamp);
      safeCopyDir(backupDir, cloudDest);
      fs.mkdirSync(cloudTarget, { recursive: true });
      fs.writeFileSync(path.join(cloudTarget, 'LATEST_BACKUP.txt'), `${cloudDest}\n`);
      manifest.cloudMirror.retention = pruneTieredRetention(cloudTarget);
      manifest.cloudMirror.copied = true;
      fs.writeFileSync(path.join(backupDir, 'manifest.json'), stringify(manifest) + '\n');
      fs.writeFileSync(path.join(cloudDest, 'manifest.json'), stringify({ ...manifest, backupDir: cloudDest }) + '\n');
    } catch (err) {
      manifest.cloudMirror.error = err?.message || String(err);
      fs.writeFileSync(path.join(backupDir, 'manifest.json'), stringify(manifest) + '\n');
    }
  }

  const localRetention = pruneTieredRetention(backupRoot);

  console.log('RESULT: local PostgreSQL database/index backup complete');
  console.log(`BACKUP_DIR=${backupDir}`);
  console.log(`DATABASE_KIND=${manifest.database.kind}`);
  console.log(`DB_URL_SOURCE=${dbUrlSource}`);
  console.log(`PG_DUMP_FILE=${dumpFile}`);
  console.log(`PG_SCHEMA_FILE=${schemaFile}`);
  console.log(`PG_ARCHIVE_LIST_FILE=${archiveListFile}`);
  console.log(`PG_ARCHIVE_ENTRIES=${counts.archiveEntries}`);
  console.log(`PG_TABLES=${counts.tables}`);
  console.log(`PG_TABLE_DATA=${counts.tableData}`);
  console.log(`PG_INDEXES=${counts.indexes}`);
  console.log(`PG_CONSTRAINTS=${counts.constraints}`);
  console.log(`PG_SEQUENCES=${counts.sequences}`);
  console.log('EXPORTS_ALL_POSTGRES_TABLES_INDEXES_SCHEMA_OBJECTS=YES');
  console.log('FUTURE_PRISMA_MODELS_INCLUDED=YES');
  console.log('FUTURE_DATABASE_INDEXES_INCLUDED=YES');
  console.log('USES_PRISMA_CLIENT=NO');
  console.log('USES_PG_DUMP=YES');
  console.log('POSTGRES_LARGE_OBJECTS_EXCLUDED=YES');
  console.log('BACKS_UP_ACTUAL_DOCUMENT_FOLDERS=NO');
  console.log('PULLS_DOCUMENTS_FROM_CLIO=NO');
  console.log('DOCUMENT_VAULT=Clio');
  console.log(`RETENTION_RECENT_HOURS=${localRetention.recentHours}`);
  console.log(`RETENTION_DAILY_DAYS=${localRetention.dailyDays}`);
  console.log(`RETENTION_TOTAL_BEFORE=${localRetention.totalBefore}`);
  console.log(`RETENTION_RETAINED=${localRetention.retained}`);
  console.log(`RETENTION_PRUNED=${localRetention.pruned}`);
  console.log(`CLOUD_CONFIGURED=${manifest.cloudMirror.configured ? 'YES' : 'NO'}`);
  console.log(`CLOUD_COPIED=${manifest.cloudMirror.copied ? 'YES' : 'NO'}`);

  if (manifest.cloudMirror.target) console.log(`CLOUD_TARGET=${manifest.cloudMirror.target}`);
  if (manifest.cloudMirror.error) console.log(`CLOUD_ERROR=${manifest.cloudMirror.error}`);
};

try {
  main();
} catch (err) {
  console.error('FAIL: local PostgreSQL database/index backup failed');
  console.error(err?.message || err);
  process.exit(1);
}
