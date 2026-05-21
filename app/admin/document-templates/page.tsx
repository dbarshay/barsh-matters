"use client";

import React, { useEffect, useMemo, useState } from "react";

type TemplateCategory = "all" | "settlement" | "lawsuit" | "direct_matter" | "payment" | "general";

type TemplateRecord = {
  id?: string;
  key: string;
  label: string;
  category: string;
  description?: string;
  defaultFilenameSuffix?: string;
  generationEndpoint?: string;
  outputFormat?: string;
  sourceOfTruth?: string;
  enabled?: boolean;
  repositorySource?: string;
  repositoryStatus?: string;
  editableNow?: boolean;
  editableLater?: boolean;
  mergeFieldSet?: string;
  mergeFields?: Array<{
    key: string;
    label: string;
    description?: string;
    source?: string;
    required?: boolean;
    exampleValue?: string;
  }>;
  currentVersion?: {
    id: string;
    versionNumber: number;
    status: string;
    bodyFormat: string;
    storageKind: string;
    mergeFieldSet?: string;
  } | null;
};

type TemplateApiResponse = {
  ok: boolean;
  action?: string;
  localFirst?: boolean;
  sourceOfTruth?: string;
  repositoryMode?: string;
  repositorySource?: string;
  repositoryFuture?: string;
  category?: string;
  count?: number;
  templates?: TemplateRecord[];
  safety?: Record<string, unknown>;
  note?: string;
  error?: string;
};

const categories: Array<{ key: TemplateCategory; label: string }> = [
  { key: "all", label: "All" },
  { key: "settlement", label: "Settlement" },
  { key: "lawsuit", label: "Lawsuit" },
  { key: "direct_matter", label: "Direct Matter" },
  { key: "payment", label: "Payment" },
  { key: "general", label: "General" },
];

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function display(value: unknown, fallback = "—"): string {
  const text = clean(value);
  return text || fallback;
}

function statusBadgeStyle(kind: "ok" | "warn" | "neutral"): React.CSSProperties {
  const colors = {
    ok: { background: "#dcfce7", color: "#166534", border: "#bbf7d0" },
    warn: { background: "#fef3c7", color: "#92400e", border: "#fde68a" },
    neutral: { background: "#f1f5f9", color: "#334155", border: "#e2e8f0" },
  }[kind];

  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    background: colors.background,
    color: colors.color,
    padding: "4px 9px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  };
}

export default function AdminDocumentTemplatesPage() {
  const [category, setCategory] = useState<TemplateCategory>("settlement");
  const [data, setData] = useState<TemplateApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importConfirmResult, setImportConfirmResult] = useState<any>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");

  async function loadTemplates(nextCategory = category) {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/documents/templates?category=${encodeURIComponent(nextCategory)}`, {
        cache: "no-store",
      });
      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Document template repository load failed.");
      }

      setData(json);
    } catch (err: any) {
      setData(null);
      setError(err?.message || "Document template repository load failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTemplates(category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  async function previewSeededTemplateImport() {
    setImportLoading(true);
    setImportError("");
    setImportPreview(null);
    setImportConfirmResult(null);

    try {
      const response = await fetch("/api/documents/templates/import-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "seeded",
          category,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json) {
        throw new Error(json?.error || "Could not preview seeded template import.");
      }

      setImportPreview(json);
    } catch (err: any) {
      setImportError(err?.message || "Could not preview seeded template import.");
    } finally {
      setImportLoading(false);
    }
  }

  async function confirmSeededTemplateImport() {
    if (!importPreview?.ok) {
      setImportError("Preview a valid seeded template import before confirming.");
      return;
    }

    setImportLoading(true);
    setImportError("");
    setImportConfirmResult(null);

    try {
      const response = await fetch("/api/documents/templates/import-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "seeded",
          category,
          confirm: true,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Could not confirm seeded template import.");
      }

      setImportConfirmResult(json);
      await loadTemplates(category);
    } catch (err: any) {
      setImportError(err?.message || "Could not confirm seeded template import.");
    } finally {
      setImportLoading(false);
    }
  }

  const templates = useMemo(() => (Array.isArray(data?.templates) ? data.templates : []), [data]);

  const repositorySourceKind = data?.repositorySource === "barsh-matters-db" ? "ok" : "warn";
  const repositorySourceLabel =
    data?.repositorySource === "barsh-matters-db"
      ? "Database repository"
      : data?.repositorySource === "barsh-matters-code-registry-fallback"
        ? "Code-registry fallback"
        : display(data?.repositorySource, "Unknown source");

  return (
    <main
      data-barsh-admin-document-template-repository="true"
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#0f172a",
        padding: "28px 30px 46px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          display: "grid",
          gap: 18,
        }}
      >
        <header
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 24,
            padding: 22,
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 950, color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Admin
              </div>
              <h1 style={{ margin: "4px 0 0", fontSize: 30, lineHeight: 1.1 }}>
                Document Template Repository
              </h1>
              <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.45, maxWidth: 900 }}>
                Read-only admin view for document templates, categories, repository source, versions, and merge fields.  This page does not edit templates, seed templates, upload files, generate documents, send email, print, queue documents, or write to Clio.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
              <span style={statusBadgeStyle("neutral")}>Admin-only</span>
              <span style={statusBadgeStyle("ok")}>Read-only</span>
              <span style={statusBadgeStyle(repositorySourceKind)}>{repositorySourceLabel}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {categories.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setCategory(item.key)}
                style={{
                  border: category === item.key ? "1px solid #4f46e5" : "1px solid #cbd5e1",
                  background: category === item.key ? "#eef2ff" : "#fff",
                  color: category === item.key ? "#3730a3" : "#334155",
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                {item.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => loadTemplates(category)}
              disabled={loading}
              style={{
                marginLeft: "auto",
                border: "1px solid #0f172a",
                background: loading ? "#e5e7eb" : "#0f172a",
                color: loading ? "#64748b" : "#fff",
                borderRadius: 12,
                padding: "9px 13px",
                fontWeight: 950,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </header>

        {(error || data?.error) && (
          <section
            style={{
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
              borderRadius: 18,
              padding: 16,
              fontWeight: 900,
            }}
          >
            {error || data?.error}
          </section>
        )}

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {[
            ["Repository Mode", display(data?.repositoryMode)],
            ["Repository Source", repositorySourceLabel],
            ["Category", display(data?.category || category)],
            ["Template Count", String(data?.count ?? templates.length)],
            ["Source of Truth", display(data?.sourceOfTruth)],
            ["Local First", data?.localFirst ? "Yes" : "No"],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                padding: 16,
                boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 950, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {label}
              </div>
              <div style={{ marginTop: 6, fontWeight: 950, color: "#0f172a" }}>{value}</div>
            </div>
          ))}
        </section>

        <section
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 22,
            overflow: "hidden",
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
          }}
        >
          <div
            style={{
              padding: "16px 18px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>Templates</h2>
              <p style={{ margin: "4px 0 0", color: "#64748b", lineHeight: 1.4 }}>
                Current records are read-only.  If the database repository has no records, this view shows seeded fallback definitions.
              </p>
            </div>
          </div>

          {loading && (
            <div style={{ padding: 18, color: "#475569", fontWeight: 900 }}>
              Loading document-template repository...
            </div>
          )}

          <section
            style={{
              border: "1px solid #dbe4f0",
              borderRadius: 18,
              padding: 18,
              background: "#fff",
              marginTop: 18,
            }}
          >
            <h2 style={{ margin: "0 0 12px 0", fontSize: 20 }}>Seeded Template Import</h2>
            <p style={{ margin: "0 0 12px 0", color: "#475569", lineHeight: 1.55 }}>
              Preview and confirm importing the current seeded document-template definitions into the local
              Barsh Matters template repository.  Seeded definitions are placeholder/test templates only;
              they are not final production templates and should later be replaced by user-provided production
              templates.
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <button
                type="button"
                onClick={previewSeededTemplateImport}
                disabled={importLoading}
                style={{
                  border: "1px solid #2563eb",
                  background: importLoading ? "#dbeafe" : "#eff6ff",
                  color: "#1d4ed8",
                  borderRadius: 12,
                  padding: "10px 14px",
                  fontWeight: 900,
                  cursor: importLoading ? "default" : "pointer",
                }}
              >
                {importLoading ? "Working..." : "Preview Seeded Import"}
              </button>
              <button
                type="button"
                onClick={confirmSeededTemplateImport}
                disabled={importLoading || !importPreview?.ok}
                style={{
                  border: importLoading || !importPreview?.ok ? "1px solid #cbd5e1" : "1px solid #16a34a",
                  background: importLoading || !importPreview?.ok ? "#f1f5f9" : "#f0fdf4",
                  color: importLoading || !importPreview?.ok ? "#64748b" : "#166534",
                  borderRadius: 12,
                  padding: "10px 14px",
                  fontWeight: 900,
                  cursor: importLoading || !importPreview?.ok ? "not-allowed" : "pointer",
                }}
              >
                Confirm Seeded Import
              </button>
            </div>

            <div
              style={{
                border: "1px solid #fed7aa",
                background: "#fff7ed",
                color: "#9a3412",
                borderRadius: 14,
                padding: 12,
                marginBottom: 12,
                lineHeight: 1.5,
              }}
            >
              <strong>Placeholder warning:</strong> Current seeded templates are only workflow/testing
              placeholders.  Confirming this import creates local DB template records, versions, and merge
              fields, but it does not make them final production templates, generate documents, upload to
              Clio, create email drafts, print, or queue documents.
            </div>

            {importError && (
              <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 14, padding: 12, marginBottom: 12, fontWeight: 800 }}>
                {importError}
              </div>
            )}

            {importPreview && (
              <div style={{ border: importPreview.ok ? "1px solid #bfdbfe" : "1px solid #fecaca", background: importPreview.ok ? "#eff6ff" : "#fef2f2", borderRadius: 14, padding: 12, marginBottom: 12 }}>
                <h3 style={{ margin: "0 0 8px 0", fontSize: 16 }}>Import Preview</h3>
                <div style={{ display: "grid", gap: 4, color: "#334155", fontSize: 14 }}>
                  <div><strong>Rows:</strong> {importPreview.summary?.totalRows ?? 0}</div>
                  <div><strong>Valid:</strong> {importPreview.summary?.validRows ?? 0}</div>
                  <div><strong>Create:</strong> {importPreview.summary?.rowsToCreate ?? 0}</div>
                  <div><strong>Update:</strong> {importPreview.summary?.rowsToUpdate ?? 0}</div>
                  <div><strong>Production-ready rows:</strong> {importPreview.summary?.productionReadyRows ?? 0}</div>
                  <div><strong>Final production rows:</strong> {importPreview.summary?.finalProductionRows ?? 0}</div>
                  <div><strong>Database changed:</strong> {String(Boolean(importPreview.safety?.databaseRecordsChanged))}</div>
                </div>
              </div>
            )}

            {importConfirmResult && (
              <div style={{ border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", borderRadius: 14, padding: 12, marginBottom: 12 }}>
                <h3 style={{ margin: "0 0 8px 0", fontSize: 16 }}>Import Confirmed</h3>
                <div style={{ display: "grid", gap: 4, fontSize: 14 }}>
                  <div><strong>Templates processed:</strong> {importConfirmResult.results?.length ?? 0}</div>
                  <div><strong>Rows created:</strong> {importConfirmResult.summary?.rowsToCreate ?? 0}</div>
                  <div><strong>Rows updated:</strong> {importConfirmResult.summary?.rowsToUpdate ?? 0}</div>
                  <div><strong>Database changed:</strong> {String(Boolean(importConfirmResult.safety?.databaseRecordsChanged))}</div>
                  <div><strong>No Clio / email / print:</strong> {String(!importConfirmResult.safety?.clioRecordsChanged && !importConfirmResult.safety?.emailsSent && !importConfirmResult.safety?.printQueueChanged)}</div>
                </div>
              </div>
            )}
          </section>

          {!loading && templates.length === 0 && (
            <div style={{ padding: 18, color: "#64748b", fontWeight: 900 }}>
              No templates found for this category.
            </div>
          )}

          {!loading && templates.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#334155", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    <th style={{ textAlign: "left", padding: "11px 12px", borderBottom: "1px solid #e5e7eb" }}>Template</th>
                    <th style={{ textAlign: "left", padding: "11px 12px", borderBottom: "1px solid #e5e7eb" }}>Category</th>
                    <th style={{ textAlign: "left", padding: "11px 12px", borderBottom: "1px solid #e5e7eb" }}>Repository</th>
                    <th style={{ textAlign: "left", padding: "11px 12px", borderBottom: "1px solid #e5e7eb" }}>Version</th>
                    <th style={{ textAlign: "left", padding: "11px 12px", borderBottom: "1px solid #e5e7eb" }}>Output</th>
                    <th style={{ textAlign: "left", padding: "11px 12px", borderBottom: "1px solid #e5e7eb" }}>Merge Fields</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((template) => {
                    const mergeFields = Array.isArray(template.mergeFields) ? template.mergeFields : [];
                    return (
                      <tr key={template.key} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: 12, verticalAlign: "top" }}>
                          <div style={{ fontWeight: 950 }}>{display(template.label)}</div>
                          <div style={{ color: "#64748b", fontSize: 13, marginTop: 3 }}>{display(template.key)}</div>
                          {template.description && (
                            <div style={{ color: "#475569", fontSize: 13, marginTop: 6, lineHeight: 1.35 }}>
                              {template.description}
                            </div>
                          )}
                          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <span style={statusBadgeStyle(template.enabled === false ? "warn" : "ok")}>
                              {template.enabled === false ? "Disabled" : "Enabled"}
                            </span>
                            <span style={statusBadgeStyle(template.editableNow ? "ok" : "neutral")}>
                              {template.editableNow ? "Editable now" : "Read-only now"}
                            </span>
                            {template.editableLater && (
                              <span style={statusBadgeStyle("warn")}>Editable later</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: 12, verticalAlign: "top", fontWeight: 850 }}>
                          {display(template.category)}
                        </td>
                        <td style={{ padding: 12, verticalAlign: "top" }}>
                          <div>{display(template.repositorySource)}</div>
                          <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                            {display(template.repositoryStatus)}
                          </div>
                        </td>
                        <td style={{ padding: 12, verticalAlign: "top" }}>
                          {template.currentVersion ? (
                            <>
                              <div style={{ fontWeight: 900 }}>v{template.currentVersion.versionNumber}</div>
                              <div style={{ color: "#64748b", fontSize: 13 }}>{template.currentVersion.status}</div>
                              <div style={{ color: "#64748b", fontSize: 13 }}>{template.currentVersion.storageKind}</div>
                            </>
                          ) : (
                            <span style={{ color: "#64748b" }}>No DB version yet</span>
                          )}
                        </td>
                        <td style={{ padding: 12, verticalAlign: "top" }}>
                          <div>{display(template.outputFormat)}</div>
                          <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                            {display(template.defaultFilenameSuffix)}
                          </div>
                        </td>
                        <td style={{ padding: 12, verticalAlign: "top" }}>
                          {mergeFields.length === 0 ? (
                            <span style={{ color: "#64748b" }}>None listed</span>
                          ) : (
                            <details>
                              <summary style={{ cursor: "pointer", fontWeight: 900 }}>
                                {mergeFields.length} field(s)
                              </summary>
                              <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                                {mergeFields.map((field) => (
                                  <div
                                    key={field.key}
                                    style={{
                                      border: "1px solid #e5e7eb",
                                      borderRadius: 10,
                                      padding: 8,
                                      background: "#f8fafc",
                                    }}
                                  >
                                    <div style={{ fontWeight: 900 }}>{display(field.label)} <span style={{ color: "#64748b" }}>({field.key})</span></div>
                                    <div style={{ color: "#64748b", fontSize: 12 }}>
                                      Source: {display(field.source)} · Required: {field.required ? "Yes" : "No"}
                                    </div>
                                    {field.description && (
                                      <div style={{ color: "#475569", fontSize: 12, marginTop: 3 }}>{field.description}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          style={{
            border: "1px solid #dbeafe",
            background: "#eff6ff",
            color: "#1e3a8a",
            borderRadius: 18,
            padding: 16,
            lineHeight: 1.45,
          }}
        >
          <strong>Safety:</strong> This admin function is read-only.  The endpoint may read local database template records or fallback registry records, but it does not seed, edit, delete, upload, generate, email, print, queue, or write Clio data.
        </section>
      </div>
    </main>
  );
}
