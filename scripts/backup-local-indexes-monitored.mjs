#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repo = process.cwd();
const backupRoot = path.join(repo, 'backups', 'indexes');
const statePath = path.join(backupRoot, 'backup-alert-state.json');
const latestPath = path.join(backupRoot, 'LATEST_BACKUP.txt');

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run') || process.env.BARSH_BACKUP_ALERT_DRY_RUN === '1';
const STATUS_ONLY = args.has('--status-only');
const SIMULATE_FAILURE = args.has('--simulate-failure');
const SIMULATE_STALE = args.has('--simulate-stale');
const FORCE_ALERT = args.has('--force-alert');
const SEND_TEST = args.has('--send-test-alert');

const DEFAULT_ALERT_TO = 'dbarshay15@gmail.com';

function clean(value) {
  return String(value ?? '').trim();
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const out = {};
  const text = fs.readFileSync(filePath, 'utf8');

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;

    const [rawKey, ...rest] = line.split('=');
    const key = rawKey.trim();
    let value = rest.join('=').trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    out[key] = value;
  }

  return out;
}

const envLocal = parseEnvFile(path.join(repo, '.env.local'));
const envFile = parseEnvFile(path.join(repo, '.env'));
const env = {
  ...envFile,
  ...envLocal,
  ...process.env,
};

function envValue(...keys) {
  for (const key of keys) {
    const value = clean(env[key]);
    if (value) return value;
  }
  return '';
}

function parseAlertRecipients(value) {
  const raw = clean(value) || DEFAULT_ALERT_TO;
  const recipients = raw
    .split(/[;,]/)
    .map((item) => clean(item))
    .filter(Boolean)
    .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item));

  return [...new Set(recipients)].length ? [...new Set(recipients)] : [DEFAULT_ALERT_TO];
}

function alertRecipients() {
  return parseAlertRecipients(envValue('BARSH_BACKUP_ALERT_TO', 'BACKUP_ALERT_TO'));
}

function alertTo() {
  return alertRecipients().join(', ');
}

function graphConfig() {
  return {
    tenantId: envValue('MICROSOFT_GRAPH_TENANT_ID', 'GRAPH_TENANT_ID'),
    clientId: envValue('MICROSOFT_GRAPH_CLIENT_ID', 'GRAPH_CLIENT_ID'),
    clientSecret: envValue('MICROSOFT_GRAPH_CLIENT_SECRET', 'GRAPH_CLIENT_SECRET'),
    mailboxUserId: envValue('MICROSOFT_GRAPH_MAILBOX_USER_ID', 'GRAPH_MAILBOX_USER_ID'),
  };
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function readLatestBackupDir() {
  try {
    if (!fs.existsSync(latestPath)) return '';
    return fs.readFileSync(latestPath, 'utf8').trim();
  } catch {
    return '';
  }
}

function readLatestManifest() {
  const latestDir = readLatestBackupDir();
  if (!latestDir) return { latestDir: '', manifest: null, manifestPath: '' };

  const manifestPath = path.join(latestDir, 'manifest.json');
  const manifest = readJson(manifestPath, null);

  return { latestDir, manifest, manifestPath };
}

function latestBackupAgeMinutes(manifest) {
  const createdAt = clean(manifest?.createdAt);
  if (!createdAt) return null;

  const timestamp = new Date(createdAt).getTime();
  if (!Number.isFinite(timestamp)) return null;

  return (Date.now() - timestamp) / (60 * 1000);
}

function expectedIntervalMinutes(manifest) {
  const intervalSeconds = Number(manifest?.retentionPolicy?.intervalSeconds || process.env.BARSH_INDEX_BACKUP_EXPECTED_INTERVAL_SECONDS || 900);
  if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) return 15;
  return Math.ceil(intervalSeconds / 60);
}

function staleThresholdMinutes(manifest) {
  const explicit = Number(envValue('BARSH_BACKUP_ALERT_STALE_MINUTES', 'BACKUP_ALERT_STALE_MINUTES'));
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  return Math.max(30, expectedIntervalMinutes(manifest) * 2);
}

function currentStatus() {
  const { latestDir, manifest, manifestPath } = readLatestManifest();
  const ageMinutes = latestBackupAgeMinutes(manifest);
  const thresholdMinutes = staleThresholdMinutes(manifest);
  const stale = SIMULATE_STALE || ageMinutes === null || ageMinutes > thresholdMinutes;

  return {
    repo,
    hostname: os.hostname(),
    platform: process.platform,
    latestDir,
    manifestPath,
    latestCreatedAt: clean(manifest?.createdAt),
    latestGitHead: clean(manifest?.gitHead),
    ageMinutes,
    expectedIntervalMinutes: expectedIntervalMinutes(manifest),
    staleThresholdMinutes: thresholdMinutes,
    stale,
    manifestPresent: Boolean(manifest),
    databaseKind: clean(manifest?.database?.kind),
    tables: manifest?.database?.postgresArchiveCounts?.tables ?? null,
    indexes: manifest?.database?.postgresArchiveCounts?.indexes ?? null,
    archiveEntries: manifest?.database?.postgresArchiveCounts?.archiveEntries ?? null,
    pullsDocumentsFromClio: manifest?.documentFilePolicy?.pullsDocumentsFromClio ?? null,
    usesPgDump: manifest?.databasePolicy?.usesPgDump ?? null,
    usesPrismaClient: manifest?.databasePolicy?.usesPrismaClient ?? null,
  };
}

function alertKey(kind, status, backupFailureMessage = '') {
  const core = [
    kind,
    status.latestCreatedAt || 'no-created-at',
    status.latestDir || 'no-latest-dir',
    backupFailureMessage.slice(0, 180),
  ];

  return core.join('|');
}

function shouldSuppressAlert(kind, key) {
  if (FORCE_ALERT || SEND_TEST) return false;

  const state = readJson(statePath, {});
  return state?.lastAlert?.kind === kind && state?.lastAlert?.key === key;
}

function recordAlert(kind, key, alert) {
  writeJson(statePath, {
    lastAlert: {
      kind,
      key,
      sentAt: new Date().toISOString(),
      subject: alert.subject,
      to: alert.to,
      recipients: alert.recipients,
      recipients: alert.recipients,
      dryRun: alert.dryRun,
    },
  });
}

function buildAlert(kind, status, backupResult) {
  const recipients = alertRecipients();
  const to = recipients.join(', ');
  const subject =
    kind === 'backup-failed'
      ? 'Barsh Matters backup FAILED'
      : kind === 'backup-stale'
        ? 'Barsh Matters backup is late'
        : 'Barsh Matters backup alert test';

  const lines = [
    'Barsh Matters Backup Alert',
    '',
    `Alert kind: ${kind}`,
    `Host: ${status.hostname}`,
    `Repo: ${status.repo}`,
    `Time: ${new Date().toISOString()}`,
    '',
    'Latest backup status:',
    `Latest backup dir: ${status.latestDir || 'NONE'}`,
    `Latest createdAt: ${status.latestCreatedAt || 'NONE'}`,
    `Latest gitHead: ${status.latestGitHead || 'NONE'}`,
    `Age minutes: ${status.ageMinutes === null ? 'UNKNOWN' : status.ageMinutes.toFixed(1)}`,
    `Stale threshold minutes: ${status.staleThresholdMinutes}`,
    `Manifest present: ${status.manifestPresent ? 'YES' : 'NO'}`,
    `Database kind: ${status.databaseKind || 'UNKNOWN'}`,
    `Tables: ${status.tables ?? 'UNKNOWN'}`,
    `Indexes: ${status.indexes ?? 'UNKNOWN'}`,
    `Archive entries: ${status.archiveEntries ?? 'UNKNOWN'}`,
    `Uses pg_dump: ${status.usesPgDump === true ? 'YES' : status.usesPgDump === false ? 'NO' : 'UNKNOWN'}`,
    `Uses Prisma client: ${status.usesPrismaClient === true ? 'YES' : status.usesPrismaClient === false ? 'NO' : 'UNKNOWN'}`,
    `Pulls documents from Clio: ${status.pullsDocumentsFromClio === true ? 'YES' : status.pullsDocumentsFromClio === false ? 'NO' : 'UNKNOWN'}`,
    '',
  ];

  if (backupResult) {
    lines.push('Backup run result:');
    lines.push(`Exit status: ${backupResult.status}`);
    lines.push(`Signal: ${backupResult.signal || ''}`);
    lines.push('');
    lines.push('STDOUT tail:');
    lines.push((backupResult.stdout || '').split(/\r?\n/).slice(-60).join('\n'));
    lines.push('');
    lines.push('STDERR tail:');
    lines.push((backupResult.stderr || '').split(/\r?\n/).slice(-60).join('\n'));
  }

  if (SEND_TEST) {
    lines.push('');
    lines.push('Test mode: this is a manually requested test alert.');
  }

  return {
    to,
    recipients,
    subject,
    body: lines.join('\n'),
  };
}

async function requestGraphToken(config) {
  const url = `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`;
  const form = new URLSearchParams();

  form.set('client_id', config.clientId);
  form.set('client_secret', config.clientSecret);
  form.set('scope', 'https://graph.microsoft.com/.default');
  form.set('grant_type', 'client_credentials');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: form.toString(),
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok || !json?.access_token) {
    throw new Error(json?.error_description || json?.error || text || `Graph token request failed: ${response.status}`);
  }

  return json.access_token;
}

async function sendGraphMail(alert) {
  const config = graphConfig();

  const missing = Object.entries(config)
    .filter(([, value]) => !clean(value))
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(`Missing Microsoft Graph backup alert configuration: ${missing.join(', ')}`);
  }

  const token = await requestGraphToken(config);
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.mailboxUserId)}/sendMail`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject: alert.subject,
        body: {
          contentType: 'Text',
          content: alert.body,
        },
        toRecipients: alert.recipients.map((address) => ({
          emailAddress: {
            address,
          },
        })),
      },
      saveToSentItems: true,
    }),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `Graph sendMail failed: ${response.status} ${response.statusText}`);
  }

  return {
    ok: true,
    status: response.status,
    statusText: response.statusText,
  };
}

async function alertIfNeeded(kind, status, backupResult) {
  const failureMessage = backupResult?.stderr || backupResult?.stdout || '';
  const key = alertKey(kind, status, failureMessage);
  const alert = buildAlert(kind, status, backupResult);

  if (shouldSuppressAlert(kind, key)) {
    return {
      ok: true,
      suppressed: true,
      kind,
      key,
      subject: alert.subject,
      to: alert.to,
      recipients: alert.recipients,
      dryRun: DRY_RUN,
    };
  }

  if (DRY_RUN) {
    return {
      ok: true,
      suppressed: false,
      kind,
      key,
      subject: alert.subject,
      to: alert.to,
      recipients: alert.recipients,
      dryRun: true,
      bodyPreview: alert.body,
    };
  }

  const sent = await sendGraphMail(alert);
  recordAlert(kind, key, { ...alert, dryRun: false });

  return {
    ok: true,
    suppressed: false,
    kind,
    key,
    subject: alert.subject,
    to: alert.to,
    dryRun: false,
    graphStatus: sent.status,
  };
}

function runBackup() {
  if (SIMULATE_FAILURE) {
    return {
      status: 97,
      signal: null,
      stdout: '',
      stderr: 'Simulated backup failure for monitored backup alert verification.',
    };
  }

  return spawnSync(process.execPath, ['scripts/backup-local-indexes.mjs'], {
    cwd: repo,
    encoding: 'utf8',
    env: process.env,
    timeout: 180_000,
  });
}

async function main() {
  fs.mkdirSync(backupRoot, { recursive: true });

  if (STATUS_ONLY) {
    const status = currentStatus();
    console.log('RESULT: monitored backup status only');
    console.log(`ALERT_TO=${alertTo()}`);
    console.log(`ALERT_RECIPIENT_COUNT=${alertRecipients().length}`);
    console.log(`LATEST_BACKUP_DIR=${status.latestDir}`);
    console.log(`LATEST_CREATED_AT=${status.latestCreatedAt}`);
    console.log(`AGE_MINUTES=${status.ageMinutes === null ? '' : status.ageMinutes.toFixed(1)}`);
    console.log(`STALE_THRESHOLD_MINUTES=${status.staleThresholdMinutes}`);
    console.log(`STALE=${status.stale ? 'YES' : 'NO'}`);
    console.log(`MANIFEST_PRESENT=${status.manifestPresent ? 'YES' : 'NO'}`);
    console.log('SEND_EMAIL=NO');
    return;
  }

  if (SEND_TEST) {
    const status = currentStatus();
    const result = await alertIfNeeded('test-alert', status, null);
    console.log('RESULT: monitored backup test alert');
    console.log(`DRY_RUN=${DRY_RUN ? 'YES' : 'NO'}`);
    console.log(`ALERT_TO=${result.to}`);
    console.log(`ALERT_RECIPIENT_COUNT=${result.recipients?.length ?? ''}`);
    console.log(`SUBJECT=${result.subject}`);
    console.log(`SUPPRESSED=${result.suppressed ? 'YES' : 'NO'}`);
    console.log(`GRAPH_STATUS=${result.graphStatus ?? ''}`);
    if (result.bodyPreview) {
      console.log('');
      console.log('BODY_PREVIEW:');
      console.log(result.bodyPreview);
    }
    return;
  }

  const backupResult = runBackup();
  const statusAfter = currentStatus();

  if (backupResult.status !== 0) {
    const result = await alertIfNeeded('backup-failed', statusAfter, backupResult);
    console.log('RESULT: monitored backup failed');
    console.log(`BACKUP_STATUS=${backupResult.status}`);
    console.log(`ALERT_SENT=${!result.suppressed && !result.dryRun ? 'YES' : 'NO'}`);
    console.log(`ALERT_DRY_RUN=${result.dryRun ? 'YES' : 'NO'}`);
    console.log(`ALERT_SUPPRESSED=${result.suppressed ? 'YES' : 'NO'}`);
    if (result.bodyPreview) {
      console.log('');
      console.log('BODY_PREVIEW:');
      console.log(result.bodyPreview);
    }
    process.exit(backupResult.status || 1);
  }

  if (statusAfter.stale) {
    const result = await alertIfNeeded('backup-stale', statusAfter, backupResult);
    console.log('RESULT: monitored backup completed but latest backup is stale');
    console.log(`ALERT_SENT=${!result.suppressed && !result.dryRun ? 'YES' : 'NO'}`);
    console.log(`ALERT_DRY_RUN=${result.dryRun ? 'YES' : 'NO'}`);
    console.log(`ALERT_SUPPRESSED=${result.suppressed ? 'YES' : 'NO'}`);
    if (result.bodyPreview) {
      console.log('');
      console.log('BODY_PREVIEW:');
      console.log(result.bodyPreview);
    }
    process.exit(2);
  }

  console.log('RESULT: monitored backup ok');
  console.log(`LATEST_BACKUP_DIR=${statusAfter.latestDir}`);
  console.log(`LATEST_CREATED_AT=${statusAfter.latestCreatedAt}`);
  console.log(`AGE_MINUTES=${statusAfter.ageMinutes === null ? '' : statusAfter.ageMinutes.toFixed(1)}`);
  console.log(`STALE_THRESHOLD_MINUTES=${statusAfter.staleThresholdMinutes}`);
  console.log('ALERT_SENT=NO');
}

main().catch((error) => {
  console.error('RESULT: monitored backup wrapper crashed');
  console.error(`ERROR=${error?.message || String(error)}`);
  process.exit(1);
});
