"use client";

import BarshHeader from "@/app/components/BarshHeader";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const pageStyle: React.CSSProperties = {
  maxWidth: 1280,
  margin: "24px auto",
  padding: "0 18px",
  fontFamily: "Arial, sans-serif",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  background: "#ffffff",
  padding: 18,
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #e2e8f0",
  padding: "9px 10px",
  background: "#f8fafc",
  color: "#385a83",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.02em",
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #e2e8f0",
  padding: "9px 10px",
  verticalAlign: "top",
  fontSize: 13,
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #00346e",
  background: "#00346e",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 2px 6px rgba(0, 52, 110, 0.25)",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#00346e",
  fontWeight: 900,
  cursor: "pointer",
};

function money(value: unknown) {
  const n = Number(value || 0);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function dateOnly(value: unknown) {
  const raw = text(value);
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString();
}

function csvEscape(value: unknown) {
  const raw = String(value ?? "");
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ClientCostsLedgerPage() {
  const params = useParams();
  const id = text(params?.id);
  const [ledger, setLedger] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadLedger() {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/clients/${encodeURIComponent(id)}/invoice/cost-ledger`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Unable to load Client Costs Ledger.");
      }
      setLedger(json);
    } catch (err: any) {
      setError(err?.message || "Unable to load Client Costs Ledger.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLedger();
  }, [id]);

  const rows = Array.isArray(ledger?.rows) ? ledger.rows : [];
  const summary = ledger?.summary || {};
  const clientName = text(ledger?.clientName || ledger?.client?.name) || "Client";

  const csvRows = useMemo(() => {
    const header = [
      "Kind",
      "Date Incurred",
      "Posted Date",
      "Cost Type",
      "Matter / Lawsuit",
      "Amount",
      "Voided",
      "Invoice Status",
      "Invoice Number",
      "Eligible",
      "Reason",
    ];
    const body = rows.map((row: any) => [
      row.kind,
      row.dateIncurred || row.dateEntered,
      row.postedDate,
      row.costType,
      row.matterDisplay || row.matterDisplayNumber || row.masterLawsuitId,
      row.amount,
      row.voided ? "Yes" : "No",
      row.invoiceStatus,
      row.invoiceNumber,
      row.eligibleForFutureInvoice ? "Yes" : "No",
      row.eligibilityReason,
    ]);
    return [header, ...body];
  }, [rows]);

  return (
    <main style={pageStyle}>
      <BarshHeader />
      <div style={{ display: "flex", gap: 14, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <Link href={id ? `/admin/clients/${encodeURIComponent(id)}/invoice` : "/admin/clients"} style={{ color: "#00346e", fontWeight: 900, textDecoration: "none" }}>
          ← Back to Invoice Workflow
        </Link>
        <Link href={id ? `/admin/clients/${encodeURIComponent(id)}` : "/admin/clients"} style={{ color: "#00346e", fontWeight: 900, textDecoration: "none" }}>
          Main Client Info Page
        </Link>
        <Link href="/admin" style={{ color: "#00346e", fontWeight: 900, textDecoration: "none" }}>
          Admin Home
        </Link>
      </div>

      <section style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#385a83", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Invoicing / Remittance
            </div>
            <h1 style={{ margin: "6px 0 4px" }}>Client Costs Ledger</h1>
            <h2 style={{ margin: 0, fontSize: 18 }}>{clientName}</h2>
            <p style={{ color: "#385a83", marginBottom: 0 }}>
              Cost activity for this invoice/remittance workflow. Finalized non-voided invoice lines block the same cost from future invoice previews; draft invoice lines do not permanently mark source rows.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={loadLedger} disabled={loading} style={primaryButtonStyle}>
              {loading ? "Refreshing..." : "Refresh Ledger"}
            </button>
            <button type="button" onClick={() => downloadCsv("client-costs-ledger.csv", csvRows)} disabled={!rows.length} style={secondaryButtonStyle}>
              Export CSV
            </button>
          </div>
        </div>

        {error && (
          <p style={{ color: "#b91c1c", fontWeight: 900 }}>{error}</p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(140px, 1fr))", gap: 12, marginTop: 18 }}>
          <div><strong>Total Rows</strong><br />{summary.totalRows ?? rows.length}</div>
          <div><strong>Costs Expended</strong><br />{summary.costsExpendedCount ?? "—"}</div>
          <div><strong>Costs Received</strong><br />{summary.costsReceivedCount ?? "—"}</div>
          <div><strong>Eligible for Future Invoice</strong><br />{summary.eligibleForFutureInvoiceCount ?? "—"}</div>
        </div>

        <div style={{ overflowX: "auto", marginTop: 18 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Kind</th>
                <th style={thStyle}>Date Incurred</th>
                <th style={thStyle}>Posted Date</th>
                <th style={thStyle}>Cost Type</th>
                <th style={thStyle}>Matter / Lawsuit</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
                <th style={thStyle}>Voided</th>
                <th style={thStyle}>Invoice Status</th>
                <th style={thStyle}>Eligible</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} style={tdStyle}>{loading ? "Loading ledger..." : "No cost ledger rows found."}</td>
                </tr>
              )}
              {rows.map((row: any, index: number) => (
                <tr key={`${row.sourceTable || "source"}-${row.sourceId || index}-${index}`}>
                  <td style={tdStyle}>{row.kind || "—"}</td>
                  <td style={tdStyle}>{dateOnly(row.dateIncurred || row.dateEntered)}</td>
                  <td style={tdStyle}>{dateOnly(row.postedDate)}</td>
                  <td style={tdStyle}>{row.costType || "—"}</td>
                  <td style={tdStyle}>
                    <strong>{row.matterDisplay || row.matterDisplayNumber || row.masterLawsuitId || "—"}</strong>
                    <br />
                    <span style={{ color: "#385a83" }}>{row.patientName || row.providerName || ""}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{money(row.amount)}</td>
                  <td style={tdStyle}>{row.voided ? "Yes" : "No"}</td>
                  <td style={tdStyle}>
                    {row.invoiceStatus || "—"}
                    {row.invoiceNumber ? <><br /><span>{row.invoiceNumber}</span></> : null}
                  </td>
                  <td style={tdStyle}>
                    <strong style={{ color: row.eligibleForFutureInvoice ? "#166534" : "#b91c1c" }}>
                      {row.eligibleForFutureInvoice ? "Yes" : "No"}
                    </strong>
                    <br />
                    <span style={{ color: "#385a83" }}>{row.eligibilityReason || ""}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
