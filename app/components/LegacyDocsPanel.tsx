"use client";

// Per-matter "Legacy Docs" panel. Reads the migrated LawSpades documents for this matter (grouped by their
// original folder — BILLS, MEDICAL REPORTS, …) and opens each file from Azure via a short-lived SAS link.
// Self-contained; drop <LegacyDocsPanel matterId={...} /> anywhere on the matter page.
import React from "react";

type LegacyFile = { id: string; fileName: string; byteSize: number | null };
type LegacyFolder = { folder: string; files: LegacyFile[] };

const NAVY = "#00346e";
const MUTED = "#385a83";

export default function LegacyDocsPanel({ matterId, actorName }: { matterId: number | string; actorName?: string }) {
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");
  const [caseId, setCaseId] = React.useState<string | null>(null);
  const [folders, setFolders] = React.useState<LegacyFolder[]>([]);
  const [total, setTotal] = React.useState(0);
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const [opening, setOpening] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const r = await fetch(`/api/matters/legacy-docs?matterId=${encodeURIComponent(String(matterId))}`, { cache: "no-store" });
        const d = await r.json();
        if (!d.ok) throw new Error(d.error || "Failed to load legacy documents.");
        if (cancelled) return;
        setCaseId(d.caseId ?? null);
        setFolders(d.folders || []);
        setTotal(d.totalFiles || 0);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matterId]);

  async function openFile(id: string) {
    setOpening(id);
    setErr("");
    try {
      const r = await fetch(`/api/matters/legacy-docs/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: id, actorName: actorName || null }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Could not open document.");
      window.open(d.url, "_blank", "noopener");
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setOpening("");
    }
  }

  const fmtSize = (b: number | null) =>
    b == null ? "" : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

  // Not a legacy matter (no LawSpades Case_Id and nothing stored) → render nothing, so normal matters
  // never show an empty panel.
  if (!loading && !err && !caseId && total === 0) return null;

  const card: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 8px 22px rgba(15,23,42,.05)",
  };

  return (
    <section style={card} data-legacy-docs-panel="true">
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
        <span style={{ fontWeight: 950, color: NAVY, fontSize: 16 }}>Legacy Docs</span>
        {caseId && <span style={{ color: MUTED, fontSize: 13 }}>from LawSpades file {caseId}</span>}
        {!loading && !err && <span style={{ color: MUTED, fontSize: 13, marginLeft: "auto" }}>{total} file{total === 1 ? "" : "s"}</span>}
      </div>

      {loading && <div style={{ color: MUTED }}>Loading…</div>}
      {err && <div style={{ color: "#b91c1c", fontWeight: 700 }}>{err}</div>}
      {!loading && !err && total === 0 && (
        <div style={{ color: MUTED }}>
          No legacy documents{caseId ? "" : " — this matter has no legacy file number"}.{" "}
          {caseId && "They may still be migrating; check back shortly."}
        </div>
      )}

      {!loading && !err && folders.length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          {folders.map((f) => {
            const isOpen = open[f.folder] ?? false;
            return (
              <div key={f.folder} style={{ border: "1px solid #eef2f7", borderRadius: 10, overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [f.folder]: !isOpen }))}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: "#f8fafc",
                    border: "none",
                    padding: "9px 12px",
                    cursor: "pointer",
                    fontWeight: 800,
                    color: NAVY,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .12s", color: MUTED }}>▶</span>
                  {f.folder}
                  <span style={{ marginLeft: "auto", color: MUTED, fontWeight: 700, fontSize: 12 }}>{f.files.length}</span>
                </button>
                {isOpen && (
                  <div style={{ padding: "4px 8px 8px" }}>
                    {f.files.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => openFile(file.id)}
                        disabled={opening === file.id}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          background: "none",
                          border: "none",
                          padding: "6px 8px",
                          borderRadius: 8,
                          cursor: "pointer",
                          color: "#1d4ed8",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 14,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                      >
                        <span aria-hidden>📄</span>
                        <span style={{ textDecoration: "underline" }}>{file.fileName}</span>
                        {opening === file.id && <span style={{ color: MUTED, fontSize: 12 }}>opening…</span>}
                        <span style={{ marginLeft: "auto", color: MUTED, fontSize: 12 }}>{fmtSize(file.byteSize)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
