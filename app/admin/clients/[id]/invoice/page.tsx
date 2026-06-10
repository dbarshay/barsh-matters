"use client";

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

    const receiptLineCount = invoiceReceiptLineCount(invoice);

    const confirmed = window.confirm(
      [
        `Finalize invoice ${invoice?.invoiceNumber || invoiceId}?`,
        "",
        `This will mark ${receiptLineCount || "the included"} MatterPaymentReceipt row${receiptLineCount === 1 ? "" : "s"} with this invoice ID and exclude them from future ordinary previews.`,
        "Frozen invoice lines will remain the invoice review/output source.",
        "This will not mutate Clio, ClaimIndex, source costs, documents, email, print, queue, or remittance records.",
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
    const principalInterestLines = lines.filter((line: any) => line?.lineType === "receipt");
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
    const summaryRetainerFee = Number(invoice.retainerFeeTotal || 0);
    const summaryNetRemitToProvider = summaryPrincipalInterestReceived - summaryRetainerFee;

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
    .totals { margin-top: 30px; width: 680px; margin-left: auto; border: 3px solid #94a3b8; border-radius: 14px; padding: 22px 24px; font-size: 20px; }
    .totals div { display: flex; justify-content: space-between; gap: 30px; padding: 10px 0; }
    .total { font-weight: 900; border-top: 4px solid #0f172a; margin-top: 12px; padding-top: 16px !important; font-size: 28px; }
    .footer { margin-top: 18px; color: #64748b; font-size: 10px; }
    @media print { button { display: none; } body { padding: 0; } thead { display: table-header-group; } tfoot { display: table-footer-group; } }
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
    <div><span>Retainer Fee</span><span>${safeHtml(money(summaryRetainerFee))}</span></div>
    <div class="total"><span>Net Remit to Provider</span><span>${safeHtml(money(summaryNetRemitToProvider))}</span></div>
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
  const costsReceivedPreviewLines = previewLines.filter((line: any) => line?.lineType === "filing_fee_payment");
  const feesCostsExpendedPreviewLines = previewLines.filter((line: any) => line?.lineType === "cost_expended");
  const costPaymentPreviewLines = [...costsReceivedPreviewLines, ...feesCostsExpendedPreviewLines];
  const principalInterestPaymentCount = principalInterestPreviewLines.length;
  const principalInterestPaymentTotal = principalInterestPreviewLines.reduce((sum: number, line: any) => sum + Number(line?.amount || 0), 0);
  const costsReceivedPaymentCount = costsReceivedPreviewLines.length;
  const costsReceivedPaymentTotal = costsReceivedPreviewLines.reduce((sum: number, line: any) => sum + Number(line?.amount || 0), 0);
  const feesCostsExpendedCount = feesCostsExpendedPreviewLines.length;
  const feesCostsExpendedTotal = feesCostsExpendedPreviewLines.reduce((sum: number, line: any) => sum + Number(line?.amount || 0), 0);
  const costPaymentCount = costPaymentPreviewLines.length;
  const costPaymentTotal = costPaymentPreviewLines.reduce((sum: number, line: any) => sum + Number(line?.amount || 0), 0);
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

  function previewRemitToProvider(line: any): number {
    return Number(line?.amount || 0) - Number(line?.retainerFee || 0);
  }

  function invoiceLineDosEnd(line: any): string {
    return String(line?.dosEnd || line?.dateOfServiceEnd || line?.rowSnapshot?.dateOfServiceEnd || line?.rowSnapshot?.dosEnd || "").trim();
  }

  function invoiceReceiptLineCount(invoice: any): number {
    const lines = Array.isArray(invoice?.lines) ? invoice.lines : [];
    return lines.filter((line: any) => clean(line?.sourceTable) === "MatterPaymentReceipt").length;
  }

  function previewLineDisplayType(line: any): string {
    const rawType = String(line?.description || line?.rowSnapshot?.transactionType || line?.lineType || "").trim();
    const normalizedType = rawType.toLowerCase();

    if (line?.lineType === "filing_fee_payment") {
      if (normalizedType.includes("filing fee") || normalizedType.includes("index fee")) return "Index Fee";
      if (normalizedType.includes("service fee")) return "Service Fee";
      if (normalizedType.includes("other court costs") || normalizedType.includes("other court fees")) return "Other Court Costs";
    }

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
    const isCostsReceivedTable = title === "Costs Received";
    const isFeesCostsExpendedTable = title === "Fees and Costs Expended";
    const showRemitToProvider = title === "Principal / Interest Received";
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
        <h2 style={{ marginTop: 0 }}>1. Preview Invoice</h2>

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
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(230px, 1fr))", gap: 16, marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline", whiteSpace: "nowrap" }}>
                <strong>Principal / Interest Payments:</strong>
                <span>{principalInterestPaymentCount} — {money(principalInterestPaymentTotal)}</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline", whiteSpace: "nowrap" }}>
                <strong>Costs Received:</strong>
                <span>{costsReceivedPaymentCount} — {money(costsReceivedPaymentTotal)}</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline", whiteSpace: "nowrap" }}>
                <strong>Costs Expended:</strong>
                <span>{feesCostsExpendedCount} — {money(feesCostsExpendedTotal)}</span>
              </div>
            </div>

            {renderPreviewLineTable(
              "Principal / Interest Received",
              principalInterestPreviewLines,
              "No principal or interest payments in this preview."
            )}

            {renderPreviewLineTable(
              "Costs Received",
              costsReceivedPreviewLines,
              "No cost payments received in this preview."
            )}

            {renderPreviewLineTable(
              "Fees and Costs Expended",
              feesCostsExpendedPreviewLines,
              "No fees or costs expended in this preview."
            )}
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
          Finalizing marks only the included MatterPaymentReceipt rows with this invoice ID. The frozen invoice lines remain the invoice review/output source, and source costs, remittance records, Clio, ClaimIndex, documents, email, print, and queue are not changed.
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
                <button type="button" onClick={() => voidInvoice(detailInvoice)} disabled={voiding} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #991b1b", background: "#fff", color: "#991b1b", fontWeight: 900 }}>Void</button>
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
              <div style={{ gridColumn: "1 / -1", color: "#1e3a8a", fontWeight: 800 }}>
                Lifecycle: detail/review uses frozen ProviderClientInvoiceLine rows. Finalize marks only included MatterPaymentReceipt rows. Clio, ClaimIndex, source costs, remittance records, documents, email, print, and queue are not mutated.
              </div>
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
