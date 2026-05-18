"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import BarshHeaderQuickNav from "@/app/components/BarshHeaderQuickNav";

type FilterKind = "patient" | "provider" | "insurer" | "claim" | "master" | "treatingProvider";

type MatterRow = {
  id: string;
  displayNumber: string;
  description: string;
  patient: string;
  provider: string;
  insurer: string;
  claimNumber: string;
  masterLawsuitId: string;
  treatingProvider: string;
  claimAmount: any;
  balancePresuit: any;
  paymentVoluntary?: any;
  billAmount: any;
  isMaster: boolean;
  matchedBy: string;
};

const colors = {
  ink: "#0f172a",
  muted: "#475569",
  subtle: "#64748b",
  line: "#d7dee9",
  lineSoft: "#e5e7eb",
  page: "#f8fafc",
  panel: "#ffffff",
  blue: "#3157d5",
  blueDark: "#1e3a8a",
  errorBg: "#fef2f2",
  errorBorder: "#fecaca",
};

function clean(v: any) {
  return String(v || "").trim();
}

function nameLike(v: any) {
  if (v == null) return "";
  if (typeof v === "object") {
    return clean(
      v.name ??
        v.displayName ??
        v.display_name ??
        v.fullName ??
        v.full_name ??
        v.value ??
        ""
    );
  }

  return clean(v);
}

function matterId(m: any) {
  return clean(m?.matterId ?? m?.matter_id ?? m?.id);
}

function displayNumber(m: any) {
  return (
    clean(m?.displayNumber) ||
    clean(m?.display_number) ||
    clean(m?.matterNumber) ||
    clean(m?.matter_number) ||
    matterId(m)
  );
}

function patientName(m: any) {
  return nameLike(m?.patientName ?? m?.patient_name ?? m?.patient);
}

function providerName(m: any) {
  return nameLike(
    m?.clientName ??
      m?.client_name ??
      m?.providerName ??
      m?.provider_name ??
      m?.provider ??
      m?.client
  );
}

function insurerName(m: any) {
  return nameLike(
    m?.insurerName ??
      m?.insurer_name ??
      m?.insuranceCompany ??
      m?.insurance_company ??
      m?.insurer
  );
}

function claimNumberFromMatter(m: any) {
  return clean(
    m?.claimNumber ??
      m?.claim_number ??
      m?.claimNumberNormalized ??
      m?.claim_number_normalized
  );
}

function treatingProviderName(m: any) {
  return nameLike(m?.treatingProvider ?? m?.treating_provider);
}

function masterLawsuitId(m: any) {
  return clean(m?.masterLawsuitId ?? m?.master_lawsuit_id);
}

function money(v: any) {
  const n = Number(v ?? 0);
  return Number.isFinite(n)
    ? n.toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "$0.00";
}

function parseMoneyDraft(v: any) {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function moneyDraft(v: any) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function amountDraft(v: any): number {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function isMasterMatterRow(row: any): boolean {
  return Boolean(
    row?.isMaster ||
      row?.is_master ||
      clean(row?.description).toUpperCase().startsWith("MASTER LAWSUIT")
  );
}

function masterWorkspaceBillRows(rows: any[]): any[] {
  return (Array.isArray(rows) ? rows : []).filter((row) => !isMasterMatterRow(row));
}

function masterWorkspaceBillAmount(row: any): number {
  const explicit = row?.billAmount ?? row?.bill_amount ?? row?.amount;
  const explicitText = clean(explicit);

  if (explicitText && amountDraft(explicit) !== 0) {
    return amountDraft(explicit);
  }

  return amountDraft(row?.claimAmount ?? row?.claim_amount ?? row?.balancePresuit ?? row?.balance_presuit);
}

function masterWorkspaceBillTotal(rows: any[]): number {
  return masterWorkspaceBillRows(rows).reduce(
    (sum, row) => sum + masterWorkspaceBillAmount(row),
    0
  );
}

function exactOrContains(haystack: string, q: string) {
  const h = clean(haystack).toLowerCase();
  const n = clean(q).toLowerCase();
  return h === n || h.includes(n);
}

function toMatterRow(row: any, matchedBy: string): MatterRow | null {
  const id = matterId(row);
  if (!id) return null;

  const description = clean(row?.description);

  return {
    id,
    displayNumber: displayNumber(row),
    description,
    patient: patientName(row),
    provider: providerName(row),
    insurer: insurerName(row),
    claimNumber: claimNumberFromMatter(row),
    masterLawsuitId: masterLawsuitId(row),
    treatingProvider: treatingProviderName(row),
    claimAmount: row?.claimAmount ?? row?.claim_amount,
    balancePresuit: row?.balancePresuit ?? row?.balance_presuit,
    paymentVoluntary: row?.paymentVoluntary ?? row?.payment_voluntary,
    billAmount: row?.billAmount ?? row?.bill_amount ?? row?.amount,
    isMaster: isMasterMatterRow(row),
    matchedBy,
  };
}

function dedupe(rows: MatterRow[]) {
  const seen = new Set<string>();
  const out: MatterRow[] = [];

  for (const row of rows) {
    if (!row.id || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }

  return out;
}

async function fetchRows(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();

  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "Filtered matters lookup failed.");
  }

  return Array.isArray(json.rows) ? json.rows : [];
}

function getFilterFromUrl(): { kind: FilterKind | ""; value: string } {
  const params = new URLSearchParams(window.location.search);

  const patient = clean(params.get("patient"));
  const provider = clean(params.get("provider"));
  const insurer = clean(params.get("insurer"));
  const claim = clean(params.get("claim"));
  const master = clean(params.get("master"));
  const treatingProvider = clean(params.get("treatingProvider"));

  if (treatingProvider) return { kind: "treatingProvider", value: treatingProvider };
  if (patient) return { kind: "patient", value: patient };
  if (provider) return { kind: "provider", value: provider };
  if (insurer) return { kind: "insurer", value: insurer };
  if (claim) return { kind: "claim", value: claim };
  if (master) return { kind: "master", value: master };

  return { kind: "", value: "" };
}

function filterTitle(kind: FilterKind | "", value: string) {
  if (!kind || !value) return "Filtered Matters";
  if (kind === "patient") return `Matters for Patient: ${value}`;
  if (kind === "provider") return `Matters for Provider: ${value}`;
  if (kind === "treatingProvider") return `Matters for Treating Provider: ${value}`;
  if (kind === "insurer") return `Matters for Insurer: ${value}`;
  if (kind === "master") return `Matters for Master Lawsuit: ${value}`;
  return `Matters for Claim: ${value}`;
}

function filterLabel(kind: FilterKind | "") {
  if (kind === "patient") return "Patient";
  if (kind === "provider") return "Provider";
  if (kind === "treatingProvider") return "Treating Provider";
  if (kind === "insurer") return "Insurer";
  if (kind === "claim") return "Claim Number";
  if (kind === "master") return "Master Lawsuit";
  return "Filter";
}

function filteredUrl(kind: FilterKind, value: string) {
  const params = new URLSearchParams();
  params.set(kind, value);
  return `/matters?${params.toString()}`;
}

type WorkflowKind = "patient" | "claim" | "";
type MasterWorkspaceTab = "documents" | "settlement" | "payments" | "close_paid_settlements";

function getWorkflowFromUrl(): WorkflowKind {
  if (typeof window === "undefined") return "";

  const params = new URLSearchParams(window.location.search);
  const workflow = String(params.get("workflow") || "").trim().toLowerCase();

  if (workflow === "patient") return "patient";
  if (workflow === "claim") return "claim";

  return "";
}

function workflowTitle(workflowKind: WorkflowKind, kind: FilterKind | "", value: string) {
  if (workflowKind === "patient") return `Patient Workflow: ${value}`;
  if (workflowKind === "claim") return `Claim Workflow: ${value}`;
  return filterTitle(kind, value);
}

function workflowNote(workflowKind: WorkflowKind) {
  if (workflowKind === "patient") {
    return "Patient-level working view.  Use this screen to review all matching patient matters without cluttering the direct matter workspace.";
  }

  if (workflowKind === "claim") {
    return "Claim-level working view.  Use this screen to review all matching claim matters and open the appropriate direct matter, patient view, claim view, or lawsuit group.";
  }

  return "";
}

export default function FilteredMattersPage() {
  const [kind, setKind] = useState<FilterKind | "">("");
  const [workflowKind, setWorkflowKind] = useState<WorkflowKind>("");
  const [value, setValue] = useState("");
  const [rows, setRows] = useState<MatterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeMasterWorkspaceTab, setActiveMasterWorkspaceTab] = useState<MasterWorkspaceTab>("payments");

  function masterPaymentTodayInput(): string {
    const d = new Date();
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const [masterPaymentFormOpen, setMasterPaymentFormOpen] = useState(false);
  const [masterPaymentAmountInput, setMasterPaymentAmountInput] = useState("");
  const [masterPaymentDateInput, setMasterPaymentDateInput] = useState(() => masterPaymentTodayInput());
  const [masterPaymentTransactionTypeInput, setMasterPaymentTransactionTypeInput] = useState("Collection Payment");
  const [masterPaymentTransactionStatusInput, setMasterPaymentTransactionStatusInput] = useState("Show on Remittance");
  const [masterPaymentCheckDateInput, setMasterPaymentCheckDateInput] = useState("");
  const [masterPaymentCheckNumberInput, setMasterPaymentCheckNumberInput] = useState("");
  const [masterPaymentPosting, setMasterPaymentPosting] = useState(false);
  const [masterPaymentPostResult, setMasterPaymentPostResult] = useState<any>(null);
  const [masterPaymentReceiptsLoading, setMasterPaymentReceiptsLoading] = useState(false);
  const [masterPaymentReceipts, setMasterPaymentReceipts] = useState<any[]>([]);
  const [masterPaymentReceiptsError, setMasterPaymentReceiptsError] = useState("");

  function masterPaymentPreviewAmountValue(): number {
    const cleaned = String(masterPaymentAmountInput || "").replace(/[$,\s]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function formatMasterPaymentAmountInput(value: string): string {
    const cleaned = String(value || "").replace(/[$,\s]/g, "");
    if (!cleaned) return "";
    const n = Number(cleaned);
    return Number.isFinite(n) ? n.toFixed(2) : value;
  }

  function resetMasterPaymentPreviewForm() {
    setMasterPaymentAmountInput("");
    setMasterPaymentDateInput(masterPaymentTodayInput());
    setMasterPaymentTransactionTypeInput("Collection Payment");
    setMasterPaymentTransactionStatusInput("Show on Remittance");
    setMasterPaymentCheckDateInput("");
    setMasterPaymentCheckNumberInput("");
  }

  function masterPaymentAllocationRows(): any[] {
    const amount = masterPaymentPreviewAmountValue();
    const billRows = masterWorkspaceBillRows(masterSettlementDetailRows);
    const billTotal = masterWorkspaceBillTotal(masterSettlementDetailRows);
    let remaining = amount;

    return billRows.map((row: any) => {
      const rowId = Number(row?.matterId || row?.matter_id || row?.id || 0);
      const displayNumber = clean(row?.displayNumber || row?.display_number);
      const billAmount = masterWorkspaceBillAmount(row);
      const currentPayments = Number(row?.paymentVoluntary ?? row?.payment_voluntary ?? 0) || 0;
      const currentBalance = Math.max(billAmount - currentPayments, 0);
      const proportionalAllocation =
        billTotal > 0
          ? Math.min(amount * (billAmount / billTotal), currentBalance)
          : 0;
      const paymentToPost = Math.max(Math.min(proportionalAllocation, remaining), 0);
      remaining = Math.max(remaining - paymentToPost, 0);

      return {
        row,
        rowId,
        matterId: rowId,
        displayNumber,
        billAmount,
        currentPayments,
        currentBalance,
        paymentToPost,
        expectedBalance: Math.max(currentBalance - paymentToPost, 0),
      };
    });
  }

  async function loadMasterPaymentReceipts() {
    const billRows = masterWorkspaceBillRows(masterSettlementDetailRows);

    if (billRows.length === 0) {
      setMasterPaymentReceipts([]);
      setMasterPaymentReceiptsError("");
      return;
    }

    setMasterPaymentReceiptsLoading(true);
    setMasterPaymentReceiptsError("");

    try {
      const allReceipts: any[] = [];

      for (const row of billRows) {
        const matterId = Number(row?.matterId || row?.matter_id || row?.id || 0);
        const display = clean(row?.displayNumber || row?.display_number);
        const claimAmount = masterWorkspaceBillAmount(row);

        if (!matterId) continue;

        const response = await fetch(
          `/api/matters/apply-payment?matterId=${encodeURIComponent(String(matterId))}&claimAmount=${encodeURIComponent(String(claimAmount))}`,
          { cache: "no-store" }
        );

        const json = await response.json().catch(() => null);
        if (!response.ok || !json?.ok) {
          throw new Error(json?.error || `Payment receipt readback failed for ${display || matterId}.`);
        }

        const rows = Array.isArray(json.rows) ? json.rows : [];
        for (const receipt of rows) {
          allReceipts.push({
            ...receipt,
            sourceMatterId: matterId,
            sourceDisplayNumber: display || receipt?.displayNumber || "",
          });
        }
      }

      allReceipts.sort((a, b) => {
        const aTime = Date.parse(a?.createdAt || a?.updatedAt || "") || 0;
        const bTime = Date.parse(b?.createdAt || b?.updatedAt || "") || 0;
        if (aTime !== bTime) return bTime - aTime;
        return Number(b?.id || 0) - Number(a?.id || 0);
      });

      setMasterPaymentReceipts(allReceipts);
    } catch (error: any) {
      setMasterPaymentReceiptsError(error?.message || String(error));
    } finally {
      setMasterPaymentReceiptsLoading(false);
    }
  }

  async function postMasterPaymentLocally() {
    setMasterPaymentPostResult(null);

    const amount = masterPaymentPreviewAmountValue();
    if (!Number.isFinite(amount) || amount <= 0) {
      setMasterPaymentPostResult({ ok: false, error: "Enter a valid lawsuit payment amount greater than $0.00." });
      return;
    }

    const allocations = masterPaymentAllocationRows().filter((item) => item.paymentToPost > 0.005);
    if (allocations.length === 0) {
      setMasterPaymentPostResult({ ok: false, error: "No eligible bill balance was found for this lawsuit payment." });
      return;
    }

    setMasterPaymentPosting(true);

    try {
      const results: any[] = [];

      for (const item of allocations) {
        if (!item.matterId || !item.displayNumber) {
          throw new Error(`Missing bill matter identity for lawsuit payment allocation.`);
        }

        const response = await fetch("/api/matters/apply-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matterId: item.matterId,
            expectedDisplayNumber: item.displayNumber,
            claimAmount: item.billAmount,
            paymentAmount: item.paymentToPost,
            paymentDate: masterPaymentDateInput,
            transactionType: masterPaymentTransactionTypeInput,
            transactionStatus: masterPaymentTransactionStatusInput,
            checkDate: masterPaymentCheckDateInput,
            checkNumber: masterPaymentCheckNumberInput,
            description: "Lawsuit Payment",
          }),
        });

        const json = await response.json().catch(() => null);
        if (!response.ok || !json?.ok) {
          throw new Error(json?.error || `Payment posting failed for ${item.displayNumber}.`);
        }

        results.push({
          ...json,
          displayNumber: item.displayNumber,
          matterId: item.matterId,
          paymentToPost: item.paymentToPost,
        });
      }

      setRows((currentRows: any[]) =>
        currentRows.map((row: any) => {
          const matterId = Number(row?.matterId || row?.matter_id || row?.id || 0);
          const result = results.find((item) => Number(item.matterId) === matterId);
          if (!result?.after) return row;

          return {
            ...row,
            paymentVoluntary: result.after.paymentVoluntary,
            payment_voluntary: result.after.paymentVoluntary,
            balancePresuit: result.after.balancePresuit,
            balance_presuit: result.after.balancePresuit,
          };
        })
      );

      setMasterPaymentPostResult({
        ok: true,
        totalPayment: amount,
        count: results.length,
        message: `Posted ${money(amount)} across ${results.length} bill matter(s).`,
        results,
      });

      await loadMasterPaymentReceipts();

      resetMasterPaymentPreviewForm();
      setMasterPaymentFormOpen(false);
    } catch (error: any) {
      setMasterPaymentPostResult({
        ok: false,
        error: error?.message || String(error),
      });
    } finally {
      setMasterPaymentPosting(false);
    }
  }

  const [masterSettlementFormOpen, setMasterSettlementFormOpen] = useState(false);
  const [masterSettlementGrossInput, setMasterSettlementGrossInput] = useState("");
  const [masterSettlementWithInput, setMasterSettlementWithInput] = useState("");
  const [masterSettlementDateInput, setMasterSettlementDateInput] = useState(() => masterPaymentTodayInput());
  const [masterSettlementPaymentExpectedDateInput, setMasterSettlementPaymentExpectedDateInput] = useState("");
  const [masterSettlementPrincipalFeePercentInput, setMasterSettlementPrincipalFeePercentInput] = useState("");
  const [masterSettlementInterestAmountInput, setMasterSettlementInterestAmountInput] = useState("");
  const [masterSettlementInterestFeePercentInput, setMasterSettlementInterestFeePercentInput] = useState("");
  const [masterSettlementNotesInput, setMasterSettlementNotesInput] = useState("");

  const [masterInfoEditDialog, setMasterInfoEditDialog] = useState<null | {
    field: string;
    label: string;
    currentValue: string;
  }>(null);
  const [masterInfoEditValue, setMasterInfoEditValue] = useState("");
  const [masterInfoContactSearch, setMasterInfoContactSearch] = useState("");
  const [masterInfoContactResults, setMasterInfoContactResults] = useState<any[]>([]);
  const [masterInfoContactLoading, setMasterInfoContactLoading] = useState(false);
  const [masterInfoSelectedContact, setMasterInfoSelectedContact] = useState<any>(null);
  const masterInfoPrimaryInputRef = useRef<HTMLInputElement | null>(null);
  const [masterInfoOverrides, setMasterInfoOverrides] = useState<Record<string, string>>({});
  const [masterInfoAuditEntries, setMasterInfoAuditEntries] = useState<Array<{
    id: string;
    field: string;
    label: string;
    before: string;
    after: string;
    timestamp: string;
  }>>([]);
  const [masterNoteDialogOpen, setMasterNoteDialogOpen] = useState(false);
  const [masterNoteDraft, setMasterNoteDraft] = useState("");
  const [masterNoteEditingId, setMasterNoteEditingId] = useState<string | null>(null);
  const [masterNoteDeleteTarget, setMasterNoteDeleteTarget] = useState<null | { id: string; note: string }>(null);
  const [masterAuditHistoryOpen, setMasterAuditHistoryOpen] = useState(false);
  const [masterAuditHistoryLoading, setMasterAuditHistoryLoading] = useState(false);
  const [masterAuditHistoryError, setMasterAuditHistoryError] = useState("");
  const [masterAuditHistoryEntries, setMasterAuditHistoryEntries] = useState<any[]>([]);
  const masterNoteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const masterNoteDeleteConfirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const [masterNotes, setMasterNotes] = useState<Array<{
    id: string;
    note: string;
    timestamp: string;
    user: string;
    editedAt?: string;
  }>>([]);

  function masterInfoDisplayValue(field: string, fallback: any): string {
    const override = masterInfoOverrides[field];
    if (override !== undefined) return override || "—";
    return clean(fallback) || "—";
  }

  function masterInfoMoneyNumber(field: string, fallback: any): number {
    const raw = masterInfoDisplayValue(field, fallback);
    const cleaned = String(raw || "").replace(/[^0-9.-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function masterInfoFieldKind(field: string): "contact" | "date" | "money" | "text" {
    if (["provider", "patient", "insurer"].includes(field)) return "contact";
    if (["dateOfLoss", "dateFiled"].includes(field)) return "date";
    if (["filingFee", "serviceFee", "otherCourtCosts"].includes(field)) return "money";

    return "text";
  }

  function masterInfoContactType(field: string): "person" | "company" | "all" {
    if (field === "patient") return "person";
    if (field === "insurer") return "company";

    return "all";
  }

  function formatMasterInfoMoneyInput(value: string): string {
    const cleaned = String(value || "").replace(/[$,\s]/g, "");
    if (!cleaned) return "";
    const n = Number(cleaned);
    return Number.isFinite(n) ? n.toFixed(2) : value;
  }

  function masterInfoDateInputValue(value: any): string {
    const raw = clean(value);
    if (!raw || raw === "—") return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const slashMatch = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (slashMatch) {
      return `${slashMatch[3]}-${slashMatch[1].padStart(2, "0")}-${slashMatch[2].padStart(2, "0")}`;
    }

    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    return "";
  }

  function openMasterInfoEditDialog(field: string, label: string, currentValue: any) {
    const value = masterInfoDisplayValue(field, currentValue);

    setMasterInfoEditDialog({
      field,
      label,
      currentValue: value,
    });

    // The Current box shows the existing value.  The editable field intentionally starts blank.
    setMasterInfoEditValue("");
    setMasterInfoContactSearch("");
    setMasterInfoContactResults([]);
    setMasterInfoSelectedContact(null);
  }

  function closeMasterInfoEditDialog() {
    setMasterInfoEditDialog(null);
    setMasterInfoEditValue("");
    setMasterInfoContactSearch("");
    setMasterInfoContactResults([]);
    setMasterInfoSelectedContact(null);
  }

  useEffect(() => {
    if (!masterInfoEditDialog) return;

    const focusHandle = window.setTimeout(() => {
      masterInfoPrimaryInputRef.current?.focus();
    }, 60);

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      event.preventDefault();
      closeMasterInfoEditDialog();
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.clearTimeout(focusHandle);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [masterInfoEditDialog]);

  async function loadMasterInfoContactSuggestions(queryOverride?: string) {
    if (!masterInfoEditDialog) return;

    const query = clean(queryOverride ?? masterInfoContactSearch);
    if (query.length < 2) {
      setMasterInfoContactResults([]);
      return;
    }

    try {
      setMasterInfoContactLoading(true);

      const type = masterInfoContactType(masterInfoEditDialog.field);
      const response = await fetch(`/api/reference-data/contact-search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}`, {
        cache: "no-store",
      });
      const json = await response.json();

      if (!response.ok || !json?.ok) {
        setMasterInfoContactResults([]);
        return;
      }

      setMasterInfoContactResults(Array.isArray(json.contacts) ? json.contacts : []);
    } catch {
      setMasterInfoContactResults([]);
    } finally {
      setMasterInfoContactLoading(false);
    }
  }

  function selectMasterInfoContact(contact: any) {
    const name = clean(contact?.name);
    if (!name) return;

    setMasterInfoSelectedContact(contact);
    setMasterInfoEditValue(name);
    setMasterInfoContactSearch(name);
    setMasterInfoContactResults([]);

    window.setTimeout(() => {
      masterInfoPrimaryInputRef.current?.focus();
    }, 0);
  }

  function confirmMasterInfoEditDialog() {
    if (!masterInfoEditDialog) return;

    const before = masterInfoEditDialog.currentValue || "—";
    const kind = masterInfoFieldKind(masterInfoEditDialog.field);
    let after = clean(masterInfoEditValue) || "—";

    if (kind === "money") {
      const formatted = formatMasterInfoMoneyInput(masterInfoEditValue);
      after = formatted ? `$${formatted}` : "—";
    }

    const field = masterInfoEditDialog.field;
    const label = masterInfoEditDialog.label;

    setMasterInfoOverrides((prev) => ({
      ...prev,
      [field]: after,
    }));

    setMasterInfoAuditEntries((prev) => [
      {
        id: `${Date.now()}-${field}`,
        field,
        label,
        before,
        after,
        timestamp: new Date().toLocaleString(),
      },
      ...prev,
    ]);

    void writeMasterAuditEntry({
      action: "master_info_updated",
      summary: `${label} changed from ${before} to ${after}`,
      entityType: "master_lawsuit_info",
      fieldName: field,
      priorValue: before,
      newValue: after,
      details: {
        label,
        fieldKind: kind,
        selectedContactId: masterInfoSelectedContact?.id || null,
        selectedContactName: masterInfoSelectedContact?.name || null,
      },
    });

    closeMasterInfoEditDialog();
  }

  function masterNoteUserName(): string {
    return "Dave";
  }

  function masterAuditMatterRows() {
    return rows
      .map((row: any) => {
        const id = Number(row?.id ?? row?.matterId);
        const displayNumber = clean(row?.displayNumber ?? row?.display_number);
        return {
          matterId: Number.isFinite(id) && id > 0 ? id : null,
          displayNumber: displayNumber || null,
          isMaster: !!(row?.isMaster || row?.is_master),
        };
      })
      .filter((row) => row.matterId || row.displayNumber);
  }

  function masterAuditMasterMatterRow() {
    const matterRows = masterAuditMatterRows();
    return matterRows.find((row) => row.isMaster) || matterRows[0] || null;
  }

  function formatMasterAuditValue(value: any): string {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  function formatMasterAuditTimestamp(value: any): string {
    const date = new Date(String(value || ""));
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString();
  }

  async function loadMasterAuditHistory() {
    const masterLawsuitId = clean(value);
    if (kind !== "master" || !masterLawsuitId) return;

    try {
      setMasterAuditHistoryLoading(true);
      setMasterAuditHistoryError("");

      const response = await fetch(
        `/api/audit-log?masterLawsuitId=${encodeURIComponent(masterLawsuitId)}&limit=100`,
        { cache: "no-store" }
      );

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Audit history lookup failed.");
      }

      setMasterAuditHistoryEntries(Array.isArray(json.entries) ? json.entries : []);
    } catch (err: any) {
      setMasterAuditHistoryEntries([]);
      setMasterAuditHistoryError(err?.message || "Audit history lookup failed.");
    } finally {
      setMasterAuditHistoryLoading(false);
    }
  }

  function openReferenceImportsAdmin() {
    const confirmed = window.confirm(
      "ADMIN ACCESS REQUIRED\n\nOpen Reference Data Import?\n\nThis area controls local Barsh Matters reference-data import, import history, cleanup previews, and deactivate-only cleanup tools.\n\nContinue?"
    );

    if (!confirmed) return;

    window.location.href = "/admin/reference-data";
  }

  function openMasterAuditHistoryPopup() {
    setMasterAuditHistoryOpen(true);
    void loadMasterAuditHistory();
  }

  function closeMasterAuditHistoryPopup() {
    setMasterAuditHistoryOpen(false);
    setMasterAuditHistoryError("");
  }

  async function writeMasterAuditEntry(input: {
    action: string;
    summary: string;
    entityType: string;
    fieldName?: string | null;
    priorValue?: any;
    newValue?: any;
    details?: any;
  }) {
    try {
      if (kind !== "master") return;

      const masterLawsuitId = clean(value);
      if (!masterLawsuitId) return;

      const matterRows = masterAuditMatterRows();
      const masterMatter = masterAuditMasterMatterRow();

      const response = await fetch("/api/audit-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          action: input.action,
          summary: input.summary,
          entityType: input.entityType,
          fieldName: input.fieldName || null,
          priorValue: input.priorValue ?? null,
          newValue: input.newValue ?? null,
          details: {
            ...(input.details || {}),
            matterRows,
          },
          affectedMatterIds: matterRows
            .map((row) => row.matterId)
            .filter((id): id is number => Number.isFinite(Number(id)) && Number(id) > 0),
          matterId: masterMatter?.matterId || null,
          matterDisplayNumber: masterMatter?.displayNumber || null,
          masterMatterId: masterMatter?.matterId || null,
          masterMatterDisplayNumber: masterMatter?.displayNumber || null,
          masterLawsuitId,
          sourcePage: "master-lawsuit-page",
          workflow: "master-local-ui",
          actorName: masterNoteUserName(),
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        console.warn("Audit log write failed", response.status, body);
      }
    } catch (err) {
      console.warn("Audit log write failed", err);
    }
  }

  function openMasterNoteDialog(noteEntry?: { id: string; note: string }) {
    setMasterNoteEditingId(noteEntry?.id || null);
    setMasterNoteDraft(noteEntry?.note || "");
    setMasterNoteDialogOpen(true);
  }

  function closeMasterNoteDialog() {
    setMasterNoteDialogOpen(false);
    setMasterNoteDraft("");
    setMasterNoteEditingId(null);
  }

  function saveMasterNote() {
    const note = clean(masterNoteDraft);
    if (!note) return;

    if (masterNoteEditingId) {
      const existingNote = masterNotes.find((entry) => entry.id === masterNoteEditingId);
      const before = existingNote?.note || "";

      setMasterNotes((prev) =>
        prev.map((entry) =>
          entry.id === masterNoteEditingId
            ? {
                ...entry,
                note,
                editedAt: new Date().toLocaleString(),
                user: entry.user || masterNoteUserName(),
              }
            : entry
        )
      );

      void writeMasterAuditEntry({
        action: "master_note_edited",
        summary: "Master lawsuit note edited",
        entityType: "master_lawsuit_note",
        fieldName: "note",
        priorValue: before,
        newValue: note,
        details: {
          noteId: masterNoteEditingId,
        },
      });

      closeMasterNoteDialog();
      return;
    }

    const noteId = `${Date.now()}-note`;

    setMasterNotes((prev) => [
      {
        id: noteId,
        note,
        timestamp: new Date().toLocaleString(),
        user: masterNoteUserName(),
      },
      ...prev,
    ]);

    void writeMasterAuditEntry({
      action: "master_note_added",
      summary: "Master lawsuit note added",
      entityType: "master_lawsuit_note",
      fieldName: "note",
      priorValue: null,
      newValue: note,
      details: {
        noteId,
      },
    });

    closeMasterNoteDialog();
  }

  function requestDeleteMasterNote(noteEntry: { id: string; note: string }) {
    setMasterNoteDeleteTarget({
      id: noteEntry.id,
      note: noteEntry.note,
    });
  }

  function closeDeleteMasterNoteDialog() {
    setMasterNoteDeleteTarget(null);
  }

  function confirmDeleteMasterNote() {
    if (!masterNoteDeleteTarget?.id) return;

    const deletedNote = masterNoteDeleteTarget.note || "";

    setMasterNotes((prev) => prev.filter((entry) => entry.id !== masterNoteDeleteTarget.id));

    void writeMasterAuditEntry({
      action: "master_note_deleted",
      summary: "Master lawsuit note deleted",
      entityType: "master_lawsuit_note",
      fieldName: "note",
      priorValue: deletedNote,
      newValue: null,
      details: {
        noteId: masterNoteDeleteTarget.id,
      },
    });

    setMasterNoteDeleteTarget(null);
  }

  useEffect(() => {
    if (!masterNoteDialogOpen) return;

    const focusHandle = window.setTimeout(() => {
      masterNoteTextareaRef.current?.focus();
    }, 60);

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      event.preventDefault();
      closeMasterNoteDialog();
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.clearTimeout(focusHandle);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [masterNoteDialogOpen]);

  useEffect(() => {
    if (!masterNoteDeleteTarget) return;

    const focusHandle = window.setTimeout(() => {
      masterNoteDeleteConfirmButtonRef.current?.focus();
    }, 60);

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      event.preventDefault();
      closeDeleteMasterNoteDialog();
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.clearTimeout(focusHandle);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [masterNoteDeleteTarget]);


  function masterSettlementMoneyValue(value: string): number {
    const cleaned = String(value || "").replace(/[$,\s]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function masterSettlementGrossValue(): number {
    return masterSettlementMoneyValue(masterSettlementGrossInput);
  }

  function masterSettlementInterestValue(): number {
    return masterSettlementMoneyValue(masterSettlementInterestAmountInput);
  }

  function masterSettlementPercentValue(value: string): number {
    const cleaned = String(value || "").replace(/[%\s]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function formatMasterSettlementMoneyInput(value: string): string {
    const cleaned = String(value || "").replace(/[$,\s]/g, "");
    if (!cleaned) return "";
    const n = Number(cleaned);
    return Number.isFinite(n) ? n.toFixed(2) : value;
  }

  function resetMasterSettlementPreviewForm() {
    setMasterSettlementGrossInput("");
    setMasterSettlementWithInput("");
    setMasterSettlementDateInput(masterPaymentTodayInput());
    setMasterSettlementPaymentExpectedDateInput("");
    setMasterSettlementPrincipalFeePercentInput("");
    setMasterSettlementInterestAmountInput("");
    setMasterSettlementInterestFeePercentInput("");
    setMasterSettlementNotesInput("");
  }

  const masterWorkspaceTabButtonStyle = (tab: MasterWorkspaceTab): React.CSSProperties =>
    activeMasterWorkspaceTab === tab ? masterWorkflowActiveButtonStyle : masterWorkflowButtonStyle;
  const [masterSettlementDraft, setMasterSettlementDraft] = useState({
    settlementBasedOn: "lawsuit_amount",
    feeScheduleAmount: "",
    customAmount: "",
    settledWith: "",
    settlementPercent: "100.00",
    interestPercent: "0.00",
    attorneyFeeMode: "auto",
    customAttorneyFee: "",
    startDate: "",
    endDate: new Date().toISOString().slice(0, 10),
    settlementType: "",
    discontinuanceReason: "",
    notes: "",
  });
  const [masterSettlementBillDrafts, setMasterSettlementBillDrafts] = useState<Record<string, {
    settlementAmount?: string;
    interest?: string;
    attorneyFee?: string;
    filingFee?: string;
  }>>({});

  const totalClaimAmount = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.claimAmount ?? 0) || 0), 0),
    [rows]
  );

  const totalBalancePresuit = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.balancePresuit ?? 0) || 0), 0),
    [rows]
  );

  const masterSettlementPercentNumber = Number(masterSettlementDraft.settlementPercent || 0) || 0;
  const masterInterestPercentNumber = Number(masterSettlementDraft.interestPercent || 0) || 0;

  const masterSettlementSelectedBaseAmount = useMemo(() => {
    if (masterSettlementDraft.settlementBasedOn === "fee_schedule_amount") {
      return parseMoneyDraft(masterSettlementDraft.feeScheduleAmount);
    }

    if (masterSettlementDraft.settlementBasedOn === "custom_amount") {
      return parseMoneyDraft(masterSettlementDraft.customAmount);
    }

    return totalBalancePresuit;
  }, [
    masterSettlementDraft.settlementBasedOn,
    masterSettlementDraft.feeScheduleAmount,
    masterSettlementDraft.customAmount,
    totalBalancePresuit,
  ]);

  const masterSettlementInterestDays = useMemo(() => {
    if (!masterSettlementDraft.startDate || !masterSettlementDraft.endDate) return 0;

    const start = new Date(`${masterSettlementDraft.startDate}T00:00:00`);
    const end = new Date(`${masterSettlementDraft.endDate}T00:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  }, [masterSettlementDraft.startDate, masterSettlementDraft.endDate]);

  const masterAttorneyFeeMaxAmount = 1360;
  const masterAttorneyFeeAmount =
    masterSettlementDraft.attorneyFeeMode === "custom"
      ? parseMoneyDraft(masterSettlementDraft.customAttorneyFee)
      : masterAttorneyFeeMaxAmount;

  const masterSettlementDetailRows = useMemo(() => {
    return rows.map((row, index) => {
      const id = clean(row.id);
      const claimAmount = Number(row.claimAmount ?? 0) || 0;
      const balancePresuit = Number(row.balancePresuit ?? 0) || 0;
      const allocationRatio = totalBalancePresuit > 0 ? balancePresuit / totalBalancePresuit : 0;
      const isFirstSettlementBill = index === 0;
      const baseAmount =
        masterSettlementDraft.settlementBasedOn === "lawsuit_amount"
          ? balancePresuit
          : masterSettlementSelectedBaseAmount * allocationRatio;

      const defaultSettlementAmount = (baseAmount * masterSettlementPercentNumber) / 100;
      const defaultInterest = (defaultSettlementAmount * masterInterestPercentNumber) / 100;
      const draft = masterSettlementBillDrafts[id] || {};

      const settlementAmount =
        draft.settlementAmount !== undefined
          ? parseMoneyDraft(draft.settlementAmount)
          : defaultSettlementAmount;
      const interest =
        draft.interest !== undefined
          ? parseMoneyDraft(draft.interest)
          : defaultInterest;
      const attorneyFee = isFirstSettlementBill
        ? draft.attorneyFee !== undefined
          ? parseMoneyDraft(draft.attorneyFee)
          : masterAttorneyFeeAmount
        : 0;
      const filingFee = isFirstSettlementBill
        ? draft.filingFee !== undefined
          ? parseMoneyDraft(draft.filingFee)
          : 0
        : 0;
      const settlementTotal = settlementAmount + interest + attorneyFee + filingFee;

      return {
        ...row,
        billAmount: balancePresuit,
        claimAmount,
        baseAmount,
        settlementAmount,
        interest,
        attorneyFee,
        filingFee,
        settlementTotal,
        isFirstSettlementBill,
      };
    });
  }, [
    rows,
    totalBalancePresuit,
    masterSettlementDraft.settlementBasedOn,
    masterSettlementSelectedBaseAmount,
    masterSettlementPercentNumber,
    masterInterestPercentNumber,
    masterSettlementBillDrafts,
    masterAttorneyFeeAmount,
  ]);

  const masterSettlementSummary = useMemo(() => {
    return masterSettlementDetailRows.reduce(
      (acc, row: any) => {
        acc.baseAmount += Number(row.baseAmount ?? 0) || 0;
        acc.settlementAmount += Number(row.settlementAmount ?? 0) || 0;
        acc.interest += Number(row.interest ?? 0) || 0;
        acc.attorneyFee += Number(row.attorneyFee ?? 0) || 0;
        acc.filingFee += Number(row.filingFee ?? 0) || 0;
        acc.settlementTotal += Number(row.settlementTotal ?? 0) || 0;
        return acc;
      },
      {
        baseAmount: 0,
        settlementAmount: 0,
        interest: 0,
        attorneyFee: 0,
        filingFee: 0,
        settlementTotal: 0,
      }
    );
  }, [masterSettlementDetailRows]);

  const masterPaymentSummary = useMemo(() => {
    const billRows = masterWorkspaceBillRows(masterSettlementDetailRows);
    const lawsuitAmount = masterWorkspaceBillTotal(masterSettlementDetailRows);

    const paymentsPosted = billRows.reduce(
      (sum: number, row: any) => sum + (Number(row?.paymentVoluntary ?? row?.payment_voluntary ?? 0) || 0),
      0
    );

    return {
      lawsuitAmount,
      paymentsPosted,
      balancePresuit: Math.max(lawsuitAmount - paymentsPosted, 0),
      billCount: billRows.length,
    };
  }, [masterSettlementDetailRows]);

  useEffect(() => {
    if (kind !== "master" || activeMasterWorkspaceTab !== "payments") return;
    void loadMasterPaymentReceipts();
  }, [kind, activeMasterWorkspaceTab, masterSettlementDetailRows]);


  const masterInsurerSummary = useMemo(() => {
    const insurers = Array.from(
      new Set(rows.map((row) => clean(row.insurer)).filter(Boolean))
    );

    if (insurers.length === 0) return "—";
    if (insurers.length === 1) return insurers[0];

    return `${insurers[0]} + ${insurers.length - 1} more`;
  }, [rows]);

  const masterClaimSummary = useMemo(() => {
    const claims = Array.from(
      new Set(rows.map((row) => clean(row.claimNumber)).filter(Boolean))
    );

    if (claims.length === 0) {
      return { label: "—", href: "" };
    }

    return {
      label: claims.length === 1 ? claims[0] : `${claims[0]} + ${claims.length - 1} more`,
      href: filteredUrl("claim", claims[0]),
    };
  }, [rows]);

  const masterServiceTypeSummary = useMemo(() => {
    const serviceTypes = Array.from(
      new Set(rows.map((row: any) => clean(row.serviceType || row.service_type)).filter(Boolean))
    );

    if (serviceTypes.length === 0) return "—";
    if (serviceTypes.length === 1) return serviceTypes[0];

    return `${serviceTypes[0]} + ${serviceTypes.length - 1} more`;
  }, [rows]);

  const masterTreatingProviderSummary = useMemo(() => {
    const treatingProviders = Array.from(
      new Set(rows.map((row: any) => clean(row.treatingProvider || row.treating_provider)).filter(Boolean))
    );

    if (treatingProviders.length === 0) return "—";
    if (treatingProviders.length === 1) return treatingProviders[0];

    return `${treatingProviders[0]} + ${treatingProviders.length - 1} more`;
  }, [rows]);

  const masterDateOfLossSummary = useMemo(() => {
    const datesOfLoss = Array.from(
      new Set(rows.map((row: any) => clean(row.dateOfLoss || row.date_of_loss || row.lossDate || row.loss_date)).filter(Boolean))
    );

    if (datesOfLoss.length === 0) return "—";
    if (datesOfLoss.length === 1) return datesOfLoss[0];

    return `${datesOfLoss[0]} + ${datesOfLoss.length - 1} more`;
  }, [rows]);

  function updateMasterSettlementBillDraft(rowId: string, field: "settlementAmount" | "interest" | "attorneyFee" | "filingFee", value: string) {
    setMasterSettlementBillDrafts((prev) => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] || {}),
        [field]: value,
      },
    }));
  }

  useEffect(() => {
    if (!masterInfoEditDialog || masterInfoFieldKind(masterInfoEditDialog.field) !== "contact") return;

    const query = clean(masterInfoContactSearch);
    if (query.length < 2) {
      setMasterInfoContactResults([]);
      return;
    }

    const handle = window.setTimeout(() => {
      loadMasterInfoContactSuggestions(query);
    }, 250);

    return () => window.clearTimeout(handle);
  }, [masterInfoContactSearch, masterInfoEditDialog]);

  useEffect(() => {
    async function load() {
      const filter = getFilterFromUrl();
      const workflow = getWorkflowFromUrl();

      setKind(filter.kind);
      setWorkflowKind(workflow);
      setValue(filter.value);
      setLoading(true);
      setError("");
      setRows([]);

      try {
        if (!filter.kind || !filter.value) {
          throw new Error("Missing patient, provider, or claim filter.");
        }

        const url =
          filter.kind === "patient"
            ? `/api/claim-index/search?patient=${encodeURIComponent(filter.value)}`
            : filter.kind === "provider"
              ? `/api/claim-index/search?provider=${encodeURIComponent(filter.value)}`
              : filter.kind === "treatingProvider"
                ? `/api/matters/identity-field/search?fieldName=treating_provider&value=${encodeURIComponent(filter.value)}`
                : filter.kind === "insurer"
                  ? `/api/claim-index/search?insurer=${encodeURIComponent(filter.value)}`
                  : filter.kind === "master"
                    ? `/api/claim-index/by-master?masterLawsuitId=${encodeURIComponent(filter.value)}`
                    : `/api/claim-index/search?claim=${encodeURIComponent(filter.value)}`;

        const rawRows = await fetchRows(url);
        const mapped: MatterRow[] = [];

        for (const row of rawRows) {
          if (filter.kind === "patient" && !exactOrContains(patientName(row), filter.value)) continue;
          if (filter.kind === "provider" && !exactOrContains(providerName(row), filter.value)) continue;
          if (filter.kind === "treatingProvider" && !exactOrContains(treatingProviderName(row), filter.value)) continue;
          if (filter.kind === "insurer" && !exactOrContains(insurerName(row), filter.value)) continue;
          if (filter.kind === "claim" && !exactOrContains(claimNumberFromMatter(row), filter.value)) continue;

          const mappedRow = toMatterRow(row, filterLabel(filter.kind));
          if (mappedRow) mapped.push(mappedRow);
        }

        setRows(dedupe(mapped));
      } catch (e: any) {
        setError(e?.message || "Filtered matters lookup failed.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <section style={topBarStyle}>
          <div style={leftLogoWrapStyle}>
            <img src="/brl-logo.png" alt="BRL Logo" style={brlLogoStyle} />
            <div style={{ paddingTop: 8 }}>
              <BarshHeaderQuickNav />
            </div>
          </div>

            {kind === "master" && value && (
              <div
                style={{
                  gridColumn: 2,
                  justifySelf: "center",
                  alignSelf: "center",
                  display: "grid",
                  justifyItems: "center",
                  gap: 8,
                  textAlign: "center",
                  minWidth: 320,
                  paddingTop: 24,
                }}
              >
                <div
                  style={{
                    color: "#0f172a",
                    fontSize: 34,
                    lineHeight: 1.05,
                    fontWeight: 950,
                    letterSpacing: "-0.01em",
                    whiteSpace: "nowrap",
                    display: "grid",
                    justifyItems: "center",
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      justifySelf: "center",
                      padding: "12px 24px",
                      border: "2px solid #16a34a",
                      borderRadius: 999,
                      background: "#dcfce7",
                      color: "#14532d",
                      fontSize: 34,
                      lineHeight: 1,
                      fontWeight: 950,
                      letterSpacing: "-0.01em",
                      whiteSpace: "nowrap",
                      boxShadow: "0 10px 30px rgba(22, 163, 74, 0.18)",
                    }}
                  >
                    {value}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      justifySelf: "center",
                      marginTop: 6,
                      padding: "4px 12px",
                      borderRadius: 999,
                      background: "#16a34a",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 950,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      boxShadow: "0 4px 12px rgba(22, 163, 74, 0.25)",
                    }}
                  >
                    Open
                  </span>

                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "7px 11px",
                      border: "1px solid transparent",
                      borderRadius: 999,
                      background: "transparent",
                      color: "transparent",
                      fontSize: 12,
                      fontWeight: 900,
                      whiteSpace: "nowrap",
                      textDecoration: "none",
                      visibility: "hidden",
                      pointerEvents: "none",
                    }}
                  >
                    <span>MASTER LAWSUIT ID:</span>
                    <span>0000.00.00000</span>
                  </span>
                </div>

              </div>
            )}

<div style={rightTopWrapStyle}>
            <div style={printButtonRowStyle}>
              <button
                type="button"
                onClick={openReferenceImportsAdmin}
                title="Admin access required. Open Reference Data Import."
                style={{
                  ...lockedPrintQueueButtonStyle,
                  cursor: "pointer",
                  opacity: 1,
                }}
              >
                <span aria-hidden="true">🔐</span>
                <span>Import</span>
              </button>

              <button
                type="button"
                onClick={openMasterAuditHistoryPopup}
                title="Open matter-specific Audit / History log."
                style={{
                  ...lockedPrintQueueButtonStyle,
                  cursor: "pointer",
                  opacity: 1,
                }}
              >
                <span aria-hidden="true">📜</span>
                <span>Audit / History</span>
              </button>

              <button
                type="button"
                disabled
                aria-disabled="true"
                title="Print Queue access is locked unless the user has print-queue rights."
                style={lockedPrintQueueButtonStyle}
              >
                <span aria-hidden="true">🔒</span>
                <span>Print Queue</span>
              </button>
            </div>

            <a href="/" style={bmLogoLinkStyle} title="Return to Barsh Matters entry screen">
              <img src="/barsh-matters-cropped-transparent.png" alt="Barsh Matters Logo" style={bmLogoStyle} />
            </a>
          </div>
        </section>

        <style jsx global>{`
          .barsh-filter-row:hover td {
            background: #f8fbff !important;
          }

          .barsh-filter-field-link:hover {
            color: #1e3a8a !important;
            text-decoration-thickness: 2px !important;
          }

          .barsh-filter-open-link:hover,
          .barsh-filter-new-search:hover {
            background: #eff6ff !important;
            border-color: #93b4e8 !important;
            transform: translateY(-1px);
          }
        `}</style>

        <section style={kind === "master" && activeMasterWorkspaceTab === "payments" ? { ...summaryPanelStyle, display: "none" } : summaryPanelStyle}>
          <div>
            <div style={eyebrowStyle}>
              {kind === "master" ? "BARSH MATTERS MASTER LAWSUIT SUMMARY" : "BARSH MATTERS FILTERED RESULTS"}
            </div>
            {kind && value && (
              <div
                style={
                  kind === "master"
                    ? {
                        ...filterBadgeStyle,
                        borderColor: "#bfdbfe",
                        background: "#eff6ff",
                        color: "#1e3a8a",
                      }
                    : filterBadgeStyle
                }
              >
                {kind === "master" ? "Master Lawsuit Workspace" : `${filterLabel(kind)} Filter`}
              </div>
            )}
            {kind === "master" ? (
              <div style={masterSummaryGridStyle}>
                <div style={masterSummaryItemStyle}>
                  <span>Insurer</span>
                  <strong>{masterInfoDisplayValue("insurer", masterInsurerSummary)}</strong>
                </div>
                <div style={masterSummaryItemStyle}>
                  <span>Claim Number</span>
                  <strong>
                    {masterClaimSummary.href ? (
                      <a
                        href={masterClaimSummary.href}
                        className="barsh-filter-field-link"
                        style={fieldLinkStyle}
                      >
                        {masterInfoDisplayValue("claimNumber", masterClaimSummary.label)}
                      </a>
                    ) : (
                      "—"
                    )}
                  </strong>
                </div>
                <div style={masterSummaryItemStyle}>
                  <span>Service Type</span>
                  <strong>{masterServiceTypeSummary}</strong>
                </div>
                <div style={masterSummaryItemStyle}>
                  <span>Treating Provider</span>
                  <strong>{masterInfoDisplayValue("provider", masterTreatingProviderSummary)}</strong>
                </div>
                <div style={masterSummaryItemStyle}>
                  <span>Date of Loss</span>
                  <strong>{masterDateOfLossSummary}</strong>
                </div>
                <div style={masterSummaryItemStyle}>
                  <span>Index / AAA Number</span>
                  <strong>—</strong>
                </div>
                <div style={masterSummaryItemStyle}>
                  <span>Court</span>
                  <strong>—</strong>
                </div>
                <div style={masterSummaryItemStyle}>
                  <span>Date Filed</span>
                  <strong>—</strong>
                </div>
                <div style={masterSummaryItemStyle}>
                  <span>Lawsuit Amount</span>
                  <strong>{money(masterWorkspaceBillTotal(masterSettlementDetailRows))}</strong>
                </div>
                <div style={masterSummaryItemStyle}>
                  <span>Court Costs</span>
                  <strong>$0.00</strong>
                </div>
              </div>
            ) : (
              <>
                <h1 style={titleStyle}>{workflowTitle(workflowKind, kind, value)}</h1>
                <div style={subTitleStyle}>
                  {loading ? "Loading matching matters..." : `${rows.length} matching matter${rows.length === 1 ? "" : "s"} found.`}
                </div>
              </>
            )}

            {workflowKind && (
              <div style={workflowBannerStyle}>
                <div>
                  <div style={workflowBannerEyebrowStyle}>
                    {workflowKind === "patient" ? "Launched Patient Workflow" : "Launched Claim Workflow"}
                  </div>
                  <div style={workflowBannerTextStyle}>{workflowNote(workflowKind)}</div>
                </div>
                <div style={workflowBannerPillStyle}>
                  Review · Open · Route
                </div>
              </div>
            )}
          </div>

          {kind !== "master" && (
            <div style={summaryStatsStyle}>
              <div style={statBoxStyle}>
                <span style={statLabelStyle}>Claim Amount</span>
                <strong>{money(totalClaimAmount)}</strong>
              </div>
              <div style={statBoxStyle}>
                <span style={statLabelStyle}>Balance (Presuit)</span>
                <strong>{money(totalBalancePresuit)}</strong>
              </div>
              <a href="/" className="barsh-filter-new-search" style={backButtonStyle}>New Search</a>
            </div>
          )}
        </section>

        {kind === "master" && activeMasterWorkspaceTab === "settlement" && (
          <section style={masterSettlementPanelStyle}>

            <div style={masterSettlementTopStripStyle}>
              <div style={masterSettlementBasisGroupStyle}>
                <div style={masterSettlementRadioLineStyle}>
                  <span style={masterSettlementRadioLabelStyle}>Settlement Based On:</span>

                  <label style={masterSettlementInlineOptionStyle}>
                    <input
                      type="radio"
                      name="master-settlement-based-on"
                      checked={masterSettlementDraft.settlementBasedOn === "lawsuit_amount"}
                      onChange={() => {
                        setMasterSettlementDraft((prev) => ({ ...prev, settlementBasedOn: "lawsuit_amount" }));
                        setMasterSettlementBillDrafts({});
                      }}
                    />
                    <span>Lawsuit Amount ({money(totalBalancePresuit)})</span>
                  </label>

                  <label style={masterSettlementInlineOptionStyle}>
                    <input
                      type="radio"
                      name="master-settlement-based-on"
                      checked={masterSettlementDraft.settlementBasedOn === "fee_schedule_amount"}
                      onChange={() => {
                        setMasterSettlementDraft((prev) => ({ ...prev, settlementBasedOn: "fee_schedule_amount" }));
                        setMasterSettlementBillDrafts({});
                      }}
                    />
                    <span>Fee Schedule Amount</span>
                  </label>

                  <input
                    type="text"
                    value={masterSettlementDraft.feeScheduleAmount}
                    onChange={(e) => {
                      setMasterSettlementDraft((prev) => ({
                        ...prev,
                        feeScheduleAmount: e.target.value,
                        settlementBasedOn: "fee_schedule_amount",
                      }));
                      setMasterSettlementBillDrafts({});
                    }}
                    placeholder="$0.00"
                    style={masterSettlementBasisAmountInputStyle}
                  />

                  <label style={masterSettlementInlineOptionStyle}>
                    <input
                      type="radio"
                      name="master-settlement-based-on"
                      checked={masterSettlementDraft.settlementBasedOn === "custom_amount"}
                      onChange={() => {
                        setMasterSettlementDraft((prev) => ({ ...prev, settlementBasedOn: "custom_amount" }));
                        setMasterSettlementBillDrafts({});
                      }}
                    />
                    <span>Custom Amount</span>
                  </label>

                  <input
                    type="text"
                    value={masterSettlementDraft.customAmount}
                    onChange={(e) => {
                      setMasterSettlementDraft((prev) => ({
                        ...prev,
                        customAmount: e.target.value,
                        settlementBasedOn: "custom_amount",
                      }));
                      setMasterSettlementBillDrafts({});
                    }}
                    placeholder="$0.00"
                    style={masterSettlementBasisAmountInputStyle}
                  />
                </div>
              </div>
            </div>

            <div style={masterSettlementTermBoxStyle}>
              <div style={masterSettlementTermTitleStyle}>Settlement Terms</div>

              <div style={masterSettlementTermGridStyle}>
                <div style={masterSettlementFieldStyle}>
                  <label style={masterSettlementFieldLabelStyle}>Settled With</label>
                  <select
                    value={masterSettlementDraft.settledWith}
                    onChange={(e) => setMasterSettlementDraft((prev) => ({ ...prev, settledWith: e.target.value }))}
                    style={masterSettlementSelectStyle}
                  >
                    <option value="">Please select</option>
                    <option value="placeholder-person-contact">Clio Person Contact — to be wired</option>
                  </select>
                </div>

                <div style={masterSettlementFieldStyle}>
                  <label style={masterSettlementFieldLabelStyle}>Settlement %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={masterSettlementDraft.settlementPercent}
                    onChange={(e) => {
                      setMasterSettlementDraft((prev) => ({ ...prev, settlementPercent: e.target.value }));
                      setMasterSettlementBillDrafts({});
                    }}
                    style={masterSettlementInputStyle}
                  />
                </div>

                <div style={masterSettlementFieldStyle}>
                  <label style={masterSettlementFieldLabelStyle}>Interest %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={masterSettlementDraft.interestPercent}
                    onChange={(e) => {
                      setMasterSettlementDraft((prev) => ({ ...prev, interestPercent: e.target.value }));
                      setMasterSettlementBillDrafts({});
                    }}
                    style={masterSettlementInputStyle}
                  />
                </div>

                <div style={masterSettlementFieldStyle}>
                  <label style={masterSettlementFieldLabelStyle}>Start Date</label>
                  <input
                    type="date"
                    value={masterSettlementDraft.startDate}
                    onChange={(e) => setMasterSettlementDraft((prev) => ({ ...prev, startDate: e.target.value }))}
                    style={masterSettlementInputStyle}
                  />
                </div>

                <div style={masterSettlementFieldStyle}>
                  <label style={masterSettlementFieldLabelStyle}>End Date</label>
                  <input
                    type="date"
                    value={masterSettlementDraft.endDate}
                    onChange={(e) => setMasterSettlementDraft((prev) => ({ ...prev, endDate: e.target.value }))}
                    style={masterSettlementInputStyle}
                  />
                </div>

                <div style={masterSettlementFieldStyle}>
                  <label style={masterSettlementFieldLabelStyle}>Interest Days</label>
                  <div style={masterSettlementReadOnlyFieldStyle}>
                    {masterSettlementInterestDays.toLocaleString("en-US")}
                  </div>
                </div>

                <div style={masterSettlementFieldStyle}>
                  <label style={masterSettlementFieldLabelStyle}>Settlement Type</label>
                  <select
                    value={masterSettlementDraft.settlementType}
                    onChange={(e) => setMasterSettlementDraft((prev) => ({ ...prev, settlementType: e.target.value }))}
                    style={masterSettlementSelectStyle}
                  >
                    <option value="">Select...</option>
                    <option value="bulk">Bulk</option>
                    <option value="lien">Lien</option>
                  </select>
                </div>

                <div style={masterSettlementFieldStyle}>
                  <label style={masterSettlementFieldLabelStyle}>Discontinuance Reason</label>
                  <select
                    value={masterSettlementDraft.discontinuanceReason}
                    onChange={(e) => setMasterSettlementDraft((prev) => ({ ...prev, discontinuanceReason: e.target.value }))}
                    style={masterSettlementSelectStyle}
                  >
                    <option value="">Select...</option>
                    <option value="duplicate-lawsuit">Duplicate lawsuit</option>
                    <option value="fraud">Fraud</option>
                    <option value="ime-no-show">IME No-Show</option>
                    <option value="incorrect-carrier">Incorrect carrier</option>
                    <option value="material-misrepresentation">Material Misrepresentation</option>
                    <option value="motorcycle">Motorcycle</option>
                    <option value="paid-in-full">Paid in full</option>
                    <option value="paid-per-fee-schedule">Paid per fee schedule</option>
                    <option value="policy-canceled">Policy canceled</option>
                    <option value="policy-exhausted">Policy exhausted</option>
                  </select>
                </div>

                <div style={{ ...masterSettlementFieldStyle, gridColumn: "span 2" }}>
                  <label style={masterSettlementFieldLabelStyle}>Notes</label>
                  <textarea
                    value={masterSettlementDraft.notes}
                    onChange={(e) => setMasterSettlementDraft((prev) => ({ ...prev, notes: e.target.value }))}
                    style={masterSettlementTextareaStyle}
                  />
                </div>
              </div>

              <div style={masterSettlementTermFootnoteStyle}>
                Start Date will default to the lawsuit filing date once that metadata is wired.  End Date currently defaults to today.  All fields on this shell are local-only.
              </div>
            </div>

            <div style={masterSettlementDetailsBoxStyle}>
              <div style={masterSettlementSummaryPanelStyle}>
                <div style={masterSettlementSummaryHeaderStyle}>
                  <div style={masterSettlementSummaryPillStyle}>
                    {masterSettlementDetailRows.length.toLocaleString("en-US")} Bill{masterSettlementDetailRows.length === 1 ? "" : "s"}
                  </div>
                </div>

                <div style={masterSettlementSummaryGridStyle}>
                  <div style={masterSettlementSummaryItemStyle}>
                    <span>Lawsuit Amount</span>
                    <strong style={masterSettlementSummaryValueStyle}>{money(masterWorkspaceBillTotal(masterSettlementDetailRows))}</strong>
                  </div>
                  <div style={masterSettlementSummaryItemStyle}>
                    <span>Settled Principal</span>
                    <strong style={masterSettlementSummaryValueStyle}>{money(masterSettlementSummary.settlementAmount)}</strong>
                  </div>
                  <div style={masterSettlementSummaryItemStyle}>
                    <span>Settled Interest</span>
                    <strong style={masterSettlementSummaryValueStyle}>{money(masterSettlementSummary.interest)}</strong>
                  </div>
                  <div style={masterSettlementSummaryItemStyle}>
                    <span>Attorney Fee</span>
                    <strong style={masterSettlementSummaryValueStyle}>{money(masterSettlementSummary.attorneyFee)}</strong>
                    <div style={masterSettlementAttorneyFeeControlStyle}>
                      <label style={masterSettlementSmallRadioStyle}>
                        <input
                          type="radio"
                          name="master-attorney-fee-mode"
                          checked={masterSettlementDraft.attorneyFeeMode === "max"}
                          onChange={() => {
                            setMasterSettlementDraft((prev) => ({
                              ...prev,
                              attorneyFeeMode: "max",
                            }));
                            setMasterSettlementBillDrafts({});
                          }}
                        />
                        <span>Max ({money(masterAttorneyFeeMaxAmount)})</span>
                      </label>

                      <label style={masterSettlementSmallRadioStyle}>
                        <input
                          type="radio"
                          name="master-attorney-fee-mode"
                          checked={masterSettlementDraft.attorneyFeeMode === "custom"}
                          onChange={() => {
                            setMasterSettlementDraft((prev) => ({
                              ...prev,
                              attorneyFeeMode: "custom",
                            }));
                            setMasterSettlementBillDrafts({});
                          }}
                        />
                        <span>Custom</span>
                        <input
                          type="text"
                          value={masterSettlementDraft.customAttorneyFee}
                          onChange={(e) => {
                            setMasterSettlementDraft((prev) => ({
                              ...prev,
                              customAttorneyFee: e.target.value,
                              attorneyFeeMode: "custom",
                            }));
                            setMasterSettlementBillDrafts({});
                          }}
                          placeholder="$0.00"
                          style={masterSettlementAttorneyFeeInputStyle}
                        />
                      </label>
                    </div>
                  </div>
                  <div style={masterSettlementSummaryItemStyle}>
                    <span>Index Fee</span>
                    <strong style={masterSettlementSummaryValueStyle}>{money(masterSettlementSummary.filingFee)}</strong>
                  </div>
                  <div style={masterSettlementSummaryItemStyle}>
                    <span>Settlement Total</span>
                    <strong style={masterSettlementSummaryValueStyle}>{money(masterSettlementSummary.settlementTotal)}</strong>
                  </div>
                </div>
              </div>

              <div style={masterSettlementDetailsTitleStyle}>Settlement Details</div>

              <div style={masterSettlementTableWrapStyle}>
                <table style={masterSettlementTableStyle}>
                  <thead>
                    <tr>
                      <th style={masterSettlementThStyle}>Matter</th>
                      <th style={masterSettlementThStyle}>Provider</th>
                      <th style={masterSettlementThStyle}>Patient</th>
                      <th style={masterSettlementRightThStyle}>Bill Amount</th>
                      <th style={masterSettlementRightThStyle}>Settled Principal</th>
                      <th style={masterSettlementRightThStyle}>Settled Interest</th>
                      <th style={masterSettlementRightThStyle}>Attorney Fee</th>
                      <th style={masterSettlementRightThStyle}>Index Fee</th>
                      <th style={masterSettlementRightThStyle}>Settlement Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {masterWorkspaceBillRows(masterSettlementDetailRows).map((row: any) => {
                      const rowId = clean(row.id);
                      const rowDraft = masterSettlementBillDrafts[rowId] || {};

                      return (
                        <tr key={rowId}>
                          <td style={masterSettlementTdStyle}>
                            <a href={`/matter/${encodeURIComponent(clean(row.displayNumber) || clean(row.display_number) || rowId)}`} style={matterLinkStyle}>
                              {clean(row.displayNumber) || rowId}
                            </a>
                          </td>
                          <td style={masterSettlementTdStyle}>
                            {clean(row.provider) ? (
                              <a
                                href={filteredUrl("provider", row.provider)}
                                className="barsh-filter-field-link"
                                style={fieldLinkStyle}
                              >
                                {clean(row.provider)}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td style={masterSettlementTdStyle}>
                            {clean(row.patient) ? (
                              <a
                                href={filteredUrl("patient", row.patient)}
                                className="barsh-filter-field-link"
                                style={fieldLinkStyle}
                              >
                                {clean(row.patient)}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td style={masterSettlementMoneyTdStyle}>{money(masterWorkspaceBillAmount(row))}</td>
                          <td style={masterSettlementInputTdStyle}>
                            <input
                              value={rowDraft.settlementAmount ?? moneyDraft(row.settlementAmount)}
                              onChange={(e) => updateMasterSettlementBillDraft(rowId, "settlementAmount", e.target.value)}
                              style={masterSettlementMoneyInputStyle}
                            />
                          </td>
                          <td style={masterSettlementInputTdStyle}>
                            <input
                              value={rowDraft.interest ?? moneyDraft(row.interest)}
                              onChange={(e) => updateMasterSettlementBillDraft(rowId, "interest", e.target.value)}
                              style={masterSettlementMoneyInputStyle}
                            />
                          </td>
                          <td style={masterSettlementInputTdStyle}>
                            {row.isFirstSettlementBill ? (
                              <input
                                value={rowDraft.attorneyFee ?? moneyDraft(row.attorneyFee)}
                                onChange={(e) => updateMasterSettlementBillDraft(rowId, "attorneyFee", e.target.value)}
                                style={masterSettlementMoneyInputStyle}
                              />
                            ) : (
                              <span style={masterSettlementNotAppliedStyle}>--</span>
                            )}
                          </td>
                          <td style={masterSettlementInputTdStyle}>
                            {row.isFirstSettlementBill ? (
                              <input
                                value={rowDraft.filingFee ?? moneyDraft(row.filingFee)}
                                onChange={(e) => updateMasterSettlementBillDraft(rowId, "filingFee", e.target.value)}
                                style={masterSettlementMoneyInputStyle}
                              />
                            ) : (
                              <span style={masterSettlementNotAppliedStyle}>--</span>
                            )}
                          </td>
                          <td style={masterSettlementMoneyTdStyle}>{money(row.settlementTotal)}</td>
                        </tr>
                      );
                    })}

                    <tr style={masterSettlementTotalRowStyle}>
                      <td style={masterSettlementTdStyle}>Total</td>
                      <td style={masterSettlementTdStyle}></td>
                      <td style={masterSettlementTdStyle}></td>
                      <td style={masterSettlementMoneyTdStyle}>{money(masterWorkspaceBillTotal(masterSettlementDetailRows))}</td>
                      <td style={masterSettlementMoneyTdStyle}>{money(masterSettlementSummary.settlementAmount)}</td>
                      <td style={masterSettlementMoneyTdStyle}>{money(masterSettlementSummary.interest)}</td>
                      <td style={masterSettlementMoneyTdStyle}>{money(masterSettlementSummary.attorneyFee)}</td>
                      <td style={masterSettlementMoneyTdStyle}>{money(masterSettlementSummary.filingFee)}</td>
                      <td style={masterSettlementMoneyTdStyle}>{money(masterSettlementSummary.settlementTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={masterSettlementActionRowStyle}>
                <button type="button" disabled style={masterSettlementGhostButtonStyle}>
                  Calculate Simple Interest
                </button>
                <button type="button" disabled style={masterSettlementGhostButtonStyle}>
                  Calculate Compound Interest
                </button>
                <button type="button" disabled style={masterSettlementPrimaryButtonStyle}>
                  Finalize Settlement
                </button>
              </div>

              <div style={masterSettlementTermFootnoteStyle}>
                This is a visual/local draft only.  It does not run Clio contact search, settlement preview, writeback, document generation, or Close Paid Settlements.
              </div>

            </div>
          </section>
        )}

        {kind === "master" && activeMasterWorkspaceTab !== "settlement" && (
          <section style={masterWorkspacePanelStyle}>

            {activeMasterWorkspaceTab !== "payments" && (
              <>
                <div style={masterWorkspacePanelHeaderStyle}>
                  <div>
                    <div style={masterWorkspacePanelEyebrowStyle}>Active Workspace</div>
                    <h2 style={masterWorkspacePanelTitleStyle}>
                      {activeMasterWorkspaceTab === "documents" ? "Documents" : "Close Paid Settlements"}
                    </h2>
                  </div>
                  <div style={masterWorkspacePanelPillStyle}>Read-only preview shell</div>
                </div>

                <div style={masterWorkspaceCardsStyle}>
                  <div style={masterWorkspaceCardStyle}>
                    <div style={masterWorkspaceCardLabelStyle}>Purpose</div>
                    <div style={masterWorkspaceCardTextStyle}>
                      {activeMasterWorkspaceTab === "documents"
                        ? "Centralize Master Lawsuit packet preview, finalization, Clio upload, and print-queue controls."
                        : "Review paid settlement eligibility and close only confirmed paid settlement matters from the Master Lawsuit screen."}
                    </div>
                  </div>

                  <div style={masterWorkspaceCardStyle}>
                    <div style={masterWorkspaceCardLabelStyle}>Safety</div>
                    <div style={masterWorkspaceCardTextStyle}>
                      {activeMasterWorkspaceTab === "documents"
                        ? "Document controls will stay separated between preview, finalization, Clio upload, and print queue."
                        : "Close actions will remain payment-confirmed only, preview-first, and limited to eligible child/bill matters."}
                    </div>
                  </div>

                  <div style={masterWorkspaceCardStyle}>
                    <div style={masterWorkspaceCardLabelStyle}>Next UI Step</div>
                    <div style={masterWorkspaceCardTextStyle}>
                      {activeMasterWorkspaceTab === "documents"
                        ? "Move the existing read-only packet preview shell into this Documents workspace."
                        : "Move settlement close preview into this Close Paid Settlements workspace."}
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeMasterWorkspaceTab === "payments" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) 520px",
                  gap: 16,
                  alignItems: "start",
                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gap: 14,
                    alignItems: "start",
                  }}
                >
                  <section
                    style={{
                      display: "grid",
                      gap: 10,
                      padding: 12,
                      borderTop: "1px solid #cbd5e1",
                      borderBottom: "1px solid #cbd5e1",
                      borderLeft: "none",
                      borderRight: "none",
                      borderRadius: 0,
                      background: "#f8fafc",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 950,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#1e3a8a",
                      }}
                    >
                      Claim Information
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                        gap: 12,
                        alignItems: "stretch",
                      }}
                    >
                      <div style={masterInfoCardStyle}>
                        <span style={masterSummaryCardTitleStyle}>Provider</span>
                        <strong style={masterSummaryCardValueStyle}>
                          {clean(masterInfoDisplayValue("provider", masterTreatingProviderSummary)) && masterInfoDisplayValue("provider", masterTreatingProviderSummary) !== "—" ? (
                            <a
                              href={filteredUrl("provider", masterInfoDisplayValue("provider", masterTreatingProviderSummary))}
                              className="barsh-filter-field-link"
                              style={fieldLinkStyle}
                            >
                              {masterTreatingProviderSummary}
                            </a>
                          ) : (
                            "—"
                          )}
                        </strong>
                        <button
                          type="button"
                          onClick={() => openMasterInfoEditDialog("provider", "Provider", masterInfoDisplayValue("provider", masterTreatingProviderSummary))}
                          title="Open Provider edit preview dialog."
                          style={{
                            ...masterInfoCardEditButtonStyle,
                            borderColor: "#93c5fd",
                            background: "#ffffff",
                            color: "#1d4ed8",
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                      </div>

                      <div style={masterInfoCardStyle}>
                        <span style={masterSummaryCardTitleStyle}>Patient</span>
                        <strong style={masterSummaryCardValueStyle}>
                          {clean(masterInfoDisplayValue("patient", clean((masterSettlementDetailRows as any[])[0]?.patient))) ? (
                            <a
                              href={filteredUrl("patient", masterInfoDisplayValue("patient", clean((masterSettlementDetailRows as any[])[0]?.patient)))}
                              className="barsh-filter-field-link"
                              style={fieldLinkStyle}
                            >
                              {masterInfoDisplayValue("patient", clean((masterSettlementDetailRows as any[])[0]?.patient))}
                            </a>
                          ) : (
                            "—"
                          )}
                        </strong>
                        <button
                          type="button"
                          onClick={() => openMasterInfoEditDialog("patient", "Patient", masterInfoDisplayValue("patient", clean((masterSettlementDetailRows as any[])[0]?.patient)))}
                          title="Open Patient edit dialog."
                          style={{
                            ...masterInfoCardEditButtonStyle,
                            borderColor: "#93c5fd",
                            background: "#ffffff",
                            color: "#1d4ed8",
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                      </div>

                      <div style={masterInfoCardStyle}>
                        <span style={masterSummaryCardTitleStyle}>Insurer</span>
                        <strong style={masterSummaryCardValueStyle}>
                          {clean(masterInfoDisplayValue("insurer", masterInsurerSummary)) && masterInfoDisplayValue("insurer", masterInsurerSummary) !== "—" ? (
                            <a
                              href={filteredUrl("insurer", masterInfoDisplayValue("insurer", masterInsurerSummary))}
                              className="barsh-filter-field-link"
                              style={fieldLinkStyle}
                            >
                              {masterInsurerSummary}
                            </a>
                          ) : (
                            "—"
                          )}
                        </strong>
                        <button
                          type="button"
                          onClick={() => openMasterInfoEditDialog("insurer", "Insurer", masterInfoDisplayValue("insurer", masterInsurerSummary))}
                          title="Open Insurer edit dialog."
                          style={{
                            ...masterInfoCardEditButtonStyle,
                            borderColor: "#93c5fd",
                            background: "#ffffff",
                            color: "#1d4ed8",
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                      </div>

                      <div style={masterInfoCardStyle}>
                        <span style={masterSummaryCardTitleStyle}>Claim Number</span>
                        <strong style={masterSummaryCardValueStyle}>
                          {masterClaimSummary.href ? (
                            <a
                              href={masterClaimSummary.href}
                              className="barsh-filter-field-link"
                              style={fieldLinkStyle}
                            >
                              {masterClaimSummary.label}
                            </a>
                          ) : (
                            "—"
                          )}
                        </strong>
                        <button
                          type="button"
                          onClick={() => openMasterInfoEditDialog("claimNumber", "Claim Number", masterInfoDisplayValue("claimNumber", masterClaimSummary.label))}
                          title="Open Claim Number edit dialog."
                          style={{
                            ...masterInfoCardEditButtonStyle,
                            borderColor: "#93c5fd",
                            background: "#ffffff",
                            color: "#1d4ed8",
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                      </div>

                      <div style={masterInfoCardStyle}>
                        <span style={masterSummaryCardTitleStyle}>Date of Loss</span>
                        <strong style={masterSummaryCardValueStyle}>{masterInfoDisplayValue("dateOfLoss", masterDateOfLossSummary)}</strong>
                        <button
                          type="button"
                          onClick={() => openMasterInfoEditDialog("dateOfLoss", "Date of Loss", masterInfoDisplayValue("dateOfLoss", masterDateOfLossSummary))}
                          title="Open Date of Loss edit dialog."
                          style={{
                            ...masterInfoCardEditButtonStyle,
                            borderColor: "#93c5fd",
                            background: "#ffffff",
                            color: "#1d4ed8",
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </section>

                  <section
                    style={{
                      display: "grid",
                      gap: 10,
                      padding: 12,
                      borderTop: "1px solid #cbd5e1",
                      borderBottom: "1px solid #cbd5e1",
                      borderLeft: "none",
                      borderRight: "none",
                      borderRadius: 0,
                      background: "#f8fafc",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 950,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#1e3a8a",
                      }}
                    >
                      Lawsuit Information
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                        gap: 12,
                        alignItems: "stretch",
                      }}
                    >
                      <div style={masterInfoCardStyle}>
                        <span style={masterSummaryCardTitleStyle}>Index / AAA Number</span>
                        <strong style={masterSummaryCardValueStyle}>{masterInfoDisplayValue("indexAaaNumber", "—")}</strong>
                        <button
                          type="button"
                          onClick={() => openMasterInfoEditDialog("indexAaaNumber", "Index / AAA Number", masterInfoDisplayValue("indexAaaNumber", "—"))}
                          title="Open Index / AAA Number edit dialog."
                          style={{
                            ...masterInfoCardEditButtonStyle,
                            borderColor: "#93c5fd",
                            background: "#ffffff",
                            color: "#1d4ed8",
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                      </div>

                      <div style={masterInfoCardStyle}>
                        <span style={masterSummaryCardTitleStyle}>Court</span>
                        <strong style={masterSummaryCardValueStyle}>{masterInfoDisplayValue("court", "—")}</strong>
                        <button
                          type="button"
                          onClick={() => openMasterInfoEditDialog("court", "Court", masterInfoDisplayValue("court", "—"))}
                          title="Open Court edit dialog."
                          style={{
                            ...masterInfoCardEditButtonStyle,
                            borderColor: "#93c5fd",
                            background: "#ffffff",
                            color: "#1d4ed8",
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                      </div>

                      <div style={masterInfoCardStyle}>
                        <span style={masterSummaryCardTitleStyle}>Date Filed</span>
                        <strong style={masterSummaryCardValueStyle}>{masterInfoDisplayValue("dateFiled", "—")}</strong>
                        <button
                          type="button"
                          onClick={() => openMasterInfoEditDialog("dateFiled", "Date Filed", masterInfoDisplayValue("dateFiled", "—"))}
                          title="Open Date Filed edit dialog."
                          style={{
                            ...masterInfoCardEditButtonStyle,
                            borderColor: "#93c5fd",
                            background: "#ffffff",
                            color: "#1d4ed8",
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                      </div>

                      <div style={masterInfoCardStyle}>
                        <span style={masterSummaryCardTitleStyle}>Index Fee</span>
                        <strong style={masterSummaryCardValueStyle}>{masterInfoDisplayValue("filingFee", "$0.00")}</strong>
                        <button
                          type="button"
                          onClick={() => openMasterInfoEditDialog("filingFee", "Index Fee", masterInfoDisplayValue("filingFee", "$0.00"))}
                          title="Open Index Fee edit dialog."
                          style={{
                            ...masterInfoCardEditButtonStyle,
                            borderColor: "#93c5fd",
                            background: "#ffffff",
                            color: "#1d4ed8",
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                      </div>

                      <div style={masterInfoCardStyle}>
                        <span style={masterSummaryCardTitleStyle}>Service Fee</span>
                        <strong style={masterSummaryCardValueStyle}>{masterInfoDisplayValue("serviceFee", "$0.00")}</strong>
                        <button
                          type="button"
                          onClick={() => openMasterInfoEditDialog("serviceFee", "Service Fee", masterInfoDisplayValue("serviceFee", "$0.00"))}
                          title="Open Service Fee edit dialog."
                          style={{
                            ...masterInfoCardEditButtonStyle,
                            borderColor: "#93c5fd",
                            background: "#ffffff",
                            color: "#1d4ed8",
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                      </div>

                      <div style={masterInfoCardStyle}>
                        <span style={masterSummaryCardTitleStyle}>Other Court Fees</span>
                        <strong style={masterSummaryCardValueStyle}>{masterInfoDisplayValue("otherCourtCosts", "$0.00")}</strong>
                        <button
                          type="button"
                          onClick={() => openMasterInfoEditDialog("otherCourtCosts", "Other Court Fees", masterInfoDisplayValue("otherCourtCosts", "$0.00"))}
                          title="Open Other Court Fees edit dialog."
                          style={{
                            ...masterInfoCardEditButtonStyle,
                            borderColor: "#93c5fd",
                            background: "#ffffff",
                            color: "#1d4ed8",
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </section>

                  <section
                    style={{
                      display: "grid",
                      gap: 10,
                      padding: 12,
                      borderTop: "1px solid #cbd5e1",
                      borderBottom: "1px solid #cbd5e1",
                      borderLeft: "none",
                      borderRight: "none",
                      borderRadius: 0,
                      background: "#f8fafc",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 950,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#1e3a8a",
                      }}
                    >
                      Notes
                    </div>

                    <div
                      style={{
                        ...masterSummaryItemStyle,
                        minHeight: 132,
                        alignContent: "start",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <strong style={{ fontSize: 15, lineHeight: 1.35 }}>
                          {masterNotes.length ? `${masterNotes.length} note${masterNotes.length === 1 ? "" : "s"}` : "No notes entered yet."}
                        </strong>
                        <button
                          type="button"
                          onClick={() => openMasterNoteDialog()}
                          title="Add a note to this Master Lawsuit."
                          style={{
                            width: "fit-content",
                            border: "1px solid #2563eb",
                            borderRadius: 999,
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            fontSize: 12,
                            fontWeight: 950,
                            padding: "7px 13px",
                            cursor: "pointer",
                          }}
                        >
                          Add Note
                        </button>
                      </div>

                      {masterNotes.length > 0 && (
                        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                          {masterNotes.map((entry) => (
                            <div
                              key={entry.id}
                              style={{
                                display: "grid",
                                gap: 6,
                                padding: "9px 11px",
                                border: "1px solid #dbe4f0",
                                borderRadius: 12,
                                background: "#ffffff",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "flex-start",
                                  gap: 10,
                                }}
                              >
                                <div style={{ fontSize: 13, fontWeight: 850, color: "#0f172a", whiteSpace: "pre-wrap" }}>
                                  {entry.note}
                                </div>

                                <div style={{ display: "inline-flex", gap: 6, flexShrink: 0 }}>
                                  <button
                                    type="button"
                                    onClick={() => openMasterNoteDialog(entry)}
                                    title="Edit note"
                                    aria-label="Edit note"
                                    style={{
                                      width: 30,
                                      height: 30,
                                      border: "1px solid #cbd5e1",
                                      borderRadius: 999,
                                      background: "#f8fafc",
                                      color: "#1d4ed8",
                                      cursor: "pointer",
                                      fontSize: 14,
                                      fontWeight: 950,
                                      lineHeight: 1,
                                    }}
                                  >
                                    ✎
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => requestDeleteMasterNote(entry)}
                                    title="Delete note"
                                    aria-label="Delete note"
                                    style={{
                                      width: 30,
                                      height: 30,
                                      border: "1px solid #fecaca",
                                      borderRadius: 999,
                                      background: "#fef2f2",
                                      color: "#dc2626",
                                      cursor: "pointer",
                                      fontSize: 14,
                                      fontWeight: 950,
                                      lineHeight: 1,
                                    }}
                                  >
                                    🗑
                                  </button>
                                </div>
                              </div>

                              <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>
                                By {entry.user || masterNoteUserName()} · {entry.timestamp}
                                {entry.editedAt ? ` · Edited ${entry.editedAt}` : ""}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </section>
                </div>

                <div
                  style={{
                    border: "1px solid rgba(49, 87, 213, 0.22)",
                    borderRadius: 12,
                    background: "#f8fafc",
                    padding: 18,
                    boxShadow: "0 10px 26px rgba(49, 87, 213, 0.065)",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateRows: "auto auto 1fr",
                        gap: 10,
                        padding: "12px 12px 10px",
                        border: "1px solid #bbf7d0",
                        borderRadius: 14,
                        background: "#f0fdf4",
                        minHeight: 188,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 950,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "#166534",
                          textAlign: "center",
                        }}
                      >
                        Payment Actions
                      </div>

                      <button
                        type="button"
                        onClick={() => setMasterPaymentFormOpen(true)}
                        title="Open lawsuit-level payment preview popup.  No Clio writeback will occur."
                        style={{
                          width: "100%",
                          minWidth: 0,
                          height: 44,
                          border: "1px solid #16a34a",
                          borderRadius: 999,
                          background: "#16a34a",
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 950,
                          cursor: "pointer",
                          boxShadow: "0 8px 24px rgba(22, 163, 74, 0.22)",
                        }}
                      >
                        Apply Payment
                      </button>

                      <div style={{ display: "grid", alignContent: "start" }} />
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateRows: "auto auto auto auto 1fr",
                        gap: 10,
                        padding: "12px 12px 10px",
                        border: "1px solid #fecaca",
                        borderRadius: 14,
                        background: "#fff7f7",
                        minHeight: 188,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 950,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "#991b1b",
                          textAlign: "center",
                        }}
                      >
                        Lawsuit Actions
                      </div>

                      <button
                        type="button"
                        onClick={() => setMasterSettlementFormOpen(true)}
                        title="Open settlement preview popup.  No Clio writeback will occur."
                        style={{
                          width: "100%",
                          minWidth: 0,
                          height: 44,
                          border: "1px solid #16a34a",
                          borderRadius: 999,
                          background: "#16a34a",
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 950,
                          cursor: "pointer",
                          boxShadow: "0 8px 24px rgba(22, 163, 74, 0.22)",
                          opacity: 1,
                        }}
                      >
                        Record Settlement
                      </button>

                      <button
                        type="button"
                        disabled
                        title="Document controls remain in the Documents workflow."
                        style={{
                          width: "100%",
                          minWidth: 0,
                          height: 44,
                          border: "1px solid #cbd5e1",
                          borderRadius: 999,
                          background: "#f8fafc",
                          color: "#334155",
                          fontSize: 12,
                          fontWeight: 950,
                          cursor: "not-allowed",
                          opacity: 0.82,
                        }}
                      >
                        View Documents
                      </button>

                      <button
                        type="button"
                        disabled
                        title="Close Lawsuit workflow will be wired after payment/settlement safety checks."
                        style={{
                          width: "100%",
                          minWidth: 0,
                          height: 44,
                          border: "1px solid #dc2626",
                          borderRadius: 999,
                          background: "#dc2626",
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 950,
                          cursor: "not-allowed",
                        }}
                      >
                        Close Lawsuit
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: 0,
                      marginTop: 4,
                      borderTop: "1px solid transparent",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        padding: "9px 0",
                        fontSize: 15,
                        color: "#475569",
                        fontWeight: 800,
                      }}
                    >
                      <span>Lawsuit Amount</span>
                      <strong style={{ color: "#0f172a", fontSize: 18 }}>{money(masterPaymentSummary.lawsuitAmount)}</strong>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        padding: "8px 0",
                        borderBottom: "1px solid #e2e8f0",
                        fontSize: 14,
                        color: "#475569",
                        fontWeight: 800,
                      }}
                    >
                      <span>Costs</span>
                      <strong style={{ color: "#0f172a", fontSize: 17 }}>
                        {money(
                          masterInfoMoneyNumber("filingFee", "$0.00") +
                            masterInfoMoneyNumber("serviceFee", "$0.00") +
                            masterInfoMoneyNumber("otherCourtCosts", "$0.00")
                        )}
                      </strong>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        padding: "9px 0",
                        fontSize: 15,
                        color: "#475569",
                        fontWeight: 800,
                      }}
                    >
                      <span>Payments Posted</span>
                      <strong style={{ color: "#0f172a", fontSize: 18 }}>{money(masterPaymentSummary.paymentsPosted)}</strong>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        padding: "13px 0 11px",
                        borderTop: "1px solid #dbe4f0",
                        fontSize: 16,
                        color: "#0f172a",
                        fontWeight: 950,
                      }}
                    >
                      <span>Balance</span>
                      <strong style={{ color: "#0f172a", fontSize: 22 }}>
                        {money(
                          masterPaymentSummary.lawsuitAmount +
                            masterInfoMoneyNumber("filingFee", "$0.00") +
                            masterInfoMoneyNumber("serviceFee", "$0.00") +
                            masterInfoMoneyNumber("otherCourtCosts", "$0.00") -
                            masterPaymentSummary.paymentsPosted
                        )}
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      display: "grid",
                      gap: 7,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 12,
                        fontWeight: 900,
                        color: "#166534",
                      }}
                    >
                      <span>Payment controls: Active</span>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "4px 8px",
                          border: "1px solid #93c5fd",
                          borderRadius: 999,
                          background: "#eff6ff",
                          color: "#1d4ed8",
                          fontSize: 11,
                          fontWeight: 900,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Master Lawsuit
                      </span>
                    </div>

                    <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>
                      Last activity: lawsuit payments post locally to child bill receipts.
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 12,
                      borderTop: "1px solid #e2e8f0",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "#475569",
                        }}
                      >
                        Recent Receipts
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>
                        {masterPaymentReceiptsLoading ? "Loading..." : `${masterPaymentReceipts.length} shown`}
                      </span>
                    </div>

                    {masterPaymentReceiptsError && (
                      <div style={{ fontSize: 13, fontWeight: 750, color: "#991b1b" }}>
                        {masterPaymentReceiptsError}
                      </div>
                    )}

                    {!masterPaymentReceiptsError && masterPaymentReceipts.length === 0 && (
                      <div style={{ fontSize: 13, fontWeight: 750, color: "#64748b" }}>
                        No child bill payment receipts are currently active or historical for this lawsuit.
                      </div>
                    )}

                    {!masterPaymentReceiptsError && masterPaymentReceipts.length > 0 && (
                      <div
                        style={{
                          display: "grid",
                          gap: 6,
                          maxHeight: 230,
                          overflowY: "auto",
                          paddingRight: 2,
                        }}
                      >
                        {masterPaymentReceipts.slice(0, 8).map((receipt: any) => (
                          <div
                            key={`master-payment-receipt-${receipt.sourceDisplayNumber || receipt.displayNumber}-${receipt.id}`}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr auto",
                              gap: 6,
                              padding: "8px 9px",
                              border: receipt.voided ? "1px solid #fecaca" : "1px solid #dbe4f0",
                              borderRadius: 12,
                              background: receipt.voided ? "#fff7f7" : "#ffffff",
                            }}
                          >
                            <div style={{ display: "grid", gap: 2 }}>
                              <div style={{ fontSize: 12, fontWeight: 950, color: "#0f172a" }}>
                                {receipt.sourceDisplayNumber || receipt.displayNumber || "—"} · {receipt.paymentDate || receipt.transactionDate || "—"}
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 750, color: "#475569" }}>
                                {receipt.transactionType || "Payment"} · {receipt.transactionStatus || "—"} · Check {receipt.checkNumber || "—"}
                              </div>
                              {receipt.voided && (
                                <div style={{ fontSize: 11, fontWeight: 900, color: "#991b1b" }}>
                                  Voided
                                </div>
                              )}
                            </div>
                            <strong style={{ fontSize: 13, color: receipt.voided ? "#991b1b" : "#166534", whiteSpace: "nowrap" }}>
                              {money(receipt.paymentAmount)}
                            </strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}



            {masterPaymentPostResult && activeMasterWorkspaceTab === "payments" && (
              <div
                style={{
                  margin: "0 0 14px",
                  padding: "10px 12px",
                  border: masterPaymentPostResult.ok ? "1px solid #bbf7d0" : "1px solid #fecaca",
                  borderRadius: 14,
                  background: masterPaymentPostResult.ok ? "#f0fdf4" : "#fef2f2",
                  color: masterPaymentPostResult.ok ? "#14532d" : "#991b1b",
                  fontSize: 13,
                  fontWeight: 750,
                }}
              >
                {masterPaymentPostResult.ok
                  ? masterPaymentPostResult.message || "Lawsuit payment posted locally."
                  : masterPaymentPostResult.error || "Lawsuit payment could not be posted."}
              </div>
            )}

            {masterNoteDeleteTarget && activeMasterWorkspaceTab === "payments" && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Confirm note deletion"
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 50000,
                  display: "block",
                  padding: 0,
                  overflow: "hidden",
                  background: "rgba(15, 23, 42, 0.58)",
                }}
                onClick={closeDeleteMasterNoteDialog}
              >
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    confirmDeleteMasterNote();
                  }}
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    position: "fixed",
                    top: 154,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "min(360px, 94vw)",
                    display: "grid",
                    gap: 16,
                    padding: 20,
                    border: "1px solid #fecaca",
                    borderRadius: 18,
                    background: "#ffffff",
                    boxShadow: "0 30px 90px rgba(15, 23, 42, 0.38)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 950,
                      color: "#991b1b",
                      textAlign: "center",
                    }}
                  >
                    Delete Note?
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                    }}
                  >
                    <button
                      ref={masterNoteDeleteConfirmButtonRef}
                      type="submit"
                      style={{
                        height: 42,
                        border: "1px solid #dc2626",
                        borderRadius: 12,
                        background: "#dc2626",
                        color: "#ffffff",
                        fontWeight: 950,
                        fontSize: 14,
                        cursor: "pointer",
                        boxShadow: "0 8px 24px rgba(220, 38, 38, 0.22)",
                      }}
                    >
                      Confirm
                    </button>

                    <button
                      type="button"
                      onClick={closeDeleteMasterNoteDialog}
                      style={{
                        height: 42,
                        border: "1px solid #cbd5e1",
                        borderRadius: 12,
                        background: "#ffffff",
                        color: "#334155",
                        fontWeight: 900,
                        fontSize: 14,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}



            {masterNoteDialogOpen && activeMasterWorkspaceTab === "payments" && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Master Lawsuit note popup"
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 50000,
                  display: "block",
                  padding: 0,
                  overflow: "hidden",
                  background: "rgba(15, 23, 42, 0.58)",
                }}
                onClick={closeMasterNoteDialog}
              >
                <div
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    position: "fixed",
                    top: 154,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "min(720px, 94vw)",
                    maxHeight: "calc(100vh - 178px)",
                    overflowY: "auto",
                    border: "1px solid #bfdbfe",
                    borderRadius: 22,
                    background: "#ffffff",
                    boxShadow: "0 30px 90px rgba(15, 23, 42, 0.38)",
                  }}
                >
                  <div
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "16px 18px",
                      borderBottom: "1px solid #dbe4f0",
                      background: "#eff6ff",
                      borderTopLeftRadius: 22,
                      borderTopRightRadius: 22,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 950,
                          color: "#1d4ed8",
                        }}
                      >
                        {masterNoteEditingId ? "Edit Note" : "Add Note"}
                      </div>
                      <div
                        style={{
                          marginTop: 3,
                          fontSize: 12,
                          fontWeight: 800,
                          color: "#1e40af",
                        }}
                      >
                        Master Lawsuit note · By {masterNoteUserName()} · Local UI log only until persistent Audit/History is wired.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={closeMasterNoteDialog}
                      style={{
                        width: 38,
                        height: 38,
                        border: "1px solid #cbd5e1",
                        borderRadius: 999,
                        background: "#ffffff",
                        color: "#64748b",
                        fontSize: 26,
                        fontWeight: 900,
                        cursor: "pointer",
                        lineHeight: 1,
                      }}
                      aria-label="Close note popup"
                    >
                      ×
                    </button>
                  </div>

                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      saveMasterNote();
                    }}
                    style={{
                      display: "grid",
                      gap: 14,
                      padding: 18,
                    }}
                  >
                    <label
                      style={{
                        display: "grid",
                        gap: 7,
                        fontSize: 12,
                        fontWeight: 950,
                        color: "#334155",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Note
                      <textarea
                        ref={masterNoteTextareaRef}
                        value={masterNoteDraft}
                        onChange={(event) => setMasterNoteDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          if (!event.metaKey && !event.ctrlKey) return;

                          event.preventDefault();
                          saveMasterNote();
                        }}
                        placeholder="Type note here..."
                        style={{
                          width: "100%",
                          minHeight: 160,
                          border: "1px solid #cbd5e1",
                          borderRadius: 12,
                          padding: "11px 12px",
                          background: "#fff",
                          color: "#0f172a",
                          fontSize: 15,
                          fontWeight: 750,
                          lineHeight: 1.4,
                          outline: "none",
                          resize: "vertical",
                          textTransform: "none",
                          letterSpacing: 0,
                        }}
                      />
                    </label>

                    <div
                      style={{
                        padding: "10px 12px",
                        border: "1px solid #bae6fd",
                        borderRadius: 12,
                        background: "#e0f2fe",
                        color: "#075985",
                        fontSize: 13,
                        fontWeight: 850,
                        lineHeight: 1.4,
                      }}
                    >
                      Press Command+Enter or Ctrl+Enter to save.  Press Esc to cancel.  Plain Enter creates a new line.
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 10,
                        paddingTop: 4,
                      }}
                    >
                      <button
                        type="button"
                        onClick={closeMasterNoteDialog}
                        style={{
                          minWidth: 110,
                          height: 42,
                          border: "1px solid #cbd5e1",
                          borderRadius: 12,
                          background: "#ffffff",
                          color: "#334155",
                          fontWeight: 900,
                          fontSize: 14,
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={!clean(masterNoteDraft)}
                        title="Save note to the local notes log."
                        style={{
                          minWidth: 150,
                          height: 42,
                          border: "1px solid #16a34a",
                          borderRadius: 12,
                          background: clean(masterNoteDraft) ? "#16a34a" : "#bbf7d0",
                          color: clean(masterNoteDraft) ? "#ffffff" : "#166534",
                          fontWeight: 950,
                          fontSize: 14,
                          cursor: clean(masterNoteDraft) ? "pointer" : "not-allowed",
                          boxShadow: clean(masterNoteDraft) ? "0 8px 24px rgba(22, 163, 74, 0.22)" : "none",
                        }}
                      >
                        {masterNoteEditingId ? "Save Changes" : "Save Note"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}



            {masterInfoEditDialog && activeMasterWorkspaceTab === "payments" && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label={`${masterInfoEditDialog.label} edit preview popup`}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 50000,
                  display: "block",
                  padding: 0,
                  overflow: "hidden",
                  background: "rgba(15, 23, 42, 0.58)",
                }}
                onClick={closeMasterInfoEditDialog}
              >
                <div
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    position: "fixed",
                    top: 154,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "min(620px, 94vw)",
                    maxHeight: "calc(100vh - 178px)",
                    overflowY: "auto",
                    border: "1px solid #bfdbfe",
                    borderRadius: 22,
                    background: "#ffffff",
                    boxShadow: "0 30px 90px rgba(15, 23, 42, 0.38)",
                  }}
                >
                  <div
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "16px 18px",
                      borderBottom: "1px solid #dbe4f0",
                      background: "#eff6ff",
                      borderTopLeftRadius: 22,
                      borderTopRightRadius: 22,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 950,
                          color: "#1d4ed8",
                        }}
                      >
                        Edit {masterInfoEditDialog.label}
                      </div>
                      <div
                        style={{
                          marginTop: 3,
                          fontSize: 12,
                          fontWeight: 800,
                          color: "#1e40af",
                        }}
                      >
                        Master Lawsuit field edit · Preview only, no Clio writeback.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={closeMasterInfoEditDialog}
                      style={{
                        width: 38,
                        height: 38,
                        border: "1px solid #cbd5e1",
                        borderRadius: 999,
                        background: "#ffffff",
                        color: "#64748b",
                        fontSize: 26,
                        fontWeight: 900,
                        cursor: "pointer",
                        lineHeight: 1,
                      }}
                      aria-label={`Close ${masterInfoEditDialog.label} edit preview popup`}
                    >
                      ×
                    </button>
                  </div>

                  <form
                    onSubmit={(event) => {
                      event.preventDefault();

                      if (
                        masterInfoEditDialog &&
                        masterInfoFieldKind(masterInfoEditDialog.field) === "contact" &&
                        !masterInfoSelectedContact
                      ) {
                        return;
                      }

                      confirmMasterInfoEditDialog();
                    }}
                    style={{
                      display: "grid",
                      gap: 14,
                      padding: 18,
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gap: 6,
                        padding: 12,
                        border: "1px solid #e2e8f0",
                        borderRadius: 14,
                        background: "#f8fafc",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 950,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "#475569",
                        }}
                      >
                        Current
                      </span>
                      <strong style={{ fontSize: 16, color: "#0f172a" }}>
                        {masterInfoEditDialog.currentValue || "—"}
                      </strong>
                    </div>

                    {masterInfoFieldKind(masterInfoEditDialog.field) === "contact" ? (
                      <div style={{ display: "grid", gap: 10 }}>
                        <label
                          style={{
                            display: "grid",
                            gap: 7,
                            fontSize: 12,
                            fontWeight: 950,
                            color: "#334155",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          Search Local Contact
                          <input
                            ref={masterInfoPrimaryInputRef}
                            value={masterInfoContactSearch}
                            onChange={(event) => {
                              setMasterInfoContactSearch(event.target.value);
                              setMasterInfoSelectedContact(null);
                              setMasterInfoEditValue("");
                            }}
                            placeholder={`Start typing ${masterInfoEditDialog.label}`}
                            autoComplete="off"
                            style={{
                              width: "100%",
                              border: "1px solid #cbd5e1",
                              borderRadius: 12,
                              padding: "11px 12px",
                              background: "#fff",
                              color: "#0f172a",
                              fontSize: 15,
                              fontWeight: 850,
                              outline: "none",
                              textTransform: "none",
                              letterSpacing: 0,
                            }}
                          />
                        </label>

                        {masterInfoContactLoading && (
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>
                            Loading suggestions...
                          </div>
                        )}

                        {masterInfoSelectedContact && (
                          <div
                            style={{
                              padding: "9px 11px",
                              border: "1px solid #bbf7d0",
                              borderRadius: 12,
                              background: "#f0fdf4",
                              color: "#166534",
                              fontSize: 13,
                              fontWeight: 850,
                            }}
                          >
                            Selected: {masterInfoSelectedContact.name}
                            {masterInfoSelectedContact.type ? ` (${masterInfoSelectedContact.type})` : ""}
                            {masterInfoSelectedContact.id ? ` · ID ${masterInfoSelectedContact.id}` : ""}
                          </div>
                        )}

                        {masterInfoContactResults.length > 0 && (
                          <div style={{ display: "grid", gap: 6 }}>
                            {masterInfoContactResults.map((contact: any) => (
                              <button
                                key={contact.id}
                                type="button"
                                onClick={() => selectMasterInfoContact(contact)}
                                style={{
                                  textAlign: "left",
                                  padding: "9px 11px",
                                  border: "1px solid #dbe4f0",
                                  borderRadius: 12,
                                  background: "#ffffff",
                                  color: "#0f172a",
                                  cursor: "pointer",
                                  fontWeight: 850,
                                }}
                              >
                                {contact.name}
                                {contact.type ? <span style={{ color: "#64748b" }}> — {contact.type}</span> : null}
                              </button>
                            ))}
                          </div>
                        )}

                        {!masterInfoContactLoading && masterInfoContactSearch.length >= 2 && masterInfoContactResults.length === 0 && !masterInfoSelectedContact && (
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>
                            No suggestions found.
                          </div>
                        )}
                      </div>
                    ) : (
                      <label
                        style={{
                          display: "grid",
                          gap: 7,
                          fontSize: 12,
                          fontWeight: 950,
                          color: "#334155",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        New {masterInfoEditDialog.label}
                        {masterInfoFieldKind(masterInfoEditDialog.field) === "money" ? (
                          <div style={{ position: "relative", width: "100%" }}>
                            <span
                              style={{
                                position: "absolute",
                                left: 12,
                                top: "50%",
                                transform: "translateY(-50%)",
                                color: "#475569",
                                fontWeight: 950,
                                pointerEvents: "none",
                              }}
                            >
                              $
                            </span>
                            <input
                              ref={masterInfoPrimaryInputRef}
                              type="text"
                              value={masterInfoEditValue}
                              onChange={(event) => setMasterInfoEditValue(event.target.value)}
                              onBlur={() => setMasterInfoEditValue((current) => formatMasterInfoMoneyInput(current))}
                              placeholder="0.00"
                              inputMode="decimal"
                              style={{
                                width: "100%",
                                border: "1px solid #cbd5e1",
                                borderRadius: 12,
                                padding: "11px 12px 11px 28px",
                                background: "#fff",
                                color: "#0f172a",
                                fontSize: 15,
                                fontWeight: 850,
                                outline: "none",
                                textTransform: "none",
                                letterSpacing: 0,
                              }}
                            />
                          </div>
                        ) : (
                          <input
                            ref={masterInfoPrimaryInputRef}
                            type={masterInfoFieldKind(masterInfoEditDialog.field) === "date" ? "date" : "text"}
                            value={masterInfoEditValue}
                            onChange={(event) => setMasterInfoEditValue(event.target.value)}
                            placeholder={`Enter ${masterInfoEditDialog.label}`}
                            style={{
                              width: "100%",
                              border: "1px solid #cbd5e1",
                              borderRadius: 12,
                              padding: "11px 12px",
                              background: "#fff",
                              color: "#0f172a",
                              fontSize: 15,
                              fontWeight: 850,
                              outline: "none",
                              textTransform: "none",
                              letterSpacing: 0,
                            }}
                          />
                        )}
                      </label>
                    )}

                    <div
                      style={{
                        padding: "10px 12px",
                        border: "1px solid #bae6fd",
                        borderRadius: 12,
                        background: "#e0f2fe",
                        color: "#075985",
                        fontSize: 13,
                        fontWeight: 850,
                        lineHeight: 1.4,
                      }}
                    >
                      This dialog is a UI preview only.  It does not search Clio contacts, validate custom fields, update Clio, or persist local data.
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 10,
                        paddingTop: 4,
                      }}
                    >
                      <button
                        type="button"
                        onClick={closeMasterInfoEditDialog}
                        style={{
                          minWidth: 110,
                          height: 42,
                          border: "1px solid #cbd5e1",
                          borderRadius: 12,
                          background: "#ffffff",
                          color: "#334155",
                          fontWeight: 900,
                          fontSize: 14,
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        title="Confirm this UI edit and write it to the local Audit/History log."
                        style={{
                          minWidth: 190,
                          height: 42,
                          border: "1px solid #16a34a",
                          borderRadius: 12,
                          background: "#16a34a",
                          color: "#ffffff",
                          fontWeight: 950,
                          fontSize: 14,
                          cursor: "pointer",
                          boxShadow: "0 8px 24px rgba(22, 163, 74, 0.22)",
                        }}
                      >
                        Confirm Edit
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}



            {masterSettlementFormOpen && activeMasterWorkspaceTab === "payments" && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Settlement preview popup"
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 50000,
                  display: "block",
                  padding: 0,
                  overflow: "hidden",
                  background: "rgba(15, 23, 42, 0.58)",
                }}
                onClick={() => setMasterSettlementFormOpen(false)}
              >
                <div
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    position: "fixed",
                    top: 154,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "min(1080px, 94vw)",
                    maxHeight: "calc(100vh - 178px)",
                    overflowY: "auto",
                    border: "1px solid #bfdbfe",
                    borderRadius: 22,
                    background: "#ffffff",
                    boxShadow: "0 30px 90px rgba(15, 23, 42, 0.38)",
                  }}
                >
                  <div
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "16px 18px",
                      borderBottom: "1px solid #dbe4f0",
                      background: "#eff6ff",
                      borderTopLeftRadius: 22,
                      borderTopRightRadius: 22,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 950,
                          color: "#1d4ed8",
                        }}
                      >
                        Settlement Preview
                      </div>
                      <div
                        style={{
                          marginTop: 3,
                          fontSize: 12,
                          fontWeight: 800,
                          color: "#1e40af",
                        }}
                      >
                        Master Lawsuit Settlement · Local preview only, no Clio writeback.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        resetMasterSettlementPreviewForm();
                        setMasterSettlementFormOpen(false);
                      }}
                      style={{
                        width: 38,
                        height: 38,
                        border: "1px solid #cbd5e1",
                        borderRadius: 999,
                        background: "#ffffff",
                        color: "#64748b",
                        fontSize: 26,
                        fontWeight: 900,
                        cursor: "pointer",
                        lineHeight: 1,
                      }}
                      aria-label="Close settlement preview popup"
                    >
                      ×
                    </button>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.15fr 1fr 1fr",
                      gap: 16,
                      padding: 18,
                    }}
                  >
                    <label className="barsh-direct-payment-field">
                      <span>Gross Settlement Amount *</span>
                      <div style={{ position: "relative", width: "100%" }}>
                        <span
                          style={{
                            position: "absolute",
                            left: 12,
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "#475569",
                            fontWeight: 900,
                            pointerEvents: "none",
                          }}
                        >
                          $
                        </span>
                        <input
                          value={masterSettlementGrossInput}
                          onChange={(event) => setMasterSettlementGrossInput(event.target.value)}
                          onBlur={() => setMasterSettlementGrossInput((current) => formatMasterSettlementMoneyInput(current))}
                          placeholder="0.00"
                          inputMode="decimal"
                          style={{
                            width: "100%",
                            border: "1px solid #cbd5e1",
                            borderRadius: 10,
                            padding: "10px 12px 10px 28px",
                            background: "#fff",
                            color: "#0f172a",
                            fontWeight: 800,
                            outline: "none",
                          }}
                        />
                      </div>
                    </label>

                    <label className="barsh-direct-payment-field">
                      <span>Settled With *</span>
                      <input
                        value={masterSettlementWithInput}
                        onChange={(event) => setMasterSettlementWithInput(event.target.value)}
                        placeholder="Search Local Contact"
                        style={{
                          width: "100%",
                          border: "1px solid #cbd5e1",
                          borderRadius: 10,
                          padding: "10px 12px",
                          background: "#fff",
                          color: "#0f172a",
                          fontWeight: 800,
                          outline: "none",
                        }}
                      />
                    </label>

                    <label className="barsh-direct-payment-field">
                      <span>Settlement Date *</span>
                      <input
                        type="date"
                        value={masterSettlementDateInput}
                        onChange={(event) => setMasterSettlementDateInput(event.target.value)}
                        style={{
                          width: "100%",
                          border: "1px solid #cbd5e1",
                          borderRadius: 10,
                          padding: "10px 12px",
                          background: "#fff",
                          color: "#0f172a",
                          fontWeight: 800,
                          outline: "none",
                        }}
                      />
                    </label>

                    <label className="barsh-direct-payment-field">
                      <span>Payment Expected Date</span>
                      <input
                        type="date"
                        value={masterSettlementPaymentExpectedDateInput}
                        onChange={(event) => setMasterSettlementPaymentExpectedDateInput(event.target.value)}
                        style={{
                          width: "100%",
                          border: "1px solid #cbd5e1",
                          borderRadius: 10,
                          padding: "10px 12px",
                          background: "#fff",
                          color: "#0f172a",
                          fontWeight: 800,
                          outline: "none",
                        }}
                      />
                    </label>

                    <label className="barsh-direct-payment-field">
                      <span>Principal Fee %</span>
                      <input
                        value={masterSettlementPrincipalFeePercentInput}
                        onChange={(event) => setMasterSettlementPrincipalFeePercentInput(event.target.value)}
                        placeholder="Provider default pending"
                        inputMode="decimal"
                        style={{
                          width: "100%",
                          border: "1px solid #cbd5e1",
                          borderRadius: 10,
                          padding: "10px 12px",
                          background: "#fff",
                          color: "#0f172a",
                          fontWeight: 800,
                          outline: "none",
                        }}
                      />
                    </label>

                    <label className="barsh-direct-payment-field">
                      <span>Interest Amount</span>
                      <div style={{ position: "relative", width: "100%" }}>
                        <span
                          style={{
                            position: "absolute",
                            left: 12,
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "#475569",
                            fontWeight: 900,
                            pointerEvents: "none",
                          }}
                        >
                          $
                        </span>
                        <input
                          value={masterSettlementInterestAmountInput}
                          onChange={(event) => setMasterSettlementInterestAmountInput(event.target.value)}
                          onBlur={() => setMasterSettlementInterestAmountInput((current) => formatMasterSettlementMoneyInput(current))}
                          placeholder="0.00"
                          inputMode="decimal"
                          style={{
                            width: "100%",
                            border: "1px solid #cbd5e1",
                            borderRadius: 10,
                            padding: "10px 12px 10px 28px",
                            background: "#fff",
                            color: "#0f172a",
                            fontWeight: 800,
                            outline: "none",
                          }}
                        />
                      </div>
                    </label>

                    <label className="barsh-direct-payment-field">
                      <span>Interest Fee %</span>
                      <input
                        value={masterSettlementInterestFeePercentInput}
                        onChange={(event) => setMasterSettlementInterestFeePercentInput(event.target.value)}
                        placeholder="Provider default pending"
                        inputMode="decimal"
                        style={{
                          width: "100%",
                          border: "1px solid #cbd5e1",
                          borderRadius: 10,
                          padding: "10px 12px",
                          background: "#fff",
                          color: "#0f172a",
                          fontWeight: 800,
                          outline: "none",
                        }}
                      />
                    </label>

                    <label className="barsh-direct-payment-field" style={{ gridColumn: "2 / span 2" }}>
                      <span>Notes</span>
                      <input
                        value={masterSettlementNotesInput}
                        onChange={(event) => setMasterSettlementNotesInput(event.target.value)}
                        placeholder="Optional settlement notes"
                        style={{
                          width: "100%",
                          border: "1px solid #cbd5e1",
                          borderRadius: 10,
                          padding: "10px 12px",
                          background: "#fff",
                          color: "#0f172a",
                          fontWeight: 800,
                          outline: "none",
                        }}
                      />
                    </label>
                  </div>

                  <div
                    className="barsh-direct-payment-preview"
                    style={{
                      margin: "0 18px 18px",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr 1fr",
                      gap: 10,
                    }}
                  >
                    <div>Gross Settlement: {money(masterSettlementGrossValue())}</div>
                    <div>Interest: {money(masterSettlementInterestValue())}</div>
                    <div>Principal Fee %: {masterSettlementPercentValue(masterSettlementPrincipalFeePercentInput).toFixed(2)}%</div>
                    <div>Interest Fee %: {masterSettlementPercentValue(masterSettlementInterestFeePercentInput).toFixed(2)}%</div>
                    <div
                      style={{
                        gridColumn: "1 / -1",
                        padding: "8px 10px",
                        border: "1px solid #bae6fd",
                        borderRadius: 10,
                        background: "#e0f2fe",
                        color: "#075985",
                        fontWeight: 900,
                      }}
                    >
                      This is a local settlement draft only.  It does not run Clio contact search, settlement preview, settlement writeback, document generation, or Close Paid Settlements.
                    </div>
                  </div>

                  <div
                    style={{
                      margin: "0 18px 18px",
                      border: "1px solid #dbe4f0",
                      borderRadius: 14,
                      overflow: "hidden",
                      background: "#ffffff",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid #e2e8f0",
                        background: "#f8fafc",
                        fontSize: 12,
                        fontWeight: 950,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "#475569",
                      }}
                    >
                      Settlement Allocation Preview
                    </div>

                    <div style={{ overflowX: "auto" }}>
                      <table
                        style={{
                          width: "100%",
                          minWidth: 820,
                          borderCollapse: "collapse",
                          fontSize: 12,
                          color: "#0f172a",
                        }}
                      >
                        <thead>
                          <tr style={{ background: "#e2e8f0" }}>
                            <th style={{ textAlign: "left", padding: "8px 10px", border: "1px solid #cbd5e1" }}>Matter</th>
                            <th style={{ textAlign: "left", padding: "8px 10px", border: "1px solid #cbd5e1" }}>Provider</th>
                            <th style={{ textAlign: "left", padding: "8px 10px", border: "1px solid #cbd5e1" }}>Patient</th>
                            <th style={{ textAlign: "right", padding: "8px 10px", border: "1px solid #cbd5e1" }}>Bill Amount</th>
                            <th style={{ textAlign: "right", padding: "8px 10px", border: "1px solid #cbd5e1" }}>Allocation %</th>
                            <th style={{ textAlign: "right", padding: "8px 10px", border: "1px solid #cbd5e1" }}>Settled Principal</th>
                            <th style={{ textAlign: "right", padding: "8px 10px", border: "1px solid #cbd5e1" }}>Expected Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {masterWorkspaceBillRows(masterSettlementDetailRows).map((row: any) => {
                            const rowId = clean(row.id);
                            const billAmount = masterWorkspaceBillAmount(row);
                            const billTotal = masterWorkspaceBillTotal(masterSettlementDetailRows);
                            const allocationPercent = billTotal > 0 ? (billAmount / billTotal) * 100 : 0;
                            const settledPrincipal =
                              billTotal > 0
                                ? Math.min(masterSettlementGrossValue() * (billAmount / billTotal), billAmount)
                                : 0;
                            const expectedBalance = Math.max(billAmount - settledPrincipal, 0);

                            return (
                              <tr key={`master-settlement-popup-${rowId}`}>
                                <td style={{ padding: "8px 10px", border: "1px solid #e5e7eb", fontWeight: 900 }}>
                                  {clean(row.displayNumber) || rowId}
                                </td>
                                <td style={{ padding: "8px 10px", border: "1px solid #e5e7eb" }}>
                                  {clean(row.provider) || "—"}
                                </td>
                                <td style={{ padding: "8px 10px", border: "1px solid #e5e7eb" }}>
                                  {clean(row.patient) || "—"}
                                </td>
                                <td style={{ padding: "8px 10px", border: "1px solid #e5e7eb", textAlign: "right", fontWeight: 900 }}>
                                  {money(billAmount)}
                                </td>
                                <td style={{ padding: "8px 10px", border: "1px solid #e5e7eb", textAlign: "right" }}>
                                  {allocationPercent.toFixed(2)}%
                                </td>
                                <td style={{ padding: "8px 10px", border: "1px solid #e5e7eb", textAlign: "right", fontWeight: 950, color: "#1d4ed8" }}>
                                  {money(settledPrincipal)}
                                </td>
                                <td style={{ padding: "8px 10px", border: "1px solid #e5e7eb", textAlign: "right", fontWeight: 950 }}>
                                  {money(expectedBalance)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 14,
                      padding: "14px 18px",
                      borderTop: "1px solid #e5e7eb",
                      background: "#f8fafc",
                      borderBottomLeftRadius: 22,
                      borderBottomRightRadius: 22,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        resetMasterSettlementPreviewForm();
                        setMasterSettlementFormOpen(false);
                      }}
                      style={{
                        minWidth: 132,
                        height: 44,
                        border: "1px solid #dc2626",
                        borderRadius: 12,
                        background: "#dc2626",
                        color: "#fff",
                        fontWeight: 900,
                        fontSize: 15,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={resetMasterSettlementPreviewForm}
                      style={{
                        minWidth: 132,
                        height: 44,
                        border: "1px solid #cbd5e1",
                        borderRadius: 12,
                        background: "#ffffff",
                        color: "#334155",
                        fontWeight: 900,
                        fontSize: 15,
                        cursor: "pointer",
                      }}
                    >
                      Clear
                    </button>

                    <button
                      type="button"
                      disabled
                      title="Preview only.  Settlement API/writeback will be wired after UI behavior is confirmed."
                      style={{
                        minWidth: 250,
                        height: 44,
                        border: "1px solid #bfdbfe",
                        borderRadius: 12,
                        background: "#dbeafe",
                        color: "#1d4ed8",
                        fontWeight: 950,
                        fontSize: 15,
                        cursor: "not-allowed",
                      }}
                    >
                      Preview Only — No Writeback
                    </button>
                  </div>
                </div>
              </div>
            )}



            {masterAuditHistoryOpen && kind === "master" && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Master Lawsuit Audit History"
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 50000,
                  display: "block",
                  padding: 0,
                  overflow: "hidden",
                  background: "rgba(15, 23, 42, 0.58)",
                }}
                onClick={closeMasterAuditHistoryPopup}
              >
                <div
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    position: "fixed",
                    top: 104,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "min(1120px, 96vw)",
                    maxHeight: "calc(100vh - 178px)",
                    overflowY: "auto",
                    border: "1px solid #bfdbfe",
                    borderRadius: 22,
                    background: "#ffffff",
                    boxShadow: "0 30px 90px rgba(15, 23, 42, 0.38)",
                  }}
                >
                  <div
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "16px 18px",
                      borderBottom: "1px solid #dbe4f0",
                      background: "#eff6ff",
                      borderTopLeftRadius: 22,
                      borderTopRightRadius: 22,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 950,
                          color: "#1d4ed8",
                        }}
                      >
                        Matter-Specific Audit / History
                      </div>
                      <div
                        style={{
                          marginTop: 3,
                          fontSize: 12,
                          fontWeight: 800,
                          color: "#1e40af",
                        }}
                      >
                        Master Lawsuit {clean(value) || "—"} · Local database audit log.
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={loadMasterAuditHistory}
                        disabled={masterAuditHistoryLoading}
                        style={{
                          minWidth: 98,
                          height: 38,
                          border: "1px solid #bfdbfe",
                          borderRadius: 999,
                          background: "#ffffff",
                          color: "#1d4ed8",
                          fontWeight: 900,
                          cursor: masterAuditHistoryLoading ? "default" : "pointer",
                        }}
                      >
                        {masterAuditHistoryLoading ? "Loading..." : "Refresh"}
                      </button>

                      <button
                        type="button"
                        onClick={closeMasterAuditHistoryPopup}
                        style={{
                          width: 38,
                          height: 38,
                          border: "1px solid #cbd5e1",
                          borderRadius: 999,
                          background: "#ffffff",
                          color: "#64748b",
                          fontSize: 26,
                          fontWeight: 900,
                          cursor: "pointer",
                          lineHeight: 1,
                        }}
                        aria-label="Close audit history popup"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div style={{ padding: 18 }}>
                    {masterAuditHistoryError && (
                      <div
                        style={{
                          marginBottom: 14,
                          padding: 12,
                          borderRadius: 14,
                          border: "1px solid #fecaca",
                          background: "#fef2f2",
                          color: "#991b1b",
                          fontWeight: 800,
                        }}
                      >
                        {masterAuditHistoryError}
                      </div>
                    )}

                    {masterAuditHistoryLoading && masterAuditHistoryEntries.length === 0 ? (
                      <div
                        style={{
                          padding: 18,
                          borderRadius: 16,
                          border: "1px solid #dbe4f0",
                          background: "#f8fafc",
                          color: "#475569",
                          fontWeight: 800,
                        }}
                      >
                        Loading audit history...
                      </div>
                    ) : masterAuditHistoryEntries.length === 0 ? (
                      <div
                        style={{
                          padding: 18,
                          borderRadius: 16,
                          border: "1px solid #dbe4f0",
                          background: "#f8fafc",
                          color: "#475569",
                          fontWeight: 800,
                        }}
                      >
                        No audit history entries found for this master lawsuit yet.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 12 }}>
                        {masterAuditHistoryEntries.map((entry) => (
                          <article
                            key={entry.id}
                            style={{
                              display: "grid",
                              gap: 10,
                              padding: 14,
                              borderRadius: 18,
                              border: "1px solid #dbe4f0",
                              background: "#ffffff",
                              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 12,
                                alignItems: "flex-start",
                              }}
                            >
                              <div>
                                <div style={{ fontSize: 15, fontWeight: 950, color: "#0f172a" }}>
                                  {entry.summary || entry.action || "Audit entry"}
                                </div>
                                <div style={{ marginTop: 4, fontSize: 12, color: "#64748b", fontWeight: 750 }}>
                                  {formatMasterAuditTimestamp(entry.createdAt)} · {entry.actorName || entry.actorEmail || "Unknown user"} · {entry.sourcePage || "unknown source"}
                                </div>
                              </div>

                              <div
                                style={{
                                  padding: "5px 9px",
                                  borderRadius: 999,
                                  border: "1px solid #bfdbfe",
                                  background: "#eff6ff",
                                  color: "#1d4ed8",
                                  fontSize: 12,
                                  fontWeight: 900,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {entry.action || "audit"}
                              </div>
                            </div>

                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                                gap: 10,
                              }}
                            >
                              <div style={{ display: "grid", gap: 3 }}>
                                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 900, textTransform: "uppercase" }}>Field</span>
                                <strong style={{ fontSize: 13, color: "#0f172a" }}>{entry.fieldName || "—"}</strong>
                              </div>

                              <div style={{ display: "grid", gap: 3 }}>
                                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 900, textTransform: "uppercase" }}>Prior Value</span>
                                <strong style={{ fontSize: 13, color: "#0f172a", overflowWrap: "anywhere" }}>{formatMasterAuditValue(entry.priorValue)}</strong>
                              </div>

                              <div style={{ display: "grid", gap: 3 }}>
                                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 900, textTransform: "uppercase" }}>New Value</span>
                                <strong style={{ fontSize: 13, color: "#0f172a", overflowWrap: "anywhere" }}>{formatMasterAuditValue(entry.newValue)}</strong>
                              </div>

                              <div style={{ display: "grid", gap: 3 }}>
                                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 900, textTransform: "uppercase" }}>Matter</span>
                                <strong style={{ fontSize: 13, color: "#0f172a" }}>{entry.masterMatterDisplayNumber || entry.matterDisplayNumber || "—"}</strong>
                              </div>
                            </div>

                            {Array.isArray(entry.affectedMatterIds) && entry.affectedMatterIds.length > 0 && (
                              <div style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>
                                Affected matter IDs: {entry.affectedMatterIds.join(", ")}
                              </div>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {masterPaymentFormOpen && activeMasterWorkspaceTab === "payments" && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Lawsuit payment preview popup"
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 50000,
                  display: "block",
                  padding: 0,
                  background: "rgba(15, 23, 42, 0.58)",
                }}
                onClick={() => setMasterPaymentFormOpen(false)}
              >
                <div
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    position: "fixed",
                    top: 104,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "min(1080px, 96vw)",
                    maxHeight: "calc(100vh - 178px)",
                    overflowY: "auto",
                    border: "1px solid #bbf7d0",
                    borderRadius: 22,
                    background: "#ffffff",
                    boxShadow: "0 30px 90px rgba(15, 23, 42, 0.38)",
                  }}
                >
                  <div
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      padding: "16px 18px",
                      borderBottom: "1px solid #dbe4f0",
                      background: "#f0fdf4",
                      borderTopLeftRadius: 22,
                      borderTopRightRadius: 22,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 950,
                          color: "#14532d",
                        }}
                      >
                        Lawsuit Payment Preview
                      </div>
                      <div
                        style={{
                          marginTop: 3,
                          fontSize: 12,
                          fontWeight: 800,
                          color: "#166534",
                        }}
                      >
                        Master Lawsuit Payment · Local child-bill receipts, no Clio writeback.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        resetMasterPaymentPreviewForm();
                        setMasterPaymentFormOpen(false);
                      }}
                      style={{
                        width: 38,
                        height: 38,
                        border: "1px solid #cbd5e1",
                        borderRadius: 999,
                        background: "#ffffff",
                        color: "#64748b",
                        fontSize: 26,
                        fontWeight: 900,
                        cursor: "pointer",
                        lineHeight: 1,
                      }}
                      aria-label="Close lawsuit payment preview popup"
                    >
                      ×
                    </button>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.25fr 1fr 1fr",
                      gap: 16,
                      padding: 18,
                    }}
                  >
                    <label className="barsh-direct-payment-field">
                      <span>Transaction Type *</span>
                      <select
                        value={masterPaymentTransactionTypeInput}
                        onChange={(event) => setMasterPaymentTransactionTypeInput(event.target.value)}
                        style={{
                          width: "100%",
                          border: "1px solid #cbd5e1",
                          borderRadius: 10,
                          padding: "10px 12px",
                          background: "#fff",
                          color: "#0f172a",
                          fontWeight: 700,
                          outline: "none",
                        }}
                      >
                        <option value="Collection Payment">Collection Payment</option>
                        <option value="Voluntary Payment">Voluntary Payment</option>
                        <option value="Attorney Fee">Attorney Fee</option>
                        <option value="Index Fee Collected">Index Fee Collected</option>
                        <option value="Index Fee Billed">Index Fee Billed</option>
                        <option value="Interest">Interest</option>
                        <option value="PreC to Provider">PreC to Provider</option>
                        <option value="Service Fee Collected">Service Fee Collected</option>
                        <option value="Service Fee Billed">Service Fee Billed</option>
                        <option value="Other Court Fees Collected">Other Court Fees Collected</option>
                        <option value="Other Court Fees Billed">Other Court Fees Billed</option>
                      </select>
                    </label>

                    <label className="barsh-direct-payment-field">
                      <span>Transaction Status *</span>
                      <select
                        value={masterPaymentTransactionStatusInput}
                        onChange={(event) => setMasterPaymentTransactionStatusInput(event.target.value)}
                        style={{
                          width: "100%",
                          border: "1px solid #cbd5e1",
                          borderRadius: 10,
                          padding: "10px 12px",
                          background: "#fff",
                          color: "#0f172a",
                          fontWeight: 700,
                          outline: "none",
                        }}
                      >
                        <option value="Show on Remittance">Show on Remittance</option>
                        <option value="Do Not Show on Remittance">Do Not Show on Remittance</option>
                      </select>
                    </label>

                    <label className="barsh-direct-payment-field">
                      <span>Transaction Date *</span>
                      <input
                        type="date"
                        value={masterPaymentDateInput}
                        onChange={(event) => setMasterPaymentDateInput(event.target.value)}
                        style={{
                          width: "100%",
                          border: "1px solid #cbd5e1",
                          borderRadius: 10,
                          padding: "10px 12px",
                          background: "#fff",
                          color: "#0f172a",
                          fontWeight: 800,
                          outline: "none",
                        }}
                      />
                    </label>

                    <label className="barsh-direct-payment-field">
                      <span>Amount *</span>
                      <div style={{ position: "relative", width: "100%" }}>
                        <span
                          style={{
                            position: "absolute",
                            left: 12,
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "#475569",
                            fontWeight: 900,
                            pointerEvents: "none",
                          }}
                        >
                          $
                        </span>
                        <input
                          value={masterPaymentAmountInput}
                          onChange={(event) => setMasterPaymentAmountInput(event.target.value)}
                          onBlur={() => setMasterPaymentAmountInput((current) => formatMasterPaymentAmountInput(current))}
                          placeholder="0.00"
                          inputMode="decimal"
                          style={{
                            width: "100%",
                            border: "1px solid #cbd5e1",
                            borderRadius: 10,
                            padding: "10px 12px 10px 28px",
                            background: "#fff",
                            color: "#0f172a",
                            fontWeight: 800,
                            outline: "none",
                          }}
                        />
                      </div>
                    </label>

                    <label className="barsh-direct-payment-field">
                      <span>Check Date</span>
                      <input
                        type="date"
                        value={masterPaymentCheckDateInput}
                        onChange={(event) => setMasterPaymentCheckDateInput(event.target.value)}
                        style={{
                          width: "100%",
                          border: "1px solid #cbd5e1",
                          borderRadius: 10,
                          padding: "10px 12px",
                          background: "#fff",
                          color: "#0f172a",
                          fontWeight: 800,
                          outline: "none",
                        }}
                      />
                    </label>

                    <label className="barsh-direct-payment-field">
                      <span>Check Number</span>
                      <input
                        value={masterPaymentCheckNumberInput}
                        onChange={(event) => setMasterPaymentCheckNumberInput(event.target.value)}
                        placeholder="Check number"
                        style={{
                          width: "100%",
                          border: "1px solid #cbd5e1",
                          borderRadius: 10,
                          padding: "10px 12px",
                          background: "#fff",
                          color: "#0f172a",
                          fontWeight: 800,
                          outline: "none",
                        }}
                      />
                    </label>
                  </div>

                  <div
                    className="barsh-direct-payment-preview"
                    style={{
                      margin: "0 18px 18px",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: 10,
                    }}
                  >
                    <div>Payment Amount: {money(masterPaymentPreviewAmountValue())}</div>
                    <div>Expected Payments Posted: {money(masterPaymentSummary.paymentsPosted + masterPaymentPreviewAmountValue())}</div>
                    <div>Expected Balance Presuit: {money(Math.max(masterPaymentSummary.balancePresuit - masterPaymentPreviewAmountValue(), 0))}</div>
                    <div
                      style={{
                        gridColumn: "1 / -1",
                        padding: "8px 10px",
                        border: "1px solid #bae6fd",
                        borderRadius: 10,
                        background: "#e0f2fe",
                        color: "#075985",
                        fontWeight: 900,
                      }}
                    >
                      This posts local Barsh Matters payment receipts to the child bill matters.  No Clio writeback occurs.
                    </div>
                  </div>

                  <div
                    style={{
                      margin: "0 18px 18px",
                      border: "1px solid #dbe4f0",
                      borderRadius: 14,
                      overflow: "hidden",
                      background: "#ffffff",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid #e2e8f0",
                        background: "#f8fafc",
                        fontSize: 12,
                        fontWeight: 950,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "#475569",
                      }}
                    >
                      Allocation Preview
                    </div>

                    <div style={{ overflowX: "auto" }}>
                      <table
                        style={{
                          width: "100%",
                          minWidth: 760,
                          borderCollapse: "collapse",
                          fontSize: 12,
                          color: "#0f172a",
                        }}
                      >
                        <thead>
                          <tr style={{ background: "#e2e8f0" }}>
                            <th style={{ textAlign: "left", padding: "8px 10px", border: "1px solid #cbd5e1" }}>Matter</th>
                            <th style={{ textAlign: "left", padding: "8px 10px", border: "1px solid #cbd5e1" }}>Provider</th>
                            <th style={{ textAlign: "left", padding: "8px 10px", border: "1px solid #cbd5e1" }}>Patient</th>
                            <th style={{ textAlign: "right", padding: "8px 10px", border: "1px solid #cbd5e1" }}>Bill Amount</th>
                            <th style={{ textAlign: "right", padding: "8px 10px", border: "1px solid #cbd5e1" }}>Allocation %</th>
                            <th style={{ textAlign: "right", padding: "8px 10px", border: "1px solid #cbd5e1" }}>Payment To Post</th>
                            <th style={{ textAlign: "right", padding: "8px 10px", border: "1px solid #cbd5e1" }}>Expected Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {masterPaymentAllocationRows().map((item: any) => {
                            const row = item.row;
                            const billTotal = masterWorkspaceBillTotal(masterSettlementDetailRows);
                            const allocationPercent = billTotal > 0 ? (item.billAmount / billTotal) * 100 : 0;

                            return (
                              <tr key={`master-payment-popup-${item.displayNumber || item.rowId}`}>
                                <td style={{ padding: "8px 10px", border: "1px solid #e5e7eb", fontWeight: 900 }}>
                                  {item.displayNumber || item.rowId}
                                </td>
                                <td style={{ padding: "8px 10px", border: "1px solid #e5e7eb" }}>
                                  {clean(row.provider) || "—"}
                                </td>
                                <td style={{ padding: "8px 10px", border: "1px solid #e5e7eb" }}>
                                  {clean(row.patient) || "—"}
                                </td>
                                <td style={{ padding: "8px 10px", border: "1px solid #e5e7eb", textAlign: "right", fontWeight: 900 }}>
                                  {money(item.billAmount)}
                                </td>
                                <td style={{ padding: "8px 10px", border: "1px solid #e5e7eb", textAlign: "right" }}>
                                  {allocationPercent.toFixed(2)}%
                                </td>
                                <td style={{ padding: "8px 10px", border: "1px solid #e5e7eb", textAlign: "right", fontWeight: 950, color: "#166534" }}>
                                  {money(item.paymentToPost)}
                                </td>
                                <td style={{ padding: "8px 10px", border: "1px solid #e5e7eb", textAlign: "right", fontWeight: 950 }}>
                                  {money(item.expectedBalance)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 14,
                      padding: "14px 18px",
                      borderTop: "1px solid #e5e7eb",
                      background: "#f8fafc",
                      borderBottomLeftRadius: 22,
                      borderBottomRightRadius: 22,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        resetMasterPaymentPreviewForm();
                        setMasterPaymentFormOpen(false);
                      }}
                      style={{
                        minWidth: 132,
                        height: 44,
                        border: "1px solid #dc2626",
                        borderRadius: 12,
                        background: "#dc2626",
                        color: "#fff",
                        fontWeight: 900,
                        fontSize: 15,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={resetMasterPaymentPreviewForm}
                      style={{
                        minWidth: 132,
                        height: 44,
                        border: "1px solid #cbd5e1",
                        borderRadius: 12,
                        background: "#ffffff",
                        color: "#334155",
                        fontWeight: 900,
                        fontSize: 15,
                        cursor: "pointer",
                      }}
                    >
                      Clear
                    </button>

                    <button
                      type="button"
                      disabled={masterPaymentPosting}
                      onClick={postMasterPaymentLocally}
                      title="Post local Barsh Matters payment receipts to the child bill matters.  No Clio writeback will occur."
                      style={{
                        minWidth: 190,
                        height: 44,
                        border: "1px solid #16a34a",
                        borderRadius: 12,
                        background: masterPaymentPosting ? "#bbf7d0" : "#16a34a",
                        color: masterPaymentPosting ? "#166534" : "#ffffff",
                        fontWeight: 950,
                        fontSize: 15,
                        cursor: masterPaymentPosting ? "not-allowed" : "pointer",
                      }}
                    >
                      {masterPaymentPosting ? "Posting..." : "Post Payment"}
                    </button>
                  </div>
                </div>
              </div>
            )}


            <div style={masterWorkspaceBillListStyle}>
              <div style={masterSettlementDetailsTitleStyle}>
                {activeMasterWorkspaceTab === "documents"
                  ? "Lawsuit Bills"
                  : activeMasterWorkspaceTab === "payments"
                    ? "Lawsuit Bills"
                    : "Close Review Bills"}
              </div>

              <div style={masterSettlementTableWrapStyle}>
                <table style={masterSettlementTableStyle}>
                  <thead>
                    <tr>
                      <th style={masterSettlementThStyle}>Matter</th>
                      <th style={masterSettlementThStyle}>Provider</th>
                      <th style={masterSettlementThStyle}>Patient</th>
                      <th style={masterSettlementThStyle}>DOS</th>
                      <th style={masterSettlementThStyle}>Denial Reason</th>
                      <th style={masterSettlementRightThStyle}>Bill Amount</th>
                      <th style={masterSettlementRightThStyle}>Pre-Suit Payment</th>
                      <th style={masterSettlementRightThStyle}>Balance</th>
                      <th style={masterSettlementThStyle}>Insurer</th>
                      <th style={masterSettlementThStyle}>Claim Number</th>
                    </tr>
                  </thead>
                  <tbody>
                    {masterWorkspaceBillRows(masterSettlementDetailRows).map((row: any) => {
                      const rowId = clean(row.id);
                      const billAmount = masterWorkspaceBillAmount(row);
                      const balanceAmount = Number(row.balancePresuit ?? row.balance_presuit ?? row.balance ?? billAmount) || 0;
                      const preSuitPaymentAmount = Math.max(billAmount - balanceAmount, 0);
                      const dosStart = clean(row.dosStart ?? row.dos_start ?? row.serviceStart ?? row.service_start ?? "");
                      const dosEnd = clean(row.dosEnd ?? row.dos_end ?? row.serviceEnd ?? row.service_end ?? "");
                      const dosLabel =
                        dosStart && dosEnd && dosStart !== dosEnd
                          ? `${dosStart} – ${dosEnd}`
                          : dosStart || dosEnd || clean(row.dos) || "—";
                      const denialReason = clean(row.denialReason ?? row.denial_reason ?? row.closeReason ?? row.close_reason ?? "");
                      const insurer = clean(row.insurer ?? row.insuranceCompany ?? row.insurance_company ?? "");
                      const claimNumber = clean(row.claimNumber ?? row.claim_number ?? "");

                      return (
                        <tr key={rowId}>
                          <td style={masterSettlementTdStyle}>
                            <a href={`/matter/${encodeURIComponent(clean(row.displayNumber) || clean(row.display_number) || rowId)}`} style={matterLinkStyle}>
                              {clean(row.displayNumber) || rowId}
                            </a>
                          </td>
                          <td style={masterSettlementTdStyle}>
                            {clean(row.provider) ? (
                              <a
                                href={filteredUrl("provider", row.provider)}
                                className="barsh-filter-field-link"
                                style={fieldLinkStyle}
                              >
                                {clean(row.provider)}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td style={masterSettlementTdStyle}>
                            {clean(row.patient) ? (
                              <a
                                href={filteredUrl("patient", row.patient)}
                                className="barsh-filter-field-link"
                                style={fieldLinkStyle}
                              >
                                {clean(row.patient)}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td style={masterSettlementTdStyle}>{dosLabel}</td>
                          <td style={masterSettlementTdStyle}>{denialReason || "—"}</td>
                          <td style={masterSettlementMoneyTdStyle}>{money(billAmount)}</td>
                          <td style={masterSettlementMoneyTdStyle}>{money(preSuitPaymentAmount)}</td>
                          <td style={masterSettlementMoneyTdStyle}>{money(balanceAmount)}</td>
                          <td style={masterSettlementTdStyle}>
                            {insurer ? (
                              <a
                                href={filteredUrl("insurer", insurer)}
                                className="barsh-filter-field-link"
                                style={fieldLinkStyle}
                              >
                                {insurer}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td style={masterSettlementTdStyle}>
                            {claimNumber ? (
                              <a
                                href={filteredUrl("claim", claimNumber)}
                                className="barsh-filter-field-link"
                                style={fieldLinkStyle}
                              >
                                {claimNumber}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={masterSettlementTotalRowStyle}>
                      <td style={masterSettlementTdStyle}>Total</td>
                      <td style={masterSettlementTdStyle}></td>
                      <td style={masterSettlementTdStyle}></td>
                      <td style={masterSettlementTdStyle}></td>
                      <td style={masterSettlementTdStyle}></td>
                      <td style={masterSettlementMoneyTdStyle}>{money(masterWorkspaceBillTotal(masterSettlementDetailRows))}</td>
                      <td style={masterSettlementMoneyTdStyle}>
                        {money(
                          masterWorkspaceBillRows(masterSettlementDetailRows).reduce((sum: number, row: any) => {
                            const billAmount = masterWorkspaceBillAmount(row);
                            const balanceAmount = Number(row.balancePresuit ?? row.balance_presuit ?? row.balance ?? billAmount) || 0;
                            return sum + Math.max(billAmount - balanceAmount, 0);
                          }, 0)
                        )}
                      </td>
                      <td style={masterSettlementMoneyTdStyle}>
                        {money(
                          masterWorkspaceBillRows(masterSettlementDetailRows).reduce((sum: number, row: any) => {
                            const billAmount = masterWorkspaceBillAmount(row);
                            const balanceAmount = Number(row.balancePresuit ?? row.balance_presuit ?? row.balance ?? billAmount) || 0;
                            return sum + balanceAmount;
                          }, 0)
                        )}
                      </td>
                      <td style={masterSettlementTdStyle}></td>
                      <td style={masterSettlementTdStyle}></td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>
          </section>
        )}

        {error && <div style={errorStyle}>{error}</div>}

        {!loading && !error && rows.length === 0 && (
          <div style={emptyStyle}>No matching matters were returned for this filter.</div>
        )}

        {kind !== "master" && rows.length > 0 && (
          <section style={tablePanelStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Matter</th>
                  <th style={thStyle}>Patient</th>
                  <th style={thStyle}>Provider</th>
                  <th style={thStyle}>Insurer</th>
                  <th style={thStyle}>Claim</th>
                  <th style={thStyle}>Master Lawsuit</th>
                  <th style={rightThStyle}>Claim Amount</th>
                  <th style={rightThStyle}>Balance</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="barsh-filter-row">
                    <td style={tdStyle}>
                      <a href={`/matter/${encodeURIComponent(displayNumber(row) || String(row.id))}`} style={matterLinkStyle}>
                        {row.displayNumber || row.id}
                      </a>
                    </td>
                    <td style={tdStyle}>
                      {row.patient ? (
                        <a
                          href={filteredUrl("patient", row.patient)}
                          className="barsh-filter-field-link"
                          style={fieldLinkStyle}
                        >
                          {row.patient}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={tdStyle}>
                      {row.provider ? (
                        <a
                          href={filteredUrl("provider", row.provider)}
                          className="barsh-filter-field-link"
                          style={fieldLinkStyle}
                        >
                          {row.provider}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={tdStyle}>
                      {row.insurer ? (
                        <a
                          href={filteredUrl("insurer", row.insurer)}
                          className="barsh-filter-field-link"
                          style={fieldLinkStyle}
                        >
                          {row.insurer}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={tdStyle}>
                      {row.claimNumber ? (
                        <a
                          href={filteredUrl("claim", row.claimNumber)}
                          className="barsh-filter-field-link"
                          style={fieldLinkStyle}
                        >
                          {row.claimNumber}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={tdStyle}>{row.masterLawsuitId || "—"}</td>
                    <td style={rightTdStyle}>{money(row.claimAmount)}</td>
                    <td style={rightTdStyle}>{money(row.balancePresuit)}</td>
                    <td style={tdStyle}>
                      <div style={actionStackStyle}>
                        <a href={`/matter/${encodeURIComponent(displayNumber(row) || String(row.id))}`} className="barsh-filter-open-link" style={openLinkStyle}>
                          Open Matter
                        </a>

                        {row.patient && (
                          <a href={`/matters?workflow=patient&patient=${encodeURIComponent(row.patient)}&fromMatter=${encodeURIComponent(String(row.id))}`} style={secondaryActionLinkStyle}>
                            Launch Patient
                          </a>
                        )}

                        {row.claimNumber && (
                          <a href={`/matters?workflow=claim&claim=${encodeURIComponent(row.claimNumber)}&fromMatter=${encodeURIComponent(String(row.id))}`} style={secondaryActionLinkStyle}>
                            Launch Claim
                          </a>
                        )}

                        {row.masterLawsuitId && (
                          <a href={filteredUrl("master", row.masterLawsuitId)} style={secondaryActionLinkStyle}>
                            Open Lawsuit
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  padding: "12px 14px 30px",
  width: "100vw",
  maxWidth: "none",
  marginLeft: "calc(50% - 50vw)",
  marginRight: "calc(50% - 50vw)",
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  color: colors.ink,
  background: "#f8fafc",
  minHeight: "100vh",
};

const shellStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "none",
  margin: 0,
};

const topBarStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 10000,
  isolation: "isolate",
  display: "grid",
  gridTemplateColumns: "500px minmax(0, 1fr) 330px",
  alignItems: "start",
  gap: 16,
  marginBottom: 10,
  padding: "4px 0 12px",
  background: "#f8fafc",
  backdropFilter: "blur(10px)",
  boxShadow: "none",
  borderBottom: "1px solid rgba(203, 213, 225, 0.45)",
};

const leftLogoWrapStyle: React.CSSProperties = {
  gridColumn: "1",
  display: "flex",
  justifyContent: "flex-start",
  alignItems: "flex-start",
};

const rightTopWrapStyle: React.CSSProperties = {
  gridColumn: "3",
  justifySelf: "end",
  position: "relative",
  width: 330,
  height: 152,
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "flex-start",
};

const printButtonRowStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  right: 218,
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: 8,
  flexWrap: "nowrap",
};

const bmLogoLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "flex-start",
  justifyContent: "flex-end",
  textDecoration: "none",
};

const brlLogoStyle: React.CSSProperties = {
  width: 190,
  height: 126,
  objectFit: "contain",
  display: "block",
};

const bmLogoStyle: React.CSSProperties = {
  width: 330,
  height: 152,
  objectFit: "contain",
  objectPosition: "right top",
  display: "block",
};

const lockedPrintQueueButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "7px 11px",
  border: "1px solid #cbd5e1",
  borderRadius: 999,
  background: "#f8fafc",
  color: colors.muted,
  fontSize: 12,
  fontWeight: 750,
  whiteSpace: "nowrap",
  cursor: "not-allowed",
  opacity: 0.9,
};

const summaryPanelStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 16,
  alignItems: "center",
  padding: 24,
  border: "none",
  borderRadius: 28,
  background: "#f8fafc",
  boxShadow: "0 10px 26px rgba(15, 23, 42, 0.05)",
  marginBottom: 18,
};

const eyebrowStyle: React.CSSProperties = {
  color: colors.subtle,
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: "0.12em",
  marginBottom: 8,
};

const filterBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  width: "fit-content",
  padding: "4px 9px",
  border: "1px solid #dbe3ee",
  borderRadius: 999,
  background: "#f8fafc",
  color: colors.subtle,
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 8,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 30,
  lineHeight: 1.15,
  letterSpacing: "-0.04em",
};

const subTitleStyle: React.CSSProperties = {
  marginTop: 8,
  color: colors.muted,
  fontSize: 14,
  fontWeight: 750,
};

const summaryStatsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  gap: 12,
};

const statBoxStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 145,
  padding: "12px 14px",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "#f8fafc",
};

const statLabelStyle: React.CSSProperties = {
  color: colors.subtle,
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.06em",
};

const backButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px 18px",
  border: "1px solid #b6c7e3",
  borderRadius: 16,
  background: "#f8fbff",
  color: colors.blueDark,
  textDecoration: "none",
  fontWeight: 900,
  fontSize: 14,
  transition: "background 140ms ease, border-color 140ms ease, transform 140ms ease",
};

const tablePanelStyle: React.CSSProperties = {
  border: "1px solid " + colors.line,
  borderRadius: 20,
  overflow: "hidden",
  background: "#ffffff",
  boxShadow: "0 10px 26px rgba(15, 23, 42, 0.04)",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const thStyle: React.CSSProperties = {
  padding: "12px 10px",
  borderBottom: "1px solid #cbd5e1",
  background: "#eef4fb",
  textAlign: "left",
  color: colors.ink,
  fontWeight: 900,
};

const rightThStyle: React.CSSProperties = {
  ...thStyle,
  textAlign: "right",
};

const tdStyle: React.CSSProperties = {
  padding: "11px 10px",
  borderBottom: "1px solid #e5e7eb",
  verticalAlign: "middle",
  color: colors.ink,
};

const rightTdStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

const matterLinkStyle: React.CSSProperties = {
  color: colors.blueDark,
  fontWeight: 900,
  textDecoration: "underline",
  textUnderlineOffset: 2,
};

const openLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "8px 11px",
  border: "1px solid #b6c7e3",
  borderRadius: 10,
  color: colors.blueDark,
  textDecoration: "none",
  fontWeight: 900,
  background: "#f8fbff",
  whiteSpace: "nowrap",
  transition: "background 140ms ease, border-color 140ms ease, transform 140ms ease",
};

const errorStyle: React.CSSProperties = {
  padding: 14,
  border: "1px solid " + colors.errorBorder,
  borderRadius: 14,
  background: colors.errorBg,
  color: "#991b1b",
  fontSize: 14,
  fontWeight: 750,
};

const emptyStyle: React.CSSProperties = {
  padding: 16,
  border: "1px solid " + colors.line,
  borderRadius: 16,
  background: "#f8fafc",
  color: colors.muted,
  fontSize: 14,
};

const fieldLinkStyle: React.CSSProperties = {
  color: colors.ink,
  fontWeight: 800,
  textDecoration: "underline",
  textDecorationThickness: 1,
  textUnderlineOffset: 3,
};


const masterHeroStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  marginTop: -78,
  marginBottom: 26,
};

const masterHeroCenterStyle: React.CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 8,
  textAlign: "center",
};

const masterHeroPillStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  borderRadius: 999,
  background: "#fff5f5",
  color: "#991b1b",
  padding: "10px 18px",
  fontSize: 20,
  fontWeight: 900,
  letterSpacing: "0.02em",
};

const masterSummaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: 10,
  marginTop: 10,
  maxWidth: "none",
};

const masterSummaryItemStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
  border: "1px solid rgba(203, 213, 225, 0.58)",
  borderRadius: 14,
  background: "#ffffff",
  padding: 14,
  color: "#334155",
  fontSize: 12,
  boxShadow: "0 6px 16px rgba(15, 23, 42, 0.055)",
};

const masterSummaryCardTitleStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.15,
  fontWeight: 950,
  color: "#64748b",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const masterSummaryCardValueStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 14,
  lineHeight: 1.25,
  fontWeight: 850,
  color: "#0f172a",
};

const masterInfoCardStyle: React.CSSProperties = {
  ...masterSummaryItemStyle,
  position: "relative",
  paddingRight: 72,
  minHeight: 78,
};

const masterInfoCardEditButtonStyle: React.CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  border: "1px solid #cbd5e1",
  borderRadius: 999,
  background: "#ffffff",
  color: "#475569",
  fontSize: 11,
  fontWeight: 900,
  padding: "4px 10px",
  cursor: "not-allowed",
};



const masterWorkflowRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 16,
  alignItems: "center",
};

const masterWorkflowButtonStyle: React.CSSProperties = {
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#93b4e8",
  borderRadius: 999,
  background: "#eff6ff",
  color: "#1e3a8a",
  padding: "8px 13px",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
  opacity: 0.9,
};

const masterWorkflowLockedButtonStyle: React.CSSProperties = {
  ...masterWorkflowButtonStyle,
  borderColor: "#cbd5e1",
  background: "#f8fafc",
  color: "#475569",
};

const masterWorkflowActiveButtonStyle: React.CSSProperties = {
  ...masterWorkflowButtonStyle,
  background: "#1e3a8a",
  borderColor: "#1e3a8a",
  color: "#ffffff",
  opacity: 1,
};

const masterWorkspacePanelStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "none",
  borderRadius: 0,
  padding: "12px 18px 14px",
  marginBottom: 10,
  boxShadow: "none",
};

const masterWorkspacePanelHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  marginBottom: 10,
};

const masterWorkspacePanelEyebrowStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  marginBottom: 4,
};

const masterWorkspacePanelTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 20,
};

const masterWorkspacePanelPillStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 999,
  background: "#f8fafc",
  color: "#475569",
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const masterWorkspacePanelTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.5,
  maxWidth: "none",
};

const masterWorkspaceCardsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
};

const masterWorkspaceCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  background: "#f8fafc",
  padding: 14,
};

const masterWorkspaceCardLabelStyle: React.CSSProperties = {
  color: "#1e3a8a",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  marginBottom: 6,
};

const masterWorkspaceCardTextStyle: React.CSSProperties = {
  color: "#334155",
  fontSize: 13,
  lineHeight: 1.45,
};

const masterSettlementPanelStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "none",
  borderRadius: 0,
  padding: 0,
  marginBottom: 18,
  overflow: "hidden",
  boxShadow: "0 16px 36px rgba(15, 23, 42, 0.08)",
};

const masterSettlementTopStripStyle: React.CSSProperties = {
  display: "block",
  padding: "14px 16px",
  background: "#eef2f7",
  borderBottom: "1px solid #d7dee9",
};

const masterSettlementModeGroupStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
};

const masterSettlementBasisGroupStyle: React.CSSProperties = {
  display: "grid",
  gap: 9,
};

const masterSettlementRadioLineStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const masterSettlementRadioLabelStyle: React.CSSProperties = {
  color: "#334155",
  fontSize: 13,
  fontWeight: 900,
};

const masterSettlementInlineOptionStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  color: "#334155",
  fontSize: 13,
  whiteSpace: "nowrap",
};

const masterSettlementTermBoxStyle: React.CSSProperties = {
  padding: "12px 16px 14px",
  borderBottom: "1px solid #e5e7eb",
};

const masterSettlementTermTitleStyle: React.CSSProperties = {
  color: "#334155",
  fontSize: 20,
  fontWeight: 900,
  marginBottom: 10,
};

const masterSettlementTermGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.25fr 0.75fr 0.75fr 0.85fr 0.85fr 0.75fr 1fr 1.25fr 1.2fr",
  gap: 12,
  alignItems: "start",
};

const masterSettlementFieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
};

const masterSettlementFieldLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#475569",
};

const masterSettlementInputStyle: React.CSSProperties = {
  width: "100%",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#cbd5e1",
  borderRadius: 4,
  padding: "7px 8px",
  fontSize: 13,
  background: "#ffffff",
  color: "#0f172a",
};

const masterSettlementSelectStyle: React.CSSProperties = {
  ...masterSettlementInputStyle,
};

const masterSettlementBasisAmountInputStyle: React.CSSProperties = {
  width: 110,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#cbd5e1",
  borderRadius: 4,
  padding: "6px 8px",
  fontSize: 13,
  background: "#ffffff",
  color: "#0f172a",
};

const masterSettlementReadOnlyFieldStyle: React.CSSProperties = {
  width: "100%",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#cbd5e1",
  borderRadius: 4,
  padding: "7px 8px",
  fontSize: 13,
  background: "#f8fafc",
  color: "#0f172a",
  fontWeight: 800,
};

const masterSettlementTextareaStyle: React.CSSProperties = {
  ...masterSettlementInputStyle,
  minHeight: 54,
  resize: "vertical",
};

const masterSettlementTermFootnoteStyle: React.CSSProperties = {
  marginTop: 8,
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.4,
};

const masterSettlementDetailsBoxStyle: React.CSSProperties = {
  padding: "10px 16px 16px",
};

const masterSettlementSummaryPanelStyle: React.CSSProperties = {
  border: "none",
  background: "#f8fafc",
  borderRadius: 10,
  padding: 12,
  marginBottom: 14,
};

const masterSettlementSummaryHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: 12,
  marginBottom: 10,
};

const masterSettlementSummaryEyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "#64748b",
};

const masterSettlementSummaryTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#0f172a",
};

const masterSettlementSummaryPillStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e3a8a",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const masterSettlementSummaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
  gap: 8,
};

const masterSettlementSummaryItemStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  background: "#ffffff",
  padding: 10,
  color: "#334155",
  fontSize: 12,
  minHeight: 156,
};

const masterSettlementSummaryValueStyle: React.CSSProperties = {
  display: "block",
  textAlign: "center",
  fontSize: 30,
  fontWeight: 900,
  lineHeight: 1.1,
  color: "#334155",
  marginTop: "auto",
  marginBottom: "auto",
};

const masterSettlementAttorneyFeeControlStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
};

const masterSettlementAutoCalculationLabelStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 12,
  fontWeight: 900,
};

const masterSettlementSmallRadioStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontSize: 12,
  color: "#334155",
};

const masterSettlementAttorneyFeeInputStyle: React.CSSProperties = {
  width: 110,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#cbd5e1",
  borderRadius: 4,
  padding: "5px 7px",
  fontSize: 12,
  background: "#ffffff",
  color: "#0f172a",
};

const masterSettlementNotAppliedStyle: React.CSSProperties = {
  color: "#64748b",
  fontWeight: 800,
};

const masterWorkspaceBillListStyle: React.CSSProperties = {
  marginTop: 16,
};

const masterSettlementDetailsTitleStyle: React.CSSProperties = {
  textAlign: "center",
  color: "#334155",
  fontSize: 24,
  fontWeight: 900,
  margin: "0 0 10px",
};

const masterSettlementTableWrapStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  overflowX: "auto",
};

const masterSettlementTableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  background: "#ffffff",
  fontSize: 12,
};

const masterSettlementThStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  background: "#9aa6b2",
  color: "#203040",
  borderRight: "1px solid #d7dee9",
  borderBottom: "1px solid #d7dee9",
  whiteSpace: "nowrap",
  fontWeight: 900,
};

const masterSettlementRightThStyle: React.CSSProperties = {
  ...masterSettlementThStyle,
  textAlign: "right",
};

const masterSettlementTdStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRight: "1px solid #e5e7eb",
  borderBottom: "1px solid #e5e7eb",
  color: "#334155",
  whiteSpace: "nowrap",
};

const masterSettlementInputTdStyle: React.CSSProperties = {
  ...masterSettlementTdStyle,
  textAlign: "right",
};

const masterSettlementMoneyTdStyle: React.CSSProperties = {
  ...masterSettlementTdStyle,
  textAlign: "right",
  fontWeight: 800,
};

const masterSettlementMoneyInputStyle: React.CSSProperties = {
  width: 150,
  maxWidth: "100%",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#aeb7c2",
  borderRadius: 3,
  padding: "4px 6px",
  fontSize: 12,
  textAlign: "right",
  fontWeight: 800,
  color: "#0f172a",
  background: "#ffffff",
};

const masterSettlementMasterRowStyle: React.CSSProperties = {
  background: "#f8fafc",
  fontWeight: 800,
};

const masterSettlementTotalRowStyle: React.CSSProperties = {
  background: "#e8edf3",
  fontWeight: 900,
};

const masterSettlementActionRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 14,
};

const masterSettlementGhostButtonStyle: React.CSSProperties = {
  border: "1px solid #3f7cf8",
  background: "#3f7cf8",
  color: "#ffffff",
  borderRadius: 4,
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 800,
  opacity: 0.65,
  cursor: "not-allowed",
};

const masterSettlementPrimaryButtonStyle: React.CSSProperties = {
  ...masterSettlementGhostButtonStyle,
  background: "#2563eb",
  borderColor: "#2563eb",
  opacity: 0.65,
};

const workflowBannerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  marginTop: 14,
  padding: "14px 16px",
  border: "1px solid #bfdbfe",
  borderRadius: 18,
  background: "#eff6ff",
  color: "#0f172a",
};

const workflowBannerEyebrowStyle: React.CSSProperties = {
  marginBottom: 4,
  color: "#1d4ed8",
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const workflowBannerTextStyle: React.CSSProperties = {
  color: "#334155",
  fontSize: 13,
  fontWeight: 650,
  lineHeight: 1.45,
};

const workflowBannerPillStyle: React.CSSProperties = {
  flex: "0 0 auto",
  padding: "7px 11px",
  borderRadius: 999,
  background: "#ffffff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const actionStackStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 6,
};

const secondaryActionLinkStyle: React.CSSProperties = {
  color: "#1d4ed8",
  textDecoration: "none",
  fontWeight: 850,
  fontSize: 12,
};
