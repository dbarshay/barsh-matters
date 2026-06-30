"use client";

import BarshHeader from "@/app/components/BarshHeader";
import { formatDateOnlyForDisplay } from "@/lib/dateOnlyDisplay";
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

const summarySectionLabelStyle: React.CSSProperties = {
  marginBottom: 10,
  color: "#475569",
  fontSize: 12,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const topSummaryPanelStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  background: "#ffffff",
  padding: 14,
  minHeight: 150,
};

const activeStatusPillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  width: "fit-content",
  borderRadius: 999,
  padding: "3px 9px",
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#166534",
  fontSize: 12,
  fontWeight: 950,
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
  return formatDateOnlyForDisplay(value);
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
  const [costLedger, setCostLedger] = useState<any>(null);
  const [costLedgerVisible, setCostLedgerVisible] = useState(false);
  const [loadingCostLedger, setLoadingCostLedger] = useState(false);
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

  async function loadCostLedger(clientId = id) {
    if (!clientId) return;
    setLoadingCostLedger(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/clients/${encodeURIComponent(clientId)}/invoice/cost-ledger?${previewQuery().toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "Could not load client cost ledger.");
      setCostLedger(json);
      setCostLedgerVisible(true);
    } catch (err: any) {
      setError(err?.message || "Could not load client cost ledger.");
    } finally {
      setLoadingCostLedger(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    loadClientDetail(id);
    loadHistory(id);
    loadCostLedger(id);
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


  function scrollToInvoiceSection(sectionId: string, delayMs = 150) {
    window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, delayMs);
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
      await loadCostLedger();
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

    const receiptLineCount = invoiceReceiptLineCount(invoice);

    const confirmed = window.confirm(
      [
        `Finalize invoice ${invoice?.invoiceNumber || invoiceId}?`,
        "",
        `This will mark ${receiptLineCount || "the included"} MatterPaymentReceipt row${receiptLineCount === 1 ? "" : "s"} with this invoice ID and exclude them from future ordinary previews.`,
        "Frozen invoice lines will remain the invoice review/output source.",
      ].join("\n")
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
      const markedCount = json?.verification?.receiptRowsMarkedWithThisInvoiceId ?? 0;
      const lineCount = json?.verification?.lineCount ?? 0;
      setMessage(
        `Invoice finalized. ${markedCount} included receipt row${markedCount === 1 ? "" : "s"} marked with this invoice ID. ${lineCount} frozen invoice line${lineCount === 1 ? "" : "s"} remain the review/output source.`
      );
      await loadInvoiceDetail(invoiceId);
      setInvoiceDetailVisible(true);
      await loadHistory();
      await loadCostLedger();
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
      await loadCostLedger();
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
    const principalInterestLines = lines.filter((line: any) => line?.lineType === "receipt");
    const directProviderPaymentLines = lines.filter((line: any) => line?.lineType === "direct_pay_to_provider");
    const costsReceivedLines = lines.filter((line: any) => line?.lineType === "filing_fee_payment");
    const feesCostsExpendedLines = lines.filter((line: any) => line?.lineType === "cost_expended");

    const sectionTotal = (sectionLines: any[]) => sectionLines.reduce((sum: number, line: any) => sum + Number(line?.amount || 0), 0);
    const sectionRetainerTotal = (sectionLines: any[]) => sectionLines.reduce((sum: number, line: any) => sum + Number(line?.retainerFee || 0), 0);
    const sectionRemitTotal = (sectionLines: any[]) => sectionLines.reduce((sum: number, line: any) => sum + previewRemitToProvider(line), 0);

    function printableDos(line: any) {
      return [dateOnly(line.dateOfService), dateOnly(invoiceLineDosEnd(line))].filter(Boolean).join(" – ");
    }

    function lineTypeForPrint(line: any) {
      return previewLineDisplayType(line);
    }

    function principalInterestRows(sectionLines: any[]) {
      return sectionLines
        .map(
          (line: any) => `
      <tr>
        <td>${safeHtml(line.matter || "")}</td>
        <td>${safeHtml(line.patient || "")}</td>
        <td class="date">${safeHtml(dateOnly(line.dateOfLoss))}</td>
        <td class="date">${safeHtml(printableDos(line))}</td>
        <td>${safeHtml(line.insurer || "")}</td>
        <td>${safeHtml(line.caseType || "")}</td>
        <td>${safeHtml(lineTypeForPrint(line))}</td>
        <td class="date">${safeHtml(dateOnly(line.sortDate))}</td>
        <td class="date">${safeHtml(dateOnly(line.checkDate))}</td>
        <td>${safeHtml(line.checkNumber || "")}</td>
        <td class="money">${safeHtml(money(line.billedAmount))}</td>
        <td class="money">${safeHtml(money(line.amount))}</td>
        <td class="money">${safeHtml(money(line.retainerFee))}</td>
        <td class="money">${safeHtml(money(previewRemitToProvider(line)))}</td>
      </tr>`
        )
        .join("");
    }

    function directProviderPaymentRows(sectionLines: any[]) {
      return principalInterestRows(sectionLines);
    }

    function costsReceivedRows(sectionLines: any[]) {
      return sectionLines
        .map(
          (line: any) => `
      <tr>
        <td>${safeHtml(line.matter || "")}</td>
        <td>${safeHtml(line.patient || "")}</td>
        <td class="date">${safeHtml(dateOnly(line.dateOfLoss))}</td>
        <td class="date">${safeHtml(printableDos(line))}</td>
        <td>${safeHtml(line.insurer || "")}</td>
        <td>${safeHtml(line.caseType || "")}</td>
        <td>${safeHtml(lineTypeForPrint(line))}</td>
        <td class="date">${safeHtml(dateOnly(line.sortDate))}</td>
        <td class="date">${safeHtml(dateOnly(line.checkDate))}</td>
        <td>${safeHtml(line.checkNumber || "")}</td>
        <td class="money">${safeHtml(money(line.amount))}</td>
      </tr>`
        )
        .join("");
    }

    function feesCostsExpendedRows(sectionLines: any[]) {
      return sectionLines
        .map(
          (line: any) => `
      <tr>
        <td>${safeHtml(line.matter || "")}</td>
        <td>${safeHtml(line.patient || "")}</td>
        <td class="date">${safeHtml(dateOnly(line.dateOfLoss))}</td>
        <td class="date">${safeHtml(printableDos(line))}</td>
        <td>${safeHtml(line.insurer || "")}</td>
        <td>${safeHtml(line.caseType || "")}</td>
        <td>${safeHtml(lineTypeForPrint(line))}</td>
        <td class="date">${safeHtml(dateOnly(line.sortDate))}</td>
        <td class="money">${safeHtml(money(line.amount))}</td>
      </tr>`
        )
        .join("");
    }

    function emptyRow(colSpan: number, message: string) {
      return `<tr><td colspan="${colSpan}" class="empty">${safeHtml(message)}</td></tr>`;
    }

    const summaryPrincipalInterestReceived = Number(invoice.principalInterestTotal || 0);
    const summaryDirectProviderPayments = Number(invoice.directProviderPaymentTotal || invoice.totalsSnapshot?.directProviderPaymentTotal || 0);
    const summaryDirectProviderRetainerFee = Number(invoice.directProviderRetainerFeeTotal || invoice.totalsSnapshot?.directProviderRetainerFeeTotal || 0);
    const summaryRetainerFee = Number(invoice.retainerFeeTotal || 0);
    const summaryNetRemitToProvider = summaryPrincipalInterestReceived - summaryRetainerFee;
    const printableCostSummary = invoiceCostSummaryValues(invoice);
    const printableCostDeductionCapHtml = isNonZeroMoneyValue(printableCostSummary.costBalanceDeductionApplied)
      ? `<div><span>25% Deduction Cap</span><span>${safeHtml(money(printableCostSummary.costBalanceDeductionCap))}</span></div>`
      : "";
    const printableCostBalanceAppliedToLedgerHtml = isNonZeroMoneyValue(printableCostSummary.costBalanceAppliedToLedger)
      ? `<div><span>Cost Excess Applied to Negative Cost Balance</span><span class="negative-remit-adjustment">${safeHtml(money(printableCostSummary.costBalanceAppliedToLedger))}</span></div>`
      : "";
    const printableNegativeCostBalanceBeforeHtml = isNonZeroMoneyValue(printableCostSummary.costBalanceLedgerBefore)
      ? `<div><span>Negative Cost Balance Before This Remittance</span><span>${safeHtml(money(printableCostSummary.costBalanceLedgerBefore))}</span></div>`
      : "";
    const printableNegativeCostBalanceAfterHtml = isNonZeroMoneyValue(printableCostSummary.costBalanceLedgerAfter)
      ? `<div><span>Negative Cost Balance After This Remittance</span><span>${safeHtml(money(printableCostSummary.costBalanceLedgerAfter))}</span></div>`
      : "";
    const printableCostExcessAddedToNetRemitHtml = isNonZeroMoneyValue(printableCostSummary.costBalanceReimbursementToProvider)
      ? `<div class="summary-emphasis"><span>Cost Excess Added to Net Remit</span><span>${safeHtml(money(printableCostSummary.costBalanceReimbursementToProvider))}</span></div>`
      : "";
    const printableCostDeductionAppliedHtml = isNonZeroMoneyValue(printableCostSummary.costBalanceDeductionApplied)
      ? `<div class="summary-emphasis"><span>Cost Deduction Applied</span><span class="negative-remit-adjustment">${safeHtml(money(printableCostSummary.costBalanceDeductionApplied))}</span></div>`
      : "";
    const summaryFinalNetRemitToProvider = printableCostSummary.netRemitToProviderTotal;

    function normalizeAddressDisplayLine(line: any): string {
      const text = String(line || "").trim().replace(/\s+/g, " ");
      if (!text) return "";

      const titleCased = text
        .toLowerCase()
        .replace(/\b([a-z])/g, (match) => match.toUpperCase())
        .replace(/\bPo Box\b/i, "PO Box")
        .replace(/\bP\.O\. Box\b/i, "PO Box")
        .replace(/\bNy\b/g, "NY")
        .replace(/\bUsa\b/g, "USA");

      return titleCased
        .replace(/, New York\b/i, ", NY")
        .replace(/\bNew York, NY\b/i, "New York, NY");
    }

    const normalizedAddressHtml = safeHtml(
      String(invoice.clientSnapshot?.address || "")
        .split(/\r?\n/)
        .map((line: string) => normalizeAddressDisplayLine(line))
        .filter(Boolean)
        .join("\n")
    ).replace(/\n/g, "<br />");
    const providerName = safeHtml(invoice.providerDisplayName || "Client");
    const statementTitle = "Remittance / Statement of Account";
    const statementPeriod = [dateOnly(invoice.dateFrom), dateOnly(invoice.dateTo)].filter(Boolean).join(" – ") || "—";
    const invoiceDate = dateOnly(invoice.finalizedAt || invoice.createdAt) || "—";
    const printedOn = new Date().toLocaleString();
    const logoSrc = "/brl-logo.png";

    const html = `<!doctype html>
<html>
<head>
  <title>Invoice ${safeHtml(invoice.invoiceNumber)}</title>
  <style>
    @page { margin: 0.35in; size: landscape; }
    body { font-family: Arial, sans-serif; color: #0f172a; font-size: 13px; line-height: 1.35; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    button { margin: 0 0 14px; padding: 8px 12px; border: 1px solid #0f172a; border-radius: 8px; background: #0f172a; color: #fff; font-weight: 800; }
    h1 { margin: 0; font-size: 28px; letter-spacing: -0.025em; }
    h2 { margin: 20px 0 6px; font-size: 16px; border-bottom: 2px solid #0f172a; padding-bottom: 4px; }
    .topline { display: grid; grid-template-columns: 390px minmax(720px, 1fr) 340px; gap: 34px; align-items: stretch; border-bottom: 2px solid #cbd5e1; padding-bottom: 16px; margin-bottom: 16px; }
    .header-left { display: flex; align-items: flex-start; justify-content: flex-start; }
    .header-center { display: flex; flex-direction: column; justify-content: space-between; align-items: center; min-height: 170px; }
    .header-right { display: flex; flex-direction: column; align-items: flex-end; }
    .brl-logo { height: 170px; max-width: 380px; object-fit: contain; display: block; }
    .provider-name { width: 100%; font-size: 24px; font-weight: 900; letter-spacing: -0.02em; line-height: 1.15; text-align: center; white-space: nowrap; }
    .provider-address { width: 100%; margin-top: 6px; font-size: 12px; font-weight: 700; color: #334155; line-height: 1.35; text-align: center; }
    .statement-title { width: 100%; font-size: 20px; font-weight: 800; letter-spacing: -0.01em; line-height: 1.15; text-align: center; white-space: nowrap; }
    .statement-address { width: 320px; max-width: 100%; color: #334155; line-height: 1.35; text-align: left; }
    .statement-meta-block { width: 320px; max-width: 100%; margin-top: 14px; text-align: left; }
    .statement-meta-row { margin-top: 7px; color: #0f172a; }
    .statement-meta-label { display: block; font-size: 18px; font-weight: 900; line-height: 1.1; }
    .statement-meta-value { display: block; margin-top: 4px; font-size: 16px; font-weight: 800; line-height: 1.15; color: #334155; }
    .muted { color: #475569; }
    .meta { margin-top: 4px; color: #334155; }
    .grid { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 12px; margin: 16px 0; }
    .card { border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px; min-height: 72px; }
    .label { color: #475569; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; font-weight: 800; }
    .value { margin-top: 3px; font-weight: 700; }
    table { border-collapse: collapse; width: 100%; margin-top: 8px; font-size: 14px; page-break-inside: auto; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 9px; text-align: left; vertical-align: top; }
    th { background: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.02em; color: #ffffff; white-space: nowrap; text-align: center; font-weight: 900; }
    .money { text-align: right; white-space: nowrap; }
    .date { white-space: nowrap; }
    .section-note { color: #475569; font-size: 12px; margin: 4px 0 8px; display: flex; gap: 20px; flex-wrap: wrap; }
    .empty { color: #64748b; font-style: italic; text-align: center; padding: 10px; }
    .section-total td { font-weight: 800; background: #f8fafc; border-top: 2px solid #94a3b8; }
    .totals { margin-top: 30px; width: 680px; margin-left: auto; border: 3px solid #94a3b8; border-radius: 14px; padding: 22px 24px; font-size: 20px; break-inside: avoid; page-break-inside: avoid; }
    .totals div { display: flex; justify-content: space-between; gap: 30px; padding: 10px 0; }
    .summary-emphasis { padding-left: 28px !important; font-weight: 900; }
    .summary-emphasis span { font-weight: 900; }
    .negative-remit-adjustment { color: #b91c1c; font-weight: 900; }
    .total { font-weight: 900; border-top: 4px solid #0f172a; margin-top: 12px; padding-top: 16px !important; font-size: 28px; }
    .footer { margin-top: 18px; color: #64748b; font-size: 10px; }
    @media print { button { display: none; } body { padding: 0; } thead { display: table-header-group; } tfoot { display: table-footer-group; } .totals { break-inside: avoid; page-break-inside: avoid; } }
  </style>
</head>
<body>
  <button onclick="window.print()">Print / Save as PDF</button>

  <div class="topline">
    <div class="header-left">
      <img src="${safeHtml(logoSrc)}" alt="BRL Logo" class="brl-logo" />
    </div>
    <div class="header-center">
      <div>
        <div class="provider-name">${providerName}</div>
        <div class="provider-address">${normalizedAddressHtml || "—"}</div>
      </div>
      <div class="statement-title">${statementTitle}</div>
    </div>
    <div class="header-right">
      <div class="statement-meta-block">
        <div class="statement-meta-row"><span class="statement-meta-label">Statement Number:</span><span class="statement-meta-value">${safeHtml(invoice.invoiceNumber)}</span></div>
        <div class="statement-meta-row"><span class="statement-meta-label">Statement Period:</span><span class="statement-meta-value">${safeHtml(statementPeriod)}</span></div>
        <div class="statement-meta-row"><span class="statement-meta-label">Invoice Date:</span><span class="statement-meta-value">${safeHtml(invoiceDate)}</span></div>
      </div>
    </div>
  </div>


  <h2>Principal / Interest Received</h2>
  <div class="section-note">
    <span>Gross: ${safeHtml(money(sectionTotal(principalInterestLines)))}</span>
    <span>Retainer Fee: ${safeHtml(money(sectionRetainerTotal(principalInterestLines)))}</span>
    <span>Net Remit: ${safeHtml(money(sectionRemitTotal(principalInterestLines)))}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Matter</th><th>Patient</th><th>DOL</th><th>DOS</th><th>Insurer</th><th>Case</th><th>Type</th><th>Posted</th><th>Check Date</th><th>Check #</th><th class="money">Amt. Billed</th><th class="money">Amt. Received</th><th class="money">Retainer Fee</th><th class="money">Net Remit</th>
      </tr>
    </thead>
    <tbody>
      ${principalInterestRows(principalInterestLines) || emptyRow(14, "No principal or interest payments.")}
      <tr class="section-total"><td colspan="11">Section Total</td><td class="money">${safeHtml(money(sectionTotal(principalInterestLines)))}</td><td class="money">${safeHtml(money(sectionRetainerTotal(principalInterestLines)))}</td><td class="money">${safeHtml(money(sectionRemitTotal(principalInterestLines)))}</td></tr>
    </tbody>
  </table>

  <h2>Direct Payments to Provider</h2>
  <div class="section-note">
    <span>Gross Direct Payments: ${safeHtml(money(sectionTotal(directProviderPaymentLines)))}</span>
    <span>Retainer Fee: ${safeHtml(money(sectionRetainerTotal(directProviderPaymentLines)))}</span>
    <span>Net Remit Impact: ${safeHtml(money(sectionRemitTotal(directProviderPaymentLines)))}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Matter</th><th>Patient</th><th>DOL</th><th>DOS</th><th>Insurer</th><th>Case</th><th>Type</th><th>Posted</th><th>Check Date</th><th>Check #</th><th class="money">Amt. Billed</th><th class="money">Direct Paid</th><th class="money">Retainer Fee</th><th class="money">Net Remit Impact</th>
      </tr>
    </thead>
    <tbody>
      ${directProviderPaymentRows(directProviderPaymentLines) || emptyRow(14, "No direct payments to provider.")}
      <tr class="section-total"><td colspan="11">Section Total</td><td class="money">${safeHtml(money(sectionTotal(directProviderPaymentLines)))}</td><td class="money">${safeHtml(money(sectionRetainerTotal(directProviderPaymentLines)))}</td><td class="money">${safeHtml(money(sectionRemitTotal(directProviderPaymentLines)))}</td></tr>
    </tbody>
  </table>

  <h2>Costs Received</h2>
  <div class="section-note">
    <span>Total Costs Received: ${safeHtml(money(sectionTotal(costsReceivedLines)))}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Matter</th><th>Patient</th><th>DOL</th><th>DOS</th><th>Insurer</th><th>Case</th><th>Type</th><th>Posted</th><th>Check Date</th><th>Check #</th><th class="money">Amt. Received</th>
      </tr>
    </thead>
    <tbody>
      ${costsReceivedRows(costsReceivedLines) || emptyRow(11, "No costs received.")}
      <tr class="section-total"><td colspan="10">Section Total</td><td class="money">${safeHtml(money(sectionTotal(costsReceivedLines)))}</td></tr>
    </tbody>
  </table>

  <h2>Costs Expended</h2>
  <div class="section-note">
    <span>Total Costs Expended: ${safeHtml(money(sectionTotal(feesCostsExpendedLines)))}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Matter</th><th>Patient</th><th>DOL</th><th>DOS</th><th>Insurer</th><th>Case</th><th>Type</th><th>Date Incurred</th><th class="money">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${feesCostsExpendedRows(feesCostsExpendedLines) || emptyRow(9, "No fees or costs expended.")}
      <tr class="section-total"><td colspan="8">Section Total</td><td class="money">${safeHtml(money(sectionTotal(feesCostsExpendedLines)))}</td></tr>
    </tbody>
  </table>

  <div class="totals">
    <div><span>Principal / Interest Received</span><span>${safeHtml(money(summaryPrincipalInterestReceived))}</span></div>
    ${summaryDirectProviderPayments || summaryDirectProviderRetainerFee ? `<div><span>Direct Payments to Provider</span><span>${safeHtml(money(summaryDirectProviderPayments))}</span></div>` : ""}
    ${summaryDirectProviderPayments || summaryDirectProviderRetainerFee ? `<div><span>Direct Payment Retainer Fee</span><span>${safeHtml(money(summaryDirectProviderRetainerFee))}</span></div>` : ""}
    <div><span>Retainer Fee</span><span>${safeHtml(money(summaryRetainerFee))}</span></div>
    <div class="summary-emphasis"><span>Net Remit Before Costs</span><span>${safeHtml(money(summaryNetRemitToProvider))}</span></div>
    <div><span>Costs Expended During This Remittance Period</span><span>${safeHtml(money(printableCostSummary.costsExpendedTotal))}</span></div>
    <div><span>Costs Received During This Remittance Period</span><span>${safeHtml(money(printableCostSummary.filingFeePaymentTotal))}</span></div>
    <div class="summary-emphasis"><span>Cost Excess / Shortfall This Remittance</span><span>${safeHtml(money(printableCostSummary.costBalanceThisRemittancePeriod))}</span></div>
    ${printableNegativeCostBalanceBeforeHtml}
    ${printableCostDeductionCapHtml}
    ${printableCostBalanceAppliedToLedgerHtml}
    ${printableNegativeCostBalanceAfterHtml}
    ${printableCostExcessAddedToNetRemitHtml}
    ${printableCostDeductionAppliedHtml}
    <div class="total"><span>Final Net Remit to Provider</span><span>${safeHtml(money(summaryFinalNetRemitToProvider))}</span></div>
  </div>

  <div class="footer">
    This invoice was generated from frozen local invoice lines. Word/DOCX is not a delivery format; use this print dialog to save or deliver a PDF copy.
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
    { label: "Status", value: clientDetail?.isActive === false ? "Inactive" : "Active", statusPill: true },
  ];

  const providerPercentageRows = [
    { label: "NF Principal", value: percentDisplay(findDetailValue(providerClientDetails, ["hidden_retainer_principal_nf_percent", "retainer_nf_principal_percent"])) || "—" },
    { label: "NF Interest", value: percentDisplay(findDetailValue(providerClientDetails, ["hidden_retainer_interest_percent", "hidden_retainer_nf_interest_percent", "retainer_nf_interest_percent"])) || "—" },
    { label: "WC Principal", value: percentDisplay(findDetailValue(providerClientDetails, ["hidden_retainer_wc_principal_percent", "retainer_wc_principal_percent", "Retainer WC Principal", "WC Principal"])) || "—" },
    { label: "WC Interest", value: percentDisplay(findDetailValue(providerClientDetails, ["hidden_retainer_wc_interest_percent", "retainer_wc_interest_percent", "Retainer WC Interest", "WC Interest"])) || "—" },
    { label: "Liens Principal", value: percentDisplay(findDetailValue(providerClientDetails, ["hidden_retainer_liens_principal_percent", "hidden_retainer_lien_principal_percent", "retainer_liens_principal_percent", "retainer_lien_principal_percent", "Retainer Liens Principal", "Retainer Lien Principal"])) || "—" },
    { label: "Liens Interest", value: percentDisplay(findDetailValue(providerClientDetails, ["hidden_retainer_liens_interest_percent", "hidden_retainer_lien_interest_percent", "retainer_liens_interest_percent", "retainer_lien_interest_percent", "Retainer Liens Interest", "Retainer Lien Interest"])) || "—" },
  ];

  const previewTotals = preview?.totalsSnapshot || {};
  const latestFinalizedCostBalanceLedger = history.find((invoice: any) => invoice?.status === "finalized")?.costBalanceLedgerAfter;
  const costBalanceLedgerAmount = Number(previewTotals.costBalanceLedgerAfter ?? invoiceDetail?.invoice?.costBalanceLedgerAfter ?? latestFinalizedCostBalanceLedger ?? 0);
  const displayedCostBalanceLedger = money(costBalanceLedgerAmount);
  const latestFinalizedInvoice = history.find((invoice: any) => invoice?.status === "finalized") || null;
  const latestInvoice = history[0] || null;
  const finalizedInvoiceCount = history.filter((invoice: any) => invoice?.status === "finalized").length;
  const draftInvoiceCount = history.filter((invoice: any) => invoice?.status === "draft").length;
  const voidedInvoiceCount = history.filter((invoice: any) => invoice?.status === "voided").length;
  const providerBillingRows = [
    { label: "Pull Costs", value: findDetailValue(providerClientDetails, ["hidden_pull_costs", "pull_costs", "Pull Costs", "Pull Cost"]) || "—" },
    { label: "Remit", value: findDetailValue(providerClientDetails, ["hidden_remit", "remit", "Remit", "remit_type", "remit_account"]) || "—" },
  ];
  const providerAccountControlRows = [
    { label: "Cost Balance", value: displayedCostBalanceLedger, amount: costBalanceLedgerAmount, action: "view-cost-ledger" },
    { label: "Invoice History", value: `${history.length} total`, latest: latestFinalizedInvoice?.invoiceNumber || latestInvoice?.invoiceNumber || "", action: "view-invoice-history" },
  ];

  const previewLines = Array.isArray(preview?.lines) ? preview.lines : [];
  const previewDiagnostics = preview?.receiptMarkDiagnostics || {};
  const principalInterestPreviewLines = previewLines.filter((line: any) => line?.lineType === "receipt");
  const directProviderPaymentPreviewLines = previewLines.filter((line: any) => line?.lineType === "direct_pay_to_provider");
  const costsReceivedPreviewLines = previewLines.filter((line: any) => line?.lineType === "filing_fee_payment");
  const feesCostsExpendedPreviewLines = previewLines.filter((line: any) => line?.lineType === "cost_expended");
  const principalInterestPaymentCount = principalInterestPreviewLines.length;
  const principalInterestPaymentTotal = principalInterestPreviewLines.reduce((sum: number, line: any) => sum + Number(line?.amount || 0), 0);
  const directProviderPaymentCount = directProviderPaymentPreviewLines.length;
  const directProviderPaymentTotal = directProviderPaymentPreviewLines.reduce((sum: number, line: any) => sum + Number(line?.amount || 0), 0);
  const directProviderRetainerFeeTotal = directProviderPaymentPreviewLines.reduce((sum: number, line: any) => sum + Number(line?.retainerFee || 0), 0);
  const costsReceivedPaymentCount = costsReceivedPreviewLines.length;
  const costsReceivedPaymentTotal = costsReceivedPreviewLines.reduce((sum: number, line: any) => sum + Number(line?.amount || 0), 0);
  const feesCostsExpendedCount = feesCostsExpendedPreviewLines.length;
  const feesCostsExpendedTotal = feesCostsExpendedPreviewLines.reduce((sum: number, line: any) => sum + Number(line?.amount || 0), 0);
  const [previewTableSort, setPreviewTableSort] = useState<{ table: string; field: string; direction: "asc" | "desc" } | null>(null);

  const previewTableColumns = [
    { key: "matter", label: "Matter" },
    { key: "patient", label: "Patient" },
    { key: "dateOfLoss", label: "Date of Loss" },
    { key: "dateOfService", label: "Date of Service" },
    { key: "insurer", label: "Insurer" },
    { key: "caseType", label: "Case Type", width: 56 },
    { key: "description", label: "Type" },
    { key: "sortDate", label: "Date Posted", expendedLabel: "Date Incurred" },
    { key: "checkDate", label: "Check Date", hideForExpended: true },
    { key: "checkNumber", label: "Check Number", hideForExpended: true },
    { key: "billedAmount", label: "Amt. Billed", align: "right", headerAlign: "center", hideForCostsReceived: true, hideForExpended: true },
    { key: "amount", label: "Amt. Received", expendedLabel: "Amount Expended", align: "right", headerAlign: "center" },
    { key: "retainerFee", label: "Retainer Fee", align: "right", hideForCostsReceived: true, hideForExpended: true },
    { key: "remitToProvider", label: "Remit to Provider", align: "right", principalOnly: true },
  ];

  function isDirectProviderPaymentLine(line: any): boolean {
    return String(line?.lineType || "").trim() === "direct_pay_to_provider";
  }

  function previewRemitToProvider(line: any): number {
    if (isDirectProviderPaymentLine(line)) return -Number(line?.retainerFee || 0);
    return Number(line?.amount || 0) - Number(line?.retainerFee || 0);
  }

  function invoiceLineDosEnd(line: any): string {
    return String(line?.dosEnd || line?.dateOfServiceEnd || line?.rowSnapshot?.dateOfServiceEnd || line?.rowSnapshot?.dosEnd || "").trim();
  }

  function invoiceReceiptLineCount(invoice: any): number {
    const lines = Array.isArray(invoice?.lines) ? invoice.lines : [];
    return lines.filter((line: any) => clean(line?.sourceTable) === "MatterPaymentReceipt").length;
  }

  function invoiceCostSummaryValues(source: any) {
    const totals = source?.totalsSnapshot || source || {};
    const principalInterestTotal = Number(totals.principalInterestTotal || 0);
    const retainerFeeTotal = Number(totals.retainerFeeTotal || 0);
    const filingFeePaymentTotal = Number(totals.filingFeePaymentTotal || 0);
    const costsExpendedTotal = Number(totals.costsExpendedTotal || 0);
    const baseNetRemitToProvider = Number(totals.baseNetRemitToProvider ?? (principalInterestTotal - retainerFeeTotal));
    const costBalanceThisRemittancePeriod = Number(totals.costBalanceThisRemittancePeriod ?? (filingFeePaymentTotal - costsExpendedTotal));
    const costBalanceLedgerBefore = Number(totals.costBalanceLedgerBefore || 0);
    const costBalanceDeductionCap = costBalanceThisRemittancePeriod < 0
      ? Number(totals.costBalanceDeductionCap ?? Math.max(0, baseNetRemitToProvider * 0.25))
      : 0;
    const currentPeriodPositiveCostBalance = Math.max(0, costBalanceThisRemittancePeriod);
    const currentPeriodNegativeCostBalance = Math.max(0, -costBalanceThisRemittancePeriod);
    const costBalanceAppliedToLedger = Number(totals.costBalanceAppliedToLedger ?? Math.min(currentPeriodPositiveCostBalance, Math.max(0, costBalanceLedgerBefore)));
    const costBalanceReimbursementToProvider = Number(totals.costBalanceReimbursementToProvider ?? Math.max(0, currentPeriodPositiveCostBalance - costBalanceAppliedToLedger));
    const totalRecoverableNegativeCostBalance = Number(totals.totalRecoverableNegativeCostBalance ?? (currentPeriodNegativeCostBalance + Math.max(0, costBalanceLedgerBefore - costBalanceAppliedToLedger)));
    const costBalanceDeductionApplied = Number(totals.costBalanceDeductionApplied ?? Math.min(totalRecoverableNegativeCostBalance, costBalanceDeductionCap));
    const currentShortfallDeductionApplied = Number(totals.currentShortfallDeductionApplied ?? Math.min(currentPeriodNegativeCostBalance, costBalanceDeductionApplied));
    const priorBalanceDeductionApplied = Number(totals.priorBalanceDeductionApplied ?? Math.max(0, costBalanceDeductionApplied - currentShortfallDeductionApplied));
    const costBalanceAddedToLedger = Number(totals.costBalanceAddedToLedger ?? Math.max(0, currentPeriodNegativeCostBalance - currentShortfallDeductionApplied));
    const costBalanceAdjustmentToNetRemit = Number(totals.costBalanceAdjustmentToNetRemit ?? (costBalanceReimbursementToProvider - costBalanceDeductionApplied));
    const costBalanceLedgerAfter = Number(totals.costBalanceLedgerAfter ?? Math.max(0, costBalanceLedgerBefore - costBalanceAppliedToLedger - priorBalanceDeductionApplied + costBalanceAddedToLedger));
    const costBalanceLedgerChange = Number(totals.costBalanceLedgerChange ?? (costBalanceLedgerAfter - costBalanceLedgerBefore));
    const netRemitToProviderTotal = Number(totals.netRemitToProviderTotal ?? (baseNetRemitToProvider + costBalanceAdjustmentToNetRemit));

    return {
      principalInterestTotal,
      retainerFeeTotal,
      filingFeePaymentTotal,
      costsExpendedTotal,
      baseNetRemitToProvider,
      costBalanceThisRemittancePeriod,
      costBalanceDeductionCap,
      costBalanceAppliedToLedger,
      costBalanceReimbursementToProvider,
      costBalanceDeductionApplied,
      costBalanceAddedToLedger,
      costBalanceAdjustmentToNetRemit,
      costBalanceLedgerBefore,
      costBalanceLedgerChange,
      costBalanceLedgerAfter,
      netRemitToProviderTotal,
    };
  }

  function isNonZeroMoneyValue(value: unknown): boolean {
    return Math.abs(Number(value || 0)) >= 0.005;
  }

  function renderClientCostLedger() {
    const rows = Array.isArray(costLedger?.rows) ? costLedger.rows : [];
    const totals = costLedger?.totals || {};
    const csvRows = rows.map((row: any) => ({
      "Kind": row.label || row.ledgerKind,
      "Date Incurred": dateOnly(row.dateIncurred),
      "Posted Date": dateOnly(row.postedDate),
      "Cost Type": row.costType,
      "Matter": row.matter,
      "Lawsuit": row.lawsuit,
      "Patient": row.patient,
      "Amount": money(row.amount),
      "Voided": row.voided ? "Yes" : "No",
      "Invoice Status": row.invoiceStatus || "not_invoiced",
      "Invoice ID": row.invoiceId,
      "Invoice Number": row.invoiceNumber,
      "Eligible": row.eligibleForFutureInvoice ? "Yes" : "No",
      "Reason": row.eligibilityReason,
    }));

    return (
      <section style={{ ...cardStyle, marginTop: 18 }} id="client-cost-ledger">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0 }}>Client Cost Ledger</h2>
            <p style={{ margin: "6px 0 0", color: "#475569", fontSize: 13 }}>
              Cost activity for this invoice/remittance workflow. Finalized non-voided invoice lines block the same cost from future invoice previews; draft invoice lines do not permanently mark source rows.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => loadCostLedger()} disabled={loadingCostLedger} style={secondaryButtonStyle}>
              {loadingCostLedger ? "Loading Ledger..." : "Refresh Ledger"}
            </button>
            <button type="button" onClick={() => setCostLedgerVisible((value) => !value)} style={secondaryButtonStyle}>
              {costLedgerVisible ? "Hide Ledger" : "Show Ledger"}
            </button>
            <button type="button" onClick={() => downloadCsv("client-cost-ledger.csv", csvRows)} disabled={!rows.length} style={secondaryButtonStyle}>
              Export CSV
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(160px, 1fr))", gap: 10, marginTop: 12 }}>
          <div><strong>Total Rows</strong><br />{totals.rowCount ?? rows.length}</div>
          <div><strong>Costs Expended</strong><br />{totals.costExpendedRowCount ?? 0}</div>
          <div><strong>Costs Received</strong><br />{totals.costReceivedRowCount ?? 0}</div>
          <div><strong>Eligible for Future Invoice</strong><br />{totals.eligibleForFutureInvoiceCount ?? 0}</div>
        </div>

        {costLedgerVisible && (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Kind</th>
                  <th style={thStyle}>Date Incurred</th>
                  <th style={thStyle}>Posted Date</th>
                  <th style={thStyle}>Cost Type</th>
                  <th style={thStyle}>Matter / Lawsuit</th>
                  <th style={thStyle}>Amount</th>
                  <th style={thStyle}>Voided</th>
                  <th style={thStyle}>Invoice Status</th>
                  <th style={thStyle}>Eligible</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((row: any, index: number) => (
                  <tr key={`${row.sourceTable}-${row.sourceId}-${index}`}>
                    <td style={tdStyle}>{row.label || row.ledgerKind}</td>
                    <td style={tdStyle}>{dateOnly(row.dateIncurred) || "—"}</td>
                    <td style={tdStyle}>{dateOnly(row.postedDate) || "—"}</td>
                    <td style={tdStyle}>{row.costType || "—"}</td>
                    <td style={tdStyle}>
                      <strong>{row.matter || "—"}</strong>
                      {row.lawsuit ? <><br /><span style={{ color: "#475569" }}>{row.lawsuit}</span></> : null}
                      {row.patient ? <><br /><span style={{ color: "#64748b" }}>{row.patient}</span></> : null}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>{money(row.amount)}</td>
                    <td style={tdStyle}>{row.voided ? "Yes" : "No"}</td>
                    <td style={tdStyle}>
                      <div>{row.invoiceStatus || "not_invoiced"}</div>
                      {row.invoiceNumber ? <div style={{ color: "#475569", fontSize: 12 }}>{row.invoiceNumber}</div> : null}
                      {row.invoiceId ? <div style={{ color: "#64748b", fontSize: 11 }}>{row.invoiceId}</div> : null}
                    </td>
                    <td style={tdStyle}>
                      <strong style={{ color: row.eligibleForFutureInvoice ? "#166534" : "#991b1b" }}>
                        {row.eligibleForFutureInvoice ? "Yes" : "No"}
                      </strong>
                      <div style={{ color: "#64748b", fontSize: 12 }}>{row.eligibilityReason || ""}</div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td style={tdStyle} colSpan={9}>No cost ledger rows found for the current filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  function renderCostBalanceSummary(source: any) {
    const summary = invoiceCostSummaryValues(source);
    const hasDeduction = isNonZeroMoneyValue(summary.costBalanceDeductionApplied);
    const hasCostExcessApplied = isNonZeroMoneyValue(summary.costBalanceAppliedToLedger);
    const hasCostExcessAdded = isNonZeroMoneyValue(summary.costBalanceReimbursementToProvider);
    const hasPriorNegativeBalance = isNonZeroMoneyValue(summary.costBalanceLedgerBefore);
    const hasAfterNegativeBalance = isNonZeroMoneyValue(summary.costBalanceLedgerAfter);

    const rowBaseStyle = {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) auto",
      gap: 18,
      alignItems: "center",
      padding: "10px 12px",
      borderBottom: "1px solid #e2e8f0",
    } as const;

    const shadedRowStyle = { ...rowBaseStyle, background: "#f1f5f9", borderRadius: 12, borderBottom: "1px solid #dbe4ef", margin: "8px 0" } as const;
    const blueRowStyle = { ...rowBaseStyle, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, margin: "8px 0" } as const;
    const labelStyle = { color: "#334155", fontWeight: 850 } as const;
    const amountStyle = { color: "#0f172a", fontWeight: 900, whiteSpace: "nowrap" } as const;
    const redAmountStyle = { ...amountStyle, color: "#b91c1c" } as const;
    const blueAmountStyle = { ...amountStyle, color: "#1d4ed8" } as const;

    const Row = ({ label, value, variant = "normal" }: { label: string; value: any; variant?: "normal" | "shaded" | "blue" | "red" }) => {
      const style = variant === "blue" ? blueRowStyle : variant === "shaded" || variant === "red" ? shadedRowStyle : rowBaseStyle;
      const valueStyle = variant === "blue" ? blueAmountStyle : variant === "red" ? redAmountStyle : amountStyle;
      return (
        <div style={style}>
          <div style={labelStyle}>{label}</div>
          <div style={valueStyle}>{money(value)}</div>
        </div>
      );
    };

    return (
      <section style={{ marginTop: 18, border: "1px solid #cbd5e1", borderRadius: 18, padding: 18, background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 10px 28px rgba(15, 23, 42, 0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontWeight: 950, fontSize: 20, color: "#0f172a" }}>Remittance Summary</h3>
            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
              Provider net remittance, cost recovery, and negative cost balance impact.
            </p>
          </div>
          {hasDeduction && <div style={{ padding: "8px 12px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", fontWeight: 900, whiteSpace: "nowrap" }}>25% cap applied</div>}
        </div>

        <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 10, background: "#ffffff" }}>
          <Row label="Principal / Interest Received" value={summary.principalInterestTotal} />
          <Row label="Retainer Fee" value={summary.retainerFeeTotal} />
          <Row label="Net Remit Before Costs" value={summary.baseNetRemitToProvider} variant="shaded" />
          {hasDeduction && <Row label="25% Deduction Cap" value={summary.costBalanceDeductionCap} variant="blue" />}
          <Row label="Costs Expended During This Remittance Period" value={summary.costsExpendedTotal} />
          <Row label="Costs Received During This Remittance Period" value={summary.filingFeePaymentTotal} />
          <Row label="Cost Excess / Shortfall This Remittance" value={summary.costBalanceThisRemittancePeriod} variant="shaded" />
          {hasPriorNegativeBalance && <Row label="Negative Cost Balance Before This Remittance" value={summary.costBalanceLedgerBefore} />}
          {hasCostExcessApplied && <Row label="Cost Excess Applied to Negative Cost Balance" value={summary.costBalanceAppliedToLedger} variant="red" />}
          {hasAfterNegativeBalance && <Row label="Negative Cost Balance After This Remittance" value={summary.costBalanceLedgerAfter} />}
          {hasCostExcessAdded && <Row label="Cost Excess Added to Net Remit" value={summary.costBalanceReimbursementToProvider} variant="blue" />}
          {hasDeduction && <Row label="Cost Deduction Applied" value={summary.costBalanceDeductionApplied} variant="red" />}

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 18, alignItems: "center", marginTop: 14, padding: "16px 14px", borderRadius: 14, background: "#0f172a", color: "#ffffff", fontSize: 18, fontWeight: 950, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16)" }}>
            <div>Final Net Remit to Provider</div>
            <div>{money(summary.netRemitToProviderTotal)}</div>
          </div>
        </div>

        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#475569", fontSize: 12, lineHeight: 1.5 }}>
          Cost Excess / Shortfall This Remittance = Costs Received During This Remittance Period minus Costs Expended During This Remittance Period. Cost excess first reduces any Negative Cost Balance, and any remaining excess is added to Net Remit. Cost shortfalls and prior negative balances may be deducted from Net Remit Before Costs up to the 25% cap, with any unrecovered balance carried forward.
        </div>
      </section>
    );
  }

  function previewLineDisplayType(line: any): string {
    const rawType = String(line?.description || line?.rowSnapshot?.transactionType || line?.lineType || "").trim();
    const normalizedType = rawType.toLowerCase();

    if (line?.lineType === "direct_pay_to_provider") return "Direct Pay to Provider";
    if (line?.lineType === "filing_fee_payment") {
      if (normalizedType.includes("filing fee") || normalizedType.includes("index fee")) return "Index Fee";
      if (normalizedType.includes("service fee")) return "Service Fee";
      if (normalizedType.includes("other court costs") || normalizedType.includes("other court fees")) return "Other Court Costs";
    }
    if (normalizedType === "voluntary payment") return "Voluntary";
    if (normalizedType === "collection payment") return "Collection";

    return rawType || "—";
  }

  function previewSortValue(line: any, field: string): string | number {
    if (field === "description") return previewLineDisplayType(line).toLowerCase();
    if (field === "dateOfService") return `${String(line?.dateOfService || "")} ${invoiceLineDosEnd(line)}`.trim();
    if (field === "remitToProvider") return previewRemitToProvider(line);
    if (field === "billedAmount" || field === "amount" || field === "retainerFee") return Number(line?.[field] || 0);
    return String(line?.[field] ?? "").toLowerCase();
  }

  function sortPreviewLines(title: string, lines: any[]) {
    if (!previewTableSort || previewTableSort.table !== title) return lines;
    const direction = previewTableSort.direction === "desc" ? -1 : 1;
    const field = previewTableSort.field;

    return [...lines].sort((a: any, b: any) => {
      const aValue = previewSortValue(a, field);
      const bValue = previewSortValue(b, field);

      if (typeof aValue === "number" && typeof bValue === "number") {
        return (aValue - bValue) * direction;
      }

      return String(aValue).localeCompare(String(bValue), undefined, { numeric: true, sensitivity: "base" }) * direction;
    });
  }

  function togglePreviewTableSort(title: string, field: string) {
    setPreviewTableSort((current) => {
      if (current?.table === title && current.field === field) {
        return { table: title, field, direction: current.direction === "asc" ? "desc" : "asc" };
      }

      return { table: title, field, direction: "asc" };
    });
  }

  function renderPreviewLineTable(title: string, lines: any[], emptyMessage: string) {
    const total = lines.reduce((sum: number, line: any) => sum + Number(line?.amount || 0), 0);
    const retainerTotal = lines.reduce((sum: number, line: any) => sum + Number(line?.retainerFee || 0), 0);
    const remitTotal = lines.reduce((sum: number, line: any) => sum + previewRemitToProvider(line), 0);
    const isDirectProviderTable = title === "Direct Payments to Provider";
    const isCostsReceivedTable = title === "Costs Received";
    const isFeesCostsExpendedTable = title === "Fees and Costs Expended";
    const showRemitToProvider = title === "Principal / Interest Received" || isDirectProviderTable;
    const showBilledAndRetainerColumns = !isCostsReceivedTable && !isFeesCostsExpendedTable;
    const showCheckColumns = !isFeesCostsExpendedTable;
    const activeColumns = previewTableColumns.filter((column) => {
      if (column.principalOnly && !showRemitToProvider) return false;
      if (column.hideForCostsReceived && isCostsReceivedTable) return false;
      if (column.hideForExpended && isFeesCostsExpendedTable) return false;
      return true;
    });
    const sortedLines = sortPreviewLines(title, lines);
    const activeSort = previewTableSort?.table === title ? previewTableSort : null;

    return (
      <section style={{ marginTop: 18 }}>
        <div style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontWeight: 950 }}>{title}</h3>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {activeColumns.map((column) => (
                  <th
                    key={column.key}
                    onClick={() => togglePreviewTableSort(title, column.key)}
                    title={`Sort by ${column.label}`}
                    style={{
                      ...thStyle,
                      border: "1px solid #cbd5e1",
                      width: column.width,
                      textAlign: column.headerAlign === "center" ? "center" : column.align === "right" ? "right" : undefined,
                      cursor: "pointer",
                      userSelect: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {(isFeesCostsExpendedTable && column.expendedLabel) ? column.expendedLabel : column.label}{activeSort?.field === column.key ? (activeSort.direction === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedLines.slice(0, 250).map((line: any, index: number) => (
                <tr key={`${title}-${line.sourceTable}-${line.sourceId}-${index}`}>
                  <td style={{ ...tdStyle, border: "1px solid #e2e8f0" }}>{line.matter || "—"}</td>
                  <td style={{ ...tdStyle, border: "1px solid #e2e8f0" }}>{line.patient || "—"}</td>
                  <td style={{ ...tdStyle, border: "1px solid #e2e8f0" }}>{dateOnly(line.dateOfLoss) || "—"}</td>
                  <td style={{ ...tdStyle, border: "1px solid #e2e8f0" }}>
                    {[dateOnly(line.dateOfService), dateOnly(invoiceLineDosEnd(line))].filter(Boolean).join(" – ") || "—"}
                  </td>
                  <td style={{ ...tdStyle, border: "1px solid #e2e8f0" }}>{line.insurer || "—"}</td>
                  <td style={{ ...tdStyle, border: "1px solid #e2e8f0", width: 56 }}>{line.caseType || "—"}</td>
                  <td style={{ ...tdStyle, border: "1px solid #e2e8f0" }}>{previewLineDisplayType(line)}</td>
                  <td style={{ ...tdStyle, border: "1px solid #e2e8f0" }}>{dateOnly(line.sortDate) || "—"}</td>
                  {showCheckColumns && (
                    <td style={{ ...tdStyle, border: "1px solid #e2e8f0" }}>{dateOnly(line.checkDate) || "—"}</td>
                  )}
                  {showCheckColumns && (
                    <td style={{ ...tdStyle, border: "1px solid #e2e8f0" }}>{line.checkNumber || "—"}</td>
                  )}
                  {showBilledAndRetainerColumns && (
                    <td style={{ ...tdStyle, border: "1px solid #e2e8f0", textAlign: "right" }}>{money(line.billedAmount)}</td>
                  )}
                  <td style={{ ...tdStyle, border: "1px solid #e2e8f0", textAlign: "right" }}>{money(line.amount)}</td>
                  {showBilledAndRetainerColumns && (
                    <td style={{ ...tdStyle, border: "1px solid #e2e8f0", textAlign: "right" }}>{money(line.retainerFee)}</td>
                  )}
                  {showRemitToProvider && (
                    <td style={{ ...tdStyle, border: "1px solid #e2e8f0", textAlign: "right" }}>{money(previewRemitToProvider(line))}</td>
                  )}
                </tr>
              ))}
              {!lines.length && (
                <tr>
                  <td style={{ ...tdStyle, border: "1px solid #e2e8f0" }} colSpan={activeColumns.length}>{emptyMessage}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td
                  style={{ ...tdStyle, border: "1px solid #cbd5e1", fontWeight: 900, textAlign: "right" }}
                  colSpan={(isCostsReceivedTable || isFeesCostsExpendedTable) ? activeColumns.length - 1 : 11}
                >
                  Total
                </td>
                <td style={{ ...tdStyle, border: "1px solid #cbd5e1", fontWeight: 900, textAlign: "right" }}>{money(total)}</td>
                {showBilledAndRetainerColumns && (
                  <td style={{ ...tdStyle, border: "1px solid #cbd5e1", fontWeight: 900, textAlign: "right" }}>
                    {money(retainerTotal)}
                  </td>
                )}
                {showRemitToProvider && (
                  <td style={{ ...tdStyle, border: "1px solid #cbd5e1", fontWeight: 900, textAlign: "right" }}>{money(remitTotal)}</td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    );
  }
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
        "Principal / Interest Received": invoice.principalInterestTotal,
        "Retainer Fee": invoice.retainerFeeTotal,
        "Net Remit Before Costs": invoice.baseNetRemitToProvider,
        "Costs Received During This Remittance Period": invoice.filingFeePaymentTotal,
        "Costs Expended During This Remittance Period": invoice.costsExpendedTotal,
        "Cost Balance During This Remittance Period": invoice.costBalanceThisRemittancePeriod,
        "Cost Balance Ledger Before": invoice.costBalanceLedgerBefore,
        "Cost Balance Ledger Change": invoice.costBalanceLedgerChange,
        "Cost Balance Ledger": invoice.costBalanceLedgerAfter,
        "Final Net Remit to Provider": invoice.netRemitToProviderTotal,
        "Frozen Invoice Line Total": invoice.invoicePackageTotal,
      })),
    [history]
  );

  return (
    <main style={pageStyle}>
      <BarshHeader />
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(320px, 1.25fr) minmax(210px, 0.8fr) minmax(190px, 0.7fr) minmax(440px, 1.35fr)",
              gap: 18,
              alignItems: "stretch",
            }}
          >
            <div style={topSummaryPanelStyle}>
              <div style={summarySectionLabelStyle}>Provider Details</div>
              <dl style={{ margin: 0, display: "grid", gap: 8 }}>
                {providerIdentityRows.map((row: any) => (
                  row.statusPill ? (
                    <div key={row.label}>
                      <dt style={compactInfoLabelStyle}>{row.label}</dt>
                      <dd style={compactInfoValueStyle}>
                        <span style={row.value === "Active" ? activeStatusPillStyle : { ...activeStatusPillStyle, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b" }}>
                          {row.value}
                        </span>
                      </dd>
                    </div>
                  ) : (
                    <ProviderInfoItem key={row.label} label={row.label} value={row.value} multiline={row.multiline} />
                  )
                ))}
              </dl>
            </div>

            <div style={topSummaryPanelStyle}>
              <div style={summarySectionLabelStyle}>Retainer Terms</div>
              <dl style={{ margin: 0, display: "grid", gap: 8 }}>
                {providerPercentageRows.map((row) => (
                  <ProviderInfoItem key={row.label} label={row.label} value={row.value} />
                ))}
              </dl>
            </div>

            <div style={topSummaryPanelStyle}>
              <div style={summarySectionLabelStyle}>Billing Defaults</div>
              <dl style={{ margin: 0, display: "grid", gap: 8 }}>
                {providerBillingRows.map((row) => (
                  <ProviderInfoItem key={row.label} label={row.label} value={row.value} />
                ))}
              </dl>
            </div>

            <div style={{ ...topSummaryPanelStyle, display: "grid", gap: 10 }}>
              <div style={summarySectionLabelStyle}>Account Actions</div>
              {providerAccountControlRows.map((row: any) => (
                row.action === "view-cost-ledger" ? (
                  <div
                    key={row.label}
                    style={{
                      border: "1px solid #dbeafe",
                      background: "#f8fbff",
                      borderRadius: 14,
                      padding: "12px 14px",
                      boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                      <div>
                        <div style={{ ...compactInfoLabelStyle, marginBottom: 4 }}>{row.label}</div>
                        <div
                          style={{
                            fontSize: 28,
                            lineHeight: 1,
                            fontWeight: 950,
                            color: Number(row.amount || 0) > 0 ? "#b91c1c" : "#166534",
                            letterSpacing: "-0.03em",
                          }}
                        >
                          {row.value}
                        </div>
                        <div style={{ marginTop: 6, color: "#64748b", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>
                          {Number(row.amount || 0) > 0 ? "Outstanding client cost balance" : "No client cost balance"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!id) return;
                          window.open(`/admin/clients/${encodeURIComponent(id)}/invoice/client-costs-ledger`, "_blank", "noopener,noreferrer");
                        }}
                        style={{
                          ...secondaryButtonStyle,
                          border: "1px solid #2563eb",
                          background: "#2563eb",
                          color: "#ffffff",
                          boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)",
                          whiteSpace: "nowrap",
                        }}
                        title="Open the Client Cost Ledger"
                      >
                        Open Client Costs Ledger
                      </button>
                    </div>
                  </div>
                ) : row.action === "view-invoice-history" ? (
                  <div
                    key={row.label}
                    style={{
                      border: "1px solid #dbeafe",
                      background: "#f8fbff",
                      borderRadius: 14,
                      padding: "12px 14px",
                      boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                      <div>
                        <div style={{ ...compactInfoLabelStyle, marginBottom: 4 }}>{row.label}</div>
                        <div style={{ fontSize: 20, lineHeight: 1.05, fontWeight: 950, color: "#0f172a" }}>
                          {row.value}
                        </div>
                        <div style={{ marginTop: 5, color: "#64748b", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>
                          Latest: {row.latest || "—"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (id) {
                            window.open(`/admin/clients/${encodeURIComponent(id)}/invoice/history`, "_blank", "noopener,noreferrer");
                          }
                        }}
                        style={{
                          ...secondaryButtonStyle,
                          border: "1px solid #2563eb",
                          background: "#2563eb",
                          color: "#ffffff",
                          boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)",
                          whiteSpace: "nowrap",
                        }}
                        title="Open Invoice History"
                      >
                        Open Invoice History
                      </button>
                    </div>
                  </div>
                ) : null
              ))}
            </div>
          </div>
        )}
      </section>


      <section id="invoice-step-1" style={{ ...cardStyle, marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <div style={{ color: "#2563eb", fontSize: 12, fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Step 1
            </div>
            <h2 style={{ margin: "4px 0 4px", fontSize: 22, fontWeight: 950, letterSpacing: "-0.01em" }}>
              Select Invoice Criteria
            </h2>
            <p style={{ margin: 0, color: "#475569", fontSize: 13, lineHeight: 1.4 }}>
              Select the receipt status, transaction type, and date range that should be included in the invoice preview.
            </p>
          </div>
        </div>

        <div
          style={{
            border: "1px solid #dbeafe",
            background: "#f8fbff",
            borderRadius: 14,
            padding: 14,
            display: "grid",
            gridTemplateColumns: "minmax(190px, 1fr) minmax(220px, 1fr) minmax(180px, 0.9fr) minmax(180px, 0.9fr)",
            gap: 14,
            alignItems: "end",
          }}
        >
          <label style={{ fontWeight: 900, color: "#334155" }}>
            <span style={{ display: "block", marginBottom: 6 }}>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={filterControlStyle}>
              <option value="posted">Posted</option>
              <option value="voided">Voided</option>
              <option value="all">All</option>
            </select>
          </label>

          <label style={{ fontWeight: 900, color: "#334155" }}>
            <span style={{ display: "block", marginBottom: 6 }}>Transaction Type</span>
            <select value={transactionType} onChange={(event) => setTransactionType(event.target.value)} style={filterControlStyle}>
              <option value="">All</option>
              <option value="principal_interest">Principal / Interest</option>
              <option value="direct_pay_to_provider">Direct Payments to Provider</option>
              <option value="filing_fee_payment">All Costs Received (Index, Service, Other)</option>
              <option value="Index Fee">Index Fee</option>
              <option value="Service Fee">Service Fee</option>
              <option value="Other Court Costs">Other Court Costs</option>
            </select>
          </label>

          <label style={{ fontWeight: 900, color: "#334155" }}>
            <span style={{ display: "block", marginBottom: 6 }}>Date From</span>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} style={filterControlStyle} />
          </label>

          <label style={{ fontWeight: 900, color: "#334155" }}>
            <span style={{ display: "block", marginBottom: 6 }}>Date To</span>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} style={filterControlStyle} />
          </label>
        </div>

        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => {
              Promise.resolve(loadPreview()).then(() => scrollToInvoiceSection("invoice-step-2", 200));
            }}
            disabled={loadingPreview || !id}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid #2563eb",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 950,
              boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)",
            }}
          >
            {loadingPreview ? "Loading Preview..." : "Preview Invoice"}
          </button>
        </div>
      </section>

      <section id="invoice-step-2" style={{ ...cardStyle, marginBottom: 18, display: preview ? undefined : "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <div style={{ color: "#2563eb", fontSize: 12, fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Step 2
            </div>
            <h2 style={{ margin: "4px 0 4px", fontSize: 22, fontWeight: 950, letterSpacing: "-0.01em" }}>
              Review Invoice Preview
            </h2>
            <p style={{ margin: 0, color: "#475569", fontSize: 13, lineHeight: 1.4 }}>
              Confirm the previewed receipt rows, cost rows, retainer calculation, and remittance summary before creating a draft invoice.
            </p>
          </div>
        </div>

        {preview ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(190px, 1fr))",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div style={{ border: "1px solid #dbeafe", background: "#f8fbff", borderRadius: 14, padding: 14 }}>
                <div style={{ color: "#475569", fontSize: 12, fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Principal / Interest
                </div>
                <div style={{ marginTop: 6, fontSize: 20, fontWeight: 950, color: "#0f172a" }}>
                  {money(principalInterestPaymentTotal)}
                </div>
                <div style={{ marginTop: 4, color: "#64748b", fontSize: 12, fontWeight: 800 }}>
                  {principalInterestPaymentCount} payment row{principalInterestPaymentCount === 1 ? "" : "s"}
                </div>
              </div>

              <div style={{ border: "1px solid #dbeafe", background: "#f8fbff", borderRadius: 14, padding: 14 }}>
                <div style={{ color: "#475569", fontSize: 12, fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Direct Payments to Provider
                </div>
                <div style={{ marginTop: 6, fontSize: 20, fontWeight: 950, color: "#0f172a" }}>
                  {money(directProviderPaymentTotal)}
                </div>
                <div style={{ marginTop: 4, color: "#64748b", fontSize: 12, fontWeight: 800 }}>
                  Retainer Fee: {money(directProviderRetainerFeeTotal)} · {directProviderPaymentCount} row{directProviderPaymentCount === 1 ? "" : "s"}
                </div>
              </div>

              <div style={{ border: "1px solid #dbeafe", background: "#f8fbff", borderRadius: 14, padding: 14 }}>
                <div style={{ color: "#475569", fontSize: 12, fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Costs Received
                </div>
                <div style={{ marginTop: 6, fontSize: 20, fontWeight: 950, color: "#0f172a" }}>
                  {money(costsReceivedPaymentTotal)}
                </div>
                <div style={{ marginTop: 4, color: "#64748b", fontSize: 12, fontWeight: 800 }}>
                  {costsReceivedPaymentCount} cost receipt row{costsReceivedPaymentCount === 1 ? "" : "s"}
                </div>
              </div>

              <div style={{ border: "1px solid #dbeafe", background: "#f8fbff", borderRadius: 14, padding: 14 }}>
                <div style={{ color: "#475569", fontSize: 12, fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Costs Expended
                </div>
                <div style={{ marginTop: 6, fontSize: 20, fontWeight: 950, color: "#0f172a" }}>
                  {money(feesCostsExpendedTotal)}
                </div>
                <div style={{ marginTop: 4, color: "#64748b", fontSize: 12, fontWeight: 800 }}>
                  {feesCostsExpendedCount} cost row{feesCostsExpendedCount === 1 ? "" : "s"}
                </div>
              </div>

              <div style={{ border: "1px solid #dbeafe", background: "#f8fbff", borderRadius: 14, padding: 14 }}>
                <div style={{ color: "#475569", fontSize: 12, fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Final Net Remit
                </div>
                <div style={{ marginTop: 6, fontSize: 20, fontWeight: 950, color: "#0f172a" }}>
                  {money(previewTotals.netRemitToProviderTotal)}
                </div>
                <div style={{ marginTop: 4, color: "#64748b", fontSize: 12, fontWeight: 800 }}>
                  Cost balance after: {money(previewTotals.costBalanceLedgerAfter)}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#ffffff" }}>
                {renderPreviewLineTable(
                  "Principal / Interest Received",
                  principalInterestPreviewLines,
                  "No principal or interest payments in this preview."
                )}
              </div>

              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#ffffff" }}>
                {renderPreviewLineTable(
                  "Direct Payments to Provider",
                  directProviderPaymentPreviewLines,
                  "No direct payments to provider in this preview."
                )}
              </div>

              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#ffffff" }}>
                {renderPreviewLineTable(
                  "Costs Received",
                  costsReceivedPreviewLines,
                  "No cost payments received in this preview."
                )}
              </div>

              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#ffffff" }}>
                {renderPreviewLineTable(
                  "Fees and Costs Expended",
                  feesCostsExpendedPreviewLines,
                  "No fees or costs expended in this preview."
                )}
              </div>

              <div style={{ border: "1px solid #bfdbfe", borderRadius: 14, padding: 12, background: "#f8fbff" }}>
                {renderCostBalanceSummary(previewTotals)}
              </div>

            <div
              style={{
                border: "1px solid #dbeafe",
                background: "#f8fbff",
                borderRadius: 14,
                padding: 14,
                display: "flex",
                justifyContent: "space-between",
                gap: 14,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ color: "#475569", fontSize: 12, fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Draft Invoice Action
                </div>
                <div style={{ marginTop: 4, color: "#0f172a", fontSize: 14, fontWeight: 850 }}>
                  Create a draft invoice from this reviewed preview.
                </div>
                <div style={{ marginTop: 4, color: "#64748b", fontSize: 12, fontWeight: 800 }}>
                  Draft invoices freeze package lines for review but do not mark receipt rows as invoiced.
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  Promise.resolve(createDraftInvoice()).then(() => scrollToInvoiceSection("invoice-step-3", 200));
                }}
                disabled={!preview || creatingDraft}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "1px solid #2563eb",
                  background: preview ? "#2563eb" : "#94a3b8",
                  color: "#fff",
                  fontWeight: 950,
                  boxShadow: preview ? "0 2px 6px rgba(37, 99, 235, 0.25)" : undefined,
                  whiteSpace: "nowrap",
                }}
              >
                {creatingDraft ? "Creating Draft..." : "Create Draft Invoice"}
              </button>
            </div>
            </div>
          </>
        ) : (
          <p style={{ color: "#64748b" }}>No preview loaded.</p>
        )}
      </section>


      <section id="invoice-step-3" style={{ ...cardStyle, marginBottom: 18, display: createdInvoice ? undefined : "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <div style={{ color: "#166534", fontSize: 12, fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Step 3
            </div>
            <h2 style={{ margin: "4px 0 4px", fontSize: 22, fontWeight: 950, letterSpacing: "-0.01em" }}>
              Finalize Invoice
            </h2>
            <p style={{ margin: 0, color: "#475569", fontSize: 13, lineHeight: 1.4 }}>
              Finalize only after reviewing the draft. Finalization marks included MatterPaymentReceipt rows with this invoice ID and keeps frozen invoice lines as the review/output source.
            </p>
          </div>
        </div>

        <div
          style={{
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            borderRadius: 14,
            padding: 14,
            display: "flex",
            justifyContent: "space-between",
            gap: 14,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ color: "#166534", fontSize: 12, fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Finalization Action
            </div>
            <div style={{ marginTop: 4, color: "#0f172a", fontSize: 14, fontWeight: 850 }}>
              Convert the draft invoice into a finalized invoice package.
            </div>
            <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {createdInvoice && (
                <>
                  {statusBadge(createdInvoice.status)}
                  <strong>{createdInvoice.invoiceNumber}</strong>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              Promise.resolve(finalizeInvoice()).then(() => scrollToInvoiceSection("invoice-detail", 200));
            }}
            disabled={!createdInvoice || createdInvoice?.status !== "draft" || finalizing}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid #166534",
              background: createdInvoice?.status === "draft" ? "#166534" : "#94a3b8",
              color: "#fff",
              fontWeight: 950,
              boxShadow: createdInvoice?.status === "draft" ? "0 2px 6px rgba(22, 101, 52, 0.25)" : undefined,
              whiteSpace: "nowrap",
            }}
          >
            {finalizing ? "Finalizing..." : "Finalize Invoice"}
          </button>
        </div>
      </section>


      {invoiceDetailVisible && invoiceDetail && (
        <section id="invoice-detail" style={{ ...cardStyle, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ marginTop: 0 }}>Invoice Detail: {detailInvoice?.invoiceNumber}</h2>
              <p style={{ color: "#475569", marginTop: 0 }}>
                {detailInvoice?.status === "draft" && "Draft invoice created. Receipt rows are not yet marked as invoiced. Review the frozen package before finalizing."}
                {detailInvoice?.status === "finalized" && "Invoice finalized. Included receipt rows are marked with this invoice ID and excluded from future invoice previews by default. The invoice review/output remains based on frozen invoice lines."}
                {detailInvoice?.status === "voided" && "Invoice voided. Receipt rows previously marked with this invoice ID were released for future invoicing. The voided invoice remains in history."}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "start", flexWrap: "wrap" }}>
              <button type="button" onClick={printableInvoice} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #0f172a", background: "#0f172a", color: "#fff", fontWeight: 900 }}>Print / Save PDF</button>
              {detailInvoice?.status === "draft" && (
                <button type="button" onClick={() => finalizeInvoice(detailInvoice)} disabled={finalizing} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #166534", background: "#166534", color: "#fff", fontWeight: 900 }}>Finalize</button>
              )}
              {detailInvoice?.status === "finalized" && (
                <button type="button" onClick={() => voidInvoice(detailInvoice)} disabled={voiding} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #991b1b", background: "#991b1b", color: "#ffffff", fontWeight: 900 }}>Void</button>
              )}
            </div>
          </div>

          {invoiceDetail?.verification && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(150px, 1fr))", gap: 10, margin: "12px 0", padding: 12, border: "1px solid #bfdbfe", borderRadius: 12, background: "#eff6ff" }}>
              <div><strong>Frozen Lines</strong><br />{invoiceDetail.verification.lineCount ?? detailLines.length}</div>
              <div><strong>Receipt Rows Found</strong><br />{invoiceDetail.verification.receiptRowsFound ?? "—"}</div>
              <div><strong>Marked This Invoice</strong><br />{invoiceDetail.verification.receiptRowsMarkedWithThisInvoiceId ?? "—"}</div>
              <div><strong>Marked Elsewhere</strong><br />{invoiceDetail.verification.receiptRowsMarkedWithAnotherInvoiceId ?? "—"}</div>
              <div><strong>Unmarked</strong><br />{invoiceDetail.verification.receiptRowsUnmarked ?? "—"}</div>
            </div>
          )}

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

          {renderCostBalanceSummary(detailInvoice)}

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
