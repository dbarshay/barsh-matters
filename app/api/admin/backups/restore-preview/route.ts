import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const repoRoot = process.cwd();
const backupRoot = path.join(repoRoot, "backups", "indexes");

function resolveBackupDirectory(input: string): string {
  const raw = String(input || "").trim();

  if (!raw) {
    const latest = path.join(backupRoot, "LATEST_BACKUP.txt");
    if (!fs.existsSync(latest)) {
      throw new Error("No backup directory supplied and LATEST_BACKUP.txt was not found.");
    }

    return fs.readFileSync(latest, "utf8").trim();
  }

  const candidate = path.isAbsolute(raw) ? raw : path.resolve(repoRoot, raw);
  const normalized = path.normalize(candidate);
  const normalizedRoot = path.normalize(backupRoot);

  if (!normalized.startsWith(normalizedRoot + path.sep)) {
    throw new Error("Backup directory must be inside backups/indexes.");
  }

  return normalized;
}

function tail(text: string, maxLines = 220): string {
  return text.split(/\r?\n/).slice(-maxLines).join("\n");
}

export async function POST(request: Request) {
  let body: { backupDir?: string } = {};

  try {
    body = (await request.json()) as { backupDir?: string };
  } catch {
    body = {};
  }

  let backupDir = "";

  try {
    backupDir = resolveBackupDirectory(body.backupDir || "");
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        mode: "restore-preview-only",
        error: error instanceof Error ? error.message : String(error),
        restoreExecutionEnabled: false,
      },
      { status: 400 }
    );
  }

  const manifestPath = path.join(backupDir, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    return NextResponse.json(
      {
        ok: false,
        mode: "restore-preview-only",
        backupDir,
        error: "manifest.json was not found in the selected backup directory.",
        restoreExecutionEnabled: false,
      },
      { status: 404 }
    );
  }

  const result = spawnSync(process.execPath, ["scripts/restore-local-indexes-preview.mjs", backupDir], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      BARSH_ADMIN_RESTORE_PREVIEW_ROUTE: "1",
    },
    timeout: 60_000,
  });

  const stdout = result.stdout || "";
  const stderr = result.stderr || "";

  if (result.status !== 0) {
    return NextResponse.json(
      {
        ok: false,
        mode: "restore-preview-only",
        backupDir,
        status: result.status,
        signal: result.signal,
        stdoutTail: tail(stdout),
        stderrTail: tail(stderr),
        restoreExecutionEnabled: false,
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
    mode: "restore-preview-only",
    backupDir,
    output: stdout,
    stderrTail: tail(stderr),
    restoreExecutionEnabled: false,
    safety: {
      clioWrite: false,
      email: false,
      documentGeneration: false,
      printQueueMutation: false,
      restoreExecution: false,
    },
  });
}
