"use client";

import React from "react";
import BarshHeader from "@/app/components/BarshHeader";

// One-time BULK LOAD of a very large closed-file spreadsheet (e.g. "NF All Closed.xlsx").
// Flow: upload -> map columns (auto-suggested) + pick provider/case type -> aggregate preview -> confirm.
// Carrier matching is lenient (records raw when unmatched), patients dedup by accident key with a
// pre-2025 quarantine, and every created matter is tagged import_batch="nf-legacy" (shown as -legacy).

const NAVY = "#00346e";
const MUTED = "#385a83";

type Field = { key: string; label: string; required?: boolean };
type ProviderOpt = { id: string; label: string };

const CASE_TYPES = ["", "No-Fault", "Workers Compensation", "Lien"];

async function fileToBase64(file: File): Promise<string> {
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result || ""));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
  return dataUrl.split(",")[1] || "";
}

export default function BulkImportPage() {
  const [fileB64, setFileB64] = React.useState("");
  const [fileName, setFileName] = React.useState("");
  const [busy, setBusy] = React.useState("");
  const [err, setErr] = React.useState("");
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [fields, setFields] = React.useState<Field[]>([]);
  const [rowCount, setRowCount] = React.useState(0);
  const [mapping, setMapping] = React.useState<Record<string, string>>({});
  const [providers, setProviders] = React.useState<ProviderOpt[]>([]);
  const [providerId, setProviderId] = React.useState("");
  const [caseType, setCaseType] = React.useState("");
  const [maxRows, setMaxRows] = React.useState("");
  const [preview, setPreview] = React.useState<any>(null);
  const [result, setResult] = React.useState<any>(null);

  React.useEffect(() => {
    fetch("/api/reference-data/options?type=provider_client&activeOnly=true")
      .then((r) => r.json())
      .then((d) => setProviders((d?.options || []).map((o: any) => ({ id: o.id, label: o.label || o.displayName }))))
      .catch(() => {});
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(""); setPreview(null); setResult(null);
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy("Reading file…"); setFileName(f.name);
    try {
      const b64 = await fileToBase64(f);
      setFileB64(b64);
      setBusy("Parsing headers…");
      const r = await fetch("/api/import/bulk/headers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileBase64: b64 }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Header parse failed.");
      setHeaders(d.headers || []); setFields(d.fields || []); setRowCount(d.rowCount || 0); setMapping(d.suggestedMapping || {});
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setBusy(""); }
  }

  const fixed = () => ({ providerEntityId: providerId, caseType: caseType || undefined });

  async function runPreview() {
    setErr(""); setResult(null); setBusy("Previewing (aggregate)…");
    try {
      const r = await fetch("/api/import/bulk/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileBase64: fileB64, mapping, fixed: fixed() }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Preview failed.");
      setPreview(d);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setBusy(""); }
  }

  async function runConfirm() {
    const n = maxRows ? ` (trial: first ${maxRows} rows)` : "";
    if (!window.confirm(`Create matters from this file${n}? Every row becomes a matter tagged "nf-legacy".`)) return;
    setErr(""); setBusy("Importing… (large files take a while — keep this tab open)");
    try {
      const r = await fetch("/api/import/bulk/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileBase64: fileB64, mapping, fixed: fixed(), sourceFile: fileName, maxRows: maxRows ? Number(maxRows) : undefined }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Import failed.");
      setResult(d);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setBusy(""); }
  }

  const card: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 18, padding: 18, marginBottom: 14, boxShadow: "0 10px 26px rgba(15,23,42,.06)" };
  const label: React.CSSProperties = { fontWeight: 800, color: MUTED, marginBottom: 4, display: "block" };

  return (
    <main style={{ padding: "12px 14px 60px", background: "#f8fafc", minHeight: "100vh", color: NAVY, fontFamily: "Inter, system-ui, sans-serif" }}>
      <BarshHeader center={<div style={{ fontSize: 26, fontWeight: 950, color: "#fff" }}>Bulk Import (one-time closed-file load)</div>} />
      <div style={{ marginBottom: 12 }}>
        <a href="/admin/import/other" style={{ color: MUTED, fontWeight: 800, textDecoration: "none" }}>← Back to Import — Other Sources</a>
      </div>

      {err && <div style={{ ...card, borderColor: "#fecaca", background: "#fef2f2", color: "#b91c1c", fontWeight: 700 }}>{err}</div>}
      {busy && <div style={{ ...card, borderColor: "#bfdbfe", background: "#eff6ff", fontWeight: 700 }}>{busy}</div>}

      <section style={card}>
        <span style={label}>1 · Spreadsheet (.xlsx)</span>
        <input type="file" accept=".xlsx,.xls" onChange={onFile} />
        {fileName && <div style={{ marginTop: 8, color: MUTED }}>{fileName} — {rowCount.toLocaleString()} rows</div>}
      </section>

      {headers.length > 0 && (
        <>
          <section style={card}>
            <span style={label}>2 · Map columns → BM fields</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 10 }}>
              {fields.map((f) => (
                <div key={f.key}>
                  <div style={{ fontWeight: 700 }}>{f.label}{f.required ? " *" : ""}</div>
                  <select value={mapping[f.key] || ""} onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))} style={{ width: "100%", padding: 6, borderRadius: 8, border: "1px solid #cbd5e1" }}>
                    <option value="">— none —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </section>

          <section style={card}>
            <span style={label}>3 · Fallback Provider / Client (optional)</span>
            <div style={{ color: MUTED, fontSize: 13, marginBottom: 6 }}>Provider resolves per-row from the mapped "Provider" column. This fallback is only used for rows whose Provider cell is blank.</div>
            <select value={providerId} onChange={(e) => setProviderId(e.target.value)} style={{ width: "100%", maxWidth: 520, padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}>
              <option value="">— none (rows with no provider stay blank) —</option>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <div style={{ marginTop: 12 }}>
              <span style={label}>Case Type (fixed override; else use the mapped column)</span>
              <select value={caseType} onChange={(e) => setCaseType(e.target.value)} style={{ width: 260, padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}>
                {CASE_TYPES.map((c) => <option key={c} value={c}>{c || "— use mapped column —"}</option>)}
              </select>
            </div>
          </section>

          <section style={card}>
            <span style={label}>4 · Preview & import</span>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={runPreview} disabled={!!busy} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 800, cursor: "pointer" }}>Preview (aggregate)</button>
              <span style={{ color: MUTED }}>Trial run — first</span>
              <input value={maxRows} onChange={(e) => setMaxRows(e.target.value.replace(/[^0-9]/g, ""))} placeholder="all" style={{ width: 90, padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }} />
              <span style={{ color: MUTED }}>rows</span>
              <button onClick={runConfirm} disabled={!!busy} style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: NAVY, color: "#fff", fontWeight: 900, cursor: "pointer", opacity: busy ? 0.5 : 1 }}>Confirm Import</button>
            </div>
          </section>
        </>
      )}

      {preview?.summary && (
        <section style={card}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Preview</div>
          <StatGrid s={preview.summary} />
          {preview.rawCarrierSamples?.length > 0 && (
            <div style={{ marginTop: 10, color: MUTED }}>Recorded-raw carriers (sample): {preview.rawCarrierSamples.join(", ")}</div>
          )}
        </section>
      )}

      {result?.summary && (
        <section style={{ ...card, borderColor: "#bbf7d0", background: "#f0fdf4" }}>
          <div style={{ fontWeight: 900, marginBottom: 8, color: "#166534" }}>Import complete — batch {result.batchId}</div>
          <StatGrid s={result.summary} />
        </section>
      )}
    </main>
  );
}

function StatGrid({ s }: { s: Record<string, any> }) {
  const labels: Record<string, string> = {
    totalRows: "Total rows", creatable: "Creatable", created: "Created matters",
    heldMissingField: "Missing-field (skipped)", skippedMissingField: "Missing-field (skipped)",
    distinctCarriers: "Distinct carriers", carrierMatchedToRegistry: "Carriers → registry",
    carrierViaLegacyMap: "Carriers → legacy map", carrierRecordedRaw: "Carriers recorded raw",
    distinctProviders: "Distinct providers",
    distinctPatients: "Distinct patients", patientsCreated: "Patients created",
    patientsMatchable2025Plus: "Patients matchable (2025+)", patientsQuarantinedPre2025: "Patients quarantined (pre-2025)",
    lawsuitsCreated: "Lawsuits created (Packets)", mattersAggregatedIntoLawsuits: "Matters in lawsuits", standaloneMatters: "Standalone matters",
    duplicateWithinFile: "Dup within file", duplicateAgainstExisting: "Dup vs existing", importBatch: "Import batch",
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
      {Object.entries(s).filter(([k]) => labels[k]).map(([k, v]) => (
        <div key={k} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 10px", background: "#fff" }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>{labels[k]}</div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{typeof v === "number" ? v.toLocaleString() : String(v)}</div>
        </div>
      ))}
    </div>
  );
}
