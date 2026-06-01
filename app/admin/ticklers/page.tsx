"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type TicklerRow = {
  id: string;
  kind: string;
  status: string;
  priority: string;
  title: string;
  description?: string | null;
  masterLawsuitId?: string | null;
  matterId?: number | null;
  displayNumber?: string | null;
  settlementRecordId?: string | null;
  dueDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ReferenceOption = {
  id?: string;
  value?: string;
  label?: string;
  displayName?: string;
  name?: string;
};

type ReferenceOptionsResponse = {
  ok?: boolean;
  type?: string;
  options?: ReferenceOption[];
  error?: string;
};

type TicklerSearchResponse = {
  ok?: boolean;
  action?: string;
  count?: number;
  filters?: Record<string, unknown>;
  availableFilters?: {
    kinds?: string[];
    statuses?: string[];
  };
  ticklers?: TicklerRow[];
  error?: string;
  safety?: Record<string, unknown>;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function formatDate(value: unknown): string {
  const raw = text(value);
  if (!raw) return "—";
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[2]}/${match[3]}/${match[1]}`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function kindLabel(value: unknown): string {
  const raw = text(value);
  if (!raw) return "—";
  if (raw === "settlement_payment_due_followup") return "Settlement: Follow-Up for Payment";
  if (raw === "settlement_signed_agreement_followup") return "Settlement: Follow-Up for Signed Agreement";
  return raw
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function ticklerMatterHref(tickler: any): string {
  const caseMatter = text(tickler?.caseData?.matter);
  const caseMaster = text(tickler?.caseData?.masterLawsuit);
  const displayNumber = text(tickler?.displayNumber);
  const matterId = text(tickler?.matterId);

  if (caseMaster && caseMatter === caseMaster) {
    return `/matters?master=${encodeURIComponent(caseMaster)}`;
  }

  if (caseMatter && /^\d{4}\.\d{2}\.\d{5}$/.test(caseMatter)) {
    return `/matters?master=${encodeURIComponent(caseMatter)}`;
  }

  if (displayNumber && /^BRL\d+$/i.test(displayNumber)) {
    return `/matter/${encodeURIComponent(matterId || displayNumber.replace(/\D/g, ""))}`;
  }

  if (matterId) {
    return `/matter/${encodeURIComponent(matterId)}`;
  }

  return "";
}

function ticklerMasterHref(tickler: any): string {
  const master = text(tickler?.caseData?.masterLawsuit || tickler?.masterLawsuitId);
  return master ? `/matters?master=${encodeURIComponent(master)}` : "";
}

const linkStyle = {
  color: "#1d4ed8",
  fontWeight: 900,
  textDecoration: "underline",
  textUnderlineOffset: 3,
} as const;

function safeExportCell(value: unknown): string {
  const raw = text(value);
  return raw || "";
}

const standardCaseExportHeaders = [
  "Due",
  "Type",
  "Created",
  "Updated",
  "Matter",
  "Master Lawsuit",
  "Provider",
  "Patient",
  "Insurer",
  "Claim Number",
  "Date of Loss",
  "Court",
  "Index Number",
  "Date Filed",
  "Settled Date",
  "Settled With",
  "Denial Reason",
  "Status",
  "Closed Reason",
  "Closed Date",
];

function downloadWorkbookRows(headers: string[], rows: unknown[][], filename: string, sheetName: string) {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

function pickAny(source: any, keys: string[]): string {
  for (const key of keys) {
    const value = source?.[key];
    const cleaned = safeExportCell(value);
    if (cleaned) return cleaned;
  }
  return "";
}

function pickMeta(source: any, keys: string[]): string {
  const metadata = source?.metadata && typeof source.metadata === "object" ? source.metadata : {};
  for (const key of keys) {
    const value = metadata?.[key];
    const cleaned = safeExportCell(value);
    if (cleaned) return cleaned;
  }
  return "";
}


function timestampForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}


const inputStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 14,
  width: "100%",
  background: "#fff",
} as const;

const referenceOptionTypes = {
  provider: "provider_client",
  insurer: "insurer_company",
  serviceType: "service_type",
  denialReason: "denial_reason",
  closedReason: "closed_reason",
  court: "court_venue",
  treatingProvider: "treating_provider",
};

function optionText(option: ReferenceOption): string {
  return text(option.displayName || option.label || option.value || option.name || "");
}

function formatAdminTicklerDetailValue(value: any): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function adminTicklerDetailSourceFields(tickler: any): Record<string, unknown> {
  const metadata = tickler?.metadata && typeof tickler.metadata === "object" ? tickler.metadata : {};
  const source = tickler?.source && typeof tickler.source === "object" ? tickler.source : {};
  const caseData = tickler?.caseData && typeof tickler.caseData === "object" ? tickler.caseData : {};

  return {
    id: tickler?.id,
    kind: tickler?.kind,
    type: tickler?.type,
    status: tickler?.status,
    priority: tickler?.priority,
    title: tickler?.title,
    source,
    sourceId: tickler?.sourceId,
    sourceType: tickler?.sourceType,
    sourceScope: tickler?.sourceScope,
    sourcePage: tickler?.sourcePage,
    sourceAction: tickler?.sourceAction,
    sourceWorkflow: tickler?.sourceWorkflow,
    metadata,
    metadataSource: metadata?.source,
    metadataSourcePage: metadata?.sourcePage,
    metadataWorkflow: metadata?.workflow,
    caseDataSource: caseData?.source,
    createdAt: tickler?.createdAt,
    updatedAt: tickler?.updatedAt,
  };
}

function AdminTicklerDetailJsonSection({ title, value }: { title: string; value: any }) {
  return (
    <section
      data-barsh-admin-tickler-detail-json-section={title}
      style={{
        border: "1px solid #d6e0ef",
        borderRadius: 10,
        padding: 12,
        background: "#f8fbff",
      }}
    >
      <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>{title}</h4>
      <pre
        style={{
          margin: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: 12,
          lineHeight: 1.45,
          maxHeight: 260,
          overflow: "auto",
          background: "#ffffff",
          border: "1px solid #e4e9f2",
          borderRadius: 8,
          padding: 10,
        }}
      >
        {formatAdminTicklerDetailValue(value)}
      </pre>
    </section>
  );
}

export default function AdminTicklersPage() {
  const [kind, setKind] = useState("all");
  const [dueBefore, setDueBefore] = useState("");
  const [dueAfter, setDueAfter] = useState("");
  const [masterLawsuitId, setMasterLawsuitId] = useState("");
  const [displayNumber, setDisplayNumber] = useState("");
  const [patient, setPatient] = useState("");
  const [provider, setProvider] = useState("");
  const [insuranceCompany, setInsuranceCompany] = useState("");
  const [claim, setClaim] = useState("");
  const [indexAaaNumber, setIndexAaaNumber] = useState("");
  const [dosStart, setDosStart] = useState("");
  const [dosEnd, setDosEnd] = useState("");
  const [denialReason, setDenialReason] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [claimStatus, setClaimStatus] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [selectedTicklerDetail, setSelectedTicklerDetail] = useState<any | null>(null);
  const [duplicateDiagnosticLoading, setDuplicateDiagnosticLoading] = useState(false);
  const [duplicateDiagnosticResult, setDuplicateDiagnosticResult] = useState<any | null>(null);
  const [duplicateCleanupPreviewLoading, setDuplicateCleanupPreviewLoading] = useState(false);
  const [duplicateCleanupPreviewResult, setDuplicateCleanupPreviewResult] = useState<any | null>(null);

  const [ticklerStatusMode, setTicklerStatusMode] = useState<"open" | "completed">("open");
  const [finalStatus, setFinalStatus] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [dateOfLoss, setDateOfLoss] = useState("");
  const [treatingProvider, setTreatingProvider] = useState("");
  const [matterStage, setMatterStage] = useState("");
  const [court, setCourt] = useState("");
  const [dateFiledFrom, setDateFiledFrom] = useState("");
  const [dateFiledTo, setDateFiledTo] = useState("");
  const [result, setResult] = useState<TicklerSearchResponse | null>(null);
  const [searched, setSearched] = useState(false);
  const [ticklerKindOptions, setTicklerKindOptions] = useState<string[]>([]);
  const [referenceOptions, setReferenceOptions] = useState<Record<string, ReferenceOption[]>>({});
  const [referenceOptionsLoading, setReferenceOptionsLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const kinds = useMemo(
    () => ticklerKindOptions.length ? ticklerKindOptions : result?.availableFilters?.kinds || [],
    [result, ticklerKindOptions]
  );

  async function loadTicklerFilterOptions() {
    try {
      const response = await fetch("/api/admin/ticklers/search?kind=all&status=all&limit=1");
      const json = (await response.json().catch(() => ({}))) as TicklerSearchResponse;
      setTicklerKindOptions(Array.isArray(json.availableFilters?.kinds) ? json.availableFilters.kinds : []);
    } catch {
      setTicklerKindOptions([]);
    }
  }

  async function loadReferenceOptions() {
    setReferenceOptionsLoading(true);
    try {
      const entries = await Promise.all(
        Object.entries(referenceOptionTypes).map(async ([key, type]) => {
          const response = await fetch(`/api/reference-data/options?type=${encodeURIComponent(type)}`);
          const json = (await response.json().catch(() => ({}))) as ReferenceOptionsResponse;
          return [key, Array.isArray(json.options) ? json.options : []] as const;
        })
      );
      setReferenceOptions(Object.fromEntries(entries));
    } catch {
      setReferenceOptions({});
    } finally {
      setReferenceOptionsLoading(false);
    }
  }

  function renderReferenceDatalist(id: string, options: ReferenceOption[]) {
    return (
      <datalist id={id}>
        {options.map((option, index) => {
          const value = optionText(option);
          if (!value) return null;
          return <option key={`${id}-${option.id || value}-${index}`} value={value} />;
        })}
      </datalist>
    );
  }

  function exportTicklerResultsXlsx() {
    const rows = Array.isArray(result?.ticklers) ? result.ticklers : [];

    if (!rows.length) return;

    downloadWorkbookRows(
      standardCaseExportHeaders,
      rows.map((tickler: any) => [
        formatDate(tickler.dueDate),
        kindLabel(tickler.kind),
        formatDate(tickler.createdAt),
        formatDate(tickler.updatedAt),
        safeExportCell(tickler.caseData?.matter || tickler.masterLawsuitId || tickler.displayNumber || tickler.matterId),
        safeExportCell(tickler.caseData?.masterLawsuit || tickler.masterLawsuitId),
        safeExportCell(tickler.caseData?.provider),
        safeExportCell(tickler.caseData?.patient),
        safeExportCell(tickler.caseData?.insurer),
        safeExportCell(tickler.caseData?.claimNumber),
        safeExportCell(tickler.caseData?.dateOfLoss),
        safeExportCell(tickler.caseData?.court),
        safeExportCell(tickler.caseData?.indexNumber),
        safeExportCell(tickler.caseData?.dateFiled),
        safeExportCell(tickler.caseData?.settledDate),
        safeExportCell(tickler.caseData?.settledWith),
        safeExportCell(tickler.caseData?.denialReason),
        safeExportCell(tickler.caseData?.status || tickler.status),
        safeExportCell(tickler.caseData?.closedReason),
        safeExportCell(tickler.caseData?.closedDate),
      ]),
      `barsh-matters-ticklers-${timestampForFilename()}.xlsx`,
      "Ticklers"
    );
  }

  async function loadTicklers() {
    setSearched(true);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("kind", kind);
      params.set("status", ticklerStatusMode);
      params.set("limit", "100");
      if (dueBefore) params.set("dueBefore", dueBefore);
      if (dueAfter) params.set("dueAfter", dueAfter);
      if (masterLawsuitId.trim()) params.set("masterLawsuitId", masterLawsuitId.trim());
      if (displayNumber.trim()) params.set("displayNumber", displayNumber.trim());
      if (patient.trim()) params.set("patient", patient.trim());
      if (provider.trim()) params.set("provider", provider.trim());
      if (insuranceCompany.trim()) params.set("insuranceCompany", insuranceCompany.trim());
      if (claim.trim()) params.set("claim", claim.trim());
      if (indexAaaNumber.trim()) params.set("indexAaaNumber", indexAaaNumber.trim());
      if (dosStart) params.set("dosStart", dosStart);
      if (dosEnd) params.set("dosEnd", dosEnd);
      if (denialReason.trim()) params.set("denialReason", denialReason.trim());
      if (serviceType.trim()) params.set("serviceType", serviceType.trim());
      if (claimStatus.trim()) params.set("claimStatus", claimStatus.trim());
      if (closeReason.trim()) params.set("closeReason", closeReason.trim());
      if (finalStatus.trim()) params.set("finalStatus", finalStatus.trim());
      if (billNumber.trim()) params.set("billNumber", billNumber.trim());
      if (policyNumber.trim()) params.set("policyNumber", policyNumber.trim());
      if (dateOfLoss) params.set("dateOfLoss", dateOfLoss);
      if (treatingProvider.trim()) params.set("treatingProvider", treatingProvider.trim());
      if (matterStage.trim()) params.set("matterStage", matterStage.trim());
      if (court.trim()) params.set("court", court.trim());
      if (dateFiledFrom) params.set("dateFiledFrom", dateFiledFrom);
      if (dateFiledTo) params.set("dateFiledTo", dateFiledTo);

      const response = await fetch(`/api/admin/ticklers/search?${params.toString()}`);
      const json = await response.json().catch(() => ({}));
      setResult({ ...json, httpStatus: response.status } as TicklerSearchResponse);
    } catch (error: any) {
      setResult({
        ok: false,
        action: "admin-generic-tickler-search",
        error: error?.message || "Tickler search failed.",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleTicklerSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void loadTicklers();
  }

  useEffect(() => {
    void loadTicklerFilterOptions();
    void loadReferenceOptions();
  }, []);

  async function previewDuplicateSettlementTicklers() {
    setDuplicateDiagnosticLoading(true);
    setDuplicateDiagnosticResult(null);

    try {
      const response = await fetch("/api/admin/ticklers/duplicates");
      const json = await response.json().catch(() => ({}));
      setDuplicateDiagnosticResult({ ...json, httpStatus: response.status });
    } catch (error: any) {
      setDuplicateDiagnosticResult({
        ok: false,
        error: error?.message || "Unable to preview duplicate settlement ticklers.",
      });
    } finally {
      setDuplicateDiagnosticLoading(false);
    }
  }

  async function previewDuplicateSettlementTicklerCleanup() {
    setDuplicateCleanupPreviewLoading(true);
    setDuplicateCleanupPreviewResult(null);

    try {
      const response = await fetch("/api/admin/ticklers/duplicates/cleanup-preview");
      const json = await response.json().catch(() => ({}));
      setDuplicateCleanupPreviewResult({ ...json, httpStatus: response.status });
    } catch (error: any) {
      setDuplicateCleanupPreviewResult({
        ok: false,
        error: error?.message || "Unable to preview duplicate settlement tickler cleanup plan.",
      });
    } finally {
      setDuplicateCleanupPreviewLoading(false);
    }
  }


  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", padding: 32 }}>
      <details
        data-barsh-admin-duplicate-settlement-tickler-compact-panel="true"
        style={{
          border: "1px solid #d7e0ec",
          borderRadius: 12,
          marginBottom: 12,
          background: "#fffdf7",
        }}
      >
        <summary
          data-barsh-admin-duplicate-settlement-tickler-compact-summary="true"
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "center",
            padding: "10px 12px",
            cursor: "pointer",
            fontWeight: 800,
          }}
        >
          <span>Duplicate Tickler Tools</span>
          <span style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>
            Preview duplicate diagnostics and cleanup plan
          </span>
        </summary>
        <div
          data-barsh-admin-duplicate-settlement-tickler-compact-body="true"
          style={{ borderTop: "1px solid #f1e2b8", padding: 0 }}
        >
      <section
        data-barsh-admin-duplicate-settlement-tickler-diagnostic="true"
        style={{
          border: "1px solid #d7e0ec",
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
          background: "#fffdf7",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
          <div>
            <strong>Duplicate Settlement Tickler Diagnostic</strong>
            <div style={{ color: "#475569", fontSize: 13 }}>
              Read-only preview of duplicate open settlement payment follow-up ticklers grouped by settlement record, master lawsuit, and due date.  No delete, complete, merge, reopen, rerun, payment, closure, Clio, email, print, queue, or write action is available here.
            </div>
          </div>
          <button
            type="button"
            data-barsh-admin-duplicate-settlement-tickler-preview-button="true"
            onClick={previewDuplicateSettlementTicklers}
            disabled={duplicateDiagnosticLoading}
            style={{
              border: "1px solid #7f1d1d",
              background: "#ffffff",
              color: "#7f1d1d",
              borderRadius: 10,
              padding: "8px 12px",
              fontWeight: 800,
              cursor: duplicateDiagnosticLoading ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {duplicateDiagnosticLoading ? "Checking..." : "Preview Duplicates"}
          </button>
          <button
            type="button"
            data-barsh-admin-duplicate-settlement-tickler-cleanup-preview-button="true"
            onClick={previewDuplicateSettlementTicklerCleanup}
            disabled={duplicateCleanupPreviewLoading}
            style={{
              border: "1px solid #92400e",
              background: "#ffffff",
              color: "#92400e",
              borderRadius: 10,
              padding: "8px 12px",
              fontWeight: 800,
              cursor: duplicateCleanupPreviewLoading ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              marginLeft: 8,
            }}
          >
            {duplicateCleanupPreviewLoading ? "Building Plan..." : "Preview Cleanup Plan"}
          </button>
        </div>

        {duplicateCleanupPreviewResult ? (
          <div
            data-barsh-admin-duplicate-settlement-tickler-cleanup-preview-results="true"
            style={{ marginTop: 12, borderTop: "1px solid #f1e2b8", paddingTop: 12 }}
          >
            {!duplicateCleanupPreviewResult.ok ? (
              <p style={{ margin: 0, color: "#991b1b", fontWeight: 700 }}>
                {duplicateCleanupPreviewResult.error || "Duplicate cleanup preview failed."}
              </p>
            ) : (
              <>
                <p style={{ margin: "0 0 8px", color: "#92400e", fontWeight: 800 }}>
                  Cleanup preview found {duplicateCleanupPreviewResult.cleanupPreviewGroupCount || 0} duplicate group(s) and {duplicateCleanupPreviewResult.wouldRemoveTotal || 0} would-remove candidate(s).  No cleanup performed.  No write performed.
                </p>
                {(duplicateCleanupPreviewResult.cleanupPreviewGroups || []).length === 0 ? (
                  <p style={{ margin: 0, color: "#64748b" }}>No duplicate cleanup candidates found.</p>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {(duplicateCleanupPreviewResult.cleanupPreviewGroups || []).map((group: any) => (
                      <div
                        key={group.key}
                        data-barsh-admin-duplicate-settlement-tickler-cleanup-preview-group="true"
                        style={{
                          border: "1px solid #fed7aa",
                          borderRadius: 10,
                          padding: 10,
                          background: "#fff7ed",
                        }}
                      >
                        <div style={{ fontWeight: 800 }}>
                          {group.masterLawsuitId || "No master lawsuit"} / {group.settlementRecordId || "No settlement record"} / Due {group.dueDate || "—"}
                        </div>
                        <div style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>
                          Would retain: {group.wouldRetainId || "—"}.  Would remove: {(group.wouldRemoveCandidateIds || []).join(", ") || "—"}.
                        </div>
                        <pre
                          style={{
                            margin: "8px 0 0",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            fontSize: 12,
                            background: "#ffffff",
                            border: "1px solid #fed7aa",
                            borderRadius: 8,
                            padding: 8,
                            maxHeight: 180,
                            overflow: "auto",
                          }}
                        >
                          {JSON.stringify(group, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ) : null}

        {duplicateDiagnosticResult ? (
          <div
            data-barsh-admin-duplicate-settlement-tickler-results="true"
            style={{ marginTop: 12, borderTop: "1px solid #f1e2b8", paddingTop: 12 }}
          >
            {!duplicateDiagnosticResult.ok ? (
              <p style={{ margin: 0, color: "#991b1b", fontWeight: 700 }}>
                {duplicateDiagnosticResult.error || "Duplicate diagnostic failed."}
              </p>
            ) : (
              <>
                <p style={{ margin: "0 0 8px", color: "#7f1d1d", fontWeight: 800 }}>
                  Found {duplicateDiagnosticResult.duplicateGroupCount || 0} duplicate group(s) from {duplicateDiagnosticResult.checkedCount || 0} checked open settlement payment follow-up tickler(s).  No write performed.
                </p>
                {(duplicateDiagnosticResult.duplicateGroups || []).length === 0 ? (
                  <p style={{ margin: 0, color: "#64748b" }}>No duplicate open settlement payment follow-up ticklers found.</p>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {(duplicateDiagnosticResult.duplicateGroups || []).map((group: any) => (
                      <div
                        key={group.key}
                        data-barsh-admin-duplicate-settlement-tickler-group="true"
                        style={{
                          border: "1px solid #fde68a",
                          borderRadius: 10,
                          padding: 10,
                          background: "#fffbeb",
                        }}
                      >
                        <div style={{ fontWeight: 800 }}>
                          {group.masterLawsuitId || "No master lawsuit"} / {group.settlementRecordId || "No settlement record"} / Due {group.dueDate || "—"}
                        </div>
                        <div style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>
                          Count: {group.count}.  Retain candidate: {group.retainedCandidateId || "—"}.  Duplicate candidates: {(group.duplicateCandidateIds || []).join(", ") || "—"}.
                        </div>
                        <pre
                          style={{
                            margin: "8px 0 0",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            fontSize: 12,
                            background: "#ffffff",
                            border: "1px solid #f1e2b8",
                            borderRadius: 8,
                            padding: 8,
                            maxHeight: 180,
                            overflow: "auto",
                          }}
                        >
                          {JSON.stringify(group.ticklers || [], null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ) : null}
      </section>

        </div>
      </details>

      <div
        data-barsh-admin-tickler-completed-history-controls="true"
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "center",
          marginBottom: 12,
          padding: 12,
          border: "1px solid #d7e0ec",
          borderRadius: 12,
          background: "#f8fbff",
        }}
      >
        <div>
          <strong>Tickler Search Mode</strong>
          <div style={{ color: "#475569", fontSize: 13 }}>
            Open mode searches active ticklers.  Completed History is read-only audit review and does not reopen, rerun, process, complete, pay, close, or modify ticklers.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            data-barsh-admin-tickler-open-mode-button="true"
            onClick={() => setTicklerStatusMode("open")}
            style={{
              border: ticklerStatusMode === "open" ? "1px solid #1f4f73" : "1px solid #cbd5e1",
              background: ticklerStatusMode === "open" ? "#1f4f73" : "#ffffff",
              color: ticklerStatusMode === "open" ? "#ffffff" : "#1f2937",
              borderRadius: 10,
              padding: "8px 12px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Open Ticklers
          </button>
          <button
            type="button"
            data-barsh-admin-tickler-completed-history-button="true"
            onClick={() => setTicklerStatusMode("completed")}
            style={{
              border: ticklerStatusMode === "completed" ? "1px solid #7f1d1d" : "1px solid #cbd5e1",
              background: ticklerStatusMode === "completed" ? "#7f1d1d" : "#ffffff",
              color: ticklerStatusMode === "completed" ? "#ffffff" : "#1f2937",
              borderRadius: 10,
              padding: "8px 12px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Completed History
          </button>
        </div>
      </div>

      <div
        data-barsh-admin-tickler-bulk-runner-nav="true"
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 12,
        }}
      >
        <a
          href="/admin/ticklers/runner"
          data-barsh-admin-tickler-bulk-runner-link="true"
          style={{
            border: "1px solid #7f1d1d",
            background: "#7f1d1d",
            color: "#ffffff",
            borderRadius: 10,
            padding: "9px 14px",
            textDecoration: "none",
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          Open Bulk Runner
        </a>
      </div>

      <div style={{ maxWidth: 1220, margin: "0 auto", display: "grid", gap: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", color: "#475569", fontWeight: 900 }}>
              Administrator
            </div>
            <h1 style={{ margin: "4px 0 0", fontSize: 34 }}>Ticklers</h1>
          </div>
          <Link
            href="/admin"
            style={{
              border: "1px solid #cbd5e1",
              background: "#fff",
              color: "#1d4ed8",
              borderRadius: 999,
              padding: "10px 14px",
              fontWeight: 900,
              textDecoration: "none",
            }}
          >
            Back to Admin Home
          </Link>
        </div>

        <section
          style={{
            border: "1px solid #dbeafe",
            borderRadius: 18,
            background: "#eff6ff",
            padding: 18,
            display: "grid",
            gap: 14,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(180px, 1fr))", gap: 12 }}>
            <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#334155" }}>
              Type / Kind
              <select value={kind} onChange={(event) => setKind(event.target.value)} onKeyDown={handleTicklerSearchKeyDown} style={inputStyle}>
                <option value="all">All types</option>
                {kinds.map((item) => (
                  <option key={item} value={item}>
                    {kindLabel(item)}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#334155" }}>
              Due From
              <input type="date" value={dueAfter} onChange={(event) => setDueAfter(event.target.value)} onKeyDown={handleTicklerSearchKeyDown} style={inputStyle} />
            </label>

            <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#334155" }}>
              Due Through
              <input type="date" value={dueBefore} onChange={(event) => setDueBefore(event.target.value)} onKeyDown={handleTicklerSearchKeyDown} style={inputStyle} />
            </label>
          </div>

          <div
            style={{
              borderTop: "1px solid #bfdbfe",
              paddingTop: 14,
              marginTop: 2,
              color: "#1e3a8a",
              fontSize: 13,
              fontWeight: 950,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Search Criteria{referenceOptionsLoading ? " · loading dropdowns..." : ""}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(160px, 1fr))", gap: 12 }}>
            <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#334155" }}>
              Provider / Client
              <input list="admin-tickler-provider-options" value={provider} onChange={(event) => setProvider(event.target.value)} onKeyDown={handleTicklerSearchKeyDown} placeholder="Provider or client" style={inputStyle} />
              {renderReferenceDatalist("admin-tickler-provider-options", referenceOptions.provider || [])}
            </label>

            <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#334155" }}>
              Patient
              <input value={patient} onChange={(event) => setPatient(event.target.value)} onKeyDown={handleTicklerSearchKeyDown} placeholder="Patient name" style={inputStyle} />
            </label>

            <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#334155" }}>
              Insurance Company
              <input list="admin-tickler-insurer-options" value={insuranceCompany} onChange={(event) => setInsuranceCompany(event.target.value)} onKeyDown={handleTicklerSearchKeyDown} placeholder="Insurer" style={inputStyle} />
              {renderReferenceDatalist("admin-tickler-insurer-options", referenceOptions.insurer || [])}
            </label>

            <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#334155" }}>
              Claim Number
              <input value={claim} onChange={(event) => setClaim(event.target.value)} onKeyDown={handleTicklerSearchKeyDown} placeholder="Claim number" style={inputStyle} />
            </label>

            <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#334155" }}>
              Date of Loss
              <input type="date" value={dateOfLoss} onChange={(event) => setDateOfLoss(event.target.value)} onKeyDown={handleTicklerSearchKeyDown} style={inputStyle} />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(160px, 1fr))", gap: 12 }}>
            <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#334155" }}>
              Service Type
              <input list="admin-tickler-service-type-options" value={serviceType} onChange={(event) => setServiceType(event.target.value)} onKeyDown={handleTicklerSearchKeyDown} placeholder="Service type" style={inputStyle} />
              {renderReferenceDatalist("admin-tickler-service-type-options", referenceOptions.serviceType || [])}
            </label>

            <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#334155" }}>
              Treating Provider
              <input list="admin-tickler-treating-provider-options" value={treatingProvider} onChange={(event) => setTreatingProvider(event.target.value)} onKeyDown={handleTicklerSearchKeyDown} placeholder="Treating provider" style={inputStyle} />
              {renderReferenceDatalist("admin-tickler-treating-provider-options", referenceOptions.treatingProvider || [])}
            </label>

            <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#334155" }}>
              Denial Reason
              <input list="admin-tickler-denial-reason-options" value={denialReason} onChange={(event) => setDenialReason(event.target.value)} onKeyDown={handleTicklerSearchKeyDown} placeholder="Denial reason" style={inputStyle} />
              {renderReferenceDatalist("admin-tickler-denial-reason-options", referenceOptions.denialReason || [])}
            </label>

            <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#334155" }}>
              Status
              <input value={claimStatus} onChange={(event) => setClaimStatus(event.target.value)} onKeyDown={handleTicklerSearchKeyDown} placeholder="Matter status" style={inputStyle} />
            </label>

            <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#334155" }}>
              Closed Reason
              <input list="admin-tickler-closed-reason-options" value={closeReason} onChange={(event) => setCloseReason(event.target.value)} onKeyDown={handleTicklerSearchKeyDown} placeholder="Closed reason" style={inputStyle} />
              {renderReferenceDatalist("admin-tickler-closed-reason-options", referenceOptions.closedReason || [])}
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(160px, 1fr))", gap: 12 }}>
            <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#334155" }}>
              Court
              <input list="admin-tickler-court-options" value={court} onChange={(event) => setCourt(event.target.value)} onKeyDown={handleTicklerSearchKeyDown} placeholder="Court" style={inputStyle} />
              {renderReferenceDatalist("admin-tickler-court-options", referenceOptions.court || [])}
            </label>

            <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#334155" }}>
              Date Filed From
              <input type="date" value={dateFiledFrom} onChange={(event) => setDateFiledFrom(event.target.value)} onKeyDown={handleTicklerSearchKeyDown} style={inputStyle} />
            </label>

            <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#334155" }}>
              Date Filed Through
              <input type="date" value={dateFiledTo} onChange={(event) => setDateFiledTo(event.target.value)} onKeyDown={handleTicklerSearchKeyDown} style={inputStyle} />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(160px, 1fr))", gap: 12 }}>
            <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#334155" }}>
              Master Lawsuit
              <input value={masterLawsuitId} onChange={(event) => setMasterLawsuitId(event.target.value)} onKeyDown={handleTicklerSearchKeyDown} placeholder="2026.06.00001" style={inputStyle} />
            </label>

            <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#334155" }}>
              Matter Number
              <input value={displayNumber} onChange={(event) => setDisplayNumber(event.target.value)} onKeyDown={handleTicklerSearchKeyDown} placeholder="BRL30121" style={inputStyle} />
            </label>

            <div />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => void loadTicklers()}
              disabled={loading}
              style={{
                border: "none",
                background: loading ? "#94a3b8" : "#4f46e5",
                color: "#fff",
                borderRadius: 14,
                padding: "12px 16px",
                fontWeight: 950,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Searching..." : "Search Ticklers"}
            </button>
            <button
              type="button"
              onClick={() => {
                setKind("all");
                setDueBefore("");
                setDueAfter("");
                setMasterLawsuitId("");
                setDisplayNumber("");
                setPatient("");
                setProvider("");
                setInsuranceCompany("");
                setClaim("");
                setIndexAaaNumber("");
                setDosStart("");
                setDosEnd("");
                setDenialReason("");
                setServiceType("");
                setClaimStatus("");
                setCloseReason("");
                setFinalStatus("");
                setBillNumber("");
                setPolicyNumber("");
                setDateOfLoss("");
                setTreatingProvider("");
                setMatterStage("");
                setCourt("");
                setDateFiledFrom("");
                setDateFiledTo("");
                setResult(null);
                setSearched(false);
              }}
              style={{
                border: "1px solid #cbd5e1",
                background: "#fff",
                color: "#334155",
                borderRadius: 14,
                padding: "12px 16px",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Clear Filters
            </button>
          </div>
        </section>

        <section style={{ border: "1px solid #e2e8f0", borderRadius: 18, background: "#fff", padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>Tickler Results</h2>
              <p
                data-barsh-admin-tickler-results-mode-label="true"
                style={{ margin: "4px 0 0", color: ticklerStatusMode === "completed" ? "#7f1d1d" : "#475569", fontSize: 13, fontWeight: 700 }}
              >
                {ticklerStatusMode === "completed" ? "Completed History: read-only audit results." : "Open Ticklers: active follow-up results."}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 900, color: "#475569" }}>
                {loading ? "Loading..." : `${result?.count ?? 0} result${(result?.count ?? 0) === 1 ? "" : "s"}`}
              </div>
              {Array.isArray(result?.ticklers) && result.ticklers.length > 0 && (
                <button
                  type="button"
                  onClick={exportTicklerResultsXlsx}
                  style={{
                    border: "1px solid #4f46e5",
                    background: "#4f46e5",
                    color: "#fff",
                    borderRadius: 999,
                    padding: "8px 12px",
                    fontWeight: 900,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Export XLS
                </button>
              )}
            </div>
          </div>

          {result?.error ? (
            <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 14, padding: 14, fontWeight: 850 }}>
              {result.error}
            </div>
          ) : null}

          {!searched ? (
            <div style={{ color: "#64748b", fontWeight: 800 }}>Enter criteria and click Search Ticklers.</div>
          ) : !loading && result?.ok && !result.ticklers?.length ? (
            <div style={{ color: "#64748b", fontWeight: 800 }}>No matching ticklers found.</div>
          ) : null}

          {result?.ticklers?.length ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#475569", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "10px 8px" }}>Due</th>
                    <th style={{ padding: "10px 8px" }}>Type</th>
                    <th style={{ padding: "10px 8px" }}>Matter</th>
                    <th style={{ padding: "10px 8px" }}>Master Lawsuit</th>
                    <th style={{ padding: "10px 8px" }}>Provider</th>
                    <th style={{ padding: "10px 8px" }}>Patient</th>
                    <th style={{ padding: "10px 8px" }}>Insurer</th>
                  </tr>
                </thead>
                <tbody>
                  {result.ticklers.map((tickler) => (
                    <tr key={tickler.id} style={{ borderBottom: "1px solid #f1f5f9", verticalAlign: "top" }} data-barsh-admin-tickler-detail-row-open="true" role="button" tabIndex={0} title="View read-only tickler detail" onClick={() => setSelectedTicklerDetail(tickler)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedTicklerDetail(tickler); } }}>
                      <td style={{ padding: "10px 8px", fontWeight: 900 }}>{formatDate(tickler.dueDate)}</td>
                      <td style={{ padding: "10px 8px" }}>{kindLabel(tickler.kind)}</td>
                      <td style={{ padding: "10px 8px" }}>
                        {ticklerMatterHref(tickler) ? (
                          <Link href={ticklerMatterHref(tickler)} style={linkStyle}>
                            {(tickler as any).caseData?.matter || tickler.displayNumber || tickler.matterId || "—"}
                          </Link>
                        ) : (
                          (tickler as any).caseData?.matter || tickler.displayNumber || tickler.matterId || "—"
                        )}
                      </td>
                      <td style={{ padding: "10px 8px" }}>
                        {ticklerMasterHref(tickler) ? (
                          <Link href={ticklerMasterHref(tickler)} style={linkStyle}>
                            {(tickler as any).caseData?.masterLawsuit || tickler.masterLawsuitId || "—"}
                          </Link>
                        ) : (
                          (tickler as any).caseData?.masterLawsuit || tickler.masterLawsuitId || "—"
                        )}
                      </td>
                      <td style={{ padding: "10px 8px" }}>{(tickler as any).caseData?.provider || "—"}</td>
                      <td style={{ padding: "10px 8px" }}>{(tickler as any).caseData?.patient || "—"}</td>
                      <td style={{ padding: "10px 8px" }}>{(tickler as any).caseData?.insurer || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>

      {selectedTicklerDetail ? (
        <div
          data-barsh-admin-tickler-detail-overlay="true"
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 12000,
            background: "rgba(15, 23, 42, 0.32)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: 64,
          }}
        >
          <div
            data-barsh-admin-tickler-detail-popup="true"
            role="dialog"
            aria-modal="true"
            aria-label="Read-only Admin Tickler Detail"
            style={{
              width: "min(1180px, calc(100vw - 48px))",
              height: "min(780px, calc(100vh - 96px))",
              resize: "both",
              overflow: "auto",
              background: "#ffffff",
              borderRadius: 16,
              border: "1px solid #cbd5e1",
              boxShadow: "0 24px 80px rgba(15, 23, 42, 0.35)",
            }}
          >
            <div
              data-barsh-admin-tickler-detail-header="true"
              style={{
                position: "sticky",
                top: 0,
                zIndex: 1,
                padding: "18px 22px",
                borderBottom: "1px solid #dbe4f0",
                background: "#0f3d5e",
                color: "#ffffff",
              }}
            >
              <h2 style={{ margin: 0, fontSize: 20 }}>Read-Only Tickler Detail</h2>
              <p style={{ margin: "6px 0 0", fontSize: 13 }}>
                Administrator inspection only.  This popup does not process ticklers, complete ticklers, post payments, change statuses, run ticklers, write records, update Clio, or modify Barsh Matters data.
              </p>
            </div>

            <div
              data-barsh-admin-tickler-detail-body="true"
              style={{
                display: "grid",
                gap: 14,
                padding: 22,
              }}
            >
              <AdminTicklerDetailJsonSection
                title="Full tickler record"
                value={selectedTicklerDetail}
              />
              <AdminTicklerDetailJsonSection
                title="caseData / contextScope"
                value={{
                  caseData: selectedTicklerDetail?.caseData,
                  contextScope: selectedTicklerDetail?.contextScope,
                  contextKind: selectedTicklerDetail?.contextKind,
                  contextId: selectedTicklerDetail?.contextId,
                  sourceScope: selectedTicklerDetail?.sourceScope,
                }}
              />
              <AdminTicklerDetailJsonSection
                title="settlementRecord"
                value={{
                  settlementRecord: selectedTicklerDetail?.settlementRecord,
                  settlementRecordId: selectedTicklerDetail?.settlementRecordId,
                  settlement: selectedTicklerDetail?.settlement,
                  settlementSnapshot: selectedTicklerDetail?.settlementSnapshot,
                }}
              />
              <AdminTicklerDetailJsonSection
                title="lawsuit / master context"
                value={{
                  masterLawsuitId: selectedTicklerDetail?.masterLawsuitId,
                  lawsuitId: selectedTicklerDetail?.lawsuitId,
                  masterMatterId: selectedTicklerDetail?.masterMatterId,
                  masterLawsuit: selectedTicklerDetail?.masterLawsuit,
                  lawsuit: selectedTicklerDetail?.lawsuit,
                  master: selectedTicklerDetail?.master,
                  caseDataMasterLawsuit: selectedTicklerDetail?.caseData?.masterLawsuit,
                }}
              />
              <AdminTicklerDetailJsonSection
                title="completion audit fields"
                value={{
                  status: selectedTicklerDetail?.status,
                  completedAt: selectedTicklerDetail?.completedAt,
                  completedBy: selectedTicklerDetail?.completedBy,
                  completedNote: selectedTicklerDetail?.completedNote,
                }}
              />
              <AdminTicklerDetailJsonSection
                title="metadata and source fields"
                value={adminTicklerDetailSourceFields(selectedTicklerDetail)}
              />
            </div>

            <div
              data-barsh-admin-tickler-detail-bottom-close="true"
              style={{
                position: "sticky",
                bottom: 0,
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                padding: "14px 22px",
                borderTop: "1px solid #dbe4f0",
                background: "#ffffff",
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedTicklerDetail(null)}
                style={{
                  border: "1px solid #1f4f73",
                  background: "#1f4f73",
                  color: "#ffffff",
                  borderRadius: 10,
                  padding: "9px 18px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}


    </main>
  );
}
