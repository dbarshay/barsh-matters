"use client";

// Inline filing form shown when a file is dropped onto a terminal folder in a matter's document
// tree. The folder is fixed (the drop target); the operator picks the approved title/label. OCR
// best-effort prefills the title's fields. Submit uploads to Clio (guarded) + files the BM record
// via /api/documents/upload — the same path the Upload Docs page uses.

import React, { useEffect, useMemo, useState } from "react";
import {
  FREEHAND_TITLE_KEY,
  getFolder,
  findTitle,
} from "@/lib/documents/folderTaxonomy";

const NAVY = "#00346e";

type Prefill = Record<string, { value: string; confidence: number | null }>;

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
}

export default function DropFileFilingForm({
  matterId,
  matterDisplayNumber,
  folderKey,
  file,
  onDone,
  onCancel,
}: {
  matterId: number;
  matterDisplayNumber: string;
  folderKey: string;
  file: File;
  onDone: () => void;
  onCancel: () => void;
}) {
  const folder = getFolder(folderKey);
  const titleOptions = useMemo(() => {
    const f = getFolder(folderKey);
    const opts = (f?.titles ?? []).map((t) => ({ key: t.key, label: t.label }));
    if (f?.allowFreehandOther) opts.push({ key: FREEHAND_TITLE_KEY, label: "Other (freehand)" });
    return opts;
  }, [folderKey]);

  const [base64, setBase64] = useState("");
  const [ocrBusy, setOcrBusy] = useState(true);
  const [ocrExtractionId, setOcrExtractionId] = useState<string | null>(null);
  const [titleKey, setTitleKey] = useState(titleOptions[0]?.key ?? "");
  const [freehandTitle, setFreehandTitle] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [prefill, setPrefill] = useState<Prefill>({});
  const [busy, setBusy] = useState(false);
  const [needsDupConfirm, setNeedsDupConfirm] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "warn"; text: string } | null>(null);

  // On mount: read the file and best-effort OCR prefill (scoped to the drop-target folder).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const b64 = await fileToBase64(file);
        if (!alive) return;
        setBase64(b64);
        const res = await fetch("/api/documents/ocr-prefill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64: b64, contentType: file.type, fileName: file.name, folderKey }),
        });
        const j = await res.json().catch(() => null);
        if (alive && j?.ok) {
          setOcrExtractionId(j.ocrExtractionId ?? null);
          const sTitle = j.suggestion?.folderKey === folderKey ? j.suggestion?.titleKey : j.titleKey;
          if (sTitle && (findTitle(folderKey, sTitle) || sTitle === FREEHAND_TITLE_KEY)) setTitleKey(sTitle);
          if (j.prefill && typeof j.prefill === "object") {
            setPrefill(j.prefill as Prefill);
            setFields(Object.fromEntries(Object.entries(j.prefill as Prefill).map(([k, v]) => [k, v.value])));
          }
        }
      } catch {
        // OCR non-fatal
      } finally {
        if (alive) setOcrBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [file, folderKey]);

  const title = titleKey === FREEHAND_TITLE_KEY ? null : findTitle(folderKey, titleKey);
  const visiblePrompts = (title?.prompts ?? []).filter((p) => {
    if (!p.showWhen) return true;
    return p.showWhen.equals.includes(fields[p.showWhen.field] ?? "");
  });

  async function submit(confirmDuplicate = false) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matterId,
          matterDisplayNumber,
          folderKey,
          titleKey,
          freehandTitle: titleKey === FREEHAND_TITLE_KEY ? freehandTitle : undefined,
          fields,
          level: folder?.level,
          fileName: file.name,
          contentType: file.type,
          base64,
          ocrExtractionId,
          confirmDuplicate,
        }),
      });
      const j = await res.json().catch(() => null);
      if (j?.ok) {
        setMsg({ kind: "ok", text: `Filed as "${j.filed?.titleLabel}".` });
        setTimeout(onDone, 700);
      } else if (j?.duplicate) {
        setNeedsDupConfirm(true);
        setMsg({ kind: "warn", text: j.error || "This file is already filed on this matter." });
      } else {
        setMsg({ kind: "err", text: j?.error || "Upload failed." });
      }
    } catch {
      setMsg({ kind: "err", text: "Upload request failed." });
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = { padding: "6px 10px", border: "1px solid #cdd6e0", borderRadius: 6, fontSize: 13, width: "100%" };
  const label: React.CSSProperties = { display: "block", fontSize: 12, color: "#5a6b80", marginBottom: 3 };
  const btn = (bg: string): React.CSSProperties => ({ background: bg, color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", fontWeight: 800, fontSize: 13, cursor: "pointer" });

  const canSubmit = Boolean(base64 && titleKey && !busy && (titleKey !== FREEHAND_TITLE_KEY || freehandTitle.trim()));

  return (
    <div style={{ border: `1px solid ${NAVY}`, borderRadius: 10, padding: 14, background: "#f8fafc", marginBottom: 12 }}>
      <div style={{ fontWeight: 900, color: NAVY, marginBottom: 6 }}>File dropped document</div>
      <div style={{ fontSize: 12, color: "#385a83", marginBottom: 10 }}>
        <strong>{file.name}</strong> → folder <strong>{folder?.name}</strong>. Pick the title, then file it.
        {ocrBusy ? " Reading document (OCR)…" : ""}
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={label}>Title{folder?.allowFreehandOther ? " (or Other)" : ""}</label>
        <select value={titleKey} onChange={(e) => { setTitleKey(e.target.value); setFields({}); }} style={inputStyle}>
          {titleOptions.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
      </div>

      {titleKey === FREEHAND_TITLE_KEY && (
        <div style={{ marginBottom: 10 }}>
          <label style={label}>Custom title</label>
          <input value={freehandTitle} onChange={(e) => setFreehandTitle(e.target.value)} style={inputStyle} placeholder="Type a title" />
        </div>
      )}

      {visiblePrompts.map((p) => {
        const conf = prefill[p.key]?.confidence ?? null;
        const highlight: React.CSSProperties = conf == null ? {} : conf >= 0.5 ? { borderColor: "#137333", background: "#eefaf0" } : { borderColor: "#b8860b", background: "#fdf6e3" };
        return (
          <div key={p.key} style={{ marginBottom: 10 }}>
            <label style={label}>
              {p.label}{p.required ? " *" : ""}
              {conf != null && <span style={{ marginLeft: 6, color: conf >= 0.5 ? "#137333" : "#b8860b", fontSize: 11 }}>OCR {Math.round(conf * 100)}%</span>}
            </label>
            {p.type === "select" ? (
              <select value={fields[p.key] ?? ""} onChange={(e) => setFields((f) => ({ ...f, [p.key]: e.target.value }))} style={{ ...inputStyle, ...highlight }}>
                <option value="">— select —</option>
                {(p.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input value={fields[p.key] ?? ""} onChange={(e) => setFields((f) => ({ ...f, [p.key]: e.target.value }))} placeholder={p.type === "date" ? "MM/DD/YYYY" : p.type === "money" ? "0.00" : ""} style={{ ...inputStyle, ...highlight }} />
            )}
          </div>
        );
      })}

      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button onClick={() => void submit(needsDupConfirm)} disabled={!canSubmit} style={{ ...btn(NAVY), opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? "pointer" : "default" }}>
          {busy ? "Uploading…" : needsDupConfirm ? "Upload anyway" : "Upload to Clio & file"}
        </button>
        <button onClick={onCancel} disabled={busy} style={btn("#64748b")}>Cancel</button>
      </div>

      {msg && (
        <div style={{ marginTop: 10, fontSize: 13, color: msg.kind === "ok" ? "#137333" : msg.kind === "warn" ? "#b8860b" : "#b00020" }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
