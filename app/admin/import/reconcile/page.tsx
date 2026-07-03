"use client";

import React, { useCallback, useEffect, useState } from "react";
import BarshHeader from "@/app/components/BarshHeader";

// Reconcile held import rows. The dialog is driven by the hold type:
//   carrier_unmatched -> map to an existing carrier (alias) or add a new one  [Owner/admin-gated write]
//   patient_ambiguous -> link to an existing patient or create a new one
//   data_quality       -> accept the flagged value or dismiss the row
// Fixed rows become "Ready to Commit"; the operator commits any number to create matters in-place.

const NAVY = "#00346e";
const MUTED = "#385a83";

type Row = {
  id: string;
  batchId: string;
  rowIndex: number;
  holdReason: string | null;
  reviewStatus: string | null;
  reason: string | null;
  resolution: any;
  source: string | null;
  sourceFile: string | null;
  providerName: string | null;
  patientName: string;
  carrierRaw: string;
  claim: string;
  dosStart: string;
  dosEnd: string;
  amount: number | null;
};

const box: React.CSSProperties = { border: "1px solid #dbe4f0", borderRadius: 12, padding: 16, background: "#fff", marginBottom: 16 };
const btn = (bg: string, disabled = false): React.CSSProperties => ({
  height: 34, padding: "0 14px", border: `1px solid ${bg}`, borderRadius: 8,
  background: disabled ? "#e2e8f0" : bg, color: disabled ? "#94a3b8" : "#fff",
  fontWeight: 800, fontSize: 13, cursor: disabled ? "not-allowed" : "pointer",
});
const th: React.CSSProperties = { padding: 6, textAlign: "left", color: MUTED };
const money = (n: number | null) => (n == null ? "" : `$${n.toFixed(2)}`);
const dos = (a: string, b: string) => (a === b ? a : `${a} – ${b}`);

export default function ReconcilePage() {
  const [data, setData] = useState<any>(null);
  const [carriers, setCarriers] = useState<{ id: string; displayName: string }[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setBusy("load");
    setError("");
    try {
      const batchId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("batchId") || "" : "";
      const scope = batchId ? `&batchId=${encodeURIComponent(batchId)}` : "";
      const r = await fetch(`/api/import/reconcile?status=all&take=2000${scope}`, { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) setError(j.error || "Could not load reconcile queue.");
      else setData(j);
    } catch (e: any) {
      setError(e?.message || "Could not load reconcile queue.");
    } finally {
      setBusy("");
    }
  }, []);

  const loadCarriers = useCallback(async () => {
    try {
      const r = await fetch("/api/reference-data/options?type=insurer_company", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      const rows = j?.options || j?.rows || j?.entities || [];
      setCarriers(rows.map((o: any) => ({ id: o.id, displayName: o.displayName || o.label || o.id })));
    } catch {
      /* optional */
    }
  }, []);

  useEffect(() => {
    void load();
    void loadCarriers();
  }, [load, loadCarriers]);

  const rows: Row[] = data?.rows || [];
  const carrierGroups: { carrierRaw: string; count: number }[] = data?.carrierGroups || [];
  const patientRows = rows.filter((r) => r.holdReason === "patient_ambiguous" && r.reviewStatus === "open");
  const dataRows = rows.filter((r) => r.holdReason === "data_quality" && r.reviewStatus === "open");
  const readyRows = rows.filter((r) => r.reviewStatus === "ready");

  async function post(url: string, body: any, tag: string) {
    setBusy(tag);
    setError("");
    setMessage("");
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!j.ok) {
        setError(j.error || "Action failed.");
        return null;
      }
      return j;
    } catch (e: any) {
      setError(e?.message || "Action failed.");
      return null;
    } finally {
      setBusy("");
    }
  }

  async function commit(all: boolean) {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (!all && ids.length === 0) {
      setError("Select at least one ready row, or use Commit all ready.");
      return;
    }
    if (!window.confirm(all ? "Commit ALL ready rows into matters?" : `Commit ${ids.length} selected row(s) into matters?`)) return;
    const j = await post("/api/import/reconcile/commit", all ? { all: true } : { rowIds: ids }, "commit");
    if (j) {
      setSelected({});
      setMessage(`Created ${j.created} matter(s). Re-held: ${j.movedToPatient} patient, ${j.movedToData} data. Carrier still unmatched: ${j.skippedCarrier}.`);
      await load();
    }
  }

  return (
    <main style={{ padding: "12px 14px 40px", background: "#f8fafc", minHeight: "100vh", color: NAVY, fontFamily: "Inter, system-ui, sans-serif" }}>
      <BarshHeader center={<div style={{ fontSize: 28, fontWeight: 950, color: "#fff" }}>Reconcile Held Imports</div>} />

      <div style={{ width: "100%", maxWidth: "100%", margin: 0, boxSizing: "border-box" }}>
        <div style={{ marginBottom: 12 }}>
          <a href="/admin/import" style={{ color: MUTED, fontWeight: 800, textDecoration: "none" }}>← Back to Import Matters</a>
        </div>

        {error ? <div style={{ ...box, borderColor: "#fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 700 }}>{error}</div> : null}
        {message ? <div style={{ ...box, borderColor: "#bbf7d0", background: "#f0fdf4", color: "#166534", fontWeight: 700 }}>{message}</div> : null}

        <div style={box}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 900 }}>
              Queue — {rows.length} held ·{" "}
              <span style={{ color: "#b45309" }}>{data?.byReason?.carrier_unmatched || 0} carrier</span>,{" "}
              <span style={{ color: "#b45309" }}>{data?.byReason?.patient_ambiguous || 0} patient</span>,{" "}
              <span style={{ color: "#b45309" }}>{data?.byReason?.data_quality || 0} data</span> ·{" "}
              <span style={{ color: "#166534" }}>{readyRows.length} ready</span>
            </div>
            <button type="button" style={btn(MUTED, busy === "load")} disabled={busy === "load"} onClick={() => load()}>Refresh</button>
          </div>
        </div>

        {/* CARRIER holds — Owner-gated registry write */}
        <div style={box}>
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Carrier not in registry ({carrierGroups.reduce((a, c) => a + c.count, 0)} rows)</div>
          <div style={{ color: MUTED, fontSize: 13, marginBottom: 10 }}>Map each raw carrier to an existing carrier (adds an alias) or add it as a new carrier. This updates the registry (Owner-gated) and applies to all future imports.</div>
          {carrierGroups.length === 0 ? <div style={{ color: MUTED }}>No carrier holds.</div> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr><th style={th}>Raw carrier</th><th style={th}>Rows</th><th style={th}>Map to existing</th><th style={th}>or Add new</th></tr></thead>
              <tbody>
                {carrierGroups.map((g) => (
                  <CarrierRow key={g.carrierRaw} group={g} carriers={carriers} busy={busy}
                    onMap={async (entityId) => { const j = await post("/api/import/reconcile/resolve-carrier", { carrierRaw: g.carrierRaw, entityId }, "carrier:" + g.carrierRaw); if (j) { setMessage(`Mapped "${g.carrierRaw}" → ${j.entity.displayName}. ${j.readied} row(s) ready.`); await load(); } }}
                    onAddNew={async (name) => { const j = await post("/api/import/reconcile/resolve-carrier", { carrierRaw: g.carrierRaw, newDisplayName: name }, "carrier:" + g.carrierRaw); if (j) { setMessage(`Added carrier "${j.entity.displayName}". ${j.readied} row(s) ready.`); await loadCarriers(); await load(); } }}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* PATIENT holds */}
        <div style={box}>
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Patient match ambiguous ({patientRows.length} rows)</div>
          <div style={{ color: MUTED, fontSize: 13, marginBottom: 10 }}>Confirm whether the incoming patient is an existing person (link) or a new person (create).</div>
          {patientRows.length === 0 ? <div style={{ color: MUTED }}>No patient holds.</div> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr><th style={th}>Patient</th><th style={th}>Claim #</th><th style={th}>DOS</th><th style={th}>Charges</th><th style={th}>Decision</th></tr></thead>
              <tbody>
                {patientRows.map((r) => (
                  <PatientRow key={r.id} row={r} busy={busy}
                    onLink={async (patientId) => { const j = await post("/api/import/reconcile/resolve-patient", { rowId: r.id, decision: "link", patientId }, "patient:" + r.id); if (j) { setMessage("Linked patient. Row ready to commit."); await load(); } }}
                    onNew={async () => { const j = await post("/api/import/reconcile/resolve-patient", { rowId: r.id, decision: "new" }, "patient:" + r.id); if (j) { setMessage("Will create new patient. Row ready to commit."); await load(); } }}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* DATA QUALITY holds */}
        <div style={box}>
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Data quality ({dataRows.length} rows)</div>
          <div style={{ color: MUTED, fontSize: 13, marginBottom: 10 }}>Accept the flagged value (import anyway) or dismiss the row (don&apos;t import).</div>
          {dataRows.length === 0 ? <div style={{ color: MUTED }}>No data-quality holds.</div> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr><th style={th}>Patient</th><th style={th}>Claim #</th><th style={th}>Charges</th><th style={th}>Flag</th><th style={th}>Action</th></tr></thead>
              <tbody>
                {dataRows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid #eef2f7" }}>
                    <td style={{ padding: 6 }}>{r.patientName}</td>
                    <td>{r.claim}</td>
                    <td>{money(r.amount)}</td>
                    <td style={{ color: "#b45309" }}>{r.reason}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button type="button" style={{ ...btn("#16a34a", busy === "data:" + r.id), marginRight: 8 }} disabled={busy === "data:" + r.id} onClick={async () => { const j = await post("/api/import/reconcile/resolve-data", { rowId: r.id, action: "accept" }, "data:" + r.id); if (j) { setMessage("Accepted. Row ready to commit."); await load(); } }}>Accept</button>
                      <button type="button" style={btn("#dc2626", busy === "data:" + r.id)} disabled={busy === "data:" + r.id} onClick={async () => { const j = await post("/api/import/reconcile/resolve-data", { rowId: r.id, action: "dismiss" }, "data:" + r.id); if (j) { setMessage("Dismissed."); await load(); } }}>Dismiss</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* READY TO COMMIT */}
        <div style={{ ...box, borderColor: "#bbf7d0", background: "#f0fdf4" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 900, color: "#166534" }}>Ready to Commit ({readyRows.length})</div>
            <div>
              <button type="button" style={{ ...btn("#16a34a", busy === "commit" || readyRows.length === 0), marginRight: 8 }} disabled={busy === "commit" || readyRows.length === 0} onClick={() => commit(false)}>Commit selected</button>
              <button type="button" style={btn(NAVY, busy === "commit" || readyRows.length === 0)} disabled={busy === "commit" || readyRows.length === 0} onClick={() => commit(true)}>Commit all ready</button>
            </div>
          </div>
          {readyRows.length === 0 ? <div style={{ color: MUTED }}>Nothing fixed yet — resolve holds above to move rows here.</div> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr>
                <th style={th}><input type="checkbox" checked={readyRows.every((r) => selected[r.id])} onChange={(e) => { const on = e.target.checked; const next: Record<string, boolean> = { ...selected }; readyRows.forEach((r) => (next[r.id] = on)); setSelected(next); }} /></th>
                <th style={th}>Patient</th><th style={th}>Claim #</th><th style={th}>Carrier</th><th style={th}>DOS</th><th style={th}>Charges</th><th style={th}>Was</th>
              </tr></thead>
              <tbody>
                {readyRows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid #eef2f7" }}>
                    <td style={{ padding: 6 }}><input type="checkbox" checked={!!selected[r.id]} onChange={(e) => setSelected((s) => ({ ...s, [r.id]: e.target.checked }))} /></td>
                    <td>{r.patientName}</td>
                    <td>{r.claim}</td>
                    <td>{r.carrierRaw}</td>
                    <td>{dos(r.dosStart, r.dosEnd)}</td>
                    <td>{money(r.amount)}</td>
                    <td style={{ color: MUTED }}>{r.holdReason}</td>
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

function CarrierRow({ group, carriers, busy, onMap, onAddNew }: {
  group: { carrierRaw: string; count: number };
  carriers: { id: string; displayName: string }[];
  busy: string;
  onMap: (entityId: string) => void;
  onAddNew: (name: string) => void;
}) {
  const [entityId, setEntityId] = useState("");
  const [newName, setNewName] = useState(group.carrierRaw);
  const working = busy === "carrier:" + group.carrierRaw;
  return (
    <tr style={{ borderTop: "1px solid #eef2f7" }}>
      <td style={{ padding: 6, fontWeight: 600 }}>{group.carrierRaw}</td>
      <td>{group.count}</td>
      <td>
        <select value={entityId} onChange={(e) => setEntityId(e.target.value)} style={{ height: 32, minWidth: 240, borderRadius: 6, border: "1px solid #cbd5e1", padding: "0 8px", marginRight: 6 }}>
          <option value="">Select carrier…</option>
          {carriers.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
        </select>
        <button type="button" style={btn(NAVY, working || !entityId)} disabled={working || !entityId} onClick={() => onMap(entityId)}>Map</button>
      </td>
      <td>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} style={{ height: 32, minWidth: 200, borderRadius: 6, border: "1px solid #cbd5e1", padding: "0 8px", marginRight: 6 }} />
        <button type="button" style={btn("#16a34a", working || !newName.trim())} disabled={working || !newName.trim()} onClick={() => onAddNew(newName.trim())}>Add new</button>
      </td>
    </tr>
  );
}

function PatientRow({ row, busy, onLink, onNew }: {
  row: Row;
  busy: string;
  onLink: (patientId: string) => void;
  onNew: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<{ id: string; name: string; kind?: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const working = busy === "patient:" + row.id;

  async function expand() {
    setOpen((o) => !o);
    if (!loaded) {
      try {
        const r = await fetch(`/api/import/reconcile/patient-candidates?rowId=${row.id}`, { cache: "no-store" });
        const j = await r.json();
        setCandidates(j?.candidates || []);
      } catch {
        setCandidates([]);
      } finally {
        setLoaded(true);
      }
    }
  }

  return (
    <>
      <tr style={{ borderTop: "1px solid #eef2f7" }}>
        <td style={{ padding: 6, fontWeight: 600 }}>{row.patientName}</td>
        <td>{row.claim}</td>
        <td>{dos(row.dosStart, row.dosEnd)}</td>
        <td>{money(row.amount)}</td>
        <td><button type="button" style={btn(NAVY, working)} disabled={working} onClick={expand}>{open ? "Hide" : "Resolve"}</button></td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={5} style={{ padding: "6px 6px 14px", background: "#f8fafc" }}>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 6 }}>Is “{row.patientName}” one of these existing patients, or a new person?</div>
            {candidates.length === 0 ? <div style={{ color: MUTED, fontSize: 13, marginBottom: 8 }}>No close existing patients found.</div> : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {candidates.map((c) => (
                  <button key={c.id} type="button" style={{ ...btn("#0369a1", working), height: 30 }} disabled={working} onClick={() => onLink(c.id)}>Link → {c.name}</button>
                ))}
              </div>
            )}
            <button type="button" style={btn("#16a34a", working)} disabled={working} onClick={onNew}>Create new patient</button>
          </td>
        </tr>
      ) : null}
    </>
  );
}
