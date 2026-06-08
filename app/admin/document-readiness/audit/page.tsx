"use client";

import BarshHeaderActions from "@/app/components/BarshHeaderActions";
import BarshHeaderQuickNav from "@/app/components/BarshHeaderQuickNav";

import React, { useEffect, useMemo, useState } from "react";

type Severity = "critical" | "warning" | "info";

type ReadinessRow = {
  masterLawsuitId: string;
  clioMasterMatterId?: number | null;
  clioMasterDisplayNumber?: string | null;
  venue?: string | null;
  venueSelection?: string | null;
  venueOther?: string | null;
  selectedCourtDetailsPresent?: boolean;
  adversaryAttorney?: string | null;
  selectedAdversaryAttorneyDetailsPresent?: boolean;
  indexAaaNumber?: string | null;
  dateFiled?: string | null;
  dateOfLoss?: string | null;
  amountSoughtMode?: string | null;
  amountSought?: number | null;
  customAmountSought?: number | null;
  childCount?: number;
  childDisplayNumbers?: string[];
  childMatterIds?: number[];
  finalStatus?: string | null;
  closeReason?: string | null;
  issue_detail?: string | null;
};

type ChildPreview = {
  matter_id: number;
  display_number?: string | null;
  patient_name?: string | null;
  provider_name?: string | null;
  client_name?: string | null;
  treating_provider?: string | null;
  insurer_name?: string | null;
  claim_number_raw?: string | null;
  claim_number_normalized?: string | null;
  claim_amount?: number | null;
  payment_amount?: number | null;
  balance_amount?: number | null;
  bill_number?: string | null;
  dos_start?: string | null;
  dos_end?: string | null;
  date_of_loss?: string | null;
  policy_number?: string | null;
  denial_reason?: string | null;
  final_status?: string | null;
  close_reason?: string | null;
  master_lawsuit_id?: string | null;
  issue_detail?: string | null;
};

type AuditCheck = {
  id: string;
  label: string;
  severity: Severity;
  status: "pass" | "review";
  count: number;
  description: string;
  sampleRows: ReadinessRow[];
  sampleChildRows?: ChildPreview[];
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
  summary?: {
    localLawsuitCount: number;
    linkedChildMatterCount: number;
    localDocumentTemplateCount: number;
    localDocumentTemplateVersionCount: number;
    localDocumentTemplateMergeFieldCount: number;
    finalizedDocumentRecordCount: number;
    printQueueItemCount: number;
    checksRun: number;
    checksWithFindings: number;
    criticalIssues: number;
    warningIssues: number;
    infoIssues: number;
  };
  counts?: {
    venue: CountBucket[];
    amountSoughtMode: CountBucket[];
    adversaryAttorney: CountBucket[];
    masterClioShellMapping: CountBucket[];
    selectedCourtDetails: CountBucket[];
    adversaryAttorneyDetails: CountBucket[];
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
  const text = Array.isArray(value) ? value.join(" | ") : clean(value).replace(/\r?\n/g, " ");
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
  return check.count > 0 ? "Review" : "Pass";
}

function exportAuditCsv(result: AuditResult) {
  const headers = [
    "Check ID",
    "Check",
    "Severity",
    "Status",
    "Count",
    "Description",
    "Master Lawsuit ID",
    "Venue",
    "Adversary Attorney",
    "Amount Mode",
    "Index/AAA Number",
    "Clio Master",
    "Child Count",
    "Issue Detail",
    "Child Matter ID",
    "Child Display Number",
    "Child Patient",
    "Child Provider",
    "Child Insurer",
    "Child Claim Number",
    "Child Claim Amount",
    "Child DOS",
    "Child Detail",
  ];

  const rows = (result.checks || []).flatMap((check) => {
    if (check.sampleChildRows?.length && !check.sampleRows?.length) {
      return check.sampleChildRows.map((child) => [
        check.id,
        check.label,
        check.severity,
        statusText(check),
        check.count,
        check.description,
        child.master_lawsuit_id,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        child.matter_id,
        child.display_number,
        child.patient_name,
        child.provider_name || child.client_name || child.treating_provider,
        child.insurer_name,
        child.claim_number_raw || child.claim_number_normalized,
        child.claim_amount,
        `${child.dos_start || ""}${child.dos_end && child.dos_end !== child.dos_start ? ` - ${child.dos_end}` : ""}`,
        child.issue_detail,
      ]);
    }

    const sampleRows = check.sampleRows?.length ? check.sampleRows : [null];

    return sampleRows.map((row) => [
      check.id,
      check.label,
      check.severity,
      statusText(check),
      check.count,
      check.description,
      row?.masterLawsuitId,
      row?.venueSelection || row?.venue || row?.venueOther,
      row?.adversaryAttorney,
      row?.amountSoughtMode,
      row?.indexAaaNumber,
      row?.clioMasterDisplayNumber || row?.clioMasterMatterId,
      row?.childCount,
      row?.issue_detail,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
  });

  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `document-generation-readiness-audit-${new Date().toISOString().slice(0, 10)}.csv`;
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

export default function AdminDocumentReadinessAuditPage() {
  const [result, setResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Loading Document Generation Readiness Audit...");

  async function loadAudit() {
    setLoading(true);
    setMessage("Auditing local document-generation readiness...");
    try {
      const response = await fetch("/api/admin/document-readiness/audit", { cache: "no-store" });
      const data = (await response.json()) as AuditResult;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Admin Document Generation Readiness Audit failed.");
      }
      setResult(data);
      setMessage(
        `Audit complete: ${data.summary?.checksWithFindings ?? 0} of ${data.summary?.checksRun ?? 0} check(s) have findings.`
      );
    } catch (err: any) {
      setMessage(err?.message || "Admin Document Generation Readiness Audit failed.");
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
    <main data-barsh-admin-document-readiness-audit="read-only" style={pageStyle}>
      <div style={{ maxWidth: 1360, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <BarshHeaderQuickNav />
          <BarshHeaderActions />
        </section>

        <header style={{ ...cardStyle, display: "grid", gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 950, color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Administrator · Read-only
          </div>
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1 }}>Document Generation Readiness Audit</h1>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.45, maxWidth: 980 }}>
            Read-only local audit for document-generation readiness. It checks master lawsuit metadata, court/venue details,
            adversary attorney details, linked child matter fields, master Clio shell mapping, and local template/finalization
            records. It does not call Clio, call Graph, create working documents, generate documents, finalize documents,
            upload documents, send email, print, queue, restore data, update records, delete records, or write to the database.
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
            <a href="/admin/claim-index/audit" style={secondaryButtonStyle}>
              ClaimIndex Audit
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
              <SummaryCard label="Local lawsuits" value={result.summary?.localLawsuitCount ?? 0} />
              <SummaryCard label="Linked child rows" value={result.summary?.linkedChildMatterCount ?? 0} />
              <SummaryCard label="Template versions" value={result.summary?.localDocumentTemplateVersionCount ?? 0} note={`${result.summary?.localDocumentTemplateCount ?? 0} templates`} />
              <SummaryCard label="Checks with findings" value={result.summary?.checksWithFindings ?? 0} note={`${result.summary?.checksRun ?? 0} checks run`} />
              <SummaryCard label="Critical issues" value={result.summary?.criticalIssues ?? 0} />
              <SummaryCard label="Warnings" value={result.summary?.warningIssues ?? 0} />
              <SummaryCard label="Finalizations" value={result.summary?.finalizedDocumentRecordCount ?? 0} note={`${result.summary?.printQueueItemCount ?? 0} print queue item(s)`} />
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              <CountTable title="Counts by venue" rows={result.counts?.venue || []} />
              <CountTable title="Counts by amountSoughtMode" rows={result.counts?.amountSoughtMode || []} />
              <CountTable title="Counts by adversary attorney" rows={result.counts?.adversaryAttorney || []} />
              <CountTable title="Master Clio shell mapping" rows={result.counts?.masterClioShellMapping || []} />
              <CountTable title="Court details" rows={result.counts?.selectedCourtDetails || []} />
              <CountTable title="Adversary details" rows={result.counts?.adversaryAttorneyDetails || []} />
            </section>

            <section style={cardStyle}>
              <h2 style={{ margin: "0 0 12px", fontSize: 22 }}>Audit Checks</h2>
              <div style={{ display: "grid", gap: 12 }}>
                {checks.map((check) => (
                  <article
                    key={check.id}
                    data-barsh-admin-document-readiness-audit-check={check.id}
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
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1180 }}>
                          <thead>
                            <tr>
                              <th style={thStyle}>Master Lawsuit</th>
                              <th style={thStyle}>Venue</th>
                              <th style={thStyle}>Adversary</th>
                              <th style={thStyle}>Amount Mode</th>
                              <th style={thStyle}>Index/AAA</th>
                              <th style={thStyle}>Clio Shell</th>
                              <th style={thStyle}>Children</th>
                              <th style={thStyle}>Detail</th>
                            </tr>
                          </thead>
                          <tbody>
                            {check.sampleRows.map((row) => (
                              <tr key={`${check.id}-${row.masterLawsuitId}-${row.issue_detail || ""}`}>
                                <td style={tdStyle}>{row.masterLawsuitId}</td>
                                <td style={tdStyle}>{row.venueSelection || row.venue || row.venueOther || ""}</td>
                                <td style={tdStyle}>{row.adversaryAttorney || ""}</td>
                                <td style={tdStyle}>{row.amountSoughtMode || ""}</td>
                                <td style={tdStyle}>{row.indexAaaNumber || ""}</td>
                                <td style={tdStyle}>{row.clioMasterDisplayNumber || row.clioMasterMatterId || ""}</td>
                                <td style={tdStyle}>{row.childCount ?? ""}</td>
                                <td style={tdStyle}>{row.issue_detail || ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : check.sampleChildRows?.length ? (
                      <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 14 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1120 }}>
                          <thead>
                            <tr>
                              <th style={thStyle}>Matter ID</th>
                              <th style={thStyle}>Display #</th>
                              <th style={thStyle}>Master Lawsuit</th>
                              <th style={thStyle}>Patient</th>
                              <th style={thStyle}>Provider</th>
                              <th style={thStyle}>Insurer</th>
                              <th style={thStyle}>Claim #</th>
                              <th style={thStyle}>Claim Amount</th>
                              <th style={thStyle}>DOS</th>
                              <th style={thStyle}>Detail</th>
                            </tr>
                          </thead>
                          <tbody>
                            {check.sampleChildRows.map((row) => (
                              <tr key={`${check.id}-${row.matter_id}-${row.issue_detail || ""}`}>
                                <td style={tdStyle}>{row.matter_id}</td>
                                <td style={tdStyle}>{row.display_number || ""}</td>
                                <td style={tdStyle}>{row.master_lawsuit_id || ""}</td>
                                <td style={tdStyle}>{row.patient_name || ""}</td>
                                <td style={tdStyle}>{row.provider_name || row.client_name || row.treating_provider || ""}</td>
                                <td style={tdStyle}>{row.insurer_name || ""}</td>
                                <td style={tdStyle}>{row.claim_number_raw || row.claim_number_normalized || ""}</td>
                                <td style={tdStyle}>{money(row.claim_amount)}</td>
                                <td style={tdStyle}>{row.dos_start || ""}{row.dos_end && row.dos_end !== row.dos_start ? ` - ${row.dos_end}` : ""}</td>
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

            {checksWithFindings.length ? (
              <section style={{ ...cardStyle, borderColor: "#fde68a", background: "#fffbeb" }}>
                <strong>Review note:</strong> This page reports findings only. It intentionally provides no fix, edit,
                restore, Clio, Graph, document generation, finalization, upload, email, print, queue, delete, or write controls.
              </section>
            ) : null}

            <section style={{ ...cardStyle, color: "#475569", lineHeight: 1.45 }}>
              API safety message: {result.safety || "Read-only Document Generation Readiness Audit. No write actions are available."}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
