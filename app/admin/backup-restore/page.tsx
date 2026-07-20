"use client";

import React, { useEffect, useMemo, useState } from "react";
import BarshHeader from "@/app/components/BarshHeader";

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
  manifest?: {
    createdAt?: string;
    backupDir?: string;
    gitHead?: string;
    hostname?: string;
    platform?: string;
    type?: string;
    note?: string;
    retentionPolicy?: {
      intervalSeconds?: number;
      recentAllBackupsHours?: number;
      dailyBackupsDays?: number;
      description?: string;
    };
    databasePolicy?: {
      usesPgDump?: boolean;
      usesPgRestoreForPreviewAndGuardedRestore?: boolean;
      exportsAllPostgresTablesIndexesAndSchemaObjects?: boolean;
      futurePrismaModelsIncludedAutomatically?: boolean;
      futureDatabaseIndexesIncludedAutomatically?: boolean;
      usesPrismaClient?: boolean;
      excludesPostgresLargeObjects?: boolean;
    };
    documentFilePolicy?: {
      backsUpActualDocumentFolders?: boolean;
      pullsDocumentsFromClio?: boolean;
      documentVault?: string;
      localDocumentMetadataRowsMayBeIncluded?: boolean;
      postgresLargeObjectsExcluded?: boolean;
    };
    database?: {
      kind?: string;
      safeConnectionInfo?: {
        source?: string;
        protocol?: string;
        host?: string;
        database?: string;
        usernamePresent?: boolean;
        passwordStoredInManifest?: boolean;
      };
      postgresArchiveCounts?: {
        archiveEntries?: number;
        tables?: number;
        tableData?: number;
        indexes?: number;
        constraints?: number;
        sequences?: number;
      };
      normalizedConnectionForPgTools?: {
        prismaSpecificQueryParamsStripped?: boolean;
        schemaArgUsed?: string;
        urlStoredInManifest?: boolean;
      };
    };
  } | null;
  manifestJson?: string;
};

type BackupStatus = {
  ok: boolean;
  mode: string;
  restoreExecutionEnabled: boolean;
  backupRootDisplay: string;
  latestBackupPath: string;
  latestBackupDisplay: string;
  backupAlertState?: {
    mode: string;
    displayPath: string;
    exists: boolean;
    lastAlert: {
      kind?: string;
      key?: string;
      sentAt?: string;
      subject?: string;
      to?: string;
      recipients?: string[];
      dryRun?: boolean;
    } | null;
    duplicateSuppressionActive: boolean;
    safety: {
      readOnly: boolean;
      sendEmail: boolean;
      restoreExecution: boolean;
      backupDeletion: boolean;
      retentionCleanup: boolean;
      clioWrite: boolean;
      documentGeneration: boolean;
      printQueueMutation: boolean;
    };
  };
  backupLogArchivePreview?: {
    mode: string;
    previewOnly: boolean;
    archiveExecutionEnabled: boolean;
    stdout: {
      displayPath: string;
      exists: boolean;
      sizeBytes: number;
      lineCount: number;
      containsOldErrors: boolean;
      lastMonitoredSuccessLine: string;
      lastErrorLine: string;
      proposedArchiveDisplayPath: string;
    };
    stderr: {
      displayPath: string;
      exists: boolean;
      sizeBytes: number;
      lineCount: number;
      containsOldErrors: boolean;
      lastMonitoredSuccessLine: string;
      lastErrorLine: string;
      proposedArchiveDisplayPath: string;
    };
    safety: {
      readOnly: boolean;
      archiveExecution: boolean;
      truncateLog: boolean;
      moveLog: boolean;
      deleteLog: boolean;
      restoreExecution: boolean;
      backupDeletion: boolean;
      retentionCleanup: boolean;
      sendAlert: boolean;
      clioWrite: boolean;
      documentGeneration: boolean;
      printQueueMutation: boolean;
    };
  };
  scheduledBackupHealth?: {
    mode: string;
    expectedIntervalSeconds: number;
    scheduledWarningThresholdMinutes: number;
    latestBackupAgeHours: number | null;
    latestBackupWithinExpectedWindow: boolean;
    retentionPolicy: {
      intervalSeconds?: number;
      recentAllBackupsHours?: number;
      dailyBackupsDays?: number;
      description?: string;
    } | null;
    logs: {
      out: {
        displayPath: string;
        exists: boolean;
        tail: string[];
      };
      err: {
        displayPath: string;
        exists: boolean;
        tail: string[];
      };
    };
    safety: {
      readOnly: boolean;
      retentionDeletion: boolean;
      restoreExecution: boolean;
      clioWrite: boolean;
      email: boolean;
      documentGeneration: boolean;
      printQueueMutation: boolean;
    };
  };
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
  message?: string;
  archivedDisplayPath?: string;
  freshLogDisplayPath?: string;
  originalSizeBytes?: number;
};

type BackupHealthWarning = {
  level: "warning" | "danger";
  message: string;
};

type BackupCompareWarning = {
  level: "warning" | "danger";
  message: string;
};

type BackupCompareRow = {
  label: string;
  baseline: React.ReactNode;
  comparison: React.ReactNode;
  differs: boolean;
};

type BackupAuditSummary = {
  latestBackupCreatedAt: string;
  latestBackupAge: string;
  recentBackupCount: number;
  missingManifestCount: number;
  missingDumpCount: number;
  missingSchemaCount: number;
  missingArchiveListCount: number;
  distinctGitHeadCount: number;
  scheduledBackupWithinExpectedWindow: boolean | null;
  retentionIntervalSeconds: number | string;
  recentAllBackupsHours: number | string;
  dailyBackupsDays: number | string;
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 22,
  padding: 20,
  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.07)",
};

const buttonStyle: React.CSSProperties = {
  border: "1px solid #00346e",
  background: "#00346e",
  color: "#ffffff",
  borderRadius: 14,
  padding: "11px 15px",
  fontWeight: 950,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#00346e",
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

function backupNameFromUrl(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("backup") || "";
}

function baselineBackupNameFromUrl(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("baseline") || "";
}

function comparisonBackupNameFromUrl(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("compare") || "";
}

function adminBackupRestoreUrlForState(backupName: string, baselineName: string, comparisonName: string): string {
  const params = new URLSearchParams();

  if (backupName) {
    params.set("backup", backupName);
  }

  if (baselineName) {
    params.set("baseline", baselineName);
  }

  if (comparisonName) {
    params.set("compare", comparisonName);
  }

  return params.toString() ? `/admin/backup-restore?${params.toString()}` : "/admin/backup-restore";
}

function adminBackupRestoreUrlForBackup(backupName: string): string {
  return adminBackupRestoreUrlForState(backupName, baselineBackupNameFromUrl(), comparisonBackupNameFromUrl());
}

function backupNameFromPath(value: string): string {
  return String(value || "").split("/").filter(Boolean).pop() || "";
}

function detailRow(label: string, value: React.ReactNode) {
  return (
    <tr key={label} style={{ borderBottom: "1px solid #f1f5f9" }}>
      <td style={{ padding: "9px 8px", fontWeight: 950, width: 260, verticalAlign: "top" }}>{label}</td>
      <td style={{ padding: "9px 8px", color: "#385a83", wordBreak: "break-word", verticalAlign: "top" }}>{value ?? "—"}</td>
    </tr>
  );
}

function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (value < 1) return `${Math.round(value * 60)} minutes`;
  return `${value.toFixed(1)} hours`;
}

function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function backupIsOlderThanHours(createdAt: string, hours: number): boolean {
  if (!createdAt) return true;

  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return true;

  return Date.now() - created > hours * 60 * 60 * 1000;
}

function backupCompareValue(value: unknown): string {
  if (value === true) return "YES";
  if (value === false) return "NO";
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function buildBackupCompareRows(baseline: BackupRow | null, comparison: BackupRow | null): BackupCompareRow[] {
  const rows: Array<[string, unknown, unknown]> = [
    ["Created", formatDate(baseline?.createdAt || ""), formatDate(comparison?.createdAt || "")],
    ["Git head", baseline?.gitHead || "", comparison?.gitHead || ""],
    ["Hostname", baseline?.hostname || "", comparison?.hostname || ""],
    ["Platform", baseline?.platform || "", comparison?.platform || ""],
    ["Database kind", baseline?.databaseKind || "", comparison?.databaseKind || ""],
    ["Archive entries", baseline?.archiveEntries ?? "", comparison?.archiveEntries ?? ""],
    ["Tables", baseline?.tableCount ?? "", comparison?.tableCount ?? ""],
    ["Table data", baseline?.manifest?.database?.postgresArchiveCounts?.tableData ?? "", comparison?.manifest?.database?.postgresArchiveCounts?.tableData ?? ""],
    ["Indexes", baseline?.indexCount ?? "", comparison?.indexCount ?? ""],
    ["Constraints", baseline?.manifest?.database?.postgresArchiveCounts?.constraints ?? "", comparison?.manifest?.database?.postgresArchiveCounts?.constraints ?? ""],
    ["Sequences", baseline?.manifest?.database?.postgresArchiveCounts?.sequences ?? "", comparison?.manifest?.database?.postgresArchiveCounts?.sequences ?? ""],
    ["Manifest present", baseline?.hasManifest ?? "", comparison?.hasManifest ?? ""],
    ["database.dump present", baseline?.hasDatabaseDump ?? "", comparison?.hasDatabaseDump ?? ""],
    ["schema.sql present", baseline?.hasSchemaSql ?? "", comparison?.hasSchemaSql ?? ""],
    ["archive-list.txt present", baseline?.hasArchiveList ?? "", comparison?.hasArchiveList ?? ""],
    ["Uses pg_dump", baseline?.manifest?.databasePolicy?.usesPgDump ?? "", comparison?.manifest?.databasePolicy?.usesPgDump ?? ""],
    ["Future Prisma models included", baseline?.manifest?.databasePolicy?.futurePrismaModelsIncludedAutomatically ?? "", comparison?.manifest?.databasePolicy?.futurePrismaModelsIncludedAutomatically ?? ""],
    ["Future indexes included", baseline?.manifest?.databasePolicy?.futureDatabaseIndexesIncludedAutomatically ?? "", comparison?.manifest?.databasePolicy?.futureDatabaseIndexesIncludedAutomatically ?? ""],
    ["Uses Prisma client", baseline?.manifest?.databasePolicy?.usesPrismaClient ?? "", comparison?.manifest?.databasePolicy?.usesPrismaClient ?? ""],
    ["Backs up actual document folders", baseline?.manifest?.documentFilePolicy?.backsUpActualDocumentFolders ?? "", comparison?.manifest?.documentFilePolicy?.backsUpActualDocumentFolders ?? ""],
    ["Pulls documents from Clio", baseline?.manifest?.documentFilePolicy?.pullsDocumentsFromClio ?? "", comparison?.manifest?.documentFilePolicy?.pullsDocumentsFromClio ?? ""],
    ["Document vault", baseline?.manifest?.documentFilePolicy?.documentVault || "", comparison?.manifest?.documentFilePolicy?.documentVault || ""],
    ["Password stored in manifest", baseline?.manifest?.database?.safeConnectionInfo?.passwordStoredInManifest ?? "", comparison?.manifest?.database?.safeConnectionInfo?.passwordStoredInManifest ?? ""],
  ];

  return rows.map(([label, baselineValue, comparisonValue]) => {
    const baselineText = backupCompareValue(baselineValue);
    const comparisonText = backupCompareValue(comparisonValue);

    return {
      label,
      baseline: baselineText,
      comparison: comparisonText,
      differs: baselineText !== comparisonText,
    };
  });
}

function backupAuditSummary(status: BackupStatus | null): BackupAuditSummary {
  const backups = status?.backups || [];
  const gitHeads = new Set(backups.map((backup) => backup.gitHead).filter(Boolean));

  return {
    latestBackupCreatedAt: status?.latestManifest?.createdAt || "",
    latestBackupAge: formatHours(status?.scheduledBackupHealth?.latestBackupAgeHours),
    recentBackupCount: backups.length,
    missingManifestCount: backups.filter((backup) => !backup.hasManifest).length,
    missingDumpCount: backups.filter((backup) => !backup.hasDatabaseDump).length,
    missingSchemaCount: backups.filter((backup) => !backup.hasSchemaSql).length,
    missingArchiveListCount: backups.filter((backup) => !backup.hasArchiveList).length,
    distinctGitHeadCount: gitHeads.size,
    scheduledBackupWithinExpectedWindow: status?.scheduledBackupHealth?.latestBackupWithinExpectedWindow ?? null,
    retentionIntervalSeconds: status?.scheduledBackupHealth?.retentionPolicy?.intervalSeconds ?? "—",
    recentAllBackupsHours: status?.scheduledBackupHealth?.retentionPolicy?.recentAllBackupsHours ?? "—",
    dailyBackupsDays: status?.scheduledBackupHealth?.retentionPolicy?.dailyBackupsDays ?? "—",
  };
}

function backupAuditFlags(backup: BackupRow): string {
  const flags = [];

  if (!backup.hasManifest) flags.push("missing manifest");
  if (!backup.hasDatabaseDump) flags.push("missing dump");
  if (!backup.hasSchemaSql) flags.push("missing schema");
  if (!backup.hasArchiveList) flags.push("missing archive-list");

  return flags.length ? flags.join("; ") : "OK";
}

function buildBackupAuditReport(status: BackupStatus | null): string {
  const summary = backupAuditSummary(status);
  const backups = status?.backups || [];

  const lines = [
    "Barsh Matters Backup Audit Report",
    `Generated: ${new Date().toISOString()}`,
    "",
    "Summary",
    `Latest backup created: ${summary.latestBackupCreatedAt || "—"}`,
    `Latest backup age: ${summary.latestBackupAge}`,
    `Recent backups listed: ${summary.recentBackupCount}`,
    `Missing manifest: ${summary.missingManifestCount}`,
    `Missing database.dump: ${summary.missingDumpCount}`,
    `Missing schema.sql: ${summary.missingSchemaCount}`,
    `Missing archive-list.txt: ${summary.missingArchiveListCount}`,
    `Distinct git heads: ${summary.distinctGitHeadCount}`,
    `Scheduled backup within expected window: ${backupCompareValue(summary.scheduledBackupWithinExpectedWindow)}`,
    `Retention interval seconds: ${summary.retentionIntervalSeconds}`,
    `Recent all-backups hours: ${summary.recentAllBackupsHours}`,
    `Daily backups days: ${summary.dailyBackupsDays}`,
    "",
    "Backups",
    [
      "name",
      "createdAt",
      "gitHead",
      "tables",
      "indexes",
      "archiveEntries",
      "manifest",
      "dump",
      "schema",
      "archiveList",
      "flags",
    ].join("\t"),
  ];

  for (const backup of backups) {
    lines.push([
      backup.name,
      backup.createdAt || "",
      backup.gitHead || "",
      backup.tableCount ?? "",
      backup.indexCount ?? "",
      backup.archiveEntries ?? "",
      backup.hasManifest ? "YES" : "NO",
      backup.hasDatabaseDump ? "YES" : "NO",
      backup.hasSchemaSql ? "YES" : "NO",
      backup.hasArchiveList ? "YES" : "NO",
      backupAuditFlags(backup),
    ].join("\t"));
  }

  return lines.join("\n");
}

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function buildBackupAuditCsv(status: BackupStatus | null): string {
  const backups = status?.backups || [];
  const header = [
    "name",
    "createdAt",
    "gitHead",
    "tables",
    "indexes",
    "archiveEntries",
    "manifestPresent",
    "databaseDumpPresent",
    "schemaSqlPresent",
    "archiveListPresent",
    "flags",
  ];

  const rows = backups.map((backup) => [
    backup.name,
    backup.createdAt || "",
    backup.gitHead || "",
    backup.tableCount ?? "",
    backup.indexCount ?? "",
    backup.archiveEntries ?? "",
    backup.hasManifest ? "YES" : "NO",
    backup.hasDatabaseDump ? "YES" : "NO",
    backup.hasSchemaSql ? "YES" : "NO",
    backup.hasArchiveList ? "YES" : "NO",
    backupAuditFlags(backup),
  ]);

  return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

function backupCompareWarnings(baseline: BackupRow | null, comparison: BackupRow | null): BackupCompareWarning[] {
  const warnings: BackupCompareWarning[] = [];

  if (!baseline || !comparison) {
    warnings.push({ level: "warning", message: "Select both backups to compare." });
    return warnings;
  }

  if (baseline.path === comparison.path) {
    warnings.push({ level: "warning", message: "Baseline and comparison backups are the same backup." });
  }

  if (!baseline.hasManifest || !comparison.hasManifest) {
    warnings.push({ level: "danger", message: "One selected backup is missing a manifest." });
  }

  if (!baseline.hasDatabaseDump || !comparison.hasDatabaseDump) {
    warnings.push({ level: "danger", message: "One selected backup is missing database.dump." });
  }

  if (!baseline.hasSchemaSql || !comparison.hasSchemaSql) {
    warnings.push({ level: "danger", message: "One selected backup is missing schema.sql." });
  }

  if (!baseline.hasArchiveList || !comparison.hasArchiveList) {
    warnings.push({ level: "warning", message: "One selected backup is missing archive-list.txt." });
  }

  if ((baseline.gitHead || "") !== (comparison.gitHead || "")) {
    warnings.push({ level: "warning", message: "Git head differs between selected backups." });
  }

  if ((baseline.databaseKind || "") !== (comparison.databaseKind || "")) {
    warnings.push({ level: "danger", message: "Database kind differs between selected backups." });
  }

  if ((baseline.tableCount ?? null) !== (comparison.tableCount ?? null)) {
    warnings.push({ level: "warning", message: "Table count differs between selected backups." });
  }

  if ((baseline.indexCount ?? null) !== (comparison.indexCount ?? null)) {
    warnings.push({ level: "warning", message: "Index count differs between selected backups." });
  }

  const baselineCreated = baseline.createdAt ? new Date(baseline.createdAt).getTime() : NaN;
  const comparisonCreated = comparison.createdAt ? new Date(comparison.createdAt).getTime() : NaN;
  if (Number.isFinite(baselineCreated) && Number.isFinite(comparisonCreated)) {
    const diffHours = Math.abs(baselineCreated - comparisonCreated) / (60 * 60 * 1000);
    if (diffHours >= 24) {
      warnings.push({ level: "warning", message: "Selected backups are more than 24 hours apart." });
    }
  }

  return warnings;
}

function currentBackupHealthWarnings(status: BackupStatus | null): BackupHealthWarning[] {
  if (!status) return [];

  const warnings: BackupHealthWarning[] = [];
  const latest = status.latestManifest;
  const latestBackup = status.backups.find((backup) => backup.path === status.latestBackupPath) || status.backups[0] || null;

  if (!status.latestBackupPath) {
    warnings.push({ level: "danger", message: "No latest-backup pointer was found." });
  }

  if (!latest) {
    warnings.push({ level: "danger", message: "Latest backup manifest is missing or unreadable." });
  }

  if (latest?.createdAt && backupIsOlderThanHours(latest.createdAt, 2)) {
    warnings.push({ level: "warning", message: "Latest backup is more than 2 hours old." });
  }

  if (!latest?.database?.postgresArchiveCounts?.tables || !latest?.database?.postgresArchiveCounts?.indexes) {
    warnings.push({ level: "warning", message: "Latest backup table/index counts are missing." });
  }

  if (latestBackup) {
    if (!latestBackup.hasDatabaseDump) {
      warnings.push({ level: "danger", message: "Latest backup database.dump is missing." });
    }

    if (!latestBackup.hasSchemaSql) {
      warnings.push({ level: "danger", message: "Latest backup schema.sql is missing." });
    }

    if (!latestBackup.hasArchiveList) {
      warnings.push({ level: "warning", message: "Latest backup archive-list.txt is missing." });
    }
  }

  if (latest?.databasePolicy?.usesPgDump !== true) {
    warnings.push({ level: "danger", message: "Latest backup manifest does not confirm pg_dump usage." });
  }

  if (latest?.databasePolicy?.usesPrismaClient !== false) {
    warnings.push({ level: "warning", message: "Latest backup manifest does not confirm Prisma client is unused." });
  }

  if (latest?.documentFilePolicy?.pullsDocumentsFromClio !== false) {
    warnings.push({ level: "warning", message: "Latest backup manifest does not confirm Clio document pulling is disabled." });
  }

  return warnings;
}

export default function AdminBackupRestorePage() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBackup, setSelectedBackup] = useState("");
  const [actionBusy, setActionBusy] = useState("");
  const [message, setMessage] = useState("");
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);
  const [detailBackup, setDetailBackup] = useState<BackupRow | null>(null);
  const [archiveErrorLogConfirm, setArchiveErrorLogConfirm] = useState("");
  const [baselineBackup, setBaselineBackup] = useState("");
  const [comparisonBackup, setComparisonBackup] = useState("");

  const latestCounts = status?.latestManifest?.database?.postgresArchiveCounts;
  const healthWarnings = useMemo(() => currentBackupHealthWarnings(status), [status]);

  const selectedBackupRow = useMemo(
    () => status?.backups.find((backup) => backup.path === selectedBackup) || null,
    [selectedBackup, status?.backups]
  );

  const baselineBackupRow = useMemo(
    () => status?.backups.find((backup) => backup.path === baselineBackup) || null,
    [baselineBackup, status?.backups]
  );

  const comparisonBackupRow = useMemo(
    () => status?.backups.find((backup) => backup.path === comparisonBackup) || null,
    [comparisonBackup, status?.backups]
  );

  const backupComparisonRows = useMemo(
    () => buildBackupCompareRows(baselineBackupRow, comparisonBackupRow),
    [baselineBackupRow, comparisonBackupRow]
  );

  const backupComparisonWarnings = useMemo(
    () => backupCompareWarnings(baselineBackupRow, comparisonBackupRow),
    [baselineBackupRow, comparisonBackupRow]
  );

  const auditSummary = useMemo(() => backupAuditSummary(status), [status]);

  const restorePlanRows = useMemo(
    () => [
      ["Selected backup", selectedBackupRow?.displayPath || "—"],
      ["Created", formatDate(selectedBackupRow?.createdAt || "")],
      ["Git head", selectedBackupRow?.gitHead || "—"],
      ["Host/platform", selectedBackupRow ? `${selectedBackupRow.hostname || "—"} / ${selectedBackupRow.platform || "—"}` : "—"],
      ["Database kind", selectedBackupRow?.databaseKind || "—"],
      ["Archive entries", selectedBackupRow?.archiveEntries ?? "—"],
      ["Tables", selectedBackupRow?.tableCount ?? "—"],
      ["Indexes", selectedBackupRow?.indexCount ?? "—"],
      ["Manifest present", selectedBackupRow?.hasManifest ? "YES" : "NO"],
      ["database.dump present", selectedBackupRow?.hasDatabaseDump ? "YES" : "NO"],
      ["schema.sql present", selectedBackupRow?.hasSchemaSql ? "YES" : "NO"],
      ["archive-list.txt present", selectedBackupRow?.hasArchiveList ? "YES" : "NO"],
      ["Restore execution", "DISABLED"],
    ],
    [selectedBackupRow]
  );

  const restorePlanChecklist = [
    "Make a fresh backup immediately before any future restore.",
    "Confirm the working tree is clean before any future restore.",
    "Confirm the selected backup path and timestamp.",
    "Confirm the target database before any future restore.",
    "Use full PostgreSQL database restore only unless a separate selective-restore workflow is built.",
    "Remember that document files are not restored by this database/index backup.",
    "Restore execution must be separately approved and run through a guarded terminal workflow.",
  ];

  async function loadStatus() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/backups/status", { cache: "no-store" });
      const data = (await response.json()) as BackupStatus;

      setStatus(data);

      const urlBackupName = backupNameFromUrl();
      const urlBaselineName = baselineBackupNameFromUrl();
      const urlComparisonName = comparisonBackupNameFromUrl();
      const urlBackup = urlBackupName
        ? data.backups?.find((backup) => backup.name === urlBackupName)
        : null;
      const urlBaseline = urlBaselineName
        ? data.backups?.find((backup) => backup.name === urlBaselineName)
        : null;
      const urlComparison = urlComparisonName
        ? data.backups?.find((backup) => backup.name === urlComparisonName)
        : null;

      if (urlBackup?.path) {
        setSelectedBackup(urlBackup.path);
      } else if (!selectedBackup && data.backups?.[0]?.path) {
        setSelectedBackup(data.backups[0].path);
      }

      if (urlBaseline?.path) {
        setBaselineBackup(urlBaseline.path);
      } else if (!baselineBackup && data.backups?.[1]?.path) {
        setBaselineBackup(data.backups[1].path);
      } else if (!baselineBackup && data.backups?.[0]?.path) {
        setBaselineBackup(data.backups[0].path);
      }

      if (urlComparison?.path) {
        setComparisonBackup(urlComparison.path);
      } else if (!comparisonBackup && data.backups?.[0]?.path) {
        setComparisonBackup(data.backups[0].path);
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

  function updateSelectedBackup(nextPath: string) {
    setSelectedBackup(nextPath);

    const nextName = backupNameFromPath(nextPath);
    const nextUrl = adminBackupRestoreUrlForState(
      nextName,
      backupNameFromPath(baselineBackup),
      backupNameFromPath(comparisonBackup)
    );
    window.history.pushState({ barshMattersAdminBackupRestoreBackup: true }, "", nextUrl);
  }

  function updateBackupComparison(nextBaselinePath: string, nextComparisonPath: string) {
    setBaselineBackup(nextBaselinePath);
    setComparisonBackup(nextComparisonPath);

    const nextUrl = adminBackupRestoreUrlForState(
      backupNameFromPath(selectedBackup),
      backupNameFromPath(nextBaselinePath),
      backupNameFromPath(nextComparisonPath)
    );
    window.history.pushState({ barshMattersAdminBackupComparison: true }, "", nextUrl);
  }

  async function copySelectedBackupPath() {
    if (!selectedBackup) {
      setMessage("No backup path is selected.");
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedBackup);
      setMessage("Selected backup path copied to clipboard.");
    } catch {
      setMessage(selectedBackup);
    }
  }

  async function archiveErrorLog() {
    setActionBusy("archive-error-log");
    setMessage("Archiving launchd.err.log...");
    setActionResult(null);

    try {
      const response = await fetch("/api/admin/backups/archive-error-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: archiveErrorLogConfirm }),
      });
      const data = (await response.json()) as ActionResult;

      setActionResult(data);

      if (!response.ok || !data.ok) {
        setMessage(data.error || "Error log archive failed.");
        return;
      }

      setMessage(`Archived stderr log to ${data.archivedDisplayPath || "archive file"} and created a fresh empty launchd.err.log.`);
      setArchiveErrorLogConfirm("");
      await loadStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setActionBusy("");
    }
  }

  async function copyBackupAuditReport() {
    try {
      await navigator.clipboard.writeText(buildBackupAuditReport(status));
      setMessage("Backup audit report copied to clipboard.");
    } catch {
      setMessage(buildBackupAuditReport(status));
    }
  }

  function downloadBackupAuditCsv() {
    const csv = buildBackupAuditCsv(status);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `barsh-matters-backup-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    setMessage("Backup audit CSV generated in the browser.");
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

    function applySelectedBackupFromUrl() {
      const urlBackupName = backupNameFromUrl();
      const urlBaselineName = baselineBackupNameFromUrl();
      const urlComparisonName = comparisonBackupNameFromUrl();

      setStatus((current) => {
        const urlBackup = current?.backups.find((backup) => backup.name === urlBackupName);
        const urlBaseline = current?.backups.find((backup) => backup.name === urlBaselineName);
        const urlComparison = current?.backups.find((backup) => backup.name === urlComparisonName);

        if (urlBackup?.path) {
          setSelectedBackup(urlBackup.path);
        }

        if (urlBaseline?.path) {
          setBaselineBackup(urlBaseline.path);
        }

        if (urlComparison?.path) {
          setComparisonBackup(urlComparison.path);
        }

        return current;
      });
    }

    window.addEventListener("popstate", applySelectedBackupFromUrl);

    return () => {
      window.removeEventListener("popstate", applySelectedBackupFromUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main
      data-barsh-admin-backup-restore="true"
      data-restore-execution-enabled="false"
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#00346e",
        padding: "28px 30px 46px",
        boxSizing: "border-box",
      }}
    >
      <BarshHeader />
      <div style={{ maxWidth: "none", margin: 0, display: "grid", gap: 18 }}>
        <header style={{ ...cardStyle, display: "grid", gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 950, color: "#00346e", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Administrator
          </div>
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1 }}>Backup / Restore</h1>
          <p style={{ margin: 0, color: "#385a83", lineHeight: 1.45, maxWidth: 960 }}>
            Run a manual local Barsh Matters database/index backup, review recent backups, and run a restore preview.  Restore execution is intentionally disabled in this UI and requires a separate approved guarded workflow.
          </p>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <div style={cardStyle}>
            <div style={{ fontSize: 13, fontWeight: 950, color: "#385a83", textTransform: "uppercase" }}>Latest Backup</div>
            <div style={{ marginTop: 8, fontSize: 18, fontWeight: 950 }}>
              {loading ? "Loading..." : formatDate(status?.latestManifest?.createdAt || "")}
            </div>
            <div style={{ marginTop: 8, color: "#385a83", lineHeight: 1.45, wordBreak: "break-word" }}>
              {status?.latestBackupDisplay || "No latest backup pointer found."}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 13, fontWeight: 950, color: "#385a83", textTransform: "uppercase" }}>Database Snapshot</div>
            <div style={{ marginTop: 8, display: "grid", gap: 5, color: "#385a83", lineHeight: 1.45 }}>
              <div><strong>Kind:</strong> {status?.latestManifest?.database?.kind || "—"}</div>
              <div><strong>Tables:</strong> {latestCounts?.tables ?? "—"}</div>
              <div><strong>Indexes:</strong> {latestCounts?.indexes ?? "—"}</div>
              <div><strong>Archive entries:</strong> {latestCounts?.archiveEntries ?? "—"}</div>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 13, fontWeight: 950, color: "#385a83", textTransform: "uppercase" }}>Safety Contract</div>
            <div style={{ marginTop: 8, display: "grid", gap: 5, color: "#385a83", lineHeight: 1.45 }}>
              <div><strong>Uses pg_dump:</strong> {passFail(status?.latestManifest?.databasePolicy?.usesPgDump)}</div>
              <div><strong>Uses Prisma client:</strong> {passFail(status?.latestManifest?.databasePolicy?.usesPrismaClient)}</div>
              <div><strong>Pulls docs from Clio:</strong> {passFail(status?.latestManifest?.documentFilePolicy?.pullsDocumentsFromClio)}</div>
              <div><strong>Restore execution:</strong> DISABLED</div>
            </div>
          </div>
        </section>

        <section
          style={{ ...cardStyle, display: "grid", gap: 14 }}
          data-backup-log-archive-preview="read-only"
          data-log-archive-execution-enabled="false"
          data-log-truncate-enabled="false"
          data-log-delete-enabled="false"
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>Backup Log Archive Preview</h2>
            <p style={{ margin: "6px 0 0", color: "#385a83", lineHeight: 1.45 }}>
              Preview for cleaning up old scheduled-backup log noise.  This section shows log health, old-error presence, file size, line count, and proposed archive names.
            </p>
          </div>

          <div
            style={{
              border: "1px solid #fde68a",
              background: "#fffbeb",
              color: "#92400e",
              borderRadius: 16,
              padding: 13,
              lineHeight: 1.45,
              fontWeight: 850,
            }}
          >
            Old stderr errors may remain visible even after the monitored scheduled backups are healthy.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
            {[
              ["stdout", status?.backupLogArchivePreview?.stdout],
              ["stderr", status?.backupLogArchivePreview?.stderr],
            ].map(([kind, log]: any) => (
              <div
                key={kind}
                style={{
                  border: log?.containsOldErrors ? "1px solid #fde68a" : "1px solid #bbf7d0",
                  background: log?.containsOldErrors ? "#fffbeb" : "#f0fdf4",
                  color: log?.containsOldErrors ? "#92400e" : "#166534",
                  borderRadius: 16,
                  padding: 13,
                  display: "grid",
                  gap: 7,
                  lineHeight: 1.45,
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 950 }}>{String(kind).toUpperCase()} Log</div>
                <div><strong>Path:</strong> {log?.displayPath || "—"}</div>
                <div><strong>Exists:</strong> {log?.exists ? "YES" : "NO"}</div>
                <div><strong>Size:</strong> {formatBytes(log?.sizeBytes)}</div>
                <div><strong>Line count:</strong> {log?.lineCount ?? "—"}</div>
                <div><strong>Old errors present:</strong> {log?.containsOldErrors ? "YES" : "NO"}</div>
                <div><strong>Last monitored success:</strong> {log?.lastMonitoredSuccessLine || "—"}</div>
                <div><strong>Last error line:</strong> {log?.lastErrorLine || "—"}</div>
                <div><strong>Proposed archive:</strong> {log?.proposedArchiveDisplayPath || "—"}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              border: "1px solid #dbeafe",
              background: "#eff6ff",
              color: "#00346e",
              borderRadius: 16,
              padding: 13,
              lineHeight: 1.45,
              fontWeight: 850,
              display: "grid",
              gap: 12,
            }}
            data-stderr-log-archive-action="guarded"
            data-stdout-log-archive-enabled="false"
            data-backup-deletion-enabled="false"
          >
            <div>
              Guarded action: archive <strong>launchd.err.log only</strong>. This moves the current stderr log to a timestamped archive and creates a fresh empty stderr log.
            </div>

            <label style={{ display: "grid", gap: 6, fontWeight: 950 }}>
              Type ARCHIVE ERROR LOG to enable
              <input
                value={archiveErrorLogConfirm}
                onChange={(event) => setArchiveErrorLogConfirm(event.target.value)}
                placeholder="ARCHIVE ERROR LOG"
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 14,
                  padding: 12,
                  fontWeight: 850,
                  color: "#00346e",
                }}
              />
            </label>

            <button
              type="button"
              onClick={() => void archiveErrorLog()}
              disabled={archiveErrorLogConfirm !== "ARCHIVE ERROR LOG" || Boolean(actionBusy)}
              data-archive-error-log-button="guarded"
              style={{
                border: "1px solid #b45309",
                background: archiveErrorLogConfirm === "ARCHIVE ERROR LOG" && !actionBusy ? "#b45309" : "#e2e8f0",
                color: archiveErrorLogConfirm === "ARCHIVE ERROR LOG" && !actionBusy ? "#ffffff" : "#385a83",
                borderRadius: 14,
                padding: "12px 15px",
                fontWeight: 950,
                cursor: archiveErrorLogConfirm === "ARCHIVE ERROR LOG" && !actionBusy ? "pointer" : "not-allowed",
                maxWidth: 280,
              }}
            >
              {actionBusy === "archive-error-log" ? "Archiving Error Log..." : "Archive Error Log"}
            </button>
          </div>
        </section>

        <section
          style={{ ...cardStyle, display: "grid", gap: 14 }}
          data-backup-alert-state="read-only"
          data-send-alert-enabled="false"
          data-alert-state-file-write-enabled="false"
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>Backup Alert State</h2>
            <p style={{ margin: "6px 0 0", color: "#385a83", lineHeight: 1.45 }}>
              Alert state from the monitored backup wrapper.  This panel shows the last alert and duplicate-suppression state.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {[
              ["State file", status?.backupAlertState?.displayPath || "—"],
              ["State file exists", status?.backupAlertState?.exists ? "YES" : "NO"],
              ["Last alert kind", status?.backupAlertState?.lastAlert?.kind || "—"],
              ["Last alert sent", formatDate(status?.backupAlertState?.lastAlert?.sentAt || "")],
              ["Subject", status?.backupAlertState?.lastAlert?.subject || "—"],
              ["Dry run", passFail(status?.backupAlertState?.lastAlert?.dryRun)],
              ["Duplicate suppression active", status?.backupAlertState?.duplicateSuppressionActive ? "YES" : "NO"],
              ["Send controls", "DISABLED"],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                style={{
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  borderRadius: 16,
                  padding: 13,
                  display: "grid",
                  gap: 5,
                }}
              >
                <div style={{ color: "#385a83", fontSize: 12, fontWeight: 950, textTransform: "uppercase" }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 950, wordBreak: "break-word" }}>{String(value ?? "—")}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              border: "1px solid #dbeafe",
              background: "#eff6ff",
              color: "#00346e",
              borderRadius: 16,
              padding: 13,
              lineHeight: 1.45,
              fontWeight: 850,
            }}
          >
            <strong>Recipients:</strong>{" "}
            {(status?.backupAlertState?.lastAlert?.recipients || []).length
              ? status?.backupAlertState?.lastAlert?.recipients?.join(", ")
              : status?.backupAlertState?.lastAlert?.to || "No prior alert recipients recorded."}
          </div>

          <div
            style={{
              border: "1px solid #e5e7eb",
              background: "#f8fafc",
              color: "#385a83",
              borderRadius: 16,
              padding: 13,
              lineHeight: 1.45,
              fontWeight: 850,
            }}
          >
            Duplicate suppression uses the stored alert key from the last sent alert.  A repeated failure or stale condition with the same key is suppressed until the condition changes or a forced/manual test is run.
          </div>
        </section>

        <section
          style={{ ...cardStyle, display: "grid", gap: 14 }}
          data-scheduled-backup-health="read-only"
          data-retention-deletion-enabled="false"
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>Scheduled Backup Health</h2>
            <p style={{ margin: "6px 0 0", color: "#385a83", lineHeight: 1.45 }}>
              Visibility for the scheduled local database/index backup system.  This section reads backup status, retention policy, and recent backup logs.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            <div
              style={{
                border: status?.scheduledBackupHealth?.latestBackupWithinExpectedWindow ? "1px solid #bbf7d0" : "1px solid #fde68a",
                background: status?.scheduledBackupHealth?.latestBackupWithinExpectedWindow ? "#f0fdf4" : "#fffbeb",
                color: status?.scheduledBackupHealth?.latestBackupWithinExpectedWindow ? "#166534" : "#92400e",
                borderRadius: 16,
                padding: 13,
                fontWeight: 900,
                lineHeight: 1.45,
              }}
            >
              <div>Latest backup age</div>
              <div style={{ fontSize: 20, marginTop: 4 }}>
                {formatHours(status?.scheduledBackupHealth?.latestBackupAgeHours)}
              </div>
              <div style={{ marginTop: 4, fontSize: 13 }}>
                Warning threshold: {status?.scheduledBackupHealth?.scheduledWarningThresholdMinutes ?? "—"} minutes.
              </div>
            </div>

            <div
              style={{
                border: "1px solid #dbeafe",
                background: "#eff6ff",
                color: "#00346e",
                borderRadius: 16,
                padding: 13,
                fontWeight: 900,
                lineHeight: 1.45,
              }}
            >
              <div>Expected interval</div>
              <div style={{ fontSize: 20, marginTop: 4 }}>
                {status?.scheduledBackupHealth?.expectedIntervalSeconds ?? "—"} seconds
              </div>
              <div style={{ marginTop: 4, fontSize: 13 }}>
                Based on the backup manifest retention policy.
              </div>
            </div>

            <div
              style={{
                border: "1px solid #e5e7eb",
                background: "#fff",
                color: "#385a83",
                borderRadius: 16,
                padding: 13,
                fontWeight: 900,
                lineHeight: 1.45,
              }}
            >
              <div>Retention policy</div>
              <div style={{ marginTop: 6, display: "grid", gap: 3, fontSize: 13 }}>
                <div>Recent all-backups hours: {status?.scheduledBackupHealth?.retentionPolicy?.recentAllBackupsHours ?? "—"}</div>
                <div>Daily backups days: {status?.scheduledBackupHealth?.retentionPolicy?.dailyBackupsDays ?? "—"}</div>
                <div>Deletion controls: DISABLED</div>
              </div>
            </div>
          </div>

          {status?.scheduledBackupHealth?.retentionPolicy?.description && (
            <div
              style={{
                border: "1px solid #e0e7ff",
                background: "#eef2ff",
                color: "#00346e",
                borderRadius: 16,
                padding: 13,
                lineHeight: 1.45,
                fontWeight: 850,
              }}
            >
              {status.scheduledBackupHealth.retentionPolicy.description}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
            {[
              ["Scheduled backup stdout log", status?.scheduledBackupHealth?.logs?.out],
              ["Scheduled backup stderr log", status?.scheduledBackupHealth?.logs?.err],
            ].map(([title, log]: any) => (
              <div key={title} style={{ border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden" }}>
                <div
                  style={{
                    background: "#f8fafc",
                    borderBottom: "1px solid #e5e7eb",
                    padding: 12,
                    fontWeight: 950,
                    display: "grid",
                    gap: 4,
                  }}
                >
                  <span>{title}</span>
                  <span style={{ color: "#385a83", fontSize: 12, wordBreak: "break-word" }}>
                    {log?.displayPath || "—"}; exists: {log?.exists ? "YES" : "NO"}
                  </span>
                </div>
                <pre
                  style={{
                    margin: 0,
                    padding: 12,
                    minHeight: 160,
                    maxHeight: 260,
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                    background: "#00346e",
                    color: "#e2e8f0",
                    fontSize: 12,
                    lineHeight: 1.45,
                  }}
                >
                  {(log?.tail || []).length ? log.tail.join("\n") : "No recent log lines found."}
                </pre>
              </div>
            ))}
          </div>
        </section>

        <section style={{ ...cardStyle, display: "grid", gap: 14 }} data-backup-health-warnings="display-only">
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>Backup Health</h2>
            <p style={{ margin: "6px 0 0", color: "#385a83", lineHeight: 1.45 }}>
              Warnings based on the latest local backup manifest and backup files.
            </p>
          </div>
          {healthWarnings.length === 0 ? (
            <div
              style={{
                border: "1px solid #bbf7d0",
                background: "#f0fdf4",
                color: "#166534",
                borderRadius: 16,
                padding: 13,
                fontWeight: 900,
              }}
            >
              No backup health warnings detected.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {healthWarnings.map((warning, index) => (
                <div
                  key={`${warning.level}-${index}-${warning.message}`}
                  style={{
                    border: warning.level === "danger" ? "1px solid #fecaca" : "1px solid #fde68a",
                    background: warning.level === "danger" ? "#fff1f2" : "#fffbeb",
                    color: warning.level === "danger" ? "#9f1239" : "#92400e",
                    borderRadius: 16,
                    padding: 13,
                    fontWeight: 900,
                    lineHeight: 1.45,
                  }}
                >
                  {warning.message}
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={{ ...cardStyle, display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22 }}>Manual Backup</h2>
              <p style={{ margin: "6px 0 0", color: "#385a83", lineHeight: 1.45 }}>
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
            <p style={{ margin: "6px 0 0", color: "#385a83", lineHeight: 1.45 }}>
              Select a backup and run the existing restore preview script.  This displays what would be reviewed before a guarded restore.
            </p>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <label htmlFor="backup-select" style={{ fontWeight: 950 }}>Backup to preview</label>
            <select
              id="backup-select"
              value={selectedBackup}
              onChange={(event) => updateSelectedBackup(event.target.value)}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 14,
                padding: 12,
                fontWeight: 850,
                background: "#fff",
                color: "#00346e",
              }}
            >
              {(status?.backups || []).map((backup) => (
                <option key={backup.path} value={backup.path}>
                  {backup.name} — {backup.displayPath}
                </option>
              ))}
            </select>
            {selectedBackupRow && (
              <div style={{ color: "#385a83", lineHeight: 1.45 }}>
                Selected: {formatDate(selectedBackupRow.createdAt || selectedBackupRow.modifiedAt)}; git {shortHead(selectedBackupRow.gitHead)}; tables {selectedBackupRow.tableCount ?? "—"}; indexes {selectedBackupRow.indexCount ?? "—"}.
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => void copySelectedBackupPath()} style={secondaryButtonStyle} disabled={!selectedBackup || Boolean(actionBusy)}>
              Copy Backup Path
            </button>
            <button type="button" onClick={() => void runRestorePreview()} style={buttonStyle} disabled={!selectedBackup || Boolean(actionBusy)}>
              {actionBusy === "restore-preview" ? "Running Preview..." : "Run Restore Preview"}
            </button>
          </div>
        </section>

        <section
          style={{ ...cardStyle, display: "grid", gap: 14 }}
          data-guarded-restore-plan-preview="true"
          data-restore-execution-enabled="false"
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>Guarded Restore Plan Preview</h2>
            <p style={{ margin: "6px 0 0", color: "#385a83", lineHeight: 1.45 }}>
              This section summarizes the selected backup and the required future restore checklist.
            </p>
          </div>

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
            Restore execution is intentionally unavailable in the UI.  A restore must be separately approved and run through a guarded terminal workflow.
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#385a83", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "10px 8px", width: 220 }}>Restore-plan field</th>
                  <th style={{ padding: "10px 8px" }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {restorePlanRows.map(([label, value]) => (
                  <tr key={label} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 8px", fontWeight: 950 }}>{label}</td>
                    <td style={{ padding: "10px 8px", wordBreak: "break-word", color: "#385a83" }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>Pre-Restore Checklist</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {restorePlanChecklist.map((item) => (
                <div
                  key={item}
                  style={{
                    border: "1px solid #dbeafe",
                    background: "#eff6ff",
                    color: "#00346e",
                    borderRadius: 14,
                    padding: 12,
                    lineHeight: 1.45,
                    fontWeight: 850,
                  }}
                >
                  □ {item}
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled
            aria-disabled="true"
            data-restore-execution-button="disabled"
            style={{
              border: "1px solid #cbd5e1",
              background: "#e2e8f0",
              color: "#385a83",
              borderRadius: 14,
              padding: "12px 15px",
              fontWeight: 950,
              cursor: "not-allowed",
              maxWidth: 280,
            }}
          >
            Restore Execution Disabled
          </button>
        </section>

        <section
          style={{ ...cardStyle, display: "grid", gap: 14 }}
          data-backup-comparison-preview="read-only"
          data-backup-comparison-url-state="true"
          data-restore-execution-enabled="false"
          data-backup-deletion-enabled="false"
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>Compare Backups</h2>
            <p style={{ margin: "6px 0 0", color: "#385a83", lineHeight: 1.45 }}>
              Comparison preview for two backup manifests.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <label htmlFor="baseline-backup-select" style={{ fontWeight: 950 }}>Baseline backup</label>
              <select
                id="baseline-backup-select"
                value={baselineBackup}
                onChange={(event) => updateBackupComparison(event.target.value, comparisonBackup)}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 14,
                  padding: 12,
                  fontWeight: 850,
                  background: "#fff",
                  color: "#00346e",
                }}
              >
                {(status?.backups || []).map((backup) => (
                  <option key={backup.path} value={backup.path}>
                    {backup.name} — {backup.displayPath}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <label htmlFor="comparison-backup-select" style={{ fontWeight: 950 }}>Comparison backup</label>
              <select
                id="comparison-backup-select"
                value={comparisonBackup}
                onChange={(event) => updateBackupComparison(baselineBackup, event.target.value)}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 14,
                  padding: 12,
                  fontWeight: 850,
                  background: "#fff",
                  color: "#00346e",
                }}
              >
                {(status?.backups || []).map((backup) => (
                  <option key={backup.path} value={backup.path}>
                    {backup.name} — {backup.displayPath}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {backupComparisonWarnings.map((warning, index) => (
              <div
                key={`${warning.level}-${index}-${warning.message}`}
                style={{
                  border: warning.level === "danger" ? "1px solid #fecaca" : "1px solid #fde68a",
                  background: warning.level === "danger" ? "#fff1f2" : "#fffbeb",
                  color: warning.level === "danger" ? "#9f1239" : "#92400e",
                  borderRadius: 16,
                  padding: 13,
                  fontWeight: 900,
                  lineHeight: 1.45,
                }}
              >
                {warning.message}
              </div>
            ))}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#385a83", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "10px 8px", width: 260 }}>Field</th>
                  <th style={{ padding: "10px 8px" }}>Baseline</th>
                  <th style={{ padding: "10px 8px" }}>Comparison</th>
                  <th style={{ padding: "10px 8px" }}>Differs</th>
                </tr>
              </thead>
              <tbody>
                {backupComparisonRows.map((row) => (
                  <tr
                    key={row.label}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      background: row.differs ? "#fffbeb" : "#fff",
                    }}
                  >
                    <td style={{ padding: "10px 8px", fontWeight: 950 }}>{row.label}</td>
                    <td style={{ padding: "10px 8px", color: "#385a83", wordBreak: "break-word" }}>{row.baseline}</td>
                    <td style={{ padding: "10px 8px", color: "#385a83", wordBreak: "break-word" }}>{row.comparison}</td>
                    <td style={{ padding: "10px 8px", fontWeight: 950 }}>{row.differs ? "YES" : "NO"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section
          style={{ ...cardStyle, display: "grid", gap: 14 }}
          data-backup-audit-report="read-only"
          data-client-side-csv-export="true"
          data-server-side-export-enabled="false"
          data-restore-execution-enabled="false"
          data-backup-deletion-enabled="false"
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>Backup Audit Report</h2>
            <p style={{ margin: "6px 0 0", color: "#385a83", lineHeight: 1.45 }}>
              Audit report generated from the backup metadata already loaded on this page.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {[
              ["Latest backup", formatDate(auditSummary.latestBackupCreatedAt)],
              ["Latest backup age", auditSummary.latestBackupAge],
              ["Recent backups listed", auditSummary.recentBackupCount],
              ["Missing manifest", auditSummary.missingManifestCount],
              ["Missing dump", auditSummary.missingDumpCount],
              ["Missing schema", auditSummary.missingSchemaCount],
              ["Missing archive-list", auditSummary.missingArchiveListCount],
              ["Distinct git heads", auditSummary.distinctGitHeadCount],
              ["Scheduled within window", backupCompareValue(auditSummary.scheduledBackupWithinExpectedWindow)],
              ["Retention interval seconds", auditSummary.retentionIntervalSeconds],
              ["Recent all-backups hours", auditSummary.recentAllBackupsHours],
              ["Daily backups days", auditSummary.dailyBackupsDays],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                style={{
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  borderRadius: 16,
                  padding: 13,
                  display: "grid",
                  gap: 5,
                }}
              >
                <div style={{ color: "#385a83", fontSize: 12, fontWeight: 950, textTransform: "uppercase" }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 950 }}>{String(value ?? "—")}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => void copyBackupAuditReport()} style={secondaryButtonStyle}>
              Copy Audit Report
            </button>
            <button type="button" onClick={downloadBackupAuditCsv} style={secondaryButtonStyle}>
              Download Audit CSV
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#385a83", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "10px 8px" }}>Backup</th>
                  <th style={{ padding: "10px 8px" }}>Created</th>
                  <th style={{ padding: "10px 8px" }}>Git</th>
                  <th style={{ padding: "10px 8px" }}>Tables</th>
                  <th style={{ padding: "10px 8px" }}>Indexes</th>
                  <th style={{ padding: "10px 8px" }}>Archive entries</th>
                  <th style={{ padding: "10px 8px" }}>Manifest</th>
                  <th style={{ padding: "10px 8px" }}>Dump</th>
                  <th style={{ padding: "10px 8px" }}>Schema</th>
                  <th style={{ padding: "10px 8px" }}>Archive list</th>
                  <th style={{ padding: "10px 8px" }}>Health flags</th>
                </tr>
              </thead>
              <tbody>
                {(status?.backups || []).map((backup) => (
                  <tr key={backup.path} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 8px", fontWeight: 950, wordBreak: "break-word" }}>{backup.name}</td>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{formatDate(backup.createdAt || backup.modifiedAt)}</td>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{shortHead(backup.gitHead)}</td>
                    <td style={{ padding: "10px 8px" }}>{backup.tableCount ?? "—"}</td>
                    <td style={{ padding: "10px 8px" }}>{backup.indexCount ?? "—"}</td>
                    <td style={{ padding: "10px 8px" }}>{backup.archiveEntries ?? "—"}</td>
                    <td style={{ padding: "10px 8px" }}>{backup.hasManifest ? "YES" : "NO"}</td>
                    <td style={{ padding: "10px 8px" }}>{backup.hasDatabaseDump ? "YES" : "NO"}</td>
                    <td style={{ padding: "10px 8px" }}>{backup.hasSchemaSql ? "YES" : "NO"}</td>
                    <td style={{ padding: "10px 8px" }}>{backup.hasArchiveList ? "YES" : "NO"}</td>
                    <td style={{ padding: "10px 8px", color: backupAuditFlags(backup) === "OK" ? "#166534" : "#92400e", fontWeight: 900 }}>
                      {backupAuditFlags(backup)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ ...cardStyle, display: "grid", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>Recent Backups</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#385a83", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "10px 8px" }}>Created</th>
                  <th style={{ padding: "10px 8px" }}>Path</th>
                  <th style={{ padding: "10px 8px" }}>Git</th>
                  <th style={{ padding: "10px 8px" }}>Tables</th>
                  <th style={{ padding: "10px 8px" }}>Indexes</th>
                  <th style={{ padding: "10px 8px" }}>Files</th>
                  <th style={{ padding: "10px 8px" }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {(status?.backups || []).map((backup) => (
                  <tr key={backup.path} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{formatDate(backup.createdAt || backup.modifiedAt)}</td>
                    <td style={{ padding: "10px 8px", wordBreak: "break-word", color: "#385a83" }}>{backup.displayPath}</td>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{shortHead(backup.gitHead)}</td>
                    <td style={{ padding: "10px 8px" }}>{backup.tableCount ?? "—"}</td>
                    <td style={{ padding: "10px 8px" }}>{backup.indexCount ?? "—"}</td>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>
                      {backup.hasManifest ? "manifest " : ""}
                      {backup.hasDatabaseDump ? "dump " : ""}
                      {backup.hasSchemaSql ? "schema " : ""}
                      {backup.hasArchiveList ? "archive-list" : ""}
                    </td>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        onClick={() => setDetailBackup(backup)}
                        data-backup-manifest-detail-open="true"
                        style={{
                          border: "1px solid #cbd5e1",
                          background: "#fff",
                          color: "#00346e",
                          borderRadius: 12,
                          padding: "8px 10px",
                          fontWeight: 950,
                          cursor: "pointer",
                        }}
                      >
                        View Details
                      </button>
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
              color: actionResult?.ok === false ? "#9f1239" : "#00346e",
              borderRadius: 18,
              padding: 16,
              display: "grid",
              gap: 10,
            }}
          >
            {message && <div style={{ fontWeight: 950 }}>{message}</div>}
            {actionResult?.output && (
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", overflowX: "auto", color: "#00346e" }}>
                {actionResult.output}
              </pre>
            )}
            {actionResult?.stdoutTail && (
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", overflowX: "auto", color: "#00346e" }}>
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

        {detailBackup && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Backup manifest detail"
            data-backup-manifest-detail-modal="read-only"
            data-restore-execution-enabled="false"
            data-backup-deletion-enabled="false"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "rgba(15, 23, 42, 0.46)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              padding: "42px 22px",
              overflow: "auto",
            }}
          >
            <div
              style={{
                width: "min(1120px, 96vw)",
                maxHeight: "calc(100vh - 84px)",
                overflow: "auto",
                background: "#fff",
                borderRadius: 24,
                border: "1px solid #e5e7eb",
                boxShadow: "0 28px 70px rgba(15, 23, 42, 0.32)",
                padding: 22,
                display: "grid",
                gap: 16,
              }}
            >
              <header style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 950, color: "#00346e", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Backup Manifest Detail
                </div>
                <h2 style={{ margin: 0, fontSize: 26 }}>Backup Manifest Inspector</h2>
                <p style={{ margin: 0, color: "#385a83", lineHeight: 1.45 }}>
                  Passwords and database URLs are not displayed; the manifest only reports whether a password was stored.
                </p>
              </header>

              <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden" }}>
                  <div style={{ padding: 12, background: "#f8fafc", borderBottom: "1px solid #e5e7eb", fontWeight: 950 }}>Manifest Summary</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <tbody>
                      {[
                        detailRow("Created", formatDate(detailBackup.manifest?.createdAt || detailBackup.createdAt || "")),
                        detailRow("Backup directory", detailBackup.manifest?.backupDir || detailBackup.path),
                        detailRow("Git head", detailBackup.manifest?.gitHead || detailBackup.gitHead || "—"),
                        detailRow("Host", detailBackup.manifest?.hostname || detailBackup.hostname || "—"),
                        detailRow("Platform", detailBackup.manifest?.platform || detailBackup.platform || "—"),
                        detailRow("Type", detailBackup.manifest?.type || "—"),
                      ]}
                    </tbody>
                  </table>
                </div>

                <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden" }}>
                  <div style={{ padding: 12, background: "#f8fafc", borderBottom: "1px solid #e5e7eb", fontWeight: 950 }}>Database Connection Summary</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <tbody>
                      {[
                        detailRow("Database kind", detailBackup.manifest?.database?.kind || detailBackup.databaseKind || "—"),
                        detailRow("DB source", detailBackup.manifest?.database?.safeConnectionInfo?.source || "—"),
                        detailRow("Protocol", detailBackup.manifest?.database?.safeConnectionInfo?.protocol || "—"),
                        detailRow("Host", detailBackup.manifest?.database?.safeConnectionInfo?.host || "—"),
                        detailRow("Database", detailBackup.manifest?.database?.safeConnectionInfo?.database || "—"),
                        detailRow("Username present", passFail(detailBackup.manifest?.database?.safeConnectionInfo?.usernamePresent)),
                        detailRow("Password stored in manifest", passFail(detailBackup.manifest?.database?.safeConnectionInfo?.passwordStoredInManifest)),
                        detailRow("URL stored in manifest", passFail(detailBackup.manifest?.database?.normalizedConnectionForPgTools?.urlStoredInManifest)),
                      ]}
                    </tbody>
                  </table>
                </div>
              </section>

              <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden" }}>
                  <div style={{ padding: 12, background: "#f8fafc", borderBottom: "1px solid #e5e7eb", fontWeight: 950 }}>Database Policy</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <tbody>
                      {[
                        detailRow("Uses pg_dump", passFail(detailBackup.manifest?.databasePolicy?.usesPgDump)),
                        detailRow("Uses pg_restore for preview/guarded restore", passFail(detailBackup.manifest?.databasePolicy?.usesPgRestoreForPreviewAndGuardedRestore)),
                        detailRow("Exports all tables/indexes/schema objects", passFail(detailBackup.manifest?.databasePolicy?.exportsAllPostgresTablesIndexesAndSchemaObjects)),
                        detailRow("Future Prisma models included automatically", passFail(detailBackup.manifest?.databasePolicy?.futurePrismaModelsIncludedAutomatically)),
                        detailRow("Future database indexes included automatically", passFail(detailBackup.manifest?.databasePolicy?.futureDatabaseIndexesIncludedAutomatically)),
                        detailRow("Uses Prisma client", passFail(detailBackup.manifest?.databasePolicy?.usesPrismaClient)),
                        detailRow("PostgreSQL large objects excluded", passFail(detailBackup.manifest?.databasePolicy?.excludesPostgresLargeObjects)),
                      ]}
                    </tbody>
                  </table>
                </div>

                <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden" }}>
                  <div style={{ padding: 12, background: "#f8fafc", borderBottom: "1px solid #e5e7eb", fontWeight: 950 }}>Document Policy</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <tbody>
                      {[
                        detailRow("Backs up actual document folders", passFail(detailBackup.manifest?.documentFilePolicy?.backsUpActualDocumentFolders)),
                        detailRow("Pulls documents from Clio", passFail(detailBackup.manifest?.documentFilePolicy?.pullsDocumentsFromClio)),
                        detailRow("Document vault", detailBackup.manifest?.documentFilePolicy?.documentVault || "—"),
                        detailRow("Local document metadata rows may be included", passFail(detailBackup.manifest?.documentFilePolicy?.localDocumentMetadataRowsMayBeIncluded)),
                        detailRow("PostgreSQL large objects excluded", passFail(detailBackup.manifest?.documentFilePolicy?.postgresLargeObjectsExcluded)),
                      ]}
                    </tbody>
                  </table>
                </div>
              </section>

              <section style={{ border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden" }}>
                <div style={{ padding: 12, background: "#f8fafc", borderBottom: "1px solid #e5e7eb", fontWeight: 950 }}>Archive Counts</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <tbody>
                    {[
                      detailRow("Archive entries", detailBackup.manifest?.database?.postgresArchiveCounts?.archiveEntries ?? detailBackup.archiveEntries ?? "—"),
                      detailRow("Tables", detailBackup.manifest?.database?.postgresArchiveCounts?.tables ?? detailBackup.tableCount ?? "—"),
                      detailRow("Table data", detailBackup.manifest?.database?.postgresArchiveCounts?.tableData ?? "—"),
                      detailRow("Indexes", detailBackup.manifest?.database?.postgresArchiveCounts?.indexes ?? detailBackup.indexCount ?? "—"),
                      detailRow("Constraints", detailBackup.manifest?.database?.postgresArchiveCounts?.constraints ?? "—"),
                      detailRow("Sequences", detailBackup.manifest?.database?.postgresArchiveCounts?.sequences ?? "—"),
                    ]}
                  </tbody>
                </table>
              </section>

              <section style={{ border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden" }}>
                <div style={{ padding: 12, background: "#f8fafc", borderBottom: "1px solid #e5e7eb", fontWeight: 950 }}>Raw Manifest JSON</div>
                <pre
                  data-raw-manifest-json="read-only"
                  style={{
                    margin: 0,
                    padding: 12,
                    maxHeight: 360,
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                    background: "#00346e",
                    color: "#e2e8f0",
                    fontSize: 12,
                    lineHeight: 1.45,
                  }}
                >
                  {detailBackup.manifestJson || "Manifest JSON is unavailable."}
                </pre>
              </section>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setDetailBackup(null)}
                  style={{
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    color: "#00346e",
                    borderRadius: 14,
                    padding: "11px 15px",
                    fontWeight: 950,
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <section
          style={{
            border: "1px solid #dbeafe",
            background: "#eff6ff",
            color: "#00346e",
            borderRadius: 18,
            padding: 16,
            lineHeight: 1.45,
          }}
        >
          <strong>Safety:</strong> Restore execution remains deferred.  The UI exposes only backup creation, backup status/listing, and restore preview.  A future restore execution workflow must be separately approved and guarded.
        </section>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <a href="/admin" style={{ color: "#385a83", fontWeight: 900, textDecoration: "none" }}>
            ← Back to Admin Home
          </a>
          <a href="/" style={{ color: "#385a83", fontWeight: 900, textDecoration: "none" }}>
            ← Back to Barsh Matters
          </a>
        </div>
      </div>
    </main>
  );
}
