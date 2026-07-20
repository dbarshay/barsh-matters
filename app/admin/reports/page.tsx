/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, @next/next/no-html-link-for-pages -- Reports builder uses dynamic field/row shapes; effect loads initial catalog. */
"use client";

import React, { useEffect, useMemo, useState } from "react";

type Field = { key: string; label: string; group: string; type: string; rollup?: boolean };
type OpDef = { key: string; label: string; arity: 0 | 1 | 2 | "list" };
type Filter = { field: string; op: string; value?: any; value2?: any };
type Agg = { field: string; fn: string };
type Sort = { field: string; dir: "asc" | "desc" };

const navy = "#00346e";
const pill: React.CSSProperties = { border: `1px solid ${navy}`, background: navy, color: "#fff", borderRadius: 999, padding: "8px 14px", fontWeight: 950, cursor: "pointer", fontSize: 13 };
const pillOutline: React.CSSProperties = { border: `1px solid ${navy}`, background: "#eff6ff", color: navy, borderRadius: 999, padding: "6px 12px", fontWeight: 900, cursor: "pointer", fontSize: 12 };
const input: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 8px", fontSize: 13, color: navy };
const card: React.CSSProperties = { border: "1px solid #dbe4f0", borderRadius: 14, padding: 14, background: "#fff", marginBottom: 14 };
const h3: React.CSSProperties = { margin: "0 0 8px", fontSize: 15, color: navy };
const topLbl: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#385a83", fontWeight: 800 };
const topSel: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 8px", fontSize: 13, color: navy, minWidth: 150 };

function fmtCell(v: any, type: string): string {
  if (v === null || v === undefined) return "";
  if (type === "number") { const n = Number(v); return Number.isFinite(n) ? (Math.round(n * 100) / 100).toLocaleString("en-US") : String(v); }
  return String(v);
}

export default function ReportsPage() {
  const [fields, setFields] = useState<Field[]>([]);
  const [operators, setOperators] = useState<Record<string, OpDef[]>>({});
  const [aggregationsCatalog, setAggregationsCatalog] = useState<{ key: string; label: string }[]>([]);
  const [categoryValues, setCategoryValues] = useState<Record<string, string[]>>({});
  const [providers, setProviders] = useState<string[]>([]);
  const [insurers, setInsurers] = useState<string[]>([]);
  const [caseTypes, setCaseTypes] = useState<{ key: string; label: string }[]>([]);

  // top-line quick filters
  const [openClosed, setOpenClosed] = useState<"all" | "open" | "closed">("all");
  const [provider, setProvider] = useState("all");
  const [insurer, setInsurer] = useState("all");
  const [caseType, setCaseType] = useState("all");
  const [lawsuitBill, setLawsuitBill] = useState<"all" | "lawsuit" | "bill">("all");

  const [columns, setColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [filterLogic, setFilterLogic] = useState<"AND" | "OR">("AND");
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [aggs, setAggs] = useState<Agg[]>([]);
  const [sort, setSort] = useState<Sort[]>([]);
  const [mode, setMode] = useState<"detail" | "summary">("detail");

  const [result, setResult] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  const [saved, setSaved] = useState<any[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string>("");

  const fmap = useMemo(() => Object.fromEntries(fields.map((f) => [f.key, f])), [fields]);

  async function loadFields() {
    try {
      const res = await fetch(`/api/admin/reports/fields`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Could not load fields.");
      setFields(json.fields || []);
      setOperators(json.operators || {});
      setAggregationsCatalog(json.aggregations || []);
      setCategoryValues(json.categoryValues || {});
      setProviders(json.topLine?.providers || []);
      setInsurers(json.topLine?.insurers || []);
      setCaseTypes(json.topLine?.caseTypes || []);
    } catch (e: any) { setMessage(e?.message || "Could not load fields."); }
  }
  async function loadSavedReports() {
    try {
      const res = await fetch("/api/admin/reports", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json?.ok) { setSaved(json.reports || []); setIsOwner(Boolean(json.isOwner)); }
    } catch {}
  }
  useEffect(() => { void loadFields(); void loadSavedReports(); }, []);

  const grouped = useMemo(() => {
    const g: Record<string, Field[]> = {};
    for (const f of fields) (g[f.group] = g[f.group] || []).push(f);
    return g;
  }, [fields]);

  function toggleColumn(key: string) { setColumns((c) => (c.includes(key) ? c.filter((x) => x !== key) : [...c, key])); }
  function toggleGroup(gf: Field[]) {
    const keys = gf.map((f) => f.key);
    const allSelected = keys.every((k) => columns.includes(k));
    setColumns((c) => (allSelected ? c.filter((k) => !keys.includes(k)) : Array.from(new Set([...c, ...keys]))));
  }
  function currentConfig() {
    return { columns, filters, filterLogic, groupBy, aggregations: aggs, sort, mode, openClosed, provider, insurer, caseType, lawsuitBill };
  }

  async function runReport() {
    setRunning(true); setMessage("");
    try {
      const res = await fetch("/api/admin/reports/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: currentConfig() }) });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Report run failed.");
      setResult(json.result);
    } catch (e: any) { setMessage(e?.message || "Report run failed."); } finally { setRunning(false); }
  }
  async function exportReport(format: "xlsx" | "pdf") {
    setMessage("");
    try {
      const res = await fetch("/api/admin/reports/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: currentConfig(), format, title: name || "Report" }) });
      if (!res.ok) { const j = await res.json().catch(() => null); throw new Error(j?.error || "Export failed."); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${(name || "report").replace(/\s+/g, "-")}.${format}`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e: any) { setMessage(e?.message || "Export failed."); }
  }
  async function saveReport() {
    if (!name.trim()) { setMessage("Give the report a name before saving."); return; }
    setMessage("");
    try {
      const payload = { name: name.trim(), description, baseEntity: "matter", config: currentConfig() };
      const res = editingId
        ? await fetch(`/api/admin/reports/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/admin/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Save failed.");
      setMessage(editingId ? "Report updated." : "Report saved.");
      setEditingId(json.id || editingId); void loadSavedReports();
    } catch (e: any) { setMessage(e?.message || "Save failed."); }
  }
  function loadIntoBuilder(r: any) {
    const cfg = r.config || {};
    setEditingId(r.ownedByMe || isOwner ? r.id : "");
    setName(r.name || ""); setDescription(r.description || "");
    setColumns(cfg.columns || []); setFilters(cfg.filters || []); setFilterLogic(cfg.filterLogic || "AND");
    setGroupBy(cfg.groupBy || []); setAggs(cfg.aggregations || []); setSort(cfg.sort || []); setMode(cfg.mode || "detail");
    setOpenClosed(cfg.openClosed || "all"); setProvider(cfg.provider || "all"); setInsurer(cfg.insurer || "all");
    setCaseType(cfg.caseType || "all"); setLawsuitBill(cfg.lawsuitBill || "all");
    setMessage(`Loaded "${r.name}".`);
  }
  async function deleteSaved(id: string) {
    if (!window.confirm("Delete this saved report?")) return;
    const res = await fetch(`/api/admin/reports/${id}`, { method: "DELETE" });
    if (res.ok) { void loadSavedReports(); if (editingId === id) setEditingId(""); }
  }
  async function toggleShare(r: any) {
    const res = await fetch(`/api/admin/reports/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isShared: !r.isShared }) });
    if (res.ok) void loadSavedReports(); else setMessage("Only the owner can change sharing.");
  }
  const opsFor = (fieldKey: string): OpDef[] => operators[fmap[fieldKey]?.type] || [];

  const seg = (active: boolean) => (active ? pill : pillOutline);

  return (
    <main style={{ padding: 16, width: "100%", maxWidth: "none", margin: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 24, margin: 0, color: navy }}>Reports</h1>
        <a href="/admin" style={{ ...pillOutline, textDecoration: "none" }}>← Admin</a>
      </div>

      <div style={card}>
        <h3 style={h3}>Filters</h3>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={topLbl}>Status
            <select value={openClosed} onChange={(e) => setOpenClosed(e.target.value as any)} style={topSel}>
              <option value="all">All</option><option value="open">Open</option><option value="closed">Closed</option>
            </select>
          </label>
          <label style={topLbl}>Case Type
            <select value={caseType} onChange={(e) => setCaseType(e.target.value)} style={topSel}>
              <option value="all">All</option>
              {caseTypes.map((ct) => <option key={ct.key} value={ct.key}>{ct.label}</option>)}
            </select>
          </label>
          <label style={topLbl}>Lawsuit / Bill
            <select value={lawsuitBill} onChange={(e) => setLawsuitBill(e.target.value as any)} style={topSel}>
              <option value="all">All</option><option value="lawsuit">Lawsuit</option><option value="bill">Bill</option>
            </select>
          </label>
          <label style={topLbl}>Provider
            <select value={provider} onChange={(e) => setProvider(e.target.value)} style={{ ...topSel, minWidth: 220 }}>
              <option value="all">All</option>
              {providers.map((pv) => <option key={pv} value={pv}>{pv}</option>)}
            </select>
          </label>
          <label style={topLbl}>Insurer
            <select value={insurer} onChange={(e) => setInsurer(e.target.value)} style={{ ...topSel, minWidth: 220 }}>
              <option value="all">All</option>
              {insurers.map((iv) => <option key={iv} value={iv}>{iv}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div style={card}>
        <h3 style={h3}>Columns {columns.length ? `(${columns.length})` : ""}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          {Object.entries(grouped).map(([group, gf]) => (
            <div key={group}>
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 900, color: navy, fontSize: 12, marginBottom: 4, cursor: "pointer" }}>
                <input type="checkbox" checked={gf.length > 0 && gf.every((f) => columns.includes(f.key))} onChange={() => toggleGroup(gf)} />
                {group} <span style={{ fontWeight: 600, color: "#385a83" }}>(all)</span>
              </label>
              {gf.map((f) => (
                <label key={f.key} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: navy, padding: "2px 0" }}>
                  <input type="checkbox" checked={columns.includes(f.key)} onChange={() => toggleColumn(f.key)} />{f.label}
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <h3 style={h3}>Advanced filters</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: "#385a83" }}>Combine with</span>
          {(["AND", "OR"] as const).map((l) => <button key={l} type="button" onClick={() => setFilterLogic(l)} style={seg(filterLogic === l)}>{l}</button>)}
        </div>
        {filters.map((flt, i) => {
          const ops = opsFor(flt.field);
          const arity = ops.find((o) => o.key === flt.op)?.arity;
          const isCategory = fmap[flt.field]?.type === "category";
          return (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
              <select value={flt.field} style={input} onChange={(e) => { const nf = [...filters]; nf[i] = { field: e.target.value, op: (operators[fmap[e.target.value]?.type]?.[0]?.key) || "is" }; setFilters(nf); }}>
                {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
              <select value={flt.op} style={input} onChange={(e) => { const nf = [...filters]; nf[i] = { ...nf[i], op: e.target.value }; setFilters(nf); }}>
                {ops.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
              {arity !== 0 && isCategory && (categoryValues[flt.field] || []).length ? (
                <select value={flt.value ?? ""} style={input} onChange={(e) => { const nf = [...filters]; nf[i] = { ...nf[i], value: e.target.value }; setFilters(nf); }}>
                  <option value="">—</option>
                  {(categoryValues[flt.field] || []).map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              ) : arity !== 0 ? (
                <input style={input} placeholder="value" value={flt.value ?? ""} onChange={(e) => { const nf = [...filters]; nf[i] = { ...nf[i], value: e.target.value }; setFilters(nf); }} />
              ) : null}
              {arity === 2 ? (<input style={input} placeholder="and" value={flt.value2 ?? ""} onChange={(e) => { const nf = [...filters]; nf[i] = { ...nf[i], value2: e.target.value }; setFilters(nf); }} />) : null}
              <button type="button" onClick={() => setFilters(filters.filter((_, x) => x !== i))} style={{ ...pillOutline, border: "1px solid #dc2626", color: "#dc2626", background: "#fff" }}>Remove</button>
            </div>
          );
        })}
        <button type="button" onClick={() => setFilters([...filters, { field: fields[0]?.key || "", op: opsFor(fields[0]?.key)[0]?.key || "is" }])} style={pillOutline}>+ Add filter</button>
      </div>

      <div style={card}>
        <h3 style={h3}>Grouping & totals</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          {(["detail", "summary"] as const).map((m) => <button key={m} type="button" onClick={() => setMode(m)} style={seg(mode === m)}>{m === "detail" ? "Detail rows" : "Summary (grouped)"}</button>)}
        </div>
        <div style={{ fontSize: 12, color: "#385a83", marginBottom: 4 }}>Group by</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {fields.filter((f) => f.type === "category" || f.type === "text").map((f) => (
            <label key={f.key} style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 12, color: navy }}>
              <input type="checkbox" checked={groupBy.includes(f.key)} onChange={() => setGroupBy((g) => g.includes(f.key) ? g.filter((x) => x !== f.key) : [...g, f.key])} />{f.label}
            </label>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "#385a83", marginBottom: 4 }}>Aggregations</div>
        {aggs.map((a, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
            <select value={a.fn} style={input} onChange={(e) => { const na = [...aggs]; na[i] = { ...na[i], fn: e.target.value }; setAggs(na); }}>
              {aggregationsCatalog.map((ag) => <option key={ag.key} value={ag.key}>{ag.label}</option>)}
            </select>
            <span style={{ color: "#385a83", fontSize: 12 }}>of</span>
            <select value={a.field} style={input} onChange={(e) => { const na = [...aggs]; na[i] = { ...na[i], field: e.target.value }; setAggs(na); }}>
              {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
            <button type="button" onClick={() => setAggs(aggs.filter((_, x) => x !== i))} style={{ ...pillOutline, border: "1px solid #dc2626", color: "#dc2626", background: "#fff" }}>Remove</button>
          </div>
        ))}
        <button type="button" onClick={() => setAggs([...aggs, { field: fields.find((f) => f.type === "number")?.key || fields[0]?.key || "", fn: "sum" }])} style={pillOutline}>+ Add aggregation</button>
      </div>

      <div style={card}>
        <h3 style={h3}>Sort</h3>
        {sort.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
            <select value={s.field} style={input} onChange={(e) => { const ns = [...sort]; ns[i] = { ...ns[i], field: e.target.value }; setSort(ns); }}>
              {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
            <select value={s.dir} style={input} onChange={(e) => { const ns = [...sort]; ns[i] = { ...ns[i], dir: e.target.value as any }; setSort(ns); }}>
              <option value="asc">Ascending</option><option value="desc">Descending</option>
            </select>
            <button type="button" onClick={() => setSort(sort.filter((_, x) => x !== i))} style={{ ...pillOutline, border: "1px solid #dc2626", color: "#dc2626", background: "#fff" }}>Remove</button>
          </div>
        ))}
        <button type="button" onClick={() => setSort([...sort, { field: columns[0] || fields[0]?.key || "", dir: "asc" }])} style={pillOutline}>+ Add sort</button>
      </div>

      <div style={{ ...card, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={runReport} disabled={running} style={{ ...pill, opacity: running ? 0.6 : 1 }}>{running ? "Running…" : "Run report"}</button>
        <button type="button" onClick={() => exportReport("xlsx")} style={pillOutline}>Export XLSX</button>
        <button type="button" onClick={() => exportReport("pdf")} style={pillOutline}>Export PDF</button>
        <div style={{ flex: 1 }} />
        <input style={{ ...input, minWidth: 180 }} placeholder="Report name" value={name} onChange={(e) => setName(e.target.value)} />
        <input style={{ ...input, minWidth: 200 }} placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <button type="button" onClick={saveReport} style={pill}>{editingId ? "Update saved report" : "Save report"}</button>
        {editingId ? <button type="button" onClick={() => { setEditingId(""); setName(""); setDescription(""); }} style={pillOutline}>New</button> : null}
      </div>

      {message ? <div style={{ marginBottom: 12, fontWeight: 800, color: /fail|error|not |cannot/i.test(message) ? "#dc2626" : "#166534" }}>{message}</div> : null}

      {result ? (
        <div style={card}>
          <h3 style={h3}>Results — {result.rowCount} matter(s){result.capped ? " (capped)" : ""}{result.mode === "summary" ? " · summary" : ""}</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
              <thead><tr>{result.columns.map((c: any) => <th key={c.key} style={{ textAlign: c.type === "number" ? "right" : "left", borderBottom: `2px solid ${navy}`, padding: "6px 8px", color: navy, whiteSpace: "nowrap" }}>{c.label}</th>)}</tr></thead>
              <tbody>
                {result.rows.map((r: any, ri: number) => (
                  <tr key={ri}>{result.columns.map((c: any) => <td key={c.key} style={{ textAlign: c.type === "number" ? "right" : "left", borderBottom: "1px solid #eef2f7", padding: "5px 8px", color: navy }}>{fmtCell(r[c.key], c.type)}</td>)}</tr>
                ))}
              </tbody>
              {result.grandTotals ? (
                <tfoot><tr>{result.columns.map((c: any, i: number) => <td key={c.key} style={{ textAlign: c.type === "number" ? "right" : "left", borderTop: `2px solid ${navy}`, padding: "6px 8px", fontWeight: 950, color: navy }}>{result.grandTotals[c.key] !== undefined ? fmtCell(result.grandTotals[c.key], "number") : (i === 0 ? "Totals" : "")}</td>)}</tr></tfoot>
              ) : null}
            </table>
          </div>
        </div>
      ) : null}

      <div style={card}>
        <h3 style={h3}>Saved reports</h3>
        {saved.length === 0 ? <div style={{ color: "#385a83", fontSize: 13 }}>No saved reports yet. Build one above and Save.</div> : (
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
            <thead><tr>{["Name", "Owner", "Shared", "Actions"].map((h) => <th key={h} style={{ textAlign: "left", borderBottom: `2px solid ${navy}`, padding: "6px 8px", color: navy }}>{h}</th>)}</tr></thead>
            <tbody>
              {saved.map((r) => (
                <tr key={r.id}>
                  <td style={{ padding: "5px 8px", color: navy, fontWeight: 800 }}>{r.name}{r.description ? <div style={{ fontWeight: 400, fontSize: 11, color: "#385a83" }}>{r.description}</div> : null}</td>
                  <td style={{ padding: "5px 8px", color: "#385a83" }}>{r.ownedByMe ? "You" : (r.ownerUsername || "—")}</td>
                  <td style={{ padding: "5px 8px" }}>{r.isShared ? "Shared" : "Private"}</td>
                  <td style={{ padding: "5px 8px", display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => loadIntoBuilder(r)} style={pillOutline}>Load</button>
                    {isOwner ? <button type="button" onClick={() => toggleShare(r)} style={pillOutline}>{r.isShared ? "Unshare" : "Share"}</button> : null}
                    {(r.ownedByMe || isOwner) ? <button type="button" onClick={() => deleteSaved(r.id)} style={{ ...pillOutline, border: "1px solid #dc2626", color: "#dc2626", background: "#fff" }}>Delete</button> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
