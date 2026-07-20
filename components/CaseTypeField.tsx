"use client";

// Editable Case Type field for a matter (No-Fault / Workers' Comp / Lien). Reads/writes its own value
// via /api/admin/matter-case-type, mirroring OldFileNumberField so it doesn't depend on host page data.

import React, { useCallback, useEffect, useState } from "react";

const OPTIONS = ["No-Fault", "Workers' Comp", "Lien"];

export default function CaseTypeField({ matterId, label }: { matterId?: number | null; label?: string }) {
  const [value, setValue] = useState("");
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

  async function save(next: string) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/matter-case-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matterId: matterId ?? null, value: next }),
      });
      const j = await res.json().catch(() => ({}));
      if (j?.ok) setValue(j.value || "");
      else setErr(j?.error || "Save failed.");
    } catch {
      setErr("Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }} data-barsh-case-type-field="true">
      <span style={{ fontSize: 12, fontWeight: 900, color: "#00346e", whiteSpace: "nowrap" }}>{label || "Case Type"}:</span>
      <select
        value={value}
        disabled={busy}
        onChange={(e) => void save(e.target.value)}
        style={{ border: "1px solid #cdd6e0", borderRadius: 6, padding: "5px 8px", fontSize: 13, color: "#00346e", minWidth: 150 }}
      >
        <option value="">—</option>
        {OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {busy ? <span style={{ fontSize: 12, color: "#8a97a8" }}>Saving…</span> : null}
      {err ? <span style={{ fontSize: 12, color: "#b23327" }}>{err}</span> : null}
    </div>
  );
}
