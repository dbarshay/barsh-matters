"use client";

// Editable "Old File Number" field for migration (task #130). Reads/writes its own value via
// /api/admin/old-file-number so it doesn't depend on the host page's data shape. Use matterId for an
// Individual Matter (445YY-NNNNNN) or masterLawsuitId for a Lawsuit Matter (445-PKTYY-NNNNNN).

import React, { useCallback, useEffect, useState } from "react";

export default function OldFileNumberField({
  matterId,
  masterLawsuitId,
  label,
}: {
  matterId?: number | null;
  masterLawsuitId?: string | null;
  label?: string;
}) {
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const query =
    Number.isFinite(matterId as number) && (matterId as number) > 0
      ? `matterId=${matterId}`
      : masterLawsuitId
        ? `masterLawsuitId=${encodeURIComponent(masterLawsuitId)}`
        : "";

  const load = useCallback(async () => {
    if (!query) return;
    try {
      const res = await fetch(`/api/admin/old-file-number?${query}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (j?.ok) setValue(j.value || "");
    } catch {
      /* non-fatal */
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/old-file-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matterId: matterId ?? null, masterLawsuitId: masterLawsuitId ?? null, value: draft }),
      });
      const j = await res.json().catch(() => ({}));
      if (j?.ok) {
        setValue(j.value || "");
        setEditing(false);
      } else setErr(j?.error || "Save failed.");
    } catch {
      setErr("Save failed.");
    } finally {
      setBusy(false);
    }
  }

  const lbl = label || "Old File Number";
  const placeholder = masterLawsuitId ? "445-PKTYY-NNNNNN" : "445YY-NNNNNN";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }} data-barsh-old-file-number-field="true">
      <span style={{ fontSize: 12, fontWeight: 900, color: "#00346e", whiteSpace: "nowrap" }}>{lbl}:</span>
      {editing ? (
        <>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void save(); } if (e.key === "Escape") setEditing(false); }}
            placeholder={placeholder}
            autoFocus
            style={{ border: "1px solid #cdd6e0", borderRadius: 6, padding: "5px 8px", fontSize: 13, minWidth: 170 }}
          />
          <button type="button" disabled={busy} onClick={() => void save()} style={{ border: "none", borderRadius: 6, background: busy ? "#93a4bd" : "#00346e", color: "#fff", fontSize: 12, fontWeight: 800, padding: "5px 12px", cursor: busy ? "default" : "pointer" }}>{busy ? "Saving…" : "Save"}</button>
          <button type="button" onClick={() => setEditing(false)} style={{ border: "1px solid #cdd6e0", borderRadius: 6, background: "#fff", color: "#33415a", fontSize: 12, fontWeight: 700, padding: "5px 10px", cursor: "pointer" }}>Cancel</button>
          {err ? <span style={{ fontSize: 12, color: "#b23327" }}>{err}</span> : null}
        </>
      ) : (
        <>
          <span style={{ fontSize: 13, fontWeight: 700, color: value ? "#00346e" : "#8a97a8" }}>{value || "—"}</span>
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
