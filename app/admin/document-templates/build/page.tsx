"use client";

import { useMemo, useState } from "react";
import {
  TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS,
  TEMPLATE_BUILDER_CUSTOM_PLACEHOLDER_FIELD_TYPES,
  TEMPLATE_BUILDER_CUSTOM_PLACEHOLDER_FIELDS,
  TEMPLATE_BUILDER_STARTING_CATEGORIES,
  TEMPLATE_BUILDER_SUPPORTED_FORMAT_MODIFIERS,
  templateBuilderTokenForCustomLabel,
} from "@/src/lib/templates/template-builder-merge-field-library";

type SortKey = "category" | "fieldLabel" | "mergeField" | "exampleOutput";
type SortDirection = "asc" | "desc";

function categoryLabel(field: { category: string; subcategory?: string }) {
  return field.subcategory ? field.category + " → " + field.subcategory : field.category;
}

function sortValue(field: any, sortKey: SortKey, exampleMatter: string) {
  if (sortKey === "category") return categoryLabel(field);
  if (sortKey === "exampleOutput") return field.kind === "canonical" ? field.exampleOutput + " from " + exampleMatter : field.exampleOutput;
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

export default function BuildTemplatePage() {
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState("As Stored");
  const [exampleMatter, setExampleMatter] = useState("BRL_202600003");
  const [customLabel, setCustomLabel] = useState("Settlement Deadline");
  const [sortKey, setSortKey] = useState<SortKey>("category");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [copiedToken, setCopiedToken] = useState("");

  const withFormat = (token: string) => {
    if (format === "As Stored") return token;
    return token.replace("}}", "|" + format + "}}");
  };

  const visibleFields = useMemo(() => {
    const q = query.trim().toLowerCase();
    const searched = TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS.filter((field) => {
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
      const left = sortValue(a, sortKey, exampleMatter).toLowerCase();
      const right = sortValue(b, sortKey, exampleMatter).toLowerCase();
      const result = left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
      return sortDirection === "asc" ? result : -result;
    });
  }, [query, sortKey, sortDirection, exampleMatter]);

  const categoryRows = TEMPLATE_BUILDER_STARTING_CATEGORIES.flatMap((category) => [
    { label: category.label, type: "Top-level", rules: category.fixed ? "Fixed name; cannot be renamed or deleted" : "Admin managed; can be reordered" },
    ...(category.subcategories || []).map((sub) => ({ label: category.label + " → " + sub.label, type: "Subcategory", rules: "Admin managed; fields move to General if deleted" })),
  ]);

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }

    setSortKey(nextKey);
    setSortDirection("asc");
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

  const headerStyle = {
    padding: "12px",
    textAlign: "left" as const,
    position: "sticky" as const,
    top: 0,
    zIndex: 3,
    background: "#1e3a8a",
    color: "#ffffff",
    boxShadow: "0 1px 0 rgba(255,255,255,0.18)",
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
  };

  return (
    <main style={{ padding: "32px", maxWidth: "1280px", margin: "0 auto" }}>
      <a href="/admin/document-templates" style={{ color: "#1e3a8a", fontWeight: 700 }}>Back to Document Templates</a>
      <h1 style={{ margin: "18px 0 10px", fontSize: "30px", color: "#0f172a" }}>Build Template</h1>
      <p style={{ margin: "0 0 22px", color: "#334155", lineHeight: 1.6 }}>
        Phase 3 locks the searchable merge-field library, category rules, format choices, and custom manual placeholder contract. Production DOCX upload, token mutation, and matter-side Generate Documents remain intentionally unwired.
      </p>

      <section style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) 240px 220px", gap: "14px", marginBottom: "18px" }}>
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
          </select>
        </label>
        <label style={{ display: "grid", gap: "6px", fontWeight: 700, color: "#0f172a" }}>
          Format for copy
          <select value={format} onChange={(event) => setFormat(event.target.value)} style={{ padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "10px", background: "#ffffff" }}>
            <option>As Stored</option>
            {TEMPLATE_BUILDER_SUPPORTED_FORMAT_MODIFIERS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </section>

      <div style={{ maxHeight: "560px", overflow: "auto", border: "1px solid #cbd5e1", borderRadius: "12px" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, background: "#ffffff" }}>
          <thead>
            <tr>
              <th style={headerStyle}>
                <button type="button" onClick={() => toggleSort("category")} style={sortButtonStyle}>
                  Category <span>{sortIndicator(sortKey === "category", sortDirection)}</span>
                </button>
              </th>
              <th style={headerStyle}>
                <button type="button" onClick={() => toggleSort("fieldLabel")} style={sortButtonStyle}>
                  Field Label <span>{sortIndicator(sortKey === "fieldLabel", sortDirection)}</span>
                </button>
              </th>
              <th style={headerStyle}>
                <button type="button" onClick={() => toggleSort("mergeField")} style={sortButtonStyle}>
                  Merge Field <span>{sortIndicator(sortKey === "mergeField", sortDirection)}</span>
                </button>
              </th>
              <th style={headerStyle}>
                <button type="button" onClick={() => toggleSort("exampleOutput")} style={sortButtonStyle}>
                  Example Output <span>{sortIndicator(sortKey === "exampleOutput", sortDirection)}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleFields.map((field) => {
              const token = withFormat(field.mergeField);
              const copied = copiedToken === token;

              return (
                <tr key={field.mergeField} style={{ borderTop: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "12px", verticalAlign: "top", borderTop: "1px solid #e2e8f0" }}>{categoryLabel(field)}</td>
                  <td style={{ padding: "12px", verticalAlign: "top", borderTop: "1px solid #e2e8f0" }}>
                    <div style={{ fontWeight: 800 }}>{field.fieldLabel}</div>
                    <div style={{ color: "#64748b", fontSize: "12px", marginTop: "4px" }}>{field.kind} · {field.fieldType}</div>
                  </td>
                  <td style={{ padding: "12px", verticalAlign: "top", borderTop: "1px solid #e2e8f0" }}>
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
                  <td style={{ padding: "12px", verticalAlign: "top", color: "#334155", borderTop: "1px solid #e2e8f0" }}>
                    {field.kind === "canonical" ? field.exampleOutput + " from " + exampleMatter : field.exampleOutput}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </main>
  );
}
