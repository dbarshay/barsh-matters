"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- Client queue page maps untyped queue rows; pre-existing any usage. */

import { useEffect, useMemo, useState } from "react";
import BarshHeaderQuickNav from "@/app/components/BarshHeaderQuickNav";
import BarshHeaderActions from "@/app/components/BarshHeaderActions";
import BarshHeader from "@/app/components/BarshHeader";

type PrintQueueStatus = "" | "queued" | "printed" | "hold" | "skipped";

function textValue(v: any): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);

  if (Array.isArray(v)) {
    return v.map(textValue).filter(Boolean).join(", ");
  }

  if (typeof v === "object") {
    if (typeof v.name === "string" && v.name.trim()) return v.name;
    if (typeof v.value === "string" && v.value.trim()) return v.value;
    if (typeof v.label === "string" && v.label.trim()) return v.label;
    if (typeof v.description === "string" && v.description.trim()) return v.description;
    if (typeof v.display_value === "string" && v.display_value.trim()) return v.display_value;
    if (typeof v.displayName === "string" && v.displayName.trim()) return v.displayName;
    if (typeof v.text === "string" && v.text.trim()) return v.text;
  }

  return "";
}

function num(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function shortDateTime(v: any): string {
  const raw = textValue(v);
  if (!raw) return "—";

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;

  return d.toLocaleString();
}

function clioMatterUrl(matterId: any): string {
  const id = textValue(matterId);
  return id ? `https://app.clio.com/nc/#/matters/${id}` : "";
}

function clioDocumentOpenUrl(row: any, mode: "inline" | "download" = "inline"): string {
  const documentId = textValue(row?.clioDocumentId);
  const filename = textValue(row?.filename) || textValue(row?.clioDocumentName) || "document.pdf";

  if (!documentId) return "";

  const params = new URLSearchParams();
  params.set("documentId", documentId);
  params.set("filename", filename);
  params.set("mode", mode);

  return "/api/documents/clio-document-open?" + params.toString();
}

function rowSnapshot(row: any): any {
  return row?.documentSnapshot && typeof row.documentSnapshot === "object" ? row.documentSnapshot : {};
}

function queueSourceLabel(row: any): string {
  const snap = rowSnapshot(row);
  const source = textValue(snap.source).toLowerCase();
  const display = textValue(row?.masterDisplayNumber || snap.masterDisplayNumber || snap.directMatterDisplayNumber);

  if (source === "direct_matter") return display ? `${display} - Direct Matter` : "Direct Matter";
  if (display && display.startsWith("BRL")) {
    if (/^\d{4}\.\d{2}\.\d{5}$/.test(display)) return `${display} - Lawsuit`;
    return `${display} - Matter`;
  }
  if (textValue(row?.documentKey).toLowerCase().includes("settlement")) return "Settlement / Local";
  return display || "Document";
}

function barshMatterHref(row: any): string {
  const snap = rowSnapshot(row);
  const display = textValue(row?.masterDisplayNumber || snap.directMatterDisplayNumber || snap.masterDisplayNumber);

  if (/^\d{4}\.\d{2}\.\d{5}/.test(display)) {
    return `/matters?master=${encodeURIComponent(textValue(row?.masterLawsuitId))}`;
  }

  if (display.startsWith("BRL")) {
    return `/matter/${encodeURIComponent(display)}`;
  }

  return "";
}

const statusOptions: Array<{ value: PrintQueueStatus; label: string; countKey: string }> = [
  { value: "", label: "All", countKey: "all" },
  { value: "queued", label: "Queued", countKey: "queued" },
  { value: "printed", label: "Printed", countKey: "printed" },
  { value: "hold", label: "Hold", countKey: "hold" },
  { value: "skipped", label: "Skipped", countKey: "skipped" },
];

type PrintQueueUrlState = {
  status: PrintQueueStatus;
  masterLawsuitId: string;
  limit: number;
  finalizedPdfOnly: boolean;
  dedupeClioDocumentId: boolean;
};

function normalizePrintQueueStatus(value: unknown): PrintQueueStatus {
  const raw = textValue(value).toLowerCase();
  return ["queued", "printed", "hold", "skipped"].includes(raw) ? (raw as PrintQueueStatus) : "";
}

function printQueueStateFromUrl(): PrintQueueUrlState {
  if (typeof window === "undefined") {
    return {
      status: "queued",
      masterLawsuitId: "",
      limit: 100,
      finalizedPdfOnly: true,
      dedupeClioDocumentId: true,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const limitValue = Number(params.get("limit") || 100);

  return {
    status: normalizePrintQueueStatus(params.get("status") || "queued") || "queued",
    masterLawsuitId: params.get("masterLawsuitId") || "",
    limit: Number.isFinite(limitValue) && limitValue > 0 ? limitValue : 100,
    finalizedPdfOnly: params.get("finalizedPdfOnly") !== "false",
    dedupeClioDocumentId: params.get("dedupeClioDocumentId") !== "false",
  };
}

function printQueueUrlForState(state: PrintQueueUrlState) {
  const params = new URLSearchParams();

  if (state.status && state.status !== "queued") params.set("status", state.status);
  if (state.masterLawsuitId) params.set("masterLawsuitId", state.masterLawsuitId);
  if (state.limit !== 100) params.set("limit", String(state.limit));
  if (!state.finalizedPdfOnly) params.set("finalizedPdfOnly", "false");
  if (!state.dedupeClioDocumentId) params.set("dedupeClioDocumentId", "false");

  return params.toString() ? `/print-queue?${params.toString()}` : "/print-queue";
}

export default function PrintQueuePage() {
  const initialPrintQueueUrlState = printQueueStateFromUrl();
  const [statusFilter, setStatusFilter] = useState<PrintQueueStatus>(initialPrintQueueUrlState.status);
  const [masterLawsuitId, setMasterLawsuitId] = useState(initialPrintQueueUrlState.masterLawsuitId);
  const [limit, setLimit] = useState(initialPrintQueueUrlState.limit);
  const [queue, setQueue] = useState<any>(null);
  const [finalizedPdfOnly, setFinalizedPdfOnly] = useState(initialPrintQueueUrlState.finalizedPdfOnly);
  const [dedupeClioDocumentId, setDedupeClioDocumentId] = useState(initialPrintQueueUrlState.dedupeClioDocumentId);
  const [loading, setLoading] = useState(false);
  const [statusLoadingId, setStatusLoadingId] = useState<number | null>(null);
  const [statusResult, setStatusResult] = useState<any>(null);
  const [error, setError] = useState("");

  const rows = useMemo(() => {
    return Array.isArray(queue?.rows) ? queue.rows : [];
  }, [queue]);

  async function loadQueue(
    nextState: Partial<PrintQueueUrlState> = {},
    options: { updateUrl?: boolean; replaceUrl?: boolean } = {}
  ) {
    const effectiveState: PrintQueueUrlState = {
      status: Object.prototype.hasOwnProperty.call(nextState, "status") ? normalizePrintQueueStatus(nextState.status) : statusFilter,
      masterLawsuitId: Object.prototype.hasOwnProperty.call(nextState, "masterLawsuitId") ? textValue(nextState.masterLawsuitId).trim() : masterLawsuitId.trim(),
      limit: Object.prototype.hasOwnProperty.call(nextState, "limit") ? Number(nextState.limit) || 100 : Number(limit) || 100,
      finalizedPdfOnly: Object.prototype.hasOwnProperty.call(nextState, "finalizedPdfOnly") ? Boolean(nextState.finalizedPdfOnly) : finalizedPdfOnly,
      dedupeClioDocumentId: Object.prototype.hasOwnProperty.call(nextState, "dedupeClioDocumentId") ? Boolean(nextState.dedupeClioDocumentId) : dedupeClioDocumentId,
    };

    setStatusFilter(effectiveState.status);
    setMasterLawsuitId(effectiveState.masterLawsuitId);
    setLimit(effectiveState.limit);
    setFinalizedPdfOnly(effectiveState.finalizedPdfOnly);
    setDedupeClioDocumentId(effectiveState.dedupeClioDocumentId);

    setLoading(true);
    setError("");

    try {
      const url = new URL("/api/documents/print-queue", window.location.origin);
      url.searchParams.set("limit", String(effectiveState.limit));
      url.searchParams.set("finalizedPdfOnly", effectiveState.finalizedPdfOnly ? "true" : "false");
      url.searchParams.set("dedupeClioDocumentId", effectiveState.dedupeClioDocumentId ? "true" : "false");

      const cleanMaster = effectiveState.masterLawsuitId.trim();
      if (cleanMaster) {
        url.searchParams.set("masterLawsuitId", cleanMaster);
      }

      if (effectiveState.status) {
        url.searchParams.set("status", effectiveState.status);
      }

      const res = await fetch(url.toString(), { cache: "no-store" });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Could not load print queue.");
      }

      setQueue(json);

      if (typeof window !== "undefined" && options.updateUrl !== false) {
        const nextUrl = printQueueUrlForState(effectiveState);
        const currentUrl = `${window.location.pathname}${window.location.search}`;

        if (nextUrl !== currentUrl) {
          if (options.replaceUrl) {
            window.history.replaceState({ barshMattersPrintQueueFilters: true }, "", nextUrl);
          } else {
            window.history.pushState({ barshMattersPrintQueueFilters: true }, "", nextUrl);
          }
        }
      }
    } catch (err: any) {
      setError(err?.message || "Could not load print queue.");
      setQueue(null);
    } finally {
      setLoading(false);
    }
  }

  async function changeStatusFilter(nextStatusFilter: PrintQueueStatus) {
    await loadQueue({ status: nextStatusFilter });
  }

  async function updatePrintQueueStatus(row: any, status: "queued" | "printed" | "hold" | "skipped") {
    const id = Number(row?.id);

    if (!Number.isFinite(id) || id <= 0) {
      setStatusResult({
        ok: false,
        error: "Missing print queue item id.",
      });
      return;
    }

    const label =
      status === "printed"
        ? "mark this document as printed"
        : status === "hold"
          ? "place this document on hold"
          : status === "skipped"
            ? "mark this document as skipped"
            : "return this document to queued status";

    const confirmed = confirm(
      `UPDATE PRINT QUEUE STATUS\n\n` +
        `Document: ${textValue(row?.documentLabel) || textValue(row?.documentKey) || "—"}\n` +
        `Filename: ${textValue(row?.filename) || "—"}\n\n` +
        `This will ${label}.\n\n` +
        `Continue?`
    );

    if (!confirmed) return;

    setStatusLoadingId(id);
    setStatusResult(null);

    try {
      const res = await fetch("/api/documents/print-queue", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          status,
          confirmStatusUpdate: true,
        }),
      });

      const json = await res.json().catch(() => null);
      setStatusResult(json);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Could not update print queue status.");
      }

      await loadQueue({ status: statusFilter, masterLawsuitId, limit, finalizedPdfOnly, dedupeClioDocumentId }, { replaceUrl: true });
    } catch (err: any) {
      setStatusResult({
        ok: false,
        error: err?.message || "Could not update print queue status.",
      });
    } finally {
      setStatusLoadingId(null);
    }
  }

  async function deleteQueueItem(row: any) {
    const id = Number(row?.id);
    if (!Number.isFinite(id)) return;
    const label = textValue(row.filename) || textValue(row.documentLabel) || "this document";
    const confirmed = window.confirm(
      `Delete ${label} from the Print Queue?\n\nThis removes the queue entry only \u2014 the saved document is not deleted.`
    );
    if (!confirmed) return;

    setStatusLoadingId(id);
    setStatusResult(null);
    try {
      const res = await fetch("/api/documents/print-queue", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, confirmDelete: true }),
      });
      const json = await res.json().catch(() => null);
      setStatusResult(json);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Could not delete the print queue item.");
      }
      await loadQueue({ status: statusFilter, masterLawsuitId, limit, finalizedPdfOnly, dedupeClioDocumentId }, { replaceUrl: true });
    } catch (err: any) {
      setStatusResult({ ok: false, error: err?.message || "Could not delete the print queue item." });
    } finally {
      setStatusLoadingId(null);
    }
  }

  function openQueuedDocument(row: any, mode: "inline" | "download" = "inline") {
    const url = clioDocumentOpenUrl(row, mode);

    if (!url) {
      alert("This print queue row does not have a Clio document ID available to open.");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function printQueuedDocument(row: any) {
    const url = clioDocumentOpenUrl(row, "inline");

    if (!url) {
      alert("This print queue row does not have a Clio document ID available to print.");
      return;
    }

    const printWindow = window.open("", "_blank");

    if (!printWindow) return;

    printWindow.document.write("<!doctype html><title>Preparing Print Document</title><body style='font-family: system-ui, sans-serif; padding: 24px;'>Preparing queued document for printing...</body>");
    printWindow.document.close();
    printWindow.location.href = url;

    [2000, 4000, 6500].forEach((delay) => {
      window.setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
        } catch {
          // Browser-controlled print behavior; the opened PDF can still be printed manually.
        }
      }, delay);
    });
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    function applyPrintQueueStateFromUrl() {
      void loadQueue(printQueueStateFromUrl(), { updateUrl: false });
    }

    applyPrintQueueStateFromUrl();
    window.addEventListener("popstate", applyPrintQueueStateFromUrl);

    return () => {
      window.removeEventListener("popstate", applyPrintQueueStateFromUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ padding: 16, width: "100%", maxWidth: "none", margin: 0 }}>
      <BarshHeader />


<div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, margin: "0 0 6px 0" }}>Daily Print Queue</h1>
        </div>

        <a
          href="/lawsuits"
          style={{
            fontSize: 13,
            padding: "6px 10px",
            border: "1px solid #94a3b8",
            borderRadius: 6,
            color: "#00346e",
            textDecoration: "none",
            background: "#fff",
          }}
        >
          Lawsuit Search
        </a>
      </div>

      <section
        style={{
          marginBottom: 12,
          padding: 12,
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          background: "#f8fafc",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) 120px auto", gap: 8, alignItems: "center" }}>
          <input
            value={masterLawsuitId}
            onChange={(e) => setMasterLawsuitId(e.target.value)}
            placeholder="Optional MASTER_LAWSUIT_ID filter, e.g., 2026.05.00010"
            style={inputStyle}
          />

          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={inputStyle}
          >
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
            <option value={200}>200 rows</option>
          </select>

          <button
            type="button"
            onClick={() => loadQueue({ status: statusFilter, masterLawsuitId, limit, finalizedPdfOnly, dedupeClioDocumentId })}
            disabled={loading}
            style={primaryButtonStyle}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
          <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12, fontWeight: 800, color: "#385a83" }}>
            <input
              type="checkbox"
              checked={finalizedPdfOnly}
              onChange={(event) => setFinalizedPdfOnly(event.target.checked)}
            />
            Finalized PDFs only
          </label>
          <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12, fontWeight: 800, color: "#385a83" }}>
            <input
              type="checkbox"
              checked={dedupeClioDocumentId}
              onChange={(event) => setDedupeClioDocumentId(event.target.checked)}
            />
            Hide duplicate Clio documents
          </label>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
          {statusOptions.map((option) => {
            const active = statusFilter === option.value;
            const count = num(queue?.statusCounts?.[option.countKey]);

            return (
              <button
                key={option.countKey}
                type="button"
                onClick={() => changeStatusFilter(option.value)}
                disabled={loading}
                style={{
                  fontSize: 12,
                  padding: "4px 10px",
                  border: `1px solid ${active ? "#0f172a" : "#94a3b8"}`,
                  borderRadius: 999,
                  background: active ? "#e2e8f0" : "#fff",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontWeight: active ? 800 : 500,
                }}
              >
                {option.label}: {count}
              </button>
            );
          })}
        </div>
      </section>

      {error && (
        <div style={errorBoxStyle}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {statusResult && (
        <div
          style={{
            marginBottom: 12,
            padding: 10,
            background: statusResult.ok ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${statusResult.ok ? "#bbf7d0" : "#fecaca"}`,
            borderRadius: 6,
            color: statusResult.ok ? "#166534" : "#991b1b",
            fontSize: 13,
          }}
        >
          {statusResult.ok ? (
            <>Print queue status updated to {textValue(statusResult.status) || "—"}.</>
          ) : (
            <>
              <strong>Error:</strong> {textValue(statusResult.error)}
            </>
          )}
        </div>
      )}

      <section
        style={{
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        <div
          style={{
            padding: 10,
            borderBottom: "1px solid #e5e7eb",
            background: "#f8fafc",
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 800 }}>
            Print Queue Items
          </div>
          <div style={{ color: "#385a83", fontSize: 12 }}>
            Showing {num(queue?.count)} row(s)
            {typeof queue?.rawCount === "number" && queue.rawCount !== queue.count ? ` from ${queue.rawCount} raw row(s)` : ""}
            {queue?.status ? ` with status "${queue.status}"` : ""}
            {queue?.finalizedPdfOnly ? " · finalized PDFs only" : ""}
            {queue?.dedupeClioDocumentId ? " · duplicates hidden" : ""}
            {queue?.masterLawsuitId ? ` for ${queue.masterLawsuitId}` : ""}
          </div>
        </div>

        {loading && !queue && (
          <div style={{ padding: 12, color: "#385a83" }}>Loading print queue...</div>
        )}

        {queue?.ok && rows.length === 0 && (
          <div style={{ padding: 12, color: "#385a83" }}>
            No print queue items match the current filters.
          </div>
        )}

        {queue?.ok && rows.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Source</th>
                  <th style={thStyle}>Lawsuit ID</th>
                  <th style={thStyle}>Matter / Clio</th>
                  <th style={thStyle}>Document</th>
                  <th style={thStyle}>Filename</th>
                  <th style={thStyle}>Queued At</th>
                  <th style={thStyle}>Printed At</th>
                  <th style={thStyle}>Clio Document ID</th>
                  <th style={thStyle}>Open / Print</th>
                  <th style={thStyle}>Status Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any) => {
                  const appHref = barshMatterHref(row);
                  const clioDocUrl = clioDocumentOpenUrl(row, "inline");
                  const sourceLabel = queueSourceLabel(row);

                  return (
                    <tr key={textValue(row.id)}>
                      <td style={tdStyle}>
                        <span
                          style={{
                            display: "inline-flex",
                            padding: "3px 8px",
                            borderRadius: 999,
                            border: "1px solid #cbd5e1",
                            background:
                              textValue(row.status).toLowerCase() === "queued"
                                ? "#eff6ff"
                                : textValue(row.status).toLowerCase() === "printed"
                                  ? "#dcfce7"
                                  : textValue(row.status).toLowerCase() === "hold"
                                    ? "#fef3c7"
                                    : "#f1f5f9",
                            fontWeight: 850,
                          }}
                        >
                          {textValue(row.status) || "—"}
                        </span>
                      </td>
                      <td style={tdStyle}>{sourceLabel}</td>
                      <td style={tdStyle}>{textValue(row.masterLawsuitId) || "—"}</td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {appHref ? (
                            <a href={appHref}>
                              {textValue(row.masterDisplayNumber) || textValue(row.masterMatterId) || "Open"}
                            </a>
                          ) : (
                            <span>{textValue(row.masterDisplayNumber) || textValue(row.masterMatterId) || "—"}</span>
                          )}
                          {row.masterMatterId ? (
                            <a
                              href={clioMatterUrl(row.masterMatterId)}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: "#385a83", fontSize: 11 }}
                            >
                              Open in Clio
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td style={tdStyle}>{textValue(row.documentLabel) || textValue(row.documentKey) || "—"}</td>
                      <td style={{ ...tdStyle, minWidth: 360 }}>
                        <div style={{ fontWeight: 750 }}>{textValue(row.filename) || "—"}</div>
                        {textValue(row.documentSnapshot?.printCandidateReason) && (
                          <div style={{ color: "#385a83", fontSize: 11, marginTop: 3 }}>
                            {textValue(row.documentSnapshot.printCandidateReason)}
                          </div>
                        )}
                      </td>
                      <td style={tdStyle}>{shortDateTime(row.queuedAt)}</td>
                      <td style={tdStyle}>{shortDateTime(row.printedAt)}</td>
                      <td style={tdStyle}>{textValue(row.clioDocumentId) || "—"}</td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => openQueuedDocument(row, "inline")}
                            disabled={!clioDocUrl}
                            style={smallActionButtonStyle}
                          >
                            Open PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => printQueuedDocument(row)}
                            disabled={!clioDocUrl}
                            style={smallActionButtonStyle}
                          >
                            Print
                          </button>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {(["printed", "hold", "skipped", "queued"] as const).map((statusOption) => (
                            <button
                              key={`${textValue(row.id)}-${statusOption}`}
                              type="button"
                              onClick={() => updatePrintQueueStatus(row, statusOption)}
                              disabled={
                                statusLoadingId === Number(row.id) ||
                                textValue(row.status).toLowerCase() === statusOption
                              }
                              style={{
                                fontSize: 11,
                                padding: "2px 6px",
                                border: "1px solid #94a3b8",
                                borderRadius: 4,
                                background:
                                  textValue(row.status).toLowerCase() === statusOption
                                    ? "#e2e8f0"
                                    : "#fff",
                                cursor:
                                  statusLoadingId === Number(row.id) ||
                                  textValue(row.status).toLowerCase() === statusOption
                                    ? "not-allowed"
                                    : "pointer",
                              }}
                            >
                              {statusLoadingId === Number(row.id)
                                ? "Updating..."
                                : statusOption === "printed"
                                  ? "Printed"
                                  : statusOption === "hold"
                                    ? "Hold"
                                    : statusOption === "skipped"
                                      ? "Skipped"
                                      : "Re-Queue"}
                            </button>
                          ))}
                          <button
                            key={`${textValue(row.id)}-delete`}
                            type="button"
                            onClick={() => void deleteQueueItem(row)}
                            disabled={statusLoadingId === Number(row.id)}
                            style={{
                              fontSize: 11,
                              padding: "2px 6px",
                              border: "1px solid #dc2626",
                              borderRadius: 4,
                              background: "#fff",
                              color: "#dc2626",
                              fontWeight: 800,
                              cursor: statusLoadingId === Number(row.id) ? "not-allowed" : "pointer",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 8,
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  background: "#fff",
};

const smallActionButtonStyle: React.CSSProperties = {
  fontSize: 11,
  padding: "3px 7px",
  border: "1px solid #00346e",
  borderRadius: 5,
  background: "#eff6ff",
  color: "#00346e",
  fontWeight: 800,
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #0f172a",
  borderRadius: 6,
  background: "#0f172a",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 700,
};

const errorBoxStyle: React.CSSProperties = {
  marginBottom: 12,
  padding: 10,
  border: "1px solid #fecaca",
  borderRadius: 6,
  background: "#fef2f2",
  color: "#991b1b",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb",
  padding: 6,
  background: "#f8fafc",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #f1f5f9",
  padding: 6,
  verticalAlign: "top",
};
