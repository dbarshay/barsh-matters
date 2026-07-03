"use client";

import React, { useCallback, useEffect, useState } from "react";
import BarshHeader from "@/app/components/BarshHeader";

// Manual (Intake Path #3) matter-creation form. All 12 fields required except the Claim#/Policy#
// alternation. Controlled dropdowns are populated from the registries (operators select existing).
// Patient is free-text with suggest-and-confirm. A dedup match warns and requires an explicit override.

const NAVY = "#00346e";
const MUTED = "#385a83";

type Opt = { id: string; displayName: string };

const box: React.CSSProperties = { border: "1px solid #dbe4f0", borderRadius: 12, padding: 16, background: "#fff", marginBottom: 16 };
const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 800, color: MUTED, marginBottom: 4 };
const input: React.CSSProperties = { height: 38, width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 10px", boxSizing: "border-box" };
const btn = (bg: string, disabled = false): React.CSSProperties => ({
  height: 40, padding: "0 18px", border: `1px solid ${bg}`, borderRadius: 10,
  background: disabled ? "#e2e8f0" : bg, color: disabled ? "#94a3b8" : "#fff", fontWeight: 900, cursor: disabled ? "not-allowed" : "pointer",
});
const field = (children: React.ReactNode) => <div style={{ marginBottom: 12 }}>{children}</div>;

export default function ManualMatterPage() {
  const [providers, setProviders] = useState<Opt[]>([]);
  const [insurers, setInsurers] = useState<Opt[]>([]);
  const [denials, setDenials] = useState<Opt[]>([]);
  const [services, setServices] = useState<Opt[]>([]);
  const [physicians, setPhysicians] = useState<Opt[]>([]);

  const [form, setForm] = useState({
    claimNumber: "", policyNumber: "", patientName: "", providerEntityId: "", insurerEntityId: "",
    denialReasonId: "", serviceTypeId: "", caseType: "No-Fault", dateOfInjury: "", dosStart: "", dosEnd: "",
    grossClaimAmount: "", treatingPhysicianId: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const [patientId, setPatientId] = useState("");
  const [candidates, setCandidates] = useState<{ id: string; name: string }[]>([]);
  const [duplicate, setDuplicate] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<any>(null);

  const loadOpts = useCallback(async (type: string, setter: (o: Opt[]) => void) => {
    try {
      const r = await fetch(`/api/reference-data/options?type=${type}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      const rows = j?.options || j?.rows || j?.entities || [];
      setter(rows.map((o: any) => ({ id: o.id, displayName: o.displayName || o.label || o.id })));
    } catch { /* optional */ }
  }, []);

  useEffect(() => {
    void loadOpts("provider_client", setProviders);
    void loadOpts("insurer_company", setInsurers);
    void loadOpts("denial_reason", setDenials);
    void loadOpts("service_type", setServices);
    void loadOpts("treating_provider", setPhysicians);
  }, [loadOpts]);

  async function submit(opts?: { override?: boolean; createNewPatient?: boolean; usePatientId?: string }) {
    setBusy(true);
    setError("");
    setCandidates([]);
    setDuplicate(null);
    try {
      const body: Record<string, unknown> = { ...form };
      const pid = opts?.usePatientId ?? patientId;
      if (pid) body.patientId = pid;
      if (opts?.createNewPatient) body.createNewPatient = true;
      if (opts?.override) body.override = true;
      const r = await fetch("/api/import/manual/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (j.ok) { setDone(j); return; }
      if (j.needPatientChoice) { setCandidates(j.candidates || []); setError(j.error); return; }
      if (j.duplicate) { setDuplicate(j.duplicate); setError(j.error); return; }
      setError(j.error || "Create failed.");
    } catch (e: any) {
      setError(e?.message || "Create failed.");
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setForm({ claimNumber: "", policyNumber: "", patientName: "", providerEntityId: "", insurerEntityId: "", denialReasonId: "", serviceTypeId: "", caseType: "No-Fault", dateOfInjury: "", dosStart: "", dosEnd: "", grossClaimAmount: "", treatingPhysicianId: "" });
    setPatientId(""); setCandidates([]); setDuplicate(null); setError(""); setDone(null);
  }

  const sel = (v: string, on: (x: string) => void, opts: Opt[], placeholder: string) => (
    <select value={v} onChange={(e) => on(e.target.value)} style={input}>
      <option value="">{placeholder}</option>
      {opts.map((o) => <option key={o.id} value={o.id}>{o.displayName}</option>)}
    </select>
  );

  return (
    <main style={{ padding: "12px 14px 40px", background: "#f8fafc", minHeight: "100vh", color: NAVY, fontFamily: "Inter, system-ui, sans-serif" }}>
      <BarshHeader center={<div style={{ fontSize: 28, fontWeight: 950, color: "#fff" }}>Create Matter — Manual</div>} />
      <div style={{ width: "100%", maxWidth: "100%", margin: 0, boxSizing: "border-box" }}>
        <div style={{ marginBottom: 12 }}>
          <a href="/admin/import/other" style={{ color: MUTED, fontWeight: 800, textDecoration: "none" }}>← Back to Other Sources</a>
        </div>

        {done ? (
          <div style={{ ...box, borderColor: "#bbf7d0", background: "#f0fdf4" }}>
            <div style={{ fontWeight: 900, color: "#166534" }}>Created matter {done.displayNumber || done.matterId} — Open · Pre-Lit intake.</div>
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <a href={`/matter/${done.matterId}`} style={{ ...btn(NAVY), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Open matter</a>
              <button type="button" style={btn("#16a34a")} onClick={resetForm}>Create another</button>
            </div>
          </div>
        ) : (
          <>
            {error ? <div style={{ ...box, borderColor: "#fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 700 }}>{error}</div> : null}

            {candidates.length ? (
              <div style={{ ...box, borderColor: "#fde68a", background: "#fffbeb" }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Possible existing patients — link one or create new:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {candidates.map((c) => (
                    <button key={c.id} type="button" style={{ ...btn("#0369a1"), height: 34 }} onClick={() => { setPatientId(c.id); void submit({ usePatientId: c.id }); }}>Link → {c.name}</button>
                  ))}
                  <button type="button" style={{ ...btn("#16a34a"), height: 34 }} onClick={() => void submit({ createNewPatient: true })}>Create new patient</button>
                </div>
              </div>
            ) : null}

            {duplicate ? (
              <div style={{ ...box, borderColor: "#fecaca", background: "#fef2f2" }}>
                <div style={{ fontWeight: 900, color: "#991b1b", marginBottom: 8 }}>Likely duplicate of matter {duplicate.displayNumber || duplicate.matterId} ({duplicate.patientName}).</div>
                <button type="button" style={btn("#dc2626", busy)} disabled={busy} onClick={() => void submit({ override: true })}>Create anyway (override)</button>
              </div>
            ) : null}

            <div style={box}>
              <div style={{ fontWeight: 900, marginBottom: 12 }}>Matter details — all fields required (Claim # or Policy # — at least one)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {field(<><span style={label}>Claim Number</span><input style={input} value={form.claimNumber} onChange={(e) => set("claimNumber", e.target.value)} /></>)}
                {field(<><span style={label}>Policy Number</span><input style={input} value={form.policyNumber} onChange={(e) => set("policyNumber", e.target.value)} /></>)}
                {field(<><span style={label}>Patient (First Last)</span><input style={input} value={form.patientName} onChange={(e) => { set("patientName", e.target.value); setPatientId(""); }} /></>)}
                {field(<><span style={label}>Treating Physician</span>{sel(form.treatingPhysicianId, (v) => set("treatingPhysicianId", v), physicians, "Select treating physician…")}</>)}
                {field(<><span style={label}>Provider / Client</span>{sel(form.providerEntityId, (v) => set("providerEntityId", v), providers, "Select provider…")}</>)}
                {field(<><span style={label}>Insurer / Carrier</span>{sel(form.insurerEntityId, (v) => set("insurerEntityId", v), insurers, "Select insurer…")}</>)}
                {field(<><span style={label}>Denial Reason</span>{sel(form.denialReasonId, (v) => set("denialReasonId", v), denials, "Select denial reason…")}</>)}
                {field(<><span style={label}>Service Type</span>{sel(form.serviceTypeId, (v) => set("serviceTypeId", v), services, "Select service type…")}</>)}
                {field(<><span style={label}>Case Type</span><select value={form.caseType} onChange={(e) => set("caseType", e.target.value)} style={input}><option>No-Fault</option><option>Workers Compensation</option><option>Lien</option></select></>)}
                {field(<><span style={label}>Gross Claim Amount</span><input style={input} value={form.grossClaimAmount} onChange={(e) => set("grossClaimAmount", e.target.value)} placeholder="0.00" /></>)}
                {field(<><span style={label}>Date of Injury</span><input type="date" style={input} value={form.dateOfInjury} onChange={(e) => set("dateOfInjury", e.target.value)} /></>)}
                {field(<><span style={label}>DOS start</span><input type="date" style={input} value={form.dosStart} onChange={(e) => set("dosStart", e.target.value)} /></>)}
                {field(<><span style={label}>DOS end (blank = same as start)</span><input type="date" style={input} value={form.dosEnd} onChange={(e) => set("dosEnd", e.target.value)} /></>)}
              </div>
              <div style={{ marginTop: 8 }}>
                <button type="button" style={btn("#16a34a", busy)} disabled={busy} onClick={() => void submit()}>{busy ? "Creating…" : "Create matter"}</button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
