"use client";

// Phase 3 filing form: pick a terminal folder → controlled title → structured prompts → file it.
// Posts to /api/documents/filed, which enforces the taxonomy server-side, composes the display
// label (with (2)/(3) disambiguation), warns on exact-duplicate bytes, and audits. On success it
// calls onFiled() so the tree refreshes.
//
// NOTE: clioDocumentId is a real Clio file id in production (the file is uploaded first). Here it's
// an editable placeholder so Phase 3 can be exercised before the upload flow is wired in.

import React, { useMemo, useState } from "react";

import {
  FREEHAND_TITLE_KEY,
  getFolder,
  findTitle,
  listTerminalFolders,
  type MatterLevel,
} from "@/lib/documents/folderTaxonomy";

const NAVY = "#00346e";

function pathLabel(key: string): string {
  const parts = key.split(".");
  const names: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const f = getFolder(parts.slice(0, i + 1).join("."));
    if (f) names.push(f.name);
  }
  return names.join(" › ");
}

export default function FileDocumentForm({
  matterId,
  level = "matter",
  onFiled,
  presetFolderKey,
  presetTitleKey,
  presetFileName,
  presetContentType,
  presetFields,
  presetOcrExtractionId,
  presetFileHash,
}: {
  matterId: number;
  level?: MatterLevel | "all";
  onFiled?: () => void;
  /** Pre-select this folder (e.g. from a drag-drop onto a folder). */
  presetFolderKey?: string;
  presetTitleKey?: string;
  presetFileName?: string;
  presetContentType?: string;
  /** OCR-prefilled prompt values keyed by field, with per-field confidence for highlighting. */
  presetFields?: Record<string, { value: string; confidence: number | null }>;
  presetOcrExtractionId?: string;
  presetFileHash?: string;
}) {
  const folders = useMemo(
    () => listTerminalFolders().filter((f) => level === "all" || f.level === level),
    [level],
  );

  const initialFolder =
    presetFolderKey && getFolder(presetFolderKey)?.terminal ? presetFolderKey : folders[0]?.key ?? "";
  const [folderKey, setFolderKey] = useState(initialFolder);
  const folder = getFolder(folderKey);
  const titleOptions = useMemo(() => {
    const f = getFolder(folderKey);
    const opts = (f?.titles ?? []).map((t) => ({ key: t.key, label: t.label }));
    if (f?.allowFreehandOther) opts.push({ key: FREEHAND_TITLE_KEY, label: "Other (freehand)" });
    return opts;
  }, [folderKey]);

  const initialTitle =
    presetTitleKey && titleOptions.some((t) => t.key === presetTitleKey)
      ? presetTitleKey
      : titleOptions[0]?.key ?? "";
  const [titleKey, setTitleKey] = useState(initialTitle);
  const [freehandTitle, setFreehandTitle] = useState("");
  const [fields, setFields] = useState<Record<string, string>>(
    presetFields
      ? Object.fromEntries(Object.entries(presetFields).map(([k, v]) => [k, v.value]))
      : {},
  );
  // Per-field OCR confidence (for highlighting the prefilled values).
  const prefillConf: Record<string, number | null> = presetFields
    ? Object.fromEntries(Object.entries(presetFields).map(([k, v]) => [k, v.confidence]))
    : {};
  const [clioDocumentId, setClioDocumentId] = useState(
    `TEST-${Math.random().toString(16).slice(2, 10)}`,
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Reset title + fields when folder changes.
  function changeFolder(k: string) {
    setFolderKey(k);
    const f = getFolder(k);
    const first = f?.titles[0]?.key ?? (f?.allowFreehandOther ? FREEHAND_TITLE_KEY : "");
    setTitleKey(first);
    setFields({});
    setFreehandTitle("");
    setMsg(null);
  }

  const title = titleKey === FREEHAND_TITLE_KEY ? null : findTitle(folderKey, titleKey);
  const visiblePrompts = (title?.prompts ?? []).filter((p) => {
    if (!p.showWhen) return true;
    return p.showWhen.equals.includes(fields[p.showWhen.field] ?? "");
  });

  async function submit(confirmDuplicate = false) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/documents/filed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matterId,
          level,
          clioDocumentId: clioDocumentId.trim(),
          folderKey,
          titleKey,
          freehandTitle: titleKey === FREEHAND_TITLE_KEY ? freehandTitle : undefined,
          fields,
          fileName: presetFileName,
          contentType: presetContentType,
          fileHash: presetFileHash,
          ocrExtractionId: presetOcrExtractionId,
          sourceType: "scan",
          confirmDuplicate,
        }),
      });
      const j = await res.json();
      if (j?.ok) {
        setMsg({ kind: "ok", text: `Filed as "${j.document.titleLabel}".` });
        setClioDocumentId(`TEST-${Math.random().toString(16).slice(2, 10)}`);
        setFields({});
        setFreehandTitle("");
        onFiled?.();
      } else {
        setMsg({ kind: "err", text: j?.error || "Filing failed." });
      }
    } catch {
      setMsg({ kind: "err", text: "Filing request failed." });
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: "6px 10px",
    border: "1px solid #cdd6e0",
    borderRadius: 6,
    fontSize: 13,
    width: "100%",
  };
  const rowStyle: React.CSSProperties = { marginBottom: 10 };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, color: "#5a6b80", marginBottom: 3 };

  return (
    <div style={{ border: "1px solid #e3e9f0", borderRadius: 10, padding: 16, background: "#f8fafc", marginBottom: 16 }}>
      <strong style={{ color: NAVY, fontSize: 14 }}>File a document</strong>
      {presetFileName && (
        <div style={{ marginTop: 6, fontSize: 12, color: "#137333" }}>
          Dropped file: <strong>{presetFileName}</strong>
          {presetFields
            ? " — OCR pre-filled the fields below. Verify highlighted values (green = high confidence, amber = low)."
            : " — pick a title and file it."}
        </div>
      )}

      <div style={{ ...rowStyle, marginTop: 10 }}>
        <label style={labelStyle}>Folder</label>
        <select value={folderKey} onChange={(e) => changeFolder(e.target.value)} style={inputStyle}>
          {folders.map((f) => (
            <option key={f.key} value={f.key}>
              {pathLabel(f.key)}
            </option>
          ))}
        </select>
      </div>

      <div style={rowStyle}>
        <label style={labelStyle}>Title{folder?.allowFreehandOther ? " (or Other)" : ""}</label>
        <select value={titleKey} onChange={(e) => { setTitleKey(e.target.value); setFields({}); }} style={inputStyle}>
          {titleOptions.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {titleKey === FREEHAND_TITLE_KEY && (
        <div style={rowStyle}>
          <label style={labelStyle}>Custom title</label>
          <input value={freehandTitle} onChange={(e) => setFreehandTitle(e.target.value)} style={inputStyle} placeholder="Type a title" />
        </div>
      )}

      {visiblePrompts.map((p) => {
        const conf = prefillConf[p.key];
        const highlight: React.CSSProperties =
          conf == null
            ? {}
            : conf >= 0.5
              ? { borderColor: "#137333", background: "#eefaf0" }
              : { borderColor: "#b8860b", background: "#fdf6e3" };
        return (
          <div key={p.key} style={rowStyle}>
            <label style={labelStyle}>
              {p.label}
              {p.required ? " *" : ""}
              {conf != null && (
                <span style={{ marginLeft: 6, color: conf >= 0.5 ? "#137333" : "#b8860b", fontSize: 11 }}>
                  OCR {Math.round(conf * 100)}%
                </span>
              )}
            </label>
            {p.type === "select" ? (
              <select
                value={fields[p.key] ?? ""}
                onChange={(e) => setFields((f) => ({ ...f, [p.key]: e.target.value }))}
                style={{ ...inputStyle, ...highlight }}
              >
                <option value="">— select —</option>
                {(p.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={fields[p.key] ?? ""}
                onChange={(e) => setFields((f) => ({ ...f, [p.key]: e.target.value }))}
                placeholder={p.type === "date" ? "MM/DD/YYYY" : p.type === "money" ? "0.00" : ""}
                inputMode={p.type === "money" ? "decimal" : undefined}
                style={{ ...inputStyle, ...highlight }}
              />
            )}
          </div>
        );
      })}

      <div style={rowStyle}>
        <label style={labelStyle}>Clio document id (placeholder until upload flow is wired)</label>
        <input value={clioDocumentId} onChange={(e) => setClioDocumentId(e.target.value)} style={inputStyle} />
      </div>

      <button
        onClick={() => submit(false)}
        disabled={busy || !clioDocumentId.trim()}
        style={{
          background: NAVY,
          color: "#fff",
          border: "none",
          borderRadius: 6,
          padding: "8px 16px",
          fontWeight: 800,
          fontSize: 13,
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? "Filing…" : "File document"}
      </button>

      {msg && (
        <div style={{ marginTop: 10, fontSize: 13, color: msg.kind === "ok" ? "#137333" : "#b00020" }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
