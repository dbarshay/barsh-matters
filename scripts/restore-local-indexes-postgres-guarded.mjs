#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

const repo = process.cwd();
const backupRoot = path.join(repo, 'backups/indexes');

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

const findExecutable = (name, envName) => {
  const candidates = [];

  if (process.env[envName]) candidates.push(process.env[envName]);

  if (process.platform === 'win32') {
    try {
      candidates.push(
        ...execSync(`where ${name}`, { encoding: 'utf8' })
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
      );
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

  throw new Error(`${name} not found. Install PostgreSQL command-line tools or set ${envName}.`);
};

const normalizePostgresUrlForLibpq = (rawUrl) => {
  try {
    const u = new URL(rawUrl);

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

    return u.toString();
  } catch {
    return rawUrl;
  }
};

if (process.env.CONFIRM_RESTORE !== 'YES_RESTORE_LOCAL_POSTGRES_DATABASE') {
  console.error('FAIL: guarded restore blocked.');
  console.error('Set CONFIRM_RESTORE=YES_RESTORE_LOCAL_POSTGRES_DATABASE only after running restore:indexes-preview and confirming a full PostgreSQL restore is intended.');
  process.exit(1);
}

let backupDir = process.argv[2];

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
const dumpFile = manifest.database?.postgresDumpFile || path.join(backupDir, 'database.dump');

if (!fs.existsSync(dumpFile)) {
  console.error(`FAIL: PostgreSQL dump file not found: ${dumpFile}`);
  process.exit(1);
}

const envLocal = parseEnvFile(path.join(repo, '.env.local'));
const env = parseEnvFile(path.join(repo, '.env'));

const targetUrl = (
  process.env.RESTORE_DATABASE_URL ||
  process.env.DIRECT_URL ||
  envLocal.DIRECT_URL ||
  env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  envLocal.DATABASE_URL ||
  env.DATABASE_URL ||
  ''
).trim();

if (!targetUrl) {
  console.error('FAIL: RESTORE_DATABASE_URL/DIRECT_URL/DATABASE_URL not found.');
  process.exit(1);
}

if (!/^postgres(?:ql)?:/i.test(targetUrl)) {
  console.error('FAIL: restore target is not PostgreSQL.');
  process.exit(1);
}

const pgRestore = findExecutable('pg_restore', 'PG_RESTORE_BIN');
const normalizedTargetUrl = normalizePostgresUrlForLibpq(targetUrl);

console.log('RESULT: guarded PostgreSQL restore starting');
console.log(`BACKUP_DIR=${backupDir}`);
console.log(`DUMP_FILE=${dumpFile}`);
console.log('TARGET_URL_REDACTED=YES');
console.log('RESTORE_MODE=pg_restore --clean --if-exists --no-owner --no-privileges');

const result = spawnSync(pgRestore, [
  '--clean',
  '--if-exists',
  '--no-owner',
  '--no-privileges',
  '--dbname',
  normalizedTargetUrl,
  dumpFile,
], {
  encoding: 'utf8',
  env: process.env,
});

if (result.status !== 0) {
  console.error('FAIL: pg_restore failed');
  if (result.stdout) console.error(result.stdout);
  if (result.stderr) console.error(result.stderr);
  process.exit(result.status || 1);
}

if (result.stdout) console.log(result.stdout);
if (result.stderr) console.error(result.stderr);

console.log('RESTORE_COMPLETE=YES');
console.log('NOTE=Restart Barsh Matters after this restore.');
