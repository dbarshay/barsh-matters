"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
const secondaryButtonStyle: React.CSSProperties = {
  padding: "5px 8px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  background: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};


const filterControlStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 5,
  padding: "9px 10px",
  border: "1px solid #94a3b8",
  borderRadius: 8,
  background: "#fff",
  boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.08)",
  fontWeight: 800,
  color: "#0f172a",
};

const compactInfoLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#475569",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.02em",
};

const compactInfoValueStyle: React.CSSProperties = {
  margin: "1px 0 0",
  fontSize: 14,
  lineHeight: 1.2,
};

const compactInfoGroupStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  alignContent: "start",
};

function ProviderInfoItem({ label, value, multiline }: { label: string; value: unknown; multiline?: boolean }) {
  return (
    <div>
      <dt style={compactInfoLabelStyle}>{label}</dt>
      <dd style={{ ...compactInfoValueStyle, whiteSpace: multiline ? "pre-wrap" : "normal" }}>{clean(value) || "—"}</dd>
    </div>
  );
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

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

function dateTime(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function asPlainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function detailEntries(details: unknown): { field: string; value: string; source: string }[] {
  const root = asPlainObject(details);
  const hidden = asPlainObject(root._hiddenImportFields);
  const rows: { field: string; value: string; source: string }[] = [];

  for (const [key, value] of Object.entries(root)) {
    if (key === "_hiddenImportFields") continue;
    const textValue = clean(value);
    if (textValue) rows.push({ field: key, value: textValue, source: "Imported" });
  }

  for (const [key, value] of Object.entries(hidden)) {
    const textValue = clean(value);
    if (textValue) rows.push({ field: key, value: textValue, source: "Hidden Import" });
  }

  return rows;
}

function findDetailValue(details: unknown, keys: string[]) {
  const entries = detailEntries(details);
  const compact = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const wanted = keys.map(compact);

  for (const key of wanted) {
    const exact = entries.find((entry) => compact(entry.field) === key);
    if (exact) return exact.value;
  }

  for (const key of wanted) {
    const fuzzy = entries.find((entry) => compact(entry.field).includes(key));
    if (fuzzy) return fuzzy.value;
  }

  return "";
}

function providerAddress(details: unknown) {
  const direct = findDetailValue(details, ["address", "full_address", "mailing_address"]);
  if (direct) return normalizeAddressDisplay(direct);

  const street = findDetailValue(details, ["hidden_street", "street", "address_line_1", "address1"]);
  const street2 = findDetailValue(details, ["hidden_suite", "suite", "address_line_2", "address2"]);
  const city = findDetailValue(details, ["hidden_city", "city"]);
  const state = findDetailValue(details, ["hidden_state", "state"]);
  const zip = findDetailValue(details, ["hidden_zipcode", "hidden_zip", "zip", "zipcode", "postal_code"]);
  const cityState = [city, state].filter(Boolean).join(", ");
  const cityStateZip = cityState && zip ? `${cityState} ${zip}` : cityState || zip;

  return normalizeAddressDisplay([street, street2, cityStateZip].filter(Boolean).join("\n"));
}

function percentDisplay(value: unknown) {
  const text = clean(value);
  if (!text) return "";
  if (text.includes("%")) return text;
  const numeric = Number(text.replace(/[$,%\s,]/g, ""));
  if (!Number.isFinite(numeric)) return text;
  return `${numeric}%`;
}

function titleCaseAddressSegment(value: string) {
  const preserveUpper = new Set(["NY", "NJ", "CT", "PA", "US", "USA", "LLC", "PC", "PLLC", "MD", "DO"]);
  const smallWords = new Set(["of", "and", "the"]);

  return value
    .toLowerCase()
    .replace(/\b([a-z])([a-z']*)\b/g, (match, first, rest, offset) => {
      const original = match.toUpperCase();
      if (preserveUpper.has(original)) return original;
      if (offset > 0 && smallWords.has(match)) return match;
      return `${first.toUpperCase()}${rest}`;
    })
    .replace(/\bMc([a-z])/g, (_match, letter) => `Mc${letter.toUpperCase()}`)
    .replace(/\bO'([a-z])/g, (_match, letter) => `O'${letter.toUpperCase()}`)
    .replace(/\bPo Box\b/gi, "PO Box")
    .replace(/\bSte\b/gi, "Ste")
    .replace(/\bSuite\b/gi, "Suite")
    .replace(/\bApt\b/gi, "Apt")
    .replace(/\bFl\b/gi, "Fl");
}

function normalizeAddressLineDisplay(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return "";

  const zipMatch = trimmed.match(/^(.*?)(?:,)?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
  if (zipMatch) {
    return `${titleCaseAddressSegment(zipMatch[1])}, ${zipMatch[2].toUpperCase()} ${zipMatch[3]}`;
  }

  return titleCaseAddressSegment(trimmed);
}

function normalizeAddressDisplay(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s*•\s*/g, "\n")
    .replace(/,\s*(\d{5}(?:-\d{4})?)\s*$/gm, " $1")
    .split(/\r?\n/)
    .map(normalizeAddressLineDisplay)
    .filter(Boolean)
    .join("\n");
}

function statusBadge(status: unknown) {
  const value = clean(status).toLowerCase() || "draft";
  const style =
    value === "finalized"
      ? { color: "#166534", background: "#dcfce7", border: "#86efac" }
      : value === "voided"
        ? { color: "#991b1b", background: "#fee2e2", border: "#fecaca" }
        : { color: "#854d0e", background: "#fef9c3", border: "#fde68a" };

  return (
    <span
      style={{
        color: style.color,
        background: style.background,
        border: `1px solid ${style.border}`,
        borderRadius: 999,
        padding: "3px 9px",
        fontWeight: 900,
        whiteSpace: "nowrap",
        textTransform: "capitalize",
      }}
    >
      {value}
    </span>
  );
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

function safeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default function ProviderClientInvoiceWorkflowPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const [id, setId] = useState("");
  const [statusFilter, setStatusFilter] = useState("posted");
  const [transactionType, setTransactionType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [clientDetail, setClientDetail] = useState<any>(null);
  const [clientDetailLoading, setClientDetailLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [createdInvoice, setCreatedInvoice] = useState<any>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<any>(null);
  const [invoiceDetailVisible, setInvoiceDetailVisible] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [voiding, setVoiding] = useState(false);

  useEffect(() => {
    Promise.resolve(params).then((resolved) => setId(resolved.id));
  }, [params]);

  async function loadClientDetail(clientId = id) {
    if (!clientId) return;
    setClientDetailLoading(true);

    try {
      const res = await fetch(`/api/admin/clients/${encodeURIComponent(clientId)}?status=posted`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "Could not load provider/client detail.");
      setClientDetail(json.client || null);
    } catch (err: any) {
      setError(err?.message || "Could not load provider/client detail.");
    } finally {
      setClientDetailLoading(false);
    }
  }

  async function loadHistory(clientId = id) {
    if (!clientId) return;
    setLoadingHistory(true);

    try {
      const res = await fetch(`/api/admin/clients/${encodeURIComponent(clientId)}/invoice`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "Could not load invoice history.");
      setHistory(json.invoices || []);
    } catch (err: any) {
      setError(err?.message || "Could not load invoice history.");
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    loadClientDetail(id);
    loadHistory(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function previewQuery() {
    const query = new URLSearchParams();
    query.set("status", statusFilter);
    if (transactionType.trim()) query.set("transactionType", transactionType.trim());
    if (dateFrom) query.set("dateFrom", dateFrom);
    if (dateTo) query.set("dateTo", dateTo);
    return query;
  }

  async function loadPreview() {
    if (!id) return;
    setLoadingPreview(true);
    setError("");
    setMessage("");
    setPreview(null);
    setCreatedInvoice(null);

    try {
      const res = await fetch(`/api/admin/clients/${encodeURIComponent(id)}/invoice/create-preview?${previewQuery().toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "Could not build invoice preview.");

      setPreview(json.invoiceDraftPreview);
      setMessage("Preview loaded.");
    } catch (err: any) {
      setError(err?.message || "Could not build invoice preview.");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function createDraftInvoice() {
    if (!id || !preview) return;
    setCreatingDraft(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/admin/clients/${encodeURIComponent(id)}/invoice/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmCreateInvoiceDraft: true,
          invoiceDraftPreview: preview,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "Could not create draft invoice.");

      setCreatedInvoice(json.invoice);
      setInvoiceDetail(null);
      setMessage("Draft invoice created. Receipt rows are not yet marked as invoiced. Review the frozen package before finalizing.");
      setInvoiceDetailVisible(false);
      setInvoiceDetail(null);
      await loadHistory();
    } catch (err: any) {
      setError(err?.message || "Could not create draft invoice.");
    } finally {
      setCreatingDraft(false);
    }
  }

  async function loadInvoiceDetail(invoiceId: string) {
    if (!id || !invoiceId) return;
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/admin/clients/${encodeURIComponent(id)}/invoice/${encodeURIComponent(invoiceId)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "Could not load invoice detail.");

      setInvoiceDetail(json);
      setInvoiceDetailVisible(true);
      if (json.invoice?.status === "draft") setCreatedInvoice(json.invoice);
      setMessage("Invoice detail loaded.");
    } catch (err: any) {
      setError(err?.message || "Could not load invoice detail.");
    }
  }

  async function finalizeInvoice(invoiceArg?: any) {
    const invoice = invoiceArg || createdInvoice || invoiceDetail?.invoice;
    const invoiceId = invoice?.id;
    if (!id || !invoiceId) return;

    const confirmed = window.confirm(
      `Finalize invoice ${invoice?.invoiceNumber || invoiceId}? This will mark included payment receipt rows with this invoice ID and exclude them from future ordinary previews.`
    );
    if (!confirmed) return;

    setFinalizing(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/admin/clients/${encodeURIComponent(id)}/invoice/${encodeURIComponent(invoiceId)}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmFinalizeInvoice: true }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "Could not finalize invoice.");

      setCreatedInvoice(json.invoice);
      setMessage("Invoice finalized. Included receipt rows are now marked with this invoice ID and excluded from future invoice previews by default.");
      await loadInvoiceDetail(invoiceId);
      setInvoiceDetailVisible(false);
      setInvoiceDetail(null);
      await loadHistory();
    } catch (err: any) {
      setError(err?.message || "Could not finalize invoice.");
    } finally {
      setFinalizing(false);
    }
  }

  async function voidInvoice(invoiceArg?: any) {
    const invoice = invoiceArg || invoiceDetail?.invoice;
    const invoiceId = invoice?.id;
    if (!id || !invoiceId) return;

    const voidReason = window.prompt(
      `Void invoice ${invoice?.invoiceNumber || invoiceId}? Enter the void reason. Receipt rows currently marked with this exact invoice ID will be released.`
    );
    if (!voidReason || !voidReason.trim()) return;

    setVoiding(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/admin/clients/${encodeURIComponent(id)}/invoice/${encodeURIComponent(invoiceId)}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmVoidInvoice: true, voidReason: voidReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "Could not void invoice.");

      setMessage("Invoice voided. Receipt rows marked with this invoice ID were released for future invoicing.");
      await loadInvoiceDetail(invoiceId);
      setInvoiceDetailVisible(false);
      setInvoiceDetail(null);
      await loadHistory();
    } catch (err: any) {
      setError(err?.message || "Could not void invoice.");
    } finally {
      setVoiding(false);
    }
  }

  function printableInvoice() {
    const detail = invoiceDetail;
    const invoice = detail?.invoice;
    if (!invoice) return;

    const lines = Array.isArray(invoice.lines) ? invoice.lines : [];
    const rows = lines
      .map(
        (line: any) => `
      <tr>
        <td>${safeHtml(dateOnly(line.sortDate))}</td>
        <td>${safeHtml(line.matter || "")}</td>
        <td>${safeHtml(line.patient || "")}</td>
        <td>${safeHtml(line.provider || "")}</td>
        <td>${safeHtml(line.description || "")}</td>
        <td style="text-align:right;">${safeHtml(money(line.amount))}</td>
        <td style="text-align:right;">${safeHtml(money(line.retainerFee))}</td>
      </tr>`
      )
      .join("");

    const html = `<!doctype html>
<html>
<head>
  <title>Invoice ${safeHtml(invoice.invoiceNumber)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
    h1 { margin-bottom: 4px; }
    .muted { color: #64748b; font-size: 13px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0; }
    .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; }
    table { border-collapse: collapse; width: 100%; margin-top: 18px; font-size: 12px; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; }
    .totals { margin-top: 18px; width: 420px; margin-left: auto; }
    .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
    .total { font-weight: 800; border-top: 2px solid #0f172a; margin-top: 8px; padding-top: 8px; }
    @media print { button { display: none; } body { padding: 16px; } }
  </style>
</head>
<body>
  <button onclick="window.print()">Print / Save as PDF</button>
  <h1>Provider Client Invoice</h1>
  <div class="muted">Invoice Number: ${safeHtml(invoice.invoiceNumber)} | Status: ${safeHtml(invoice.status)} | Created: ${safeHtml(dateOnly(invoice.createdAt))} | Finalized: ${safeHtml(dateOnly(invoice.finalizedAt))}</div>
  <div class="grid">
    <div class="card">
      <strong>Provider / Client</strong><br />
      ${safeHtml(invoice.providerDisplayName)}<br />
      ${safeHtml(invoice.clientSnapshot?.address).replace(/\n/g, "<br />")}
    </div>
    <div class="card">
      <strong>Receipt Marking</strong><br />
      Rows found: ${safeHtml(detail.verification?.receiptRowsFound ?? 0)}<br />
      Marked with this invoice: ${safeHtml(detail.verification?.receiptRowsMarkedWithThisInvoiceId ?? 0)}<br />
      Marked with another invoice: ${safeHtml(detail.verification?.receiptRowsMarkedWithAnotherInvoiceId ?? 0)}<br />
      Unmarked: ${safeHtml(detail.verification?.receiptRowsUnmarked ?? 0)}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th><th>Matter</th><th>Patient</th><th>Provider</th><th>Description</th><th style="text-align:right;">Amount</th><th style="text-align:right;">Retainer Fee</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div><span>Principal / Interest</span><span>${safeHtml(money(invoice.principalInterestTotal))}</span></div>
    <div><span>Filing Fee Payments</span><span>${safeHtml(money(invoice.filingFeePaymentTotal))}</span></div>
    <div><span>Costs Expended</span><span>${safeHtml(money(invoice.costsExpendedTotal))}</span></div>
    <div><span>Retainer Fee</span><span>${safeHtml(money(invoice.retainerFeeTotal))}</span></div>
    <div class="total"><span>Invoice Total</span><span>${safeHtml(money(invoice.invoicePackageTotal))}</span></div>
  </div>
</body>
</html>`;

    const popup = window.open("about:blank", "_blank");
    if (!popup) {
      setError("Browser blocked printable invoice window.");
      return;
    }

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
  }

  const providerClientDetails = clientDetail?.details || {};
  const providerIdentityRows = [
    { label: "Address", value: providerAddress(providerClientDetails) || "—", multiline: true },
    { label: "Owner", value: findDetailValue(providerClientDetails, ["hidden_owner", "owner", "Owner", "assigned_owner", "account_owner", "client_owner"]) || "—" },
    { label: "Provider Group", value: findDetailValue(providerClientDetails, ["hidden_group_name", "group_name", "provider_group", "Provider Group", "Group Name"]) || "—" },
    { label: "Status", value: clientDetail?.isActive === false ? "Inactive" : "Active" },
  ];

  const providerPercentageRows = [
    { label: "NF Principal", value: percentDisplay(findDetailValue(providerClientDetails, ["hidden_retainer_principal_nf_percent", "retainer_nf_principal_percent"])) || "—" },
    { label: "NF Interest", value: percentDisplay(findDetailValue(providerClientDetails, ["hidden_retainer_interest_percent", "hidden_retainer_nf_interest_percent", "retainer_nf_interest_percent"])) || "—" },
    { label: "WC Principal", value: percentDisplay(findDetailValue(providerClientDetails, ["hidden_retainer_wc_principal_percent", "retainer_wc_principal_percent", "Retainer WC Principal", "WC Principal"])) || "—" },
    { label: "WC Interest", value: percentDisplay(findDetailValue(providerClientDetails, ["hidden_retainer_wc_interest_percent", "retainer_wc_interest_percent", "Retainer WC Interest", "WC Interest"])) || "—" },
    { label: "Liens Principal", value: percentDisplay(findDetailValue(providerClientDetails, ["hidden_retainer_liens_principal_percent", "hidden_retainer_lien_principal_percent", "retainer_liens_principal_percent", "retainer_lien_principal_percent", "Retainer Liens Principal", "Retainer Lien Principal"])) || "—" },
    { label: "Liens Interest", value: percentDisplay(findDetailValue(providerClientDetails, ["hidden_retainer_liens_interest_percent", "hidden_retainer_lien_interest_percent", "retainer_liens_interest_percent", "retainer_lien_interest_percent", "Retainer Liens Interest", "Retainer Lien Interest"])) || "—" },
  ];

  const providerBillingRows = [
    { label: "Pull Costs", value: findDetailValue(providerClientDetails, ["hidden_pull_costs", "pull_costs", "Pull Costs", "Pull Cost"]) || "—" },
    { label: "Remit", value: findDetailValue(providerClientDetails, ["hidden_remit", "remit", "Remit", "remit_type", "remit_account"]) || "—" },
  ];

  const previewLines = Array.isArray(preview?.lines) ? preview.lines : [];
  const previewTotals = preview?.totalsSnapshot || {};
  const previewDiagnostics = preview?.receiptMarkDiagnostics || {};
  const principalInterestPreviewLines = previewLines.filter((line: any) => line?.lineType === "receipt");
  const costPaymentPreviewLines = previewLines.filter((line: any) => line?.lineType === "filing_fee_payment" || line?.lineType === "cost_expended");
  const principalInterestPaymentCount = principalInterestPreviewLines.length;
  const principalInterestPaymentTotal = principalInterestPreviewLines.reduce((sum: number, line: any) => sum + Number(line?.amount || 0), 0);
  const costPaymentCount = costPaymentPreviewLines.length;
  const costPaymentTotal = costPaymentPreviewLines.reduce((sum: number, line: any) => sum + Number(line?.amount || 0), 0);
  const detailInvoice = invoiceDetail?.invoice;
  const selectedInvoiceId = detailInvoice?.id || invoiceDetail?.invoiceId || null;
  const isInvoiceDetailOpen = (invoice: any) => invoiceDetailVisible && selectedInvoiceId && String(selectedInvoiceId) === String(invoice?.id);
  const toggleInvoiceDetail = (invoice: any) => {
    if (isInvoiceDetailOpen(invoice)) {
      setInvoiceDetailVisible(false);
      setInvoiceDetail(null);
      return;
    }
    loadInvoiceDetail(invoice.id);
  };
  const detailLines = Array.isArray(detailInvoice?.lines) ? detailInvoice.lines : [];

  const historyCsvRows = useMemo(
    () =>
      history.map((invoice) => ({
        "Invoice Number": invoice.invoiceNumber,
        Provider: invoice.providerDisplayName,
        Status: invoice.status,
        Created: invoice.createdAt,
        Finalized: invoice.finalizedAt,
        Voided: invoice.voidedAt,
        "Line Count": invoice.lineCount,
        "Invoice Total": invoice.invoicePackageTotal,
      })),
    [history]
  );

  return (
    <main style={pageStyle}>
      <div style={{ marginBottom: 18, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Link href={id ? `/admin/clients/${encodeURIComponent(id)}` : "/admin/clients"} style={{ color: "#2563eb", fontWeight: 800, textDecoration: "none" }}>
          ← Main Client Info Page
        </Link>
        <Link href="/admin/invoices" style={{ color: "#2563eb", fontWeight: 800, textDecoration: "none" }}>
          Global Invoice Search
        </Link>
        <Link href="/admin" style={{ color: "#2563eb", fontWeight: 800, textDecoration: "none" }}>
          Admin Home
        </Link>
      </div>

      <section style={{ marginBottom: 22 }}>
        <div style={{ color: "#64748b", fontSize: 13, fontWeight: 800, textTransform: "uppercase" }}>
          Invoicing / Remittance
        </div>
        <h1 style={{ margin: "6px 0 8px", fontSize: 34 }}>Provider Client Invoice Workflow</h1>
      </section>

      {error && <section style={{ ...cardStyle, borderColor: "#fecaca", color: "#b91c1c", marginBottom: 18 }}>{error}</section>}
      {message && <section style={{ ...cardStyle, borderColor: "#bfdbfe", color: "#1d4ed8", marginBottom: 18 }}>{message}</section>}

      <section style={{ ...cardStyle, marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap", marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 950, letterSpacing: "-0.01em" }}>{clientDetail?.displayName || "Provider Client"}</h2>
        </div>

        {clientDetailLoading ? (
          <p style={{ color: "#64748b" }}>Loading provider/client info...</p>
        ) : (
          <dl style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1.25fr) minmax(220px, 1fr) minmax(180px, 0.8fr)", gap: "8px 28px", margin: 0 }}>
            <div style={compactInfoGroupStyle}>
              {providerIdentityRows.map((row) => (
                <ProviderInfoItem key={row.label} label={row.label} value={row.value} multiline={row.multiline} />
              ))}
            </div>
            <div style={compactInfoGroupStyle}>
              {providerPercentageRows.map((row) => (
                <ProviderInfoItem key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
            <div style={compactInfoGroupStyle}>
              {providerBillingRows.map((row) => (
                <ProviderInfoItem key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
          </dl>
        )}
      </section>


      <section style={{ ...cardStyle, marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>1. Preview</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(160px, 1fr))", gap: 10, alignItems: "end" }}>
          <label style={{ fontWeight: 800 }}>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={filterControlStyle}>
              <option value="posted">Posted</option>
              <option value="voided">Voided</option>
              <option value="All">All</option>
            </select>
          </label>

          <label style={{ fontWeight: 800 }}>
            Transaction Type
            <select value={transactionType} onChange={(event) => setTransactionType(event.target.value)} style={filterControlStyle}>
                            <option value="">All</option>
              <option value="Voluntary Payment">Voluntary Payment</option>
              <option value="Collection Payment">Collection Payment</option>
              <option value="Interest">Interest</option>
              <option value="Index Fee">Index Fee</option>
              <option value="Service Fee">Service Fee</option>
              <option value="Other Court Costs">Other Court Costs</option>
            </select>
          </label>

          <label style={{ fontWeight: 800 }}>
            Date From
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} style={filterControlStyle} />
          </label>

          <label style={{ fontWeight: 800 }}>
            Date To
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} style={filterControlStyle} />
          </label>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={loadPreview} disabled={loadingPreview || !id} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid #2563eb", background: "#2563eb", color: "#fff", fontWeight: 900 }}>
            {loadingPreview ? "Loading Preview..." : "Preview Invoice"}
          </button>
          <button type="button" onClick={() => downloadCsv("provider-client-invoice-history.csv", historyCsvRows)} disabled={!historyCsvRows.length} style={{ marginLeft: "auto", padding: "9px 14px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 900 }}>
            Export CSV
          </button>
        </div>
      </section>

      <section style={{ ...cardStyle, marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>2. Review Invoice</h2>
        {!preview ? (
          <p style={{ color: "#64748b" }}>No preview loaded.</p>
        ) : (
          <>            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(360px, 1fr))", gap: 24, marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <strong>Number of Principal / Interest Payments Received:</strong>
                <span style={{ whiteSpace: "nowrap" }}>{principalInterestPaymentCount} — {money(principalInterestPaymentTotal)}</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <strong>Number of Costs Payments Received:</strong>
                <span style={{ whiteSpace: "nowrap" }}>{costPaymentCount} — {money(costPaymentTotal)}</span>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Matter</th>
                    <th style={thStyle}>Patient</th>
                    <th style={thStyle}>Provider</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Description</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Retainer Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {previewLines.slice(0, 250).map((line: any, index: number) => (
                    <tr key={`${line.sourceTable}-${line.sourceId}-${index}`}>
                      <td style={tdStyle}>{dateOnly(line.sortDate)}</td>
                      <td style={tdStyle}>{line.matter || "—"}</td>
                      <td style={tdStyle}>{line.patient || "—"}</td>
                      <td style={tdStyle}>{line.provider || "—"}</td>
                      <td style={tdStyle}>{line.lineType || "—"}</td>
                      <td style={tdStyle}>{line.description || "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{money(line.amount)}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{money(line.retainerFee)}</td>
                    </tr>
                  ))}
                  {!previewLines.length && (
                    <tr>
                      <td style={tdStyle} colSpan={8}>No eligible invoice lines in this preview.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section style={{ ...cardStyle, marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>3. Create Draft Invoice</h2>
        <p style={{ color: "#475569" }}>
          Draft invoices freeze the package lines but do not mark receipt rows as invoiced.
        </p>
        <button type="button" onClick={createDraftInvoice} disabled={!preview || creatingDraft} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid #2563eb", background: preview ? "#2563eb" : "#94a3b8", color: "#fff", fontWeight: 900 }}>
          {creatingDraft ? "Creating Draft..." : "Create Draft Invoice"}
        </button>
      </section>

      <section style={{ ...cardStyle, marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>4. Finalize Invoice</h2>
        <p style={{ color: "#475569" }}>
          Finalizing marks included MatterPaymentReceipt rows with this invoice ID. Finalized rows are excluded from future ordinary previews.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" onClick={() => finalizeInvoice()} disabled={!createdInvoice || createdInvoice?.status !== "draft" || finalizing} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid #166534", background: createdInvoice?.status === "draft" ? "#166534" : "#94a3b8", color: "#fff", fontWeight: 900 }}>
            {finalizing ? "Finalizing..." : "Finalize Invoice"}
          </button>
          {createdInvoice && (
            <span>
              {statusBadge(createdInvoice.status)} <strong>{createdInvoice.invoiceNumber}</strong>
            </span>
          )}
        </div>
      </section>

      <section style={{ ...cardStyle, marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <h2 style={{ marginTop: 0 }}>Invoice History</h2>
            <p style={{ color: "#475569", marginTop: 0 }}>
              View finalized invoice detail, finalize drafts, void finalized invoices, and print/save invoices as PDF.
            </p>
          </div>
          <button type="button" onClick={() => loadHistory()} disabled={loadingHistory} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 900 }}>
            {loadingHistory ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Invoice Number</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Created</th>
                <th style={thStyle}>Finalized</th>
                <th style={thStyle}>Voided</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Lines</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map((invoice) => (
                <tr key={invoice.id}>
                  <td style={tdStyle}><strong><button
                          type="button"
                          onClick={() => loadInvoiceDetail(invoice.id)}
                          style={{ border: 0, background: "transparent", padding: 0, color: "#2563eb", fontWeight: 800, cursor: "pointer" }}
                        >
                          {invoice.invoiceNumber}
                        </button></strong></td>
                  <td style={tdStyle}>{statusBadge(invoice.status)}</td>
                  <td style={tdStyle}>{dateOnly(invoice.createdAt)}</td>
                  <td style={tdStyle}>{dateOnly(invoice.finalizedAt) || "—"}</td>
                  <td style={tdStyle}>{dateOnly(invoice.voidedAt) || "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{invoice.lineCount}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{money(invoice.invoicePackageTotal)}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => toggleInvoiceDetail(invoice)} style={secondaryButtonStyle}>{isInvoiceDetailOpen(invoice) ? "Hide" : "View"}</button>
                      {invoice.status === "draft" && (
                        <button type="button" onClick={() => finalizeInvoice(invoice)} style={{ padding: "5px 8px", borderRadius: 8, border: "1px solid #166534", background: "#166534", color: "#fff", fontWeight: 900 }}>Finalize</button>
                      )}
                      {invoice.status === "finalized" && (
                        <button type="button" onClick={() => voidInvoice(invoice)} style={{ padding: "5px 8px", borderRadius: 8, border: "1px solid #991b1b", background: "#fff", color: "#991b1b", fontWeight: 900 }}>Void</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!history.length && (
                <tr>
                  <td style={tdStyle} colSpan={8}>No invoices yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {invoiceDetailVisible && invoiceDetail && (
        <section style={{ ...cardStyle, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ marginTop: 0 }}>Invoice Detail: {detailInvoice?.invoiceNumber}</h2>
              <p style={{ color: "#475569", marginTop: 0 }}>
                {detailInvoice?.status === "draft" && "Draft invoice created. Receipt rows are not yet marked as invoiced. Review the package before finalizing."}
                {detailInvoice?.status === "finalized" && "Invoice finalized. Included receipt rows are marked with this invoice ID and excluded from future invoice previews by default."}
                {detailInvoice?.status === "voided" && "Invoice voided. Receipt rows previously marked with this invoice ID were released for future invoicing. The voided invoice remains in history."}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "start", flexWrap: "wrap" }}>
              <button type="button" onClick={printableInvoice} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #0f172a", background: "#0f172a", color: "#fff", fontWeight: 900 }}>Print / Save PDF</button>
              {detailInvoice?.status === "draft" && (
                <button type="button" onClick={() => finalizeInvoice(detailInvoice)} disabled={finalizing} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #166534", background: "#166534", color: "#fff", fontWeight: 900 }}>Finalize</button>
              )}
              {detailInvoice?.status === "finalized" && (
                <button type="button" onClick={() => voidInvoice(detailInvoice)} disabled={voiding} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #991b1b", background: "#fff", color: "#991b1b", fontWeight: 900 }}>Void</button>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(140px, 1fr))", gap: 12, margin: "12px 0" }}>
            <div><strong>Status</strong><br />{statusBadge(detailInvoice?.status)}</div>
            <div><strong>Rows Found</strong><br />{invoiceDetail.verification?.receiptRowsFound ?? 0}</div>
            <div><strong>Marked This Invoice</strong><br />{invoiceDetail.verification?.receiptRowsMarkedWithThisInvoiceId ?? 0}</div>
            <div><strong>Marked Another Invoice</strong><br />{invoiceDetail.verification?.receiptRowsMarkedWithAnotherInvoiceId ?? 0}</div>
            <div><strong>Unmarked</strong><br />{invoiceDetail.verification?.receiptRowsUnmarked ?? 0}</div>
          </div>

          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Matter</th>
                  <th style={thStyle}>Patient</th>
                  <th style={thStyle}>Provider</th>
                  <th style={thStyle}>Description</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Retainer Fee</th>
                </tr>
              </thead>
              <tbody>
                {detailLines.map((line: any) => (
                  <tr key={line.id}>
                    <td style={tdStyle}>{dateOnly(line.sortDate)}</td>
                    <td style={tdStyle}>{line.matter || "—"}</td>
                    <td style={tdStyle}>{line.patient || "—"}</td>
                    <td style={tdStyle}>{line.provider || "—"}</td>
                    <td style={tdStyle}>{line.description || "—"}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{money(line.amount)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{money(line.retainerFee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3>Invoice Audit History</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Event</th>
                  <th style={thStyle}>Summary</th>
                </tr>
              </thead>
              <tbody>
                {(invoiceDetail.auditEvents || []).map((event: any) => (
                  <tr key={event.id}>
                    <td style={tdStyle}>{dateTime(event.createdAt)}</td>
                    <td style={tdStyle}>{event.eventType}</td>
                    <td style={tdStyle}>{event.eventSummary || "—"}</td>
                  </tr>
                ))}
                {!(invoiceDetail.auditEvents || []).length && (
                  <tr>
                    <td style={tdStyle} colSpan={3}>No audit events yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
