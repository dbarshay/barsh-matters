"use client";

// Read-only View Documents tree (Phase 2). Renders the fixed folder taxonomy for a matter,
// maps filed documents into their folders, shows rolled-up count badges, greys empty +
// case-type-irrelevant folders (never hides them), and offers a flat searchable list. It does NOT
// file/move/delete — that's Phase 3. Title labels are decoupled from the stored filename.

import React, { useEffect, useMemo, useState } from "react";

import {
  FOLDER_TAXONOMY,
  folderAppliesToCaseType,
  type CaseType,
  type FolderSpec,
  type MatterLevel,
} from "@/lib/documents/folderTaxonomy";

const NAVY = "#00346e";
const MUTED = "#8a97a8";

export type FiledDoc = {
  id: string;
  folderKey: string;
  titleKey: string;
  titleLabel: string;
  level: string;
  clioDocumentId: string;
  fileName: string | null;
  sourceType: string;
  createdAt: string;
};

type Props = {
  matterId: number;
  /** "matter" shows Claim Documents + Workers' Comp; "lawsuit" shows Arbitration + Litigation. */
  level?: MatterLevel | "all";
  /** When set, folders irrelevant to this case type AND empty are greyed (still visible). */
  caseType?: CaseType | null;
};

/** All descendant terminal folder keys of a folder (or itself if terminal). */
function terminalKeysUnder(f: FolderSpec): string[] {
  if (f.terminal) return [f.key];
  return (f.children ?? []).flatMap(terminalKeysUnder);
}

export default function FolderTree({ matterId, level = "all", caseType = null }: Props) {
  const [docs, setDocs] = useState<FiledDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flat, setFlat] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    setDocs(null);
    setError(null);
    const url =
      `/api/documents/filed?matterId=${encodeURIComponent(matterId)}` +
      (level !== "all" ? `&level=${level}` : "");
    fetch(url, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.ok) setDocs(j.documents as FiledDoc[]);
        else setError(j?.error || "Failed to load documents.");
      })
      .catch(() => alive && setError("Failed to load documents."));
    return () => {
      alive = false;
    };
  }, [matterId, level]);

  const branches = useMemo(
    () => FOLDER_TAXONOMY.filter((b) => level === "all" || b.level === level),
    [level],
  );

  // docs grouped by folderKey, and rolled-up counts per folder key (terminal + ancestors).
  const { byFolder, countFor } = useMemo(() => {
    const byFolder = new Map<string, FiledDoc[]>();
    for (const d of docs ?? []) {
      const arr = byFolder.get(d.folderKey) ?? [];
      arr.push(d);
      byFolder.set(d.folderKey, arr);
    }
    const countFor = (f: FolderSpec): number =>
      terminalKeysUnder(f).reduce((sum, k) => sum + (byFolder.get(k)?.length ?? 0), 0);
    return { byFolder, countFor };
  }, [docs]);

  if (error) return <div style={{ color: "#b00020", padding: 12 }}>{error}</div>;
  if (docs === null) return <div style={{ color: MUTED, padding: 12 }}>Loading documents…</div>;

  const total = docs.length;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", color: "#1b2a3d" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <strong style={{ color: NAVY, fontSize: 15 }}>View Documents</strong>
        <span style={{ color: MUTED, fontSize: 13 }}>{total} filed</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setFlat((v) => !v)}
          style={{
            border: `1px solid ${NAVY}`,
            background: flat ? NAVY : "#fff",
            color: flat ? "#fff" : NAVY,
            borderRadius: 6,
            padding: "4px 10px",
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          {flat ? "Tree view" : "Flat list"}
        </button>
      </div>

      {flat ? (
        <FlatList docs={docs} query={query} setQuery={setQuery} />
      ) : (
        <div>
          {branches.map((b) => (
            <FolderNode
              key={b.key}
              folder={b}
              depth={0}
              byFolder={byFolder}
              countFor={countFor}
              caseType={caseType}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FolderNode({
  folder,
  depth,
  byFolder,
  countFor,
  caseType,
}: {
  folder: FolderSpec;
  depth: number;
  byFolder: Map<string, FiledDoc[]>;
  countFor: (f: FolderSpec) => number;
  caseType: CaseType | null;
}) {
  const count = countFor(folder);
  const irrelevant = caseType != null && !folderAppliesToCaseType(folder.key, caseType);
  const greyed = irrelevant && count === 0; // grey only when irrelevant AND empty (never hide)
  const [open, setOpen] = useState(count > 0 || depth === 0);

  const hasChildren = !!(folder.children && folder.children.length);
  const docsHere = folder.terminal ? byFolder.get(folder.key) ?? [] : [];

  return (
    <div style={{ marginLeft: depth * 16, opacity: greyed ? 0.45 : 1 }}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 0",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <span style={{ width: 12, color: MUTED, fontSize: 11 }}>{open ? "▾" : "▸"}</span>
        <span style={{ fontWeight: depth === 0 ? 800 : 600, color: depth === 0 ? NAVY : "#26364a" }}>
          {folder.name}
        </span>
        {count > 0 && (
          <span
            style={{
              background: NAVY,
              color: "#fff",
              borderRadius: 10,
              padding: "0 7px",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {count}
          </span>
        )}
        {folder.allowFreehandOther && (
          <span style={{ color: MUTED, fontSize: 10 }}>+Other</span>
        )}
      </div>

      {open && (
        <div>
          {hasChildren &&
            folder.children!.map((c) => (
              <FolderNode
                key={c.key}
                folder={c}
                depth={depth + 1}
                byFolder={byFolder}
                countFor={countFor}
                caseType={caseType}
              />
            ))}
          {folder.terminal &&
            (docsHere.length > 0 ? (
              docsHere.map((d) => (
                <div
                  key={d.id}
                  style={{ marginLeft: (depth + 1) * 16 + 18, padding: "2px 0", fontSize: 13 }}
                >
                  📄 {d.titleLabel}
                  <span style={{ color: MUTED, fontSize: 11, marginLeft: 8 }}>
                    {new Date(d.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))
            ) : (
              <div
                style={{
                  marginLeft: (depth + 1) * 16 + 18,
                  padding: "2px 0",
                  fontSize: 12,
                  color: MUTED,
                  fontStyle: "italic",
                }}
              >
                (empty)
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function FlatList({
  docs,
  query,
  setQuery,
}: {
  docs: FiledDoc[];
  query: string;
  setQuery: (v: string) => void;
}) {
  const filtered = docs.filter((d) =>
    query.trim() === "" ? true : d.titleLabel.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search titles…"
        style={{
          width: "100%",
          padding: "6px 10px",
          border: "1px solid #cdd6e0",
          borderRadius: 6,
          marginBottom: 8,
          fontSize: 13,
        }}
      />
      {filtered.length === 0 ? (
        <div style={{ color: MUTED, fontStyle: "italic", padding: 8 }}>No matching documents.</div>
      ) : (
        filtered.map((d) => (
          <div key={d.id} style={{ padding: "3px 0", fontSize: 13, borderBottom: "1px solid #eef2f6" }}>
            📄 {d.titleLabel}
            <span style={{ color: MUTED, fontSize: 11, marginLeft: 8 }}>{d.folderKey}</span>
          </div>
        ))
      )}
    </div>
  );
}
