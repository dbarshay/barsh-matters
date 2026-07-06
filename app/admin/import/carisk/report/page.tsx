"use client";

import { bmConfirm, bmAlert } from "@/app/components/BmDialogHost";
import React, { useCallback, useEffect, useState } from "react";
import BarshHeader from "@/app/components/BarshHeader";

// Carisk Management Report — open "Saved Incomplete" bills (rejected as incomplete, not yet a matter),
// keyed by CIC#. Rows leave automatically when the same CIC# later arrives as a Carrier Submission.

const NAVY = "#00346e";
const MUTED = "#385a83";
const box: React.CSSProperties = { border: "1px solid #dbe4f0", borderRadius: 12, padding: 16, background: "#fff", marginBottom: 16 };
const th: React.CSSProperties = { padding: 6, textAlign: "left", color: MUTED, whiteSpace: "nowrap" };
const btn = (bg: string, disabled = false): React.CSSProperties => ({ height: 34, padding: "0 14px", border: `1px solid ${bg}`, borderRadius: 8, background: disabled ? "#e2e8f0" : bg, color: disabled ? "#94a3b8" : "#fff", fontWeight: 800, fontSize: 13, cursor: disabled ? "not-allowed" : "pointer" });
const money = (n: number | null) => (n == null ? "—" : `$${Number(n).toFixed(2)}`);
const dos = (a?: string, b?: string) => (a && b && a !== b ? `${a} – ${b}` : a || b || "—");

export default function CariskReportPage() {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  const load = useCallback(async () => {
    setBusy("load"); setError("");
    try {
      const r = await fetch("/api/import/carisk/report", { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) setError(j.error || "Could not load report."); else setData(j);
    } catch (e: any) { setError(e?.message || "Could not load report."); } finally { setBusy(""); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function sendNow() {
    if (!await bmConfirm("Email the current Carisk Management Report now?")) return;
    setBusy("send"); setError(""); setFlash("");
    try {
      const r = await fetch("/api/import/carisk/report/send", { method: "POST" });
      const j = await r.json();
      if (j.ok) setFlash(`Report emailed (${j.rows} rows) to ${(j.sentTo || []).join(", ")}.`);
      else setError(j.error || "Send failed.");
    } catch (e: any) { setError(e?.message || "Send failed."); } finally { setBusy(""); }
  }

  const items: any[] = data?.items || [];

  return (
    <main style={{ padding: "12px 14px 40px", background: "#f8fafc", minHeight: "100vh", color: NAVY, fontFamily: "Inter, system-ui, sans-serif" }}>
      <BarshHeader center={<div style={{ fontSize: 28, fontWeight: 950, color: "#fff" }}>Carisk Management Report</div>} />
      <div style={{ width: "100%", maxWidth: "100%", margin: 0, boxSizing: "border-box" }}>
        <div style={{ marginBottom: 12 }}><a href="/admin/import?source=carisk" style={{ color: MUTED, fontWeight: 800, textDecoration: "none" }}>← Back to CARISK import</a></div>

        {flash ? <div style={{ ...box, borderColor: "#bbf7d0", background: "#f0fdf4", color: "#166534", fontWeight: 700 }}>{flash}</div> : null}
        {error ? <div style={{ ...box, borderColor: "#fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 700 }}>{error}</div> : null}

        <div style={box}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 900 }}>
              Open Saved-Incomplete bills — {items.length}
              {data && data.recipientsConfigured === 0 ? <span style={{ color: "#dc2626", fontWeight: 700, marginLeft: 10, fontSize: 13 }}>· no email recipient configured (set CARISK_REPORT_RECIPIENT)</span> : null}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" style={btn(MUTED, busy === "load")} disabled={busy === "load"} onClick={() => load()}>Refresh</button>
              <button type="button" style={btn(NAVY, busy === "send" || (data && data.recipientsConfigured === 0))} disabled={busy === "send" || (data && data.recipientsConfigured === 0)} onClick={sendNow}>{busy === "send" ? "Sending…" : "Send report email now"}</button>
            </div>
          </div>
          <div style={{ color: MUTED, fontSize: 13, marginTop: 6 }}>Rows drop off automatically when the same CIC# arrives as a Carrier Submission (which creates the matter). A weekly email is sent to the configured recipient.</div>
        </div>

        <div style={box}>
          {items.length === 0 ? <div style={{ color: MUTED }}>No open items.</div> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr>
                  <th style={th}>CIC #</th><th style={th}>Patient</th><th style={th}>Provider</th><th style={th}>Carrier</th><th style={th}>DOS</th><th style={th}>Charges</th><th style={th}>Status date</th><th style={th}>Rejection detail</th><th style={th}>First seen</th><th style={th}>Last seen</th>
                </tr></thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid #eef2f7" }}>
                      <td style={{ padding: 6, fontWeight: 700 }}>{r.cicNumber}</td>
                      <td>{r.patientName || "—"}</td>
                      <td>{r.providerName || "—"}</td>
                      <td>{r.carrierName || "—"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{dos(r.dosStart, r.dosEnd)}</td>
                      <td>{money(r.claimAmount)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{r.statusDate || "—"}</td>
                      <td style={{ color: MUTED, maxWidth: 340 }}>{(r.rejectionDetail || "").slice(0, 200) || "—"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{new Date(r.firstSeen).toLocaleDateString()}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{new Date(r.lastSeen).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
