"use client";

import { useState } from "react";
import {
  TEMPLATE_CONTACT_DISPLAY_DEFAULT_OPTIONS_PHASE1H,
  type TemplateContactDisplayDefaultPhase1H,
} from "@/src/lib/templates/template-contact-display-default-phase1h";

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  padding: "10px 12px",
  fontSize: "14px",
  background: "#ffffff",
  color: "#111827",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 800,
  color: "#0f172a",
  marginBottom: "6px",
};

const helperStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: "13px",
  lineHeight: 1.45,
};

export default function CreateTemplateMetadataShell() {
  const [displayName, setDisplayName] = useState("");
  const [category, setCategory] = useState("direct_matter");
  const [defaultContactDisplayMode, setDefaultContactDisplayMode] =
    useState<TemplateContactDisplayDefaultPhase1H>("signer");

  return (
    <section
      data-template-create-metadata-shell="phase1i"
      aria-label="Create Template metadata setup"
      style={{
        border: "1px solid #bfdbfe",
        borderRadius: "12px",
        padding: "16px",
        margin: "16px 0 18px",
        background: "#eff6ff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: "18px", color: "#111827" }}>
            Create Template
          </h2>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.45 }}>
            Metadata setup for a fresh local DOCX after compatibility review. This shell does not save, import, upload, generate, print, or queue.
          </p>
        </div>
        <span
          style={{
            border: "1px solid #93c5fd",
            borderRadius: "999px",
            background: "#ffffff",
            color: "#1e3a8a",
            fontSize: "12px",
            fontWeight: 900,
            padding: "6px 10px",
          }}
        >
          Metadata only
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px", marginTop: "16px" }}>
        <div>
          <label style={labelStyle} htmlFor="template-display-name-phase1i">
            Template display name
          </label>
          <input
            id="template-display-name-phase1i"
            data-template-create-display-name="phase1i"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Example: Initial Billing Letter"
            style={inputStyle}
          />
          <p style={helperStyle}>User-facing BM display name. This is not a storage filename.</p>
        </div>

        <div>
          <label style={labelStyle} htmlFor="template-category-phase1i">
            Template category
          </label>
          <select
            id="template-category-phase1i"
            data-template-create-category="phase1i"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            style={inputStyle}
          >
            <option value="direct_matter">Direct / Individual Matter</option>
            <option value="lawsuit">Lawsuit</option>
            <option value="settlement">Settlement</option>
            <option value="general">General</option>
          </select>
          <p style={helperStyle}>Used later for filtering and generation availability.</p>
        </div>
      </div>

      <fieldset
        data-template-create-default-contact-display="phase1i"
        style={{
          margin: "16px 0 0",
          border: "1px solid #cbd5e1",
          borderRadius: "10px",
          padding: "14px",
          background: "#ffffff",
        }}
      >
        <legend style={{ padding: "0 6px", fontWeight: 900, color: "#0f172a" }}>
          Default generation contact display
        </legend>

        <p style={{ margin: "0 0 12px", color: "#475569", lineHeight: 1.45 }}>
          Choose what the user sees by default when generating this template. Eligible signers remain selectable.
        </p>

        <div style={{ display: "grid", gap: "10px" }}>
          {TEMPLATE_CONTACT_DISPLAY_DEFAULT_OPTIONS_PHASE1H.map((option) => (
            <label
              key={option.value}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "10px",
                alignItems: "start",
                border: "1px solid " + (defaultContactDisplayMode === option.value ? "#1e3a8a" : "#e2e8f0"),
                borderRadius: "10px",
                padding: "12px",
                background: defaultContactDisplayMode === option.value ? "#eff6ff" : "#ffffff",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="defaultContactDisplayMode"
                value={option.value}
                checked={defaultContactDisplayMode === option.value}
                onChange={() => setDefaultContactDisplayMode(option.value)}
                style={{ marginTop: "3px" }}
              />
              <span>
                <span style={{ display: "block", fontWeight: 900, color: "#111827" }}>{option.label}</span>
                <span style={{ display: "block", marginTop: "3px", color: "#475569", lineHeight: 1.45 }}>
                  {option.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div
        data-template-create-metadata-preview="phase1i"
        style={{
          marginTop: "14px",
          border: "1px solid #dbeafe",
          borderRadius: "10px",
          background: "#f8fafc",
          padding: "12px",
        }}
      >
        <div style={{ fontWeight: 900, color: "#0f172a", marginBottom: "6px" }}>Metadata preview</div>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "12px", color: "#334155" }}>
{JSON.stringify(
  {
    displayName,
    category,
    defaultContactDisplayMode,
    selectedSignerRule: "defaults to signed-in generating user; other eligible signers remain selectable",
    signerTokenRule: "signer.* tokens resolve from selected signer",
    persistence: "not implemented in Phase 1I",
  },
  null,
  2
)}
        </pre>
      </div>
    </section>
  );
}
