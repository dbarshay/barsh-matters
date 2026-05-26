"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

function display(value: unknown, fallback = "—"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function statusBadgeStyle(kind: "ok" | "warn" | "neutral" = "neutral"): React.CSSProperties {
  const styles: Record<string, React.CSSProperties> = {
    ok: { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534" },
    warn: { border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412" },
    neutral: { border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155" },
  };
  return {
    ...styles[kind],
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  };
}

function cardStyle(): React.CSSProperties {
  return {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    background: "#fff",
    boxShadow: "0 16px 35px rgba(15, 23, 42, 0.06)",
    padding: 18,
  };
}

function jsonBlock(value: unknown) {
  return (
    <pre
      style={{
        margin: 0,
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        fontSize: 12,
        lineHeight: 1.45,
        color: "#334155",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 12,
      }}
    >
      {JSON.stringify(value || {}, null, 2)}
    </pre>
  );
}

export default function AdminDocumentTemplateDetailPage() {
  const params = useParams();
  const key = useMemo(() => decodeURIComponent(String(params?.key || "")), [params?.key]);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadTemplateDetail() {
    if (!key) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/documents/templates/detail?key=${encodeURIComponent(key)}&category=all`,
        { cache: "no-store" }
      );
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Template detail lookup failed.");
      }
      setData(json);
    } catch (err: any) {
      setError(err?.message || "Template detail lookup failed.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTemplateDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const template = data?.template || {};
  const versions = Array.isArray(template?.versions) ? template.versions : [];
  const mergeFields = Array.isArray(template?.mergeFields) ? template.mergeFields : [];
  const currentVersion = template?.currentVersion || null;

  return (
    <main
      data-barsh-admin-document-template-detail="true"
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#0f172a",
        padding: "28px",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ ...cardStyle(), display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
            <div>
              <a href="/admin/document-templates" style={{ color: "#4f46e5", fontWeight: 900, textDecoration: "none" }}>
                ← Back to Document Templates
              </a>
              <h1 style={{ margin: "12px 0 4px", fontSize: 32, lineHeight: 1.1 }}>
                {display(template?.label, "Document Template Detail")}
              </h1>
              <div style={{ color: "#64748b", fontWeight: 800 }}>{display(template?.key || key)}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <span style={statusBadgeStyle(template?.repositorySource === "barsh-matters-db" ? "ok" : "warn")}>
                {display(template?.repositorySource, "Unknown source")}
              </span>
              <span style={statusBadgeStyle(template?.enabled === false ? "warn" : "ok")}>
                {template?.enabled === false ? "Disabled" : "Enabled"}
              </span>
              <button
                type="button"
                onClick={loadTemplateDetail}
                style={{
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  color: "#334155",
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Refresh
              </button>
            </div>
          </div>

          <p style={{ margin: 0, color: "#475569", lineHeight: 1.55 }}>
            Read-only template detail view for repository architecture, current version, prior versions,
            stored DOCX status, and merge-field inventory.  Replacement/edit workflows should create new
            versions rather than mutating historical versions.
          </p>

          {loading && <div style={{ color: "#64748b", fontWeight: 800 }}>Loading template detail...</div>}
          {error && (
            <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 14, padding: 12, fontWeight: 800 }}>
              {error}
            </div>
          )}
        </section>

        {data?.ok && (
          <>
            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              {[
                ["Category", template?.category],
                ["Output Format", template?.outputFormat],
                ["Default Filename Suffix", template?.defaultFilenameSuffix],
                ["Generation Endpoint", template?.generationEndpoint],
                ["Source of Truth", template?.sourceOfTruth],
                ["Repository Status", template?.repositoryStatus],
                ["Current Version", currentVersion ? `v${currentVersion.versionNumber}` : "No DB version"],
                ["Stored DOCX", currentVersion?.hasStoredDocx ? `${currentVersion.storedDocxBytes || 0} bytes` : "No"],
              ].map(([label, value]) => (
                <div key={label} style={cardStyle()}>
                  <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".06em" }}>
                    {label}
                  </div>
                  <div style={{ marginTop: 6, fontWeight: 950, overflowWrap: "anywhere" }}>{display(value)}</div>
                </div>
              ))}
            </section>

            <section style={cardStyle()}>
              <h2 style={{ margin: "0 0 10px", fontSize: 22 }}>Current Version</h2>
              {currentVersion ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={statusBadgeStyle("ok")}>v{currentVersion.versionNumber}</span>
                    <span style={statusBadgeStyle("neutral")}>{display(currentVersion.status)}</span>
                    <span style={statusBadgeStyle("neutral")}>{display(currentVersion.storageKind)}</span>
                    {currentVersion.hasStoredDocx && (
                      <a
                        href={currentVersion.storedDocxUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ ...statusBadgeStyle("ok"), textDecoration: "none" }}
                      >
                        Download Stored DOCX
                      </a>
                    )}
                  </div>
                  {jsonBlock(currentVersion.metadata)}
                </div>
              ) : (
                <div style={{ color: "#64748b", fontWeight: 800 }}>No DB version exists for this fallback template.</div>
              )}
            </section>

            <section style={cardStyle()}>
              <h2 style={{ margin: "0 0 10px", fontSize: 22 }}>Version History</h2>
              {versions.length === 0 ? (
                <div style={{ color: "#64748b", fontWeight: 800 }}>No version history found.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr style={{ textAlign: "left", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>
                        <th style={{ padding: "10px 8px" }}>Version</th>
                        <th style={{ padding: "10px 8px" }}>Status</th>
                        <th style={{ padding: "10px 8px" }}>Storage</th>
                        <th style={{ padding: "10px 8px" }}>Stored DOCX</th>
                        <th style={{ padding: "10px 8px" }}>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {versions.map((version: any) => (
                        <tr key={version.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "10px 8px", fontWeight: 950 }}>v{version.versionNumber}</td>
                          <td style={{ padding: "10px 8px" }}>{display(version.status)}</td>
                          <td style={{ padding: "10px 8px" }}>{display(version.storageKind)}</td>
                          <td style={{ padding: "10px 8px" }}>
                            {version.hasStoredDocx ? (
                              <a href={version.storedDocxUrl} target="_blank" rel="noreferrer" style={{ color: "#4f46e5", fontWeight: 900 }}>
                                {version.storedDocxBytes || 0} bytes
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td style={{ padding: "10px 8px" }}>{display(version.updatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section style={cardStyle()}>
              <h2 style={{ margin: "0 0 10px", fontSize: 22 }}>Merge Fields</h2>
              {mergeFields.length === 0 ? (
                <div style={{ color: "#64748b", fontWeight: 800 }}>No merge fields found.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {mergeFields.map((field: any) => (
                    <div key={field.id || field.key} style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#f8fafc" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div>
                          <strong>{display(field.label || field.key)}</strong>
                          <div style={{ color: "#64748b", fontSize: 13 }}>{display(field.key)}</div>
                        </div>
                        <span style={statusBadgeStyle("neutral")}>{display(field.visibility)}</span>
                      </div>
                      <div style={{ marginTop: 8, color: "#475569", fontSize: 13 }}>
                        Source: {display(field.source)} · Required: {field.required ? "Yes" : "No"} · Example: {display(field.exampleValue)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={cardStyle()}>
              <h2 style={{ margin: "0 0 10px", fontSize: 22 }}>Planned Repository Workflows</h2>
              {jsonBlock(data?.workflows)}
            </section>

            <section style={cardStyle()}>
              <h2 style={{ margin: "0 0 10px", fontSize: 22 }}>Safety</h2>
              {jsonBlock(data?.safety)}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
