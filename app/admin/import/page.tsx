"use client";

import React, { useEffect, useState } from "react";
import BarshHeader from "@/app/components/BarshHeader";

// Admin: Dow (provider-sheet) import — upload -> preview -> pick provider -> confirm -> undo.
// The API routes are gated behind BARSH_IMPORT_ENABLED; if disabled they return 403 and this page
// surfaces that message.

const NAVY = "#00346e";
const MUTED = "#385a83";

type ProviderOption = { id: string; displayName: string };

type PreviewRow = {
  rowIndex: number;
  outcome: string;
  errors: string[];
  staged: {
    claim_number_raw: string;
    patient_name: string;
    dos_start: string;
    dos_end: string;
    carrier_raw: string;
    claim_amount: number | null;
    service_type: string;
  };
  carrier: { status: string; displayName?: string };
  patient: { status: string };
  existingDisplayNumber: string | null;
};

const box: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  borderRadius: 12,
  padding: 16,
  background: "#fff",
  marginBottom: 16,
};
const btn = (bg: string, disabled = false): React.CSSProperties => ({
  height: 40,
  padding: "0 18px",
  border: `1px solid ${bg}`,
  borderRadius: 10,
  background: disabled ? "#e2e8f0" : bg,
  color: disabled ? "#94a3b8" : "#fff",
  fontWeight: 900,
  cursor: disabled ? "not-allowed" : "pointer",
});

export default function DowImportPage() {
  const [fileBase64, setFileBase64] = useState("");
  const [fileName, setFileName] = useState("");
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [providerId, setProviderId] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [confirmResult, setConfirmResult] = useState<any>(null);
  const [undoResult, setUndoResult] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [detailId, setDetailId] = useState("");
  const [detail, setDetail] = useState<any>(null);
  const [detailOutcome, setDetailOutcome] = useState("all");
  const [detailSortKey, setDetailSortKey] = useState("rowIndex");
  const [detailSortDir, setDetailSortDir] = useState<1 | -1>(1);
  const [batchSortKey, setBatchSortKey] = useState("createdAt");
  const [batchSortDir, setBatchSortDir] = useState<1 | -1>(-1); // newest first by default
  const [dragging, setDragging] = useState(false);

  function toggleBatchSort(key: string) {
    if (key === batchSortKey) setBatchSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setBatchSortKey(key);
      setBatchSortDir(key === "createdAt" ? -1 : 1);
    }
  }

  function batchSortValue(b: any, key: string): string | number {
    switch (key) {
      case "source": return b.source || "";
      case "sourceFile": return b.sourceFile || "";
      case "totalRows": return b.totalRows ?? 0;
      case "createdCount": return b.createdCount ?? 0;
      case "held": return b.held ?? 0;
      case "rejectedCount": return b.rejectedCount ?? 0;
      case "other": return b.other ?? 0;
      case "status": return b.status || "";
      default: return new Date(b.createdAt).getTime();
    }
  }
  const [sortKey, setSortKey] = useState("rowIndex");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  function toggleSort(key: string) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  function sortValue(r: PreviewRow, key: string): string | number {
    switch (key) {
      case "patient": return r.staged.patient_name || "";
      case "claim": return r.staged.claim_number_raw || "";
      case "dos": return r.staged.dos_start || "";
      case "charges": return r.staged.claim_amount ?? Number.NEGATIVE_INFINITY;
      case "carrier": return r.carrier.status === "matched" ? (r.carrier.displayName || "") : "unmatched";
      case "patientMatch": return r.patient.status || "";
      case "outcome": return r.outcome || "";
      default: return r.rowIndex;
    }
  }

  function toggleDetailSort(key: string) {
    if (key === detailSortKey) setDetailSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setDetailSortKey(key);
      setDetailSortDir(1);
    }
  }

  function detailSortValue(r: any, key: string): string | number {
    switch (key) {
      case "outcome": return r.outcome || "";
      case "matter": return r.displayNumber || "";
      case "patient": return r.patientName || "";
      case "stage": return r.stage || "";
      case "reason": return r.reason || "";
      default: return r.rowIndex;
    }
  }

  async function loadProviders() {
    try {
      const r = await fetch("/api/reference-data/options?type=provider_client", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      const rows = j?.options || j?.rows || j?.entities || [];
      setProviders(rows.map((o: any) => ({ id: o.id, displayName: o.displayName || o.label || o.id })));
    } catch {
      /* provider list is optional to load */
    }
  }

  async function loadBatches() {
    try {
      const r = await fetch("/api/import/batches?take=50", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (j?.ok) setBatches(j.batches || []);
    } catch {
      /* history is optional to load */
    }
  }

  async function openBatchDetail(id: string) {
    if (detailId === id) {
      setDetailId("");
      setDetail(null);
      return;
    }
    setDetailId(id);
    setDetail(null);
    setBusy("detail:" + id);
    try {
      const r = await fetch(`/api/import/batches/${id}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (j?.ok) setDetail(j);
      else setError(j?.error || "Could not load import details.");
    } catch (e: any) {
      setError(e?.message || "Could not load import details.");
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    void loadProviders();
    void loadBatches();
  }, []);

  async function seedTest(remove: boolean) {
    setBusy("seed");
    setError("");
    try {
      const r = await fetch("/api/import/dev-seed-references", { method: remove ? "DELETE" : "POST" });
      const j = await r.json();
      if (!j.ok) setError(j.error || "Seed failed.");
      else {
        await loadProviders();
        window.alert(remove ? `Removed ${j.removed} seeded entities.` : `Seeded ${j.seededCarriers} carriers + provider.`);
      }
    } catch (e: any) {
      setError(e?.message || "Seed failed.");
    } finally {
      setBusy("");
    }
  }

  function ingestFile(file?: File | null) {
    setPreview(null);
    setConfirmResult(null);
    setUndoResult(null);
    setError("");
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      setError("Please choose an Excel spreadsheet (.xlsx or .xls).");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setFileBase64(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(file);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    ingestFile(e.target.files?.[0]);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    ingestFile(e.dataTransfer.files?.[0]);
  }

  async function runPreview() {
    if (!fileBase64) return;
    setBusy("preview");
    setError("");
    setConfirmResult(null);
    setUndoResult(null);
    try {
      const r = await fetch("/api/import/dow/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64 }),
      });
      const j = await r.json();
      if (!j.ok) setError(j.error || "Preview failed.");
      else setPreview(j);
    } catch (e: any) {
      setError(e?.message || "Preview failed.");
    } finally {
      setBusy("");
    }
  }

  async function runConfirm() {
    if (!fileBase64 || !providerId) return;
    if (!window.confirm("Create matters for all 'ready' rows? You can undo this import afterward.")) return;
    setBusy("confirm");
    setError("");
    try {
      const r = await fetch("/api/import/dow/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64, providerEntityId: providerId, sourceFile: fileName }),
      });
      const j = await r.json();
      if (!j.ok) setError(j.error || "Confirm failed.");
      else {
        setConfirmResult(j);
        void loadBatches();
      }
    } catch (e: any) {
      setError(e?.message || "Confirm failed.");
    } finally {
      setBusy("");
    }
  }

  async function undoBatch(batchId: string) {
    if (!batchId) return;
    if (!window.confirm("Undo this import? Removes only untouched matters it created.")) return;
    setBusy("undo:" + batchId);
    setError("");
    try {
      const r = await fetch("/api/import/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId }),
      });
      const j = await r.json();
      if (!j.ok) setError(j.error || "Undo failed.");
      else setUndoResult(j);
    } catch (e: any) {
      setError(e?.message || "Undo failed.");
    } finally {
      setBusy("");
      void loadBatches();
    }
  }

  async function runUndo() {
    if (!confirmResult?.batchId) return;
    await undoBatch(confirmResult.batchId);
  }

  const s = preview?.summary;

  const sortedRows: PreviewRow[] = preview?.rows
    ? [...(preview.rows as PreviewRow[])].sort((a, b) => {
        const va = sortValue(a, sortKey);
        const vb = sortValue(b, sortKey);
        let cmp: number;
        if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
        else cmp = String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: "base" });
        return cmp * sortDir;
      })
    : [];

  const columns: { key: string; label: string }[] = [
    { key: "rowIndex", label: "#" },
    { key: "patient", label: "Patient" },
    { key: "claim", label: "Claim #" },
    { key: "dos", label: "DOS" },
    { key: "charges", label: "Charges" },
    { key: "carrier", label: "Carrier" },
    { key: "patientMatch", label: "Patient match" },
    { key: "outcome", label: "Outcome" },
  ];

  const batchColumns: { key: string; label: string }[] = [
    { key: "createdAt", label: "When" },
    { key: "source", label: "Source" },
    { key: "sourceFile", label: "File" },
    { key: "totalRows", label: "Rows" },
    { key: "createdCount", label: "Created" },
    { key: "held", label: "Held" },
    { key: "rejectedCount", label: "Rejected" },
    { key: "other", label: "Other" },
    { key: "status", label: "Status" },
  ];

  const sortedBatches = [...batches].sort((a, b) => {
    const va = batchSortValue(a, batchSortKey);
    const vb = batchSortValue(b, batchSortKey);
    const cmp = typeof va === "number" && typeof vb === "number"
      ? va - vb
      : String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: "base" });
    return cmp * batchSortDir;
  });

  return (
    <main style={{ padding: "12px 14px 40px", background: "#f8fafc", minHeight: "100vh", color: NAVY, fontFamily: "Inter, system-ui, sans-serif" }}>
      <BarshHeader center={<div style={{ fontSize: 28, fontWeight: 950, color: "#fff" }}>Import Matters</div>} />

      <div style={{ width: "100%", maxWidth: "100%", margin: 0, boxSizing: "border-box" }}>
        <div style={box}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>1. Upload provider sheet (.xlsx)</div>
          <div
            onDragOver={(e) => { e.preventDefault(); if (!dragging) setDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
            onDrop={onDrop}
            style={{
              border: `2px dashed ${dragging ? NAVY : "#cbd5e1"}`,
              borderRadius: 12,
              background: dragging ? "#eef4fb" : "#f8fafc",
              padding: "22px 16px",
              textAlign: "center",
              color: MUTED,
              transition: "background 120ms, border-color 120ms",
            }}
          >
            <div style={{ fontWeight: 800, color: dragging || fileName ? NAVY : MUTED, marginBottom: 12 }}>
              {dragging ? "Drop to load" : fileName ? "File Selected" : "Drag & Drop or Pick File"}
            </div>
            <input id="dow-file-input" type="file" accept=".xlsx,.xls" onChange={onFile} style={{ display: "none" }} />
            {fileName ? (
              <div>
                <div style={{ color: NAVY, fontWeight: 700 }}>{fileName}</div>
                <label htmlFor="dow-file-input" style={{ marginTop: 8, display: "inline-block", color: MUTED, fontSize: 13, textDecoration: "underline", cursor: "pointer" }}>
                  Choose a different file
                </label>
              </div>
            ) : (
              <label
                htmlFor="dow-file-input"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: 38,
                  padding: "0 18px",
                  border: `1px solid ${NAVY}`,
                  borderRadius: 10,
                  background: NAVY,
                  color: "#fff",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Choose File
              </label>
            )}
          </div>
          <div style={{ marginTop: 12 }}>
            <button type="button" style={btn(NAVY, !fileBase64 || busy === "preview")} disabled={!fileBase64 || busy === "preview"} onClick={runPreview}>
              {busy === "preview" ? "Previewing…" : "Preview (read-only)"}
            </button>
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #dbe4f0", fontSize: 13, color: MUTED }}>
            <strong>Test data:</strong>{" "}
            <button type="button" style={{ ...btn(MUTED, busy === "seed"), height: 32, padding: "0 12px" }} disabled={busy === "seed"} onClick={() => seedTest(false)}>Seed carriers + provider</button>{" "}
            <button type="button" style={{ ...btn("#dc2626", busy === "seed"), height: 32, padding: "0 12px" }} disabled={busy === "seed"} onClick={() => seedTest(true)}>Remove test seed</button>
          </div>
        </div>

        {error ? <div style={{ ...box, borderColor: "#fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 700 }}>{error}</div> : null}

        {s ? (
          <div style={box}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>2. Preview — {s.total} rows</div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", color: MUTED, fontWeight: 700 }}>
              <span style={{ color: "#16a34a" }}>Ready: {s.ready}</span>
              <span style={{ color: "#b45309" }}>Held (add carrier): {s.held}</span>
              <span style={{ color: "#dc2626" }}>Errors: {s.errors}</span>
              <span>Duplicates (existing): {s.duplicatesExisting}</span>
              <span>Duplicates (in file): {s.duplicatesInFile}</span>
              <span style={{ color: "#b45309" }}>Unmatched carriers: {s.unmatchedCarriers}</span>
              <span>New patients: {s.newPatients}</span>
              <span>Patients to confirm: {s.patientsToConfirm}</span>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>3. Provider (applies to every row) — Case Type = No-Fault</div>
              <select value={providerId} onChange={(e) => setProviderId(e.target.value)} style={{ height: 38, minWidth: 340, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 10px" }}>
                <option value="">Select provider…</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.displayName}</option>
                ))}
              </select>
              <div style={{ marginTop: 12 }}>
                <button type="button" style={btn("#16a34a", !providerId || busy === "confirm" || !!confirmResult)} disabled={!providerId || busy === "confirm" || !!confirmResult} onClick={runConfirm}>
                  {confirmResult ? "Imported ✓" : busy === "confirm" ? "Creating…" : `Confirm — create ${s.ready} matters`}
                </button>
                {confirmResult ? (
                  <div style={{ marginTop: 8, color: MUTED, fontSize: 13 }}>
                    Already imported this preview (batch {confirmResult.batchId}). Re-run Preview to import again.
                  </div>
                ) : null}
              </div>
            </div>

            <div style={{ overflowX: "auto", marginTop: 14 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: MUTED }}>
                    {columns.map((c) => (
                      <th
                        key={c.key}
                        onClick={() => toggleSort(c.key)}
                        style={{ padding: 6, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                        title="Click to sort"
                      >
                        {c.label}{sortKey === c.key ? (sortDir === 1 ? " ▲" : " ▼") : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((r) => (
                    <tr key={r.rowIndex} style={{ borderTop: "1px solid #eef2f7" }}>
                      <td style={{ padding: 6 }}>{r.rowIndex + 1}</td>
                      <td>{r.staged.patient_name}</td>
                      <td>{r.staged.claim_number_raw}</td>
                      <td>{r.staged.dos_start === r.staged.dos_end ? r.staged.dos_start : `${r.staged.dos_start} – ${r.staged.dos_end}`}</td>
                      <td>{r.staged.claim_amount == null ? "" : `$${r.staged.claim_amount.toFixed(2)}`}</td>
                      <td style={{ color: r.carrier.status === "matched" ? "#16a34a" : "#b45309" }}>{r.carrier.status === "matched" ? r.carrier.displayName : "unmatched"}</td>
                      <td>{r.patient.status}</td>
                      <td style={{ fontWeight: 800, color: r.outcome === "ready" ? "#16a34a" : r.outcome === "error" ? "#dc2626" : MUTED }}>
                        {r.outcome}{r.existingDisplayNumber ? ` (${r.existingDisplayNumber})` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ color: MUTED, marginTop: 6 }}>Showing all {sortedRows.length} rows. Click a column header to sort.</div>
            </div>
          </div>
        ) : null}

        {confirmResult ? (
          <div style={{ ...box, borderColor: "#bbf7d0", background: "#f0fdf4" }}>
            <div style={{ fontWeight: 900, color: "#166534" }}>Imported — batch {confirmResult.batchId}</div>
            <div style={{ color: MUTED, marginTop: 6 }}>
              Created: {confirmResult.summary.created} · Duplicates: {confirmResult.summary.duplicates} · Errors: {confirmResult.summary.errors} · Held (unmatched carrier): {confirmResult.summary.held} · Provider: {confirmResult.provider}
            </div>
            <div style={{ marginTop: 12 }}>
              <button type="button" style={btn("#dc2626", busy.startsWith("undo"))} disabled={busy.startsWith("undo")} onClick={runUndo}>
                {busy.startsWith("undo") ? "Undoing…" : "Undo this import"}
              </button>
            </div>
          </div>
        ) : null}

        {undoResult ? (
          <div style={{ ...box, borderColor: "#fed7aa", background: "#fff7ed" }}>
            <div style={{ fontWeight: 900, color: "#9a3412" }}>Undone — removed {undoResult.removed}, kept {undoResult.kept}</div>
            <div style={{ color: MUTED, marginTop: 6 }}>{undoResult.note}</div>
          </div>
        ) : null}

        <div style={box}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 900 }}>Existing imports</div>
            <div style={{ display: "flex", gap: 8 }}>
              <a href="/admin/import/reconcile" style={{ ...btn("#b45309"), height: 32, padding: "0 12px", display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Reconcile held</a>
              <button type="button" style={{ ...btn(MUTED, busy === "batches"), height: 32, padding: "0 12px" }} disabled={busy === "batches"} onClick={() => { setBusy("batches"); void loadBatches().finally(() => setBusy("")); }}>
                Refresh
              </button>
            </div>
          </div>
          {batches.length === 0 ? (
            <div style={{ color: MUTED }}>No imports yet.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: MUTED }}>
                    {batchColumns.map((c) => (
                      <th key={c.key} onClick={() => toggleBatchSort(c.key)} style={{ padding: 6, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }} title="Click to sort">
                        {c.label}{batchSortKey === c.key ? (batchSortDir === 1 ? " ▲" : " ▼") : ""}
                      </th>
                    ))}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBatches.map((b) => (
                    <tr key={b.id} style={{ borderTop: "1px solid #eef2f7" }}>
                      <td style={{ padding: 6, whiteSpace: "nowrap" }}>{new Date(b.createdAt).toLocaleString()}</td>
                      <td style={{ textTransform: "uppercase", fontWeight: 700 }}>{b.source}</td>
                      <td>{b.sourceFile || "—"}</td>
                      <td>{b.totalRows}</td>
                      <td style={{ color: "#16a34a", fontWeight: 700 }}>{b.createdCount}</td>
                      <td style={{ color: (b.held || 0) > 0 ? "#dc2626" : MUTED, fontWeight: (b.held || 0) > 0 ? 700 : 400 }}>{b.held || 0}</td>
                      <td style={{ color: (b.rejectedCount || 0) > 0 ? "#dc2626" : MUTED, fontWeight: (b.rejectedCount || 0) > 0 ? 700 : 400 }}>{b.rejectedCount}</td>
                      <td>{b.other || 0}</td>
                      <td style={{ fontWeight: 800, color: b.status === "undone" ? "#9a3412" : "#166534" }}>{b.status}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button type="button" style={{ ...btn(NAVY, busy === "detail:" + b.id), height: 28, padding: "0 10px", fontSize: 12, marginRight: 8 }} disabled={busy === "detail:" + b.id} onClick={() => openBatchDetail(b.id)}>
                          {detailId === b.id ? "Hide" : busy === "detail:" + b.id ? "Loading…" : "Details"}
                        </button>
                        {b.status === "undone" ? (
                          <span style={{ color: MUTED }}>—</span>
                        ) : (
                          <button type="button" style={{ ...btn("#dc2626", busy === "undo:" + b.id), height: 28, padding: "0 10px", fontSize: 12 }} disabled={busy.startsWith("undo")} onClick={() => undoBatch(b.id)}>
                            {busy === "undo:" + b.id ? "Undoing…" : "Undo"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {detailId && detail?.batch ? (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "2px solid #eef2f7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ fontWeight: 900 }}>
                  Import details — {detail.batch.source?.toUpperCase()} · {detail.batch.sourceFile || "—"}
                </div>
                <a href={`/admin/import/reconcile?batchId=${detailId}`} style={{ ...btn("#b45309"), height: 30, padding: "0 12px", display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Reconcile this batch</a>
              </div>
              <div style={{ color: MUTED, fontSize: 13, marginBottom: 10 }}>
                Batch {detail.batch.id} · {new Date(detail.batch.createdAt).toLocaleString()} · Provider: {detail.batch.providerName || "—"} · Status: {detail.batch.status}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {[
                  { key: "all", label: `All (${detail.rows.length})` },
                  { key: "created", label: `Created (${detail.byOutcome?.created || 0})` },
                  { key: "held", label: `Held (${detail.byOutcome?.held || 0})` },
                  { key: "duplicate", label: `Duplicates (${detail.byOutcome?.duplicate || 0})` },
                  { key: "error", label: `Errors (${detail.byOutcome?.error || 0})` },
                ].map((f) => {
                  const on = detailOutcome === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setDetailOutcome(f.key)}
                      style={{ height: 30, padding: "0 12px", borderRadius: 999, fontSize: 12, fontWeight: 800, cursor: "pointer", border: `1px solid ${on ? NAVY : "#cbd5e1"}`, background: on ? NAVY : "#fff", color: on ? "#fff" : MUTED }}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: MUTED }}>
                      {[
                        { key: "rowIndex", label: "Row" },
                        { key: "outcome", label: "Outcome" },
                        { key: "matter", label: "Matter #" },
                        { key: "patient", label: "Patient" },
                        { key: "stage", label: "Stage" },
                        { key: "reason", label: "Reason" },
                      ].map((c) => (
                        <th key={c.key} onClick={() => toggleDetailSort(c.key)} style={{ padding: 6, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }} title="Click to sort">
                          {c.label}{detailSortKey === c.key ? (detailSortDir === 1 ? " ▲" : " ▼") : ""}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.rows as any[])
                      .filter((r) => detailOutcome === "all" || r.outcome === detailOutcome)
                      .slice()
                      .sort((a, b) => {
                        const va = detailSortValue(a, detailSortKey);
                        const vb = detailSortValue(b, detailSortKey);
                        const cmp = typeof va === "number" && typeof vb === "number"
                          ? va - vb
                          : String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: "base" });
                        return cmp * detailSortDir;
                      })
                      .map((r) => (
                        <tr key={r.rowIndex} style={{ borderTop: "1px solid #eef2f7" }}>
                          <td style={{ padding: 6 }}>{r.rowIndex + 1}</td>
                          <td style={{ fontWeight: 800, color: r.outcome === "created" ? "#16a34a" : r.outcome === "held" ? "#b45309" : r.outcome === "error" ? "#dc2626" : MUTED }}>{r.outcome}</td>
                          <td>{r.displayNumber ? <a href={`/matter/${r.matterId}`} style={{ color: NAVY, fontWeight: 700 }}>{r.displayNumber}</a> : "—"}</td>
                          <td>{r.patientName || "—"}</td>
                          <td>{r.stage || "—"}</td>
                          <td style={{ color: MUTED }}>{r.reason || "—"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
