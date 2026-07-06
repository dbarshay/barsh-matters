"use client";

// Lawsuit-level document view: the lawsuit's own filed documents (Arbitration / Litigation) PLUS a
// folder per child matter, so the user can reach a child matter's documents without navigating into
// that individual matter. Each child folder expands to that matter's own FolderTree.

import React, { useEffect, useState } from "react";
import FolderTree, { type FiledDoc } from "@/components/documents/FolderTree";

const NAVY = "#00346e";
const MUTED = "#8a97a8";

type ChildMatter = { matterId: number; displayNumber: string | null; patientName: string | null };

export default function LawsuitDocuments({
  masterLawsuitId,
  reloadKey = 0,
  onOpenDoc,
  onRemoveDoc,
}: {
  masterLawsuitId: string;
  reloadKey?: number;
  onOpenDoc?: (doc: FiledDoc) => void;
  onRemoveDoc?: (doc: FiledDoc) => void;
}) {
  const [children, setChildren] = useState<ChildMatter[] | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let alive = true;
    setChildren(null);
    fetch(`/api/claim-index/by-master?masterLawsuitId=${encodeURIComponent(masterLawsuitId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        const rows = Array.isArray(j?.rows) ? j.rows : [];
        setChildren(
          rows.map((r: any) => ({
            matterId: Number(r.matter_id),
            displayNumber: r.display_number ?? null,
            patientName: r.patient_name ?? null,
          })),
        );
      })
      .catch(() => alive && setChildren([]));
    return () => {
      alive = false;
    };
  }, [masterLawsuitId]);

  return (
    <div>
      {/* The lawsuit's own filed documents. */}
      <div style={{ marginBottom: 14 }}>
        <FolderTree
          matterId={0}
          masterLawsuitId={masterLawsuitId}
          level="lawsuit"
          reloadKey={reloadKey}
          onOpenDoc={onOpenDoc}
          onRemoveDoc={onRemoveDoc}
        />
      </div>

      {/* Child matters — each a folder that opens that matter's documents in place. */}
      <div style={{ borderTop: "1px solid #e3e9f0", paddingTop: 12 }}>
        <div style={{ fontWeight: 900, color: NAVY, marginBottom: 8 }}>Child matters</div>
        {children === null ? (
          <div style={{ color: MUTED, fontSize: 13 }}>Loading child matters…</div>
        ) : children.length === 0 ? (
          <div style={{ color: MUTED, fontSize: 13, fontStyle: "italic" }}>No child matters on this lawsuit.</div>
        ) : (
          children.map((c) => {
            const open = !!expanded[c.matterId];
            return (
              <div key={c.matterId} style={{ marginBottom: 6, border: "1px solid #eef2f7", borderRadius: 8 }}>
                <div
                  onClick={() => setExpanded((e) => ({ ...e, [c.matterId]: !e[c.matterId] }))}
                  style={{ cursor: "pointer", padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: NAVY }}
                >
                  <span style={{ width: 12, color: MUTED, fontSize: 11 }}>{open ? "▾" : "▸"}</span>
                  <span>📁 {c.displayNumber || `Matter ${c.matterId}`}</span>
                  {c.patientName && <span style={{ color: MUTED, fontWeight: 400, fontSize: 12 }}>· {c.patientName}</span>}
                </div>
                {open && (
                  <div style={{ padding: "2px 12px 10px" }}>
                    <FolderTree
                      matterId={c.matterId}
                      matterDisplayNumber={c.displayNumber}
                      level="matter"
                      reloadKey={reloadKey}
                      onOpenDoc={onOpenDoc}
                      onRemoveDoc={onRemoveDoc}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
