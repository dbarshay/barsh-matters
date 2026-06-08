"use client";

import BarshHeaderActions from "@/app/components/BarshHeaderActions";
import BarshHeaderQuickNav from "@/app/components/BarshHeaderQuickNav";

import React, { useEffect, useMemo, useState } from "react";

type AuditSummary = Record<string, number | string | boolean | null | undefined>;

type AuditCheckFinding = {
  id?: string;
  label?: string;
  severity?: "critical" | "warning" | "info" | string;
  count?: number;
};

type AuditResult = {
  ok?: boolean;
  readOnly?: boolean;
  sourceOfTruth?: string;
  generatedAt?: string;
  summary?: AuditSummary;
  checks?: AuditCheckFinding[];
  safety?: string;
  error?: string;
};

type DashboardAuditKey = "claimIndex" | "lawsuitMaster" | "documentReadiness";

type DashboardAuditConfig = {
  key: DashboardAuditKey;
  label: string;
  description: string;
  endpoint: string;
  detailHref: string;
  primaryMetricLabel: string;
  primaryMetricKey: string;
};

type DashboardAuditState = {
  config: DashboardAuditConfig;
  result: AuditResult | null;
  error: string;
};

const auditConfigs: DashboardAuditConfig[] = [
  {
    key: "claimIndex",
    label: "ClaimIndex Data Quality",
    description: "Local ClaimIndex identity, status, lawsuit grouping, and financial field confidence.",
    endpoint: "/api/admin/claim-index/audit",
    detailHref: "/admin/claim-index/audit",
    primaryMetricLabel: "ClaimIndex rows",
    primaryMetricKey: "totalRows",
  },
  {
    key: "lawsuitMaster",
    label: "Lawsuit / Master Integrity",
    description: "Local Lawsuit/master metadata, linked child rows, close-status consistency, and master shell mapping.",
    endpoint: "/api/admin/lawsuits/audit",
    detailHref: "/admin/lawsuits/audit",
    primaryMetricLabel: "Local lawsuits",
    primaryMetricKey: "localLawsuitCount",
  },
  {
    key: "documentReadiness",
    label: "Document Readiness",
    description: "Master metadata, child matter fields, templates, finalization records, and delivery prerequisites.",
    endpoint: "/api/admin/document-readiness/audit",
    detailHref: "/admin/document-readiness/audit",
    primaryMetricLabel: "Template versions",
    primaryMetricKey: "localDocumentTemplateVersionCount",
  },
];

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f8fafc",
  color: "#0f172a",
  padding: "28px 30px 46px",
  boxSizing: "border-box",
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 22,
  padding: 18,
  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.07)",
};

const buttonStyle: React.CSSProperties = {
  border: "1px solid #4f46e5",
  background: "#4f46e5",
  color: "#fff",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 950,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#334155",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #cbd5e1",
  padding: "10px 8px",
  fontSize: 12,
  color: "#334155",
  background: "#f8fafc",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  padding: "10px 8px",
  verticalAlign: "top",
  fontSize: 13,
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function numberValue(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function summaryNumber(summary: AuditSummary | undefined, key: string): number {
  return numberValue(summary?.[key]);
}

function dateText(value: unknown): string {
  const text = clean(value);
  if (!text) return "";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleString();
}

function findings(result: AuditResult | null): AuditCheckFinding[] {
  return (result?.checks || []).filter((check) => numberValue(check.count) > 0);
}

function criticalCount(result: AuditResult | null): number {
  return summaryNumber(result?.summary, "criticalIssues");
}

function warningCount(result: AuditResult | null): number {
  return summaryNumber(result?.summary, "warningIssues");
}

function infoCount(result: AuditResult | null): number {
  return summaryNumber(result?.summary, "infoIssues");
}

function checksRun(result: AuditResult | null): number {
  return summaryNumber(result?.summary, "checksRun");
}

function checksWithFindings(result: AuditResult | null): number {
  return summaryNumber(result?.summary, "checksWithFindings");
}

function dashboardStatus(audits: DashboardAuditState[]): {
  label: string;
  tone: "pass" | "warning" | "critical" | "loading";
  critical: number;
  warning: number;
  findings: number;
  loaded: number;
} {
  const loaded = audits.filter((audit) => audit.result?.ok).length;
  const critical = audits.reduce((sum, audit) => sum + criticalCount(audit.result), 0);
  const warning = audits.reduce((sum, audit) => sum + warningCount(audit.result), 0);
  const findings = audits.reduce((sum, audit) => sum + checksWithFindings(audit.result), 0);
  const errors = audits.filter((audit) => audit.error).length;

  if (errors || critical > 0) return { label: "Review required", tone: "critical", critical, warning, findings, loaded };
  if (warning > 0 || findings > 0) return { label: "Review warnings", tone: "warning", critical, warning, findings, loaded };
  if (loaded === audits.length) return { label: "All clear", tone: "pass", critical, warning, findings, loaded };
  return { label: "Loading", tone: "loading", critical, warning, findings, loaded };
}

function toneStyle(tone: "pass" | "warning" | "critical" | "loading"): React.CSSProperties {
  if (tone === "critical") return { color: "#991b1b", background: "#fee2e2", border: "1px solid #fecaca" };
  if (tone === "warning") return { color: "#92400e", background: "#fef3c7", border: "1px solid #fde68a" };
  if (tone === "pass") return { color: "#166534", background: "#dcfce7", border: "1px solid #bbf7d0" };
  return { color: "#334155", background: "#f8fafc", border: "1px solid #cbd5e1" };
}

function severityBadge(severity: unknown): React.CSSProperties {
  const text = clean(severity).toLowerCase();
  if (text === "critical") return toneStyle("critical");
  if (text === "warning") return toneStyle("warning");
  return { color: "#1e3a8a", background: "#eff6ff", border: "1px solid #bfdbfe" };
}

function SummaryCard({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 12, fontWeight: 950, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ marginTop: 8, fontSize: 30, fontWeight: 950 }}>{value}</div>
      {note ? <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>{note}</div> : null}
    </div>
  );
}

export default function AdminReadinessDashboardPage() {
  const [audits, setAudits] = useState<DashboardAuditState[]>(
    auditConfigs.map((config) => ({ config, result: null, error: "" }))
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Loading Admin Readiness Dashboard...");

  async function loadDashboard() {
    setLoading(true);
    setMessage("Loading read-only audit summaries...");

    const nextAudits = await Promise.all(
      auditConfigs.map(async (config) => {
        try {
          const response = await fetch(config.endpoint, { cache: "no-store" });
          const data = (await response.json()) as AuditResult;
          if (!response.ok || !data.ok) {
            throw new Error(data.error || `${config.label} failed.`);
          }
          return { config, result: data, error: "" };
        } catch (err: any) {
          return { config, result: null, error: err?.message || `${config.label} failed.` };
        }
      })
    );

    setAudits(nextAudits);
    const errors = nextAudits.filter((audit) => audit.error).length;
    setMessage(
      errors
        ? `Dashboard loaded with ${errors} audit error(s).`
        : "Dashboard loaded from read-only audit APIs."
    );
    setLoading(false);
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const status = useMemo(() => dashboardStatus(audits), [audits]);
  const allFindings = audits.flatMap((audit) =>
    findings(audit.result).map((finding) => ({
      audit: audit.config.label,
      detailHref: audit.config.detailHref,
      ...finding,
    }))
  );

  return (
    <main data-barsh-admin-readiness-dashboard="read-only" style={pageStyle}>
      <div style={{ maxWidth: 1360, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <BarshHeaderQuickNav />
          <BarshHeaderActions />
        </section>

        <header style={{ ...cardStyle, display: "grid", gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 950, color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Administrator · Read-only
          </div>
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1 }}>Admin Readiness Dashboard</h1>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.45, maxWidth: 980 }}>
            Read-only consolidated dashboard for ClaimIndex data quality, Lawsuit/master integrity, and document-generation readiness.
            This page fetches existing read-only audit APIs and summarizes their status. It does not edit, save, restore, call Clio,
            call Graph, generate documents, finalize documents, upload documents, send email, print, queue, delete records, or write to the database.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => void loadDashboard()} disabled={loading} style={buttonStyle}>
              {loading ? "Refreshing..." : "Refresh Dashboard"}
            </button>
            <a href="/admin/claim-index/audit" style={secondaryButtonStyle}>ClaimIndex Audit</a>
            <a href="/admin/lawsuits/audit" style={secondaryButtonStyle}>Lawsuit / Master Audit</a>
            <a href="/admin/document-readiness/audit" style={secondaryButtonStyle}>Document Readiness Audit</a>
            <a href="/admin" style={secondaryButtonStyle}>Back to Admin Home</a>
          </div>
        </header>

        <section style={{ ...cardStyle, ...toneStyle(status.tone) }}>
          <strong>Status:</strong> {status.label}. {message}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
          <SummaryCard label="Audits loaded" value={`${status.loaded}/${audits.length}`} />
          <SummaryCard label="Critical issues" value={status.critical} />
          <SummaryCard label="Warnings" value={status.warning} />
          <SummaryCard label="Checks with findings" value={status.findings} />
          <SummaryCard label="Total checks run" value={audits.reduce((sum, audit) => sum + checksRun(audit.result), 0)} />
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          {audits.map((audit) => {
            const result = audit.result;
            const auditTone = audit.error || criticalCount(result) > 0
              ? "critical"
              : warningCount(result) > 0 || checksWithFindings(result) > 0
                ? "warning"
                : result?.ok
                  ? "pass"
                  : "loading";

            return (
              <article key={audit.config.key} style={{ ...cardStyle, display: "grid", gap: 12 }} data-barsh-admin-readiness-dashboard-card={audit.config.key}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 20 }}>{audit.config.label}</h2>
                    <p style={{ margin: "6px 0 0", color: "#475569", lineHeight: 1.4 }}>{audit.config.description}</p>
                  </div>
                  <span style={{ ...toneStyle(auditTone), borderRadius: 999, padding: "6px 10px", fontWeight: 950, whiteSpace: "nowrap" }}>
                    {audit.error ? "Error" : auditTone === "pass" ? "Pass" : auditTone === "warning" ? "Review" : auditTone === "critical" ? "Critical" : "Loading"}
                  </span>
                </div>

                {audit.error ? (
                  <div style={{ color: "#991b1b", fontWeight: 900 }}>{audit.error}</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>{audit.config.primaryMetricLabel}</div>
                      <div style={{ fontSize: 24, fontWeight: 950 }}>{summaryNumber(result?.summary, audit.config.primaryMetricKey)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Checks</div>
                      <div style={{ fontSize: 24, fontWeight: 950 }}>{checksRun(result)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Critical</div>
                      <div style={{ fontSize: 24, fontWeight: 950 }}>{criticalCount(result)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Warnings</div>
                      <div style={{ fontSize: 24, fontWeight: 950 }}>{warningCount(result)}</div>
                    </div>
                  </div>
                )}

                {result?.generatedAt ? (
                  <div style={{ color: "#64748b", fontSize: 13 }}>Generated: {dateText(result.generatedAt)}</div>
                ) : null}

                <a href={audit.config.detailHref} style={{ ...secondaryButtonStyle, justifySelf: "start" }}>
                  Open Detail Audit
                </a>
              </article>
            );
          })}
        </section>

        <section style={cardStyle}>
          <h2 style={{ margin: "0 0 12px", fontSize: 22 }}>Findings Summary</h2>
          <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Audit</th>
                  <th style={thStyle}>Severity</th>
                  <th style={thStyle}>Check</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Count</th>
                  <th style={thStyle}>Open</th>
                </tr>
              </thead>
              <tbody>
                {allFindings.map((finding) => (
                  <tr key={`${finding.audit}-${finding.id}`}>
                    <td style={tdStyle}>{finding.audit}</td>
                    <td style={tdStyle}>
                      <span style={{ ...severityBadge(finding.severity), borderRadius: 999, padding: "5px 9px", fontWeight: 950, textTransform: "uppercase", fontSize: 12 }}>
                        {finding.severity || "info"}
                      </span>
                    </td>
                    <td style={tdStyle}>{finding.label || finding.id}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 950 }}>{finding.count ?? 0}</td>
                    <td style={tdStyle}>
                      <a href={finding.detailHref} style={{ color: "#4f46e5", fontWeight: 950 }}>Open detail →</a>
                    </td>
                  </tr>
                ))}
                {!allFindings.length ? (
                  <tr>
                    <td style={tdStyle} colSpan={5}>
                      No findings across the loaded readiness audits.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ ...cardStyle, color: "#475569", lineHeight: 1.45 }}>
          <strong>Safety:</strong> Read-only dashboard. It calls only existing read-only Admin audit endpoints with GET requests.
          It does not expose fix, edit, save, delete, restore, Clio, Graph, document-generation, finalization, upload, email, print, queue, or database-write controls.
        </section>
      </div>
    </main>
  );
}
