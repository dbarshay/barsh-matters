"use client";

import { formatDateOnlyForDisplay } from "@/lib/dateOnlyDisplay";
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


const providerHubIdentityLabelStyle: React.CSSProperties = {
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const providerHubIdentityValueStyle: React.CSSProperties = {
  margin: 0,
  whiteSpace: "nowrap",
};

const providerHubCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  background: "#ffffff",
  padding: 18,
  boxShadow: "0 6px 20px rgba(15, 23, 42, 0.055)",
};

const providerHubHeaderLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const providerHubSectionTitleStyle: React.CSSProperties = {
  margin: "4px 0 6px",
  color: "#0f172a",
  fontSize: 22,
  fontWeight: 950,
  letterSpacing: "-0.015em",
};

const providerHubSubtleTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: 14,
  lineHeight: 1.45,
};

const providerHubNoWrapLabelStyle: React.CSSProperties = {
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const providerHubNoWrapValueStyle: React.CSSProperties = {
  margin: 0,
  whiteSpace: "nowrap",
};

const providerHubButtonBaseStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "center",
  padding: "13px 16px",
  borderRadius: 12,
  fontWeight: 950,
  fontSize: 15,
  boxSizing: "border-box",
  boxShadow: "0 3px 10px rgba(15, 23, 42, 0.08)",
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
    const text = String(value ?? "").trim();
    if (!text) continue;
    rows.push({ field: key, value: text, source: "Imported" });
  }

  for (const [key, value] of Object.entries(hidden)) {
    const text = String(value ?? "").trim();
    if (!text) continue;
    rows.push({ field: key, value: text, source: "Hidden Import" });
  }

  return rows.sort((a, b) => {
    const sourceCompare = a.source.localeCompare(b.source);
    if (sourceCompare) return sourceCompare;
    return a.field.localeCompare(b.field);
  });
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

function clientAddress(details: unknown) {
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
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.includes("%")) return text;
  const numeric = Number(text.replace(/[$,%\s,]/g, ""));
  if (!Number.isFinite(numeric)) return text;
  return `${numeric}%`;
}

function statusBadge(isActive?: boolean) {
  const active = isActive !== false;
  return (
    <span
      style={{
        color: active ? "#166534" : "#b91c1c",
        background: active ? "#dcfce7" : "#fee2e2",
        border: `1px solid ${active ? "#86efac" : "#fecaca"}`,
        borderRadius: 999,
        padding: "3px 9px",
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function clientNotes(details: unknown) {
  return (
    findDetailValue(details, [
      "notes",
      "note",
      "comments",
      "comment",
      "remarks",
      "remark",
      "memo",
      "internal_notes",
      "hidden_notes",
    ]) || ""
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
  const [activeWorkflowPanel, setActiveWorkflowPanel] = useState<"" | "remittance" | "individual" | "lawsuits">("");
  const [matterPanelSortField, setMatterPanelSortField] = useState("matter");
  const [matterPanelSortDirection, setMatterPanelSortDirection] = useState<"asc" | "desc">("asc");
  const [lawsuitPanelSortField, setLawsuitPanelSortField] = useState("lawsuit");
  const [lawsuitPanelSortDirection, setLawsuitPanelSortDirection] = useState<"asc" | "desc">("asc");
  const [editingField, setEditingField] = useState<keyof typeof clientForm | null>(null);
  const [notesEditorMode, setNotesEditorMode] = useState<"add" | "edit">("add");
  const [editableNotes, setEditableNotes] = useState<string[]>([]);
  const [savingClient, setSavingClient] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [clientForm, setClientForm] = useState({
    address: "",
    owner: "",
    providerGroup: "",
    retainerNFPrincipal: "",
    retainerNFInterest: "",
    retainerWCPrincipal: "",
    retainerWCInterest: "",
    retainerLiensPrincipal: "",
    retainerLiensInterest: "",
    pullCosts: "",
    remit: "",
    notes: "",
  });

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
  const matterPanelTotals = useMemo(
    () =>
      matterRows.reduce(
        (totals: { count: number; lawsuitCount: number; billAmount: number; balance: number; openCount: number; closedCount: number }, row: any) => {
          const status = String(row?.finalStatus || "").trim().toLowerCase();
          totals.count += 1;
          totals.billAmount += Number(row?.billAmount || 0);
          totals.balance += Number(row?.balance || 0);
          if (status === "closed") totals.closedCount += 1;
          else totals.openCount += 1;
          return totals;
        },
        { count: 0, lawsuitCount: 0, billAmount: 0, balance: 0, openCount: 0, closedCount: 0 }
      ),
    [matterRows]
  );
  const lawsuitRows = useMemo(() => {
    const byLawsuit = new Map<string, any>();
    for (const row of matterRows) {
      const lawsuit = String(row?.lawsuit ?? "").trim();
      if (!lawsuit) continue;
      const existing = byLawsuit.get(lawsuit) || {
        lawsuit,
        childMatterCount: 0,
        billAmount: 0,
        balance: 0,
        providers: new Set<string>(),
        patients: new Set<string>(),
        insurers: new Set<string>(),
      };
      existing.childMatterCount += 1;
      existing.billAmount += Number(row?.billAmount || 0);
      existing.balance += Number(row?.balance || 0);
      if (row?.provider) existing.providers.add(String(row.provider));
      if (row?.patient) existing.patients.add(String(row.patient));
      if (row?.insurer) existing.insurers.add(String(row.insurer));
      byLawsuit.set(lawsuit, existing);
    }

    return Array.from(byLawsuit.values()).map((row) => ({
      lawsuit: row.lawsuit,
      childMatterCount: row.childMatterCount,
      billAmount: row.billAmount,
      balance: row.balance,
      providers: Array.from(row.providers).join(", "),
      patients: Array.from(row.patients).join(", "),
      insurers: Array.from(row.insurers).join(", "),
    }));
  }, [matterRows]);

  const lawsuitPanelTotals = useMemo(
    () =>
      lawsuitRows.reduce(
        (totals: { count: number; childMatterCount: number; billAmount: number; balance: number }, row: any) => ({
          count: totals.count + 1,
          childMatterCount: totals.childMatterCount + Number(row?.childMatterCount || 0),
          billAmount: totals.billAmount + Number(row?.billAmount || 0),
          balance: totals.balance + Number(row?.balance || 0),
        }),
        { count: 0, childMatterCount: 0, billAmount: 0, balance: 0 }
      ),
    [lawsuitRows]
  );

  const linkedLawsuitCount = lawsuitPanelTotals.count;

  function providerPanelDateRange(row: any): string {
    return [dateOnly(row?.dateOfService), dateOnly(row?.dateOfServiceEnd)].filter(Boolean).join(" – ");
  }

  function providerMatterHref(row: any): string {
    const target = String(row?.matter || row?.displayNumber || row?.id || "").trim();
    return target ? `/matter/${encodeURIComponent(target)}` : "";
  }

  function providerLawsuitHref(value: any): string {
    const target = String(value || "").trim();
    return target ? `/matters?master=${encodeURIComponent(target)}` : "";
  }

  function providerIndexedSearchHref(field: "patient" | "provider" | "insurer" | "claim", value: any): string {
    const target = String(value || "").trim();
    return target ? `/matters?${field}=${encodeURIComponent(target)}` : "";
  }

  function providerIndexedLink(field: "patient" | "provider" | "insurer" | "claim", value: any) {
    const href = providerIndexedSearchHref(field, value);
    const label = String(value || "").trim();

    if (!href || !label) return label || "—";

    return (
      <Link href={href} style={{ color: "#2563eb", fontWeight: 800, textDecoration: "none" }}>
        {label}
      </Link>
    );
  }

  function providerMatterSortValue(row: any, field: string): string | number {
    switch (field) {
      case "billAmount":
      case "balance":
        return Number(row?.[field] || 0);
      case "dateOfService":
        return `${String(row?.dateOfService || "")} ${String(row?.dateOfServiceEnd || "")}`.trim();
      default:
        return String(row?.[field] ?? "").toLowerCase();
    }
  }

  function providerLawsuitSortValue(row: any, field: string): string | number {
    switch (field) {
      case "childMatterCount":
      case "billAmount":
      case "balance":
        return Number(row?.[field] || 0);
      default:
        return String(row?.[field] ?? "").toLowerCase();
    }
  }

  function compareProviderPanelValues(aValue: string | number, bValue: string | number, direction: "asc" | "desc"): number {
    if (typeof aValue === "number" || typeof bValue === "number") {
      const numericA = Number(aValue || 0);
      const numericB = Number(bValue || 0);
      return direction === "asc" ? numericA - numericB : numericB - numericA;
    }

    const compare = String(aValue || "").localeCompare(String(bValue || ""), undefined, { numeric: true, sensitivity: "base" });
    return direction === "asc" ? compare : -compare;
  }

  const sortedMatterRows = useMemo(
    () =>
      [...matterRows].sort((a: any, b: any) =>
        compareProviderPanelValues(providerMatterSortValue(a, matterPanelSortField), providerMatterSortValue(b, matterPanelSortField), matterPanelSortDirection)
      ),
    [matterRows, matterPanelSortField, matterPanelSortDirection]
  );

  const sortedLawsuitRows = useMemo(
    () =>
      [...lawsuitRows].sort((a: any, b: any) =>
        compareProviderPanelValues(providerLawsuitSortValue(a, lawsuitPanelSortField), providerLawsuitSortValue(b, lawsuitPanelSortField), lawsuitPanelSortDirection)
      ),
    [lawsuitRows, lawsuitPanelSortField, lawsuitPanelSortDirection]
  );

  function changeMatterPanelSort(field: string) {
    if (matterPanelSortField === field) {
      setMatterPanelSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setMatterPanelSortField(field);
    setMatterPanelSortDirection(field === "billAmount" || field === "balance" ? "desc" : "asc");
  }

  function changeLawsuitPanelSort(field: string) {
    if (lawsuitPanelSortField === field) {
      setLawsuitPanelSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setLawsuitPanelSortField(field);
    setLawsuitPanelSortDirection(field === "childMatterCount" || field === "billAmount" || field === "balance" ? "desc" : "asc");
  }

  function matterPanelHeader(label: string, field: string) {
    const active = matterPanelSortField === field;
    return (
      <button
        type="button"
        onClick={() => changeMatterPanelSort(field)}
        style={{ border: 0, background: "transparent", padding: 0, margin: 0, font: "inherit", fontWeight: 950, color: "inherit", cursor: "pointer", textAlign: "left" }}
      >
        {label}{active ? (matterPanelSortDirection === "asc" ? " ▲" : " ▼") : ""}
      </button>
    );
  }

  function lawsuitPanelHeader(label: string, field: string) {
    const active = lawsuitPanelSortField === field;
    return (
      <button
        type="button"
        onClick={() => changeLawsuitPanelSort(field)}
        style={{ border: 0, background: "transparent", padding: 0, margin: 0, font: "inherit", fontWeight: 950, color: "inherit", cursor: "pointer", textAlign: "left" }}
      >
        {label}{active ? (lawsuitPanelSortDirection === "asc" ? " ▲" : " ▼") : ""}
      </button>
    );
  }

  useEffect(() => {
    if (!client) return;
    setClientForm({
      address: clientAddress(client.details),
      owner: findDetailValue(client.details, ["hidden_owner", "owner", "Owner", "assigned_owner", "account_owner", "client_owner"]),
      providerGroup: findDetailValue(client.details, ["hidden_group_name", "group_name", "provider_group", "Provider Group", "Group Name"]),
      retainerNFPrincipal: percentDisplay(findDetailValue(client.details, ["hidden_retainer_principal_nf_percent", "retainer_nf_principal_percent", "Retainer NF Principal", "Retainer Principal NF", "NF Principal", "Principal Fee Percent", "Principal Fee %"])),
      retainerNFInterest: percentDisplay(findDetailValue(client.details, ["hidden_retainer_interest_percent", "hidden_retainer_nf_interest_percent", "retainer_nf_interest_percent", "Retainer NF Interest", "Retainer Interest", "NF Interest", "Interest Fee Percent", "Interest Fee %"])),
      retainerWCPrincipal: percentDisplay(findDetailValue(client.details, ["hidden_retainer_wc_principal_percent", "retainer_wc_principal_percent", "Retainer WC Principal", "WC Principal"])),
      retainerWCInterest: percentDisplay(findDetailValue(client.details, ["hidden_retainer_wc_interest_percent", "retainer_wc_interest_percent", "Retainer WC Interest", "WC Interest"])),
      retainerLiensPrincipal: percentDisplay(findDetailValue(client.details, ["hidden_retainer_liens_principal_percent", "hidden_retainer_lien_principal_percent", "retainer_liens_principal_percent", "retainer_lien_principal_percent", "Retainer Liens Principal", "Retainer Lien Principal", "Liens Principal", "Lien Principal"])),
      retainerLiensInterest: percentDisplay(findDetailValue(client.details, ["hidden_retainer_liens_interest_percent", "hidden_retainer_lien_interest_percent", "retainer_liens_interest_percent", "retainer_lien_interest_percent", "Retainer Liens Interest", "Retainer Lien Interest", "Liens Interest", "Lien Interest"])),
      pullCosts: findDetailValue(client.details, ["hidden_pull_costs", "pull_costs", "Pull Costs", "Pull Cost"]),
      remit: findDetailValue(client.details, ["hidden_remit", "remit", "Remit", "remit_type", "remit_account"]),
      notes: clientNotes(client.details),
    });
  }, [client]);

  function updateClientForm(field: keyof typeof clientForm, value: string) {
    setClientForm((current) => ({ ...current, [field]: value }));
  }

  async function saveClientDefaults() {
    if (!id) return;
    setSavingClient(true);
    setSaveMessage("");
    setError("");

    try {
      const body =
        editingField === "notes"
          ? notesEditorMode === "edit"
            ? { replaceNotes: true, notes: editableNotes.map((note) => note.trim()).filter(Boolean).join("\n\n") }
            : { appendNote: clientForm.notes }
          : editingField === "address"
            ? { address: clientForm.address }
            : clientForm;

      const res = await fetch(`/api/admin/clients/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "Could not save client info.");

      await loadDetail(id);
      setEditingField(null);
      setSaveMessage(editingField === "notes" ? (notesEditorMode === "edit" ? "Notes updated." : "Note added.") : "Saved.");
    } catch (err: any) {
      setError(err?.message || "Could not save client info.");
    } finally {
      setSavingClient(false);
    }
  }

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

  const matterCsvRows = useMemo(
    () =>
      matterRows.map((row: any) => ({
        Matter: row.matter,
        Patient: row.patient,
        Provider: row.provider,
        Insurer: row.insurer,
        Lawsuit: row.lawsuit,
        "Claim Number": row.claimNumber,
        "Date of Service": providerPanelDateRange(row),
        "Bill Amount": row.billAmount,
        Balance: row.balance,
        Status: row.finalStatus,
      })),
    [matterRows]
  );

  const lawsuitCsvRows = useMemo(
    () =>
      lawsuitRows.map((row: any) => ({
        Lawsuit: row.lawsuit,
        "Individual Matter Count": row.childMatterCount,
        Providers: row.providers,
        Patients: row.patients,
        Insurers: row.insurers,
        "Bill Amount": row.billAmount,
        Balance: row.balance,
      })),
    [lawsuitRows]
  );

  function splitClientNotesForEditing(rawNotes: string) {
    return rawNotes
      .split(/\n+/)
      .map((note) => note.trim())
      .filter(Boolean);
  }

  function startAddNote() {
    setSaveMessage("");
    setError("");
    setNotesEditorMode("add");
    setEditableNotes([]);
    setClientForm((current) => ({ ...current, notes: "" }));
    setEditingField("notes");
  }

  function startEditNotes() {
    setSaveMessage("");
    setError("");
    setNotesEditorMode("edit");
    setEditableNotes(splitClientNotesForEditing(clientNotes(client?.details)));
    setClientForm((current) => ({ ...current, notes: clientNotes(client?.details) }));
    setEditingField("notes");
  }

  function updateEditableNote(index: number, value: string) {
    setEditableNotes((current) => current.map((note, noteIndex) => (noteIndex === index ? value : note)));
  }

  function deleteEditableNote(index: number) {
    setEditableNotes((current) => current.filter((_, noteIndex) => noteIndex !== index));
  }

  function beginEdit(field: keyof typeof clientForm) {
    setSaveMessage("");
    setError("");
    if (field === "notes") {
      setNotesEditorMode("add");
      setClientForm((current) => ({ ...current, notes: "" }));
    }
    setEditingField(field);
  }

  function cancelEdit() {
    setEditingField(null);
    setNotesEditorMode("add");
    setEditableNotes([]);
    setNotesEditorMode("add");
    if (client) {
      setClientForm({
        address: clientAddress(client.details),
        owner: findDetailValue(client.details, ["hidden_owner", "owner", "Owner", "assigned_owner", "account_owner", "client_owner"]),
        providerGroup: findDetailValue(client.details, ["hidden_group_name", "group_name", "provider_group", "Provider Group", "Group Name"]),
        retainerNFPrincipal: percentDisplay(findDetailValue(client.details, ["hidden_retainer_principal_nf_percent", "retainer_nf_principal_percent", "Retainer NF Principal", "Retainer Principal NF", "NF Principal", "Principal Fee Percent", "Principal Fee %"])),
        retainerNFInterest: percentDisplay(findDetailValue(client.details, ["hidden_retainer_interest_percent", "hidden_retainer_nf_interest_percent", "retainer_nf_interest_percent", "Retainer NF Interest", "Retainer Interest", "NF Interest", "Interest Fee Percent", "Interest Fee %"])),
        retainerWCPrincipal: percentDisplay(findDetailValue(client.details, ["hidden_retainer_wc_principal_percent", "retainer_wc_principal_percent", "Retainer WC Principal", "WC Principal"])),
        retainerWCInterest: percentDisplay(findDetailValue(client.details, ["hidden_retainer_wc_interest_percent", "retainer_wc_interest_percent", "Retainer WC Interest", "WC Interest"])),
        retainerLiensPrincipal: percentDisplay(findDetailValue(client.details, ["hidden_retainer_liens_principal_percent", "hidden_retainer_lien_principal_percent", "retainer_liens_principal_percent", "retainer_lien_principal_percent", "Retainer Liens Principal", "Retainer Lien Principal", "Liens Principal", "Lien Principal"])),
        retainerLiensInterest: percentDisplay(findDetailValue(client.details, ["hidden_retainer_liens_interest_percent", "hidden_retainer_lien_interest_percent", "retainer_liens_interest_percent", "retainer_lien_interest_percent", "Retainer Liens Interest", "Retainer Lien Interest", "Liens Interest", "Lien Interest"])),
        pullCosts: findDetailValue(client.details, ["hidden_pull_costs", "pull_costs", "Pull Costs", "Pull Cost"]),
        remit: findDetailValue(client.details, ["hidden_remit", "remit", "Remit", "remit_type", "remit_account"]),
        notes: clientNotes(client.details),
      });
    }
  }

  function rowButtons(field: keyof typeof clientForm, addLabel?: string) {
    if (editingField !== field) {
      return (
        <button
          type="button"
          onClick={() => beginEdit(field)}
          style={{ padding: "1px 6px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", fontSize: 12, fontWeight: 800, lineHeight: 1.1, alignSelf: "start", marginTop: 0 }}
        >
          {addLabel || "Edit"}
        </button>
      );
    }

    return (
      <span style={{ display: "inline-flex", gap: 6, alignSelf: "start" }}>
        <button
          type="button"
          disabled={savingClient}
          onClick={saveClientDefaults}
          style={{ padding: "1px 6px", borderRadius: 6, border: "1px solid #2563eb", background: "#2563eb", color: "#fff", fontSize: 12, fontWeight: 800, lineHeight: 1.1, alignSelf: "start", marginTop: 0 }}
        >
          {savingClient ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          disabled={savingClient}
          onClick={cancelEdit}
          style={{ padding: "1px 6px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", fontSize: 12, fontWeight: 800, lineHeight: 1.1, alignSelf: "start", marginTop: 0 }}
        >
          Cancel
        </button>
      </span>
    );
  }

  function editableTextRow(label: string, field: keyof typeof clientForm, displayValue: string, options?: { multiline?: boolean; addLabel?: string }) {
    const isEditing = editingField === field;
    return (
      <>
        <dt style={{ fontWeight: 800 }}>{label}</dt>
        <dd style={{ margin: 0, display: "grid", gridTemplateColumns: "1fr auto", gap: 6, alignItems: options?.multiline ? "start" : "center", lineHeight: 1.2 }}>
          {isEditing ? (
            options?.multiline ? (
              <textarea
                value={clientForm[field]}
                onChange={(event) => updateClientForm(field, event.target.value)}
                style={{ width: "100%", minHeight: 70, padding: 8, border: "1px solid #cbd5e1", borderRadius: 8 }}
              />
            ) : (
              <input
                value={clientForm[field]}
                onChange={(event) => updateClientForm(field, event.target.value)}
                style={{ width: "100%", padding: 8, border: "1px solid #cbd5e1", borderRadius: 8 }}
              />
            )
          ) : (
            <span style={options?.multiline ? { whiteSpace: "pre-wrap" } : undefined}>{displayValue || "—"}</span>
          )}
          {rowButtons(field, options?.addLabel)}
        </dd>
      </>
    );
  }

  function editableSelectRow(label: string, field: keyof typeof clientForm, displayValue: string, options: string[]) {
    const isEditing = editingField === field;
    return (
      <>
        <dt style={{ fontWeight: 800 }}>{label}</dt>
        <dd style={{ margin: 0, display: "grid", gridTemplateColumns: "1fr auto", gap: 6, alignItems: "center", lineHeight: 1.2 }}>
          {isEditing ? (
            <select
              value={clientForm[field]}
              onChange={(event) => updateClientForm(field, event.target.value)}
              style={{ width: "100%", padding: 8, border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff" }}
            >
              <option value="">—</option>
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <span>{displayValue || "—"}</span>
          )}
          {rowButtons(field)}
        </dd>
      </>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={{ marginBottom: 18, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Link href="/admin/clients" style={{ color: "#2563eb", fontWeight: 700, textDecoration: "none" }}>
          ← Clients
        </Link>
        <Link href="/admin" style={{ color: "#2563eb", fontWeight: 700, textDecoration: "none" }}>
          Admin Home
        </Link>
        <Link href="/admin/invoices" style={{ color: "#2563eb", fontWeight: 700, textDecoration: "none" }}>
          Global Invoice Search
        </Link>
      </div>

      {error && (
        <section style={{ ...cardStyle, borderColor: "#fecaca", color: "#b91c1c", marginBottom: 18 }}>
          {error}
        </section>
      )}

      <section style={{ marginBottom: 22 }}>
        <div style={{ color: "#64748b", fontSize: 13, fontWeight: 700, textTransform: "uppercase" }}>
          PROVIDER ACCOUNT
        </div>
        <h1 style={{ margin: "6px 0 8px", fontSize: 38, lineHeight: 1.08, letterSpacing: "-0.035em", fontWeight: 950, color: "#0f172a" }}>{client?.displayName || "Loading client..."}</h1>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(450px, 1.05fr) minmax(440px, 1fr) minmax(320px, 0.85fr)",
          gap: 18,
          marginBottom: 18,
          alignItems: "start",
        }}
      >
        <div style={{ ...providerHubCardStyle, position: "relative", paddingTop: 22 }}>
          <div style={{ position: "absolute", top: 10, right: 12 }}>
            {editingField === "address" ? (
              <span style={{ display: "inline-flex", gap: 6 }}>
                <button
                  type="button"
                  disabled={savingClient}
                  onClick={saveClientDefaults}
                  style={{ padding: "1px 6px", borderRadius: 6, border: "1px solid #2563eb", background: "#2563eb", color: "#fff", fontSize: 12, fontWeight: 800, lineHeight: 1.1 }}
                >
                  {savingClient ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  disabled={savingClient}
                  onClick={cancelEdit}
                  style={{ padding: "1px 6px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", fontSize: 12, fontWeight: 800, lineHeight: 1.1 }}
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => beginEdit("address")}
                style={{ padding: "1px 6px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", fontSize: 12, fontWeight: 800, lineHeight: 1.1 }}
              >
                Edit
              </button>
            )}
          </div>
          <dl style={{ display: "grid", gridTemplateColumns: "100px max-content", gap: "8px 18px", margin: 0, alignItems: "start" }}>
            <dt style={providerHubIdentityLabelStyle}>Name</dt>
            <dd style={providerHubIdentityValueStyle}>{client?.displayName || ""}</dd>
            <dt style={providerHubIdentityLabelStyle}>Address</dt>
            <dd style={providerHubIdentityValueStyle}>
              {editingField === "address" ? (
                <textarea
                  value={clientForm.address}
                  onChange={(event) => updateClientForm("address", event.target.value)}
                  style={{ width: "100%", minHeight: 70, padding: 8, border: "1px solid #cbd5e1", borderRadius: 8 }}
                />
              ) : (
                <span style={{ whiteSpace: "pre", display: "block" }}>{clientAddress(client?.details) || "—"}</span>
              )}
            </dd>
            <dt style={providerHubIdentityLabelStyle}>Status</dt>
            <dd style={providerHubIdentityValueStyle}>{statusBadge(client?.isActive)}</dd>
          </dl>
        </div>

        <div style={providerHubCardStyle}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            {editingField === "providerGroup" ? (
              <span style={{ display: "inline-flex", gap: 6, alignSelf: "start" }}>
                <button
                  type="button"
                  disabled={savingClient}
                  onClick={saveClientDefaults}
                  style={{ padding: "1px 6px", borderRadius: 6, border: "1px solid #2563eb", background: "#2563eb", color: "#fff", fontSize: 12, fontWeight: 800, lineHeight: 1.1, alignSelf: "start", marginTop: 0 }}
                >
                  {savingClient ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  disabled={savingClient}
                  onClick={cancelEdit}
                  style={{ padding: "1px 6px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", fontSize: 12, fontWeight: 800, lineHeight: 1.1, alignSelf: "start", marginTop: 0 }}
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => beginEdit("providerGroup")}
                style={{ padding: "1px 6px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", fontSize: 12, fontWeight: 800, lineHeight: 1.1, alignSelf: "start", marginTop: 0 }}
              >
                Edit
              </button>
            )}
          </div>

          <dl style={{ display: "grid", gridTemplateColumns: "205px max-content", gap: "4px 18px", margin: 0, alignItems: "start" }}>
            <dt style={providerHubNoWrapLabelStyle}>Owner</dt>
            <dd style={providerHubNoWrapValueStyle}>
              {editingField === "providerGroup" ? (
                <input value={clientForm.owner} onChange={(event) => updateClientForm("owner", event.target.value)} style={{ width: "100%", padding: 6, border: "1px solid #cbd5e1", borderRadius: 8 }} />
              ) : (
                findDetailValue(client?.details, ["hidden_owner", "owner", "Owner", "assigned_owner", "account_owner", "client_owner"]) || "—"
              )}
            </dd>

            <dt style={providerHubNoWrapLabelStyle}>Provider Group</dt>
            <dd style={providerHubNoWrapValueStyle}>
              {editingField === "providerGroup" ? (
                <input value={clientForm.providerGroup} onChange={(event) => updateClientForm("providerGroup", event.target.value)} style={{ width: "100%", padding: 6, border: "1px solid #cbd5e1", borderRadius: 8 }} />
              ) : (
                findDetailValue(client?.details, ["hidden_group_name", "group_name", "provider_group", "Provider Group", "Group Name"]) || "—"
              )}
            </dd>

            <dt style={providerHubNoWrapLabelStyle}>Retainer NF Principal</dt>
            <dd style={providerHubNoWrapValueStyle}>
              {editingField === "providerGroup" ? (
                <input value={clientForm.retainerNFPrincipal} onChange={(event) => updateClientForm("retainerNFPrincipal", event.target.value)} style={{ width: "100%", padding: 6, border: "1px solid #cbd5e1", borderRadius: 8 }} />
              ) : (
                percentDisplay(findDetailValue(client?.details, ["hidden_retainer_principal_nf_percent", "retainer_nf_principal_percent", "Retainer NF Principal", "Retainer Principal NF", "NF Principal", "Principal Fee Percent", "Principal Fee %"])) || "—"
              )}
            </dd>

            <dt style={providerHubNoWrapLabelStyle}>Retainer NF Interest</dt>
            <dd style={providerHubNoWrapValueStyle}>
              {editingField === "providerGroup" ? (
                <input value={clientForm.retainerNFInterest} onChange={(event) => updateClientForm("retainerNFInterest", event.target.value)} style={{ width: "100%", padding: 6, border: "1px solid #cbd5e1", borderRadius: 8 }} />
              ) : (
                percentDisplay(findDetailValue(client?.details, ["hidden_retainer_interest_percent", "hidden_retainer_nf_interest_percent", "retainer_nf_interest_percent", "Retainer NF Interest", "Retainer Interest", "NF Interest", "Interest Fee Percent", "Interest Fee %"])) || "—"
              )}
            </dd>

            <dt style={providerHubNoWrapLabelStyle}>Retainer WC Principal</dt>
            <dd style={providerHubNoWrapValueStyle}>
              {editingField === "providerGroup" ? (
                <input value={clientForm.retainerWCPrincipal} onChange={(event) => updateClientForm("retainerWCPrincipal", event.target.value)} style={{ width: "100%", padding: 6, border: "1px solid #cbd5e1", borderRadius: 8 }} />
              ) : (
                percentDisplay(findDetailValue(client?.details, ["hidden_retainer_wc_principal_percent", "retainer_wc_principal_percent", "Retainer WC Principal", "WC Principal"])) || "—"
              )}
            </dd>

            <dt style={providerHubNoWrapLabelStyle}>Retainer WC Interest</dt>
            <dd style={providerHubNoWrapValueStyle}>
              {editingField === "providerGroup" ? (
                <input value={clientForm.retainerWCInterest} onChange={(event) => updateClientForm("retainerWCInterest", event.target.value)} style={{ width: "100%", padding: 6, border: "1px solid #cbd5e1", borderRadius: 8 }} />
              ) : (
                percentDisplay(findDetailValue(client?.details, ["hidden_retainer_wc_interest_percent", "retainer_wc_interest_percent", "Retainer WC Interest", "WC Interest"])) || "—"
              )}
            </dd>

            <dt style={providerHubNoWrapLabelStyle}>Retainer Liens Principal</dt>
            <dd style={providerHubNoWrapValueStyle}>
              {editingField === "providerGroup" ? (
                <input value={clientForm.retainerLiensPrincipal} onChange={(event) => updateClientForm("retainerLiensPrincipal", event.target.value)} style={{ width: "100%", padding: 6, border: "1px solid #cbd5e1", borderRadius: 8 }} />
              ) : (
                percentDisplay(findDetailValue(client?.details, ["hidden_retainer_liens_principal_percent", "hidden_retainer_lien_principal_percent", "retainer_liens_principal_percent", "retainer_lien_principal_percent", "Retainer Liens Principal", "Retainer Lien Principal", "Liens Principal", "Lien Principal"])) || "—"
              )}
            </dd>

            <dt style={providerHubNoWrapLabelStyle}>Retainer Liens Interest</dt>
            <dd style={providerHubNoWrapValueStyle}>
              {editingField === "providerGroup" ? (
                <input value={clientForm.retainerLiensInterest} onChange={(event) => updateClientForm("retainerLiensInterest", event.target.value)} style={{ width: "100%", padding: 6, border: "1px solid #cbd5e1", borderRadius: 8 }} />
              ) : (
                percentDisplay(findDetailValue(client?.details, ["hidden_retainer_liens_interest_percent", "hidden_retainer_lien_interest_percent", "retainer_liens_interest_percent", "retainer_lien_interest_percent", "Retainer Liens Interest", "Retainer Lien Interest", "Liens Interest", "Lien Interest"])) || "—"
              )}
            </dd>

            <dt style={providerHubNoWrapLabelStyle}>Pull Costs</dt>
            <dd style={providerHubNoWrapValueStyle}>
              {editingField === "providerGroup" ? (
                <select value={clientForm.pullCosts} onChange={(event) => updateClientForm("pullCosts", event.target.value)} style={{ width: "100%", padding: 6, border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff" }}>
                  <option value="">—</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              ) : (
                findDetailValue(client?.details, ["hidden_pull_costs", "pull_costs", "Pull Costs", "Pull Cost"]) || "—"
              )}
            </dd>

            <dt style={providerHubNoWrapLabelStyle}>Remit</dt>
            <dd style={providerHubNoWrapValueStyle}>
              {editingField === "providerGroup" ? (
                <select value={clientForm.remit} onChange={(event) => updateClientForm("remit", event.target.value)} style={{ width: "100%", padding: 6, border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff" }}>
                  <option value="">—</option>
                  <option value="Live">Live</option>
                  <option value="Escrow">Escrow</option>
                </select>
              ) : (
                findDetailValue(client?.details, ["hidden_remit", "remit", "Remit", "remit_type", "remit_account"]) || "—"
              )}
            </dd>
          </dl>
        </div>

        <div style={providerHubCardStyle}>
          <h2 style={providerHubSectionTitleStyle}>Provider Workflow Hub</h2>
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            <Link
              href={`/admin/clients/${encodeURIComponent(id)}/invoice`}
              style={{ ...providerHubButtonBaseStyle, border: "1px solid #1d4ed8", background: "linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)", color: "#0f172a", textDecoration: "none" }}
            >
              Invoicing / Remittance
            </Link>
            <button
              type="button"
              onClick={() => setActiveWorkflowPanel(activeWorkflowPanel === "individual" ? "" : "individual")}
              style={{ ...providerHubButtonBaseStyle, border: "1px solid #047857", background: activeWorkflowPanel === "individual" ? "#047857" : "linear-gradient(180deg, #ecfdf5 0%, #d1fae5 100%)", color: activeWorkflowPanel === "individual" ? "#fff" : "#0f172a" }}
            >
              Individual Matters
            </button>
            <button
              type="button"
              onClick={() => setActiveWorkflowPanel(activeWorkflowPanel === "lawsuits" ? "" : "lawsuits")}
              style={{ ...providerHubButtonBaseStyle, border: "1px solid #7c3aed", background: activeWorkflowPanel === "lawsuits" ? "#7c3aed" : "linear-gradient(180deg, #f5f3ff 0%, #ede9fe 100%)", color: activeWorkflowPanel === "lawsuits" ? "#fff" : "#0f172a" }}
            >
              Lawsuit Matters
            </button>
          </div>
        </div>
      </section>

      <section style={{ ...providerHubCardStyle, marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, marginBottom: 10 }}>
          <div>
            <h2 style={providerHubSectionTitleStyle}>Account Notes</h2>
          </div>
          {editingField !== "notes" && (
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={startAddNote}
                style={{ padding: "3px 8px", borderRadius: 7, border: "1px solid #2563eb", background: "#2563eb", color: "#ffffff", fontSize: 12, fontWeight: 900, lineHeight: 1.1 }}
              >
                Add Note
              </button>
              <button
                type="button"
                onClick={startEditNotes}
                style={{ padding: "3px 8px", borderRadius: 7, border: "1px solid #64748b", background: "#ffffff", color: "#0f172a", fontSize: 12, fontWeight: 900, lineHeight: 1.1 }}
              >
                Edit Notes
              </button>
            </div>
          )}
        </div>

        {editingField === "notes" ? (
          notesEditorMode === "add" ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ color: "#475569", fontSize: 13, fontWeight: 850 }}>
                Add a new note. Saving will append it with the current date and time.
              </div>
              <textarea
                value={clientForm.notes}
                onChange={(event) => updateClientForm("notes", event.target.value)}
                placeholder="Enter new note..."
                style={{ width: "100%", minHeight: 110, padding: 10, border: "1px solid #cbd5e1", borderRadius: 10, fontFamily: "inherit", lineHeight: 1.45 }}
              />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button type="button" disabled={savingClient} onClick={cancelEdit} style={{ padding: "7px 11px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#ffffff", fontWeight: 850 }}>
                  Cancel
                </button>
                <button type="button" disabled={savingClient || !clientForm.notes.trim()} onClick={saveClientDefaults} style={{ padding: "7px 11px", borderRadius: 8, border: "1px solid #2563eb", background: "#2563eb", color: "#ffffff", fontWeight: 900 }}>
                  {savingClient ? "Saving..." : "Save New Note"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ color: "#475569", fontSize: 13, fontWeight: 850 }}>
                Edit any individual note below or use Delete to remove that note. Saving replaces the notes list.
              </div>
              {editableNotes.length ? (
                editableNotes.map((note, noteIndex) => (
                  <div key={`note-editor-${noteIndex}`} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "start" }}>
                    <textarea
                      value={note}
                      onChange={(event) => updateEditableNote(noteIndex, event.target.value)}
                      style={{ width: "100%", minHeight: 70, padding: 10, border: "1px solid #cbd5e1", borderRadius: 10, fontFamily: "inherit", lineHeight: 1.45 }}
                    />
                    <button
                      type="button"
                      onClick={() => deleteEditableNote(noteIndex)}
                      style={{ padding: "7px 11px", borderRadius: 8, border: "1px solid #991b1b", background: "#991b1b", color: "#ffffff", fontWeight: 900 }}
                    >
                      Delete
                    </button>
                  </div>
                ))
              ) : (
                <div style={{ color: "#64748b", fontSize: 13, fontWeight: 800 }}>No notes remain.</div>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button type="button" disabled={savingClient} onClick={cancelEdit} style={{ padding: "7px 11px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#ffffff", fontWeight: 850 }}>
                  Cancel
                </button>
                <button type="button" disabled={savingClient} onClick={saveClientDefaults} style={{ padding: "7px 11px", borderRadius: 8, border: "1px solid #2563eb", background: "#2563eb", color: "#ffffff", fontWeight: 900 }}>
                  {savingClient ? "Saving..." : "Save Note Edits"}
                </button>
              </div>
            </div>
          )
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
              {clientNotes(client?.details) || "No notes yet."}
            </div>
          </div>
        )}

        {saveMessage && <div style={{ marginTop: 10, color: "#166534", fontWeight: 800 }}>{saveMessage}</div>}
      </section>

      {activeWorkflowPanel === "remittance" && (
        <>
          <section style={{ ...cardStyle, marginBottom: 18 }}>
            <h2 style={{ marginTop: 0 }}>Invoicing / Remittance Preview</h2>
            <p style={{ marginTop: -4, color: "#475569", lineHeight: 1.45 }}>
              Child-matter-based local payment reporting. Lawsuit-page payments appear here only through allocated child MatterPaymentReceipt rows.
              This preview does not create invoices, write remittances, or update Clio.
            </p>
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
        </>
      )}

      {activeWorkflowPanel === "individual" && (
        <section style={{ ...cardStyle, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>Individual Matters</h2>
              <p style={{ margin: "6px 0 0", color: "#475569", lineHeight: 1.45 }}>
                Matched local ClaimIndex child matters for this provider/client. Use this panel to review the child-matter population behind invoice/remittance reporting.
              </p>
            </div>
            <button
              type="button"
              onClick={() => downloadCsv(`${client?.displayName || "Client"} - Individual Matters.csv`, matterCsvRows)}
              disabled={!matterCsvRows.length}
              style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #cbd5e1", background: matterCsvRows.length ? "#fff" : "#f1f5f9", fontWeight: 800 }}
            >
              Export CSV
            </button>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "14px 0" }}>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, minWidth: 160 }}>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900 }}>Individual Matters</div>
              <div style={{ fontSize: 24, fontWeight: 950 }}>{matterPanelTotals.count}</div>
            </div>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, minWidth: 160 }}>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900 }}>Linked Lawsuits</div>
              <div style={{ fontSize: 24, fontWeight: 950 }}>{linkedLawsuitCount}</div>
            </div>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, minWidth: 160 }}>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900 }}>Bill Amount</div>
              <div style={{ fontSize: 24, fontWeight: 950 }}>{money(matterPanelTotals.billAmount)}</div>
            </div>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, minWidth: 160 }}>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900 }}>Balance</div>
              <div style={{ fontSize: 24, fontWeight: 950 }}>{money(matterPanelTotals.balance)}</div>
            </div>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, minWidth: 160 }}>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900 }}>Open / Closed</div>
              <div style={{ fontSize: 24, fontWeight: 950 }}>{matterPanelTotals.openCount} / {matterPanelTotals.closedCount}</div>
            </div>
          </div>

          <div style={{ marginBottom: 12, border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#f8fafc", color: "#475569", lineHeight: 1.45 }}>
            Invoice/remittance reporting remains child-matter based. Lawsuit-page payments must appear through allocated child MatterPaymentReceipt rows before they belong in provider reporting.
          </div>

          <div style={{ overflowX: "auto", maxHeight: 420 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1120 }}>
              <thead>
                <tr>
                  <th style={thStyle}>{matterPanelHeader("Matter", "matter")}</th>
                  <th style={thStyle}>{matterPanelHeader("Patient", "patient")}</th>
                  <th style={thStyle}>{matterPanelHeader("Provider", "provider")}</th>
                  <th style={thStyle}>{matterPanelHeader("Insurer", "insurer")}</th>
                  <th style={thStyle}>{matterPanelHeader("Lawsuit", "lawsuit")}</th>
                  <th style={thStyle}>{matterPanelHeader("Claim #", "claimNumber")}</th>
                  <th style={thStyle}>{matterPanelHeader("DOS", "dateOfService")}</th>
                  <th style={thStyle}>{matterPanelHeader("Bill Amount", "billAmount")}</th>
                  <th style={thStyle}>{matterPanelHeader("Balance", "balance")}</th>
                  <th style={thStyle}>{matterPanelHeader("Status", "finalStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {sortedMatterRows.map((row: any) => {
                  const matterHref = providerMatterHref(row);
                  const lawsuitHref = providerLawsuitHref(row.lawsuit);

                  return (
                    <tr key={row.id || row.matter}>
                      <td style={tdStyle}>
                        {matterHref ? (
                          <Link href={matterHref} style={{ color: "#2563eb", fontWeight: 800, textDecoration: "none" }}>
                            {row.matter}
                          </Link>
                        ) : (
                          row.matter
                        )}
                      </td>
                      <td style={tdStyle}>{providerIndexedLink("patient", row.patient)}</td>
                      <td style={tdStyle}>{providerIndexedLink("provider", row.provider)}</td>
                      <td style={tdStyle}>{providerIndexedLink("insurer", row.insurer)}</td>
                      <td style={tdStyle}>
                        {lawsuitHref ? (
                          <Link href={lawsuitHref} style={{ color: "#2563eb", fontWeight: 800, textDecoration: "none" }}>
                            {row.lawsuit}
                          </Link>
                        ) : (
                          row.lawsuit
                        )}
                      </td>
                      <td style={tdStyle}>{providerIndexedLink("claim", row.claimNumber)}</td>
                      <td style={tdStyle}>{providerPanelDateRange(row)}</td>
                      <td style={tdStyle}>{money(row.billAmount)}</td>
                      <td style={tdStyle}>{money(row.balance)}</td>
                      <td style={tdStyle}>{row.finalStatus}</td>
                    </tr>
                  );
                })}
                {!matterRows.length && (
                  <tr>
                    <td style={tdStyle} colSpan={10}>
                      No individual matters matched this client/provider reference name or aliases.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeWorkflowPanel === "lawsuits" && (
        <section style={{ ...cardStyle, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>Lawsuit Matters</h2>
              <p style={{ margin: "6px 0 0", color: "#475569", lineHeight: 1.45 }}>
                Lawsuit matters are summarized from this provider/client's matched individual matters. Payment reporting remains child-matter based.
              </p>
            </div>
            <button
              type="button"
              onClick={() => downloadCsv(`${client?.displayName || "Client"} - Lawsuit Matters.csv`, lawsuitCsvRows)}
              disabled={!lawsuitCsvRows.length}
              style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #cbd5e1", background: lawsuitCsvRows.length ? "#fff" : "#f1f5f9", fontWeight: 800 }}
            >
              Export CSV
            </button>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "14px 0" }}>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, minWidth: 170 }}>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900 }}>Lawsuits</div>
              <div style={{ fontSize: 24, fontWeight: 950 }}>{lawsuitPanelTotals.count}</div>
            </div>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, minWidth: 170 }}>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900 }}>Child Matters</div>
              <div style={{ fontSize: 24, fontWeight: 950 }}>{lawsuitPanelTotals.childMatterCount}</div>
            </div>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, minWidth: 170 }}>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900 }}>Bill Amount</div>
              <div style={{ fontSize: 24, fontWeight: 950 }}>{money(lawsuitPanelTotals.billAmount)}</div>
            </div>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, minWidth: 170 }}>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900 }}>Balance</div>
              <div style={{ fontSize: 24, fontWeight: 950 }}>{money(lawsuitPanelTotals.balance)}</div>
            </div>
          </div>

          <div style={{ marginBottom: 12, border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#f8fafc", color: "#475569", lineHeight: 1.45 }}>
            This panel is a local summary grouped from matched child matters. It does not create lawsuits, edit lawsuit metadata, write payments, or update Clio.
          </div>

          <div style={{ overflowX: "auto", maxHeight: 420 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
              <thead>
                <tr>
                  <th style={thStyle}>{lawsuitPanelHeader("Lawsuit", "lawsuit")}</th>
                  <th style={thStyle}>{lawsuitPanelHeader("Individual Matter Count", "childMatterCount")}</th>
                  <th style={thStyle}>{lawsuitPanelHeader("Providers", "providers")}</th>
                  <th style={thStyle}>{lawsuitPanelHeader("Patients", "patients")}</th>
                  <th style={thStyle}>{lawsuitPanelHeader("Insurers", "insurers")}</th>
                  <th style={thStyle}>{lawsuitPanelHeader("Bill Amount", "billAmount")}</th>
                  <th style={thStyle}>{lawsuitPanelHeader("Balance", "balance")}</th>
                </tr>
              </thead>
              <tbody>
                {sortedLawsuitRows.map((row: any) => {
                  const lawsuitHref = providerLawsuitHref(row.lawsuit);

                  return (
                    <tr key={row.lawsuit}>
                      <td style={tdStyle}>
                        {lawsuitHref ? (
                          <Link href={lawsuitHref} style={{ color: "#2563eb", fontWeight: 800, textDecoration: "none" }}>
                            {row.lawsuit}
                          </Link>
                        ) : (
                          row.lawsuit
                        )}
                      </td>
                      <td style={tdStyle}>{row.childMatterCount}</td>
                      <td style={tdStyle}>{providerIndexedLink("provider", row.providers)}</td>
                      <td style={tdStyle}>{providerIndexedLink("patient", row.patients)}</td>
                      <td style={tdStyle}>{providerIndexedLink("insurer", row.insurers)}</td>
                      <td style={tdStyle}>{money(row.billAmount)}</td>
                      <td style={tdStyle}>{money(row.balance)}</td>
                    </tr>
                  );
                })}
                {!lawsuitRows.length && (
                  <tr>
                    <td style={tdStyle} colSpan={7}>
                      No lawsuit matters matched this client/provider through individual matters.
                    </td>
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
