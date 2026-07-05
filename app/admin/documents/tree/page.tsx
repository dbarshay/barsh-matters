"use client";

// Phase 2 viewer for the read-only View Documents tree. Standalone so we can exercise the tree
// without touching the large matter page; wiring it into the matter's View Documents popup is a
// follow-up. Pick a matter id + level; the tree loads that matter's filed documents.
//
//   /admin/documents/tree?matterId=123&level=matter&caseType=no_fault

import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import BarshHeader from "@/app/components/BarshHeader";
import FolderTree from "@/components/documents/FolderTree";
import FileDocumentForm from "@/components/documents/FileDocumentForm";
import type { CaseType, MatterLevel } from "@/lib/documents/folderTaxonomy";

const NAVY = "#00346e";

function Inner() {
  const sp = useSearchParams();
  const [matterId, setMatterId] = useState(sp.get("matterId") || "");
  const [level, setLevel] = useState<MatterLevel | "all">((sp.get("level") as MatterLevel) || "matter");
  const [caseType, setCaseType] = useState<CaseType | "">((sp.get("caseType") as CaseType) || "");

  const [reloadKey, setReloadKey] = useState(0);
  const [formKey, setFormKey] = useState(0);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [drop, setDrop] = useState<{
    folderKey: string;
    titleKey?: string;
    fileName?: string;
    contentType?: string;
    prefill?: Record<string, { value: string; confidence: number | null }>;
    ocrExtractionId?: string;
    fileHash?: string;
  } | null>(null);
  const idNum = Number(matterId);
  const valid = Number.isFinite(idNum) && idNum > 0;
  const formLevel: MatterLevel = level === "lawsuit" ? "lawsuit" : "matter";

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result);
        resolve(s.slice(s.indexOf(",") + 1));
      };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async function handleDrop(folderKey: string, files: File[]) {
    const f = files[0];
    if (!f) return;
    // Show the folder immediately, then run OCR to prefill.
    setDrop({ folderKey, fileName: f.name, contentType: f.type || undefined });
    setFormKey((k) => k + 1);
    setOcrBusy(true);
    try {
      const base64 = await fileToBase64(f);
      const res = await fetch("/api/documents/ocr-prefill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, contentType: f.type, fileName: f.name, folderKey, matterId: idNum }),
      });
      const j = await res.json();
      if (j?.ok) {
        setDrop({
          folderKey: j.folderKey || folderKey,
          titleKey: j.titleKey || undefined,
          fileName: f.name,
          contentType: f.type || undefined,
          prefill: j.prefill,
          ocrExtractionId: j.ocrExtractionId,
          fileHash: j.fileHash,
        });
        setFormKey((k) => k + 1); // remount form with OCR prefill
      }
    } catch {
      // Leave the folder pre-selected; operator fills manually.
    } finally {
      setOcrBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: "6px 10px",
    border: "1px solid #cdd6e0",
    borderRadius: 6,
    fontSize: 13,
  };

  return (
    <div>
      <BarshHeader />
      <div style={{ maxWidth: 760, margin: "20px auto", padding: "0 16px" }}>
        <h1 style={{ color: NAVY, fontSize: 20, marginBottom: 4 }}>Documents — folder tree (Phase 2)</h1>
        <p style={{ color: "#5a6b80", fontSize: 13, marginTop: 0 }}>
          Read-only preview of the BM document folder tree for a matter. Filing/moving comes in Phase 3.
        </p>

        <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "14px 0 18px" }}>
          <input
            value={matterId}
            onChange={(e) => setMatterId(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="matterId (e.g. 123)"
            style={{ ...inputStyle, width: 160 }}
          />
          <select value={level} onChange={(e) => setLevel(e.target.value as MatterLevel | "all")} style={inputStyle}>
            <option value="matter">matter-level</option>
            <option value="lawsuit">lawsuit-level</option>
            <option value="all">all</option>
          </select>
          <select value={caseType} onChange={(e) => setCaseType(e.target.value as CaseType | "")} style={inputStyle}>
            <option value="">no greying</option>
            <option value="no_fault">no_fault</option>
            <option value="wc">wc</option>
            <option value="arbitration">arbitration</option>
          </select>
        </div>

        {valid && ocrBusy && (
          <div style={{ marginBottom: 10, fontSize: 13, color: NAVY }}>Running OCR on the dropped file…</div>
        )}

        {valid && (
          <FileDocumentForm
            key={formKey}
            matterId={idNum}
            level={formLevel}
            presetFolderKey={drop?.folderKey}
            presetTitleKey={drop?.titleKey}
            presetFileName={drop?.fileName}
            presetContentType={drop?.contentType}
            presetFields={drop?.prefill}
            presetOcrExtractionId={drop?.ocrExtractionId}
            presetFileHash={drop?.fileHash}
            onFiled={() => setReloadKey((k) => k + 1)}
          />
        )}

        <div style={{ border: "1px solid #e3e9f0", borderRadius: 10, padding: 16, background: "#fff" }}>
          {valid ? (
            <div>
              <div style={{ fontSize: 12, color: "#8a97a8", marginBottom: 8 }}>
                Tip: drag a file from your desktop onto a folder below to file it there.
              </div>
              <FolderTree
                matterId={idNum}
                level={level}
                caseType={caseType || null}
                reloadKey={reloadKey}
                onDropToFolder={handleDrop}
              />
            </div>
          ) : (
            <div style={{ color: "#8a97a8", fontStyle: "italic" }}>Enter a matter id to load its tree.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DocumentsTreePage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
      <Inner />
    </Suspense>
  );
}
