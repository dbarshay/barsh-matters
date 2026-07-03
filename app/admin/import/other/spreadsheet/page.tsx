"use client";

import React, { useCallback, useEffect, useState } from "react";
import BarshHeader from "@/app/components/BarshHeader";

// Generic "other spreadsheet" importer: upload -> detect columns -> map (auto-suggested + override) ->
// pick provider (never parsed) + case type (map or pick) -> save/load mapping template -> preview ->
// confirm -> reconcile held. Reuses the shared preview/hold/reconcile pipeline (source="other").

const NAVY = "#00346e";
const MUTED = "#385a83";
type Opt = { id: string; displayName: string };
type FieldDef = { key: string; label: string; required: boolean };

const box: React.CSSProperties = { border: "1px solid #dbe4f0", borderRadius: 12, padding: 16, background: "#fff", marginBottom: 16 };
const input: React.CSSProperties = { height: 34, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 8px", boxSizing: "border-box" };
const btn = (bg: string, disabled = false): React.CSSProperties => ({ height: 38, padding: "0 16px", border: `1px solid ${bg}`, borderRadius: 9, background: disabled ? "#e2e8f0" : bg, color: disabled ? "#94a3b8" : "#fff", fontWeight: 900, cursor: disabled ? "not-allowed" : "pointer" });

export default function OtherSpreadsheetPage() {
  const [fileBase64, setFileBase64] = useState("");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [providers, setProviders] = useState<Opt[]>([]);
  const [providerEntityId, setProviderEntityId] = useState("");
  const [caseMode, setCaseMode] = useState<"map" | "pick">("pick");
  const [caseTypePick, setCaseTypePick] = useState("No-Fault");
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [dragging, setDragging] = useState(false);

  const load = useCallback(async (url: string) => { try { const r = await fetch(url, { cache: "no-store" }); return await r.json(); } catch { return null; } }, []);

  const loadProviders = useCallback(async () => {
    const j = await load("/api/reference-data/options?type=provider_client");
    const rows = j?.options || j?.rows || j?.entities || [];
    setProviders(rows.map((o: any) => ({ id: o.id, displayName: o.displayName || o.label || o.id })));
  }, [load]);
  const loadTemplates = useCallback(async () => { const j = await load("/api/import/other/mappings"); if (j?.ok) setTemplates(j.mappings || []); }, [load]);
  const loadBatches = useCallback(async () => { const j = await load("/api/import/batches?take=50&source=other"); if (j?.ok) setBatches(j.batches || []); }, [load]);

  useEffect(() => { void loadProviders(); void loadTemplates(); void loadBatches(); }, [loadProviders, loadTemplates, loadBatches]);

  function ingest(file?: File | null) {
    setHeaders([]); setMapping({}); setPreview(null); setError(""); setFlash("");
    if (!file) return;
    if (!/\.xlsx?$/.test(file.name.toLowerCase())) { setError("Choose an .xlsx or .xls file."); return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setFileBase64(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(file);
  }

  async function detect() {
    if (!fileBase64) return;
    setBusy("detect"); setError("");
    const r = await fetch("/api/import/other/headers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileBase64 }) });
    const j = await r.json(); setBusy("");
    if (!j.ok) { setError(j.error || "Could not read columns."); return; }
    setHeaders(j.headers || []); setFields(j.fields || []); setMapping(j.suggested || {});
  }

  const fixed = () => ({ providerEntityId, ...(caseMode === "pick" ? { caseType: caseTypePick } : {}) });
  const bodyMapping = () => { const m = { ...mapping }; if (caseMode === "pick") delete m.case_type; return m; };

  async function saveTemplate() {
    if (!templateName.trim()) { setError("Name the mapping first."); return; }
    const r = await fetch("/api/import/other/mappings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: templateName.trim(), mapping: bodyMapping(), fixed: fixed() }) });
    const j = await r.json(); if (j.ok) { setFlash(`Saved mapping "${templateName.trim()}".`); await loadTemplates(); } else setError(j.error || "Save failed.");
  }
  function applyTemplate(t: any) {
    setMapping(t.mapping || {});
    const f = t.fixed || {};
    if (f.providerEntityId) setProviderEntityId(f.providerEntityId);
    if (f.caseType) { setCaseMode("pick"); setCaseTypePick(f.caseType); } else setCaseMode("map");
    setFlash(`Loaded mapping "${t.name}".`);
  }

  async function runPreview() {
    if (!providerEntityId) { setError("Pick a Provider/Client."); return; }
    setBusy("preview"); setError("");
    const r = await fetch("/api/import/other/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileBase64, mapping: bodyMapping(), fixed: fixed() }) });
    const j = await r.json(); setBusy("");
    if (!j.ok) setError(j.error || "Preview failed."); else setPreview(j);
  }

  async function runConfirm() {
    if (!window.confirm("Create matters for all 'ready' rows? You can undo afterward.")) return;
    setBusy("confirm"); setError("");
    const r = await fetch("/api/import/other/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileBase64, mapping: bodyMapping(), fixed: fixed(), sourceFile: fileName }) });
    const j = await r.json(); setBusy("");
    if (!j.ok) { setError(j.error || "Confirm failed."); return; }
    setFlash(`Imported ${j.summary?.created ?? 0} matter(s)${j.summary?.held ? ` · ${j.summary.held} held — reconcile below` : ""}.`);
    setPreview(null); setFileBase64(""); setFileName(""); setHeaders([]);
    await loadBatches();
  }

  const s = preview?.summary;

  return (
    <main style={{ padding: "12px 14px 40px", background: "#f8fafc", minHeight: "100vh", color: NAVY, fontFamily: "Inter, system-ui, sans-serif" }}>
      <BarshHeader center={<div style={{ fontSize: 28, fontWeight: 950, color: "#fff" }}>Import — Other Spreadsheet</div>} />
      <div style={{ width: "100%", maxWidth: "100%", margin: 0, boxSizing: "border-box" }}>
        <div style={{ marginBottom: 12 }}><a href="/admin/import/other" style={{ color: MUTED, fontWeight: 800, textDecoration: "none" }}>← Back to Other Sources</a></div>

        {flash ? <div style={{ ...box, borderColor: "#bbf7d0", background: "#f0fdf4", color: "#166534", fontWeight: 700 }}>{flash}</div> : null}
        {error ? <div style={{ ...box, borderColor: "#fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 700 }}>{error}</div> : null}

        <div style={box}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>1. Upload spreadsheet + detect columns</div>
          <div
            onDragOver={(e) => { e.preventDefault(); if (!dragging) setDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
            onDrop={(e) => { e.preventDefault(); setDragging(false); ingest(e.dataTransfer.files?.[0]); }}
            style={{ border: `2px dashed ${dragging ? NAVY : "#cbd5e1"}`, borderRadius: 12, background: dragging ? "#eef4fb" : "#f8fafc", padding: "22px 16px", textAlign: "center", color: MUTED }}
          >
            <div style={{ fontWeight: 800, color: dragging || fileName ? NAVY : MUTED, marginBottom: 12 }}>{dragging ? "Drop to load" : fileName ? "File Selected" : "Drag & Drop or Pick File"}</div>
            <input id="other-file-input" type="file" accept=".xlsx,.xls" onChange={(e) => ingest(e.target.files?.[0])} style={{ display: "none" }} />
            {fileName ? (
              <div>
                <div style={{ color: NAVY, fontWeight: 700 }}>{fileName}</div>
                <label htmlFor="other-file-input" style={{ marginTop: 8, display: "inline-block", color: MUTED, fontSize: 13, textDecoration: "underline", cursor: "pointer" }}>Choose a different file</label>
              </div>
            ) : (
              <label htmlFor="other-file-input" style={{ display: "inline-flex", alignItems: "center", height: 38, padding: "0 18px", border: `1px solid ${NAVY}`, borderRadius: 10, background: NAVY, color: "#fff", fontWeight: 900, cursor: "pointer" }}>Choose File</label>
            )}
          </div>
          <div style={{ marginTop: 10 }}>
            <button type="button" style={btn(NAVY, !fileBase64 || busy === "detect")} disabled={!fileBase64 || busy === "detect"} onClick={detect}>{busy === "detect" ? "Reading…" : "Detect columns"}</button>
          </div>
        </div>

        {headers.length ? (
          <div style={box}>
            <div style={{ fontWeight: 900, marginBottom: 4 }}>2. Map columns → BM fields</div>
            <div style={{ color: MUTED, fontSize: 13, marginBottom: 10 }}>Auto-suggested from your headers — adjust as needed. Provider is picked (never parsed). Required fields are marked *.</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {/* Provider pick (required) */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: MUTED }}>Provider / Client * <span style={{ color: NAVY }}>(pick)</span></div>
                <select value={providerEntityId} onChange={(e) => setProviderEntityId(e.target.value)} style={{ ...input, width: "100%", height: 34 }}>
                  <option value="">Select provider…</option>
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                </select>
              </div>
              {/* Case type: map or pick */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: MUTED }}>Case Type *</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <select value={caseMode} onChange={(e) => setCaseMode(e.target.value as any)} style={{ ...input, height: 34 }}>
                    <option value="pick">Pick one</option>
                    <option value="map">Map column</option>
                  </select>
                  {caseMode === "pick" ? (
                    <select value={caseTypePick} onChange={(e) => setCaseTypePick(e.target.value)} style={{ ...input, height: 34, flex: 1 }}><option>No-Fault</option><option>Workers Compensation</option><option>Lien</option></select>
                  ) : (
                    <select value={mapping.case_type || ""} onChange={(e) => setMapping((m) => ({ ...m, case_type: e.target.value }))} style={{ ...input, height: 34, flex: 1 }}>
                      <option value="">Select column…</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  )}
                </div>
              </div>
              {/* Remaining fields (mapped) */}
              {fields.filter((f) => f.key !== "case_type").map((f) => (
                <div key={f.key}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: MUTED }}>{f.label}{f.required ? " *" : ""}</div>
                  <select value={mapping[f.key] || ""} onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))} style={{ ...input, width: "100%", height: 34 }}>
                    <option value="">— unmapped —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #dbe4f0", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: MUTED, fontWeight: 700 }}>Mapping template:</span>
              <select onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) applyTemplate(t); }} style={{ ...input, height: 34, minWidth: 180 }}>
                <option value="">Load saved…</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Save as…" style={{ ...input, height: 34, minWidth: 160 }} />
              <button type="button" style={{ ...btn(MUTED), height: 34 }} onClick={saveTemplate}>Save mapping</button>
            </div>

            <div style={{ marginTop: 12 }}>
              <button type="button" style={btn(NAVY, busy === "preview")} disabled={busy === "preview"} onClick={runPreview}>{busy === "preview" ? "Previewing…" : "Preview (read-only)"}</button>
            </div>
          </div>
        ) : null}

        {s ? (
          <div style={box}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>3. Preview — {s.total} rows</div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", color: MUTED, fontWeight: 700 }}>
              <span style={{ color: "#16a34a" }}>Ready: {s.ready}</span>
              <span style={{ color: "#dc2626" }}>Held: {s.held} (missing {s.heldMissing ?? 0}, carrier {s.heldCarrier ?? 0}, case-type {s.heldCaseType ?? 0}, patient {s.heldPatient ?? 0}, data {s.heldDataQuality ?? 0})</span>
              <span>Duplicates (existing): {s.duplicatesExisting}</span>
              <span>Duplicates (in file): {s.duplicatesInFile}</span>
            </div>
            <div style={{ marginTop: 12 }}>
              <button type="button" style={btn("#16a34a", busy === "confirm")} disabled={busy === "confirm"} onClick={runConfirm}>{busy === "confirm" ? "Creating…" : `Confirm — create ${s.ready} matters`}</button>
            </div>
          </div>
        ) : null}

        <div style={box}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 900 }}>Existing Other-Spreadsheet imports</div>
            <button type="button" style={{ ...btn(MUTED), height: 32 }} onClick={() => void loadBatches()}>Refresh</button>
          </div>
          {batches.length === 0 ? <div style={{ color: MUTED }}>No imports yet.</div> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ textAlign: "left", color: MUTED }}><th style={{ padding: 6 }}>When</th><th>File</th><th>Rows</th><th>Created</th><th>Held</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} style={{ borderTop: "1px solid #eef2f7", opacity: b.status === "undone" ? 0.45 : 1 }}>
                    <td style={{ padding: 6, whiteSpace: "nowrap" }}>{new Date(b.createdAt).toLocaleString()}</td>
                    <td>{b.sourceFile || "—"}</td>
                    <td>{b.totalRows}</td>
                    <td style={{ color: "#16a34a", fontWeight: 700 }}>{b.createdCount}</td>
                    <td style={{ color: (b.held || 0) > 0 ? "#dc2626" : MUTED, fontWeight: (b.held || 0) > 0 ? 700 : 400 }}>{b.held || 0}</td>
                    <td style={{ fontWeight: 800, color: b.status === "undone" ? "#9a3412" : "#166534" }}>{b.status}</td>
                    <td>{b.status !== "undone" && (b.held || 0) > 0 ? <a href={`/admin/import/reconcile?batchId=${b.id}&source=other`} style={{ ...btn("#b45309"), height: 28, padding: "0 10px", fontSize: 12, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Reconcile Held Cases</a> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
