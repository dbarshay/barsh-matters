"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type DetailResponse = {
  client?: any;
  matters?: { count: number; rows: any[] };
  remittance?: {
    receiptError?: string;
    count: number;
    activeTotal: number;
    voidedTotal: number;
    totalsByType: { transactionType: string; amount: number }[];
    rows: any[];
  };
  error?: string;
};

const pageStyle: React.CSSProperties = {
  maxWidth: 1500,
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
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

function detailEntries(details: Record<string, unknown> | undefined) {
  if (!details || typeof details !== "object") return [];
  return Object.entries(details).sort(([a], [b]) => a.localeCompare(b));
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AdminClientDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const [id, setId] = useState("");
  const [data, setData] = useState<DetailResponse | null>(null);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("posted");
  const [transactionType, setTransactionType] = useState("");
  const [postingContext, setPostingContext] = useState("");
  const [checkNumber, setCheckNumber] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    Promise.resolve(params).then((resolved) => setId(resolved.id));
  }, [params]);

  async function loadDetail(clientId: string) {
    if (!clientId) return;
    setError("");
    const query = new URLSearchParams();
    query.set("status", statusFilter);
    if (transactionType.trim()) query.set("transactionType", transactionType.trim());
    if (postingContext.trim()) query.set("postingContext", postingContext.trim());
    if (checkNumber.trim()) query.set("checkNumber", checkNumber.trim());
    if (dateFrom) query.set("dateFrom", dateFrom);
    if (dateTo) query.set("dateTo", dateTo);
    const res = await fetch(`/api/admin/clients/${encodeURIComponent(clientId)}?${query.toString()}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Could not load client.");
    setData(json);
  }

  useEffect(() => {
    if (!id) return;
    loadDetail(id).catch((err) => setError(err?.message || "Could not load client."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, statusFilter]);

  const client = data?.client;
  const remittanceRows = data?.remittance?.rows || [];
  const matterRows = data?.matters?.rows || [];

  const remittanceCsvRows = useMemo(
    () =>
      remittanceRows.map((row: any) => ({
        Matter: row.matter,
        Patient: row.patient,
        Provider: row.provider,
        Insurer: row.insurer,
        Lawsuit: row.lawsuit,
        "Transaction Date": row.transactionDate,
        "Transaction Type": row.transactionType,
        Status: row.transactionStatus,
        "Posting Context": row.postingContext,
        Amount: row.amount,
        "Check Date": row.checkDate,
        "Check Number": row.checkNumber,
        Voided: row.isVoided ? "Yes" : "No",
        "Void Reason": row.voidReason,
      })),
    [remittanceRows]
  );

  return (
    <main style={pageStyle}>
      <div style={{ marginBottom: 18, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Link href="/admin/clients" style={{ color: "#2563eb", fontWeight: 700, textDecoration: "none" }}>
          ← Clients
        </Link>
        <Link href="/admin" style={{ color: "#2563eb", fontWeight: 700, textDecoration: "none" }}>
          Admin Home
        </Link>
      </div>

      {error && (
        <section style={{ ...cardStyle, borderColor: "#fecaca", color: "#b91c1c", marginBottom: 18 }}>
          {error}
        </section>
      )}

      <section style={{ marginBottom: 22 }}>
        <div style={{ color: "#64748b", fontSize: 13, fontWeight: 700, textTransform: "uppercase" }}>
          Client
        </div>
        <h1 style={{ margin: "6px 0 8px", fontSize: 34 }}>{client?.displayName || "Loading client..."}</h1>
        <p style={{ margin: 0, color: "#475569", maxWidth: 1040, lineHeight: 1.6 }}>
          Client information is read from local provider/client reference data. Invoicing/remittance reporting is
          child-matter based only, including child allocation receipts created from the Lawsuit payment workflow.
        </p>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1fr)", gap: 18, marginBottom: 18 }}>
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Client Info</h2>
          <dl style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: "8px 12px", margin: 0 }}>
            <dt style={{ fontWeight: 800 }}>Name</dt>
            <dd style={{ margin: 0 }}>{client?.displayName || ""}</dd>
            <dt style={{ fontWeight: 800 }}>Normalized</dt>
            <dd style={{ margin: 0 }}>{client?.normalizedName || ""}</dd>
            <dt style={{ fontWeight: 800 }}>Status</dt>
            <dd style={{ margin: 0 }}>{client?.isActive === false ? "Inactive" : "Active"}</dd>
            <dt style={{ fontWeight: 800 }}>Source</dt>
            <dd style={{ margin: 0 }}>{client?.source || ""}</dd>
            <dt style={{ fontWeight: 800 }}>Aliases</dt>
            <dd style={{ margin: 0 }}>{client?.aliases?.length ? client.aliases.join(", ") : "—"}</dd>
          </dl>
        </div>

        <div style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Invoicing / Remittance Summary</h2>
          <dl style={{ display: "grid", gridTemplateColumns: "190px 1fr", gap: "8px 12px", margin: 0 }}>
            <dt style={{ fontWeight: 800 }}>Child matters</dt>
            <dd style={{ margin: 0 }}>{data?.matters?.count ?? 0}</dd>
            <dt style={{ fontWeight: 800 }}>Receipt rows</dt>
            <dd style={{ margin: 0 }}>{data?.remittance?.count ?? 0}</dd>
            <dt style={{ fontWeight: 800 }}>Active total</dt>
            <dd style={{ margin: 0 }}>{money(data?.remittance?.activeTotal || 0)}</dd>
            <dt style={{ fontWeight: 800 }}>Voided total</dt>
            <dd style={{ margin: 0 }}>{money(data?.remittance?.voidedTotal || 0)}</dd>
          </dl>
          {data?.remittance?.receiptError && (
            <p style={{ color: "#b91c1c", fontWeight: 700 }}>{data.remittance.receiptError}</p>
          )}
        </div>
      </section>

      <section style={{ ...cardStyle, marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>Imported Client Detail Fields</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr>
                <th style={thStyle}>Field</th>
                <th style={thStyle}>Value</th>
              </tr>
            </thead>
            <tbody>
              {detailEntries(client?.details).map(([key, value]) => (
                <tr key={key}>
                  <td style={tdStyle}>
                    <strong>{key}</strong>
                  </td>
                  <td style={tdStyle}>{String(value ?? "")}</td>
                </tr>
              ))}
              {!detailEntries(client?.details).length && (
                <tr>
                  <td style={tdStyle} colSpan={2}>
                    No stored imported detail fields found for this client.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ ...cardStyle, marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>Invoicing / Remittance Filters</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(150px, 1fr))", gap: 12, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 6, fontWeight: 700 }}>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ padding: 10, border: "1px solid #cbd5e1", borderRadius: 10 }}>
              <option value="posted">Posted only</option>
              <option value="voided">Voided only</option>
              <option value="all">All</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6, fontWeight: 700 }}>
            Transaction Type
            <input value={transactionType} onChange={(event) => setTransactionType(event.target.value)} placeholder="Collection Payment" style={{ padding: 10, border: "1px solid #cbd5e1", borderRadius: 10 }} />
          </label>
          <label style={{ display: "grid", gap: 6, fontWeight: 700 }}>
            Posting Context
            <input value={postingContext} onChange={(event) => setPostingContext(event.target.value)} placeholder="lawsuit-allocation" style={{ padding: 10, border: "1px solid #cbd5e1", borderRadius: 10 }} />
          </label>
          <label style={{ display: "grid", gap: 6, fontWeight: 700 }}>
            Check Number
            <input value={checkNumber} onChange={(event) => setCheckNumber(event.target.value)} style={{ padding: 10, border: "1px solid #cbd5e1", borderRadius: 10 }} />
          </label>
          <label style={{ display: "grid", gap: 6, fontWeight: 700 }}>
            Date From
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} style={{ padding: 10, border: "1px solid #cbd5e1", borderRadius: 10 }} />
          </label>
          <label style={{ display: "grid", gap: 6, fontWeight: 700 }}>
            Date To
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} style={{ padding: 10, border: "1px solid #cbd5e1", borderRadius: 10 }} />
          </label>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => id && loadDetail(id).catch((err) => setError(err?.message || "Could not refresh remittance."))}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #0f172a", background: "#0f172a", color: "#fff", fontWeight: 800 }}
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => downloadCsv(`${client?.displayName || "Client"} - Remittance Preview.csv`, remittanceCsvRows)}
            disabled={!remittanceCsvRows.length}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #cbd5e1", background: remittanceCsvRows.length ? "#fff" : "#f1f5f9", fontWeight: 800 }}
          >
            Export CSV
          </button>
        </div>
      </section>

      <section style={{ ...cardStyle, marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>Transaction Type Totals</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
            <thead>
              <tr>
                <th style={thStyle}>Transaction Type</th>
                <th style={thStyle}>Active Amount</th>
              </tr>
            </thead>
            <tbody>
              {(data?.remittance?.totalsByType || []).map((row) => (
                <tr key={row.transactionType}>
                  <td style={tdStyle}>{row.transactionType}</td>
                  <td style={tdStyle}>{money(row.amount)}</td>
                </tr>
              ))}
              {!data?.remittance?.totalsByType?.length && (
                <tr>
                  <td style={tdStyle} colSpan={2}>
                    No active receipt totals found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ ...cardStyle, marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>Child Matters</h2>
        <div style={{ overflowX: "auto", maxHeight: 420 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1120 }}>
            <thead>
              <tr>
                <th style={thStyle}>Matter</th>
                <th style={thStyle}>Patient</th>
                <th style={thStyle}>Provider</th>
                <th style={thStyle}>Insurer</th>
                <th style={thStyle}>Lawsuit</th>
                <th style={thStyle}>Claim #</th>
                <th style={thStyle}>DOS</th>
                <th style={thStyle}>Bill Amount</th>
                <th style={thStyle}>Balance</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {matterRows.map((row: any) => (
                <tr key={row.id || row.matter}>
                  <td style={tdStyle}>{row.matter}</td>
                  <td style={tdStyle}>{row.patient}</td>
                  <td style={tdStyle}>{row.provider}</td>
                  <td style={tdStyle}>{row.insurer}</td>
                  <td style={tdStyle}>{row.lawsuit}</td>
                  <td style={tdStyle}>{row.claimNumber}</td>
                  <td style={tdStyle}>{dateOnly(row.dateOfService)}</td>
                  <td style={tdStyle}>{money(row.billAmount)}</td>
                  <td style={tdStyle}>{money(row.balance)}</td>
                  <td style={tdStyle}>{row.finalStatus}</td>
                </tr>
              ))}
              {!matterRows.length && (
                <tr>
                  <td style={tdStyle} colSpan={10}>
                    No child matters matched this client/provider reference name or aliases.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Payment Receipt Rows</h2>
        <div style={{ overflowX: "auto", maxHeight: 520 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1320 }}>
            <thead>
              <tr>
                <th style={thStyle}>Matter</th>
                <th style={thStyle}>Patient</th>
                <th style={thStyle}>Insurer</th>
                <th style={thStyle}>Lawsuit</th>
                <th style={thStyle}>Transaction Date</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Posting Context</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Check Date</th>
                <th style={thStyle}>Check #</th>
                <th style={thStyle}>Void</th>
              </tr>
            </thead>
            <tbody>
              {remittanceRows.map((row: any) => (
                <tr key={row.id || `${row.matter}-${row.createdAt}-${row.amount}`}>
                  <td style={tdStyle}>{row.matter}</td>
                  <td style={tdStyle}>{row.patient}</td>
                  <td style={tdStyle}>{row.insurer}</td>
                  <td style={tdStyle}>{row.lawsuit}</td>
                  <td style={tdStyle}>{dateOnly(row.transactionDate)}</td>
                  <td style={tdStyle}>{row.transactionType}</td>
                  <td style={tdStyle}>{row.transactionStatus}</td>
                  <td style={tdStyle}>{row.postingContext}</td>
                  <td style={tdStyle}>{money(row.amount)}</td>
                  <td style={tdStyle}>{dateOnly(row.checkDate)}</td>
                  <td style={tdStyle}>{row.checkNumber}</td>
                  <td style={tdStyle}>{row.isVoided ? row.voidReason || "Voided" : ""}</td>
                </tr>
              ))}
              {!remittanceRows.length && (
                <tr>
                  <td style={tdStyle} colSpan={12}>
                    No payment receipt rows found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
