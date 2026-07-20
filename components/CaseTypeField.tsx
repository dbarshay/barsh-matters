"use client";

// Editable Case Type field for a matter (No-Fault / Workers' Comp / Lien). Reads/writes its own value
// via /api/admin/matter-case-type. Read-only display + Edit button; editing happens in the standard
// BarshModal popup (like Patient / Provider / Policy Number), which doubles as the confirm step since
// case type drives report filters and case-type routing.

import React, { useCallback, useEffect, useState } from "react";
import BarshModal from "@/app/components/BarshModal";

const OPTIONS = ["No-Fault", "Workers' Comp", "Lien"];

export default function CaseTypeField({ matterId, label }: { matterId?: number | null; label?: string }) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const query = Number.isFinite(matterId as number) && (matterId as number) > 0 ? `matterId=${matterId}` : "";

  const load = useCallback(async () => {
    if (!query) return;
    try {
      const res = await fetch(`/api/admin/matter-case-type?${query}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (j?.ok) setValue(j.value || "");
    } catch {
      /* non-fatal */
    }
  }, [query]);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (draft === value) { setOpen(false); return; }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/matter-case-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matterId: matterId ?? null, value: draft }),
      });
      const j = await res.json().catch(() => ({}));
      if (j?.ok) { setValue(j.value || ""); setOpen(false); }
      else setErr(j?.error || "Save failed.");
    } catch {
      setErr("Save failed.");
    } finally {
      setBusy(false);
    }
  }

  const lbl = label || "Case Type";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }} data-barsh-case-type-field="true">
      <span style={{ fontSize: 12, fontWeight: 900, color: "#00346e", whiteSpace: "nowrap" }}>{lbl}:</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: value ? "#00346e" : "#8a97a8" }}>{value || "—"}</span>
      <button
        type="button"
        onClick={() => { setDraft(value); setErr(null); setOpen(true); }}
        style={{ border: "1px solid #cdd6e0", borderRadius: 999, background: "#eef4fb", color: "#00346e", fontSize: 11, fontWeight: 800, padding: "3px 10px", cursor: "pointer" }}
      >
        {value ? "Edit" : "Add"}
      </button>

      {open && (
        <BarshModal
          title="Edit Case Type"
          dataModalId="matter-case-type-edit"
          initialWidth={520}
          closeLabel="Cancel"
          submitLabel={busy ? "Saving…" : "Confirm Edit"}
          submitDisabled={busy}
          onClose={() => { if (!busy) { setOpen(false); setErr(null); } }}
          onSubmit={() => { if (!busy) void save(); }}
        >
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 6, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 12, background: "#f8fafc" }}>
              <span style={{ fontSize: 12, fontWeight: 950, letterSpacing: "0.06em", textTransform: "uppercase", color: "#385a83" }}>Current</span>
              <strong style={{ fontSize: 16, color: "#00346e" }}>{value || "—"}</strong>
            </div>
            <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>
              <span>Case Type</span>
              <select
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                style={{ height: 40, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 10px", fontWeight: 800, color: "#00346e", background: "#fff" }}
              >
                <option value="">—</option>
                {OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
              Case type drives report filters (No-Fault / Workers&apos; Comp / Lien) and case-type routing for this matter.
            </div>
            {err ? (
              <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 12, padding: 10, fontSize: 13, fontWeight: 800 }}>
                {err}
              </div>
            ) : null}
          </div>
        </BarshModal>
      )}
    </div>
  );
}
