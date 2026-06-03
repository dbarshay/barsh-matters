import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REQUIRED_CONFIRMATION = "ARCHIVE ERROR LOG";
const repoRoot = process.cwd();
const backupRoot = path.join(repoRoot, "backups", "indexes");
const logRoot = path.join(backupRoot, "logs");
const stderrLogPath = path.join(logRoot, "launchd.err.log");

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function timestampForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function safeDisplayPath(filePath: string): string {
  if (!filePath) return "";
  return filePath.replace(repoRoot, ".");
}

function assertInsideLogRoot(filePath: string): void {
  const normalizedRoot = path.normalize(logRoot);
  const normalizedFile = path.normalize(filePath);

  if (!normalizedFile.startsWith(normalizedRoot + path.sep)) {
    throw new Error("Refusing to archive a file outside backups/indexes/logs.");
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const confirmation = clean(body.confirmation);

  if (confirmation !== REQUIRED_CONFIRMATION) {
    return NextResponse.json(
      {
        ok: false,
        mode: "guarded-stderr-log-archive",
        error: `Confirmation text must exactly equal ${REQUIRED_CONFIRMATION}.`,
        requiredConfirmation: REQUIRED_CONFIRMATION,
        archiveExecution: false,
      },
      { status: 400 }
    );
  }

  fs.mkdirSync(logRoot, { recursive: true });
  assertInsideLogRoot(stderrLogPath);

  const existedBefore = fs.existsSync(stderrLogPath);
  const originalSizeBytes = existedBefore ? fs.statSync(stderrLogPath).size : 0;
  const archivePath = path.join(logRoot, `launchd.err.log.archived-${timestampForFilename()}`);
  assertInsideLogRoot(archivePath);

  if (existedBefore) {
    fs.renameSync(stderrLogPath, archivePath);
  } else {
    fs.writeFileSync(archivePath, "");
  }

  fs.writeFileSync(stderrLogPath, "");

  return NextResponse.json({
    ok: true,
    mode: "guarded-stderr-log-archive",
    archived: true,
    archivedPath: archivePath,
    archivedDisplayPath: safeDisplayPath(archivePath),
    freshLogPath: stderrLogPath,
    freshLogDisplayPath: safeDisplayPath(stderrLogPath),
    existedBefore,
    originalSizeBytes,
    requiredConfirmation: REQUIRED_CONFIRMATION,
    safety: {
      onlyLaunchdErrLog: true,
      touchedStdoutLog: false,
      touchedBackups: false,
      touchedManifests: false,
      touchedDatabaseDumps: false,
      restoreExecution: false,
      backupDeletion: false,
      retentionCleanup: false,
      alertStateMutation: false,
      clioWrite: false,
      email: false,
      documentGeneration: false,
      printQueueMutation: false,
    },
  });
}
