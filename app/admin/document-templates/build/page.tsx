"use client";

import { useMemo, useState } from "react";
import {
  TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS,
  TEMPLATE_BUILDER_SUPPORTED_FORMAT_MODIFIERS,
} from "@/src/lib/templates/template-builder-merge-field-library";

type SortKey = "category" | "fieldLabel" | "mergeField" | "exampleOutput";
type SortDirection = "asc" | "desc";

function categoryLabel(field: { category: string; subcategory?: string }) {
  return field.subcategory ? field.category + " → " + field.subcategory : field.category;
}

function sortValue(field: any, sortKey: SortKey) {
  if (sortKey === "category") return categoryLabel(field);
  return String(field[sortKey] || "");
}

function sortIndicator(active: boolean, direction: SortDirection) {
  if (!active) return "↕";
  return direction === "asc" ? "↑" : "↓";
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="8" width="10" height="10" rx="2" />
      <path d="M6 14H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 15h10l1-15" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function formatLabel(value: string) {
  if (value === "date:MM/DD/YYYY") return "date:MM/DD/YYYY";
  if (value === "date:Month D, YYYY") return "date:Month D, YYYY";
  return value;
}

export default function BuildTemplatePage() {
  const [query, setQuery] = useState("");
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [exampleMatter, setExampleMatter] = useState("BRL_202600003");
  const [sortKey, setSortKey] = useState<SortKey>("category");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [copiedToken, setCopiedToken] = useState("");
  const [deletedTokens, setDeletedTokens] = useState<string[]>([]);
  const [deleteCandidate, setDeleteCandidate] = useState<any | null>(null);

  const availableFields = useMemo(() => {
    return TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS.filter((field) => !deletedTokens.includes(field.mergeField));
  }, [deletedTokens]);

  const visibleFields = useMemo(() => {
    const q = query.trim().toLowerCase();
    const searched = availableFields.filter((field) => {
      if (q.length === 0) return true;
      return [
        field.category,
        field.subcategory || "",
        field.fieldLabel,
        field.mergeField,
        field.exampleOutput,
        field.aliases.join(" "),
        field.fieldType,
        field.kind,
      ].join(" ").toLowerCase().includes(q);
    });

    return [...searched].sort((a, b) => {
      const left = sortValue(a, sortKey).toLowerCase();
      const right = sortValue(b, sortKey).toLowerCase();
      const result = left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
      return sortDirection === "asc" ? result : -result;
    });
  }, [availableFields, query, sortKey, sortDirection]);

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }

    setSortKey(nextKey);
    setSortDirection("asc");
  }

  function toggleFormat(format: string) {
    setSelectedFormats((current) => {
      if (current.includes(format)) return current.filter((item) => item !== format);

      const next = [...current, format];
      if (format.startsWith("date:")) {
        return next.filter((item) => !item.startsWith("date:") || item === format);
      }

      if (["upper", "lower", "title"].includes(format)) {
        return next.filter((item) => !["upper", "lower", "title"].includes(item) || item === format);
      }

      return next;
    });
  }

  function compatibleFormatsFor(field: any) {
    return TEMPLATE_BUILDER_SUPPORTED_FORMAT_MODIFIERS.filter((format) => field.compatibleModifiers.includes(format));
  }

  function appliedFormatsFor(field: any) {
    const compatible = compatibleFormatsFor(field);
    return selectedFormats.filter((format) => compatible.includes(format as any));
  }

  function withFormats(token: string, field: any) {
    const formats = appliedFormatsFor(field);
    if (formats.length === 0) return token;
    return token.replace("}}", "|" + formats.join("|") + "}}");
  }

  async function copyToken(token: string) {
    setCopiedToken("");
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(token);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = token;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedToken(token);
      window.setTimeout(() => setCopiedToken((current) => current === token ? "" : current), 1400);
    } catch {
      setCopiedToken("");
    }
  }

  function confirmDeleteField() {
    if (!deleteCandidate?.mergeField) return;
    setDeletedTokens((current) => Array.from(new Set([...current, deleteCandidate.mergeField])));
    setDeleteCandidate(null);
  }

  const headerStyle = {
    padding: "10px 12px",
    textAlign: "left" as const,
    position: "sticky" as const,
    top: 0,
    zIndex: 3,
    background: "#1e3a8a",
    color: "#ffffff",
    boxShadow: "0 1px 0 rgba(255,255,255,0.18)",
    whiteSpace: "nowrap" as const,
  };

  const sortButtonStyle = {
    border: 0,
    background: "transparent",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
    padding: 0,
    display: "inline-flex",
    gap: "6px",
    alignItems: "center",
    whiteSpace: "nowrap" as const,
  };

  const cellStyle = {
    padding: "10px 12px",
    verticalAlign: "middle" as const,
    borderTop: "1px solid #e2e8f0",
    whiteSpace: "nowrap" as const,
  };

  return (
    <main style={{ padding: "24px 28px", width: "100%", maxWidth: "none", margin: 0, boxSizing: "border-box" }}>
      <a href="/admin/document-templates" style={{ color: "#1e3a8a", fontWeight: 700 }}>Back to Document Templates</a>
      <h1 style={{ margin: "18px 0 18px", fontSize: "30px", color: "#0f172a" }}>Build Template</h1>

      <section style={{ display: "grid", gridTemplateColumns: "minmax(520px, 1fr) 280px", gap: "14px", marginBottom: "16px" }}>
        <label style={{ display: "grid", gap: "6px", fontWeight: 700, color: "#0f172a" }}>
          Search merge fields
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search category, label, token, example output, aliases, type" style={{ padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "10px" }} />
        </label>
        <label style={{ display: "grid", gap: "6px", fontWeight: 700, color: "#0f172a" }}>
          Example matter
          <select value={exampleMatter} onChange={(event) => setExampleMatter(event.target.value)} style={{ padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "10px", background: "#ffffff" }}>
            <option>BRL_202600003</option>
            <option>BRL30236</option>
            <option>2026.06.00002</option>
            <option>2026.06.00011</option>
          </select>
        </label>
      </section>

      <section style={{ marginBottom: "18px", padding: "14px", border: "1px solid #cbd5e1", borderRadius: "12px", background: "#ffffff" }}>
        <div style={{ marginBottom: "10px", fontWeight: 800, color: "#0f172a" }}>Formats for copy</div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {TEMPLATE_BUILDER_SUPPORTED_FORMAT_MODIFIERS.map((format) => {
            const checked = selectedFormats.includes(format);
            return (
              <button
                key={format}
                type="button"
                onClick={() => toggleFormat(format)}
                aria-pressed={checked}
                style={{
                  border: checked ? "1px solid #1e3a8a" : "1px solid #cbd5e1",
                  borderRadius: "999px",
                  background: checked ? "#dbeafe" : "#ffffff",
                  color: checked ? "#1e3a8a" : "#334155",
                  padding: "8px 12px",
                  fontWeight: 800,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {checked ? "✓ " : ""}{formatLabel(format)}
              </button>
            );
          })}
        </div>
      </section>

      <div style={{ maxHeight: "calc(100vh - 230px)", overflow: "auto", border: "1px solid #cbd5e1", borderRadius: "12px", width: "100%" }}>
        <table style={{ width: "100%", minWidth: "1480px", borderCollapse: "separate", borderSpacing: 0, background: "#ffffff", tableLayout: "auto" }}>
          <thead>
            <tr>
              <th style={{ ...headerStyle, width: "72px" }}>Action</th>
              <th style={{ ...headerStyle, minWidth: "220px" }}>
                <button type="button" onClick={() => toggleSort("category")} style={sortButtonStyle}>
                  Category <span>{sortIndicator(sortKey === "category", sortDirection)}</span>
                </button>
              </th>
              <th style={{ ...headerStyle, minWidth: "280px" }}>
                <button type="button" onClick={() => toggleSort("fieldLabel")} style={sortButtonStyle}>
                  Field Label <span>{sortIndicator(sortKey === "fieldLabel", sortDirection)}</span>
                </button>
              </th>
              <th style={{ ...headerStyle, minWidth: "360px" }}>
                <button type="button" onClick={() => toggleSort("mergeField")} style={sortButtonStyle}>
                  Merge Field <span>{sortIndicator(sortKey === "mergeField", sortDirection)}</span>
                </button>
              </th>
              <th style={{ ...headerStyle, minWidth: "520px" }}>
                <button type="button" onClick={() => toggleSort("exampleOutput")} style={sortButtonStyle}>
                  Example Output <span>{sortIndicator(sortKey === "exampleOutput", sortDirection)}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleFields.map((field) => {
              const token = withFormats(field.mergeField, field);
              const copied = copiedToken === token;

              return (
                <tr key={field.mergeField}>
                  <td style={cellStyle}>
                    <button
                      type="button"
                      aria-label={"Delete " + field.fieldLabel}
                      title="Delete field"
                      onClick={() => setDeleteCandidate(field)}
                      style={{
                        width: "34px",
                        height: "30px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid #fecaca",
                        borderRadius: "8px",
                        background: "#fef2f2",
                        color: "#991b1b",
                        cursor: "pointer",
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </td>
                  <td style={cellStyle}>{categoryLabel(field)}</td>
                  <td style={cellStyle}>
                    <span style={{ fontWeight: 800 }}>{field.fieldLabel}</span>
                  </td>
                  <td style={cellStyle}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap" }}>
                      <code style={{ fontFamily: "monospace" }}>{token}</code>
                      <button
                        type="button"
                        aria-label={"Copy " + token}
                        title={copied ? "Copied" : "Copy"}
                        onClick={() => copyToken(token)}
                        style={{
                          width: "34px",
                          height: "30px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                          background: copied ? "#dcfce7" : "#f3f4f6",
                          color: copied ? "#166534" : "#374151",
                          cursor: "pointer",
                        }}
                      >
                        <CopyIcon />
                      </button>
                    </span>
                  </td>
                  <td style={cellStyle}>
                    <span>{field.exampleOutput}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {deleteCandidate ? (
        <div role="dialog" aria-modal="true" aria-labelledby="delete-field-title" style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "20px" }}>
          <section style={{ width: "min(520px, 100%)", borderRadius: "14px", overflow: "hidden", background: "#ffffff", boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)" }}>
            <header style={{ background: "#1e3a8a", padding: "14px 18px" }}>
              <h2 id="delete-field-title" style={{ margin: 0, color: "#ffffff", textAlign: "center", fontSize: "20px" }}>Delete Field</h2>
            </header>
            <div style={{ padding: "18px", color: "#0f172a", lineHeight: 1.55 }}>
              <p style={{ margin: "0 0 14px" }}>
                Delete <strong>{deleteCandidate.fieldLabel}</strong> from this Build Template view?
              </p>
              <p style={{ margin: 0, color: "#475569" }}>
                This removes the field from the current UI session only. Persistent field deletion will be wired in a later Template Builder management phase.
              </p>
              <div style={{ marginTop: "18px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" onClick={() => setDeleteCandidate(null)} style={{ padding: "10px 14px", borderRadius: "10px", border: "1px solid #dc2626", background: "#ffffff", color: "#dc2626", fontWeight: 800, cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="button" onClick={confirmDeleteField} style={{ padding: "10px 14px", borderRadius: "10px", border: "1px solid #dc2626", background: "#dc2626", color: "#ffffff", fontWeight: 800, cursor: "pointer" }}>
                  Delete
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
