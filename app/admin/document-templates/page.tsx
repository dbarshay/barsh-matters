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
    hasStoredDocx?: boolean;
    storedDocxBytes?: number;
    uploadedTemplateFile?: any;
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

function mergeFieldVisibility(field: any): string {
  return String(field?.metadata?.visibility || field?.visibility || "visible_ui");
}

function mergeFieldVisibilityCounts(fields: any[]) {
  const counts = {
    visible_ui: 0,
    hidden_internal: 0,
    computed: 0,
    system: 0,
  };

  for (const field of fields || []) {
    const visibility = mergeFieldVisibility(field);
    if (visibility === "hidden_internal") counts.hidden_internal += 1;
    else if (visibility === "computed") counts.computed += 1;
    else if (visibility === "system") counts.system += 1;
    else counts.visible_ui += 1;
  }

  return counts;
}

const ADVANCED_CUSTOM_IMPORT_CONFIRM_MAX_BYTES = 900_000;

function byteLengthForText(value: string): number {
  if (typeof Blob !== "undefined") {
    return new Blob([value || ""]).size;
  }

  return value?.length || 0;
}

function customImportContainsStoredDocxBase64(value: string): boolean {
  return (
    value.includes("\"contentBase64\"") ||
    value.includes('"contentBase64"') ||
    value.includes("db-docx-base64")
  );
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
  const [mergeFieldVisibilityFilter, setMergeFieldVisibilityFilter] = useState<"all" | "visible_ui" | "hidden_internal" | "computed" | "system">("all");
  const [customTemplateRowsText, setCustomTemplateRowsText] = useState(`[
  {
    "key": "harmless-stored-docx-test-template",
    "label": "Example Production Template",
    "category": "general",
    "description": "Harmless stored DOCX test-template metadata import with visible and hidden merge fields.",
    "defaultFilenameSuffix": "Example Production Template",
    "generationEndpoint": "",
    "outputFormat": "docx",
    "sourceOfTruth": "barsh-matters-local",
    "enabled": true,
    "editableInRepository": true,
    "mergeFieldSet": "harmless-stored-docx-test",
    "repositorySource": "barsh-matters-template-import",
    "repositoryStatus": "draft-template-import",
    "productionTemplateReady": false,
    "finalProductionDocument": false,
    "metadata": {
      "templateSource": "template-repository-db",
      "notes": "Replace this harmless test template with user-provided production template metadata."
    },
    "mergeFields": [
      {
        "key": "visiblePatientName",
        "label": "Visible Patient Name",
        "source": "visible-ui",
        "visibility": "visible_ui",
        "required": true
      },
      {
        "key": "hiddenInsurerAddress",
        "label": "Hidden Insurer Address",
        "source": "reference-data-hidden",
        "visibility": "hidden_internal",
        "required": false,
        "metadata": {
          "path": "referenceData.insurer.details.hidden_address"
        }
      }
    ]
  }
]`);
  const [customTemplatePreview, setCustomTemplatePreview] = useState<any>(null);
  const [customTemplateConfirmResult, setCustomTemplateConfirmResult] = useState<any>(null);
  const [customTemplateLoading, setCustomTemplateLoading] = useState(false);
  const [customTemplateError, setCustomTemplateError] = useState("");
  const [templateFilePlaceholder, setTemplateFilePlaceholder] = useState<any>(null);
  const [templateFilePlaceholderError, setTemplateFilePlaceholderError] = useState("");
  const [advancedCustomImportOpen, setAdvancedCustomImportOpen] = useState(false);

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

  function applyTemplateFilePlaceholderToCustomJson(fileInfo: any) {
    const rows = parseCustomTemplateRows();
    const firstRow = rows[0] || {};

    const nextRow = {
      ...firstRow,
      key: firstRow.key || "uploaded-template-placeholder",
      label: firstRow.label || fileInfo.baseName || fileInfo.name || "Uploaded Template Placeholder",
      category: firstRow.category || "general",
      defaultFilenameSuffix: firstRow.defaultFilenameSuffix || fileInfo.baseName || "Uploaded Template Placeholder",
      outputFormat: firstRow.outputFormat || "docx",
      sourceOfTruth: firstRow.sourceOfTruth || "barsh-matters-local",
      enabled: firstRow.enabled ?? true,
      editableInRepository: firstRow.editableInRepository ?? true,
      repositorySource: "barsh-matters-template-upload-db",
      repositoryStatus: "uploaded-docx-template",
      productionTemplateReady: false,
      finalProductionDocument: false,
      metadata: {
        ...(firstRow.metadata || {}),
        templateSource: "uploaded-production-template",
        storageKind: "db-docx-base64",
        actualFileStored: true,
        productionTemplateReady: false,
        finalProductionDocument: false,
        uploadedTemplateFile: fileInfo,
        note: "DOCX file content is captured as base64 and stored in the local DocumentTemplateVersion.contentText field when confirmed.  This does not generate documents, upload to Clio, create drafts, send email, print, or queue documents.",
      },
      mergeFields: Array.isArray(firstRow.mergeFields) ? firstRow.mergeFields : [],
    };

    setCustomTemplateRowsText(JSON.stringify([nextRow], null, 2));
    setCustomTemplatePreview(null);
    setCustomTemplateConfirmResult(null);
  }

  function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read the selected DOCX file."));
      reader.onload = () => {
        const value = String(reader.result || "");
        const marker = "base64,";
        const idx = value.indexOf(marker);
        resolve(idx >= 0 ? value.slice(idx + marker.length) : value);
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleTemplateFilePlaceholderChange(event: React.ChangeEvent<HTMLInputElement>) {
    setTemplateFilePlaceholderError("");
    const file = event.target.files?.[0] || null;

    if (!file) {
      setTemplateFilePlaceholder(null);
      return;
    }

    const lowerName = file.name.toLowerCase();

    if (!lowerName.endsWith(".docx")) {
      setTemplateFilePlaceholder(null);
      setTemplateFilePlaceholderError("Use a .docx Word template file for this template-storage workflow.");
      return;
    }

    const baseName = file.name.replace(/\.docx$/i, "");

    try {
      const contentBase64 = await readFileAsBase64(file);
      const fileInfo = {
        name: file.name,
        baseName,
        size: file.size,
        type: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        lastModified: file.lastModified,
        lastModifiedIso: new Date(file.lastModified).toISOString(),
        storageKind: "db-docx-base64",
        actualFileStored: true,
        contentRead: true,
        uploadPerformed: true,
        contentBase64,
        contentBase64Length: contentBase64.length,
      };

      setTemplateFilePlaceholder(fileInfo);
      applyTemplateFilePlaceholderToCustomJson(fileInfo);
    } catch (error: any) {
      setTemplateFilePlaceholder(null);
      setTemplateFilePlaceholderError(error?.message || "Could not read the selected DOCX file.");
    }
  }

  function parseCustomTemplateRows() {
    const parsed = JSON.parse(customTemplateRowsText || "[]");
    if (!Array.isArray(parsed)) {
      throw new Error("Template import JSON must be an array of template row objects.");
    }
    return parsed;
  }

  function rowsForPreviewOnly(rows: any[]) {
    return rows.map((row) => {
      const uploadedTemplateFile = row?.metadata?.uploadedTemplateFile;
      if (!uploadedTemplateFile?.contentBase64) return row;

      const { contentBase64, ...safeUploadedTemplateFile } = uploadedTemplateFile;
      return {
        ...row,
        metadata: {
          ...(row.metadata || {}),
          uploadedTemplateFile: {
            ...safeUploadedTemplateFile,
            contentBase64PreviewOmitted: true,
            contentBase64Length: uploadedTemplateFile.contentBase64Length || contentBase64.length,
          },
        },
      };
    });
  }

  async function previewCustomTemplateRowsImport() {
    setCustomTemplateLoading(true);
    setCustomTemplateError("");
    setCustomTemplatePreview(null);
    setCustomTemplateConfirmResult(null);

    try {
      const rows = parseCustomTemplateRows();
      const previewRows = rowsForPreviewOnly(rows);
      const previewBody = JSON.stringify({
        mode: "rows",
        rows: previewRows,
      });
      const previewPayloadBytes = new Blob([previewBody]).size;

      const response = await fetch("/api/documents/templates/import-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: previewBody,
      });

      const responseText = await response.text();
      let json: any = null;
      try {
        json = responseText ? JSON.parse(responseText) : null;
      } catch {
        json = null;
      }

      if (!response.ok || !json) {
        const bodyPreview = responseText ? responseText.slice(0, 300) : "";
        throw new Error(
          json?.error ||
            `Could not preview custom template import. Status ${response.status}. Preview payload ${previewPayloadBytes} bytes. Response: ${bodyPreview || "empty response"}`
        );
      }

      setCustomTemplatePreview({
        ...json,
        clientPreviewDiagnostics: {
          previewPayloadBytes,
          base64OmittedFromPreview: JSON.stringify(previewRows).includes("contentBase64PreviewOmitted"),
        },
      });
    } catch (err: any) {
      setCustomTemplateError(err?.message || "Could not preview custom template import. Check that the JSON is an array of template row objects.");
    } finally {
      setCustomTemplateLoading(false);
    }
  }

  async function confirmCustomTemplateRowsImport() {
    if (!customTemplatePreview?.ok) {
      setCustomTemplateError("Preview a valid custom template import before confirming.");
      return;
    }

    if (customTemplateConfirmBlocked) {
      setCustomTemplateError(customTemplateConfirmBlockReason || "Custom import confirm is blocked for this payload. Use the Template Detail replacement workflow instead.");
      return;
    }

    setCustomTemplateLoading(true);
    setCustomTemplateError("");
    setCustomTemplateConfirmResult(null);

    try {
      const rows = parseCustomTemplateRows();
      const confirmBody = JSON.stringify({
        mode: "rows",
        rows,
        confirm: true,
      });
      const confirmPayloadBytes = new Blob([confirmBody]).size;

      const response = await fetch("/api/documents/templates/import-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: confirmBody,
      });

      const responseText = await response.text();
      let json: any = null;
      try {
        json = responseText ? JSON.parse(responseText) : null;
      } catch {
        json = null;
      }

      if (!response.ok || !json?.ok) {
        const bodyPreview = responseText ? responseText.slice(0, 300) : "";
        throw new Error(
          json?.error ||
            `Could not confirm custom template import. Status ${response.status}. Confirm payload ${confirmPayloadBytes} bytes. Response: ${bodyPreview || "empty response"}`
        );
      }

      setCustomTemplateConfirmResult({
        ...json,
        clientConfirmDiagnostics: {
          confirmPayloadBytes,
          includesBase64Payload: confirmBody.includes("contentBase64"),
        },
      });
      await loadTemplates(category);
    } catch (err: any) {
      setCustomTemplateError(err?.message || "Could not confirm custom template import. Check the response status and payload size.");
    } finally {
      setCustomTemplateLoading(false);
    }
  }

  const customTemplateConfirmPayloadBytes = byteLengthForText(JSON.stringify({
    mode: "rows",
    rows: (() => {
      try {
        return parseCustomTemplateRows();
      } catch {
        return [];
      }
    })(),
    confirm: true,
  }));
  const customTemplateContainsStoredDocxBase64 = customImportContainsStoredDocxBase64(customTemplateRowsText);
  const customTemplateConfirmBlocked =
    customTemplateContainsStoredDocxBase64 ||
    customTemplateConfirmPayloadBytes > ADVANCED_CUSTOM_IMPORT_CONFIRM_MAX_BYTES;
  const customTemplateConfirmBlockReason = customTemplateContainsStoredDocxBase64
    ? "Confirming base64-stored DOCX payloads through this legacy JSON importer is blocked. Use Open Template Detail → Replace Current DOCX Template instead."
    : customTemplateConfirmPayloadBytes > ADVANCED_CUSTOM_IMPORT_CONFIRM_MAX_BYTES
      ? `This legacy JSON import payload is too large (${customTemplateConfirmPayloadBytes} bytes). Use Open Template Detail → Replace Current DOCX Template instead.`
      : "";

  const templates = useMemo(() => (Array.isArray(data?.templates) ? data.templates : []), [data]);

  function openStoredTemplateDocx(template: TemplateRecord) {
    const versionId = template.currentVersion?.id;
    if (!versionId || !template.currentVersion?.hasStoredDocx) return;
    window.open(`/api/documents/templates/stored-docx?versionId=${encodeURIComponent(versionId)}`, "_blank", "noopener,noreferrer");
  }

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
              Clio, create email drafts, print, or queue documents.  Merge fields may include visible UI
              fields and hidden/internal data fields; the repository must preserve that distinction.
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
                  <div><strong>Visible UI merge fields:</strong> {importPreview.summary?.visibleMergeFields ?? 0}</div>
                  <div><strong>Hidden/internal merge fields:</strong> {importPreview.summary?.hiddenInternalMergeFields ?? 0}</div>
                  <div><strong>Computed merge fields:</strong> {importPreview.summary?.computedMergeFields ?? 0}</div>
                  <div><strong>System merge fields:</strong> {importPreview.summary?.systemMergeFields ?? 0}</div>
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

          <section
            data-barsh-advanced-custom-template-import="true"
            style={{
              border: "1px solid #fed7aa",
              borderRadius: 18,
              padding: 18,
              background: "#fff7ed",
              marginTop: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: "0 0 8px 0", fontSize: 20 }}>Advanced / Debug Template Row Import</h2>
                <p style={{ margin: 0, color: "#9a3412", lineHeight: 1.55, maxWidth: 900 }}>
                  This legacy JSON/base64 import tool is retained for diagnostics and emergency metadata imports only.
                  For normal template replacement, open a template detail page and use <strong>Replace Current DOCX Template</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdvancedCustomImportOpen((value) => !value)}
                style={{
                  border: "1px solid #fb923c",
                  background: advancedCustomImportOpen ? "#ffedd5" : "#fff",
                  color: "#9a3412",
                  borderRadius: 999,
                  padding: "9px 14px",
                  fontWeight: 950,
                  cursor: "pointer",
                }}
              >
                {advancedCustomImportOpen ? "Hide Advanced Import" : "Show Advanced Import"}
              </button>
            </div>

            <div
              style={{
                border: "1px solid #fdba74",
                background: "#fff",
                color: "#9a3412",
                borderRadius: 14,
                padding: 12,
                marginTop: 12,
                lineHeight: 1.5,
                fontWeight: 800,
              }}
            >
              Recommended production path: use <strong>Open Template Detail</strong> in the table below, then
              <strong> Replace Current DOCX Template</strong>.  That creates a new version, preserves old versions,
              and avoids moving large base64 DOCX payloads through the JSON textbox.  Production blocks large JSON/base64 confirms to avoid Request Entity Too Large errors.
            </div>

            {advancedCustomImportOpen && (
              <div data-barsh-advanced-custom-template-import-panel="true" style={{ marginTop: 14 }}>
                <p style={{ margin: "0 0 12px 0", color: "#475569", lineHeight: 1.55 }}>
                  Paste JSON template rows to preview and confirm local DocumentTemplate, DocumentTemplateVersion,
                  and DocumentTemplateMergeField records.  This supports both visible UI merge fields and hidden/internal
                  merge fields.  This does not upload Word files, generate documents, send email, print, queue documents,
                  or write to Clio.  This section is advanced/debug-only.
                </p>

            <div
              style={{
                border: "1px solid #c7d2fe",
                background: "#eef2ff",
                color: "#312e81",
                borderRadius: 14,
                padding: 12,
                marginBottom: 12,
                lineHeight: 1.5,
              }}
            >
              <strong>Template DOCX Storage:</strong> Select a .docx file to capture the file content into the custom
              template JSON.  On confirmed import, the DOCX is stored locally in DocumentTemplateVersion.contentText
              as base64.  This does not generate documents, upload to Clio, create drafts, send email, print, or queue documents.
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <label
                  htmlFor="template-docx-storage-file-input"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid #4f46e5",
                    background: "#4f46e5",
                    color: "#ffffff",
                    borderRadius: 999,
                    padding: "9px 14px",
                    fontSize: 13,
                    fontWeight: 950,
                    cursor: "pointer",
                    boxShadow: "0 10px 22px rgba(79, 70, 229, 0.22)",
                    userSelect: "none",
                  }}
                >
                  Choose DOCX Template
                </label>
                <span style={{ fontSize: 13, color: "#475569", fontWeight: 800 }}>
                  {templateFilePlaceholder?.name || "No DOCX selected"}
                </span>
                <input
                  id="template-docx-storage-file-input"
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleTemplateFilePlaceholderChange}
                  style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    padding: 0,
                    margin: -1,
                    overflow: "hidden",
                    clip: "rect(0, 0, 0, 0)",
                    whiteSpace: "nowrap",
                    border: 0,
                  }}
                />
              </div>
              {templateFilePlaceholderError && (
                <div style={{ marginTop: 8, color: "#991b1b", fontWeight: 900 }}>
                  {templateFilePlaceholderError}
                </div>
              )}
              {templateFilePlaceholder && (
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  <div><strong>File:</strong> {templateFilePlaceholder.name}</div>
                  <div><strong>Size:</strong> {templateFilePlaceholder.size} bytes</div>
                  <div><strong>Actual file stored:</strong> {String(Boolean(templateFilePlaceholder.actualFileStored))}</div>
                  <div><strong>Storage kind:</strong> {templateFilePlaceholder.storageKind}</div>
                  <div><strong>Base64 length:</strong> {templateFilePlaceholder.contentBase64Length ?? "—"}</div>
                </div>
              )}
            </div>

            <textarea
              value={customTemplateRowsText}
              onChange={(event) => {
                setCustomTemplateRowsText(event.target.value);
                setCustomTemplatePreview(null);
                setCustomTemplateConfirmResult(null);
                setCustomTemplateError("");
              }}
              rows={14}
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid #cbd5e1",
                borderRadius: 14,
                padding: 12,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: 12,
                lineHeight: 1.45,
                marginBottom: 12,
              }}
            />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <button
                type="button"
                onClick={previewCustomTemplateRowsImport}
                disabled={customTemplateLoading}
                style={{
                  border: "1px solid #2563eb",
                  background: customTemplateLoading ? "#dbeafe" : "#eff6ff",
                  color: "#1d4ed8",
                  borderRadius: 12,
                  padding: "10px 14px",
                  fontWeight: 900,
                  cursor: customTemplateLoading ? "default" : "pointer",
                }}
              >
                {customTemplateLoading ? "Working..." : "Preview Custom Import"}
              </button>
              <button
                type="button"
                onClick={confirmCustomTemplateRowsImport}
                disabled={customTemplateLoading || !customTemplatePreview?.ok || customTemplateConfirmBlocked}
                style={{
                  border: customTemplateLoading || !customTemplatePreview?.ok || customTemplateConfirmBlocked ? "1px solid #cbd5e1" : "1px solid #16a34a",
                  background: customTemplateLoading || !customTemplatePreview?.ok || customTemplateConfirmBlocked ? "#f1f5f9" : "#f0fdf4",
                  color: customTemplateLoading || !customTemplatePreview?.ok || customTemplateConfirmBlocked ? "#64748b" : "#166534",
                  borderRadius: 12,
                  padding: "10px 14px",
                  fontWeight: 900,
                  cursor: customTemplateLoading || !customTemplatePreview?.ok || customTemplateConfirmBlocked ? "not-allowed" : "pointer",
                }}
              >
                Confirm Custom Import
              </button>
            </div>

            {customTemplateConfirmBlocked && (
              <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 14, padding: 12, marginBottom: 12, fontWeight: 850, lineHeight: 1.5 }}>
                <strong>Advanced import confirm blocked:</strong> {customTemplateConfirmBlockReason}
                <div style={{ marginTop: 6 }}>
                  Current estimated confirm payload: {customTemplateConfirmPayloadBytes} bytes.
                </div>
              </div>
            )}

            {customTemplateError && (
              <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 14, padding: 12, marginBottom: 12, fontWeight: 800 }}>
                {customTemplateError}
              </div>
            )}

            {customTemplatePreview && (
              <div style={{ border: customTemplatePreview.ok ? "1px solid #bfdbfe" : "1px solid #fecaca", background: customTemplatePreview.ok ? "#eff6ff" : "#fef2f2", borderRadius: 14, padding: 12, marginBottom: 12 }}>
                <h3 style={{ margin: "0 0 8px 0", fontSize: 16 }}>Custom Import Preview</h3>
                <div style={{ display: "grid", gap: 4, color: "#334155", fontSize: 14 }}>
                  <div><strong>Rows:</strong> {customTemplatePreview.summary?.totalRows ?? 0}</div>
                  <div><strong>Valid:</strong> {customTemplatePreview.summary?.validRows ?? 0}</div>
                  <div><strong>Create:</strong> {customTemplatePreview.summary?.rowsToCreate ?? 0}</div>
                  <div><strong>Update:</strong> {customTemplatePreview.summary?.rowsToUpdate ?? 0}</div>
                  <div><strong>Production-ready rows:</strong> {customTemplatePreview.summary?.productionReadyRows ?? 0}</div>
                  <div><strong>Final production rows:</strong> {customTemplatePreview.summary?.finalProductionRows ?? 0}</div>
                  <div><strong>Visible UI merge fields:</strong> {customTemplatePreview.summary?.visibleMergeFields ?? 0}</div>
                  <div><strong>Hidden/internal merge fields:</strong> {customTemplatePreview.summary?.hiddenInternalMergeFields ?? 0}</div>
                  <div><strong>Computed merge fields:</strong> {customTemplatePreview.summary?.computedMergeFields ?? 0}</div>
                  <div><strong>System merge fields:</strong> {customTemplatePreview.summary?.systemMergeFields ?? 0}</div>
                  <div><strong>Database changed:</strong> {String(Boolean(customTemplatePreview.safety?.databaseRecordsChanged))}</div>
                  <div><strong>Preview payload bytes:</strong> {customTemplatePreview.clientPreviewDiagnostics?.previewPayloadBytes ?? "—"}</div>
                  <div><strong>Base64 omitted from preview:</strong> {String(Boolean(customTemplatePreview.clientPreviewDiagnostics?.base64OmittedFromPreview))}</div>
                </div>
              </div>
            )}

            {customTemplateConfirmResult && (
              <div style={{ border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", borderRadius: 14, padding: 12, marginBottom: 12 }}>
                <h3 style={{ margin: "0 0 8px 0", fontSize: 16 }}>Custom Import Confirmed</h3>
                <div style={{ display: "grid", gap: 4, fontSize: 14 }}>
                  <div><strong>Templates processed:</strong> {customTemplateConfirmResult.results?.length ?? 0}</div>
                  <div><strong>Rows created:</strong> {customTemplateConfirmResult.summary?.rowsToCreate ?? 0}</div>
                  <div><strong>Rows updated:</strong> {customTemplateConfirmResult.summary?.rowsToUpdate ?? 0}</div>
                  <div><strong>Database changed:</strong> {String(Boolean(customTemplateConfirmResult.safety?.databaseRecordsChanged))}</div>
                  <div><strong>No Clio / email / print:</strong> {String(!customTemplateConfirmResult.safety?.clioRecordsChanged && !customTemplateConfirmResult.safety?.emailsSent && !customTemplateConfirmResult.safety?.printQueueChanged)}</div>
                  <div><strong>Confirm payload bytes:</strong> {customTemplateConfirmResult.clientConfirmDiagnostics?.confirmPayloadBytes ?? "—"}</div>
                  <div><strong>Includes base64 payload:</strong> {String(Boolean(customTemplateConfirmResult.clientConfirmDiagnostics?.includesBase64Payload))}</div>
                </div>
              </div>
            )}
              </div>
            )}
          </section>

          {!loading && templates.length === 0 && (
            <div style={{ padding: 18, color: "#64748b", fontWeight: 900 }}>
              No templates found for this category.
            </div>
          )}

          {!loading && templates.length > 0 && (
            <div
              style={{
                border: "1px solid #dbe4f0",
                borderRadius: 14,
                padding: 12,
                background: "#f8fafc",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <label style={{ fontWeight: 950, color: "#334155" }}>Merge Field Visibility Filter</label>
              {([
                ["all", "All"],
                ["visible_ui", "Visible UI"],
                ["hidden_internal", "Hidden/internal"],
                ["computed", "Computed"],
                ["system", "System"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMergeFieldVisibilityFilter(value)}
                  style={{
                    border: mergeFieldVisibilityFilter === value ? "1px solid #4f46e5" : "1px solid #cbd5e1",
                    background: mergeFieldVisibilityFilter === value ? "#eef2ff" : "#fff",
                    color: mergeFieldVisibilityFilter === value ? "#3730a3" : "#334155",
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
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
                    const visibilityCounts = mergeFieldVisibilityCounts(mergeFields);
                    const displayedMergeFields =
                      mergeFieldVisibilityFilter === "all"
                        ? mergeFields
                        : mergeFields.filter((field) => mergeFieldVisibility(field) === mergeFieldVisibilityFilter);
                    return (
                      <tr key={template.key} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: 12, verticalAlign: "top" }}>
                          <div style={{ fontWeight: 950 }}>{display(template.label)}</div>
                          <div style={{ color: "#64748b", fontSize: 13, marginTop: 3 }}>{display(template.key)}</div>
                          <div style={{ marginTop: 6 }}>
                            <a
                              href={`/admin/document-templates/${encodeURIComponent(template.key)}`}
                              style={{ color: "#4f46e5", fontSize: 13, fontWeight: 900, textDecoration: "none" }}
                            >
                              Open Template Detail
                            </a>
                          </div>
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
                              {template.currentVersion.hasStoredDocx && (
                                <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                                  <div style={{ color: "#166534", fontSize: 12, fontWeight: 900 }}>
                                    Stored DOCX · {template.currentVersion.storedDocxBytes || 0} bytes
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => openStoredTemplateDocx(template)}
                                    style={{
                                      border: "1px solid #16a34a",
                                      background: "#f0fdf4",
                                      color: "#166534",
                                      borderRadius: 999,
                                      padding: "6px 10px",
                                      fontSize: 12,
                                      fontWeight: 900,
                                      cursor: "pointer",
                                      width: "fit-content",
                                    }}
                                  >
                                    Download Stored DOCX
                                  </button>
                                </div>
                              )}
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
                          ) : displayedMergeFields.length === 0 ? (
                            <span style={{ color: "#64748b" }}>No merge fields match the selected visibility filter.</span>
                          ) : (
                            <details>
                              <summary style={{ cursor: "pointer", fontWeight: 900 }}>
                                {mergeFields.length} field(s)
                                <div style={{ marginTop: 4, color: "#475569", fontSize: 12, lineHeight: 1.45 }}>
                                  Visible UI: {visibilityCounts.visible_ui} · Hidden/internal: {visibilityCounts.hidden_internal} · Computed: {visibilityCounts.computed} · System: {visibilityCounts.system} · Showing: {displayedMergeFields.length}
                                </div>
                              </summary>
                              <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                                {displayedMergeFields.map((field) => (
                                  <div
                                    key={field.key}
                                    style={{
                                      border: "1px solid #e5e7eb",
                                      borderRadius: 10,
                                      padding: 8,
                                      background: "#f8fafc",
                                    }}
                                  >
                                    <div style={{ fontWeight: 900 }}>
                                      {display(field.label)} <span style={{ color: "#64748b" }}>({field.key})</span>
                                      <span style={{ color: "#4f46e5", fontWeight: 900 }}> [{display(mergeFieldVisibility(field))}]</span>
                                    </div>
                                    <div style={{ color: "#64748b", fontSize: 12 }}>
                                      Source: {display(field.source)} · Visibility: {display(mergeFieldVisibility(field))} · Required: {field.required ? "Yes" : "No"}
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
