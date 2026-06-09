"use client";

import { formatDateOnlyForDisplay } from "@/lib/dateOnlyDisplay";
import Link from "next/link";
import { useEffect, useState } from "react";

const pageStyle: React.CSSProperties = {
  maxWidth: 1450,
  margin: "0 auto",
  padding: "32px 24px 80px",
  fontFamily: "var(--font-geist-sans)",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "#fff",
  padding: 18,
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb",
  padding: "10px 8px",
  fontSize: 12,
  color: "#475569",
  background: "#f8fafc",
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #f1f5f9",
  padding: "10px 8px",
  verticalAlign: "top",
  fontSize: 13,
};

function money(value: unknown) {
  const numeric = Number(value || 0);
  return numeric.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function dateOnly(value: unknown) {
  return formatDateOnlyForDisplay(value);
}

export default function AdminInvoiceSearchPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    setError("");

    try {
      const query = new URLSearchParams();
      if (q.trim()) query.set("q", q.trim());
      if (status) query.set("status", status);
      if (dateFrom) query.set("dateFrom", dateFrom);
      if (dateTo) query.set("dateTo", dateTo);

      const res = await fetch(`/api/admin/invoices?${query.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "Could not search invoices.");
      setRows(json.invoices || []);
    } catch (err: any) {
      setError(err?.message || "Could not search invoices.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={pageStyle}>
      <div style={{ marginBottom: 18, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Link href="/admin/clients" style={{ color: "#2563eb", fontWeight: 800, textDecoration: "none" }}>
          ← Clients
        </Link>
        <Link href="/admin" style={{ color: "#2563eb", fontWeight: 800, textDecoration: "none" }}>
          Admin Home
        </Link>
      </div>

      <section style={{ marginBottom: 22 }}>
        <div style={{ color: "#64748b", fontSize: 13, fontWeight: 800, textTransform: "uppercase" }}>
          Provider-Level Reporting
        </div>
        <h1 style={{ margin: "6px 0 8px", fontSize: 34 }}>Global Invoice Search</h1>
        <p style={{ color: "#475569", margin: 0 }}>
          Read-only invoice reporting across provider/clients. Search by invoice number, provider, matter, patient, insurer, lawsuit, source row, or description.
        </p>
      </section>

      {error && <section style={{ ...cardStyle, borderColor: "#fecaca", color: "#b91c1c", marginBottom: 18 }}>{error}</section>}

      <section style={{ ...cardStyle, marginBottom: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 1.5fr) repeat(3, minmax(140px, 1fr)) auto", gap: 10, alignItems: "end" }}>
          <label style={{ fontWeight: 800 }}>
            Search
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Invoice, provider, matter, patient, insurer, lawsuit..." style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
          </label>

          <label style={{ fontWeight: 800 }}>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)} style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}>
              <option value="">All</option>
              <option value="draft">draft</option>
              <option value="finalized">finalized</option>
              <option value="voided">voided</option>
            </select>
          </label>

          <label style={{ fontWeight: 800 }}>
            Created From
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
          </label>

          <label style={{ fontWeight: 800 }}>
            Created To
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
          </label>

          <button type="button" onClick={search} disabled={loading} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid #2563eb", background: "#2563eb", color: "#fff", fontWeight: 900 }}>
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Invoice Number</th>
                <th style={thStyle}>Provider</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Created</th>
                <th style={thStyle}>Finalized</th>
                <th style={thStyle}>Voided</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Lines</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Receipts</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
                <th style={thStyle}>Open</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((invoice) => {
                const clientId = invoice.referenceEntityId || invoice.providerClientInfoId;
                return (
                  <tr key={invoice.id}>
                    <td style={tdStyle}><strong>{invoice.invoiceNumber}</strong></td>
                    <td style={tdStyle}>{invoice.providerDisplayName || "—"}</td>
                    <td style={tdStyle}>{invoice.status}</td>
                    <td style={tdStyle}>{dateOnly(invoice.createdAt)}</td>
                    <td style={tdStyle}>{dateOnly(invoice.finalizedAt) || "—"}</td>
                    <td style={tdStyle}>{dateOnly(invoice.voidedAt) || "—"}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{invoice.lineCount}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{invoice.receiptRowCount}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{money(invoice.invoicePackageTotal)}</td>
                    <td style={tdStyle}>
                      {clientId ? (
                        <Link href={`/admin/clients/${encodeURIComponent(clientId)}/invoice`} style={{ color: "#2563eb", fontWeight: 900, textDecoration: "none" }}>
                          Client Invoice Page
                        </Link>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}

              {!rows.length && (
                <tr>
                  <td style={tdStyle} colSpan={10}>No invoices found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
