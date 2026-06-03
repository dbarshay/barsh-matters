import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BackupManifest = {
  createdAt?: string;
  gitHead?: string;
  hostname?: string;
  platform?: string;
  type?: string;
  note?: string;
  backupDir?: string;
  retentionPolicy?: {
    intervalSeconds?: number;
    recentAllBackupsHours?: number;
    dailyBackupsDays?: number;
    description?: string;
  };
  database?: {
    kind?: string;
    postgresDumpFile?: string;
    postgresSchemaFile?: string;
    postgresArchiveListFile?: string;
    postgresArchiveCounts?: {
      archiveEntries?: number;
      tables?: number;
      tableData?: number;
      indexes?: number;
      constraints?: number;
      sequences?: number;
    };
    safeConnectionInfo?: {
      source?: string;
      protocol?: string;
      host?: string;
      database?: string;
      usernamePresent?: boolean;
      passwordStoredInManifest?: boolean;
    };
  };
  databasePolicy?: {
    usesPgDump?: boolean;
    usesPgRestoreForPreviewAndGuardedRestore?: boolean;
    exportsAllPostgresTablesIndexesAndSchemaObjects?: boolean;
    futurePrismaModelsIncludedAutomatically?: boolean;
    futureDatabaseIndexesIncludedAutomatically?: boolean;
    usesPrismaClient?: boolean;
  };
  documentFilePolicy?: {
    backsUpActualDocumentFolders?: boolean;
    pullsDocumentsFromClio?: boolean;
    documentVault?: string;
  };
};

const repoRoot = process.cwd();
const backupRoot = path.join(repoRoot, "backups", "indexes");

function readTextIfPresent(filePath: string): string {
  try {
    if (!fs.existsSync(filePath)) return "";
    return fs.readFileSync(filePath, "utf8").trim();
  } catch {
    return "";
  }
}

function readJsonIfPresent<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function isBackupDirectoryName(name: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/.test(name);
}

function safeDisplayPath(filePath: string): string {
  if (!filePath) return "";
  return filePath.replace(repoRoot, ".");
}

function tailLines(filePath: string, maxLines = 50): string[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    return fs.readFileSync(filePath, "utf8").split(/\r?\n/).slice(-maxLines).filter(Boolean);
  } catch {
    return [];
  }
}

function hoursSinceIso(value: string): number | null {
  if (!value) return null;

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;

  return (Date.now() - timestamp) / (60 * 60 * 1000);
}

export async function GET() {
  const latestPointerPath = path.join(backupRoot, "LATEST_BACKUP.txt");
  const latestBackupPath = readTextIfPresent(latestPointerPath);
  const latestManifestPath = latestBackupPath
    ? path.join(latestBackupPath, "manifest.json")
    : "";

  const backups = fs.existsSync(backupRoot)
    ? fs
        .readdirSync(backupRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && isBackupDirectoryName(entry.name))
        .map((entry) => {
          const absolutePath = path.join(backupRoot, entry.name);
          const manifestPath = path.join(absolutePath, "manifest.json");
          const manifest = readJsonIfPresent<BackupManifest>(manifestPath);
          const stat = fs.statSync(absolutePath);

          return {
            name: entry.name,
            path: absolutePath,
            displayPath: safeDisplayPath(absolutePath),
            modifiedAt: stat.mtime.toISOString(),
            createdAt: manifest?.createdAt || "",
            gitHead: manifest?.gitHead || "",
            hostname: manifest?.hostname || "",
            platform: manifest?.platform || "",
            databaseKind: manifest?.database?.kind || "",
            tableCount: manifest?.database?.postgresArchiveCounts?.tables ?? null,
            indexCount: manifest?.database?.postgresArchiveCounts?.indexes ?? null,
            archiveEntries: manifest?.database?.postgresArchiveCounts?.archiveEntries ?? null,
            hasManifest: Boolean(manifest),
            hasDatabaseDump: fs.existsSync(path.join(absolutePath, "database.dump")),
            hasSchemaSql: fs.existsSync(path.join(absolutePath, "schema.sql")),
            hasArchiveList: fs.existsSync(path.join(absolutePath, "archive-list.txt")),
            manifest,
            manifestJson: manifest ? JSON.stringify(manifest, null, 2) : "",
          };
        })
        .sort((a, b) => b.name.localeCompare(a.name))
        .slice(0, 20)
    : [];

  const latestManifest = readJsonIfPresent<BackupManifest>(latestManifestPath);
  const alertStatePath = path.join(backupRoot, "backup-alert-state.json");
  const alertState = readJsonIfPresent<Record<string, any>>(alertStatePath);
  const latestBackupAgeHours = hoursSinceIso(latestManifest?.createdAt || "");
  const backupLogRoot = path.join(backupRoot, "logs");
  const launchdOutLogPath = path.join(backupLogRoot, "launchd.out.log");
  const launchdErrLogPath = path.join(backupLogRoot, "launchd.err.log");
  const expectedIntervalSeconds = latestManifest?.retentionPolicy?.intervalSeconds ?? 900;
  const scheduledWarningThresholdMinutes = Math.max(30, Math.ceil((expectedIntervalSeconds * 2) / 60));
  const latestBackupWithinExpectedWindow =
    latestBackupAgeHours === null
      ? false
      : latestBackupAgeHours <= scheduledWarningThresholdMinutes / 60;

  const backupAlertState = {
    mode: "read-only-backup-alert-state",
    path: alertStatePath,
    displayPath: safeDisplayPath(alertStatePath),
    exists: fs.existsSync(alertStatePath),
    lastAlert: alertState?.lastAlert || null,
    duplicateSuppressionActive: Boolean(alertState?.lastAlert?.kind && alertState?.lastAlert?.key),
    safety: {
      readOnly: true,
      sendEmail: false,
      restoreExecution: false,
      backupDeletion: false,
      retentionCleanup: false,
      clioWrite: false,
      documentGeneration: false,
      printQueueMutation: false,
    },
  };

  const scheduledBackupHealth = {
    mode: "read-only-scheduled-backup-health",
    expectedIntervalSeconds,
    scheduledWarningThresholdMinutes,
    latestBackupAgeHours,
    latestBackupWithinExpectedWindow,
    retentionPolicy: latestManifest?.retentionPolicy || null,
    logs: {
      out: {
        path: launchdOutLogPath,
        displayPath: safeDisplayPath(launchdOutLogPath),
        exists: fs.existsSync(launchdOutLogPath),
        tail: tailLines(launchdOutLogPath, 50),
      },
      err: {
        path: launchdErrLogPath,
        displayPath: safeDisplayPath(launchdErrLogPath),
        exists: fs.existsSync(launchdErrLogPath),
        tail: tailLines(launchdErrLogPath, 50),
      },
    },
    safety: {
      readOnly: true,
      retentionDeletion: false,
      restoreExecution: false,
      clioWrite: false,
      email: false,
      documentGeneration: false,
      printQueueMutation: false,
    },
  };

  return NextResponse.json({
    ok: true,
    mode: "backup-status-read-only",
    restoreExecutionEnabled: false,
    backupRoot,
    backupRootDisplay: safeDisplayPath(backupRoot),
    latestPointerPath,
    latestPointerDisplay: safeDisplayPath(latestPointerPath),
    latestBackupPath,
    latestBackupDisplay: safeDisplayPath(latestBackupPath),
    latestManifest,
    backupAlertState,
    scheduledBackupHealth,
    backups,
    safety: {
      clioWrite: false,
      email: false,
      documentGeneration: false,
      printQueueMutation: false,
      restoreExecution: false,
      restorePreviewOnly: true,
    },
  });
}
