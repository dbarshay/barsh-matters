"use client";

// Upload Docs — global intake: pick/drop a file → best-effort OCR prefill → pick the matter
// (by number or by patient/claim search) → confirm → folder/title/fields (OCR-prefilled with
// confidence highlighting) → upload to Clio (guarded live write) + record the BM filing.
//
// Clio is STORAGE ONLY; BM owns the file numbers. The live Clio write is gated by the shared
// storage guard flags — if they're off, the commit returns a clear "live Clio disabled" message
// and nothing is uploaded or recorded.

import React, { useMemo, useState } from "react";
import BarshHeader from "@/app/components/BarshHeader";
import {
  FREEHAND_TITLE_KEY,
  getFolder,
  findTitle,
  listTerminalFolders,
  type CaseType,
} from "@/lib/documents/folderTaxonomy";
import { normalizeCaseType, resolveFolderForCaseType } from "@/lib/documents/caseTypeRouting";

const CASE_TYPE_OPTIONS: { value: CaseType; label: string }[] = [
  { value: "no_fault", label: "No-Fault" },
  { value: "wc", label: "Workers' Comp" },
  { value: "arbitration", label: "Arbitration" },
];

const NAVY = "#00346e";

type MatterHit = {
  matterId: number;
  displayNumber: string | null;
  patientName: string | null;
  insurerName: string | null;
  providerName: string | null;
  caseType: string | null;
  dateOfLoss: string | null;
  finalStatus: string | null;
  stage: string | null;
};

type Prefill = Record<string, { value: string; confidence: number | null }>;

function folderPathLabel(key: string): string {
  const parts = key.split(".");
  const names: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const f = getFolder(parts.slice(0, i + 1).join("."));
    if (f) names.push(f.name);
  }
  return names.join(" › ");
}

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

export default function UploadDocsPage() {
  // Step 1 — file + OCR
  const [file, setFile] = useState<File | null>(null);
  const [base64, setBase64] = useState<string>("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrExtractionId, setOcrExtractionId] = useState<string | null>(null);
  const [ocrMeanConf, setOcrMeanConf] = useState<number | null>(null);
  const [suggested, setSuggested] = useState<{ folderKey?: string; titleKey?: string } | null>(null);
  const [prefill, setPrefill] = useState<Prefill>({});
  const [dragOver, setDragOver] = useState(false);
  // Learning signals captured at file-pick (sent on commit to build per-entity memory). Kept even if
  // the operator later overrides the folder, so we record the true suggestion-vs-choice.
  const [pickSuggestion, setPickSuggestion] = useState<{ folderKey?: string; titleKey?: string; confidence?: number } | null>(null);
  const [ocrProvider, setOcrProvider] = useState<string | null>(null);
  const [ocrInsurer, setOcrInsurer] = useState<string | null>(null);
  const [learnedNote, setLearnedNote] = useState<string | null>(null);
  const [predictedNote, setPredictedNote] = useState<string | null>(null);
  const [confirmPopulateLit, setConfirmPopulateLit] = useState(false);

  // Step 2 — matter
  const [q, setQ] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [hits, setHits] = useState<MatterHit[]>([]);
  const [searchMsg, setSearchMsg] = useState<string>("");
  const [matter, setMatter] = useState<MatterHit | null>(null);
  // Identity read off the document by OCR (used to auto-suggest the matter).
  const [ocrIdentity, setOcrIdentity] = useState<{ patientName?: string | null; claimNumber?: string | null } | null>(null);

  // Step 3 — folder/title/fields
  const folders = useMemo(() => listTerminalFolders(), []);
  const [folderKey, setFolderKey] = useState("");
  const [titleKey, setTitleKey] = useState("");
  const [freehandTitle, setFreehandTitle] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  // Case type drives WHICH folder a document type files into (e.g. a Bill on a Workers' Comp matter
  // goes to the Workers' Comp folder, not Claim Documents). Defaults from the matter; operator can override.
  const [caseType, setCaseType] = useState<CaseType | null>(null);
  const [routedNote, setRoutedNote] = useState<string | null>(null);

  // Commit
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "warn"; text: string } | null>(null);
  const [needsDupConfirm, setNeedsDupConfirm] = useState(false);

  const folder = getFolder(folderKey);
  const titleOptions = useMemo(() => {
    const f = getFolder(folderKey);
    const opts = (f?.titles ?? []).map((t) => ({ key: t.key, label: t.label }));
    if (f?.allowFreehandOther) opts.push({ key: FREEHAND_TITLE_KEY, label: "Other (freehand)" });
    return opts;
  }, [folderKey]);
  const title = titleKey === FREEHAND_TITLE_KEY ? null : findTitle(folderKey, titleKey);
  const visiblePrompts = (title?.prompts ?? []).filter((p) => {
    if (!p.showWhen) return true;
    return p.showWhen.equals.includes(fields[p.showWhen.field] ?? "");
  });

  async function onPickFile(f: File | null) {
    setMsg(null);
    setNeedsDupConfirm(false);
    if (!f) return;
    setFile(f);
    setOcrBusy(true);
    setOcrExtractionId(null);
    setSuggested(null);
    setPredictedNote(null);
    setConfirmPopulateLit(false);
    setPrefill({});
    try {
      const b64 = await fileToBase64(f);
      setBase64(b64);
      // Best-effort OCR prefill (never blocks the flow).
      const res = await fetch("/api/documents/ocr-prefill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64: b64, contentType: f.type, fileName: f.name }),
      });
      const j = await res.json().catch(() => null);
      if (j?.ok) {
        setOcrExtractionId(j.ocrExtractionId ?? null);
        setOcrMeanConf(typeof j.meanConfidence === "number" ? j.meanConfidence : null);
        setLearnedNote(j.learnedNote || null);
        setOcrProvider(j.identity?.providerName || null);
        setOcrInsurer(j.identity?.insurerName || null);
        const sFolder = j.suggestion?.folderKey || j.folderKey || "";
        const sTitle = j.suggestion?.titleKey || j.titleKey || "";
        setPickSuggestion(sFolder ? { folderKey: sFolder, titleKey: sTitle || undefined, confidence: j.suggestion?.confidence } : null);
        if (sFolder && getFolder(sFolder)?.terminal) {
          // Keep the original classifier output as the suggestion; route the shown folder by case type.
          setSuggested({ folderKey: sFolder, titleKey: sTitle || undefined });
          const r = resolveFolderForCaseType(sFolder, sTitle, caseType);
          setFolderKey(r.folderKey);
          const allowed = findTitle(r.folderKey, r.titleKey) || r.titleKey === FREEHAND_TITLE_KEY;
          setTitleKey(allowed ? r.titleKey : getFolder(r.folderKey)?.titles[0]?.key ?? "");
          setRoutedNote(
            r.remapped ? `Routed to ${folderPathLabel(r.folderKey)} based on Workers' Comp case type.` : null,
          );
        }
        if (j.prefill && typeof j.prefill === "object") {
          setPrefill(j.prefill as Prefill);
          setFields(
            Object.fromEntries(Object.entries(j.prefill as Prefill).map(([k, v]) => [k, v.value])),
          );
        }
        // Auto-suggest the matter from what OCR read off the document (patient, else claim #).
        const identity = j.identity || null;
        setOcrIdentity(identity);
        // Cross-reference: if a strong key (file/claim/index) predicted a single matter, auto-select it.
        const predicted = j.crossRef?.predictedMatterId
          ? (j.crossRef.matterCandidates || []).find((c: any) => c.matterId === j.crossRef.predictedMatterId)
          : null;
        if (!matter && predicted) {
          const hit: MatterHit = {
            matterId: predicted.matterId,
            displayNumber: predicted.displayNumber,
            patientName: predicted.patientName,
            insurerName: predicted.insurerName,
            providerName: predicted.providerName,
            caseType: predicted.caseType,
            dateOfLoss: null,
            finalStatus: null,
            stage: null,
          };
          setMatter(hit);
          applyCaseType(normalizeCaseType(predicted.caseType));
          setPredictedNote(`Auto-matched to ${predicted.displayNumber} by ${predicted.matchedOn}. Change if wrong.`);
        } else if (!matter) {
          // No confident prediction — pre-run a search on the strongest available key.
          const autoQuery = (identity?.bmFileNumber || identity?.claimNumber || identity?.patientName || "").trim();
          if (autoQuery.length >= 2) {
            setQ(autoQuery);
            void runSearch(autoQuery);
          }
        }
      }
    } catch {
      // OCR failure is non-fatal; operator fills manually.
    } finally {
      setOcrBusy(false);
    }
  }

  async function runSearch(queryOverride?: string) {
    const query = (queryOverride ?? q).trim();
    if (query.length < 2) {
      setSearchMsg("Enter at least 2 characters (matter number, patient name, or claim #).");
      return;
    }
    setSearchBusy(true);
    setSearchMsg("");
    setHits([]);
    try {
      const res = await fetch(`/api/documents/upload/matter-search?q=${encodeURIComponent(query)}`);
      const j = await res.json();
      if (j?.ok) {
        setHits(j.matters || []);
        if (!j.matters?.length) setSearchMsg("No matching matters.");
      } else {
        setSearchMsg(j?.error || "Search failed.");
      }
    } catch {
      setSearchMsg("Search request failed.");
    } finally {
      setSearchBusy(false);
    }
  }

  function changeFolder(k: string) {
    setFolderKey(k);
    const f = getFolder(k);
    const first = f?.titles[0]?.key ?? (f?.allowFreehandOther ? FREEHAND_TITLE_KEY : "");
    setTitleKey(first);
    setFields({});
    setFreehandTitle("");
    setPrefill({});
    // Operator took manual control of the folder — stop auto-routing from the OCR suggestion.
    setSuggested(null);
    setRoutedNote(null);
  }

  // Set the case type and re-route the OCR suggestion to the case-type-correct folder (WC → Workers'
  // Comp). Re-derives from the original classifier suggestion so switching case type is reversible.
  // No effect once the operator has manually picked a folder (suggested cleared).
  function applyCaseType(ct: CaseType | null) {
    setCaseType(ct);
    if (!suggested?.folderKey) {
      setRoutedNote(null);
      return;
    }
    const r = resolveFolderForCaseType(suggested.folderKey, suggested.titleKey ?? "", ct);
    setFolderKey(r.folderKey);
    const allowed = findTitle(r.folderKey, r.titleKey) || r.titleKey === FREEHAND_TITLE_KEY;
    setTitleKey(allowed ? r.titleKey : getFolder(r.folderKey)?.titles[0]?.key ?? "");
    setFields({});
    setRoutedNote(
      r.remapped ? `Routed to ${folderPathLabel(r.folderKey)} based on Workers' Comp case type.` : null,
    );
  }

  async function commit(confirmDuplicate = false) {
    if (!matter || !file) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matterId: matter.matterId,
          matterDisplayNumber: matter.displayNumber,
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
          // Learning signals: the suggestion shown + matched entities + case type, so the app can
          // record suggestion-vs-choice and build per-provider/carrier memory.
          suggestedFolderKey: pickSuggestion?.folderKey ?? null,
          suggestedTitleKey: pickSuggestion?.titleKey ?? null,
          suggestedConfidence: pickSuggestion?.confidence ?? null,
          providerName: ocrProvider,
          insurerName: ocrInsurer,
          caseType,
          // Litigation fields — server populates the lawsuit's Date Filed / Index Number only if blank,
          // and ONLY when the operator checked the box below.
          indexNumber: (ocrIdentity as any)?.indexNumber ?? null,
          dateFiled: (ocrIdentity as any)?.dateFiled ?? null,
          confirmPopulateLitigation: confirmPopulateLit,
        }),
      });
      const j = await res.json().catch(() => null);
      if (j?.ok) {
        setMsg({
          kind: "ok",
          text: `Uploaded and filed as "${j.filed?.titleLabel}" on ${j.matterDisplayNumber}.`,
        });
        setNeedsDupConfirm(false);
        // Reset the file for a fresh upload; keep the matter selected for multi-file runs.
        setFile(null);
        setBase64("");
        setOcrExtractionId(null);
        setPrefill({});
        setFields({});
        setFreehandTitle("");
        setPickSuggestion(null);
        setOcrProvider(null);
        setOcrInsurer(null);
        setLearnedNote(null);
        setConfirmPopulateLit(false);
      } else if (j?.duplicate) {
        setNeedsDupConfirm(true);
        setMsg({ kind: "warn", text: j.error || "This file is already filed on this matter." });
      } else if (j?.clioWriteDisabled) {
        setMsg({ kind: "err", text: j.error });
      } else {
        setMsg({ kind: "err", text: j?.error || "Upload failed." });
      }
    } catch {
      setMsg({ kind: "err", text: "Upload request failed." });
    } finally {
      setBusy(false);
    }
  }

  // ---- styles ----
  const card: React.CSSProperties = {
    border: "1px solid #e3e9f0",
    borderRadius: 10,
    padding: 16,
    background: "#fff",
    marginBottom: 16,
  };
  const inputStyle: React.CSSProperties = {
    padding: "6px 10px",
    border: "1px solid #cdd6e0",
    borderRadius: 6,
    fontSize: 13,
    width: "100%",
  };
  const label: React.CSSProperties = { display: "block", fontSize: 12, color: "#5a6b80", marginBottom: 3 };
  const stepNum: React.CSSProperties = {
    display: "inline-flex",
    width: 22,
    height: 22,
    borderRadius: 999,
    background: NAVY,
    color: "#fff",
    fontSize: 12,
    fontWeight: 900,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  };
  const btn = (bg: string): React.CSSProperties => ({
    background: bg,
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "8px 16px",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
  });

  const canCommit = Boolean(matter && file && folderKey && titleKey && !busy);

  return (
    <div>
      <BarshHeader center={<span style={{ fontWeight: 900, fontSize: 18 }}>Upload Documents</span>} />
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "16px 20px 60px" }}>
        {/* Step 1 — file */}
        <div style={card}>
          <div style={{ fontWeight: 900, color: NAVY, marginBottom: 10 }}>
            <span style={stepNum}>1</span>Choose a document
          </div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void onPickFile(f);
            }}
            style={{
              border: `2px dashed ${dragOver ? NAVY : "#cdd6e0"}`,
              borderRadius: 10,
              padding: "26px 16px",
              textAlign: "center",
              background: dragOver ? "#eef4fb" : "#f8fafc",
            }}
          >
            <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10 }}>
              {file ? `File selected: ${file.name}` : "Drag & Drop or Pick File"}
            </div>
            {!file && (
              <label style={{ ...btn(NAVY), display: "inline-block", cursor: "pointer" }}>
                Choose File
                <input
                  type="file"
                  style={{ display: "none" }}
                  onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
            {file && (
              <button
                onClick={() => {
                  setFile(null);
                  setBase64("");
                  setOcrExtractionId(null);
                  setPrefill({});
                  setMsg(null);
                  setPickSuggestion(null);
                  setOcrProvider(null);
                  setOcrInsurer(null);
                  setLearnedNote(null);
                }}
                style={{ ...btn("#64748b"), marginTop: 4 }}
              >
                Clear file
              </button>
            )}
          </div>
          {ocrBusy && <div style={{ marginTop: 10, fontSize: 12, color: "#5a6b80" }}>Reading document (OCR)…</div>}
          {!ocrBusy && ocrExtractionId && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#137333" }}>
              OCR complete{ocrMeanConf != null ? ` (mean confidence ${Math.round(ocrMeanConf * 100)}%)` : ""}.
              {suggested?.folderKey ? " Suggested folder/title pre-selected below." : " No confident folder suggestion — pick one below."} Highlighted fields are OCR-filled — verify them.
            </div>
          )}
          {!ocrBusy && learnedNote && (
            <div style={{ marginTop: 6, fontSize: 12, color: "#00346e", fontWeight: 700 }}>
              ⓘ {learnedNote}
            </div>
          )}
        </div>

        {/* Step 2 — matter */}
        <div style={card}>
          <div style={{ fontWeight: 900, color: NAVY, marginBottom: 10 }}>
            <span style={stepNum}>2</span>Pick the matter
          </div>
          {!matter && (ocrIdentity?.patientName || ocrIdentity?.claimNumber) && (
            <div style={{ marginBottom: 8, fontSize: 12, color: "#137333" }}>
              Read from the document:{ocrIdentity?.patientName ? ` patient "${ocrIdentity.patientName}"` : ""}
              {ocrIdentity?.claimNumber ? `${ocrIdentity?.patientName ? "," : ""} claim ${ocrIdentity.claimNumber}` : ""} — matches below (confirm the right one).
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runSearch();
              }}
              placeholder="Matter number (BRL_…), patient name, or claim #"
              style={inputStyle}
            />
            <button onClick={() => void runSearch()} disabled={searchBusy} style={btn(NAVY)}>
              {searchBusy ? "Searching…" : "Search"}
            </button>
          </div>
          {searchMsg && <div style={{ marginTop: 8, fontSize: 12, color: "#b00020" }}>{searchMsg}</div>}
          {hits.length > 0 && (
            <div style={{ marginTop: 10, border: "1px solid #e3e9f0", borderRadius: 8, overflow: "hidden" }}>
              {hits.map((h) => (
                <button
                  key={h.matterId}
                  onClick={() => {
                    setMatter(h);
                    setHits([]);
                    setQ(h.displayNumber || "");
                    applyCaseType(normalizeCaseType(h.caseType));
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 12px",
                    border: "none",
                    borderBottom: "1px solid #eef2f7",
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  <strong style={{ color: NAVY }}>{h.displayNumber}</strong> — {h.patientName || "—"}
                  <span style={{ color: "#5a6b80" }}>
                    {" "}
                    · {h.insurerName || "no insurer"} · {h.caseType || "no case type"}
                    {h.dateOfLoss ? ` · D/L ${h.dateOfLoss}` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
          {matter && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "#eef4fb", border: "1px solid #cfe0f5" }}>
              {predictedNote && (
                <div style={{ fontSize: 12, color: "#137333", fontWeight: 700, marginBottom: 4 }}>✓ {predictedNote}</div>
              )}
              <div style={{ fontSize: 12, color: "#5a6b80", marginBottom: 2 }}>Filing to:</div>
              <div style={{ fontWeight: 900, color: NAVY }}>{matter.displayNumber}</div>
              <div style={{ fontSize: 13 }}>
                {matter.patientName || "—"} · {matter.insurerName || "no insurer"} ·{" "}
                {matter.caseType || "no case type"}
                {matter.dateOfLoss ? ` · D/L ${matter.dateOfLoss}` : ""}
              </div>
              <button onClick={() => { setMatter(null); setPredictedNote(null); }} style={{ ...btn("#64748b"), marginTop: 8 }}>
                Change matter
              </button>
            </div>
          )}
        </div>

        {/* Step 3 — folder/title/fields */}
        <div style={{ ...card, opacity: matter && file ? 1 : 0.5, pointerEvents: matter && file ? "auto" : "none" }}>
          <div style={{ fontWeight: 900, color: NAVY, marginBottom: 10 }}>
            <span style={stepNum}>3</span>File it
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={label}>Case type</label>
            <select
              value={caseType ?? ""}
              onChange={(e) => applyCaseType((e.target.value || null) as CaseType | null)}
              style={inputStyle}
            >
              <option value="">— select case type —</option>
              {CASE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: "#5a6b80", marginTop: 3 }}>
              Defaults from the matter. Workers' Comp routes bills, letters, and reports to the Workers' Comp folder.
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={label}>Folder</label>
            <select value={folderKey} onChange={(e) => changeFolder(e.target.value)} style={inputStyle}>
              <option value="">— select a folder —</option>
              {folders.map((f) => (
                <option key={f.key} value={f.key}>
                  {folderPathLabel(f.key)}
                </option>
              ))}
            </select>
            {routedNote && (
              <div style={{ fontSize: 11, color: "#137333", marginTop: 3 }}>{routedNote}</div>
            )}
          </div>

          {folderKey && (
            <div style={{ marginBottom: 10 }}>
              <label style={label}>Title{folder?.allowFreehandOther ? " (or Other)" : ""}</label>
              <select value={titleKey} onChange={(e) => { setTitleKey(e.target.value); setFields({}); }} style={inputStyle}>
                {titleOptions.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {titleKey === FREEHAND_TITLE_KEY && (
            <div style={{ marginBottom: 10 }}>
              <label style={label}>Custom title</label>
              <input value={freehandTitle} onChange={(e) => setFreehandTitle(e.target.value)} style={inputStyle} placeholder="Type a title" />
            </div>
          )}

          {visiblePrompts.map((p) => {
            const conf = prefill[p.key]?.confidence ?? null;
            const highlight: React.CSSProperties =
              conf == null
                ? {}
                : conf >= 0.5
                  ? { borderColor: "#137333", background: "#eefaf0" }
                  : { borderColor: "#b8860b", background: "#fdf6e3" };
            return (
              <div key={p.key} style={{ marginBottom: 10 }}>
                <label style={label}>
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

          {matter && ((ocrIdentity as any)?.indexNumber || (ocrIdentity as any)?.dateFiled) && (
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 4, marginBottom: 8, fontSize: 12, color: "#5a6b80", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={confirmPopulateLit}
                onChange={(e) => setConfirmPopulateLit(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span>
                Update this lawsuit’s litigation fields from the document
                {(ocrIdentity as any)?.indexNumber ? ` — Index No. ${(ocrIdentity as any).indexNumber}` : ""}
                {(ocrIdentity as any)?.dateFiled ? `${(ocrIdentity as any)?.indexNumber ? "," : " —"} Date Filed ${(ocrIdentity as any).dateFiled}` : ""}
                . Only fills fields that are currently blank; never overwrites.
              </span>
            </label>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
            <button onClick={() => void commit(needsDupConfirm)} disabled={!canCommit} style={{ ...btn(NAVY), opacity: canCommit ? 1 : 0.5, cursor: canCommit ? "pointer" : "default" }}>
              {busy ? "Uploading…" : needsDupConfirm ? "Upload anyway" : "Upload"}
            </button>
          </div>

          {msg && (
            <div
              style={{
                marginTop: 12,
                fontSize: 13,
                color: msg.kind === "ok" ? "#137333" : msg.kind === "warn" ? "#b8860b" : "#b00020",
              }}
            >
              {msg.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
