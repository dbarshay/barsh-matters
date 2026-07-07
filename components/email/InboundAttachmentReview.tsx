"use client";

// Phase D — inbound email attachment OCR review queue (operator UI).
// Lists attachments that arrived by email and were OCR-classified, with the suggested folder/title
// pre-selected. The operator confirms (files to Clio) or dismisses. Nothing files without a click +
// confirm. Filing goes through /api/graph/inbound-attachments (admin + confirmFile + Clio guard).

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { bmConfirm } from "@/app/components/BmDialogHost";
import { listTerminalFolders, getFolder } from "@/lib/documents/folderTaxonomy";

type Suggestion = {
  folderKey?: string | null;
  titleKey?: string | null;
  prefill?: Record<string, unknown>;
  identity?: Record<string, unknown>;
  crossRef?: any;
  meanConfidence?: number;
};

type Item = {
  id: string;
  name: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  ocrSuggestion: Suggestion | null;
  ocrPredictedMatterId: number | null;
  createdAt: string;
  message?: { subject?: string | null; fromEmail?: string | null; receivedAt?: string | null } | null;
};

export default function InboundAttachmentReview({
  matterId,
  masterLawsuitId,
  matterDisplayNumber,
  conversationId,
  onChanged,
}: {
  matterId?: number | null;
  masterLawsuitId?: string | null;
  matterDisplayNumber?: string | null;
  /** When set, scope to a single email conversation and stay silent when it has nothing pending. */
  conversationId?: string | null;
  onChanged?: () => void;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pick, setPick] = useState<Record<string, { folderKey: string; titleKey: string }>>({});
  const [preview, setPreview] = useState<{ id: string; name: string } | null>(null);

  const terminalFolders = useMemo(() => listTerminalFolders(), []);

  const perThread = Boolean(conversationId);

  const queryString = useMemo(() => {
    let base = "";
    if (Number.isFinite(matterId as number) && (matterId as number) > 0) base = `matterId=${matterId}`;
    else if (masterLawsuitId) base = `masterLawsuitId=${encodeURIComponent(masterLawsuitId)}`;
    else if (matterDisplayNumber) base = `matterDisplayNumber=${encodeURIComponent(matterDisplayNumber)}`;
    if (!base) return "";
    if (conversationId) base += `&conversationId=${encodeURIComponent(conversationId)}`;
    return base;
  }, [matterId, masterLawsuitId, matterDisplayNumber, conversationId]);

  const load = useCallback(async () => {
    if (!queryString) return;
    setError(null);
    try {
      const res = await fetch(`/api/graph/inbound-attachments?${queryString}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (j?.ok) {
        setItems(j.attachments as Item[]);
        // Seed the folder/title pick from each item's OCR suggestion.
        setPick((prev) => {
          const next = { ...prev };
          for (const it of j.attachments as Item[]) {
            if (next[it.id]) continue;
            const fk = it.ocrSuggestion?.folderKey || "";
            const tk = it.ocrSuggestion?.titleKey || (fk ? getFolder(fk)?.titles[0]?.key || "" : "");
            next[it.id] = { folderKey: fk, titleKey: tk };
          }
          return next;
        });
      } else setError(j?.error || "Failed to load inbound attachments.");
    } catch {
      setError("Failed to load inbound attachments.");
    }
  }, [queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  function setFolder(id: string, folderKey: string) {
    const firstTitle = folderKey ? getFolder(folderKey)?.titles[0]?.key || "" : "";
    setPick((p) => ({ ...p, [id]: { folderKey, titleKey: firstTitle } }));
  }
  function setTitle(id: string, titleKey: string) {
    setPick((p) => ({ ...p, [id]: { folderKey: p[id]?.folderKey || "", titleKey } }));
  }

  async function fileItem(it: Item, confirmDuplicate = false) {
    const sel = pick[it.id];
    if (!sel?.folderKey || !sel?.titleKey) {
      setError("Choose a folder and title before filing.");
      return;
    }
    if (!confirmDuplicate) {
      const ok = await bmConfirm({
        title: "File this document",
        message: `File "${it.name || "attachment"}" from this email into ${getFolder(sel.folderKey)?.name || sel.folderKey}? It will be uploaded to the matter's document vault.`,
        submitLabel: "File it",
      });
      if (!ok) return;
    }
    setBusyId(it.id);
    setError(null);
    try {
      const res = await fetch("/api/graph/inbound-attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "file",
          attachmentId: it.id,
          folderKey: sel.folderKey,
          titleKey: sel.titleKey,
          fields: it.ocrSuggestion?.prefill || {},
          confirmFile: true,
          confirmDuplicate,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (j?.ok) {
        setItems((cur) => (cur || []).filter((x) => x.id !== it.id));
        onChanged?.();
      } else if (j?.duplicate) {
        const again = await bmConfirm({ title: "Already filed", message: j.error || "This file is already filed. File it anyway?", submitLabel: "File anyway" });
        if (again) await fileItem(it, true);
      } else {
        setError(j?.error || "Filing failed.");
      }
    } catch (err: any) {
      setError(err?.message || "Filing request failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function dismissItem(it: Item) {
    const ok = await bmConfirm({ title: "Dismiss", message: `Remove "${it.name || "attachment"}" from the review queue without filing it?`, submitLabel: "Dismiss" });
    if (!ok) return;
    setBusyId(it.id);
    try {
      const res = await fetch("/api/graph/inbound-attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss", attachmentId: it.id }),
      });
      const j = await res.json().catch(() => ({}));
      if (j?.ok) {
        setItems((cur) => (cur || []).filter((x) => x.id !== it.id));
        onChanged?.();
      } else setError(j?.error || "Dismiss failed.");
    } catch {
      setError("Dismiss request failed.");
    } finally {
      setBusyId(null);
    }
  }

  // Per-thread rendering stays silent while loading / when empty so it doesn't clutter the thread list.
  if (error && items === null) return perThread ? null : <div style={{ color: "#b00020", padding: 10, fontSize: 13 }}>{error}</div>;
  if (items === null) return perThread ? null : <div style={{ color: "#8a97a8", padding: 10, fontSize: 13 }}>Loading inbound attachments…</div>;
  if (items.length === 0) return perThread ? null : <div style={{ color: "#8a97a8", padding: 10, fontSize: 13, fontStyle: "italic" }}>No inbound attachments awaiting review.</div>;

  const selectStyle: React.CSSProperties = { border: "1px solid #cdd6e0", borderRadius: 8, padding: "6px 8px", fontSize: 13, background: "#fff", color: "#00346e", maxWidth: 260 };

  return (
    <div style={{ display: "grid", gap: 10 }} data-barsh-inbound-attachment-review="true">
      {error && <div style={{ color: "#b00020", fontSize: 12 }}>{error}</div>}
      {items.map((it) => {
        const sel = pick[it.id] || { folderKey: "", titleKey: "" };
        const titles = sel.folderKey ? getFolder(sel.folderKey)?.titles || [] : [];
        const predicted = it.ocrPredictedMatterId ? `Predicted matter #${it.ocrPredictedMatterId}` : null;
        const confidence = typeof it.ocrSuggestion?.meanConfidence === "number" ? `${Math.round(it.ocrSuggestion!.meanConfidence! * 100)}% OCR` : null;
        return (
          <div key={it.id} style={{ border: "1px solid #dbe4f0", borderRadius: 12, background: "#fff", padding: 12, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 850, color: "#00346e" }}>📎 {it.name || "attachment"}</div>
                <div style={{ fontSize: 12, color: "#5a6b80", marginTop: 2 }}>
                  {it.message?.fromEmail ? `From ${it.message.fromEmail}` : ""}
                  {it.message?.subject ? ` · ${it.message.subject}` : ""}
                </div>
              </div>
              <div style={{ display: "inline-flex", gap: 6, flexShrink: 0 }}>
                {[predicted, confidence].filter(Boolean).map((chip, i) => (
                  <span key={i} style={{ fontSize: 11, fontWeight: 800, color: "#00346e", background: "#eef4fb", border: "1px solid #cfe0f2", borderRadius: 999, padding: "2px 8px" }}>{chip}</span>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <select value={sel.folderKey} onChange={(e) => setFolder(it.id, e.target.value)} style={selectStyle}>
                <option value="">— Choose folder —</option>
                {terminalFolders.map((f) => (
                  <option key={f.key} value={f.key}>{f.name}</option>
                ))}
              </select>
              <select value={sel.titleKey} onChange={(e) => setTitle(it.id, e.target.value)} style={selectStyle} disabled={!sel.folderKey}>
                <option value="">— Choose title —</option>
                {titles.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() => setPreview({ id: it.id, name: it.name || "attachment" })}
                title="Preview this document without leaving the review panel"
                style={{ border: "1px solid #00346e", borderRadius: 999, background: "#eef4fb", color: "#00346e", fontSize: 12, fontWeight: 900, padding: "7px 12px", cursor: "pointer" }}
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => void fileItem(it)}
                disabled={busyId === it.id || !sel.folderKey || !sel.titleKey}
                style={{ border: "1px solid #00346e", borderRadius: 999, background: busyId === it.id ? "#c7d2e4" : "#00346e", color: "#fff", fontSize: 12, fontWeight: 900, padding: "7px 14px", cursor: busyId === it.id ? "default" : "pointer" }}
              >
                {busyId === it.id ? "Filing…" : "File"}
              </button>
              <button
                type="button"
                onClick={() => void dismissItem(it)}
                disabled={busyId === it.id}
                style={{ border: "1px solid #cdd6e0", borderRadius: 999, background: "#fff", color: "#7c4a22", fontSize: 12, fontWeight: 800, padding: "7px 12px", cursor: "pointer" }}
              >
                Dismiss
              </button>
            </div>

            {preview?.id === it.id && (
              <div style={{ marginTop: 4, border: "1px solid #dbe4f0", borderRadius: 10, overflow: "hidden", background: "#f8fafc" }} data-barsh-inbound-attachment-preview="true">
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#eef4fb", borderBottom: "1px solid #dbe4f0" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#00346e" }}>Preview</span>
                  <div style={{ flex: 1 }} />
                  <a
                    href={`/api/graph/inbound-attachments/preview?attachmentId=${encodeURIComponent(it.id)}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 12, fontWeight: 800, color: "#00346e" }}
                  >
                    Open in new tab
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreview(null)}
                    style={{ border: "1px solid #cdd6e0", borderRadius: 6, background: "#fff", color: "#26364a", fontSize: 12, fontWeight: 800, padding: "3px 10px", cursor: "pointer" }}
                  >
                    Close
                  </button>
                </div>
                <iframe
                  title={`Preview of ${it.name || "attachment"}`}
                  src={`/api/graph/inbound-attachments/preview?attachmentId=${encodeURIComponent(it.id)}`}
                  style={{ width: "100%", height: 520, border: "none", display: "block" }}
                />
              </div>
            )}
          </div>
        );
      })}

    </div>
  );
}
