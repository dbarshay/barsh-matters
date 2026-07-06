"use client";

import { bmConfirm, bmAlert } from "@/app/components/BmDialogHost";
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
  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setMissing((m) => {
      if (!m.size) return m;
      const n = new Set(m);
      n.delete(k);
      if (k === "claimNumber" || k === "policyNumber") { n.delete("claimNumber"); n.delete("policyNumber"); }
      return n;
    });
  };

  // Required-field check (matches the server): all required except the Claim#/Policy# alternation.
  function findMissing(): Set<string> {
    const m = new Set<string>();
    if (!form.claimNumber.trim() && !form.policyNumber.trim()) { m.add("claimNumber"); m.add("policyNumber"); }
    if (!form.patientName.trim()) m.add("patientName");
    if (!form.providerEntityId) m.add("providerEntityId");
    if (!form.insurerEntityId) m.add("insurerEntityId");
    if (!form.denialReasonId) m.add("denialReasonId");
    if (!form.serviceTypeId) m.add("serviceTypeId");
    if (!form.treatingPhysicianId) m.add("treatingPhysicianId");
    if (!form.caseType) m.add("caseType");
    if (!form.dateOfInjury) m.add("dateOfInjury");
    if (!form.dosStart) m.add("dosStart");
    if (!form.grossClaimAmount.trim()) m.add("grossClaimAmount");
    return m;
  }

  const [patientId, setPatientId] = useState("");
  const [carried, setCarried] = useState<Record<string, string>>({}); // carried-over values of the highlighted fields
  const [missing, setMissing] = useState<Set<string>>(new Set()); // required fields flagged red on submit
  const [candidates, setCandidates] = useState<{ id: string; name: string }[]>([]);
  const [patientSuggestions, setPatientSuggestions] = useState<{ id: string; name: string; dol?: string }[]>([]);
  const [duplicate, setDuplicate] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [done, setDone] = useState<any>(null);

  // Debounced patient search while typing (only when not already linked to an existing patient).
  useEffect(() => {
    const name = form.patientName.trim();
    if (patientId || name.length < 2) { setPatientSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/import/reconcile/patient-candidates?q=${encodeURIComponent(name)}`, { cache: "no-store" });
        const j = await r.json();
        setPatientSuggestions(j?.candidates || []);
      } catch { setPatientSuggestions([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [form.patientName, patientId]);

  async function linkPatient(c: { id: string; name: string }) {
    setPatientId(c.id);
    setPatientSuggestions([]);
    setInfo("");
    try {
      const r = await fetch(`/api/import/manual/patient-defaults?patientId=${c.id}`, { cache: "no-store" });
      const j = await r.json();
      if (j?.ok && j.found) {
        const d = j.defaults || {};
        setForm((f) => ({ ...f, ...d, patientName: c.name, dosStart: "", dosEnd: "", grossClaimAmount: "" }));
        setCarried({ treatingPhysicianId: d.treatingPhysicianId || "", providerEntityId: d.providerEntityId || "", serviceTypeId: d.serviceTypeId || "", denialReasonId: d.denialReasonId || "", caseType: d.caseType || "" });
        setInfo(`Linked ${c.name} — pre-filled from matter ${j.fromMatter}. Locked fields are read-only; highlighted fields carried over but are editable (they turn blue if you change them); enter this bill's date(s) of service and amount.`);
      } else {
        setForm((f) => ({ ...f, patientName: c.name }));
        setInfo(`Linked ${c.name} (no prior matter to pre-fill from).`);
      }
    } catch {
      setForm((f) => ({ ...f, patientName: c.name }));
    }
  }

  async function cleanupOrphans() {
    if (!await bmConfirm("Delete all patient records that have no matters?\n\nThis removes leftover patients (e.g. from undone test imports). Patients linked to a matter are untouched.")) return;
    try {
      const r = await fetch("/api/admin/patients/cleanup-orphans", { method: "POST" });
      const j = await r.json();
      if (j.ok) { void bmAlert(`Removed ${j.removed} orphaned patient(s).`); setPatientSuggestions([]); }
      else setError(j.error || "Cleanup failed.");
    } catch { setError("Cleanup failed."); }
  }

  function addAnotherForPatient() {
    const pid = done?.patientId || patientId;
    // Keep carry-over fields (locked identity + pre-filled editable); clear only what MUST be re-entered.
    setForm((f) => ({ ...f, dosStart: "", dosEnd: "", grossClaimAmount: "" }));
    setCarried({ treatingPhysicianId: form.treatingPhysicianId, providerEntityId: form.providerEntityId, serviceTypeId: form.serviceTypeId, denialReasonId: form.denialReasonId, caseType: form.caseType });
    setPatientId(pid || "");
    setDone(null);
    setError(""); setDuplicate(null); setCandidates([]);
    setInfo("Same patient & claim carried over. Enter this bill's date(s) of service and amount; adjust the highlighted fields if they changed.");
  }

  function unlinkPatient() {
    setPatientId("");
    setCarried({});
    setInfo("");
    setForm((f) => ({ ...f, patientName: "" }));
  }

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
    const miss = findMissing();
    if (miss.size) { setMissing(miss); setError("Complete the fields outlined in red."); return; }
    setMissing(new Set());
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
    setPatientId(""); setCarried({}); setCandidates([]); setPatientSuggestions([]); setDuplicate(null); setError(""); setInfo(""); setDone(null);
  }

  const locked = !!patientId; // linked to / carried over from an existing patient
  const roBox: React.CSSProperties = { ...input, display: "flex", alignItems: "center", background: "#eef2f7", color: NAVY, fontWeight: 700, cursor: "not-allowed" };
  const hl: React.CSSProperties = { ...input, background: "#fffbeb", border: "1px solid #fcd34d" }; // pre-filled, unchanged
  const changedStyle: React.CSSProperties = { ...input, background: "#eef2f7", border: "1px solid #93c5fd" }; // pre-filled, edited
  // Highlighted-field style: yellow while it matches the carried-over value, blue once the operator edits it.
  const hlFor = (key: string): React.CSSProperties => {
    if (!locked) return input;
    return String((form as any)[key] || "") !== String(carried[key] || "") ? changedStyle : hl;
  };
  // Overlay a red outline on a required field flagged empty at submit. Use the full `border` shorthand
  // (not borderColor) so it reliably replaces the base border regardless of the underlying style.
  const req = (key: string, style: React.CSSProperties): React.CSSProperties => (missing.has(key) ? { ...style, border: "2px solid #dc2626", background: "#fef2f2" } : style);
  const nameOf = (id: string, opts: Opt[]) => opts.find((o) => o.id === id)?.displayName || "—";
  const mdy = (iso: string) => { const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[2]}/${m[3]}/${m[1]}` : iso; };

  const sel = (v: string, on: (x: string) => void, opts: Opt[], placeholder: string, style: React.CSSProperties = input) => (
    <select value={v} onChange={(e) => on(e.target.value)} style={style}>
      <option value="">{placeholder}</option>
      {opts.map((o) => <option key={o.id} value={o.id}>{o.displayName}</option>)}
    </select>
  );
  const roField = (l: string, v: string) => field(<><span style={label}>{l} <span style={{ color: MUTED }}>· locked</span></span><div style={roBox}>{v || "—"}</div></>);

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
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a href={`/matter/${done.matterId}`} style={{ ...btn(NAVY), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Open matter</a>
              <button type="button" style={btn("#16a34a")} onClick={addAnotherForPatient}>Add another for this patient</button>
              <button type="button" style={btn(MUTED)} onClick={resetForm}>Create a different matter</button>
            </div>
          </div>
        ) : (
          <>
            {error ? <div style={{ ...box, borderColor: "#fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 700 }}>{error}</div> : null}
            {info ? <div style={{ ...box, borderColor: "#bfdbfe", background: "#eff6ff", color: "#1e40af", fontWeight: 700 }}>{info}</div> : null}

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
              {locked ? (
                <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>
                  <span style={{ background: "#eef2f7", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>Locked</span> = read-only ·{" "}
                  <span style={{ background: "#fffbeb", border: "1px solid #fcd34d", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>Carried over</span> = editable ·{" "}
                  <span style={{ background: "#eef2f7", border: "1px solid #93c5fd", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>Edited</span> = you changed it ·{" "}
                  <button type="button" onClick={unlinkPatient} style={{ border: "none", background: "transparent", color: "#dc2626", fontWeight: 800, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Unlink patient</button>
                </div>
              ) : null}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {/* Patient — typeahead when new, locked display when linked */}
                {locked
                  ? field(<><span style={label}>Patient (First Last) <span style={{ color: "#166534" }}>· linked</span></span><div style={roBox}>{form.patientName || "—"}</div></>)
                  : field(
                      <>
                        <span style={label}>Patient (First Last)</span>
                        <div style={{ position: "relative" }}>
                          <input style={req("patientName", input)} value={form.patientName} onChange={(e) => { set("patientName", e.target.value); setPatientId(""); setInfo(""); }} placeholder="Type to search existing patients…" />
                          {patientSuggestions.length ? (
                            <div style={{ position: "absolute", zIndex: 5, top: 40, left: 0, right: 0, background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, boxShadow: "0 8px 20px rgba(15,23,42,0.12)", maxHeight: 200, overflowY: "auto" }}>
                              {patientSuggestions.map((c) => (
                                <div key={c.id} onClick={() => void linkPatient(c)} style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid #eef2f7", fontSize: 13 }}>
                                  <span style={{ fontWeight: 700 }}>{c.name}</span>
                                  {" "}<span style={{ color: c.dol ? "#00346e" : MUTED }}>· D/L: {c.dol || "—"}</span>
                                  {" "}<span style={{ color: MUTED }}>· use &amp; pre-fill</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </>
                    )}

                {/* Locked identity fields */}
                {locked ? roField("Claim Number", form.claimNumber) : field(<><span style={label}>Claim Number</span><input style={req("claimNumber", input)} value={form.claimNumber} onChange={(e) => set("claimNumber", e.target.value)} /></>)}
                {locked ? roField("Policy Number", form.policyNumber) : field(<><span style={label}>Policy Number</span><input style={req("policyNumber", input)} value={form.policyNumber} onChange={(e) => set("policyNumber", e.target.value)} /></>)}
                {locked ? roField("Insurer / Carrier", nameOf(form.insurerEntityId, insurers)) : field(<><span style={label}>Insurer / Carrier</span>{sel(form.insurerEntityId, (v) => set("insurerEntityId", v), insurers, "Select insurer…", req("insurerEntityId", input))}</>)}
                {locked ? roField("Date of Injury", form.dateOfInjury ? mdy(form.dateOfInjury) : "") : field(<><span style={label}>Date of Injury</span><input type="date" style={req("dateOfInjury", input)} value={form.dateOfInjury} onChange={(e) => set("dateOfInjury", e.target.value)} /></>)}

                {/* Pre-filled editable (highlighted when carried; turns blue once edited) */}
                {field(<><span style={label}>Treating Physician</span>{sel(form.treatingPhysicianId, (v) => set("treatingPhysicianId", v), physicians, "Select treating physician…", req("treatingPhysicianId", hlFor("treatingPhysicianId")))}</>)}
                {field(<><span style={label}>Provider / Client</span>{sel(form.providerEntityId, (v) => set("providerEntityId", v), providers, "Select provider…", req("providerEntityId", hlFor("providerEntityId")))}</>)}
                {field(<><span style={label}>Service Type</span>{sel(form.serviceTypeId, (v) => set("serviceTypeId", v), services, "Select service type…", req("serviceTypeId", hlFor("serviceTypeId")))}</>)}
                {field(<><span style={label}>Denial Reason</span>{sel(form.denialReasonId, (v) => set("denialReasonId", v), denials, "Select denial reason…", req("denialReasonId", hlFor("denialReasonId")))}</>)}
                {field(<><span style={label}>Case Type</span><select value={form.caseType} onChange={(e) => set("caseType", e.target.value)} style={hlFor("caseType")}><option>No-Fault</option><option>Workers Compensation</option><option>Lien</option></select></>)}

                {/* Always entered per bill */}
                {field(<><span style={label}>Gross Claim Amount</span><input style={req("grossClaimAmount", input)} value={form.grossClaimAmount} onChange={(e) => set("grossClaimAmount", e.target.value)} placeholder="0.00" /></>)}
                {field(<><span style={label}>DOS start</span><input type="date" style={req("dosStart", input)} value={form.dosStart} onChange={(e) => set("dosStart", e.target.value)} /></>)}
                {field(<><span style={label}>DOS end (blank = same as start)</span><input type="date" style={input} value={form.dosEnd} onChange={(e) => set("dosEnd", e.target.value)} /></>)}
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                <button type="button" style={btn("#16a34a", busy)} disabled={busy} onClick={() => void submit()}>{busy ? "Creating…" : "Create matter"}</button>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button type="button" style={btn(MUTED, busy)} disabled={busy} onClick={resetForm}>Clear all fields</button>
                  <button type="button" style={btn("#dc2626", busy)} disabled={busy} onClick={() => { window.location.href = "/admin/import/other"; }}>Cancel</button>
                </div>
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #dbe4f0", fontSize: 12, color: MUTED }}>
                Patient predictions come from the patient master. A patient only exists once it's on a matter.{" "}
                <button type="button" onClick={cleanupOrphans} style={{ border: "none", background: "transparent", color: "#dc2626", fontWeight: 800, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
                  Remove patients with no matters
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
