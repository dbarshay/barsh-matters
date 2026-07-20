"use client";

import { bmConfirm, bmAlert } from "@/app/components/BmDialogHost";
import BarshHeader from "@/app/components/BarshHeader";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const pageStyle: React.CSSProperties = {
  maxWidth: 1320,
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
  borderRadius: 999,
  border: "1px solid #00346e",
  background: "#00346e",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 2px 6px rgba(0, 52, 110, 0.25)",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#00346e",
  fontWeight: 900,
  cursor: "pointer",
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function money(value: unknown) {
  const n = Number(value || 0);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function dateOnly(value: unknown) {
  const raw = clean(value);
  if (raw.length === 0) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString();
}

function statusBadge(status: unknown) {
  const value = clean(status) || "unknown";
  const lower = value.toLowerCase();
  const style: React.CSSProperties = {
    display: "inline-flex",
    borderRadius: 999,
    padding: "3px 8px",
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#385a83",
  };
  if (lower === "finalized") {
    style.border = "1px solid #bbf7d0";
    style.background = "#f0fdf4";
    style.color = "#166534";
  }
  if (lower === "draft") {
    style.border = "1px solid #fde68a";
    style.background = "#fffbeb";
    style.color = "#92400e";
  }
  if (lower === "voided") {
    style.border = "1px solid #fecaca";
    style.background = "#fef2f2";
    style.color = "#991b1b";
  }
  return <span style={style}>{value}</span>;
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

export default function ClientInvoiceHistoryPage() {
  const params = useParams();
  const id = clean(params?.id);
  const [history, setHistory] = useState<any[]>([]);
  const [clientName, setClientName] = useState("Provider Client");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadHistory() {
    if (id.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const clientRes = await fetch(`/api/admin/clients/${encodeURIComponent(id)}`, { cache: "no-store" });
      const clientJson = await clientRes.json();
      if (clientRes.ok && clientJson?.name) {
        setClientName(clean(clientJson.name));
      }

      const res = await fetch(`/api/admin/clients/${encodeURIComponent(id)}/invoice`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok === false || json?.ok === false) {
        throw new Error(json?.error || "Unable to load invoice history.");
      }
      const rows = Array.isArray(json?.invoices) ? json.invoices : Array.isArray(json?.rows) ? json.rows : [];
      setHistory(rows);
    } catch (err: any) {
      setError(err?.message || "Unable to load invoice history.");
    } finally {
      setLoading(false);
    }
  }

  const [actionBusyInvoiceId, setActionBusyInvoiceId] = useState("");

  async function finalizeInvoice(invoice: any) {
    const invoiceId = clean(invoice?.id);
    if (id.length === 0 || invoiceId.length === 0) return;
    setActionBusyInvoiceId(invoiceId);
    setError("");
    try {
      const res = await fetch(`/api/admin/clients/${encodeURIComponent(id)}/invoice/${encodeURIComponent(invoiceId)}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmFinalizeInvoice: true }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok === false || json?.ok === false) {
        throw new Error(json?.error || "Unable to finalize invoice.");
      }
      await loadHistory();
    } catch (err: any) {
      setError(err?.message || "Unable to finalize invoice.");
    } finally {
      setActionBusyInvoiceId("");
    }
  }

  async function voidInvoice(invoice: any) {
    const invoiceId = clean(invoice?.id);
    const invoiceNumber = clean(invoice?.invoiceNumber) || "this invoice";
    if (id.length === 0 || invoiceId.length === 0) return;
    const confirmed = await bmConfirm(`Void ${invoiceNumber}? This will void the invoice record. Finalized invoice receipt marks will be released for future invoicing.`);
    if (confirmed === false) return;
    setActionBusyInvoiceId(invoiceId);
    setError("");
    try {
      const res = await fetch(`/api/admin/clients/${encodeURIComponent(id)}/invoice/${encodeURIComponent(invoiceId)}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmVoidInvoice: true, voidReason: "Voided from client invoice history page" }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok === false || json?.ok === false) {
        throw new Error(json?.error || "Unable to void invoice.");
      }
      await loadHistory();
    } catch (err: any) {
      setError(err?.message || "Unable to void invoice.");
    } finally {
      setActionBusyInvoiceId("");
    }
  }


  useEffect(() => {
    loadHistory();
  }, [id]);

  const finalizedCount = history.filter((row: any) => row?.status === "finalized").length;
  const draftCount = history.filter((row: any) => row?.status === "draft").length;
  const voidedCount = history.filter((row: any) => row?.status === "voided").length;
  const latestFinalized = history.find((row: any) => row?.status === "finalized") || null;
  const latest = history[0] || null;

  const csvRows = useMemo(() => {
    const header = [
      "Invoice Number",
      "Status",
      "Created",
      "Finalized",
      "Voided",
      "Lines",
      "Principal / Interest",
      "Retainer Fee",
      "Net Before Costs",
      "Costs Received",
      "Costs Expended",
      "Cost Balance",
      "Cost Ledger",
      "Final Net Remit",
    ];
    const body = history.map((invoice: any) => [
      invoice.invoiceNumber,
      invoice.status,
      invoice.createdAt,
      invoice.finalizedAt,
      invoice.voidedAt,
      invoice.lineCount,
      invoice.principalInterestReceivedTotal,
      invoice.retainerFeeTotal,
      invoice.netRemitBeforeCostsTotal,
      invoice.filingFeePaymentTotal,
      invoice.costsExpendedTotal,
      invoice.costBalanceThisRemittancePeriod,
      invoice.costBalanceLedgerAfter,
      invoice.netRemitToProviderTotal,
    ]);
    return [header, ...body];
  }, [history]);

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
        <Link href="/admin/invoices" style={{ color: "#00346e", fontWeight: 900, textDecoration: "none" }}>
          Global Invoice Search
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
            <h1 style={{ margin: "6px 0 4px" }}>Client Invoice History</h1>
            <h2 style={{ margin: 0, fontSize: 18 }}>{clientName}</h2>
            <p style={{ color: "#385a83", marginBottom: 0 }}>
              View finalized invoice detail, finalize drafts, void finalized invoices, and print/save invoices as PDF.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={loadHistory} disabled={loading} style={primaryButtonStyle}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <button type="button" onClick={() => downloadCsv("client-invoice-history.csv", csvRows)} disabled={history.length === 0} style={secondaryButtonStyle}>
              Export CSV
            </button>
          </div>
        </div>

        {error && <p style={{ color: "#b91c1c", fontWeight: 900 }}>{error}</p>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(130px, 1fr))", gap: 12, marginTop: 18 }}>
          <div><strong>Total</strong><br />{history.length}</div>
          <div><strong>Finalized</strong><br />{finalizedCount}</div>
          <div><strong>Draft</strong><br />{draftCount}</div>
          <div><strong>Voided</strong><br />{voidedCount}</div>
          <div><strong>Latest</strong><br />{latestFinalized?.invoiceNumber || latest?.invoiceNumber || "—"}</div>
        </div>

        <div style={{ overflowX: "auto", marginTop: 18 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Invoice Number</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Created</th>
                <th style={thStyle}>Finalized</th>
                <th style={thStyle}>Voided</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Lines</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Principal / Interest</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Retainer Fee</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Net Before Costs</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Costs Received</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Costs Expended</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Cost Balance</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Cost Ledger</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Final Net Remit</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td colSpan={15} style={tdStyle}>{loading ? "Loading invoice history..." : "No invoice history found."}</td>
                </tr>
              )}
              {history.map((invoice: any) => (
                <tr key={invoice.id || invoice.invoiceNumber}>
                  <td style={tdStyle}><strong>{invoice.invoiceNumber || "—"}</strong></td>
                  <td style={tdStyle}>{statusBadge(invoice.status)}</td>
                  <td style={tdStyle}>{dateOnly(invoice.createdAt)}</td>
                  <td style={tdStyle}>{dateOnly(invoice.finalizedAt)}</td>
                  <td style={tdStyle}>{dateOnly(invoice.voidedAt)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{invoice.lineCount ?? "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{money(invoice.principalInterestReceivedTotal)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{money(invoice.retainerFeeTotal)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{money(invoice.netRemitBeforeCostsTotal)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{money(invoice.filingFeePaymentTotal)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{money(invoice.costsExpendedTotal)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{money(invoice.costBalanceThisRemittancePeriod)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{money(invoice.costBalanceLedgerAfter)}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 900 }}>{money(invoice.netRemitToProviderTotal)}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {invoice.status === "draft" && (
                        <button
                          type="button"
                          onClick={() => finalizeInvoice(invoice)}
                          disabled={actionBusyInvoiceId === clean(invoice.id)}
                          style={{ padding: "6px 9px", borderRadius: 8, border: "1px solid #166534", background: "#166534", color: "#ffffff", fontWeight: 900, cursor: "pointer" }}
                        >
                          Finalize
                        </button>
                      )}
                      {(invoice.status === "draft" || invoice.status === "finalized") && (
                        <button
                          type="button"
                          onClick={() => voidInvoice(invoice)}
                          disabled={actionBusyInvoiceId === clean(invoice.id)}
                          style={{ padding: "6px 9px", borderRadius: 8, border: "1px solid #dc2626", background: "#dc2626", color: "#ffffff", fontWeight: 900, cursor: "pointer" }}
                        >
                          Void
                        </button>
                      )}
                    </div>
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
