"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type EditState = {
  label: string;
  category: string;
  defaultFilenameSuffix: string;
  outputFormat: string;
  description: string;
  generationEndpoint: string;
  defaultSignerMode: string;
  defaultContactDisplayMode: string;
};

function display(value: unknown, fallback = "—"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function buttonStyle(disabled = false): React.CSSProperties {
  return {
    border: "1px solid #1e3a8a",
    borderRadius: "8px",
    background: "#1e3a8a",
    color: "#ffffff",
    fontWeight: 900,
    padding: "9px 12px",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
    textDecoration: "none",
    display: "inline-block",
  };
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "10px 12px",
  fontSize: "14px",
  background: "#ffffff",
  color: "#0f172a",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 900,
  color: "#0f172a",
  marginBottom: 6,
};

function cardStyle(): React.CSSProperties {
  return {
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    background: "#ffffff",
    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.05)",
    padding: 18,
  };
}

function statusFrom(template: any) {
  const metadata = template?.metadata || {};
  const versionStatus = String(template?.currentVersion?.status || "").trim().toLowerCase();
  if (metadata.deleted === true || versionStatus === "deleted") return "Deleted";
  if (metadata.archived === true || versionStatus === "archived") return "Archived";
  if (template?.enabled === false) return "Inactive";
  if (versionStatus === "production-ready" || metadata.productionTemplateReady === true) return "Production Ready";
  if (versionStatus === "draft") return "Draft";
  return "Inactive";
}

function initialEditState(template: any): EditState {
  const metadata = template?.metadata || {};
  return {
    label: String(template?.label || ""),
    category: String(template?.category || "general"),
    defaultFilenameSuffix: String(template?.defaultFilenameSuffix || ""),
    outputFormat: String(template?.outputFormat || "docx"),
    description: String(template?.description || ""),
    generationEndpoint: String(template?.generationEndpoint || ""),
    defaultSignerMode: String(metadata.defaultSignerMode || "signed_in_user"),
    defaultContactDisplayMode: String(metadata.defaultContactDisplayMode || "signer"),
  };
}

export default function AdminDocumentTemplateDetailPage() {
  const params = useParams();
  const key = useMemo(() => decodeURIComponent(String(params?.key || "")), [params?.key]);

  const [data, setData] = useState<any>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [replacementLabel, setReplacementLabel] = useState("");
  const [replacementMessage, setReplacementMessage] = useState("");
  const [replacingDocx, setReplacingDocx] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  async function loadTemplateDetail() {
    if (!key) return;
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/documents/templates/detail?key=${encodeURIComponent(key)}&category=all`, { cache: "no-store" });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Template detail lookup failed.");
      }
      setData(json);
      setEdit(initialEditState(json.template || {}));
      setStatusMessage("");
    } catch (caught: any) {
      setError(caught?.message || "Template detail lookup failed.");
      setData(null);
      setEdit(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTemplateDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function updateEdit(field: keyof EditState, value: string) {
    setEdit((current) => current ? { ...current, [field]: value } : current);
  }

  async function saveMetadata() {
    if (!edit) return;

    setSaving(true);
    setError("");
    setStatusMessage("Saving template metadata…");

    try {
      const response = await fetch("/api/documents/templates/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ key, ...edit }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Template update failed.");
      }
      setStatusMessage("Template metadata saved.");
      await loadTemplateDetail();
    } catch (caught: any) {
      setError(caught?.message || "Template update failed.");
      setStatusMessage("Template metadata save failed.");
    } finally {
      setSaving(false);
    }
  }

  const template = data?.template || {};
  async function replaceDocxVersion() {
    if (!replacementFile) {
      setReplacementMessage("Select a replacement .docx file first.");
      return;
    }
    if (!replacementFile.name.toLowerCase().endsWith(".docx")) {
      setReplacementMessage("Replacement file must be a .docx Word template.");
      return;
    }

    setReplacingDocx(true);
    setReplacementMessage("");
    try {
      const previewForm = new FormData();
      previewForm.append("templateKey", key);
      previewForm.append("replacementLabel", replacementLabel || replacementFile.name.replace(/\.docx$/i, ""));
      previewForm.append("file", replacementFile);
      previewForm.append("apply", "false");

      const previewResponse = await fetch("/api/documents/templates/replace-version", {
        method: "POST",
        body: previewForm,
      });
      const preview = await previewResponse.json().catch(() => ({}));
      if (!previewResponse.ok || preview?.ok === false) {
        throw new Error(preview?.error || "Replacement preview failed.");
      }

      const previewDetails = preview?.preview || preview;
      const nextVersionNumber = previewDetails?.nextVersionNumber || "next";
      const warnings = Array.isArray(preview?.warnings) && preview.warnings.length ? "\n\nWarnings:\n- " + preview.warnings.join("\n- ") : "";
      const confirmed = window.confirm(
        "Upload replacement DOCX for " + (template?.label || key) + "?\n\n" +
        "This creates a new template version and makes it current. It preserves prior versions and does not generate documents, upload to Clio, send email, create drafts, print, or queue documents.\n\n" +
        "Replacement file: " + replacementFile.name + "\n" +
        "Next version: v" + nextVersionNumber + warnings
      );

      if (!confirmed) {
        setReplacementMessage("Replacement cancelled. No database records changed.");
        return;
      }

      const applyForm = new FormData();
      applyForm.append("templateKey", key);
      applyForm.append("replacementLabel", replacementLabel || replacementFile.name.replace(/\.docx$/i, ""));
      applyForm.append("file", replacementFile);
      applyForm.append("apply", "true");

      const applyResponse = await fetch("/api/documents/templates/replace-version", {
        method: "POST",
        body: applyForm,
      });
      const applied = await applyResponse.json().catch(() => ({}));
      if (!applyResponse.ok || applied?.ok === false) {
        throw new Error(applied?.error || "Replacement upload failed.");
      }

      setReplacementMessage("Uploaded replacement DOCX as v" + (applied?.version?.versionNumber || nextVersionNumber) + ". Prior versions were preserved.");
      setReplacementFile(null);
      setReplacementLabel("");
      await loadTemplateDetail();
    } catch (error: any) {
      setReplacementMessage(error?.message || "Replacement upload failed.");
    } finally {
      setReplacingDocx(false);
    }
  }

  const currentVersion = template?.currentVersion || null;
  const mergeFields = Array.isArray(template?.mergeFields) ? template.mergeFields : [];
  const versions = Array.isArray(template?.versions) ? template.versions : [];

  return (
    <main
      data-barsh-admin-document-template-detail="true"
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#0f172a",
        padding: "32px 40px",
        width: "100%",
        maxWidth: "none",
        margin: 0,
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ display: "grid", gap: 18, width: "100%" }}>
        <section style={{ ...cardStyle(), display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <a href="/admin/document-templates/view" style={{ color: "#1e3a8a", fontWeight: 900, textDecoration: "none" }}>
                ← Back to View Templates
              </a>
              <h1 style={{ margin: "12px 0 4px", fontSize: 34, lineHeight: 1.1 }}>
                {display(template?.label, "Edit Template")}
              </h1>
              <div style={{ color: "#64748b", fontWeight: 800 }}>{display(template?.key || key)}</div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <span style={buttonStyle(false)}>{statusFrom(template)}</span>
              {currentVersion?.hasStoredDocx && currentVersion?.storedDocxUrl ? (
                <a href={currentVersion.storedDocxUrl} style={buttonStyle(false)}>
                  Download DOCX
                </a>
              ) : null}
              <button type="button" onClick={loadTemplateDetail} style={buttonStyle(false)}>
                Refresh
              </button>
            </div>
          </div>

          {loading && <div style={{ color: "#64748b", fontWeight: 800 }}>Loading template detail…</div>}
          {statusMessage && (
            <div style={{ border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e3a8a", borderRadius: 12, padding: 12, fontWeight: 900 }}>
              {statusMessage}
            </div>
          )}
          {error && (
            <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 12, padding: 12, fontWeight: 900 }}>
              {error}
            </div>
          )}
        </section>

        {data?.ok && edit && (
          <>
            <section style={cardStyle()}>
              <h2 style={{ margin: "0 0 14px", fontSize: 24 }}>Template Settings</h2>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Display name</label>
                  <input value={edit.label} onChange={(event) => updateEdit("label", event.target.value)} style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Category</label>
                  <select value={edit.category} onChange={(event) => updateEdit("category", event.target.value)} style={inputStyle}>
                    <option value="correspondence">Correspondence</option>
                    <option value="pleadings">Pleadings</option>
                    <option value="discovery">Discovery</option>
                    <option value="general">General</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Default filename suffix</label>
                  <input value={edit.defaultFilenameSuffix} onChange={(event) => updateEdit("defaultFilenameSuffix", event.target.value)} style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Output format</label>
                  <input value={edit.outputFormat} onChange={(event) => updateEdit("outputFormat", event.target.value)} style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Default signer</label>
                  <select value={edit.defaultSignerMode} onChange={(event) => updateEdit("defaultSignerMode", event.target.value)} style={inputStyle}>
                    <option value="signed_in_user">Signed-in generating user</option>
                    <option value="select_at_generation">Select during generation</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Default contact display</label>
                  <select value={edit.defaultContactDisplayMode} onChange={(event) => updateEdit("defaultContactDisplayMode", event.target.value)} style={inputStyle}>
                    <option value="signer">Signer contact</option>
                    <option value="firm">Firm contact</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Generation endpoint</label>
                  <input value={edit.generationEndpoint} onChange={(event) => updateEdit("generationEndpoint", event.target.value)} style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Description</label>
                  <input value={edit.description} onChange={(event) => updateEdit("description", event.target.value)} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
                <button type="button" onClick={saveMetadata} disabled={saving} style={buttonStyle(saving)}>
                  {saving ? "Saving…" : "Save Template Settings"}
                </button>
                <div data-barsh-admin-document-template-replace-docx="true" style={{ gridColumn: "1 / -1", marginTop: 10, border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 14, padding: 14, display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16 }}>Replace DOCX / Upload New Version</h3>
                      <p style={{ margin: "6px 0 0", color: "#475569", lineHeight: 1.45 }}>
                        Upload a corrected .docx to create a new version and make it current. Prior versions are preserved. This does not generate documents, upload to Clio, send email, create drafts, print, or queue documents.
                      </p>
                    </div>
                    <span data-barsh-admin-document-template-replace-docx-versioning-note="true" style={{ border: "1px solid #93c5fd", background: "#ffffff", color: "#1e3a8a", borderRadius: 999, padding: "7px 10px", fontWeight: 950, fontSize: 12 }}>
                      Append-only versioning
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) minmax(220px, 0.7fr) auto", gap: 10, alignItems: "end" }}>
                    <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
                      Replacement DOCX
                      <input data-barsh-admin-document-template-replace-docx-file="true" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => { setReplacementFile(event.currentTarget.files?.[0] || null); setReplacementMessage(""); }} style={inputStyle} />
                    </label>
                    <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
                      Replacement label
                      <input data-barsh-admin-document-template-replace-docx-label="true" value={replacementLabel} onChange={(event) => setReplacementLabel(event.target.value)} placeholder={replacementFile?.name?.replace(/\.docx$/i, "") || "Optional"} style={inputStyle} />
                    </label>
                    <button data-barsh-admin-document-template-replace-docx-button="true" type="button" onClick={() => void replaceDocxVersion()} disabled={replacingDocx || !replacementFile} style={buttonStyle(replacingDocx || !replacementFile)}>
                      {replacingDocx ? "Uploading…" : "Upload New Version"}
                    </button>
                  </div>
                  {replacementMessage ? (
                    <div data-barsh-admin-document-template-replace-docx-message="true" style={{ color: replacementMessage.toLowerCase().includes("failed") || replacementMessage.toLowerCase().includes("must") ? "#991b1b" : "#166534", fontWeight: 900 }}>
                      {replacementMessage}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              {[
                ["Status", statusFrom(template)],
                ["Version", currentVersion ? `v${currentVersion.versionNumber}` : "No DB version"],
                ["Stored DOCX", currentVersion?.hasStoredDocx ? `${currentVersion.storedDocxBytes || 0} bytes` : "No"],
                ["Repository", display(template?.repositorySource)],
                ["Current Version ID", display(template?.currentVersionId)],
                ["Merge Fields", String(mergeFields.length)],
              ].map(([label, value]) => (
                <div key={label} style={cardStyle()}>
                  <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".06em" }}>
                    {label}
                  </div>
                  <div style={{ marginTop: 6, fontWeight: 950, overflowWrap: "anywhere" }}>{value}</div>
                </div>
              ))}
            </section>

            <section style={cardStyle()}>
              <h2 style={{ margin: "0 0 12px", fontSize: 24 }}>Merge Fields</h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse" }}>
                  <thead style={{ background: "#1e3a8a", color: "#ffffff" }}>
                    <tr>
                      <th style={{ padding: 10, textAlign: "left" }}>Key</th>
                      <th style={{ padding: 10, textAlign: "left" }}>Label</th>
                      <th style={{ padding: 10, textAlign: "left" }}>Source</th>
                      <th style={{ padding: 10, textAlign: "left" }}>Required</th>
                      <th style={{ padding: 10, textAlign: "left" }}>Visibility</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mergeFields.map((field: any) => (
                      <tr key={field.id || field.key} style={{ borderTop: "1px solid #e2e8f0" }}>
                        <td style={{ padding: 10, fontWeight: 900 }}>{display(field.key)}</td>
                        <td style={{ padding: 10 }}>{display(field.label)}</td>
                        <td style={{ padding: 10 }}>{display(field.source)}</td>
                        <td style={{ padding: 10 }}>{field.required ? "Yes" : "No"}</td>
                        <td style={{ padding: 10 }}>{display(field.visibility)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section style={cardStyle()}>
              <h2 style={{ margin: "0 0 12px", fontSize: 24 }}>Versions</h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse" }}>
                  <thead style={{ background: "#1e3a8a", color: "#ffffff" }}>
                    <tr>
                      <th style={{ padding: 10, textAlign: "left" }}>Version</th>
                      <th style={{ padding: 10, textAlign: "left" }}>Status</th>
                      <th style={{ padding: 10, textAlign: "left" }}>Storage</th>
                      <th style={{ padding: 10, textAlign: "left" }}>Stored DOCX</th>
                      <th style={{ padding: 10, textAlign: "left" }}>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((version: any) => (
                      <tr key={version.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                        <td style={{ padding: 10, fontWeight: 900 }}>v{version.versionNumber}</td>
                        <td style={{ padding: 10 }}>{display(version.status)}</td>
                        <td style={{ padding: 10 }}>{display(version.storageKind)}</td>
                        <td style={{ padding: 10 }}>
                          {version.hasStoredDocx && version.storedDocxUrl ? <a href={version.storedDocxUrl} style={{ color: "#1e3a8a", fontWeight: 900 }}>Download</a> : "No"}
                        </td>
                        <td style={{ padding: 10 }}>{display(version.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
