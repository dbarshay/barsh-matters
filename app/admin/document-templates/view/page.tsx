"use client";

import { bmConfirm, bmAlert } from "@/app/components/BmDialogHost";
import { useEffect, useMemo, useState } from "react";
import BarshHeader from "@/app/components/BarshHeader";

type TemplateRow = {
  key: string;
  label: string;
  category?: string;
  enabled?: boolean;
  editableInRepository?: boolean;
  repositoryStatus?: string;
  currentVersion?: {
    id?: string;
    versionNumber?: number;
    status?: string;
    storageKind?: string;
    hasStoredDocx?: boolean;
    storedDocxBytes?: number;
    storedDocxUrl?: string;
    uploadedTemplateFile?: {
      name?: string;
      size?: number;
      actualFileStored?: boolean;
    };
  } | null;
  currentVersionId?: string | null;
  metadata?: Record<string, any> | null;
  mergeFields?: Array<{ key?: string }>;
  updatedAt?: string;
  createdAt?: string;
  lastEditedAt?: string;
  lastEditedBy?: string;
};

const filters = ["All", "Production Ready", "Inactive", "Draft", "Archived", "Deleted"];

function displayStatus(template: TemplateRow) {
  const versionStatus = String(template.currentVersion?.status || "").trim().toLowerCase();
  const metadata = template.metadata || {};

  if (metadata.deleted === true || versionStatus === "deleted") return "Deleted";
  if (metadata.archived === true || versionStatus === "archived") return "Archived";
  if (template.enabled === false) return "Inactive";
  if (versionStatus === "draft") return "Draft";
  if (versionStatus === "production-ready" || metadata.productionTemplateReady === true) return "Production Ready";
  return "Inactive";
}

function defaultSignature(template: TemplateRow) {
  const metadata = template.metadata || {};
  const signerMode = String(metadata.defaultSignerMode || "").trim();
  const contactMode = String(metadata.defaultContactDisplayMode || "").trim();

  if (signerMode === "signed_in_user" && contactMode === "signer") return "Signed-in user / signer";
  if (signerMode === "signed_in_user" && contactMode === "firm") return "Signed-in user / firm";
  if (signerMode === "select_at_generation" && contactMode === "signer") return "Select at generation / signer";
  if (signerMode === "select_at_generation" && contactMode === "firm") return "Select at generation / firm";
  if (contactMode === "signer") return "Signer";
  if (contactMode === "firm") return "Firm";
  return "Not set";
}

function lastEdited(template: TemplateRow) {
  const value = template.lastEditedAt || template.updatedAt || template.createdAt;
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function lifecycleActionsFor(status: string) {
  if (status === "Deleted") return ["Restore"];
  if (status === "Production Ready") return ["Deactivate", "Archive", "Delete"];
  if (status === "Inactive") return ["Make Production Ready", "Archive", "Delete"];
  if (status === "Draft") return ["Make Production Ready", "Archive", "Delete"];
  return ["Make Production Ready", "Delete"];
}

const liveActionStyle: React.CSSProperties = {
  display: "inline-block",
  border: "1px solid #00346e",
  borderRadius: "8px",
  background: "#00346e",
  color: "#ffffff",
  fontWeight: 800,
  padding: "7px 10px",
  textDecoration: "none",
  margin: "0 6px 6px 0",
  fontSize: "13px",
};

const lifecycleActionStyle: React.CSSProperties = {
  border: "1px solid #00346e",
  borderRadius: "8px",
  background: "#00346e",
  color: "#ffffff",
  fontWeight: 800,
  padding: "7px 10px",
  margin: "0 6px 6px 0",
  fontSize: "13px",
  cursor: "pointer",
};

export default function ViewTemplatesPage() {
  const [filter, setFilter] = useState("All");
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [statusMessage, setStatusMessage] = useState("Loading templates…");
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");

  async function loadTemplates() {
    setStatusMessage("Loading templates…");
    setError("");

    try {
      const response = await fetch("/api/documents/templates?category=all&includeInactive=1", { cache: "no-store" });
      if (!response.ok) throw new Error("Template repository request failed with status " + response.status);
      const payload = await response.json();
      const nextTemplates = Array.isArray(payload.templates) ? payload.templates : [];
      setTemplates(nextTemplates);
      setStatusMessage("Loaded " + nextTemplates.length + " repository template" + (nextTemplates.length === 1 ? "" : "s") + ".");
    } catch (caught) {
      setTemplates([]);
      setStatusMessage("Template repository could not be loaded.");
      setError(caught instanceof Error ? caught.message : "Unknown template repository error.");
    }
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  async function runLifecycleAction(template: TemplateRow, actionLabel: string) {
    const actionMap: Record<string, string> = {
      "Make Production Ready": "make-active",
      Deactivate: "deactivate",
      Archive: "archive",
      Delete: "delete",
      Restore: "restore",
    };
    const action = actionMap[actionLabel];
    if (!action) return;

    const confirmed = await bmConfirm(actionLabel + " template “" + (template.label || template.key) + "”?\n\nProduction Ready makes this template active in the template repository.");
    if (!confirmed) return;

    setBusyKey(template.key + ":" + action);
    setError("");
    setStatusMessage(actionLabel + " in progress…");

    try {
      const response = await fetch("/api/documents/templates/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ key: template.key, action }),
      });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Lifecycle action failed.");
      }
      setStatusMessage(actionLabel + " completed for " + (template.label || template.key) + ".");
      await loadTemplates();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown lifecycle action error.");
      setStatusMessage(actionLabel + " failed.");
    } finally {
      setBusyKey("");
    }
  }

  const visibleRows = useMemo(() => {
    return templates
      .map((template) => ({ template, status: displayStatus(template) }))
      .filter((row) => {
        if (filter === "All") return row.status !== "Deleted";
        return row.status === filter;
      });
  }, [templates, filter]);

  return (
    <main style={{ padding: "32px 40px", width: "100%", maxWidth: "none", margin: "0" }}>
      <BarshHeader />
      <a href="/admin/document-templates" style={{ color: "#00346e", fontWeight: 700 }}>Back to Document Templates</a>
      <h1 style={{ margin: "18px 0 10px", fontSize: "30px", color: "#00346e" }}>View Templates</h1>
      <section
        data-template-view-repository-status="true"
        style={{
          margin: "0 0 18px",
          padding: "12px 14px",
          borderRadius: "10px",
          border: "1px solid " + (error ? "#fecaca" : "#bfdbfe"),
          background: error ? "#fef2f2" : "#eff6ff",
          color: error ? "#991b1b" : "#00346e",
          fontWeight: 800,
        }}
      >
        {statusMessage}
        {error ? <div style={{ marginTop: "6px", fontWeight: 700 }}>{error}</div> : null}
      </section>

      <section style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "18px" }}>
        {filters.map((item) => (
          <button key={item} type="button" onClick={() => setFilter(item)} style={{ padding: "9px 14px", borderRadius: "999px", border: "1px solid #00346e", background: "#00346e", color: "#ffffff", fontWeight: 700, opacity: filter === item ? 1 : 0.82 }}>
            {item}
          </button>
        ))}
      </section>

      <div style={{ overflowX: "auto", border: "1px solid #cbd5e1", borderRadius: "12px", width: "100%" }}>
        <table style={{ width: "100%", minWidth: "1320px", borderCollapse: "collapse", background: "#ffffff" }}>
          <thead style={{ background: "#00346e", color: "#ffffff" }}>
            <tr>
              <th style={{ padding: "12px", textAlign: "left" }}>Name</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Status</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Category</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Version</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Last Edited</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Last Edited By</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Default Signature</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Stored DOCX</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Fields</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: "18px", color: "#385a83" }}>
                  No templates match this filter.
                </td>
              </tr>
            ) : (
              visibleRows.map(({ template, status }) => (
                <tr key={template.key} data-template-view-row={template.key} style={{ borderTop: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "12px" }}>
                    <a href={"/admin/document-templates/" + encodeURIComponent(template.key)} style={{ color: "#00346e", fontWeight: 800 }}>
                      {template.label || template.key}
                    </a>
                    <div style={{ marginTop: "4px", color: "#385a83", fontSize: "12px" }}>{template.key}</div>
                  </td>
                  <td style={{ padding: "12px" }}>{status}</td>
                  <td style={{ padding: "12px" }}>{template.category || "—"}</td>
                  <td style={{ padding: "12px" }}>{template.currentVersion?.versionNumber || "—"}</td>
                  <td style={{ padding: "12px" }}>{lastEdited(template)}</td>
                  <td style={{ padding: "12px" }}>{template.lastEditedBy || "System"}</td>
                  <td style={{ padding: "12px" }}>{defaultSignature(template)}</td>
                  <td style={{ padding: "12px" }}>
                    {template.currentVersion?.hasStoredDocx ? "Yes" : "No"}
                    {template.currentVersion?.uploadedTemplateFile?.name ? (
                      <div style={{ marginTop: "4px", color: "#385a83", fontSize: "12px" }}>{template.currentVersion.uploadedTemplateFile.name}</div>
                    ) : null}
                  </td>
                  <td style={{ padding: "12px" }}>{Array.isArray(template.mergeFields) ? template.mergeFields.length : 0}</td>
                  <td style={{ padding: "12px", minWidth: "360px" }}>
                    <a href={"/admin/document-templates/" + encodeURIComponent(template.key)} style={liveActionStyle}>
                      Edit Template
                    </a>
                    {lifecycleActionsFor(status).map((action) => {
                      const actionKey = template.key + ":" + ({
                        "Make Production Ready": "make-active",
                        Deactivate: "deactivate",
                        Archive: "archive",
                        Delete: "delete",
                        Restore: "restore",
                      } as Record<string, string>)[action];

                      return (
                        <button
                          key={action}
                          type="button"
                          disabled={busyKey === actionKey}
                          onClick={() => runLifecycleAction(template, action)}
                          style={{
                            ...lifecycleActionStyle,
                            opacity: busyKey === actionKey ? 0.65 : 1,
                            cursor: busyKey === actionKey ? "wait" : "pointer",
                          }}
                        >
                          {busyKey === actionKey ? action + "…" : action}
                        </button>
                      );
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </main>
  );
}
