"use client";

import React, { useEffect, useMemo, useState } from "react";

type BackupRow = {
  name: string;
  path: string;
  displayPath: string;
  modifiedAt: string;
  createdAt: string;
  gitHead: string;
  hostname: string;
  platform: string;
  databaseKind: string;
  tableCount: number | null;
  indexCount: number | null;
  archiveEntries: number | null;
  hasManifest: boolean;
  hasDatabaseDump: boolean;
  hasSchemaSql: boolean;
  hasArchiveList: boolean;
};

type BackupStatus = {
  ok: boolean;
  mode: string;
  restoreExecutionEnabled: boolean;
  backupRootDisplay: string;
  latestBackupPath: string;
  latestBackupDisplay: string;
  latestManifest: {
    createdAt?: string;
    gitHead?: string;
    hostname?: string;
    platform?: string;
    note?: string;
    database?: {
      kind?: string;
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
  } | null;
  backups: BackupRow[];
};

type ActionResult = {
  ok?: boolean;
  mode?: string;
  latestBackupPath?: string;
  backupDir?: string;
  output?: string;
  stdoutTail?: string;
  stderrTail?: string;
  error?: string;
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 22,
  padding: 20,
  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.07)",
};

const buttonStyle: React.CSSProperties = {
  border: "1px solid #1d4ed8",
  background: "#1d4ed8",
  color: "#fff",
  borderRadius: 14,
  padding: "11px 15px",
  fontWeight: 950,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
};

function formatDate(value: string): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function shortHead(value: string): string {
  return value ? value.slice(0, 12) : "—";
}

function passFail(value: boolean | undefined): string {
  if (value === true) return "YES";
  if (value === false) return "NO";
  return "—";
}

export default function AdminBackupRestorePage() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBackup, setSelectedBackup] = useState("");
  const [actionBusy, setActionBusy] = useState("");
  const [message, setMessage] = useState("");
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);

  const latestCounts = status?.latestManifest?.database?.postgresArchiveCounts;

  const selectedBackupRow = useMemo(
    () => status?.backups.find((backup) => backup.path === selectedBackup) || null,
    [selectedBackup, status?.backups]
  );

  async function loadStatus() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/backups/status", { cache: "no-store" });
      const data = (await response.json()) as BackupStatus;

      setStatus(data);

      if (!selectedBackup && data.backups?.[0]?.path) {
        setSelectedBackup(data.backups[0].path);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function runBackup() {
    setActionBusy("backup");
    setMessage("Running manual local database/index backup...");
    setActionResult(null);

    try {
      const response = await fetch("/api/admin/backups/run", {
        method: "POST",
      });
      const data = (await response.json()) as ActionResult;

      setActionResult(data);
      setMessage(data.ok ? "Manual backup completed." : data.error || "Manual backup failed.");

      await loadStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setActionBusy("");
    }
  }

  async function runRestorePreview() {
    setActionBusy("restore-preview");
    setMessage("Running restore preview only...");
    setActionResult(null);

    try {
      const response = await fetch("/api/admin/backups/restore-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupDir: selectedBackup }),
      });
      const data = (await response.json()) as ActionResult;

      setActionResult(data);
      setMessage(data.ok ? "Restore preview completed.  No restore was executed." : data.error || "Restore preview failed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setActionBusy("");
    }
  }

  useEffect(() => {
    void loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main
      data-barsh-admin-backup-restore="true"
      data-restore-execution-enabled="false"
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#0f172a",
        padding: "28px 30px 46px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 18 }}>
        <header style={{ ...cardStyle, display: "grid", gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 950, color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Administrator
          </div>
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1 }}>Backup / Restore</h1>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.45, maxWidth: 960 }}>
            Run a manual local Barsh Matters database/index backup, review recent backups, and run a restore preview.  Restore execution is intentionally disabled in this UI and requires a separate approved guarded workflow.
          </p>
          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fff1f2",
              color: "#9f1239",
              borderRadius: 16,
              padding: 13,
              fontWeight: 900,
              lineHeight: 1.45,
            }}
          >
            Preview-only restore safety: this page does not execute restores, write Clio data, send email, generate documents, or change the print queue.
          </div>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <div style={cardStyle}>
            <div style={{ fontSize: 13, fontWeight: 950, color: "#64748b", textTransform: "uppercase" }}>Latest Backup</div>
            <div style={{ marginTop: 8, fontSize: 18, fontWeight: 950 }}>
              {loading ? "Loading..." : formatDate(status?.latestManifest?.createdAt || "")}
            </div>
            <div style={{ marginTop: 8, color: "#475569", lineHeight: 1.45, wordBreak: "break-word" }}>
              {status?.latestBackupDisplay || "No latest backup pointer found."}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 13, fontWeight: 950, color: "#64748b", textTransform: "uppercase" }}>Database Snapshot</div>
            <div style={{ marginTop: 8, display: "grid", gap: 5, color: "#334155", lineHeight: 1.45 }}>
              <div><strong>Kind:</strong> {status?.latestManifest?.database?.kind || "—"}</div>
              <div><strong>Tables:</strong> {latestCounts?.tables ?? "—"}</div>
              <div><strong>Indexes:</strong> {latestCounts?.indexes ?? "—"}</div>
              <div><strong>Archive entries:</strong> {latestCounts?.archiveEntries ?? "—"}</div>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 13, fontWeight: 950, color: "#64748b", textTransform: "uppercase" }}>Safety Contract</div>
            <div style={{ marginTop: 8, display: "grid", gap: 5, color: "#334155", lineHeight: 1.45 }}>
              <div><strong>Uses pg_dump:</strong> {passFail(status?.latestManifest?.databasePolicy?.usesPgDump)}</div>
              <div><strong>Uses Prisma client:</strong> {passFail(status?.latestManifest?.databasePolicy?.usesPrismaClient)}</div>
              <div><strong>Pulls docs from Clio:</strong> {passFail(status?.latestManifest?.documentFilePolicy?.pullsDocumentsFromClio)}</div>
              <div><strong>Restore execution:</strong> DISABLED</div>
            </div>
          </div>
        </section>

        <section style={{ ...cardStyle, display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22 }}>Manual Backup</h2>
              <p style={{ margin: "6px 0 0", color: "#475569", lineHeight: 1.45 }}>
                Creates a local database/index backup using the existing backup script and then refreshes the latest-backup status.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={() => void loadStatus()} style={secondaryButtonStyle} disabled={loading || Boolean(actionBusy)}>
                Refresh Status
              </button>
              <button type="button" onClick={() => void runBackup()} style={buttonStyle} disabled={Boolean(actionBusy)}>
                {actionBusy === "backup" ? "Running Backup..." : "Run Backup Now"}
              </button>
            </div>
          </div>
        </section>

        <section style={{ ...cardStyle, display: "grid", gap: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>Restore Preview Only</h2>
            <p style={{ margin: "6px 0 0", color: "#475569", lineHeight: 1.45 }}>
              Select a backup and run the existing restore preview script.  This displays what would be reviewed before a guarded restore.  It does not write to the database.
            </p>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <label htmlFor="backup-select" style={{ fontWeight: 950 }}>Backup to preview</label>
            <select
              id="backup-select"
              value={selectedBackup}
              onChange={(event) => setSelectedBackup(event.target.value)}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 14,
                padding: 12,
                fontWeight: 850,
                background: "#fff",
                color: "#0f172a",
              }}
            >
              {(status?.backups || []).map((backup) => (
                <option key={backup.path} value={backup.path}>
                  {backup.name} — {backup.displayPath}
                </option>
              ))}
            </select>
            {selectedBackupRow && (
              <div style={{ color: "#475569", lineHeight: 1.45 }}>
                Selected: {formatDate(selectedBackupRow.createdAt || selectedBackupRow.modifiedAt)}; git {shortHead(selectedBackupRow.gitHead)}; tables {selectedBackupRow.tableCount ?? "—"}; indexes {selectedBackupRow.indexCount ?? "—"}.
              </div>
            )}
          </div>

          <div>
            <button type="button" onClick={() => void runRestorePreview()} style={buttonStyle} disabled={!selectedBackup || Boolean(actionBusy)}>
              {actionBusy === "restore-preview" ? "Running Preview..." : "Run Restore Preview"}
            </button>
          </div>
        </section>

        <section style={{ ...cardStyle, display: "grid", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>Recent Backups</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#475569", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "10px 8px" }}>Created</th>
                  <th style={{ padding: "10px 8px" }}>Path</th>
                  <th style={{ padding: "10px 8px" }}>Git</th>
                  <th style={{ padding: "10px 8px" }}>Tables</th>
                  <th style={{ padding: "10px 8px" }}>Indexes</th>
                  <th style={{ padding: "10px 8px" }}>Files</th>
                </tr>
              </thead>
              <tbody>
                {(status?.backups || []).map((backup) => (
                  <tr key={backup.path} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{formatDate(backup.createdAt || backup.modifiedAt)}</td>
                    <td style={{ padding: "10px 8px", wordBreak: "break-word", color: "#334155" }}>{backup.displayPath}</td>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{shortHead(backup.gitHead)}</td>
                    <td style={{ padding: "10px 8px" }}>{backup.tableCount ?? "—"}</td>
                    <td style={{ padding: "10px 8px" }}>{backup.indexCount ?? "—"}</td>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>
                      {backup.hasManifest ? "manifest " : ""}
                      {backup.hasDatabaseDump ? "dump " : ""}
                      {backup.hasSchemaSql ? "schema " : ""}
                      {backup.hasArchiveList ? "archive-list" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {(message || actionResult) && (
          <section
            style={{
              border: actionResult?.ok === false ? "1px solid #fecaca" : "1px solid #bfdbfe",
              background: actionResult?.ok === false ? "#fff1f2" : "#eff6ff",
              color: actionResult?.ok === false ? "#9f1239" : "#1e3a8a",
              borderRadius: 18,
              padding: 16,
              display: "grid",
              gap: 10,
            }}
          >
            {message && <div style={{ fontWeight: 950 }}>{message}</div>}
            {actionResult?.output && (
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", overflowX: "auto", color: "#0f172a" }}>
                {actionResult.output}
              </pre>
            )}
            {actionResult?.stdoutTail && (
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", overflowX: "auto", color: "#0f172a" }}>
                {actionResult.stdoutTail}
              </pre>
            )}
            {actionResult?.stderrTail && (
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", overflowX: "auto", color: "#991b1b" }}>
                {actionResult.stderrTail}
              </pre>
            )}
          </section>
        )}

        <section
          style={{
            border: "1px solid #dbeafe",
            background: "#eff6ff",
            color: "#1e3a8a",
            borderRadius: 18,
            padding: 16,
            lineHeight: 1.45,
          }}
        >
          <strong>Safety:</strong> Restore execution remains deferred.  The UI exposes only backup creation, backup status/listing, and restore preview.  A future restore execution workflow must be separately approved and guarded.
        </section>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <a href="/admin" style={{ color: "#334155", fontWeight: 900, textDecoration: "none" }}>
            ← Back to Admin Home
          </a>
          <a href="/" style={{ color: "#334155", fontWeight: 900, textDecoration: "none" }}>
            ← Back to Barsh Matters
          </a>
        </div>
      </div>
    </main>
  );
}
