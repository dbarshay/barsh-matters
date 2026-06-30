"use client";

import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import BarshHeader from "@/app/components/BarshHeader";

type EmailAutomationStatusLog = {
  id: string;
  source: string | null;
  action: string | null;
  status: string | null;
  targetId: string | null;
  matterId?: string | null;
  masterLawsuitId?: string | null;
  graphConversationId?: string | null;
  createdAt: string;
  details?: unknown;
  error?: string | null;
};

type EmailAutomationStatus = {
  ok: boolean;
  generatedAt: string;
  knownThreadSync: {
    latestRun: EmailAutomationStatusLog | null;
    health?: {
      label: string;
      stale: boolean;
      ageMinutes: number | null;
      thresholdMinutes: number;
    };
    recentCount: number;
    statusCounts: Record<string, number>;
    recentLogs: EmailAutomationStatusLog[];
  };
  maildropDiscovery: {
    latestRun: EmailAutomationStatusLog | null;
    health?: {
      label: string;
      stale: boolean;
      ageMinutes: number | null;
      thresholdMinutes: number;
    };
    recentCount: number;
    statusCounts: Record<string, number>;
    recentLogs: EmailAutomationStatusLog[];
  };
  maildropRegistry: {
    activeCount: number;
    sourceBreakdown: Record<string, number>;
    recentAddresses: Array<{
      id: string;
      address: string;
      normalizedAddress?: string | null;
      label?: string | null;
      source?: string | null;
      matterId?: string | null;
      masterLawsuitId?: string | null;
      clioMatterId?: string | null;
      clioDisplayNumber?: string | null;
      createdAt: string;
      updatedAt: string;
      active: boolean;
    }>;
  };
  recentEmailAutomationLogs: EmailAutomationStatusLog[];
  recentFailures: EmailAutomationStatusLog[];
  safety: {
    readOnly: boolean;
    createsDrafts: boolean;
    sendsEmail: boolean;
    writesClio: boolean;
    uploadsDocuments: boolean;
    usesLocalOutlookAutomation: boolean;
    callsGraph: boolean;
    callsClio: boolean;
  };
};

type ReferenceTypeOption = {
  value: string;
  label: string;
};

type ReferenceAlias = {
  id: string;
  entityId: string;
  alias: string;
  normalizedAlias: string;
  createdAt: string;
  updatedAt: string;
};

type ReferenceEntity = {
  id: string;
  type: string;
  displayName: string;
  normalizedName: string;
  active: boolean;
  notes: string | null;
  details: any | null;
  source: string;
  createdAt: string;
  updatedAt: string;
  aliases?: ReferenceAlias[];
};

type ImportColumnMappingAction =
  | "ignore"
  | "displayName"
  | "aliases"
  | "notes"
  | "active"
  | "source"
  | "details_show"
  | "details_hidden";

type ImportPreviewResponse = {
  ok: boolean;
  action: string;
  error?: string;
  type?: string;
  typeLabel?: string;
  headers?: string[];
  mappings?: Record<string, ImportColumnMappingAction>;
  mappingSummary?: Record<string, string[]>;
  summary?: {
    totalCsvRows: number;
    validRows: number;
    rowsToCreate: number;
    rowsToUpdate: number;
    duplicateOrConflictRows: number;
    invalidRows: number;
    aliasesToAdd: number;
    rowsWithVisibleDetails: number;
    rowsWithHiddenInternalDetails: number;
    ignoredColumns: number;
    existingRecordsChecked: number;
  };
  rowPreviews?: Array<{
    rowNumber: number;
    classification: string;
    displayName: string;
    normalizedName: string;
    existingEntity: any | null;
    proposed: {
      displayName: string;
      aliases: string[];
      notes: string;
      active: boolean | null;
      source: string;
      detailsVisible: Record<string, string>;
      detailsHidden: Record<string, string>;
    };
    ignored: Record<string, string>;
    invalidReasons: string[];
  }>;
  safety?: any;
};

type ImportHistoryResponse = {
  ok: boolean;
  action: string;
  error?: string;
  count?: number;
  imports?: Array<{
    id: string;
    createdAt: string;
    action: string;
    summaryText: string;
    actorName: string | null;
    actorEmail: string | null;
    sourcePage: string | null;
    workflow: string | null;
    type: string;
    typeLabel: string;
    imported: {
      rowsImported: number;
      created: number;
      updated: number;
      aliasesCreated: number;
      aliasesSkippedExisting: number;
    };
    previewSummary: Record<string, any>;
    mappingSummary: Record<string, string[]>;
    importedRows: Array<{
      rowNumber: number;
      action: string;
      entityId: string;
      displayName: string;
      aliasesCreated: number;
      aliasesSkippedExisting: number;
    }>;
  }>;
  safety?: any;
};

type ImportCleanupPreviewResponse = {
  ok: boolean;
  action: string;
  error?: string;
  type?: string;
  query?: string;
  count?: number;
  eligibleCount?: number;
  rows?: Array<{
    id: string;
    type: string;
    displayName: string;
    normalizedName: string;
    active: boolean;
    source: string;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    aliasCount: number;
    aliases: Array<{ id: string; alias: string; normalizedAlias: string }>;
    visibleDetailKeys: string[];
    hiddenInternalDetailKeys: string[];
    eligibleForDeactivate: boolean;
    blockedReasons: string[];
  }>;
  safety?: any;
};

type ImportCleanupConfirmResponse = {
  ok: boolean;
  action: string;
  error?: string;
  type?: string;
  query?: string;
  summary?: {
    matchedEligibleRows: number;
    deactivated: number;
    skipped: number;
    deactivatedRows: Array<{
      id: string;
      displayName: string;
      aliasCount: number;
      source: string;
    }>;
  };
  safety?: any;
};

const DEFAULT_TYPES: ReferenceTypeOption[] = [
  { value: "individual", label: "Individuals" },
  { value: "adversary_attorney", label: "Adversary Attorneys" },
  { value: "insurer_company", label: "Insurers / Companies" },
  { value: "provider_client", label: "Providers / Clients" },
  { value: "treating_provider", label: "Treating Providers" },
  { value: "patient", label: "Patients" },
  { value: "court_venue", label: "Courts / Venues" },
  { value: "service_type", label: "Service Types" },
  { value: "denial_reason", label: "Denial Reasons" },
  { value: "closed_reason", label: "Closed Reasons / Final Statuses" },
  { value: "transaction_type", label: "Transaction Types" },
  { value: "transaction_status", label: "Transaction Statuses" },
  { value: "other", label: "Other" },
];

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function formatStatusDate(value: unknown): string {
  const raw = text(value);
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString();
}

function renderEmailAutomationLogRow(log: EmailAutomationStatusLog) {
  return (
    <tr key={log.id}>
      <td style={{ padding: "8px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top" }}>{formatStatusDate(log.createdAt)}</td>
      <td style={{ padding: "8px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top" }}>{log.source || "—"}</td>
      <td style={{ padding: "8px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top" }}>{log.action || "—"}</td>
      <td style={{ padding: "8px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top" }}>{log.status || "—"}</td>
      <td style={{ padding: "8px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top" }}>{log.targetId || log.matterId || log.masterLawsuitId || log.graphConversationId || "—"}</td>
    </tr>
  );
}


function asStatusRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function renderSmallJson(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function renderMaildropDiscoveryDiagnostics(log: EmailAutomationStatusLog | null | undefined) {
  const details = asStatusRecord(log?.details);
  const duplicateKnownMaildropSamples = Array.isArray(details.duplicateKnownMaildropSamples) ? details.duplicateKnownMaildropSamples : [];
  const knownMaildropSamples = Array.isArray(details.knownMaildropSamples) ? details.knownMaildropSamples : [];
  const scannedMessageSamples = Array.isArray(details.scannedMessageSamples) ? details.scannedMessageSamples : [];
  const matchedMaildropSamples = Array.isArray(details.matchedMaildropSamples) ? details.matchedMaildropSamples : [];

  const diagnosticRows = [
    ["Known MailDrops", details.knownMaildrops],
    ["Duplicate MailDrop addresses", details.duplicateKnownMaildropAddressCount],
    ["Scanned Graph messages", details.scannedGraphMessages],
    ["Matched messages", details.matchedMessages],
    ["Discovered threads", details.discoveredThreads],
    ["Messages upserted", details.messagesUpserted],
    ["Matter links created", details.matterLinksCreated],
    ["Filing logs created", details.filingLogsCreated],
    ["Next link present", details.nextLinkPresent],
  ];

  return (
    <details style={{ marginTop: 12, border: "1px solid #bfdbfe", borderRadius: 12, background: "#eff6ff", padding: 12 }}>
      <summary style={{ cursor: "pointer", fontWeight: 850, color: "#1e3a8a" }}>Latest MailDrop discovery diagnostics</summary>

      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
        {diagnosticRows.map(([label, value]) => (
          <div key={String(label)} style={{ border: "1px solid #dbeafe", borderRadius: 10, background: "white", padding: 10 }}>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 850, textTransform: "uppercase" }}>{label}</div>
            <div style={{ marginTop: 4, fontSize: 16, color: "#0f172a", fontWeight: 850 }}>{renderSmallJson(value)}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <div style={{ border: "1px solid #dbeafe", borderRadius: 10, background: "white", padding: 10 }}>
          <div style={{ fontSize: 12, color: "#1e3a8a", fontWeight: 900, textTransform: "uppercase" }}>Known MailDrop samples</div>
          <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 11, color: "#334155" }}>{renderSmallJson(knownMaildropSamples.slice(0, 10))}</pre>
        </div>

        <div style={{ border: "1px solid #dbeafe", borderRadius: 10, background: "white", padding: 10 }}>
          <div style={{ fontSize: 12, color: "#1e3a8a", fontWeight: 900, textTransform: "uppercase" }}>Duplicate MailDrop address samples</div>
          <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 11, color: "#334155" }}>{renderSmallJson(duplicateKnownMaildropSamples.slice(0, 10))}</pre>
        </div>

        <div style={{ border: "1px solid #dbeafe", borderRadius: 10, background: "white", padding: 10 }}>
          <div style={{ fontSize: 12, color: "#1e3a8a", fontWeight: 900, textTransform: "uppercase" }}>Scanned Graph message samples</div>
          <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 11, color: "#334155" }}>{renderSmallJson(scannedMessageSamples.slice(0, 10))}</pre>
        </div>

        <div style={{ border: "1px solid #dbeafe", borderRadius: 10, background: "white", padding: 10 }}>
          <div style={{ fontSize: 12, color: "#1e3a8a", fontWeight: 900, textTransform: "uppercase" }}>Matched MailDrop samples</div>
          <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 11, color: "#334155" }}>{renderSmallJson(matchedMaildropSamples.slice(0, 10))}</pre>
        </div>
      </div>
    </details>
  );
}


function renderSourceBreakdown(sourceBreakdown: Record<string, number>) {
  const entries = Object.entries(sourceBreakdown || {});
  if (!entries.length) return "—";
  return entries.map(([source, count]) => `${source}: ${count}`).join(", ");
}

function formatDate(value: unknown): string {
  const raw = text(value);
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString();
}

function prettyJson(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parseJsonInput(value: string): any {
  const cleaned = text(value);
  if (!cleaned) return null;
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("Additional Details must be valid JSON.");
  }
}

function parseCsvHeaderClient(value: string): string[] {
  const input = String(value || "").replace(/^\uFEFF/, "");
  let cell = "";
  let inQuotes = false;
  const headers: string[] = [];

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      headers.push(text(cell));
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      headers.push(text(cell));
      return headers.filter(Boolean);
    }

    cell += char;
  }

  headers.push(text(cell));
  return headers.filter(Boolean);
}

function autoMapImportHeader(header: string): ImportColumnMappingAction {
  const normalized = text(header).toLowerCase().replace(/[’']/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  if (normalized.startsWith("hidden_") || normalized.startsWith("internal_")) {
    return "details_hidden";
  }

  if (
    [
      "display_name",
      "displayname",
      "canonical_name",
      "canonical",
      "name",
      "entity_name",
      "reference_name",
      "company_name",
      "person_name",
      "provider_name",
      "treating_provider_name",
      "rendering_provider_name",
      "patient_name",
      "insurer_name",
      "court_name",
      "closed_reason_name",
      "close_reason_name",
      "final_status_name",
    ].includes(normalized)
  ) {
    return "displayName";
  }

  if (["alias", "aliases", "aka", "also_known_as", "search_terms", "search_term"].includes(normalized)) {
    return "aliases";
  }

  if (["note", "notes", "memo", "comment", "comments"].includes(normalized)) {
    return "notes";
  }

  if (["active", "status", "enabled", "inactive"].includes(normalized)) {
    return "active";
  }

  if (["source", "origin", "data_source"].includes(normalized)) {
    return "source";
  }

  return "details_show";
}

function importMappingLabel(action: ImportColumnMappingAction): string {
  const labels: Record<ImportColumnMappingAction, string> = {
    ignore: "Ignore",
    displayName: "Use as Display Name",
    aliases: "Use as Aliases",
    notes: "Use as Notes",
    active: "Use as Active",
    source: "Use as Source",
    details_show: "Store in Details and Show",
    details_hidden: "Store in Details but Hide/Internal",
  };

  return labels[action];
}

function activeLabel(value: boolean): string {
  return value ? "Active" : "Inactive";
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 800,
    background: active ? "#dcfce7" : "#fee2e2",
    color: active ? "#166534" : "#991b1b",
    border: `1px solid ${active ? "#86efac" : "#fecaca"}`,
  };
}

function asPlainObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function detailLabel(key: string): string {
  return text(key)
    .replace(/^hidden[_\s-]+/i, "")
    .replace(/^internal[_\s-]+/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || key;
}

function visibleDetailEntries(details: unknown): Array<[string, any]> {
  const obj = asPlainObject(details);
  return Object.entries(obj).filter(([key, value]) => key !== "_hiddenImportFields" && text(value));
}

function hiddenDetailEntries(details: unknown): Array<[string, any]> {
  return Object.entries(asPlainObject(asPlainObject(details)._hiddenImportFields)).filter(([, value]) => text(value));
}

function allReferenceDetailEntries(details: unknown): Array<[string, any, "visible" | "hidden"]> {
  return [
    ...visibleDetailEntries(details).map(([key, value]) => [key, value, "visible"] as [string, any, "visible"]),
    ...hiddenDetailEntries(details).map(([key, value]) => [key, value, "hidden"] as [string, any, "hidden"]),
  ];
}

type ReferenceDataUrlState = {
  type: string;
  q: string;
  active: string;
  selectedRowId: string;
};

function referenceDataStateFromUrl(): ReferenceDataUrlState {
  if (typeof window === "undefined") {
    return {
      type: "individual",
      q: "",
      active: "all",
      selectedRowId: "",
    };
  }

  const params = new URLSearchParams(window.location.search);

  return {
    type: params.get("type") || "individual",
    q: params.get("q") || "",
    active: params.get("active") || "all",
    selectedRowId: params.get("selectedRowId") || "",
  };
}

function referenceDataStateHasAnyValue(state: ReferenceDataUrlState) {
  return Boolean(
    (state.type && state.type !== "individual") ||
    state.q ||
    (state.active && state.active !== "all") ||
    state.selectedRowId
  );
}

function referenceDataUrlForState(state: ReferenceDataUrlState) {
  const params = new URLSearchParams();

  if (state.type && state.type !== "individual") params.set("type", state.type);
  if (state.q) params.set("q", state.q);
  if (state.active && state.active !== "all") params.set("active", state.active);
  if (state.selectedRowId) params.set("selectedRowId", state.selectedRowId);

  return params.toString() ? `/admin/reference-data?${params.toString()}` : "/admin/reference-data";
}

export default function AdminReferenceDataPage() {

  const [emailAutomationStatus, setEmailAutomationStatus] = useState<EmailAutomationStatus | null>(null);
  const [emailAutomationStatusLoading, setEmailAutomationStatusLoading] = useState(false);
  const [emailAutomationStatusError, setEmailAutomationStatusError] = useState<string | null>(null);

  async function loadEmailAutomationStatus() {
    setEmailAutomationStatusLoading(true);
    setEmailAutomationStatusError(null);

    try {
      const response = await fetch("/api/admin/email-automation-status", {
        method: "GET",
        cache: "no-store",
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || `Status request failed with HTTP ${response.status}`);
      }

      setEmailAutomationStatus(payload);
    } catch (error: any) {
      setEmailAutomationStatusError(error?.message || "Unable to load email automation status.");
    } finally {
      setEmailAutomationStatusLoading(false);
    }
  }

  useEffect(() => {
    loadEmailAutomationStatus();
  }, []);

  const [typeOptions, setTypeOptions] = useState<ReferenceTypeOption[]>(DEFAULT_TYPES);
  const [selectedType, setSelectedType] = useState("individual");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [rows, setRows] = useState<ReferenceEntity[]>([]);
  const [selectedRowId, setSelectedRowId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [newDisplayName, setNewDisplayName] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newDetailsJson, setNewDetailsJson] = useState("");

  const [editDisplayName, setEditDisplayName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editDetailsJson, setEditDetailsJson] = useState("");
  const [newAlias, setNewAlias] = useState("");

  const [importCsvText, setImportCsvText] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [importFileError, setImportFileError] = useState("");
  const [importDragActive, setImportDragActive] = useState(false);
  const [importMappings, setImportMappings] = useState<Record<string, ImportColumnMappingAction>>({});
  const [importPreview, setImportPreview] = useState<ImportPreviewResponse | null>(null);
  const [importConfirmResult, setImportConfirmResult] = useState<any | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importConfirming, setImportConfirming] = useState(false);

  const [importHistory, setImportHistory] = useState<ImportHistoryResponse | null>(null);
  const [importHistoryLoading, setImportHistoryLoading] = useState(false);
  const [selectedImportHistoryItem, setSelectedImportHistoryItem] =
    useState<NonNullable<ImportHistoryResponse["imports"]>[number] | null>(null);
  const [selectedReferenceDetailRow, setSelectedReferenceDetailRow] = useState<ReferenceEntity | null>(null);

  const [importPreviewPanelOpen, setImportPreviewPanelOpen] = useState(true);
  const [importHistoryPanelOpen, setImportHistoryPanelOpen] = useState(true);
  const [cleanupPreviewPanelOpen, setCleanupPreviewPanelOpen] = useState(false);
  const [cleanupQuery, setCleanupQuery] = useState("Import");
  const [cleanupPreview, setCleanupPreview] = useState<ImportCleanupPreviewResponse | null>(null);
  const [cleanupConfirmResult, setCleanupConfirmResult] = useState<ImportCleanupConfirmResponse | null>(null);
  const [cleanupConfirmText, setCleanupConfirmText] = useState("");
  const [cleanupPreviewLoading, setCleanupPreviewLoading] = useState(false);
  const [cleanupConfirming, setCleanupConfirming] = useState(false);

  const selectedTypeLabel = useMemo(
    () => typeOptions.find((option) => option.value === selectedType)?.label || selectedType,
    [selectedType, typeOptions]
  );

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedRowId) || null,
    [rows, selectedRowId]
  );

  const selectedVisibleDetailCount = useMemo(
    () => visibleDetailEntries(selectedRow?.details).length,
    [selectedRow]
  );

  const selectedHiddenDetailCount = useMemo(
    () => hiddenDetailEntries(selectedRow?.details).length,
    [selectedRow]
  );

  const selectedReferenceDetailEntries = useMemo(
    () => allReferenceDetailEntries(selectedReferenceDetailRow?.details),
    [selectedReferenceDetailRow]
  );

  const importHeaders = useMemo(() => parseCsvHeaderClient(importCsvText), [importCsvText]);

  const effectiveImportMappings = useMemo(() => {
    const next: Record<string, ImportColumnMappingAction> = {};
    for (const header of importHeaders) {
      next[header] = importMappings[header] || autoMapImportHeader(header);
    }
    return next;
  }, [importHeaders, importMappings]);

  function resetMessages() {
    setStatusMessage("");
    setErrorMessage("");
  }

  async function loadRows(
    nextType = selectedType,
    nextQuery = query,
    nextActive = activeFilter,
    options: { updateUrl?: boolean; replaceUrl?: boolean; selectedRowId?: string } = {}
  ) {
    try {
      setLoading(true);
      resetMessages();

      const params = new URLSearchParams({
        type: nextType,
        q: nextQuery,
        active: nextActive,
        limit: "100",
      });

      const res = await fetch(`/api/reference-data/entities?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Reference data search failed.");
      }

      setRows(Array.isArray(json.entities) ? json.entities : []);
      if (Array.isArray(json.typeOptions) && json.typeOptions.length) {
        setTypeOptions(json.typeOptions);
      }

      if (typeof window !== "undefined" && options.updateUrl !== false) {
        const nextUrl = referenceDataUrlForState({
          type: nextType,
          q: nextQuery,
          active: nextActive,
          selectedRowId: options.selectedRowId || "",
        });
        const currentUrl = `${window.location.pathname}${window.location.search}`;

        if (nextUrl !== currentUrl) {
          if (options.replaceUrl) {
            window.history.replaceState({ barshMattersReferenceDataSearch: true }, "", nextUrl);
          } else {
            window.history.pushState({ barshMattersReferenceDataSearch: true }, "", nextUrl);
          }
        }
      }

      setStatusMessage(
        `Loaded ${json.count ?? 0} ${json.count === 1 ? "record" : "records"} from local Barsh Matters reference data.`
      );
    } catch (err: any) {
      setRows([]);
      setErrorMessage(err?.message || "Reference data search failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    function applyReferenceDataStateFromUrl() {
      const urlState = referenceDataStateFromUrl();

      setSelectedType(urlState.type);
      setQuery(urlState.q);
      setActiveFilter(urlState.active);
      setSelectedRowId(urlState.selectedRowId);

      if (referenceDataStateHasAnyValue(urlState)) {
        void loadRows(urlState.type, urlState.q, urlState.active, {
          updateUrl: false,
          selectedRowId: urlState.selectedRowId,
        });
        return;
      }

      void loadRows("individual", "", "all", { updateUrl: false });
    }

    applyReferenceDataStateFromUrl();
    window.addEventListener("popstate", applyReferenceDataStateFromUrl);

    return () => {
      window.removeEventListener("popstate", applyReferenceDataStateFromUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedRow) {
      setEditDisplayName("");
      setEditNotes("");
      setNewAlias("");
      return;
    }

    setEditDisplayName(selectedRow.displayName || "");
    setEditNotes(selectedRow.notes || "");
    setEditDetailsJson(prettyJson(selectedRow.details));
    setNewAlias("");
  }, [selectedRow]);


  useEffect(() => {
    void loadImportHistory(selectedType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType]);

  async function loadCleanupPreview(nextType = selectedType, nextQuery = cleanupQuery) {
    try {
      setCleanupPreviewLoading(true);
      resetMessages();

      const params = new URLSearchParams({
        type: nextType,
        q: nextQuery,
        limit: "100",
      });

      const res = await fetch(`/api/reference-data/import-cleanup-preview?${params.toString()}`, {
        cache: "no-store",
      });

      const json = await res.json();
      setCleanupPreview(json);
      setCleanupConfirmResult(null);
      setCleanupConfirmText("");

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Could not load import cleanup preview.");
      }

      setStatusMessage(
        `Cleanup preview loaded ${json.eligibleCount ?? 0} eligible imported reference records.  No records were changed.`
      );
    } catch (err: any) {
      setCleanupPreview({
        ok: false,
        action: "reference-import-cleanup-preview",
        error: err?.message || "Could not load import cleanup preview.",
      });
      setErrorMessage(err?.message || "Could not load import cleanup preview.");
    } finally {
      setCleanupPreviewLoading(false);
    }
  }

  async function confirmCleanupDeactivate() {
    try {
      setCleanupConfirming(true);
      resetMessages();

      if (!cleanupPreview?.ok || !cleanupPreview?.eligibleCount) {
        throw new Error("Run cleanup preview before confirming deactivate cleanup.");
      }

      if (cleanupConfirmText.trim() !== "DEACTIVATE") {
        throw new Error('Type DEACTIVATE before confirming deactivate cleanup.');
      }

      const res = await fetch("/api/reference-data/import-cleanup-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          q: cleanupQuery,
          limit: "100",
          confirm: true,
          actorName: "Barsh Matters User",
        }),
      });

      const json = await res.json();
      setCleanupConfirmResult(json);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Could not confirm deactivate cleanup.");
      }

      setStatusMessage(
        `Confirmed cleanup deactivated ${json.summary?.deactivated ?? 0} imported reference records.  No records were hard-deleted, and no Clio data was changed.`
      );

      setCleanupConfirmText("");
      await loadRows(selectedType, query, activeFilter);
      await loadCleanupPreview(selectedType, cleanupQuery);
      await loadImportHistory(selectedType);
    } catch (err: any) {
      setErrorMessage(err?.message || "Could not confirm deactivate cleanup.");
    } finally {
      setCleanupConfirming(false);
    }
  }

  async function loadImportHistory(nextType = selectedType) {
    try {
      setImportHistoryLoading(true);

      const params = new URLSearchParams({
        type: nextType,
        limit: "25",
      });

      const res = await fetch(`/api/reference-data/import-history?${params.toString()}`, {
        cache: "no-store",
      });

      const json = await res.json();
      setImportHistory(json);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Could not load reference import history.");
      }
    } catch (err: any) {
      setImportHistory({
        ok: false,
        action: "reference-import-history",
        error: err?.message || "Could not load reference import history.",
      });
    } finally {
      setImportHistoryLoading(false);
    }
  }

  function resetImportPreviewState() {
    setImportPreview(null);
    setImportConfirmResult(null);
  }

  async function loadReferenceImportFile(file: File | null) {
    try {
      setImportFileError("");
      setImportFileName("");

      if (!file) return;

      const fileName = file.name || "selected file";
      const lowerName = fileName.toLowerCase();

      if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".xls") && !lowerName.endsWith(".csv")) {
        throw new Error("Use an .xlsx, .xls, or .csv file.");
      }

      let csvText = "";

      if (lowerName.endsWith(".csv")) {
        csvText = await file.text();
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];

        if (!sheetName) {
          throw new Error("The spreadsheet does not contain a worksheet.");
        }

        const worksheet = workbook.Sheets[sheetName];
        csvText = XLSX.utils.sheet_to_csv(worksheet, { blankrows: false });
      }

      if (!text(csvText)) {
        throw new Error("The selected file did not contain importable text.");
      }

      setImportCsvText(csvText);
      setImportFileName(fileName);
      setImportMappings({});
      resetImportPreviewState();
      setStatusMessage(`Loaded ${fileName} into the import preview box.  No records were changed.`);
    } catch (err: any) {
      setImportFileError(err?.message || "Could not read spreadsheet file.");
      setImportCsvText("");
      setImportFileName("");
      resetImportPreviewState();
    }
  }

  async function previewImport() {
    try {
      setImportLoading(true);
      resetMessages();

      if (!text(importCsvText)) {
        throw new Error("Paste CSV text before previewing import.");
      }

      const res = await fetch("/api/reference-data/import-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          csvText: importCsvText,
          columnMappings: effectiveImportMappings,
        }),
      });

      const json = await res.json();
      setImportPreview(json);
      setImportConfirmResult(null);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Could not preview CSV import.");
      }

      setStatusMessage("Generated CSV import preview only.  No database records or Clio records were changed.");
    } catch (err: any) {
      setErrorMessage(err?.message || "Could not preview CSV import.");
    } finally {
      setImportLoading(false);
    }
  }

  function updateImportMapping(header: string, action: ImportColumnMappingAction) {
    setImportMappings((current) => ({
      ...current,
      [header]: action,
    }));
    setImportPreview(null);
    setImportConfirmResult(null);
  }

  async function confirmImport() {
    try {
      setImportConfirming(true);
      resetMessages();

      if (!importPreview?.ok || !importPreview?.summary) {
        throw new Error("Preview the CSV import before confirming.");
      }

      if ((importPreview.summary.invalidRows || 0) > 0 || (importPreview.summary.duplicateOrConflictRows || 0) > 0) {
        throw new Error("Resolve invalid or duplicate/conflict rows before confirming import.");
      }

      const res = await fetch("/api/reference-data/import-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          csvText: importCsvText,
          columnMappings: effectiveImportMappings,
          confirm: true,
          actorName: "Barsh Matters User",
        }),
      });

      const json = await res.json();
      setImportConfirmResult(json);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Could not confirm CSV import.");
      }

      setStatusMessage(
        `Confirmed CSV import.  Created ${json.summary?.created ?? 0}, updated ${json.summary?.updated ?? 0}, aliases added ${json.summary?.aliasesCreated ?? 0}.  No Clio data was changed.`
      );

      await loadRows(selectedType, query, activeFilter);
      await loadImportHistory(selectedType);
    } catch (err: any) {
      setErrorMessage(err?.message || "Could not confirm CSV import.");
    } finally {
      setImportConfirming(false);
    }
  }

  async function createRecord() {
    try {
      setSaving(true);
      resetMessages();

      if (!text(newDisplayName)) {
        throw new Error("Display name is required.");
      }

      const res = await fetch("/api/reference-data/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          displayName: newDisplayName,
          notes: newNotes,
          details: parseJsonInput(newDetailsJson),
          actorName: "Barsh Matters User",
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Could not create reference record.");
      }

      setNewDisplayName("");
      setNewNotes("");
      setNewDetailsJson("");
      setSelectedRowId(json.entity?.id || "");
      setStatusMessage("Created local reference record.  No Clio data was changed.");
      await loadRows(selectedType, query, activeFilter);
      setSelectedRowId(json.entity?.id || "");
    } catch (err: any) {
      setErrorMessage(err?.message || "Could not create reference record.");
    } finally {
      setSaving(false);
    }
  }

  async function updateRecord(operation = "update") {
    try {
      setSaving(true);
      resetMessages();

      if (!selectedRow) {
        throw new Error("Select a reference record first.");
      }

      const body: any = {
        id: selectedRow.id,
        operation,
        actorName: "Barsh Matters User",
      };

      if (operation === "update") {
        body.displayName = editDisplayName;
        body.notes = editNotes;
        body.details = parseJsonInput(editDetailsJson);
      }

      const res = await fetch("/api/reference-data/entities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Could not update reference record.");
      }

      setStatusMessage(
        operation === "deactivate"
          ? "Deactivated local reference record.  The record was not hard-deleted."
          : operation === "reactivate"
            ? "Reactivated local reference record."
            : "Updated local reference record.  No Clio data was changed."
      );

      await loadRows(selectedType, query, activeFilter);
      setSelectedRowId(json.entity?.id || selectedRow.id);
    } catch (err: any) {
      setErrorMessage(err?.message || "Could not update reference record.");
    } finally {
      setSaving(false);
    }
  }

  async function addAlias() {
    try {
      setSaving(true);
      resetMessages();

      if (!selectedRow) {
        throw new Error("Select a reference record first.");
      }

      if (!text(newAlias)) {
        throw new Error("Alias is required.");
      }

      const res = await fetch("/api/reference-data/aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: selectedRow.id,
          alias: newAlias,
          actorName: "Barsh Matters User",
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Could not add alias.");
      }

      setNewAlias("");
      setStatusMessage("Added local search alias.  No Clio data was changed.");
      await loadRows(selectedType, query, activeFilter);
      setSelectedRowId(selectedRow.id);
    } catch (err: any) {
      setErrorMessage(err?.message || "Could not add alias.");
    } finally {
      setSaving(false);
    }
  }

  
  function renderEmailAutomationStatusPanel() {
    return (
      <section
        data-email-automation-status-panel="true"
        style={{
          border: "1px solid #bfdbfe",
          borderRadius: 16,
          padding: 18,
          marginBottom: 20,
          background: "#eff6ff",
          boxShadow: "0 10px 30px rgba(30, 64, 175, 0.08)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, color: "#1e3a8a" }}>Email Automation Status</h2>
            <p style={{ margin: "6px 0 0", color: "#1e40af", fontSize: 14 }}>
              Observability for Graph background sync, MailDrop discovery, and the MailDrop registry.
            </p>
          </div>
          <button
            type="button"
            onClick={loadEmailAutomationStatus}
            disabled={emailAutomationStatusLoading}
            style={{
              border: "1px solid #2563eb",
              background: emailAutomationStatusLoading ? "#dbeafe" : "#2563eb",
              color: emailAutomationStatusLoading ? "#1e40af" : "white",
              borderRadius: 999,
              padding: "9px 14px",
              fontWeight: 700,
              cursor: emailAutomationStatusLoading ? "default" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {emailAutomationStatusLoading ? "Refreshing..." : "Refresh Status"}
          </button>
        </div>

        {emailAutomationStatusError && (
          <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 12, padding: 12, marginBottom: 12 }}>
            {emailAutomationStatusError}
          </div>
        )}

        {!emailAutomationStatus && !emailAutomationStatusError && (
          <div style={{ color: "#1e40af", fontSize: 14 }}>
            {emailAutomationStatusLoading ? "Loading email automation status..." : "No status loaded yet."}
          </div>
        )}

        {emailAutomationStatus && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 14 }}>
              <div style={{ background: "white", border: "1px solid #dbeafe", borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Known-thread sync</div>
                <div style={{ marginTop: 8, fontSize: 14 }}><strong>Last run:</strong> {formatStatusDate(emailAutomationStatus.knownThreadSync.latestRun?.createdAt)}</div>
                <div style={{ marginTop: 4, fontSize: 14 }}><strong>Status:</strong> {emailAutomationStatus.knownThreadSync.latestRun?.status || "—"}</div>
                <div style={{ marginTop: 4, fontSize: 14 }}><strong>Health:</strong> <span style={{ color: emailAutomationStatus.knownThreadSync.health?.stale ? "#991b1b" : "#166534", fontWeight: 850 }}>{emailAutomationStatus.knownThreadSync.health?.label || "—"}</span></div>
                <div style={{ marginTop: 4, fontSize: 14 }}><strong>Recent logs:</strong> {emailAutomationStatus.knownThreadSync.recentCount}</div>
              </div>

              <div style={{ background: "white", border: "1px solid #dbeafe", borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>MailDrop discovery</div>
                <div style={{ marginTop: 8, fontSize: 14 }}><strong>Last run:</strong> {formatStatusDate(emailAutomationStatus.maildropDiscovery.latestRun?.createdAt)}</div>
                <div style={{ marginTop: 4, fontSize: 14 }}><strong>Status:</strong> {emailAutomationStatus.maildropDiscovery.latestRun?.status || "—"}</div>
                <div style={{ marginTop: 4, fontSize: 14 }}><strong>Health:</strong> <span style={{ color: emailAutomationStatus.maildropDiscovery.health?.stale ? "#991b1b" : "#166534", fontWeight: 850 }}>{emailAutomationStatus.maildropDiscovery.health?.label || "—"}</span></div>
                <div style={{ marginTop: 4, fontSize: 14 }}><strong>Recent logs:</strong> {emailAutomationStatus.maildropDiscovery.recentCount}</div>
                {renderMaildropDiscoveryDiagnostics(emailAutomationStatus.maildropDiscovery.latestRun)}
              </div>

              <div style={{ background: "white", border: "1px solid #dbeafe", borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>MailDrop registry</div>
                <div style={{ marginTop: 8, fontSize: 14 }}><strong>Active addresses:</strong> {emailAutomationStatus.maildropRegistry.activeCount}</div>
                <div style={{ marginTop: 4, fontSize: 14 }}><strong>Sources:</strong> {renderSourceBreakdown(emailAutomationStatus.maildropRegistry.sourceBreakdown)}</div>
              </div>

              <div style={{ background: "white", border: "1px solid #dbeafe", borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Safety flags</div>
                <div style={{ marginTop: 8, fontSize: 14 }}><strong>Read-only:</strong> {String(emailAutomationStatus.safety.readOnly)}</div>
                <div style={{ marginTop: 4, fontSize: 14 }}><strong>No drafts / sends / Clio writes:</strong> {String(!emailAutomationStatus.safety.createsDrafts && !emailAutomationStatus.safety.sendsEmail && !emailAutomationStatus.safety.writesClio)}</div>
                <div style={{ marginTop: 4, fontSize: 14 }}><strong>No document upload:</strong> {String(!emailAutomationStatus.safety.uploadsDocuments)}</div>
              </div>
            </div>

            <details style={{ background: "white", border: "1px solid #dbeafe", borderRadius: 14, padding: 14, marginBottom: 12 }}>
              <summary style={{ cursor: "pointer", fontWeight: 800, color: "#1e3a8a" }}>Recent MailDrop registry addresses</summary>
              <div style={{ overflowX: "auto", marginTop: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                      <th style={{ padding: "8px", borderBottom: "1px solid #e5e7eb" }}>Updated</th>
                      <th style={{ padding: "8px", borderBottom: "1px solid #e5e7eb" }}>Address</th>
                      <th style={{ padding: "8px", borderBottom: "1px solid #e5e7eb" }}>Label</th>
                      <th style={{ padding: "8px", borderBottom: "1px solid #e5e7eb" }}>Source</th>
                      <th style={{ padding: "8px", borderBottom: "1px solid #e5e7eb" }}>Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emailAutomationStatus.maildropRegistry.recentAddresses.length ? (
                      emailAutomationStatus.maildropRegistry.recentAddresses.map((row) => (
                        <tr key={row.id}>
                          <td style={{ padding: "8px", borderBottom: "1px solid #e5e7eb" }}>{formatStatusDate(row.updatedAt)}</td>
                          <td style={{ padding: "8px", borderBottom: "1px solid #e5e7eb" }}>{row.address}</td>
                          <td style={{ padding: "8px", borderBottom: "1px solid #e5e7eb" }}>{row.label || "—"}</td>
                          <td style={{ padding: "8px", borderBottom: "1px solid #e5e7eb" }}>{row.source || "—"}</td>
                          <td style={{ padding: "8px", borderBottom: "1px solid #e5e7eb" }}>{row.matterId || row.masterLawsuitId || row.clioDisplayNumber || row.clioMatterId || "—"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ padding: "10px", color: "#64748b" }}>No active MailDrop addresses found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </details>

            <details style={{ background: "white", border: "1px solid #dbeafe", borderRadius: 14, padding: 14 }}>
              <summary style={{ cursor: "pointer", fontWeight: 800, color: "#1e3a8a" }}>Recent email automation logs</summary>
              <div style={{ overflowX: "auto", marginTop: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                      <th style={{ padding: "8px", borderBottom: "1px solid #e5e7eb" }}>Created</th>
                      <th style={{ padding: "8px", borderBottom: "1px solid #e5e7eb" }}>Source</th>
                      <th style={{ padding: "8px", borderBottom: "1px solid #e5e7eb" }}>Action</th>
                      <th style={{ padding: "8px", borderBottom: "1px solid #e5e7eb" }}>Status</th>
                      <th style={{ padding: "8px", borderBottom: "1px solid #e5e7eb" }}>Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emailAutomationStatus.recentEmailAutomationLogs.length ? (
                      emailAutomationStatus.recentEmailAutomationLogs.map(renderEmailAutomationLogRow)
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ padding: "10px", color: "#64748b" }}>No recent automation logs found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </details>

            {emailAutomationStatus.recentFailures.length > 0 && (
              <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 12, padding: 12, marginTop: 12 }}>
                <strong>Recent failures:</strong> {emailAutomationStatus.recentFailures.length}. Expand recent logs for details.
              </div>
            )}

            <div style={{ color: "#64748b", fontSize: 12, marginTop: 10 }}>
              Generated: {formatStatusDate(emailAutomationStatus.generatedAt)}
            </div>
          </>
        )}
      </section>
    );
  }

return (
    <main

      

      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #dbeafe 0%, #f8fafc 42%, #eff6ff 100%)",
        padding: 28,
        color: "#0f172a",
      }}
    >
      <BarshHeader />
      {renderEmailAutomationStatusPanel()}
      <div style={{ maxWidth: "none", margin: 0 }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 18,
            alignItems: "flex-start",
            marginBottom: 22,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.6, color: "#1d4ed8" }}>
              BARSH MATTERS ADMIN
            </div>
            <h1 style={{ margin: "4px 0 8px", fontSize: 34, lineHeight: 1.1 }}>
              Reference Data
            </h1>
            <p style={{ margin: 0, maxWidth: 820, color: "#475569", fontSize: 15, lineHeight: 1.5 }}>
              Manage targeted local Barsh Matters reference lists.
            </p>
          </div>

          <a
            href="/"
            style={{
              textDecoration: "none",
              border: "1px solid #bfdbfe",
              background: "#ffffff",
              color: "#1d4ed8",
              fontWeight: 900,
              borderRadius: 14,
              padding: "11px 14px",
              boxShadow: "0 10px 22px rgba(15, 23, 42, 0.08)",
              whiteSpace: "nowrap",
            }}
          >
            Return Home
          </a>
        </header>

        <section
          style={{
            border: "1px solid #bfdbfe",
            background: "#eff6ff",
            borderRadius: 20,
            padding: 18,
            marginBottom: 18,
            boxShadow: "0 14px 36px rgba(15, 23, 42, 0.08)",
          }}
        >
          <strong style={{ display: "block", marginBottom: 8 }}>Local-first reference-data rules</strong>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
            {[
              "Targeted list per field",
              "Active/inactive, no hard delete",
              "Aliases for messy search terms",
              "All changes are audit logged",
            ].map((item) => (
              <div
                key={item}
                style={{
                  background: "#ffffff",
                  border: "1px solid #dbeafe",
                  borderRadius: 14,
                  padding: 12,
                  fontWeight: 800,
                  color: "#1e3a8a",
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        <section
          style={{
            border: "1px solid #bfdbfe",
            background: "#ffffff",
            borderRadius: 22,
            padding: 18,
            marginBottom: 18,
            boxShadow: "0 18px 42px rgba(15, 23, 42, 0.10)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 18,
              alignItems: "flex-start",
              marginBottom: importPreviewPanelOpen ? 14 : 0,
            }}
          >
            <div>
              <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>CSV Import Preview</h2>
              <p style={{ margin: 0, color: "#64748b", fontSize: 13, lineHeight: 1.45 }}>
                Preview CSV rows for the selected list before writing anything, then confirm only after review.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button
                onClick={() => setImportPreviewPanelOpen((value) => !value)}
                aria-expanded={importPreviewPanelOpen}
                style={{
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  color: "#0f172a",
                  borderRadius: 12,
                  padding: "9px 12px",
                  fontWeight: 900,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {importPreviewPanelOpen ? "Collapse" : "Expand"}
              </button>
            </div>
          </div>

          {importPreviewPanelOpen ? (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: 16, alignItems: "start" }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 6 }}>
                Drop Spreadsheet or Paste CSV Text
              </label>

              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setImportDragActive(true);
                }}
                onDragLeave={() => setImportDragActive(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setImportDragActive(false);
                  void loadReferenceImportFile(event.dataTransfer.files?.[0] || null);
                }}
                style={{
                  border: `2px dashed ${importDragActive ? "#2563eb" : "#bfdbfe"}`,
                  background: importDragActive ? "#eff6ff" : "#f8fafc",
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 900, color: "#1e3a8a", marginBottom: 3 }}>
                    Drop .xlsx, .xls, or .csv file here
                  </div>
                  <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.4 }}>
                    The first worksheet will be converted to CSV for preview.
                    {importFileName ? (
                      <span style={{ display: "block", marginTop: 4, color: "#166534", fontWeight: 900 }}>
                        Loaded: {importFileName}
                      </span>
                    ) : null}
                  </div>
                </div>

                <label
                  htmlFor="reference-import-file"
                  style={{
                    border: "1px solid #bfdbfe",
                    background: "#ffffff",
                    color: "#1d4ed8",
                    borderRadius: 12,
                    padding: "9px 12px",
                    fontWeight: 900,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Choose File
                </label>
                <input
                  id="reference-import-file"
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  onChange={(event) => {
                    void loadReferenceImportFile(event.target.files?.[0] || null);
                    event.currentTarget.value = "";
                  }}
                  style={{ display: "none" }}
                />
              </div>

              {importFileError ? (
                <div
                  style={{
                    border: "1px solid #fecaca",
                    background: "#fef2f2",
                    color: "#991b1b",
                    borderRadius: 12,
                    padding: 10,
                    marginBottom: 10,
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {importFileError}
                </div>
              ) : null}

              <textarea
                value={importCsvText}
                onChange={(event) => {
                  setImportCsvText(event.target.value);
                  setImportFileName("");
                  setImportFileError("");
                  resetImportPreviewState();
                }}
                placeholder={'insurer_name,hidden_street,hidden_city,hidden_state,hidden_zipcode,hidden_phone,hidden_email,hidden_group_name,hidden_website,hidden_naic_number,hidden_domicile\nExample Insurance Company,123 Main St,Albany,NY,12207,555-555-5555,claims@example.com,Example Group,https://example.com,12345,NY'}
                rows={8}
                style={{
                  width: "100%",
                  padding: "11px 12px",
                  borderRadius: 12,
                  border: "1px solid #cbd5e1",
                  resize: "vertical",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontSize: 12,
                }}
              />

              {importHeaders.length ? (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 8 }}>
                    Column Mapping
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {importHeaders.map((header) => (
                      <div
                        key={header}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(0, 1fr) 260px",
                          gap: 10,
                          alignItems: "center",
                          border: "1px solid #e2e8f0",
                          borderRadius: 12,
                          padding: 10,
                          background: "#f8fafc",
                        }}
                      >
                        <div style={{ fontWeight: 900, color: "#0f172a", wordBreak: "break-word" }}>{header}</div>
                        <select
                          value={effectiveImportMappings[header]}
                          onChange={(event) => updateImportMapping(header, event.target.value as ImportColumnMappingAction)}
                          style={{
                            width: "100%",
                            padding: "9px 10px",
                            borderRadius: 10,
                            border: "1px solid #cbd5e1",
                            fontWeight: 800,
                            background: "#ffffff",
                          }}
                        >
                          {[
                            "ignore",
                            "displayName",
                            "aliases",
                            "notes",
                            "active",
                            "source",
                            "details_show",
                            "details_hidden",
                          ].map((action) => (
                            <option key={action} value={action}>
                              {importMappingLabel(action as ImportColumnMappingAction)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div
              style={{
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                borderRadius: 18,
                padding: 14,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 8 }}>
                Import Target
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 12 }}>{selectedTypeLabel}</div>

              <button
                onClick={previewImport}
                disabled={importLoading || !text(importCsvText)}
                style={{
                  width: "100%",
                  border: 0,
                  background: importLoading || !text(importCsvText) ? "#94a3b8" : "#7c3aed",
                  color: "#ffffff",
                  borderRadius: 14,
                  padding: "12px 14px",
                  fontWeight: 900,
                  cursor: importLoading || !text(importCsvText) ? "default" : "pointer",
                  marginBottom: 10,
                }}
              >
                {importLoading ? "Previewing..." : "Preview CSV Import"}
              </button>

              <button
                onClick={confirmImport}
                disabled={
                  importConfirming ||
                  !importPreview?.ok ||
                  !importPreview?.summary ||
                  (importPreview.summary.invalidRows || 0) > 0 ||
                  (importPreview.summary.duplicateOrConflictRows || 0) > 0
                }
                style={{
                  width: "100%",
                  border: 0,
                  background:
                    importConfirming ||
                    !importPreview?.ok ||
                    !importPreview?.summary ||
                    (importPreview.summary.invalidRows || 0) > 0 ||
                    (importPreview.summary.duplicateOrConflictRows || 0) > 0
                      ? "#94a3b8"
                      : "#16a34a",
                  color: "#ffffff",
                  borderRadius: 14,
                  padding: "12px 14px",
                  fontWeight: 900,
                  cursor:
                    importConfirming ||
                    !importPreview?.ok ||
                    !importPreview?.summary ||
                    (importPreview.summary.invalidRows || 0) > 0 ||
                    (importPreview.summary.duplicateOrConflictRows || 0) > 0
                      ? "default"
                      : "pointer",
                  marginBottom: 12,
                }}
              >
                {importConfirming ? "Importing..." : "Confirm Import to Local Reference Data"}
              </button>

              <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.45 }}>
                CSV columns beginning with <strong>hidden_</strong> or <strong>internal_</strong> are stored for
                detail/document use but are not shown as ordinary visible detail fields.
              </div>

              {importConfirmResult?.ok ? (
                <div
                  style={{
                    marginTop: 12,
                    border: "1px solid #bbf7d0",
                    background: "#f0fdf4",
                    color: "#166534",
                    borderRadius: 14,
                    padding: 12,
                    fontSize: 12,
                    fontWeight: 800,
                    lineHeight: 1.45,
                  }}
                >
                  Import confirmed: created {importConfirmResult.summary?.created ?? 0}, updated{" "}
                  {importConfirmResult.summary?.updated ?? 0}, aliases added{" "}
                  {importConfirmResult.summary?.aliasesCreated ?? 0}.
                </div>
              ) : null}

              {importPreview?.summary ? (
                <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    ["Rows", importPreview.summary.totalCsvRows],
                    ["Create", importPreview.summary.rowsToCreate],
                    ["Update", importPreview.summary.rowsToUpdate],
                    ["Invalid", importPreview.summary.invalidRows],
                    ["Conflicts", importPreview.summary.duplicateOrConflictRows],
                    ["Aliases", importPreview.summary.aliasesToAdd],
                    ["Shown Details", importPreview.summary.rowsWithVisibleDetails],
                    ["Hidden Details", importPreview.summary.rowsWithHiddenInternalDetails],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        padding: 10,
                      }}
                    >
                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 900 }}>{label}</div>
                      <div style={{ fontSize: 20, fontWeight: 900 }}>{value}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          ) : null}

          {importPreviewPanelOpen && importPreview?.rowPreviews?.length ? (
            <div style={{ marginTop: 18, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#eff6ff" }}>
                    {["Row", "Result", "Display Name", "Aliases", "Visible Details", "Hidden/Internal", "Issues"].map((header) => (
                      <th
                        key={header}
                        style={{
                          textAlign: "left",
                          padding: "10px 8px",
                          borderBottom: "1px solid #bfdbfe",
                          color: "#1e3a8a",
                          fontSize: 12,
                          fontWeight: 900,
                        }}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importPreview.rowPreviews.slice(0, 50).map((row) => (
                    <tr key={`${row.rowNumber}-${row.displayName}`} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "10px 8px", fontWeight: 900 }}>{row.rowNumber}</td>
                      <td style={{ padding: "10px 8px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            borderRadius: 999,
                            padding: "4px 9px",
                            fontSize: 11,
                            fontWeight: 900,
                            background:
                              row.classification === "create"
                                ? "#dcfce7"
                                : row.classification === "update"
                                  ? "#dbeafe"
                                  : row.classification === "invalid"
                                    ? "#fee2e2"
                                    : "#fef3c7",
                            color:
                              row.classification === "create"
                                ? "#166534"
                                : row.classification === "update"
                                  ? "#1d4ed8"
                                  : row.classification === "invalid"
                                    ? "#991b1b"
                                    : "#92400e",
                          }}
                        >
                          {row.classification.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "10px 8px", fontWeight: 800 }}>
                        {row.displayName || "—"}
                        {row.existingEntity ? (
                          <div style={{ color: "#64748b", fontSize: 11, marginTop: 3 }}>
                            Existing: {row.existingEntity.displayName}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ padding: "10px 8px" }}>
                        {row.proposed.aliases?.length ? row.proposed.aliases.join(", ") : "—"}
                      </td>
                      <td style={{ padding: "10px 8px" }}>
                        {Object.keys(row.proposed.detailsVisible || {}).length
                          ? Object.keys(row.proposed.detailsVisible).join(", ")
                          : "—"}
                      </td>
                      <td style={{ padding: "10px 8px" }}>
                        {Object.keys(row.proposed.detailsHidden || {}).length
                          ? Object.keys(row.proposed.detailsHidden).join(", ")
                          : "—"}
                      </td>
                      <td style={{ padding: "10px 8px", color: row.invalidReasons?.length ? "#991b1b" : "#64748b" }}>
                        {row.invalidReasons?.length ? row.invalidReasons.join("; ") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importPreview.rowPreviews.length > 50 ? (
                <div style={{ marginTop: 10, color: "#64748b", fontSize: 12 }}>
                  Showing first 50 preview rows.  Total preview rows: {importPreview.rowPreviews.length}.
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section
          style={{
            border: "1px solid #dbeafe",
            background: "#ffffff",
            borderRadius: 22,
            padding: 18,
            marginBottom: 18,
            boxShadow: "0 18px 42px rgba(15, 23, 42, 0.10)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 14,
              alignItems: "flex-start",
              marginBottom: 14,
            }}
          >
            <div>
              <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>Reference Import History</h2>
              <p style={{ margin: 0, color: "#64748b", fontSize: 13, lineHeight: 1.45 }}>
                History of confirmed CSV imports for the selected list.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button
                onClick={() => loadImportHistory()}
                disabled={importHistoryLoading}
                style={{
                  border: "1px solid #cbd5e1",
                  background: importHistoryLoading ? "#e2e8f0" : "#f8fafc",
                  color: "#0f172a",
                  borderRadius: 12,
                  padding: "10px 12px",
                  fontWeight: 900,
                  cursor: importHistoryLoading ? "default" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {importHistoryLoading ? "Loading..." : "Refresh History"}
              </button>

              <button
                onClick={() => setImportHistoryPanelOpen((value) => !value)}
                aria-expanded={importHistoryPanelOpen}
                style={{
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  color: "#0f172a",
                  borderRadius: 12,
                  padding: "10px 12px",
                  fontWeight: 900,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {importHistoryPanelOpen ? "Collapse" : "Expand"}
              </button>
            </div>
          </div>

          {importHistoryPanelOpen && importHistory?.error ? (
            <div
              style={{
                border: "1px solid #fecaca",
                background: "#fef2f2",
                color: "#991b1b",
                borderRadius: 14,
                padding: 12,
                fontWeight: 800,
              }}
            >
              {importHistory.error}
            </div>
          ) : null}

          {importHistoryPanelOpen && importHistory?.imports?.length ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#eff6ff" }}>
                    {["Imported", "Type", "Rows", "Created", "Updated", "Aliases", "Actor", "Imported Rows", "Details"].map((header) => (
                      <th
                        key={header}
                        style={{
                          textAlign: "left",
                          padding: "10px 8px",
                          borderBottom: "1px solid #bfdbfe",
                          color: "#1e3a8a",
                          fontSize: 12,
                          fontWeight: 900,
                        }}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importHistory.imports.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "10px 8px", whiteSpace: "nowrap", fontWeight: 800 }}>
                        {formatDate(item.createdAt)}
                      </td>
                      <td style={{ padding: "10px 8px", fontWeight: 800 }}>
                        {item.typeLabel || item.type || "—"}
                      </td>
                      <td style={{ padding: "10px 8px" }}>{item.imported?.rowsImported ?? 0}</td>
                      <td style={{ padding: "10px 8px" }}>{item.imported?.created ?? 0}</td>
                      <td style={{ padding: "10px 8px" }}>{item.imported?.updated ?? 0}</td>
                      <td style={{ padding: "10px 8px" }}>{item.imported?.aliasesCreated ?? 0}</td>
                      <td style={{ padding: "10px 8px" }}>{item.actorName || "—"}</td>
                      <td style={{ padding: "10px 8px", color: "#475569" }}>
                        {item.importedRows?.length
                          ? item.importedRows
                              .slice(0, 4)
                              .map((row) => `${row.action}: ${row.displayName}`)
                              .join("; ")
                          : "—"}
                        {item.importedRows && item.importedRows.length > 4 ? " …" : ""}
                      </td>
                      <td style={{ padding: "10px 8px" }}>
                        <button
                          onClick={() => setSelectedImportHistoryItem(item)}
                          style={{
                            border: "1px solid #bfdbfe",
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            borderRadius: 10,
                            padding: "7px 10px",
                            fontWeight: 900,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
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
          ) : importHistoryPanelOpen && !importHistoryLoading ? (
            <div
              style={{
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                borderRadius: 14,
                padding: 14,
                color: "#64748b",
                fontWeight: 800,
              }}
            >
              No confirmed CSV imports found for this selected list.
            </div>
          ) : null}
        </section>

        {selectedRow ? (
          <section
            style={{
              border: "1px solid #dbeafe",
              background: "#ffffff",
              borderRadius: 22,
              padding: 18,
              marginBottom: 18,
              boxShadow: "0 18px 42px rgba(15, 23, 42, 0.10)",
            }}
          >
            <h2 style={{ margin: "0 0 6px", fontSize: 20 }}>Selected Reference Details</h2>
            <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: 13, lineHeight: 1.45 }}>
              Visible detail fields: {selectedVisibleDetailCount}.  Hidden/internal fields available for detail view
              and document generation: {selectedHiddenDetailCount}.
            </p>
            <button
              type="button"
              onClick={() => setSelectedReferenceDetailRow(selectedRow)}
              disabled={selectedVisibleDetailCount + selectedHiddenDetailCount === 0}
              style={{
                border: "1px solid #bfdbfe",
                background: selectedVisibleDetailCount + selectedHiddenDetailCount === 0 ? "#e2e8f0" : "#eff6ff",
                color: selectedVisibleDetailCount + selectedHiddenDetailCount === 0 ? "#64748b" : "#1d4ed8",
                borderRadius: 10,
                padding: "8px 11px",
                fontWeight: 900,
                cursor: selectedVisibleDetailCount + selectedHiddenDetailCount === 0 ? "default" : "pointer",
              }}
            >
              View Stored Details
            </button>
          </section>
        ) : null}

        {selectedReferenceDetailRow ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Reference record stored details"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1000,
              background: "rgba(15, 23, 42, 0.42)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <div
              style={{
                width: "min(860px, calc(100vw - 48px))",
                maxHeight: "calc(100vh - 48px)",
                overflow: "auto",
                background: "#ffffff",
                border: "1px solid #bfdbfe",
                borderRadius: 22,
                boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
                padding: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  alignItems: "flex-start",
                  marginBottom: 16,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#1d4ed8", letterSpacing: 1.2 }}>
                    REFERENCE DETAIL
                  </div>
                  <h2 style={{ margin: "4px 0 6px", fontSize: 24 }}>{selectedReferenceDetailRow.displayName}</h2>
                </div>

                <button
                  onClick={() => setSelectedReferenceDetailRow(null)}
                  style={{
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    color: "#0f172a",
                    borderRadius: 12,
                    padding: "10px 12px",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 16 }}>
                {[
                  ["Type", selectedTypeLabel],
                  ["Status", activeLabel(selectedReferenceDetailRow.active)],
                  ["Source", selectedReferenceDetailRow.source || "—"],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    style={{
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      borderRadius: 14,
                      padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 900 }}>{label}</div>
                    <div style={{ fontSize: 15, fontWeight: 900, marginTop: 4 }}>{value}</div>
                  </div>
                ))}
              </div>

              {selectedReferenceDetailEntries.length ? (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#eff6ff" }}>
                        {["Field", "Value", "Visibility"].map((header) => (
                          <th
                            key={header}
                            style={{
                              textAlign: "left",
                              padding: "10px 8px",
                              borderBottom: "1px solid #bfdbfe",
                              color: "#1e3a8a",
                              fontSize: 12,
                              fontWeight: 900,
                            }}
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReferenceDetailEntries.map(([key, value, visibility]) => (
                        <tr key={`${visibility}-${key}`} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "10px 8px", fontWeight: 900 }}>{detailLabel(key)}</td>
                          <td style={{ padding: "10px 8px", color: "#334155", whiteSpace: "pre-wrap" }}>
                            {text(value) || "—"}
                          </td>
                          <td style={{ padding: "10px 8px" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                borderRadius: 999,
                                padding: "4px 9px",
                                fontSize: 11,
                                fontWeight: 900,
                                background: visibility === "hidden" ? "#fef3c7" : "#dcfce7",
                                color: visibility === "hidden" ? "#92400e" : "#166534",
                              }}
                            >
                              {visibility === "hidden" ? "Hidden / Internal" : "Visible Detail"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    borderRadius: 14,
                    padding: 14,
                    color: "#64748b",
                    fontWeight: 800,
                  }}
                >
                  No stored details found for this reference record.
                </div>
              )}
            </div>
          </div>
        ) : null}

        {selectedImportHistoryItem ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Reference import detail"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1000,
              background: "rgba(15, 23, 42, 0.42)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <div
              style={{
                width: "min(1040px, calc(100vw - 48px))",
                maxHeight: "calc(100vh - 48px)",
                overflow: "auto",
                background: "#ffffff",
                border: "1px solid #bfdbfe",
                borderRadius: 22,
                boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
                padding: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  alignItems: "flex-start",
                  marginBottom: 16,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#1d4ed8", letterSpacing: 1.2 }}>
                    IMPORT DETAIL
                  </div>
                  <h2 style={{ margin: "4px 0 6px", fontSize: 24 }}>Reference Import Detail</h2>
                </div>

                <button
                  onClick={() => setSelectedImportHistoryItem(null)}
                  style={{
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    color: "#0f172a",
                    borderRadius: 12,
                    padding: "10px 12px",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 16 }}>
                {[
                  ["Imported", formatDate(selectedImportHistoryItem.createdAt)],
                  ["Type", selectedImportHistoryItem.typeLabel || selectedImportHistoryItem.type || "—"],
                  ["Actor", selectedImportHistoryItem.actorName || "—"],
                  ["Rows Imported", selectedImportHistoryItem.imported?.rowsImported ?? 0],
                  ["Created", selectedImportHistoryItem.imported?.created ?? 0],
                  ["Updated", selectedImportHistoryItem.imported?.updated ?? 0],
                  ["Aliases Created", selectedImportHistoryItem.imported?.aliasesCreated ?? 0],
                  ["Aliases Skipped", selectedImportHistoryItem.imported?.aliasesSkippedExisting ?? 0],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    style={{
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      borderRadius: 14,
                      padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 900 }}>{label}</div>
                    <div style={{ fontSize: 15, fontWeight: 900, marginTop: 4 }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 16,
                    padding: 14,
                    background: "#ffffff",
                  }}
                >
                  <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>Preview Summary</h3>
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      padding: 12,
                      fontSize: 12,
                    }}
                  >
                    {prettyJson(selectedImportHistoryItem.previewSummary)}
                  </pre>
                </div>

                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 16,
                    padding: 14,
                    background: "#ffffff",
                  }}
                >
                  <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>Column Mapping</h3>
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      padding: 12,
                      fontSize: 12,
                    }}
                  >
                    {prettyJson(selectedImportHistoryItem.mappingSummary)}
                  </pre>
                </div>
              </div>

              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 16,
                  padding: 14,
                  background: "#ffffff",
                }}
              >
                <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>Imported Rows</h3>
                {selectedImportHistoryItem.importedRows?.length ? (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#eff6ff" }}>
                          {["CSV Row", "Action", "Display Name", "Aliases Created", "Aliases Skipped", "Entity ID"].map((header) => (
                            <th
                              key={header}
                              style={{
                                textAlign: "left",
                                padding: "9px 8px",
                                borderBottom: "1px solid #bfdbfe",
                                color: "#1e3a8a",
                                fontSize: 12,
                                fontWeight: 900,
                              }}
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedImportHistoryItem.importedRows.map((row) => (
                          <tr key={`${row.entityId}-${row.rowNumber}`} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ padding: "9px 8px", fontWeight: 800 }}>{row.rowNumber}</td>
                            <td style={{ padding: "9px 8px", fontWeight: 800 }}>{row.action}</td>
                            <td style={{ padding: "9px 8px", fontWeight: 800 }}>{row.displayName}</td>
                            <td style={{ padding: "9px 8px" }}>{row.aliasesCreated}</td>
                            <td style={{ padding: "9px 8px" }}>{row.aliasesSkippedExisting}</td>
                            <td style={{ padding: "9px 8px", color: "#64748b", fontSize: 11 }}>{row.entityId}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ color: "#64748b", fontWeight: 800 }}>No imported row details were recorded.</div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <section
          style={{
            border: "1px solid #dbeafe",
            background: "#ffffff",
            borderRadius: 22,
            padding: 18,
            marginBottom: 18,
            boxShadow: "0 18px 42px rgba(15, 23, 42, 0.10)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 14,
              alignItems: "flex-start",
              marginBottom: cleanupPreviewPanelOpen ? 14 : 0,
            }}
          >
            <div>
              <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>Import Cleanup Preview</h2>
              <p style={{ margin: 0, color: "#64748b", fontSize: 13, lineHeight: 1.45 }}>
                Preview imported reference records that could be deactivated later.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button
                onClick={() => setCleanupPreviewPanelOpen((value) => !value)}
                aria-expanded={cleanupPreviewPanelOpen}
                style={{
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  color: "#0f172a",
                  borderRadius: 12,
                  padding: "10px 12px",
                  fontWeight: 900,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {cleanupPreviewPanelOpen ? "Collapse" : "Expand"}
              </button>
            </div>
          </div>

          {cleanupPreviewPanelOpen ? (
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) 180px",
                  gap: 10,
                  alignItems: "end",
                  marginBottom: 12,
                }}
              >
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 6 }}>
                    Cleanup Search
                  </label>
                  <input
                    value={cleanupQuery}
                    onChange={(event) => setCleanupQuery(event.target.value)}
                    placeholder="Search imported records"
                    style={{
                      width: "100%",
                      padding: "11px 12px",
                      borderRadius: 12,
                      border: "1px solid #cbd5e1",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <button
                    onClick={() => loadCleanupPreview()}
                    disabled={cleanupPreviewLoading}
                    style={{
                      border: 0,
                      background: cleanupPreviewLoading ? "#94a3b8" : "#f59e0b",
                      color: "#ffffff",
                      borderRadius: 14,
                      padding: "12px 14px",
                      fontWeight: 900,
                      cursor: cleanupPreviewLoading ? "default" : "pointer",
                    }}
                  >
                    {cleanupPreviewLoading ? "Previewing..." : "Preview Cleanup"}
                  </button>

                  <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#334155" }}>
                    Type DEACTIVATE to enable cleanup
                  </label>
                  <input
                    value={cleanupConfirmText}
                    onChange={(event) => setCleanupConfirmText(event.target.value)}
                    placeholder="DEACTIVATE"
                    disabled={!cleanupPreview?.ok || !cleanupPreview?.eligibleCount || cleanupConfirming}
                    style={{
                      width: "100%",
                      padding: "10px 11px",
                      borderRadius: 12,
                      border: "1px solid #cbd5e1",
                      fontWeight: 900,
                      letterSpacing: 0.5,
                      background:
                        !cleanupPreview?.ok || !cleanupPreview?.eligibleCount || cleanupConfirming
                          ? "#f1f5f9"
                          : "#ffffff",
                    }}
                  />

                  <button
                    onClick={confirmCleanupDeactivate}
                    disabled={
                      cleanupConfirming ||
                      !cleanupPreview?.ok ||
                      !cleanupPreview?.eligibleCount ||
                      cleanupConfirmText.trim() !== "DEACTIVATE"
                    }
                    style={{
                      border: 0,
                      background:
                        cleanupConfirming ||
                        !cleanupPreview?.ok ||
                        !cleanupPreview?.eligibleCount ||
                        cleanupConfirmText.trim() !== "DEACTIVATE"
                          ? "#94a3b8"
                          : "#dc2626",
                      color: "#ffffff",
                      borderRadius: 14,
                      padding: "12px 14px",
                      fontWeight: 900,
                      cursor:
                        cleanupConfirming ||
                        !cleanupPreview?.ok ||
                        !cleanupPreview?.eligibleCount ||
                        cleanupConfirmText.trim() !== "DEACTIVATE"
                          ? "default"
                          : "pointer",
                    }}
                  >
                    {cleanupConfirming ? "Deactivating..." : "Confirm Deactivate Cleanup"}
                  </button>
                </div>
              </div>

              {cleanupPreview?.error ? (
                <div
                  style={{
                    border: "1px solid #fecaca",
                    background: "#fef2f2",
                    color: "#991b1b",
                    borderRadius: 14,
                    padding: 12,
                    fontWeight: 800,
                    marginBottom: 12,
                  }}
                >
                  {cleanupPreview.error}
                </div>
              ) : null}

              {cleanupPreview?.ok ? (
                <div
                  style={{
                    border: "1px solid #fde68a",
                    background: "#fffbeb",
                    color: "#92400e",
                    borderRadius: 14,
                    padding: 12,
                    fontWeight: 800,
                    marginBottom: 12,
                  }}
                >
                  Preview found {cleanupPreview.eligibleCount ?? 0} active imported records eligible for future deactivate-only cleanup.
                </div>
              ) : null}

              {cleanupConfirmResult?.ok ? (
                <div
                  style={{
                    border: "1px solid #bbf7d0",
                    background: "#f0fdf4",
                    color: "#166534",
                    borderRadius: 14,
                    padding: 12,
                    fontWeight: 800,
                    marginBottom: 12,
                  }}
                >
                  Confirmed deactivate cleanup: {cleanupConfirmResult.summary?.deactivated ?? 0} imported records deactivated.
                </div>
              ) : null}

              {cleanupPreview?.rows?.length ? (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#fffbeb" }}>
                        {["Name", "Source", "Aliases", "Visible Details", "Hidden/Internal", "Eligible", "Blocked Reasons"].map((header) => (
                          <th
                            key={header}
                            style={{
                              textAlign: "left",
                              padding: "10px 8px",
                              borderBottom: "1px solid #fde68a",
                              color: "#92400e",
                              fontSize: 12,
                              fontWeight: 900,
                            }}
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cleanupPreview.rows.map((row) => (
                        <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "10px 8px", fontWeight: 900 }}>{row.displayName}</td>
                          <td style={{ padding: "10px 8px" }}>{row.source}</td>
                          <td style={{ padding: "10px 8px" }}>{row.aliasCount}</td>
                          <td style={{ padding: "10px 8px" }}>
                            {row.visibleDetailKeys?.length ? row.visibleDetailKeys.join(", ") : "—"}
                          </td>
                          <td style={{ padding: "10px 8px" }}>
                            {row.hiddenInternalDetailKeys?.length ? row.hiddenInternalDetailKeys.join(", ") : "—"}
                          </td>
                          <td style={{ padding: "10px 8px", fontWeight: 900 }}>
                            {row.eligibleForDeactivate ? "Yes" : "No"}
                          </td>
                          <td style={{ padding: "10px 8px", color: row.blockedReasons?.length ? "#991b1b" : "#64748b" }}>
                            {row.blockedReasons?.length ? row.blockedReasons.join("; ") : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : cleanupPreview?.ok ? (
                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    borderRadius: 14,
                    padding: 14,
                    color: "#64748b",
                    fontWeight: 800,
                  }}
                >
                  No imported active records matched this cleanup preview.
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "360px minmax(0, 1fr)",
            gap: 18,
            alignItems: "start",
          }}
        >
          <aside
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 22,
              padding: 18,
              boxShadow: "0 18px 42px rgba(15, 23, 42, 0.10)",
            }}
          >
            <h2 style={{ margin: "0 0 14px", fontSize: 18 }}>Search Lists</h2>

            <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 6 }}>
              List Type
            </label>
            <select
              value={selectedType}
              onChange={(event) => {
                const nextType = event.target.value;
                setSelectedType(nextType);
                setSelectedRowId("");
                void loadRows(nextType, query, activeFilter, { selectedRowId: "" });
              }}
              style={{
                width: "100%",
                padding: "11px 12px",
                borderRadius: 12,
                border: "1px solid #cbd5e1",
                fontWeight: 800,
                marginBottom: 12,
              }}
            >
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 6 }}>
              Search
            </label>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void loadRows(selectedType, query, activeFilter, { selectedRowId });
                }
              }}
              placeholder="Name or alias"
              style={{
                width: "100%",
                padding: "11px 12px",
                borderRadius: 12,
                border: "1px solid #cbd5e1",
                marginBottom: 12,
              }}
            />

            <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 6 }}>
              Status
            </label>
            <select
              value={activeFilter}
              onChange={(event) => {
                const nextActive = event.target.value;
                setActiveFilter(nextActive);
                setSelectedRowId("");
                void loadRows(selectedType, query, nextActive, { selectedRowId: "" });
              }}
              style={{
                width: "100%",
                padding: "11px 12px",
                borderRadius: 12,
                border: "1px solid #cbd5e1",
                fontWeight: 800,
                marginBottom: 14,
              }}
            >
              <option value="all">Show Active + Inactive</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            <button
              onClick={() => loadRows()}
              disabled={loading}
              style={{
                width: "100%",
                border: 0,
                background: loading ? "#94a3b8" : "#2563eb",
                color: "#ffffff",
                borderRadius: 14,
                padding: "12px 14px",
                fontWeight: 900,
                cursor: loading ? "default" : "pointer",
              }}
            >
              {loading ? "Searching..." : "Search Local List"}
            </button>

            <div style={{ marginTop: 22, borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
              <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Add Record</h2>

              <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 6 }}>
                Display Name
              </label>
              <input
                value={newDisplayName}
                onChange={(event) => setNewDisplayName(event.target.value)}
                placeholder={`New ${selectedTypeLabel} record`}
                style={{
                  width: "100%",
                  padding: "11px 12px",
                  borderRadius: 12,
                  border: "1px solid #cbd5e1",
                  marginBottom: 10,
                }}
              />

              <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 6 }}>
                Notes
              </label>
              <textarea
                value={newNotes}
                onChange={(event) => setNewNotes(event.target.value)}
                placeholder="Optional local notes"
                rows={4}
                style={{
                  width: "100%",
                  padding: "11px 12px",
                  borderRadius: 12,
                  border: "1px solid #cbd5e1",
                  resize: "vertical",
                  marginBottom: 12,
                }}
              />

              <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 6 }}>
                Additional Details JSON
              </label>
              <textarea
                value={newDetailsJson}
                onChange={(event) => setNewDetailsJson(event.target.value)}
                placeholder={'Optional structured details, e.g. {"phone":"","address":{}}'}
                rows={5}
                style={{
                  width: "100%",
                  padding: "11px 12px",
                  borderRadius: 12,
                  border: "1px solid #cbd5e1",
                  resize: "vertical",
                  marginBottom: 12,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontSize: 12,
                }}
              />

              <button
                onClick={createRecord}
                disabled={saving}
                style={{
                  width: "100%",
                  border: 0,
                  background: saving ? "#94a3b8" : "#16a34a",
                  color: "#ffffff",
                  borderRadius: 14,
                  padding: "12px 14px",
                  fontWeight: 900,
                  cursor: saving ? "default" : "pointer",
                }}
              >
                {saving ? "Saving..." : "Add Local Record"}
              </button>
            </div>
          </aside>

          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 22,
              padding: 18,
              boxShadow: "0 18px 42px rgba(15, 23, 42, 0.10)",
              minHeight: 640,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "flex-start",
                marginBottom: 16,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 22 }}>{selectedTypeLabel}</h2>
                <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 13 }}>
                  Local Barsh Matters data.
                </p>
              </div>

              <button
                onClick={() => loadRows(selectedType, query, activeFilter, { selectedRowId })}
                disabled={loading}
                style={{
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  color: "#0f172a",
                  borderRadius: 12,
                  padding: "10px 12px",
                  fontWeight: 900,
                  cursor: loading ? "default" : "pointer",
                }}
              >
                Refresh
              </button>
            </div>

            {statusMessage && (
              <div
                style={{
                  background: "#ecfdf5",
                  border: "1px solid #bbf7d0",
                  color: "#166534",
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 12,
                  fontWeight: 700,
                }}
              >
                {statusMessage}
              </div>
            )}

            {errorMessage && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 12,
                  fontWeight: 700,
                }}
              >
                {errorMessage}
              </div>
            )}

            <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#334155" }}>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #e2e8f0" }}>Name</th>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #e2e8f0" }}>Status</th>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #e2e8f0" }}>Aliases</th>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #e2e8f0" }}>Source</th>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #e2e8f0" }}>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 22, color: "#64748b", textAlign: "center" }}>
                        No records found.  Add records when you are ready to populate this local list.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => {
                          setSelectedRowId(row.id);
                          if (typeof window !== "undefined") {
                            const nextUrl = referenceDataUrlForState({
                              type: selectedType,
                              q: query,
                              active: activeFilter,
                              selectedRowId: row.id,
                            });
                            window.history.pushState({ barshMattersReferenceDataSearch: true }, "", nextUrl);
                          }
                        }}
                        style={{
                          cursor: "pointer",
                          background: row.id === selectedRowId ? "#eff6ff" : "#ffffff",
                        }}
                      >
                        <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0", fontWeight: 900 }}>
                          {row.displayName}
                          <div style={{ marginTop: 4, fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                            {row.normalizedName}
                          </div>
                        </td>
                        <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
                          <span style={pillStyle(row.active)}>{activeLabel(row.active)}</span>
                        </td>
                        <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0", color: "#334155" }}>
                          {row.aliases?.length ? row.aliases.map((alias) => alias.alias).join(", ") : "—"}
                        </td>
                        <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0", color: "#334155" }}>
                          {row.source || "barsh-matters-local"}
                        </td>
                        <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0", color: "#334155" }}>
                          {formatDate(row.updatedAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div
              style={{
                marginTop: 18,
                border: "1px solid #e2e8f0",
                borderRadius: 18,
                padding: 16,
                background: selectedRow ? "#f8fafc" : "#ffffff",
              }}
            >
              <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>Selected Record</h2>

              {!selectedRow ? (
                <p style={{ color: "#64748b", margin: 0 }}>
                  Select a row to edit its display name, notes, status, or aliases.
                </p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 16 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <strong>{selectedRow.displayName}</strong>
                      <span style={pillStyle(selectedRow.active)}>{activeLabel(selectedRow.active)}</span>
                    </div>

                    <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 6 }}>
                      Display Name
                    </label>
                    <input
                      value={editDisplayName}
                      onChange={(event) => setEditDisplayName(event.target.value)}
                      style={{
                        width: "100%",
                        padding: "11px 12px",
                        borderRadius: 12,
                        border: "1px solid #cbd5e1",
                        marginBottom: 10,
                      }}
                    />

                    <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 6 }}>
                      Notes
                    </label>
                    <textarea
                      value={editNotes}
                      onChange={(event) => setEditNotes(event.target.value)}
                      rows={4}
                      style={{
                        width: "100%",
                        padding: "11px 12px",
                        borderRadius: 12,
                        border: "1px solid #cbd5e1",
                        resize: "vertical",
                        marginBottom: 12,
                      }}
                    />

                    <div
                      style={{
                        border: "1px solid #dbeafe",
                        background: "#eff6ff",
                        borderRadius: 14,
                        padding: 12,
                        marginBottom: 12,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 900, color: "#1e3a8a", marginBottom: 4 }}>
                        Stored Reference Details
                      </div>
                      <div style={{ color: "#475569", fontSize: 12, lineHeight: 1.45, marginBottom: 8 }}>
                        Visible detail fields: {selectedVisibleDetailCount}.  Hidden/internal fields available for detail view
                        and document generation: {selectedHiddenDetailCount}.
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedReferenceDetailRow(selectedRow)}
                        disabled={selectedVisibleDetailCount + selectedHiddenDetailCount === 0}
                        style={{
                          border: "1px solid #bfdbfe",
                          background: selectedVisibleDetailCount + selectedHiddenDetailCount === 0 ? "#e2e8f0" : "#ffffff",
                          color: selectedVisibleDetailCount + selectedHiddenDetailCount === 0 ? "#64748b" : "#1d4ed8",
                          borderRadius: 10,
                          padding: "7px 10px",
                          fontWeight: 900,
                          cursor: selectedVisibleDetailCount + selectedHiddenDetailCount === 0 ? "default" : "pointer",
                        }}
                      >
                        View Stored Details
                      </button>
                    </div>

                    <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 6 }}>
                      Additional Details JSON
                    </label>
                    <textarea
                      value={editDetailsJson}
                      onChange={(event) => setEditDetailsJson(event.target.value)}
                      rows={8}
                      style={{
                        width: "100%",
                        padding: "11px 12px",
                        borderRadius: 12,
                        border: "1px solid #cbd5e1",
                        resize: "vertical",
                        marginBottom: 12,
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        fontSize: 12,
                      }}
                    />

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        onClick={() => updateRecord("update")}
                        disabled={saving}
                        style={{
                          border: 0,
                          background: saving ? "#94a3b8" : "#2563eb",
                          color: "#ffffff",
                          borderRadius: 12,
                          padding: "10px 13px",
                          fontWeight: 900,
                          cursor: saving ? "default" : "pointer",
                        }}
                      >
                        Save Edit
                      </button>

                      {selectedRow.active ? (
                        <button
                          onClick={() => updateRecord("deactivate")}
                          disabled={saving}
                          style={{
                            border: "1px solid #fecaca",
                            background: "#fef2f2",
                            color: "#991b1b",
                            borderRadius: 12,
                            padding: "10px 13px",
                            fontWeight: 900,
                            cursor: saving ? "default" : "pointer",
                          }}
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => updateRecord("reactivate")}
                          disabled={saving}
                          style={{
                            border: "1px solid #bbf7d0",
                            background: "#ecfdf5",
                            color: "#166534",
                            borderRadius: 12,
                            padding: "10px 13px",
                            fontWeight: 900,
                            cursor: saving ? "default" : "pointer",
                          }}
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 16,
                      padding: 14,
                      background: "#ffffff",
                    }}
                  >
                    <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>Aliases / Search Terms</h3>
                    <div style={{ marginBottom: 12, color: "#475569", fontSize: 13, lineHeight: 1.4 }}>
                      Add messy names, abbreviations, or alternate spellings without changing the canonical display name.
                    </div>

                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                      <input
                        value={newAlias}
                        onChange={(event) => setNewAlias(event.target.value)}
                        placeholder="Add alias"
                        style={{
                          flex: 1,
                          minWidth: 0,
                          padding: "10px 11px",
                          borderRadius: 12,
                          border: "1px solid #cbd5e1",
                        }}
                      />
                      <button
                        onClick={addAlias}
                        disabled={saving}
                        style={{
                          border: 0,
                          background: saving ? "#94a3b8" : "#0f172a",
                          color: "#ffffff",
                          borderRadius: 12,
                          padding: "10px 12px",
                          fontWeight: 900,
                          cursor: saving ? "default" : "pointer",
                        }}
                      >
                        Add
                      </button>
                    </div>

                    {selectedRow.aliases?.length ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {selectedRow.aliases.map((alias) => (
                          <div
                            key={alias.id}
                            style={{
                              border: "1px solid #e2e8f0",
                              borderRadius: 12,
                              padding: 10,
                              background: "#f8fafc",
                            }}
                          >
                            <strong>{alias.alias}</strong>
                            <div style={{ marginTop: 3, fontSize: 12, color: "#64748b" }}>
                              {alias.normalizedAlias}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: "#64748b", fontSize: 13 }}>No aliases yet.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
