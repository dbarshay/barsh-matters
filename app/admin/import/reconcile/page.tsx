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
  providerRaw: string;
  caseTypeRaw: string;
  providerTin: string;
  claim: string;
  cic: string;
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
  const [providers, setProviders] = useState<{ id: string; displayName: string }[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  // Read the launching module from the URL AFTER mount (SSR renders the default) to avoid a hydration
  // mismatch on the "Back to … import" link.
  const [backSource, setBackSource] = useState<"dow" | "carisk">("dow");

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

  const loadRegistry = useCallback(async (type: "insurer_company" | "provider_client") => {
    try {
      const r = await fetch(`/api/reference-data/options?type=${type}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      const rows = j?.options || j?.rows || j?.entities || [];
      const mapped = rows.map((o: any) => ({ id: o.id, displayName: o.displayName || o.label || o.id }));
      if (type === "insurer_company") setCarriers(mapped);
      else setProviders(mapped);
    } catch {
      /* optional */
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("source") === "carisk") {
      setBackSource("carisk");
    }
    void load();
    void loadRegistry("insurer_company");
    void loadRegistry("provider_client");
  }, [load, loadRegistry]);

  const backHref = `/admin/import?source=${backSource}`;

  const rows: Row[] = data?.rows || [];
  const carrierGroups: { carrierRaw: string; count: number }[] = data?.carrierGroups || [];
  const providerGroups: { providerRaw: string; count: number }[] = data?.providerGroups || [];
  const caseTypeGroups: { caseTypeRaw: string; count: number }[] = data?.caseTypeGroups || [];
  const missingRows = rows.filter((r) => r.holdReason === "missing_field" && r.reviewStatus === "open");
  const patientRows = rows.filter((r) => r.holdReason === "patient_ambiguous" && r.reviewStatus === "open");
  const caseTypeRowsByRaw = (raw: string) => rows.find((r) => r.holdReason === "case_type_unknown" && r.reviewStatus === "open" && r.caseTypeRaw === raw);
  const tinRows = rows.filter((r) => r.holdReason === "tin_mismatch" && r.reviewStatus === "open");
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
          <a href={backHref} style={{ color: MUTED, fontWeight: 800, textDecoration: "none" }}>← Back to {backSource === "carisk" ? "CARISK" : "DOW"} import</a>
        </div>

        {error ? <div style={{ ...box, borderColor: "#fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 700 }}>{error}</div> : null}
        {message ? <div style={{ ...box, borderColor: "#bbf7d0", background: "#f0fdf4", color: "#166534", fontWeight: 700 }}>{message}</div> : null}

        <div style={box}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 900 }}>
              Queue — {rows.length} held ·{" "}
              <span style={{ color: "#dc2626" }}>{data?.byReason?.missing_field || 0} missing-field</span>,{" "}
              <span style={{ color: "#dc2626" }}>{data?.byReason?.carrier_unmatched || 0} carrier</span>,{" "}
              <span style={{ color: "#dc2626" }}>{data?.byReason?.provider_unmatched || 0} provider</span>,{" "}
              <span style={{ color: "#dc2626" }}>{data?.byReason?.case_type_unknown || 0} case-type</span>,{" "}
              <span style={{ color: "#dc2626" }}>{data?.byReason?.patient_ambiguous || 0} patient</span>,{" "}
              <span style={{ color: "#dc2626" }}>{data?.byReason?.tin_mismatch || 0} TIN</span>,{" "}
              <span style={{ color: "#dc2626" }}>{data?.byReason?.data_quality || 0} data</span> ·{" "}
              <span style={{ color: "#166534" }}>{readyRows.length} ready</span>
            </div>
            <button type="button" style={btn(MUTED, busy === "load")} disabled={busy === "load"} onClick={() => load()}>Refresh</button>
          </div>
        </div>

        {/* Hold categories, ordered by severity (row count desc) via CSS order. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
        {/* MISSING FIELD holds — fill in the missing values */}
        <Section title="Missing required fields" count={missingRows.length}>
          <div style={{ color: MUTED, fontSize: 13, marginBottom: 10 }}>Fill in the missing values for each row. When all required fields are present the row becomes Ready to Commit.</div>
          {missingRows.length === 0 ? <div style={{ color: MUTED }}>No missing-field holds.</div> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr><th style={th}>Row</th><th style={th}>Patient</th><th style={th}>Claim #</th><th style={th}>What&apos;s missing</th><th style={th}></th></tr></thead>
              <tbody>
                {missingRows.map((r) => (
                  <MissingFieldRow key={r.id} row={r} busy={busy}
                    onSave={async (patch) => {
                      const j = await post("/api/import/reconcile/resolve-missing", { rowId: r.id, patch }, "missing:" + r.id);
                      if (j) { setMessage(j.ready ? "Row completed — ready to commit." : `Still missing: ${(j.stillMissing || []).map((m: any) => m.label).join(", ")}.`); await load(); }
                    }}
                  />
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* CARRIER holds — Owner-gated registry write */}
        <Section title="Carrier not in registry" count={carrierGroups.reduce((a, c) => a + c.count, 0)}>
          <div style={{ color: MUTED, fontSize: 13, marginBottom: 10 }}>For each raw carrier: <strong>Assign Alias</strong> — save this raw name as an alias of an approved insurer — or <strong>Add new</strong> insurer. This updates the registry (Owner-gated) and applies to all future imports.</div>
          {carrierGroups.length === 0 ? <div style={{ color: MUTED }}>No carrier holds.</div> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr><th style={th}>Raw carrier</th><th style={th}>Rows</th><th style={th}>Assign Alias (to approved insurer)</th><th style={th}>or Add new insurer</th></tr></thead>
              <tbody>
                {carrierGroups.map((g) => (
                  <CarrierRow key={g.carrierRaw} group={g} carriers={carriers} busy={busy}
                    onMap={async (entityId) => { const j = await post("/api/import/reconcile/resolve-carrier", { carrierRaw: g.carrierRaw, entityId }, "carrier:" + g.carrierRaw); if (j) { setMessage(`Mapped "${g.carrierRaw}" → ${j.entity.displayName}. ${j.readied} row(s) ready.`); await load(); } }}
                    onAddNew={async (name) => { const j = await post("/api/import/reconcile/resolve-carrier", { carrierRaw: g.carrierRaw, newDisplayName: name }, "carrier:" + g.carrierRaw); if (j) { setMessage(`Added carrier "${j.entity.displayName}". ${j.readied} row(s) ready.`); await loadRegistry("insurer_company"); await load(); } }}
                  />
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* PROVIDER holds — Owner-gated registry write (Carisk resolves provider from the sheet) */}
        <Section title="Provider not in registry" count={providerGroups.reduce((a, c) => a + c.count, 0)}>
          <div style={{ color: MUTED, fontSize: 13, marginBottom: 10 }}>For each raw provider: <strong>Assign Alias</strong> to an approved provider, or <strong>Add new</strong> provider. Owner-gated; applies to all future imports.</div>
          {providerGroups.length === 0 ? <div style={{ color: MUTED }}>No provider holds.</div> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr><th style={th}>Raw provider</th><th style={th}>Rows</th><th style={th}>Assign Alias (to approved provider)</th><th style={th}>or Add new provider</th></tr></thead>
              <tbody>
                {providerGroups.map((g) => (
                  <CarrierRow key={g.providerRaw} group={{ carrierRaw: g.providerRaw, count: g.count }} carriers={providers} busy={busy} noun="provider"
                    onMap={async (entityId) => { const j = await post("/api/import/reconcile/resolve-provider", { providerRaw: g.providerRaw, entityId }, "carrier:" + g.providerRaw); if (j) { setMessage(`Aliased "${g.providerRaw}" → ${j.entity.displayName}. ${j.readied} row(s) ready.`); await load(); } }}
                    onAddNew={async (name) => { const j = await post("/api/import/reconcile/resolve-provider", { providerRaw: g.providerRaw, newDisplayName: name }, "carrier:" + g.providerRaw); if (j) { setMessage(`Added provider "${j.entity.displayName}". ${j.readied} row(s) ready.`); await loadRegistry("provider_client"); await load(); } }}
                  />
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* CASE-TYPE holds — map unknown ClaimType */}
        <Section title="Unknown case type / ClaimType" count={caseTypeGroups.reduce((a, c) => a + c.count, 0)}>
          <div style={{ color: MUTED, fontSize: 13, marginBottom: 10 }}>Map each unrecognized ClaimType to a case type. Applies to all rows with that ClaimType.</div>
          {caseTypeGroups.length === 0 ? <div style={{ color: MUTED }}>No case-type holds.</div> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr><th style={th}>Raw ClaimType</th><th style={th}>Rows</th><th style={th}>Set case type</th></tr></thead>
              <tbody>
                {caseTypeGroups.map((g) => {
                  const row = caseTypeRowsByRaw(g.caseTypeRaw);
                  return (
                    <CaseTypeRow key={g.caseTypeRaw} group={g} busy={busy}
                      onSet={async (caseType) => {
                        if (!row) return;
                        const j = await post("/api/import/reconcile/resolve-casetype", { rowId: row.id, caseType }, "casetype:" + g.caseTypeRaw);
                        if (j) { setMessage(`Mapped ClaimType "${g.caseTypeRaw}" → ${caseType}. ${j.appliedTo} row(s) ready.`); await load(); }
                      }}
                    />
                  );
                })}
              </tbody>
            </table>
          )}
        </Section>

        {/* TIN mismatch holds */}
        <Section title="Provider TIN mismatch" count={tinRows.length}>
          <div style={{ color: MUTED, fontSize: 13, marginBottom: 10 }}>The row&apos;s TIN differs from the provider&apos;s registry TIN. Accept the row&apos;s TIN (import) or dismiss the row.</div>
          {tinRows.length === 0 ? <div style={{ color: MUTED }}>No TIN-mismatch holds.</div> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr><th style={th}>Patient</th><th style={th}>Provider</th><th style={th}>Row TIN</th><th style={th}>Detail</th><th style={th}>Action</th></tr></thead>
              <tbody>
                {tinRows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid #eef2f7" }}>
                    <td style={{ padding: 6 }}>{r.patientName}</td>
                    <td>{r.providerRaw}</td>
                    <td>{r.providerTin}</td>
                    <td style={{ color: "#dc2626" }}>{r.reason}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button type="button" style={{ ...btn("#16a34a", busy === "tin:" + r.id), marginRight: 8 }} disabled={busy === "tin:" + r.id} onClick={async () => { const j = await post("/api/import/reconcile/resolve-tin", { rowId: r.id, action: "accept" }, "tin:" + r.id); if (j) { setMessage("TIN accepted. Row ready."); await load(); } }}>Accept</button>
                      <button type="button" style={btn("#dc2626", busy === "tin:" + r.id)} disabled={busy === "tin:" + r.id} onClick={async () => { const j = await post("/api/import/reconcile/resolve-tin", { rowId: r.id, action: "dismiss" }, "tin:" + r.id); if (j) { setMessage("Row dismissed."); await load(); } }}>Dismiss</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* PATIENT holds */}
        <Section title="Patient match ambiguous" count={patientRows.length}>
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
        </Section>

        {/* DATA QUALITY holds */}
        <Section title="Data quality" count={dataRows.length}>
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
                    <td style={{ color: "#dc2626" }}>{r.reason}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button type="button" style={{ ...btn("#16a34a", busy === "data:" + r.id), marginRight: 8 }} disabled={busy === "data:" + r.id} onClick={async () => { const j = await post("/api/import/reconcile/resolve-data", { rowId: r.id, action: "accept" }, "data:" + r.id); if (j) { setMessage("Accepted. Row ready to commit."); await load(); } }}>Accept</button>
                      <button type="button" style={btn("#dc2626", busy === "data:" + r.id)} disabled={busy === "data:" + r.id} onClick={async () => { const j = await post("/api/import/reconcile/resolve-data", { rowId: r.id, action: "dismiss" }, "data:" + r.id); if (j) { setMessage("Dismissed."); await load(); } }}>Dismiss</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
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

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  // Severity order: more rows -> smaller `order` -> rendered first. Empty categories sink to the bottom.
  return (
    <div style={{ ...box, order: -count, marginBottom: 0 }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{ cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 8 }}
      >
        <span style={{ color: MUTED, fontWeight: 900, width: 14 }}>{open ? "▾" : "▸"}</span>
        <span style={{ fontWeight: 900 }}>{title}</span>
        <span style={{ fontWeight: 800, color: count > 0 ? "#dc2626" : MUTED }}>({count} {count === 1 ? "row" : "rows"})</span>
      </div>
      {open ? <div style={{ marginTop: 12 }}>{children}</div> : null}
    </div>
  );
}

function CarrierRow({ group, carriers, busy, noun = "insurer", onMap, onAddNew }: {
  group: { carrierRaw: string; count: number };
  carriers: { id: string; displayName: string }[];
  busy: string;
  noun?: string;
  onMap: (entityId: string) => void;
  onAddNew: (name: string) => void;
}) {
  const [entityId, setEntityId] = useState("");
  const [newName, setNewName] = useState(group.carrierRaw);
  const working = busy === "carrier:" + group.carrierRaw;
  const selectedName = carriers.find((c) => c.id === entityId)?.displayName || "";
  function assignAlias() {
    if (!entityId) return;
    if (window.confirm(`Save "${group.carrierRaw}" as an alias of approved ${noun} "${selectedName}"?\n\nThis applies to all ${group.count} held row(s) and every future import.`)) {
      onMap(entityId);
    }
  }
  return (
    <tr style={{ borderTop: "1px solid #eef2f7" }}>
      <td style={{ padding: 6, fontWeight: 600 }}>{group.carrierRaw}</td>
      <td>{group.count}</td>
      <td>
        <select value={entityId} onChange={(e) => setEntityId(e.target.value)} style={{ height: 32, minWidth: 240, borderRadius: 6, border: "1px solid #cbd5e1", padding: "0 8px", marginRight: 6 }}>
          <option value="">Select approved {noun}…</option>
          {carriers.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
        </select>
        <button type="button" style={btn(NAVY, working || !entityId)} disabled={working || !entityId} onClick={assignAlias}>Assign Alias</button>
      </td>
      <td>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} style={{ height: 32, minWidth: 200, borderRadius: 6, border: "1px solid #cbd5e1", padding: "0 8px", marginRight: 6 }} />
        <button type="button" style={btn("#16a34a", working || !newName.trim())} disabled={working || !newName.trim()} onClick={() => onAddNew(newName.trim())}>Add new</button>
      </td>
    </tr>
  );
}

function MissingFieldRow({ row, busy, onSave }: {
  row: Row;
  busy: string;
  onSave: (patch: Record<string, string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({
    cic_number: row.cic || "",
    claim_number_raw: row.claim || "",
    patient_name: row.patientName || "",
    carrier_raw: row.carrierRaw || "",
    provider_raw: row.providerRaw || "",
    claim_amount: row.amount == null ? "" : String(row.amount),
    dos_start: row.dosStart || "",
    dos_end: row.dosEnd || "",
  });
  const working = busy === "missing:" + row.id;
  const isCarisk = row.source === "carisk";
  const fields: { key: string; label: string; carisk?: boolean }[] = [
    { key: "cic_number", label: "CIC #", carisk: true },
    { key: "claim_number_raw", label: "Claim # (insuredsID)" },
    { key: "patient_name", label: "Patient name" },
    { key: "carrier_raw", label: "Carrier" },
    { key: "provider_raw", label: "Provider (FacilityName)", carisk: true },
    { key: "claim_amount", label: "Charges" },
    { key: "dos_start", label: "DOS start" },
    { key: "dos_end", label: "DOS end" },
  ];
  const set = (k: string, v: string) => setVals((s) => ({ ...s, [k]: v }));
  return (
    <>
      <tr style={{ borderTop: "1px solid #eef2f7" }}>
        <td style={{ padding: 6 }}>{row.rowIndex + 1}</td>
        <td>{row.patientName || <span style={{ color: "#dc2626" }}>(blank)</span>}</td>
        <td>{row.claim || <span style={{ color: "#dc2626" }}>(blank)</span>}</td>
        <td style={{ color: "#dc2626" }}>{row.reason}</td>
        <td><button type="button" style={btn(NAVY, working)} disabled={working} onClick={() => setOpen((o) => !o)}>{open ? "Hide" : "Fix"}</button></td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={5} style={{ padding: "6px 6px 14px", background: "#f8fafc" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
              {fields.filter((f) => !f.carisk || isCarisk).map((f) => (
                <label key={f.key} style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>
                  <div style={{ marginBottom: 2 }}>{f.label}</div>
                  <input value={vals[f.key]} onChange={(e) => set(f.key, e.target.value)} style={{ height: 30, minWidth: 150, borderRadius: 6, border: "1px solid #cbd5e1", padding: "0 8px" }} />
                </label>
              ))}
            </div>
            <button type="button" style={btn("#16a34a", working)} disabled={working} onClick={() => onSave(vals)}>Save fields</button>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function CaseTypeRow({ group, busy, onSet }: {
  group: { caseTypeRaw: string; count: number };
  busy: string;
  onSet: (caseType: string) => void;
}) {
  const [choice, setChoice] = useState("Workers Compensation");
  const working = busy === "casetype:" + group.caseTypeRaw;
  return (
    <tr style={{ borderTop: "1px solid #eef2f7" }}>
      <td style={{ padding: 6, fontWeight: 600 }}>{group.caseTypeRaw || "(blank)"}</td>
      <td>{group.count}</td>
      <td>
        <select value={choice} onChange={(e) => setChoice(e.target.value)} style={{ height: 32, minWidth: 220, borderRadius: 6, border: "1px solid #cbd5e1", padding: "0 8px", marginRight: 6 }}>
          <option>Workers Compensation</option>
          <option>No-Fault</option>
        </select>
        <button type="button" style={btn(NAVY, working)} disabled={working} onClick={() => onSet(choice)}>Set case type</button>
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
  const [candidates, setCandidates] = useState<{ id: string; name: string; kind?: string; dol?: string }[]>([]);
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
                  <button key={c.id} type="button" style={{ ...btn("#0369a1", working), height: 30 }} disabled={working} onClick={() => onLink(c.id)}>Link → {c.name} · D/L: {c.dol || "—"}</button>
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
