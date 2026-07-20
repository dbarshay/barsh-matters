"use client";

// Editable Case Type field for a matter (No-Fault / Workers' Comp / Lien). Reads/writes its own value
// via /api/admin/matter-case-type, mirroring OldFileNumberField: read-only display + Edit button, with a
// confirm step on save because case type drives report filters and case-type routing.

import React, { useCallback, useEffect, useState } from "react";

const OPTIONS = ["No-Fault", "Workers' Comp", "Lien"];

export default function CaseTypeField({ matterId, label }: { matterId?: number | null; label?: string }) {
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(false);
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
    // No actual change -> just close the editor.
    if (draft === value) { setEditing(false); return; }
    const from = value || "(none)";
    const to = draft || "(none)";
    const ok = window.confirm(
      `Change Case Type from "${from}" to "${to}"?\n\n` +
        "This affects report filters (No-Fault / Workers' Comp / Lien) and case-type routing for this matter."
    );
    if (!ok) return; // stay in edit mode
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/matter-case-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matterId: matterId ?? null, value: draft }),
      });
      const j = await res.json().catch(() => ({}));
      if (j?.ok) { setValue(j.value || ""); setEditing(false); }
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
      {editing ? (
        <>
          <select
            value={draft}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }}
            autoFocus
            style={{ border: "1px solid #cdd6e0", borderRadius: 6, padding: "5px 8px", fontSize: 13, color: "#00346e", minWidth: 150 }}
          >
            <option value="">—</option>
            {OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <button type="button" disabled={busy} onClick={() => void save()} style={{ border: "none", borderRadius: 6, background: busy ? "#93a4bd" : "#00346e", color: "#fff", fontSize: 12, fontWeight: 800, padding: "5px 12px", cursor: busy ? "default" : "pointer" }}>{busy ? "Saving…" : "Save"}</button>
          <button type="button" onClick={() => setEditing(false)} style={{ border: "1px solid #cdd6e0", borderRadius: 6, background: "#fff", color: "#33415a", fontSize: 12, fontWeight: 700, padding: "5px 10px", cursor: "pointer" }}>Cancel</button>
          {err ? <span style={{ fontSize: 12, color: "#b23327" }}>{err}</span> : null}
        </>
      ) : (
        <>
          <span style={{ fontSize: 13, fontWeight: 700, color: value ? "#1b2a3d" : "#8a97a8" }}>{value || "—"}</span>
          <button
            type="button"
            onClick={() => { setDraft(value); setEditing(true); setErr(null); }}
            style={{ border: "1px solid #cdd6e0", borderRadius: 999, background: "#eef4fb", color: "#00346e", fontSize: 11, fontWeight: 800, padding: "3px 10px", cursor: "pointer" }}
          >
            {value ? "Edit" : "Add"}
          </button>
        </>
      )}
    </div>
  );
}
