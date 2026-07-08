"use client";

// Service Type card for the individual matter screen. Mirrors the other Claim summary cards
// (label + Edit button + value); editing reveals a picklist sourced from the service_type reference
// table. Reads/writes ClaimIndex.service_type via /api/matters/identity-field (fieldName=service_type).
// Self-contained like OldFileNumberField so it doesn't depend on the host page's data shape.

import React, { useCallback, useEffect, useState } from "react";

type Option = { id: string; displayName: string };

const editBtnStyle: React.CSSProperties = {
  border: "1px solid #93c5fd",
  borderRadius: 999,
  background: "#eff6ff",
  color: "#00346e",
  fontSize: 11,
  fontWeight: 900,
  padding: "3px 8px",
};

export default function ServiceTypePicklist({ matterId }: { matterId?: number | null }) {
  const [options, setOptions] = useState<Option[]>([]);
  const [valueId, setValueId] = useState("");
  const [valueText, setValueText] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draftId, setDraftId] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const validId = Number.isFinite(matterId as number) && (matterId as number) > 0;

  const load = useCallback(async () => {
    if (!validId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [optRes, fieldRes] = await Promise.all([
        fetch("/api/reference-data/options?type=service_type", { cache: "no-store" })
          .then((r) => r.json())
          .catch(() => null),
        fetch(`/api/matters/identity-field?matterId=${matterId}&fieldName=service_type`, { cache: "no-store" })
          .then((r) => r.json())
          .catch(() => null),
      ]);
      const opts = optRes?.ok && Array.isArray(optRes.options) ? optRes.options : [];
      setOptions(
        opts
          .map((o: any) => ({ id: String(o.id), displayName: String(o.displayName || o.name || "") }))
          .filter((o: Option) => o.id && o.displayName)
      );
      if (fieldRes?.ok) {
        setValueId(String(fieldRes.field?.fieldValueId || ""));
        setValueText(String(fieldRes.field?.fieldValue || ""));
      }
    } finally {
      setLoading(false);
    }
  }, [matterId, validId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    const opt = options.find((o) => o.id === draftId);
    if (!opt || !validId) {
      setErr("Select a Service Type.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/matters/identity-field", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matterId,
          fieldName: "service_type",
          fieldValueId: opt.id,
          fieldValue: opt.displayName,
          actorName: "Barsh Matters User",
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setErr(j?.error || "Service Type could not be saved.");
        return;
      }
      setValueId(String(j.field?.fieldValueId || opt.id));
      setValueText(String(j.field?.fieldValue || opt.displayName));
      setEditing(false);
    } catch {
      setErr("Service Type could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="barsh-direct-summary-card" data-barsh-service-type-picklist="true">
      <div
        className="barsh-direct-summary-label"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
      >
        <span>Service Type</span>
        {!editing ? (
          <button
            type="button"
            onClick={() => {
              setDraftId(valueId);
              setErr(null);
              setEditing(true);
            }}
            disabled={loading || !validId}
            title="Edit Service Type."
            style={{ ...editBtnStyle, cursor: loading || !validId ? "not-allowed" : "pointer" }}
          >
            Edit
          </button>
        ) : null}
      </div>

      {!editing ? (
        <div className="barsh-direct-summary-value">{loading ? "Loading…" : valueText || "—"}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
          <select
            value={draftId}
            onChange={(e) => setDraftId(e.target.value)}
            disabled={saving}
            autoFocus
            style={{
              width: "100%",
              minWidth: 0,
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              background: "#ffffff",
              color: "#00346e",
              padding: "8px 10px",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <option value="">— Select Service Type —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.displayName}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !draftId}
              style={{
                border: "1px solid #00346e",
                borderRadius: 8,
                background: saving || !draftId ? "#93c5fd" : "#00346e",
                color: "#ffffff",
                fontSize: 12,
                fontWeight: 900,
                padding: "6px 12px",
                cursor: saving || !draftId ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setErr(null);
              }}
              disabled={saving}
              style={{
                border: "1px solid #cdd6e0",
                borderRadius: 8,
                background: "#ffffff",
                color: "#33415a",
                fontSize: 12,
                fontWeight: 700,
                padding: "6px 10px",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              Cancel
            </button>
          </div>
          {err ? <div style={{ fontSize: 11, fontWeight: 700, color: "#b23327" }}>{err}</div> : null}
        </div>
      )}
    </div>
  );
}
