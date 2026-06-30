"use client";

import BarshHeader from "@/app/components/BarshHeader";
import BarshHeaderActions from "@/app/components/BarshHeaderActions";
import BarshHeaderQuickNav from "@/app/components/BarshHeaderQuickNav";

import React, { useEffect, useMemo, useState } from "react";

type Severity = "critical" | "warning" | "info";
type AuditStatus = "pass" | "review";

type SampleRow = {
  matter_id: number;
  display_number?: string | null;
  patient_name?: string | null;
  provider_name?: string | null;
  client_name?: string | null;
  insurer_name?: string | null;
  claim_number_raw?: string | null;
  claim_number_normalized?: string | null;
  claim_amount?: number | null;
  payment_amount?: number | null;
  balance_amount?: number | null;
  status?: string | null;
  final_status?: string | null;
  close_reason?: string | null;
  master_lawsuit_id?: string | null;
  indexed_at?: string | null;
  issue_detail?: string | null;
};

type AuditCheck = {
  id: string;
  label: string;
  severity: Severity;
  status: AuditStatus;
  count: number;
  description: string;
  sampleRows: SampleRow[];
};

type CountBucket = {
  label: string;
  count: number;
};

type AuditResult = {
  ok?: boolean;
  readOnly?: boolean;
  sourceOfTruth?: string;
  generatedAt?: string;
  staleIndexedAtDays?: number;
  summary?: {
    totalRows: number;
    linkedRows: number;
    localLawsuitCount: number;
    closedLocalLawsuitCount: number;
    checksRun: number;
    checksWithFindings: number;
    criticalIssues: number;
    warningIssues: number;
    infoIssues: number;
  };
  counts?: {
    status: CountBucket[];
    finalStatus: CountBucket[];
    closeReason: CountBucket[];
    masterLawsuitPresence: CountBucket[];
  };
  checks?: AuditCheck[];
  safety?: string;
  error?: string;
};

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
  padding: "9px 8px",
  verticalAlign: "top",
  fontSize: 13,
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function money(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function dateText(value: unknown): string {
  const text = clean(value);
  if (!text) return "";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleString();
}

function csvCell(value: unknown): string {
  const text = clean(value).replace(/\r?\n/g, " ");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function severityStyle(severity: Severity): React.CSSProperties {
  if (severity === "critical") {
    return { color: "#991b1b", background: "#fee2e2", border: "1px solid #fecaca" };
  }
  if (severity === "warning") {
    return { color: "#92400e", background: "#fef3c7", border: "1px solid #fde68a" };
  }
  return { color: "#1e3a8a", background: "#eff6ff", border: "1px solid #bfdbfe" };
}

function statusText(check: AuditCheck): string {
  if (check.count > 0) return "Review";
  return "Pass";
}

function exportAuditCsv(result: AuditResult) {
  const headers = [
    "Check ID",
    "Check",
    "Severity",
    "Status",
    "Count",
    "Description",
    "Matter ID",
    "Display Number",
    "Patient",
    "Provider",
    "Client",
    "Insurer",
    "Claim Number",
    "Claim Number Normalized",
    "Claim Amount",
    "Payment Amount",
    "Balance Amount",
    "Final Status",
    "Closed Reason",
    "Master Lawsuit ID",
    "Issue Detail",
  ];

  const rows = (result.checks || []).flatMap((check) => {
    if (!check.sampleRows?.length) {
      return [[
        check.id,
        check.label,
        check.severity,
        statusText(check),
        check.count,
        check.description,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ]];
    }

    return check.sampleRows.map((row) => [
      check.id,
      check.label,
      check.severity,
      statusText(check),
      check.count,
      check.description,
      row.matter_id,
      row.display_number,
      row.patient_name,
      row.provider_name,
      row.client_name,
      row.insurer_name,
      row.claim_number_raw,
      row.claim_number_normalized,
      row.claim_amount,
      row.payment_amount,
      row.balance_amount,
      row.final_status,
      row.close_reason,
      row.master_lawsuit_id,
      row.issue_detail,
    ]);
  });

  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `claimindex-data-quality-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
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

function CountTable({ title, rows }: { title: string; rows: CountBucket[] }) {
  return (
    <section style={cardStyle}>
      <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>{title}</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Value</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Count</th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((row) => (
              <tr key={`${title}-${row.label}`}>
                <td style={tdStyle}>{row.label}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 900 }}>{row.count}</td>
              </tr>
            ))}
            {!rows?.length ? (
              <tr>
                <td style={tdStyle} colSpan={2}>No rows.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function AdminClaimIndexAuditPage() {
  const [result, setResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Loading ClaimIndex data-quality audit...");

  async function loadAudit() {
    setLoading(true);
    setMessage("Auditing local ClaimIndex data quality...");
    try {
      const response = await fetch("/api/admin/claim-index/audit", { cache: "no-store" });
      const data = (await response.json()) as AuditResult;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Admin ClaimIndex data-quality audit failed.");
      }
      setResult(data);
      setMessage(
        `Audit complete: ${data.summary?.checksWithFindings ?? 0} of ${data.summary?.checksRun ?? 0} check(s) have findings.`
      );
    } catch (err: any) {
      setMessage(err?.message || "Admin ClaimIndex data-quality audit failed.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAudit();
  }, []);

  const checks = useMemo(() => result?.checks || [], [result]);
  const checksWithFindings = checks.filter((check) => check.count > 0);

  return (
    <main data-barsh-admin-claim-index-audit="read-only" style={pageStyle}>
      <div style={{ maxWidth: "none", margin: 0, display: "grid", gap: 18 }}>
        <BarshHeader />

        <header style={{ ...cardStyle, display: "grid", gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 950, color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Administrator
          </div>
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1 }}>ClaimIndex Data-Quality Audit</h1>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.45, maxWidth: 980 }}>
            Restore-confidence audit of the local ClaimIndex table. This page identifies missing identity fields,
            close-status inconsistencies, lawsuit grouping issues, and financial review flags.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => void loadAudit()} disabled={loading} style={buttonStyle}>
              {loading ? "Refreshing..." : "Refresh Audit"}
            </button>
            <button
              type="button"
              onClick={() => result && exportAuditCsv(result)}
              disabled={!result}
              style={{ ...secondaryButtonStyle, opacity: result ? 1 : 0.55 }}
            >
              Export Audit CSV
            </button>
            <a href="/admin/lawsuits/audit" style={secondaryButtonStyle}>
              Lawsuit / Master Audit
            </a>
            <a href="/admin/claim-index" style={secondaryButtonStyle}>
              Open ClaimIndex Viewer
            </a>
            <a href="/admin" style={secondaryButtonStyle}>
              Back to Admin Home
            </a>
          </div>
        </header>

        <section style={{ ...cardStyle, borderColor: result?.summary?.criticalIssues ? "#fecaca" : "#bbf7d0", background: result?.summary?.criticalIssues ? "#fff7f7" : "#f0fdf4" }}>
          <strong>Status:</strong> {message}
          {result?.generatedAt ? (
            <span style={{ color: "#64748b" }}> Generated {dateText(result.generatedAt)}.</span>
          ) : null}
        </section>

        {result ? (
          <>
            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
              <SummaryCard label="ClaimIndex rows" value={result.summary?.totalRows ?? 0} />
              <SummaryCard label="Checks with findings" value={result.summary?.checksWithFindings ?? 0} note={`${result.summary?.checksRun ?? 0} checks run`} />
              <SummaryCard label="Critical issues" value={result.summary?.criticalIssues ?? 0} />
              <SummaryCard label="Warnings" value={result.summary?.warningIssues ?? 0} />
              <SummaryCard label="Linked rows" value={result.summary?.linkedRows ?? 0} note="Rows with master_lawsuit_id" />
              <SummaryCard label="Local lawsuits" value={result.summary?.localLawsuitCount ?? 0} note={`${result.summary?.closedLocalLawsuitCount ?? 0} closed by local options`} />
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              <CountTable title="Counts by final_status" rows={result.counts?.finalStatus || []} />
              <CountTable title="Counts by close_reason" rows={result.counts?.closeReason || []} />
              <CountTable title="Counts by status" rows={result.counts?.status || []} />
              <CountTable title="Master lawsuit link presence" rows={result.counts?.masterLawsuitPresence || []} />
            </section>

            <section style={cardStyle}>
              <h2 style={{ margin: "0 0 12px", fontSize: 22 }}>Audit Checks</h2>
              <div style={{ display: "grid", gap: 12 }}>
                {checks.map((check) => (
                  <article
                    key={check.id}
                    data-barsh-admin-claim-index-audit-check={check.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 18,
                      padding: 14,
                      display: "grid",
                      gap: 10,
                      background: check.count > 0 ? "#fff" : "#f8fafc",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 18 }}>{check.label}</h3>
                        <p style={{ margin: "6px 0 0", color: "#475569", lineHeight: 1.4 }}>{check.description}</p>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ ...severityStyle(check.severity), borderRadius: 999, padding: "6px 10px", fontWeight: 950, textTransform: "uppercase", fontSize: 12 }}>
                          {check.severity}
                        </span>
                        <span style={{ border: "1px solid #cbd5e1", borderRadius: 999, padding: "6px 10px", fontWeight: 950 }}>
                          {statusText(check)} · {check.count}
                        </span>
                      </div>
                    </div>

                    {check.sampleRows?.length ? (
                      <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 14 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
                          <thead>
                            <tr>
                              <th style={thStyle}>Matter ID</th>
                              <th style={thStyle}>Display #</th>
                              <th style={thStyle}>Patient</th>
                              <th style={thStyle}>Provider / Client</th>
                              <th style={thStyle}>Insurer</th>
                              <th style={thStyle}>Claim #</th>
                              <th style={thStyle}>Final Status</th>
                              <th style={thStyle}>Closed Reason</th>
                              <th style={thStyle}>Master Lawsuit</th>
                              <th style={thStyle}>Claim</th>
                              <th style={thStyle}>Payment</th>
                              <th style={thStyle}>Balance</th>
                              <th style={thStyle}>Detail</th>
                            </tr>
                          </thead>
                          <tbody>
                            {check.sampleRows.map((row) => (
                              <tr key={`${check.id}-${row.matter_id}-${row.issue_detail || ""}`}>
                                <td style={tdStyle}>{row.matter_id}</td>
                                <td style={tdStyle}>{row.display_number || ""}</td>
                                <td style={tdStyle}>{row.patient_name || ""}</td>
                                <td style={tdStyle}>{row.provider_name || row.client_name || ""}</td>
                                <td style={tdStyle}>{row.insurer_name || ""}</td>
                                <td style={tdStyle}>{row.claim_number_raw || row.claim_number_normalized || ""}</td>
                                <td style={tdStyle}>{row.final_status || ""}</td>
                                <td style={tdStyle}>{row.close_reason || ""}</td>
                                <td style={tdStyle}>{row.master_lawsuit_id || ""}</td>
                                <td style={tdStyle}>{money(row.claim_amount)}</td>
                                <td style={tdStyle}>{money(row.payment_amount)}</td>
                                <td style={tdStyle}>{money(row.balance_amount)}</td>
                                <td style={tdStyle}>{row.issue_detail || ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ color: "#166534", fontWeight: 900 }}>No sample rows for this check.</div>
                    )}
                  </article>
                ))}
              </div>
            </section>

            <section style={{ ...cardStyle, color: "#475569", lineHeight: 1.45 }}>
              API safety message: {result.safety || "Read-only ClaimIndex data-quality audit. No write actions are available."}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
