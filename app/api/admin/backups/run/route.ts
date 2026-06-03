import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

function tail(text: string, maxLines = 120): string {
  return text.split(/\r?\n/).slice(-maxLines).join("\n");
}

export async function POST() {
  const startedAt = new Date().toISOString();

  const result = spawnSync(process.execPath, ["scripts/backup-local-indexes.mjs"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      BARSH_ADMIN_BACKUP_ROUTE: "1",
    },
    timeout: 120_000,
  });

  const completedAt = new Date().toISOString();
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  const latestBackupPath = readTextIfPresent(path.join(backupRoot, "LATEST_BACKUP.txt"));

  if (result.status !== 0) {
    return NextResponse.json(
      {
        ok: false,
        mode: "manual-index-backup",
        startedAt,
        completedAt,
        status: result.status,
        signal: result.signal,
        latestBackupPath,
        stdoutTail: tail(stdout),
        stderrTail: tail(stderr),
        safety: {
          clioWrite: false,
          email: false,
          documentGeneration: false,
          printQueueMutation: false,
          restoreExecution: false,
        },
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    mode: "manual-index-backup",
    startedAt,
    completedAt,
    latestBackupPath,
    stdoutTail: tail(stdout),
    stderrTail: tail(stderr),
    safety: {
      clioWrite: false,
      email: false,
      documentGeneration: false,
      printQueueMutation: false,
      restoreExecution: false,
    },
  });
}
