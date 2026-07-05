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
import type { CaseType, MatterLevel } from "@/lib/documents/folderTaxonomy";

const NAVY = "#00346e";

function Inner() {
  const sp = useSearchParams();
  const [matterId, setMatterId] = useState(sp.get("matterId") || "");
  const [level, setLevel] = useState<MatterLevel | "all">((sp.get("level") as MatterLevel) || "matter");
  const [caseType, setCaseType] = useState<CaseType | "">((sp.get("caseType") as CaseType) || "");

  const idNum = Number(matterId);
  const valid = Number.isFinite(idNum) && idNum > 0;

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

        <div style={{ border: "1px solid #e3e9f0", borderRadius: 10, padding: 16, background: "#fff" }}>
          {valid ? (
            <FolderTree matterId={idNum} level={level} caseType={caseType || null} />
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
