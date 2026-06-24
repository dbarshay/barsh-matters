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

export default function BuildTemplatePage() {
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState("As Stored");
  const [exampleMatter, setExampleMatter] = useState("BRL_202600003");
  const [customLabel, setCustomLabel] = useState("Settlement Deadline");

  const visibleFields = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fields = TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS;
    if (q.length === 0) return fields;
    return fields.filter((field) => [
      field.category,
      field.subcategory || "",
      field.fieldLabel,
      field.mergeField,
      field.exampleOutput,
      field.aliases.join(" "),
      field.fieldType,
      field.kind,
    ].join(" ").toLowerCase().includes(q));
  }, [query]);

  const withFormat = (token: string) => {
    if (format === "As Stored") return token;
    return token.replace("}}", "|" + format + "}}");
  };

  const categoryRows = TEMPLATE_BUILDER_STARTING_CATEGORIES.flatMap((category) => [
    { label: category.label, type: "Top-level", rules: category.fixed ? "Fixed, last, cannot be renamed or deleted" : "Admin managed; can be reordered" },
    ...(category.subcategories || []).map((sub) => ({ label: category.label + " → " + sub.label, type: "Subcategory", rules: "Admin managed; fields move to General if deleted" })),
  ]);

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

      <div style={{ overflowX: "auto", border: "1px solid #cbd5e1", borderRadius: "12px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#ffffff" }}>
          <thead style={{ background: "#1e3a8a", color: "#ffffff" }}>
            <tr>
              <th style={{ padding: "12px", textAlign: "left" }}>Category</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Field Label</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Merge Field</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Example Output</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Copy</th>
            </tr>
          </thead>
          <tbody>
            {visibleFields.map((field) => (
              <tr key={field.mergeField} style={{ borderTop: "1px solid #e2e8f0" }}>
                <td style={{ padding: "12px", verticalAlign: "top" }}>{field.subcategory ? field.category + " → " + field.subcategory : field.category}</td>
                <td style={{ padding: "12px", verticalAlign: "top" }}>
                  <div style={{ fontWeight: 800 }}>{field.fieldLabel}</div>
                  <div style={{ color: "#64748b", fontSize: "12px", marginTop: "4px" }}>{field.kind} · {field.fieldType}</div>
                </td>
                <td style={{ padding: "12px", verticalAlign: "top", fontFamily: "monospace" }}>{withFormat(field.mergeField)}</td>
                <td style={{ padding: "12px", verticalAlign: "top", color: "#334155" }}>{field.kind === "canonical" ? field.exampleOutput + " from " + exampleMatter : field.exampleOutput}</td>
                <td style={{ padding: "12px", verticalAlign: "top" }}>
                  <button type="button" style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #1e3a8a", background: "#1e3a8a", color: "#ffffff", fontWeight: 700 }}>
                    Copy
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section style={{ marginTop: "22px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
        <div style={{ padding: "18px", border: "1px solid #cbd5e1", borderRadius: "12px", background: "#ffffff" }}>
          <h2 style={{ margin: "0 0 10px", color: "#0f172a", fontSize: "20px" }}>Category readiness</h2>
          <p style={{ margin: "0 0 12px", color: "#475569", lineHeight: 1.5 }}>Admins may manage and reorder categories and subcategories. Individual fields sort alphabetically inside their assigned category. General is fixed and appears last.</p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {categoryRows.map((row) => (
                <tr key={row.label} style={{ borderTop: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "8px", fontWeight: 800 }}>{row.label}</td>
                  <td style={{ padding: "8px", color: "#475569" }}>{row.type}</td>
                  <td style={{ padding: "8px", color: "#475569" }}>{row.rules}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "18px", border: "1px solid #cbd5e1", borderRadius: "12px", background: "#ffffff" }}>
          <h2 style={{ margin: "0 0 10px", color: "#0f172a", fontSize: "20px" }}>Custom manual placeholder readiness</h2>
          <p style={{ margin: "0 0 12px", color: "#475569", lineHeight: 1.5 }}>Custom manual placeholders are global and reusable. They use custom tokens and are prompted later only when a selected template contains the token.</p>
          <label style={{ display: "grid", gap: "6px", fontWeight: 700 }}>
            Field Label
            <input value={customLabel} onChange={(event) => setCustomLabel(event.target.value)} style={{ padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "10px" }} />
          </label>
          <div style={{ marginTop: "10px", fontFamily: "monospace", color: "#1e3a8a", fontWeight: 900 }}>
            {templateBuilderTokenForCustomLabel(customLabel)}
          </div>
          <div style={{ marginTop: "12px", color: "#334155", lineHeight: 1.55 }}>
            Fields: {TEMPLATE_BUILDER_CUSTOM_PLACEHOLDER_FIELDS.join(" · ")}
          </div>
          <div style={{ marginTop: "8px", color: "#334155", lineHeight: 1.55 }}>
            Field types: {TEMPLATE_BUILDER_CUSTOM_PLACEHOLDER_FIELD_TYPES.join(" · ")}
          </div>
        </div>
      </section>

      <section style={{ marginTop: "22px", padding: "18px", border: "1px solid #bfdbfe", borderRadius: "12px", background: "#eff6ff" }}>
        <h2 style={{ margin: "0 0 10px", color: "#1e3a8a", fontSize: "20px" }}>Token scan readiness</h2>
        <p style={{ margin: 0, color: "#1e293b", lineHeight: 1.55 }}>
          Phase 4 defines the scanner contract for body paragraphs, tables, detectable text boxes, split Word runs, warning-only unknown tokens, blocking malformed tokens, invalid modifiers, incompatible modifiers, approximate locations, and the standard BM token scan popup. Production DOCX upload and Generate Documents remain unwired.
        </p>
      </section>
    
      <section style={{ marginTop: "22px", padding: "18px", border: "1px solid #bbf7d0", borderRadius: "12px", background: "#f0fdf4" }}>
        <h2 style={{ margin: "0 0 10px", color: "#166534", fontSize: "20px" }}>Ready for Create Template implementation</h2>
        <p style={{ margin: 0, color: "#14532d", lineHeight: 1.55 }}>
          The next implementation phase may wire Create Template using BM display name, local DOCX picker, default signature mode Firm or User Selects, initial Inactive status, BM cloud storage under templates/inactive/, duplicate filename blocking across all template folders, and the Phase 4 token scan before save.
        </p>
      </section>
    </main>
  );
}
