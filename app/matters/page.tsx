"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import BarshHeaderQuickNav from "@/app/components/BarshHeaderQuickNav";
import { documentDeliverySafetyNote, resolvePrintableUrl, type DocumentDeliveryContext } from "@/lib/documents/delivery";

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
type MasterWorkspaceTab = "documents" | "settlement" | "payments" | "email_threads" | "close_paid_settlements";

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
  const [masterLawsuitMetadata, setMasterLawsuitMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeMasterWorkspaceTab, setActiveMasterWorkspaceTab] = useState<MasterWorkspaceTab>("payments");
  const [masterEmailThreadPreviewLoading, setMasterEmailThreadPreviewLoading] = useState(false);
  const [masterEmailThreadPreviewResult, setMasterEmailThreadPreviewResult] = useState<any>(null);
  const [masterGraphThreadSyncPreviewLoading, setMasterGraphThreadSyncPreviewLoading] = useState(false);
  const [masterGraphThreadSyncPreviewResult, setMasterGraphThreadSyncPreviewResult] = useState<any>(null);
  const [masterGraphThreadSyncPreviewConversationId, setMasterGraphThreadSyncPreviewConversationId] = useState<string>("");
  const [masterGraphThreadSyncLoading, setMasterGraphThreadSyncLoading] = useState(false);
  const [masterGraphThreadSyncResult, setMasterGraphThreadSyncResult] = useState<any>(null);
  const [masterGraphThreadSyncConversationId, setMasterGraphThreadSyncConversationId] = useState<string>("");
  const [expandedMasterEmailThreadId, setExpandedMasterEmailThreadId] = useState<string | null>(null);
  const [expandedMasterEmailMessageId, setExpandedMasterEmailMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (activeMasterWorkspaceTab !== "email_threads") return;
    if (masterEmailThreadPreviewLoading || masterEmailThreadPreviewResult) return;
    void loadMasterEmailThreadPreview();
  }, [activeMasterWorkspaceTab, masterEmailThreadPreviewLoading, masterEmailThreadPreviewResult]);


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
  const [masterPaymentShowVoided, setMasterPaymentShowVoided] = useState(false);

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

  const settlementRecordSettlementOpenerLabel = "Record Settlement";
  const settlementCommitButtonGreenMarker = "data-barsh-settlement-commit-button-green-marker: Commit Settlement uses the same solid green action styling as other primary green buttons";
  function masterSettlementCommitButtonStyle(): React.CSSProperties {
    const canCommit = masterSettlementCanCommit();
    return {
      background: canCommit ? "#16a34a" : "#bbf7d0",
      color: "#ffffff",
      border: "1px solid #15803d",
      boxShadow: canCommit ? "0 10px 20px rgba(22, 163, 74, 0.24)" : "none",
      cursor: canCommit ? "pointer" : "not-allowed",
    };
  }
  const settlementClearRetainersMarker = "data-barsh-settlement-clear-retainers-marker: Clear resets settlement entry fields but preserves/reloads provider retainer defaults";
  const settlementCalculateCommitMarker = "data-barsh-settlement-calculate-commit-marker: Calculate Settlement prepares settlementRecordPayload; Commit Settlement requires a valid local preview";
  const settlementPopupBottomButtonsMarker = "data-barsh-settlement-popup-bottom-buttons-marker: Cancel | Clear | Commit Settlement";
  const settlementCommitFlowMarker = "data-barsh-settlement-commit-flow-marker: Cancel | Clear | Commit Settlement | tickler | document-dialog";
  const [masterSettlementFormOpen, setMasterSettlementFormOpen] = useState(false);
  const [masterSettlementGrossInput, setMasterSettlementGrossInput] = useState("");
  const [masterSettlementWithInput, setMasterSettlementWithInput] = useState("");
  const [masterSettlementDateInput, setMasterSettlementDateInput] = useState(() => masterPaymentTodayInput());
  const [masterSettlementPaymentExpectedDateInput, setMasterSettlementPaymentExpectedDateInput] = useState(() => addDaysToDateInput(masterPaymentTodayInput(), 45));
  const [masterSettlementPrincipalFeePercentInput, setMasterSettlementPrincipalFeePercentInput] = useState("");
  const [masterSettlementInterestAmountInput, setMasterSettlementInterestAmountInput] = useState("");
  const [masterSettlementSettledInterestInput, setMasterSettlementSettledInterestInput] = useState("");
  const [masterSettlementCostsInput, setMasterSettlementCostsInput] = useState("");
  const [masterSettlementAttorneyFeeOverrides, setMasterSettlementAttorneyFeeOverrides] = useState<Record<string, string>>({});
  const [masterSettlementInterestFeePercentInput, setMasterSettlementInterestFeePercentInput] = useState("");
  const [masterSettlementNotesInput, setMasterSettlementNotesInput] = useState("");
  const [masterSettlementLocalPreview, setMasterSettlementLocalPreview] = useState<any>(null);
  const [masterSettlementLocalPreviewLoading, setMasterSettlementLocalPreviewLoading] = useState(false);
  const [masterSettlementRecordSave, setMasterSettlementRecordSave] = useState<any>(null);
  const [masterSettlementRecordSaveLoading, setMasterSettlementRecordSaveLoading] = useState(false);
  const [masterSettlementHistory, setMasterSettlementHistory] = useState<any>(null);
  const [masterSettlementHistoryLoading, setMasterSettlementHistoryLoading] = useState(false);
  const [masterSettlementTicklers, setMasterSettlementTicklers] = useState<any>(null);
  const [masterSettlementTicklersLoading, setMasterSettlementTicklersLoading] = useState(false);
  const [masterSettlementTicklerCreate, setMasterSettlementTicklerCreate] = useState<any>(null);
  const [masterSettlementTicklerCreateLoading, setMasterSettlementTicklerCreateLoading] = useState(false);
  const [masterSettlementProviderFeeDefaults, setMasterSettlementProviderFeeDefaults] = useState<any>(null);
  const [masterSettlementProviderFeeDefaultsLoading, setMasterSettlementProviderFeeDefaultsLoading] = useState(false);
  const [masterSettlementPopupPosition, setMasterSettlementPopupPosition] = useState({ x: 0, y: 72 });
  const [masterSettlementPopupDragging, setMasterSettlementPopupDragging] = useState(false);

  const [masterInfoEditDialog, setMasterInfoEditDialog] = useState<null | {
    field: string;
    label: string;
    currentValue: string;
  }>(null);
  const [masterInfoEditValue, setMasterInfoEditValue] = useState("");
  const [masterCourtOptions, setMasterCourtOptions] = useState<any[]>([]);
  const [masterCourtOptionsLoading, setMasterCourtOptionsLoading] = useState(false);
  const [masterCourtOptionsError, setMasterCourtOptionsError] = useState("");
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
    details?: any;
  }>>([]);
  const [masterNoteDialogOpen, setMasterNoteDialogOpen] = useState(false);
  const [masterNoteDraft, setMasterNoteDraft] = useState("");
  const [masterNoteEditingId, setMasterNoteEditingId] = useState<string | null>(null);
  const [masterNoteDeleteTarget, setMasterNoteDeleteTarget] = useState<null | { id: string; note: string }>(null);
  const [masterAuditHistoryOpen, setMasterAuditHistoryOpen] = useState(false);
  const [masterAuditHistoryLoading, setMasterAuditHistoryLoading] = useState(false);
  const [masterAuditHistoryError, setMasterAuditHistoryError] = useState("");
  const [masterDocumentDataPreviewLoading, setMasterDocumentDataPreviewLoading] = useState(false);
  const [masterDocumentTemplateQuery, setMasterDocumentTemplateQuery] = useState("");
  const [masterSelectedDocumentTemplateKey, setMasterSelectedDocumentTemplateKey] = useState("");
  const [masterDocumentWorkflowStage, setMasterDocumentWorkflowStage] = useState<"select" | "chooseAction" | "preview" | "edit" | "finalize" | "delivery">("select");
  const [masterDocumentLaunchMode, setMasterDocumentLaunchMode] = useState<"lawsuit" | "settlement">("lawsuit");
  const [masterDocumentSettlementRecordId, setMasterDocumentSettlementRecordId] = useState("");
  const [masterDocumentRepositoryTemplates, setMasterDocumentRepositoryTemplates] = useState<any[]>([]);
  const [masterDocumentRepositoryTemplatesLoading, setMasterDocumentRepositoryTemplatesLoading] = useState(false);
  const [masterDocumentRepositoryTemplatesError, setMasterDocumentRepositoryTemplatesError] = useState("");
  const [masterDocumentFinalizing, setMasterDocumentFinalizing] = useState(false);
  const [masterDocumentFinalizationResult, setMasterDocumentFinalizationResult] = useState<any>(null);
  const [masterDocumentPrintQueueLoading, setMasterDocumentPrintQueueLoading] = useState(false);
  const [masterDocumentPrintQueueResult, setMasterDocumentPrintQueueResult] = useState<any>(null);
  const [masterDocumentPrintResult, setMasterDocumentPrintResult] = useState<any>(null);
  const [masterClioDocumentsLoading, setMasterClioDocumentsLoading] = useState(false);
  const [masterClioDocumentsResult, setMasterClioDocumentsResult] = useState<any>(null);
  const [masterViewDocumentsPopupOpen, setMasterViewDocumentsPopupOpen] = useState(false);
  const [masterSelectedViewDocumentId, setMasterSelectedViewDocumentId] = useState("");

  const [masterDocumentDataPreview, setMasterDocumentDataPreview] = useState<any>(null);
  const [masterDocumentGenerationPopupOpen, setMasterDocumentGenerationPopupOpen] = useState(false);
  const [masterDocumentDeliveryPreview, setMasterDocumentDeliveryPreview] = useState<any>(null);
  const [masterDocumentDeliveryPreviewLoading, setMasterDocumentDeliveryPreviewLoading] = useState(false);
  const [masterDocumentDraftCreateLoading, setMasterDocumentDraftCreateLoading] = useState(false);
  const [masterDocumentDeliveryToOverride, setMasterDocumentDeliveryToOverride] = useState("");
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

  async function loadMasterClioDocuments() {
    const masterId = currentMasterLawsuitIdForDocumentPreview();

    if (!masterId) {
      setMasterClioDocumentsResult({
        ok: false,
        error: "No Lawsuit ID is available for Clio document lookup.",
        documents: [],
      });
      return;
    }

    try {
      setMasterClioDocumentsLoading(true);

      const response = await fetch(
        `/api/documents/clio-matter-documents?masterLawsuitId=${encodeURIComponent(masterId)}`,
        { cache: "no-store" }
      );
      const json = await response.json().catch(() => null);

      setMasterClioDocumentsResult(
        json || {
          ok: false,
          error: "Could not parse Clio document list response.",
          documents: [],
        }
      );
    } catch (error: any) {
      setMasterClioDocumentsResult({
        ok: false,
        error: error?.message || String(error),
        documents: [],
      });
    } finally {
      setMasterClioDocumentsLoading(false);
    }
  }

  function masterClioDocumentsArray(): any[] {
    return Array.isArray(masterClioDocumentsResult?.documents)
      ? masterClioDocumentsResult.documents
      : [];
  }

  function selectedMasterViewDocument(): any {
    return masterClioDocumentsArray().find((doc: any) => masterDocumentPreviewText(doc.clioDocumentId) === masterSelectedViewDocumentId) || null;
  }

  async function openMasterViewDocumentsPopup() {
    setMasterViewDocumentsPopupOpen(true);
    setMasterSelectedViewDocumentId("");

    if (!masterClioDocumentsResult && !masterClioDocumentsLoading) {
      await loadMasterClioDocuments();
    }
  }

  function closeMasterViewDocumentsPopup() {
    setMasterViewDocumentsPopupOpen(false);
    setMasterSelectedViewDocumentId("");
  }

  function renderMasterViewDocumentsPopup() {
    if (!masterViewDocumentsPopupOpen) return null;

    const docs = masterClioDocumentsArray();
    const selectedDoc = selectedMasterViewDocument();

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="View Lawsuit Documents"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10000,
          background: "rgba(15, 23, 42, 0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            width: "min(920px, 96vw)",
            maxHeight: "88vh",
            overflow: "auto",
            border: "1px solid #cbd5e1",
            borderRadius: 22,
            background: "#ffffff",
            boxShadow: "0 28px 90px rgba(15, 23, 42, 0.34)",
          }}
        >
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 2,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 14,
              padding: "18px 20px",
              borderBottom: "1px solid #e5e7eb",
              background: "#ffffff",
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 22 }}>View Lawsuit Documents</h2>
              <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13, lineHeight: 1.45 }}>
                Pick a document from the mapped Clio master matter Documents tab.  This popup is read-only and does not upload, download, generate, email, print, queue, or write anything.
              </p>
            </div>

            <button
              type="button"
              onClick={closeMasterViewDocumentsPopup}
              disabled={masterClioDocumentsLoading}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 999,
                background: "#f8fafc",
                color: "#0f172a",
                padding: "8px 12px",
                fontWeight: 900,
                cursor: masterClioDocumentsLoading ? "not-allowed" : "pointer",
              }}
            >
              Close
            </button>
          </div>

          <div style={{ padding: 20, display: "grid", gap: 14 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: 12, fontWeight: 850 }}>
                  Lawsuit ID: {currentMasterLawsuitIdForDocumentPreview() || "—"}
                </span>
                <span style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: 12, fontWeight: 850 }}>
                  Clio Matter ID: {masterDocumentPreviewText(masterClioDocumentsResult?.clioMatterId) || "—"}
                </span>
                <span style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: 12, fontWeight: 850 }}>
                  Clio Display: {masterDocumentPreviewText(masterClioDocumentsResult?.clioDisplayNumber) || "—"}
                </span>
                <span style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: 12, fontWeight: 850 }}>
                  Documents: {masterClioDocumentsResult?.summary?.documentCount ?? docs.length}
                </span>
              </div>

              <button
                type="button"
                onClick={() => void loadMasterClioDocuments()}
                disabled={masterClioDocumentsLoading}
                style={{
                  border: "1px solid #1d4ed8",
                  background: masterClioDocumentsLoading ? "#dbeafe" : "#2563eb",
                  color: "#ffffff",
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontWeight: 900,
                  cursor: masterClioDocumentsLoading ? "not-allowed" : "pointer",
                }}
              >
                {masterClioDocumentsLoading ? "Refreshing..." : "Refresh Documents"}
              </button>
            </div>

            {masterClioDocumentsResult && !masterClioDocumentsResult.ok && (
              <div style={{ padding: 12, border: "1px solid #fecaca", borderRadius: 10, background: "#fef2f2", color: "#991b1b", fontWeight: 850 }}>
                {masterDocumentPreviewText(masterClioDocumentsResult.error) || "Could not load Clio documents."}
              </div>
            )}

            {masterClioDocumentsLoading && (
              <div style={{ padding: 12, border: "1px solid #cbd5e1", borderRadius: 10, background: "#f8fafc", color: "#475569", fontWeight: 800 }}>
                Loading documents from Clio...
              </div>
            )}

            {masterClioDocumentsResult?.ok && docs.length === 0 && (
              <div style={{ padding: 12, border: "1px dashed #cbd5e1", borderRadius: 10, background: "#f8fafc", color: "#64748b", fontWeight: 800 }}>
                No documents are currently listed in the mapped Clio master matter Documents tab.
              </div>
            )}

            {docs.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 0.9fr) minmax(300px, 1.1fr)", gap: 12, alignItems: "start" }}>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                  {docs.map((doc: any) => {
                    const id = masterDocumentPreviewText(doc.clioDocumentId);
                    const selected = id && id === masterSelectedViewDocumentId;

                    return (
                      <button
                        key={id || masterDocumentPreviewText(doc.clioDocumentName)}
                        type="button"
                        onClick={() => setMasterSelectedViewDocumentId(id)}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          border: 0,
                          borderBottom: "1px solid #e5e7eb",
                          background: selected ? "#eff6ff" : "#ffffff",
                          color: "#0f172a",
                          padding: 12,
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontWeight: 950 }}>{masterDocumentPreviewText(doc.clioDocumentName) || masterDocumentPreviewText(doc.clioDocumentFilename) || "Untitled"}</div>
                        <div style={{ marginTop: 4, color: "#64748b", fontSize: 12, fontWeight: 700 }}>
                          {masterDocumentPreviewText(doc.latestDocumentVersion?.filename) || masterDocumentPreviewText(doc.clioDocumentFilename) || "No filename"}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 12, background: "#f8fafc", minHeight: 180 }}>
                  {selectedDoc ? (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 950, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569" }}>
                        Selected Document
                      </div>
                      <h3 style={{ margin: "6px 0 10px", fontSize: 18 }}>
                        {masterDocumentPreviewText(selectedDoc.clioDocumentName) || masterDocumentPreviewText(selectedDoc.clioDocumentFilename) || "Untitled"}
                      </h3>
                      <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
                        <div><strong>Clio Document ID:</strong> {masterDocumentPreviewText(selectedDoc.clioDocumentId) || "—"}</div>
                        <div><strong>Filename:</strong> {masterDocumentPreviewText(selectedDoc.latestDocumentVersion?.filename) || masterDocumentPreviewText(selectedDoc.clioDocumentFilename) || "—"}</div>
                        <div><strong>Version UUID:</strong> <span style={{ fontFamily: "monospace" }}>{masterDocumentPreviewText(selectedDoc.latestDocumentVersion?.uuid) || "—"}</span></div>
                        <div><strong>Content Type:</strong> {masterDocumentPreviewText(selectedDoc.latestDocumentVersion?.contentType) || "—"}</div>
                        <div><strong>Size:</strong> {selectedDoc.latestDocumentVersion?.size ?? "—"}</div>
                        <div><strong>Fully Uploaded:</strong> {selectedDoc.latestDocumentVersion?.fullyUploaded ? "Yes" : "No"}</div>
                        <div><strong>Updated:</strong> {masterDocumentPreviewText(selectedDoc.updatedAt || selectedDoc.latestDocumentVersion?.updatedAt) || "—"}</div>
                      </div>
                      <div style={{ marginTop: 12, padding: 10, border: "1px solid #fde68a", borderRadius: 10, background: "#fffbeb", color: "#92400e", fontSize: 12, fontWeight: 800 }}>
                        Document opening/viewing will be wired to a safe Clio retrieval route next.  This step only lists and selects document metadata.
                      </div>
                    </>
                  ) : (
                    <div style={{ color: "#64748b", fontWeight: 800 }}>
                      Select a document to view its stored Clio metadata.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderMasterClioDocumentsPanel() {
    const docs = masterClioDocumentsArray();

    return (
      <div
        style={{
          marginTop: 12,
          padding: 12,
          border: "1px solid #cbd5e1",
          borderRadius: 10,
          background: "#f8fafc",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 950, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569" }}>
              Clio Documents Tab
            </div>
            <div style={{ marginTop: 4, fontWeight: 900, color: "#0f172a" }}>
              Read-only master matter document vault listing
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>
              Lists documents from the mapped Clio master matter only.  If no mapped Clio master matter exists, the API fails closed.
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadMasterClioDocuments()}
            disabled={masterClioDocumentsLoading}
            style={{
              border: "1px solid #1d4ed8",
              background: masterClioDocumentsLoading ? "#dbeafe" : "#2563eb",
              color: "#ffffff",
              borderRadius: 999,
              padding: "8px 12px",
              fontWeight: 900,
              cursor: masterClioDocumentsLoading ? "not-allowed" : "pointer",
            }}
          >
            {masterClioDocumentsLoading ? "Refreshing..." : "Refresh Clio Documents"}
          </button>
        </div>

        {masterClioDocumentsResult && (
          <div style={{ marginTop: 12 }}>
            {!masterClioDocumentsResult.ok && (
              <div
                style={{
                  padding: 10,
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  background: "#fef2f2",
                  color: "#991b1b",
                  fontWeight: 800,
                }}
              >
                {masterDocumentPreviewText(masterClioDocumentsResult.error) || "Could not load Clio documents."}
              </div>
            )}

            {masterClioDocumentsResult.ok && (
              <>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  <span style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 12, fontWeight: 850 }}>
                    Clio Matter ID: {masterDocumentPreviewText(masterClioDocumentsResult.clioMatterId) || "—"}
                  </span>
                  <span style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 12, fontWeight: 850 }}>
                    Clio Display: {masterDocumentPreviewText(masterClioDocumentsResult.clioDisplayNumber) || "—"}
                  </span>
                  <span style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 12, fontWeight: 850 }}>
                    Documents: {masterClioDocumentsResult.summary?.documentCount ?? docs.length}
                  </span>
                  <span style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 12, fontWeight: 850 }}>
                    Fully Uploaded: {masterClioDocumentsResult.summary?.fullyUploadedCount ?? "—"}
                  </span>
                </div>

                {docs.length === 0 ? (
                  <div style={{ padding: 10, border: "1px dashed #cbd5e1", borderRadius: 8, background: "#ffffff", color: "#64748b", fontWeight: 750 }}>
                    No documents are currently listed in the mapped Clio master matter Documents tab.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #cbd5e1" }}>Document</th>
                          <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #cbd5e1" }}>Version UUID</th>
                          <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #cbd5e1" }}>Type</th>
                          <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #cbd5e1" }}>Size</th>
                          <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #cbd5e1" }}>Uploaded</th>
                        </tr>
                      </thead>
                      <tbody>
                        {docs.map((doc: any) => (
                          <tr key={masterDocumentPreviewText(doc.clioDocumentId) || masterDocumentPreviewText(doc.clioDocumentName)}>
                            <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontWeight: 800 }}>
                              {masterDocumentPreviewText(doc.clioDocumentName) || masterDocumentPreviewText(doc.clioDocumentFilename) || "Untitled"}
                              <div style={{ color: "#64748b", fontWeight: 650 }}>{masterDocumentPreviewText(doc.clioDocumentFilename) || "—"}</div>
                            </td>
                            <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontFamily: "monospace" }}>
                              {masterDocumentPreviewText(doc.latestDocumentVersion?.uuid) || "—"}
                            </td>
                            <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>
                              {masterDocumentPreviewText(doc.latestDocumentVersion?.contentType) || "—"}
                            </td>
                            <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", textAlign: "right" }}>
                              {doc.latestDocumentVersion?.size ?? "—"}
                            </td>
                            <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>
                              {doc.latestDocumentVersion?.fullyUploaded ? "Yes" : "No"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  function masterInfoDisplayValue(field: string, fallback: any): string {
    const override = masterInfoOverrides[field];
    if (override !== undefined) return override || "—";
    return clean(fallback) || "—";
  }

  function masterCourtDisplayValue(): string {
    const local = masterLawsuitMetadata || {};
    const options = local?.lawsuitOptions && typeof local.lawsuitOptions === "object" ? local.lawsuitOptions : {};

    return masterInfoDisplayValue(
      "court",
      clean(local?.venueSelection) ||
        clean(local?.venue) ||
        clean(options?.venueSelection) ||
        clean(options?.venue) ||
        "—"
    );
  }

  function masterLawsuitOptions(): any {
    const local = masterLawsuitMetadata || {};
    return local?.lawsuitOptions && typeof local.lawsuitOptions === "object" ? local.lawsuitOptions : {};
  }

  function masterLocalMetadataValue(field: string): string {
    const local = masterLawsuitMetadata || {};
    const options = masterLawsuitOptions();

    if (field === "indexAaaNumber") {
      return clean(local?.indexAaaNumber) || clean(options?.indexAaaNumber);
    }

    if (field === "dateOfLoss") {
      return clean(options?.dateOfLoss);
    }

    if (field === "dateFiled") {
      return clean(options?.dateFiled);
    }

    if (field === "filingFee") {
      return clean(options?.filingFee);
    }

    if (field === "serviceFee") {
      return clean(options?.serviceFee);
    }

    if (field === "otherCourtCosts") {
      return clean(options?.otherCourtCosts);
    }

    return "";
  }

  function masterIndexAaaDisplayValue(): string {
    return masterInfoDisplayValue("indexAaaNumber", masterLocalMetadataValue("indexAaaNumber") || "—");
  }

  function masterDateFiledDisplayValue(): string {
    const override = masterInfoOverrides.dateFiled;
    if (override !== undefined) return formatMasterDateDisplay(override);

    return formatMasterDateDisplay(masterLocalMetadataValue("dateFiled") || "—");
  }

  function masterMetadataMoneyDisplayValue(field: "filingFee" | "serviceFee" | "otherCourtCosts"): string {
    const override = masterInfoOverrides[field];
    if (override !== undefined) return override || "$0.00";

    const raw = masterLocalMetadataValue(field);
    const n = Number(String(raw || "").replace(/[^0-9.-]/g, ""));

    return Number.isFinite(n) && n !== 0 ? money(n) : "$0.00";
  }

  function masterCourtCostsDisplayValue(): string {
    const filing = Number(String(masterInfoOverrides.filingFee ?? masterLocalMetadataValue("filingFee") ?? "").replace(/[^0-9.-]/g, ""));
    const service = Number(String(masterInfoOverrides.serviceFee ?? masterLocalMetadataValue("serviceFee") ?? "").replace(/[^0-9.-]/g, ""));
    const other = Number(String(masterInfoOverrides.otherCourtCosts ?? masterLocalMetadataValue("otherCourtCosts") ?? "").replace(/[^0-9.-]/g, ""));

    const total =
      (Number.isFinite(filing) ? filing : 0) +
      (Number.isFinite(service) ? service : 0) +
      (Number.isFinite(other) ? other : 0);

    return money(total);
  }

  function localMetadataPayloadWith(field: string, after: string, selectedCourtDetails: any) {
    const local = masterLawsuitMetadata || {};
    const options = masterLawsuitOptions();

    const payload: any = {
      masterLawsuitId: clean(value),
      venue: clean(local?.venue) || clean(options?.venue),
      venueSelection: clean(local?.venueSelection) || clean(options?.venueSelection),
      venueOther: clean(local?.venueOther) || clean(options?.venueOther),
      indexAaaNumber: clean(local?.indexAaaNumber) || clean(options?.indexAaaNumber),
      dateOfLoss: clean(options?.dateOfLoss),
      dateFiled: clean(options?.dateFiled),
      filingFee: clean(options?.filingFee),
      serviceFee: clean(options?.serviceFee),
      otherCourtCosts: clean(options?.otherCourtCosts),
      selectedCourtDetails: options?.selectedCourtDetails || null,
    };

    if (field === "court") {
      payload.venue = after;
      payload.venueSelection = after;
      payload.venueOther = "";
      payload.selectedCourtDetails = selectedCourtDetails || null;
    }

    if (field === "indexAaaNumber") payload.indexAaaNumber = after;
    if (field === "dateOfLoss") payload.dateOfLoss = after;
    if (field === "dateFiled") payload.dateFiled = after;
    if (field === "filingFee") payload.filingFee = after;
    if (field === "serviceFee") payload.serviceFee = after;
    if (field === "otherCourtCosts") payload.otherCourtCosts = after;

    return payload;
  }

  function masterInfoFieldPersistsLocally(field: string): boolean {
    return ["court", "indexAaaNumber", "dateOfLoss", "dateFiled", "filingFee", "serviceFee", "otherCourtCosts"].includes(field);
  }

  function masterInfoMoneyNumber(field: string, fallback: any): number {
    const raw = masterInfoDisplayValue(field, fallback);
    const cleaned = String(raw || "").replace(/[^0-9.-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function masterInfoFieldKind(field: string): "contact" | "date" | "money" | "court" | "text" {
    if (["provider", "patient", "insurer"].includes(field)) return "contact";
    if (["court", "venue", "venueSelection"].includes(field)) return "court";
    if (["dateOfLoss", "dateFiled"].includes(field)) return "date";
    if (["filingFee", "serviceFee", "otherCourtCosts"].includes(field)) return "money";

    return "text";
  }

  function masterInfoContactType(field: string): "person" | "company" | "provider_client" | "all" {
    if (field === "patient") return "person";
    if (field === "insurer") return "company";
    if (field === "provider") return "provider_client";

    return "all";
  }

  function formatMasterInfoMoneyInput(value: string): string {
    const cleaned = String(value || "").replace(/[$,\s]/g, "");
    if (!cleaned) return "";
    const n = Number(cleaned);
    return Number.isFinite(n) ? n.toFixed(2) : value;
  }

  function formatMasterDateDisplay(value: any): string {
    const raw = clean(value);
    if (!raw || raw === "—") return "—";

    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return `${isoMatch[2]}/${isoMatch[3]}/${isoMatch[1]}`;
    }

    const slashMatch = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (slashMatch) {
      return `${slashMatch[1].padStart(2, "0")}/${slashMatch[2].padStart(2, "0")}/${slashMatch[3]}`;
    }

    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) {
      return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
    }

    return raw;
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
    setMasterCourtOptionsError("");
  }

  function closeMasterInfoEditDialog() {
    setMasterInfoEditDialog(null);
    setMasterInfoEditValue("");
    setMasterInfoContactSearch("");
    setMasterInfoContactResults([]);
    setMasterInfoSelectedContact(null);
    setMasterCourtOptionsError("");
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

  async function loadMasterLawsuitMetadata() {
    const masterLawsuitId = clean(value);

    if (kind !== "master" || !masterLawsuitId) {
      setMasterLawsuitMetadata(null);
      return;
    }

    try {
      const response = await fetch(
        `/api/lawsuits/update-metadata?masterLawsuitId=${encodeURIComponent(masterLawsuitId)}`,
        { cache: "no-store" }
      );
      const json = await response.json();

      if (!response.ok || !json?.ok) {
        setMasterLawsuitMetadata(null);
        return;
      }

      setMasterLawsuitMetadata(json.lawsuit || null);
    } catch {
      setMasterLawsuitMetadata(null);
    }
  }

  useEffect(() => {
    void loadMasterLawsuitMetadata();
  }, [kind, value]);

  async function loadMasterCourtOptions() {
    try {
      setMasterCourtOptionsLoading(true);
      setMasterCourtOptionsError("");

      const response = await fetch("/api/reference-data/options?type=court", {
        cache: "no-store",
      });
      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Court options failed to load.");
      }

      setMasterCourtOptions(Array.isArray(json.options) ? json.options : []);
    } catch (error: any) {
      setMasterCourtOptions([]);
      setMasterCourtOptionsError(error?.message || String(error));
    } finally {
      setMasterCourtOptionsLoading(false);
    }
  }

  useEffect(() => {
    if (!masterInfoEditDialog) return;
    if (masterInfoFieldKind(masterInfoEditDialog.field) !== "court") return;
    void loadMasterCourtOptions();
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

  async function confirmMasterInfoEditDialog() {
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
    const selectedCourtDetails =
      kind === "court"
        ? masterCourtOptions.find((option: any) => String(option?.displayName || option?.label || option?.value || "") === after)?.details || null
        : null;

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
        details: selectedCourtDetails,
      },
      ...prev,
    ]);

    const localMetadataPersisted = masterInfoFieldPersistsLocally(field);

    if (localMetadataPersisted) {
      const masterLawsuitId = clean(value);

      if (!masterLawsuitId) {
        window.alert(`Cannot save ${label} because no Master Lawsuit ID is available.`);
        return;
      }

      const response = await fetch("/api/lawsuits/update-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(localMetadataPayloadWith(field, after, selectedCourtDetails)),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        window.alert(json?.error || `${label} could not be saved locally.`);
        return;
      }

      setMasterLawsuitMetadata(json.lawsuit || null);
    }

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
        selectedCourtDetails,
        localLawsuitPersisted: localMetadataPersisted,
        clioWriteAttempted: false,
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

  async function runAdministratorGate(actionLabel: string, onAuthorized: () => void) {
    const password = window.prompt(`ADMINISTRATOR ACCESS REQUIRED\n\n${actionLabel}\n\nEnter administrator password:`);
    if (password === null) return;

    try {
      const response = await fetch("/api/admin/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, action: actionLabel }),
      });
      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok || !json?.authorized) {
        window.alert(json?.error || "Administrator authorization failed.");
        return;
      }

      onAuthorized();
    } catch (error: any) {
      window.alert(error?.message || "Administrator authorization failed.");
    }
  }

  function openAdministratorMenu() {
    void runAdministratorGate(
      "Open Administrator Home",
      () => {
        window.location.href = "/admin";
      },
    );
  }



  function openMasterAuditHistoryPopup() {
    void runAdministratorGate(
      "Open Master Audit / History",
      () => {
        setMasterAuditHistoryOpen(true);
        void loadMasterAuditHistory();
      }
    );
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

  function resetMasterSettlementPopupPosition() {
    setMasterSettlementPopupPosition({ x: 0, y: 72 });

    const popup = document.querySelector<HTMLElement>("[data-barsh-draggable-settlement-popup-shell='true']");
    if (popup) {
      popup.style.top = "72px";
      popup.style.left = "calc(50% + 0px)";
      popup.style.transform = "translateX(-50%)";
    }
  }

  function beginMasterSettlementPopupDrag(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    if (target?.closest?.("button, input, textarea, select, a")) return;

    const popupElement = document.querySelector<HTMLElement>("[data-barsh-draggable-settlement-popup-shell='true']");
    if (!popupElement) return;
    const popup = popupElement;

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const rect = popup.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = rect.left;
    const startTop = rect.top;
    const priorUserSelect = document.body.style.userSelect;

    document.body.style.userSelect = "none";
    setMasterSettlementPopupDragging(true);

    popup.style.left = `${startLeft}px`;
    popup.style.top = `${startTop}px`;
    popup.style.transform = "none";

    function handleMove(moveEvent: PointerEvent) {
      moveEvent.preventDefault();

      const nextLeft = startLeft + moveEvent.clientX - startX;
      const nextTop = Math.max(8, startTop + moveEvent.clientY - startY);

      popup.style.left = `${nextLeft}px`;
      popup.style.top = `${nextTop}px`;
      popup.style.transform = "none";
    }

    function handleUp() {
      document.body.style.userSelect = priorUserSelect;
      setMasterSettlementPopupDragging(false);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    }

    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  }

  function masterSettlementMoneyValue(value: string): number {
    const cleaned = String(value || "").replace(/[$,\s]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function masterSettlementGrossValue(): number {
    return masterSettlementAmountOrPercentValue(masterSettlementGrossInput);
  }

  function masterSettlementInterestSettlementPercentValue(): number {
    const raw = clean(masterSettlementInterestAmountInput);
    if (!raw) return 100;
    const n = masterSettlementPercentValue(raw);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 100;
  }

  function masterSettlementCalculatedSettledInterestValue(): number {
    return masterSettlementSimpleInterestAmountValue() * (masterSettlementInterestSettlementPercentValue() / 100);
  }

  function masterSettlementInterestValue(): number {
    if (clean(masterSettlementSettledInterestInput)) {
      return masterSettlementMoneyValue(masterSettlementSettledInterestInput);
    }

    return masterSettlementCalculatedSettledInterestValue();
  }

  function masterSettlementCostsValue(): number {
    return masterSettlementMoneyValue(masterSettlementCostsInput);
  }
function masterSettlementDateFiledValue(): string {
    return clean(masterInfoDisplayValue("dateFiled", clean(masterLocalMetadataValue("dateFiled"))));
  }

  function masterSettlementInterestDaysValue(): number {
    const filed = masterSettlementDateFiledValue();
    const settled = clean(masterSettlementDateInput);
    if (!filed || !settled) return 0;

    const filedDate = new Date(`${filed}T00:00:00`);
    const settledDate = new Date(`${settled}T00:00:00`);
    if (Number.isNaN(filedDate.getTime()) || Number.isNaN(settledDate.getTime())) return 0;

    const days = Math.floor((settledDate.getTime() - filedDate.getTime()) / 86400000);
    return Math.max(0, days);
  }

  function masterSettlementSimpleInterestAmountValue(): number {
    const monthlyRate = 0.02;
    const dailyRate = monthlyRate / 30;
    return masterSettlementBasisAmountValue() * dailyRate * masterSettlementInterestDaysValue();
  }

  function formatMasterSettlementDollarInput(value: string): string {
    const formattedMoney = formatMasterSettlementMoneyInput(value);
    return formattedMoney ? `$${formattedMoney}` : "";
  }

  function masterSettlementPercentValue(value: string): number {
    const cleaned = String(value || "").replace(/[%\s]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function masterSettlementWholePercentLabel(value: string): string {
    const n = masterSettlementPercentValue(value);
    return `${Math.round(n)}%`;
  }

  function addDaysToDateInput(dateInput: string, days: number): string {
    const cleanedDate = clean(dateInput);
    if (!cleanedDate) return "";
    const date = new Date(`${cleanedDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    date.setDate(date.getDate() + days);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function masterSettlementLawsuitAmountValue(): number {
    return masterWorkspaceBillTotal(masterSettlementDetailRows);
  }

  function masterSettlementCostDefaultValue(): number {
    return masterSettlementMoneyValue(masterCourtCostsDisplayValue());
  }

  function masterSettlementBasisAmountValue(): number {
    if (masterSettlementDraft.settlementBasedOn === "fee_schedule_amount") {
      return masterSettlementMoneyValue(masterSettlementDraft.feeScheduleAmount);
    }

    if (masterSettlementDraft.settlementBasedOn === "custom_amount") {
      return masterSettlementMoneyValue(masterSettlementDraft.customAmount);
    }

    return masterSettlementLawsuitAmountValue();
  }

  function applyMasterSettlementBasisAmount(nextMode: "lawsuit_amount" | "fee_schedule_amount" | "custom_amount", nextAmount?: string) {
    setMasterSettlementDraft((prev) => ({
      ...prev,
      settlementBasedOn: nextMode,
      ...(nextMode === "fee_schedule_amount" ? { feeScheduleAmount: nextAmount || "" } : {}),
      ...(nextMode === "custom_amount" ? { customAmount: nextAmount || "" } : {}),
    }));

    setMasterSettlementLocalPreview(null);
    setMasterSettlementRecordSave(null);
  }

  function masterSettlementAmountOrPercentValue(value: string): number {
    const raw = String(value || "").trim();
    if (!raw) return 0;
    if (raw.includes("%")) {
      const percentage = masterSettlementPercentValue(raw);
      return (masterSettlementBasisAmountValue() * percentage) / 100;
    }

    const numeric = masterSettlementMoneyValue(raw);
    const explicitDollar = raw.includes("$") || raw.includes(",") || numeric > 100;
    if (!explicitDollar && numeric > 0 && numeric <= 100) {
      return (masterSettlementBasisAmountValue() * numeric) / 100;
    }

    return numeric;
  }

  function formatMasterSettlementAmountOrPercentInput(value: string): string {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (raw.includes("%")) {
      const percentage = masterSettlementPercentValue(raw);
      return Number.isFinite(percentage) ? `${percentage.toFixed(2)}%` : value;
    }

    const numeric = masterSettlementMoneyValue(raw);
    const explicitDollar = raw.includes("$") || raw.includes(",") || numeric > 100;
    if (!explicitDollar && numeric > 0 && numeric <= 100) {
      return `${numeric.toFixed(2)}%`;
    }

    const formattedMoney = formatMasterSettlementMoneyInput(value);
    return formattedMoney ? `$${formattedMoney}` : "";
  }

  function handleMasterSettlementEntryKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter") return;
    const target = event.target as HTMLElement | null;
    if (!target?.matches?.("[data-master-settlement-entry-field='true']")) return;

    event.preventDefault();

    const fields = Array.from(
      document.querySelectorAll<HTMLElement>("[data-master-settlement-entry-field='true']")
    ).filter((field) => !field.hasAttribute("disabled"));

    const currentIndex = fields.indexOf(target);
    const nextField = currentIndex >= 0 ? fields[currentIndex + 1] : null;
    nextField?.focus();
  }

  function masterSettlementProviderForFeeDefaults(): string {
    const firstRow = masterWorkspaceBillRows(masterSettlementDetailRows)[0] as any;
    return clean(firstRow?.provider || firstRow?.clientName || firstRow?.client_name || firstRow?.client || "");
  }

  async function loadMasterSettlementProviderFeeDefaults() {
    const providerName = masterSettlementProviderForFeeDefaults();

    setMasterSettlementProviderFeeDefaultsLoading(true);
    setMasterSettlementProviderFeeDefaults(null);

    if (!providerName) {
      setMasterSettlementPrincipalFeePercentInput("");
      setMasterSettlementInterestFeePercentInput("");
      setMasterSettlementProviderFeeDefaultsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/settlements/local-provider-fee-defaults?provider=${encodeURIComponent(providerName)}`);
      const json = await response.json().catch(() => null);
      const principalFeePercent = json?.defaults?.principalFeePercent;
      const interestFeePercent = json?.defaults?.interestFeePercent;

      if (typeof principalFeePercent === "number" && Number.isFinite(principalFeePercent)) {
        setMasterSettlementPrincipalFeePercentInput(principalFeePercent.toFixed(2));
      } else {
        setMasterSettlementPrincipalFeePercentInput("");
      }

      if (typeof interestFeePercent === "number" && Number.isFinite(interestFeePercent)) {
        setMasterSettlementInterestFeePercentInput(interestFeePercent.toFixed(2));
      } else {
        setMasterSettlementInterestFeePercentInput("");
      }

      setMasterSettlementProviderFeeDefaults({
        ...(json || {}),
        ok: Boolean(response.ok && json?.ok),
        responseStatus: response.status,
      });
    } catch (error: any) {
      setMasterSettlementPrincipalFeePercentInput("");
      setMasterSettlementInterestFeePercentInput("");
      setMasterSettlementProviderFeeDefaults({
        ok: false,
        action: "local-provider-fee-defaults",
        localFirst: true,
        error: error?.message || "Local provider fee defaults lookup failed.",
      });
    } finally {
      setMasterSettlementProviderFeeDefaultsLoading(false);
    }
  }

  function formatMasterSettlementMoneyInput(value: string): string {
    const cleaned = String(value || "").replace(/[$,\s]/g, "");
    if (!cleaned) return "";
    const n = Number(cleaned);
    return Number.isFinite(n)
      ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : value;
  }

  function clearMasterSettlementEntryFields() {
    const currentPrincipalRetainer = masterSettlementPrincipalFeePercentInput;
    const currentInterestRetainer = masterSettlementInterestFeePercentInput;
    const currentProviderDefaults = masterSettlementProviderFeeDefaults;

    setMasterSettlementGrossInput("");
    setMasterSettlementWithInput("");
    const today = masterPaymentTodayInput();
    setMasterSettlementDateInput(today);
    setMasterSettlementPaymentExpectedDateInput(addDaysToDateInput(today, 45));
    setMasterSettlementInterestAmountInput("");
    setMasterSettlementSettledInterestInput("");
    setMasterSettlementCostsInput("");
    setMasterSettlementNotesInput("");
    setMasterSettlementDraft((prev) => ({
      ...prev,
      settlementBasedOn: "lawsuit_amount",
      feeScheduleAmount: "",
      customAmount: "",
    }));
    setMasterSettlementLocalPreview(null);
    setMasterSettlementLocalPreviewLoading(false);
    setMasterSettlementRecordSave(null);
    setMasterSettlementRecordSaveLoading(false);
    setMasterSettlementAttorneyFeeOverrides({});

    setMasterSettlementPrincipalFeePercentInput(currentPrincipalRetainer);
    setMasterSettlementInterestFeePercentInput(currentInterestRetainer);
    setMasterSettlementProviderFeeDefaults(currentProviderDefaults);

    void loadMasterSettlementProviderFeeDefaults();

    const costsAmount = masterSettlementCostDefaultValue();
    if (costsAmount > 0) {
      setMasterSettlementCostsInput(formatMasterSettlementDollarInput(String(costsAmount)));
    }
  }

  function resetMasterSettlementPreviewForm() {
    setMasterSettlementGrossInput("");
    setMasterSettlementWithInput("");
    const today = masterPaymentTodayInput();
    setMasterSettlementDateInput(today);
    setMasterSettlementPaymentExpectedDateInput(addDaysToDateInput(today, 45));
    setMasterSettlementPrincipalFeePercentInput("");
    setMasterSettlementInterestAmountInput("");
    setMasterSettlementSettledInterestInput("");
    setMasterSettlementCostsInput("");
    setMasterSettlementInterestFeePercentInput("");
    setMasterSettlementNotesInput("");
    setMasterSettlementDraft((prev) => ({
      ...prev,
      settlementBasedOn: "lawsuit_amount",
      feeScheduleAmount: "",
      customAmount: "",
    }));
    setMasterSettlementLocalPreview(null);
    setMasterSettlementLocalPreviewLoading(false);
    setMasterSettlementRecordSave(null);
    setMasterSettlementRecordSaveLoading(false);
    setMasterSettlementProviderFeeDefaults(null);
    setMasterSettlementProviderFeeDefaultsLoading(false);
    setMasterSettlementAttorneyFeeOverrides({});
    resetMasterSettlementPopupPosition();
  }

  async function runMasterSettlementLocalPreview() {
    setMasterSettlementLocalPreviewLoading(true);
    setMasterSettlementLocalPreview(null);
    setMasterSettlementRecordSave(null);

    try {
      const response = await fetch("/api/settlements/local-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterLawsuitId: currentMasterLawsuitIdForDocumentPreview(),
          grossSettlementAmount: masterSettlementGrossValue(),
          settledWith: masterSettlementWithInput,
          settlementDate: masterSettlementDateInput,
          paymentExpectedDate: masterSettlementPaymentExpectedDateInput,
          allocationMode: "pro_rata_by_principal_balance",
          principalFeePercent: masterSettlementPercentValue(masterSettlementPrincipalFeePercentInput),
          interestAmount: masterSettlementInterestValue(),
          costsAmount: masterSettlementCostsValue(),
          interestFeePercent: masterSettlementPercentValue(masterSettlementInterestFeePercentInput),
          notes: masterSettlementNotesInput,
        }),
      });

      const json = await response.json().catch(() => null);
      setMasterSettlementLocalPreview({
        ...(json || {}),
        ok: Boolean(response.ok && json?.ok),
        responseStatus: response.status,
      });
    } catch (error: any) {
      setMasterSettlementLocalPreview({
        ok: false,
        action: "settlement-local-preview",
        previewOnly: true,
        localFirst: true,
        error: error?.message || "Local settlement preview failed.",
      });
    } finally {
      setMasterSettlementLocalPreviewLoading(false);
    }
  }

  async function runMasterSettlementRecordSave() {
    const settlementRecordPayload = masterSettlementLocalPreview?.settlementRecordPayload;

    setMasterSettlementRecordSaveLoading(true);
    setMasterSettlementRecordSave(null);

    try {
      const response = await fetch("/api/settlements/local-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settlementRecordPayload }),
      });

      const json = await response.json().catch(() => null);
      setMasterSettlementRecordSave({
        ...(json || {}),
        ok: Boolean(response.ok && json?.ok),
        responseStatus: response.status,
      });
    } catch (error: any) {
      setMasterSettlementRecordSave({
        ok: false,
        action: "local-settlement-record-save",
        previewOnly: true,
        localFirst: true,
        error: error?.message || "Local settlement record save failed.",
      });
    } finally {
      setMasterSettlementRecordSaveLoading(false);
    }
  }

  function formatSettlementHistoryMoney(value: unknown): string {
    const numeric = typeof value === "number" ? value : Number(String(value ?? "").replace(/[$,\s]/g, ""));
    const safe = Number.isFinite(numeric) ? numeric : 0;
    return safe.toLocaleString("en-US", { style: "currency", currency: "USD" });
  }

  async function loadMasterSettlementHistory() {
    const masterLawsuitId = currentMasterLawsuitIdForDocumentPreview();
    if (!masterLawsuitId) {
      setMasterSettlementHistory(null);
      return;
    }

    setMasterSettlementHistoryLoading(true);
    try {
      const response = await fetch(`/api/settlements/local-history?masterLawsuitId=${encodeURIComponent(masterLawsuitId)}&limit=5`);
      const json = await response.json().catch(() => ({}));
      setMasterSettlementHistory({
        ...json,
        httpStatus: response.status,
      });
    } catch (error: any) {
      setMasterSettlementHistory({
        ok: false,
        action: "local-settlement-history",
        localFirst: true,
        sourceOfTruth: "barsh-matters-local",
        error: error?.message || "Local settlement history failed.",
      });
    } finally {
      setMasterSettlementHistoryLoading(false);
    }
  }

  async function loadMasterSettlementTicklers(settlementRecordId?: string) {
    const masterLawsuitId = currentMasterLawsuitIdForDocumentPreview();
    const query = settlementRecordId
      ? `settlementRecordId=${encodeURIComponent(settlementRecordId)}`
      : masterLawsuitId
        ? `masterLawsuitId=${encodeURIComponent(masterLawsuitId)}`
        : "";

    if (!query) {
      setMasterSettlementTicklers(null);
      return;
    }

    setMasterSettlementTicklersLoading(true);
    try {
      const response = await fetch(`/api/ticklers/settlement-payment-due?${query}`);
      const json = await response.json().catch(() => ({}));
      setMasterSettlementTicklers({
        ...json,
        httpStatus: response.status,
      });
    } catch (error: any) {
      setMasterSettlementTicklers({
        ok: false,
        action: "settlement-payment-due-ticklers-list",
        localFirst: true,
        sourceOfTruth: "barsh-matters-local",
        error: error?.message || "Local settlement ticklers failed.",
      });
    } finally {
      setMasterSettlementTicklersLoading(false);
    }
  }

  async function createMasterSettlementPaymentDueTickler(settlementRecordId?: string) {
    const activeRecordId = settlementRecordId || masterSettlementHistory?.activeRecordId || masterSettlementRecordSave?.record?.id;
    const masterLawsuitId = currentMasterLawsuitIdForDocumentPreview();

    if (!activeRecordId && !masterLawsuitId) {
      setMasterSettlementTicklerCreate({
        ok: false,
        error: "No settlement record or lawsuit ID is available for tickler creation.",
      });
      return;
    }

    setMasterSettlementTicklerCreateLoading(true);
    setMasterSettlementTicklerCreate(null);

    try {
      const response = await fetch("/api/ticklers/settlement-payment-due", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settlementRecordId: activeRecordId,
          masterLawsuitId,
        }),
      });
      const json = await response.json().catch(() => ({}));
      setMasterSettlementTicklerCreate({
        ...json,
        httpStatus: response.status,
      });
      if (json?.ok) {
        await loadMasterSettlementTicklers(json?.tickler?.settlementRecordId || activeRecordId);
      }
    } catch (error: any) {
      setMasterSettlementTicklerCreate({
        ok: false,
        action: "settlement-payment-due-tickler",
        localFirst: true,
        sourceOfTruth: "barsh-matters-local",
        error: error?.message || "Local settlement tickler creation failed.",
      });
    } finally {
      setMasterSettlementTicklerCreateLoading(false);
    }
  }

  function masterSettlementCanCommit(): boolean {
    return Boolean(
      masterSettlementLocalPreview?.ok &&
      masterSettlementLocalPreview?.settlementRecordPayload &&
      !masterSettlementRecordSaveLoading
    );
  }

  async function commitMasterSettlementAndLaunchDocuments() {
    const settlementRecordPayload = masterSettlementLocalPreview?.settlementRecordPayload;

    if (!settlementRecordPayload) {
      setMasterSettlementRecordSave({
        ok: false,
        error: "Run local settlement preview before committing the settlement.",
      });
      return;
    }

    setMasterSettlementRecordSaveLoading(true);
    setMasterSettlementRecordSave(null);

    try {
      const response = await fetch("/api/settlements/local-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settlementRecordPayload }),
      });

      const json = await response.json().catch(() => null);
      const saveResult = {
        ...(json || {}),
        ok: Boolean(response.ok && json?.ok),
        responseStatus: response.status,
      };

      setMasterSettlementRecordSave(saveResult);

      if (!response.ok || !json?.ok) {
        return;
      }

      const savedSettlementRecordId =
        json?.record?.id ||
        json?.settlementRecord?.id ||
        json?.savedRecord?.id ||
        json?.id ||
        "";

      await loadMasterSettlementHistory();
      await createMasterSettlementPaymentDueTickler(savedSettlementRecordId);

      setMasterSettlementFormOpen(false);
      resetMasterSettlementPreviewForm();

      await launchMasterDocumentGenerationDialog({
        mode: "settlement",
        settlementRecordId: savedSettlementRecordId,
      });
    } catch (error: any) {
      setMasterSettlementRecordSave({
        ok: false,
        action: "local-settlement-record-save",
        previewOnly: true,
        localFirst: true,
        error: error?.message || "Local settlement commit failed.",
      });
    } finally {
      setMasterSettlementRecordSaveLoading(false);
    }
  }


  useEffect(() => {
    if (!masterSettlementFormOpen || activeMasterWorkspaceTab !== "payments") return;

    loadMasterSettlementProviderFeeDefaults();

    const costsAmount = masterSettlementCostDefaultValue();
    if (!clean(masterSettlementCostsInput) && costsAmount > 0) {
      setMasterSettlementCostsInput(formatMasterSettlementDollarInput(String(costsAmount)));
    }
  }, [masterSettlementFormOpen, activeMasterWorkspaceTab]);

  useEffect(() => {
    if (activeMasterWorkspaceTab !== "payments") return;
    void loadMasterSettlementHistory();
    void loadMasterSettlementTicklers();
  }, [activeMasterWorkspaceTab, masterLawsuitId]);

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

  const masterPaymentVisibleReceipts = masterPaymentShowVoided
    ? masterPaymentReceipts
    : masterPaymentReceipts.filter((receipt: any) => !receipt?.voided);

  const masterPaymentActiveReceiptCount = masterPaymentReceipts.filter((receipt: any) => !receipt?.voided).length;

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

  const masterProviderClientSummary = useMemo(() => {
    const providers = Array.from(
      new Set(
        rows
          .map((row: any) => clean(row.provider || providerName(row)))
          .filter(Boolean)
      )
    );

    if (providers.length === 0) return "—";
    if (providers.length === 1) return providers[0];

    return `${providers[0]} + ${providers.length - 1} more`;
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

  function masterDateOfLossDisplayValue(): string {
    const override = masterInfoOverrides.dateOfLoss;
    if (override !== undefined) return formatMasterDateDisplay(override);

    const local = masterLocalMetadataValue("dateOfLoss");
    if (local) return formatMasterDateDisplay(local);

    if (!masterDateOfLossSummary || masterDateOfLossSummary === "—") return "—";
    if (masterDateOfLossSummary.includes(" + ")) return masterDateOfLossSummary;

    return formatMasterDateDisplay(masterDateOfLossSummary);
  }

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

  function masterDocumentPreviewText(value: unknown): string {
    return String(value ?? "").trim();
  }

  function masterDocumentPreviewDate(value: unknown): string {
    const raw = masterDocumentPreviewText(value);
    if (!raw) return "";
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[2]}/${match[3]}/${match[1]}`;
    return raw;
  }

  function currentMasterLawsuitIdForDocumentPreview() {
    if (typeof window === "undefined") return "";
    return masterDocumentPreviewText(new URLSearchParams(window.location.search).get("master"));
  }

  async function loadMasterDocumentDataPreview(options?: { mode?: "lawsuit" | "settlement"; settlementRecordId?: string }) {
    const previewMasterLawsuitId = currentMasterLawsuitIdForDocumentPreview();
    const mode = options?.mode || masterDocumentLaunchMode || "lawsuit";
    const settlementRecordId = options?.settlementRecordId || masterDocumentSettlementRecordId || "";

    if (!previewMasterLawsuitId && !settlementRecordId) {
      setMasterDocumentDataPreview({
        ok: false,
        mode,
        error: mode === "settlement"
          ? "No Lawsuit ID or settlement record is available for settlement document preview."
          : "No Lawsuit ID is available for document data preview.",
        packet: null,
      });
      return;
    }

    setMasterDocumentDataPreviewLoading(true);
    setMasterDocumentFinalizationResult(null);
    setMasterDocumentPrintQueueResult(null);
    setMasterDocumentPrintResult(null);
    setMasterDocumentDataPreview(null);

    try {
      const url = mode === "settlement"
        ? `/api/settlements/documents-preview?masterLawsuitId=${encodeURIComponent(previewMasterLawsuitId)}${settlementRecordId ? `&settlementRecordId=${encodeURIComponent(settlementRecordId)}` : ""}`
        : `/api/documents/packet?masterLawsuitId=${encodeURIComponent(previewMasterLawsuitId)}`;

      const res = await fetch(url);
      const json = await res.json();
      setMasterDocumentDataPreview({
        ...(json || {}),
        mode,
        documentLaunchMode: mode,
      });

      if (!res.ok) {
        throw new Error(json?.error || (mode === "settlement" ? "Settlement document preview failed." : "Master lawsuit document data preview failed."));
      }
    } catch (err: any) {
      setMasterDocumentDataPreview({
        ok: false,
        mode,
        documentLaunchMode: mode,
        error: err?.message || (mode === "settlement" ? "Settlement document preview failed." : "Master lawsuit document data preview failed."),
        packet: null,
      });
    } finally {
      setMasterDocumentDataPreviewLoading(false);
    }
  }

  async function loadMasterDocumentRepositoryTemplates(options?: { mode?: "lawsuit" | "settlement" }) {
    const mode = options?.mode || masterDocumentLaunchMode || "lawsuit";
    const category = mode === "settlement" ? "settlement" : "lawsuit";

    setMasterDocumentRepositoryTemplatesLoading(true);
    setMasterDocumentRepositoryTemplatesError("");

    try {
      const response = await fetch(`/api/documents/templates?category=${encodeURIComponent(category)}`);
      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Document template repository preview failed.");
      }

      setMasterDocumentRepositoryTemplates(Array.isArray(json.templates) ? json.templates : []);
    } catch (error: any) {
      setMasterDocumentRepositoryTemplates([]);
      setMasterDocumentRepositoryTemplatesError(error?.message || "Document template repository preview failed.");
    } finally {
      setMasterDocumentRepositoryTemplatesLoading(false);
    }
  }

  async function launchMasterDocumentGenerationDialog(options?: { mode?: "lawsuit" | "settlement"; settlementRecordId?: string }) {
    const mode = options?.mode || "lawsuit";
    const settlementRecordId = options?.settlementRecordId || "";

    setMasterDocumentLaunchMode(mode);
    setMasterDocumentSettlementRecordId(settlementRecordId);
    setMasterDocumentTemplateQuery("");
    setMasterSelectedDocumentTemplateKey("");
    setMasterDocumentWorkflowStage("select");
    setMasterDocumentDeliveryPreview(null);
    setMasterDocumentDeliveryPreviewLoading(false);
    setMasterDocumentDraftCreateLoading(false);
    setMasterDocumentDeliveryToOverride("");
    setMasterDocumentGenerationPopupOpen(true);
    
    await Promise.all([
      loadMasterDocumentDataPreview({ mode, settlementRecordId }),
      loadMasterDocumentRepositoryTemplates({ mode }),
    ]);
  }

  function buildMasterDocumentDeliveryContext(selectedTemplate: { key: string; label: string; description: string } | null): DocumentDeliveryContext {
    const isSettlementDocumentMode = masterDocumentLaunchMode === "settlement" || masterDocumentDataPreview?.documentLaunchMode === "settlement" || masterDocumentDataPreview?.action === "settlement-documents-preview";
    const documentData = masterDocumentDataPreview?.packet?.metadata?.documentData;
    const settlementSummary = masterDocumentDataPreview?.settlementSummary || {};
    const settlementRows = Array.isArray(masterDocumentDataPreview?.rows) ? masterDocumentDataPreview.rows : [];
    const firstSettlementRow = settlementRows[0] || {};
    const templateFields = documentData?.templateFields || {};
    const uiFields = documentData?.uiFields || {};
    const claimIndexFields = documentData?.claimIndexFields || {};
    const referenceData = documentData?.referenceData || {};
    const insurerReference: any = (referenceData as any)?.insurer || {};
    const patientReference: any = (referenceData as any)?.patient || {};
    const insurerEmail = insurerReference?.email || insurerReference?.details?.email || insurerReference?.details?.Email || "";
    const patientEmail = patientReference?.email || patientReference?.details?.email || patientReference?.details?.Email || "";
    const recipientEmail = insurerEmail || patientEmail || "";

    const documentLabel = selectedTemplate?.label || "Document";
    const lawsuitId =
      masterDocumentPreviewText(settlementSummary.masterLawsuitId) ||
      masterDocumentPreviewText(masterDocumentDataPreview?.masterLawsuitId) ||
      masterDocumentPreviewText(templateFields.masterLawsuitId) ||
      currentMasterLawsuitIdForDocumentPreview();

    const providerName = isSettlementDocumentMode
      ? masterDocumentPreviewText(settlementSummary.provider || firstSettlementRow.provider)
      : masterDocumentPreviewText(templateFields.providerName || claimIndexFields.providerName);
    const patientName = isSettlementDocumentMode
      ? masterDocumentPreviewText(settlementSummary.patient || firstSettlementRow.patient)
      : masterDocumentPreviewText(templateFields.patientName || claimIndexFields.patientName);
    const insurerName = isSettlementDocumentMode
      ? masterDocumentPreviewText(settlementSummary.insurer || firstSettlementRow.insurer)
      : masterDocumentPreviewText(templateFields.insurerName || claimIndexFields.insurerName);

    return {
      source: "master_lawsuit",
      documentKey: selectedTemplate?.key || (isSettlementDocumentMode ? "settlement-document" : "master-lawsuit-document"),
      documentLabel,
      providerName,
      patientName,
      insurerName,
      indexNumber: masterDocumentPreviewText(templateFields.indexAaaNumber || uiFields.indexAaaNumber),
      ourCaseNumber: lawsuitId,
      suggestedRecipientName: insurerName || patientName || "",
      suggestedRecipientEmail: masterDocumentPreviewText(recipientEmail),
      masterLawsuitId: lawsuitId,
      metadata: {
        workflow: isSettlementDocumentMode ? "settlement" : "lawsuit",
        settlementRecordId: masterDocumentPreviewText(masterDocumentDataPreview?.settlementRecordId || masterDocumentSettlementRecordId),
        sourceOfTruth: isSettlementDocumentMode ? "barsh-matters-local" : "barsh-matters-document-packet",
      },
    } as any;
  }

  async function resolveMasterMaildropForDelivery(context: DocumentDeliveryContext): Promise<DocumentDeliveryContext> {
    const queryMasterLawsuitId = encodeURIComponent(String(context.masterLawsuitId || currentMasterLawsuitIdForDocumentPreview() || ""));
    const response = await fetch(`/api/documents/clio-maildrop-resolve?source=master_lawsuit&masterLawsuitId=${queryMasterLawsuitId}`);
    const json = await response.json().catch(() => ({}));

    if (!response.ok || !json?.ok) {
      throw new Error(json?.error || "Could not resolve the master lawsuit Clio Maildrop address.");
    }

    return {
      ...context,
      clioMaildropEmail: json.maildropEmail || context.clioMaildropEmail,
      clioMaildropLabel: json.maildropLabel || context.clioMaildropLabel,
    };
  }

  function formatDocumentDeliveryRecipientList(value: any): string {
    if (!value) return "";

    const rows = Array.isArray(value) ? value : [value];

    return rows
      .map((row) => {
        if (!row) return "";

        if (typeof row === "string") return row.trim();

        const address =
          row?.emailAddress?.address ||
          row?.email ||
          row?.address ||
          row?.mail ||
          row?.value ||
          "";
        const name =
          row?.emailAddress?.name ||
          row?.name ||
          row?.label ||
          row?.displayName ||
          "";

        if (name && address) return `${name} <${address}>`;
        return String(address || name || "").trim();
      })
      .filter(Boolean)
      .join(", ");
  }

  function readDocumentDeliveryGraphPreview(previewState: any): any {
    const graphPreview = previewState?.graphDraftPayloadPreview || {};
    return graphPreview?.payload || graphPreview;
  }

  function isValidDocumentDeliveryEmail(value: string): boolean {
    return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.trim());
  }

  function isDocumentDeliveryReadyForGraphDraft(previewState: any): boolean {
    const graphPayloadPreview = readDocumentDeliveryGraphPreview(previewState);
    const validation = graphPayloadPreview?.validation || graphPayloadPreview?.readiness || {};
    const manualToOverrideIsValid = isValidDocumentDeliveryEmail(masterDocumentDeliveryToOverride);
    const maildropReady = Boolean(validation?.maildropInCcOnly || validation?.hasMaildropCc);
    return Boolean(validation?.readyForGraphDraftCreate || (manualToOverrideIsValid && maildropReady));
  }

  function buildDocumentDeliveryToOverrideRecipient(): any[] {
    const email = masterDocumentDeliveryToOverride.trim();
    return isValidDocumentDeliveryEmail(email) ? [{ email, name: email }] : [];
  }

  async function launchMasterDocumentEmail(selectedTemplate: { key: string; label: string; description: string } | null) {
    setMasterDocumentDeliveryPreview(null);
    setMasterDocumentDeliveryPreviewLoading(true);
    setMasterDocumentDraftCreateLoading(false);

    try {
      const context = await resolveMasterMaildropForDelivery(buildMasterDocumentDeliveryContext(selectedTemplate));

      const response = await fetch("/api/documents/delivery-draft-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "master_lawsuit",
          context,
        }),
      });

      const preview = await response.json().catch(() => null);

      const nextPreview = {
        ...(preview || {}),
        ok: Boolean(response.ok && preview?.ok),
        responseStatus: response.status,
        context,
        documentLabel: context.documentLabel || selectedTemplate?.label || "Document",
        draft: preview?.draft || {},
        graphDraftPayloadPreview: preview?.graphDraftPayloadPreview || {},
      };

      if (!response.ok || !preview?.ok) {
        setMasterDocumentDeliveryPreview({
          ...nextPreview,
          ok: false,
          error: preview?.error || "Document delivery draft preview failed.",
        });
        return;
      }

      setMasterDocumentDeliveryPreview(nextPreview);
    } catch (error: any) {
      setMasterDocumentDeliveryPreview({
        ok: false,
        error: error?.message || "Document delivery draft preview failed.",
        context: buildMasterDocumentDeliveryContext(selectedTemplate),
        documentLabel: selectedTemplate?.label || "Document",
        draft: {},
        graphDraftPayloadPreview: {},
      });
    } finally {
      setMasterDocumentDeliveryPreviewLoading(false);
    }
  }

  async function createMasterDocumentOutlookDraft() {
    const previewState = masterDocumentDeliveryPreview;

    if (!previewState || !isDocumentDeliveryReadyForGraphDraft(previewState)) {
      setMasterDocumentDeliveryPreview({
        ...(previewState || {}),
        ok: false,
        createError:
          "Graph draft creation is blocked until the preview has a To recipient, MailDrop in Cc, and no MailDrop in Bcc.",
      });
      return;
    }

    setMasterDocumentDraftCreateLoading(true);

    try {
      const response = await fetch("/api/graph/create-draft?confirm=create-graph-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "master_lawsuit",
          context: previewState.context,
          draft: {
            ...(previewState.draft || {}),
            ...(masterDocumentDeliveryToOverride.trim() ? { to: buildDocumentDeliveryToOverrideRecipient() } : {}),
          },
          ...(masterDocumentDeliveryToOverride.trim()
            ? {}
            : { graphDraftPayloadPreview: readDocumentDeliveryGraphPreview(previewState) }),
          to: masterDocumentDeliveryToOverride.trim() ? buildDocumentDeliveryToOverrideRecipient() : undefined,
          allowMetadataOnlyDraft: "true",
        }),
      });

      const result = await response.json().catch(() => null);

      setMasterDocumentDeliveryPreview({
        ...previewState,
        createResult: result,
        draftCreated: Boolean(response.ok && result?.createsOutlookDraft),
        createError: response.ok ? "" : result?.error || "Graph draft creation failed.",
      });
    } catch (error: any) {
      setMasterDocumentDeliveryPreview({
        ...previewState,
        createError: error?.message || "Graph draft creation failed.",
      });
    } finally {
      setMasterDocumentDraftCreateLoading(false);
    }
  }

  function launchMasterDocumentPrint(selectedTemplate: { key: string; label: string; description: string } | null) {
    const context = buildMasterDocumentDeliveryContext(selectedTemplate);
    const isSettlementDocumentMode =
      masterDocumentLaunchMode === "settlement" ||
      masterDocumentDataPreview?.documentLaunchMode === "settlement" ||
      masterDocumentDataPreview?.action === "settlement-documents-preview";

    if (isSettlementDocumentMode) {
      const docxDownloadUrl =
        masterDocumentFinalizationResult?.generatedDocument?.downloadUrl ||
        masterDocumentFinalizationResult?.selectedDocument?.generatedDocument?.downloadUrl ||
        masterDocumentFinalizationResult?.selectedDocument?.docxDownloadUrl ||
        "";

      if (!docxDownloadUrl) {
        alert("Finalize the settlement document before opening the generated DOCX route.");
        return;
      }

      const docxWindow = window.open(docxDownloadUrl, "_blank", "noopener,noreferrer");

      if (!docxWindow) {
        alert("The browser blocked the generated DOCX route.  Please allow popups for Barsh Matters and try again.");
        return;
      }

      setMasterDocumentPrintResult({
        ok: true,
        action: "settlement-document-docx-open-for-print",
        documentLabel: context.documentLabel,
        filename:
          masterDocumentFinalizationResult?.generatedDocument?.filename ||
          masterDocumentFinalizationResult?.selectedDocument?.filename ||
          context.documentLabel ||
          "",
        docxDownloadUrl,
        finalizedPdfGenerated: false,
        printablePdfReady: false,
        clioRecordsChanged: false,
        emailSent: false,
        note: "Opened the real generated DOCX route.  PDF generation and browser print-ready PDF are not yet wired.",
      });
      return;
    }

    const printableUrl = resolvePrintableUrl(context);

    if (!printableUrl) {
      alert("A finalized PDF/printable document is required before printing.  The shared print action is wired, but the PDF generation route is not ready yet.");
      return;
    }

    const printWindow = window.open(printableUrl, "_blank", "noopener,noreferrer");
    if (!printWindow) {
      alert("The browser blocked the print window.  Please allow popups for Barsh Matters and try again.");
      return;
    }

    window.setTimeout(() => {
      try {
        printWindow.print();
      } catch {
        // Browser-controlled print behavior; the opened PDF can still be printed manually.
      }
    }, 750);
  }

  async function finalizeMasterSettlementDocumentPlaceholder(selectedTemplate: { key: string; label: string; description: string } | null) {
    const context = buildMasterDocumentDeliveryContext(selectedTemplate);
    const isSettlementDocumentMode =
      masterDocumentLaunchMode === "settlement" ||
      masterDocumentDataPreview?.documentLaunchMode === "settlement" ||
      masterDocumentDataPreview?.action === "settlement-documents-preview";

    if (!isSettlementDocumentMode) {
      setMasterDocumentWorkflowStage("delivery");
      return;
    }

    if (!selectedTemplate?.key) {
      alert("Select a settlement document before finalizing.");
      return;
    }

    const masterLawsuitId = currentMasterLawsuitIdForDocumentPreview();
    const settlementRecordId = masterDocumentPreviewText(
      masterDocumentDataPreview?.settlementRecordId ||
        masterDocumentSettlementRecordId ||
        masterSettlementHistory?.activeRecordId ||
        masterSettlementRecordSave?.record?.id
    );

    if (!masterLawsuitId && !settlementRecordId) {
      alert("No lawsuit ID or settlement record ID is available for local settlement document finalization.");
      return;
    }

    setMasterDocumentFinalizing(true);
    setMasterDocumentFinalizationResult(null);

    try {
      const response = await fetch("/api/settlements/documents-finalize-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterLawsuitId,
          settlementRecordId,
          templateKey: selectedTemplate.key,
          templateLabel: selectedTemplate.label || context.documentLabel,
          confirmFinalize: true,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        const message = json?.error || "Local settlement document finalization failed.";
        setMasterDocumentFinalizationResult(json || { ok: false, error: message });
        alert(message);
        return;
      }

      setMasterDocumentFinalizationResult(json);
      setMasterDocumentWorkflowStage("delivery");
    } catch (err: any) {
      const fallback = {
        ok: false,
        action: "settlement-document-finalize-local",
        error: err?.message || "Local settlement document finalization failed.",
      };
      setMasterDocumentFinalizationResult(fallback);
      alert(fallback.error);
    } finally {
      setMasterDocumentFinalizing(false);
    }
  }

  async function sendMasterDocumentToPrintQueue(selectedTemplate: { key: string; label: string; description: string } | null) {
    const context = buildMasterDocumentDeliveryContext(selectedTemplate);
    const isSettlementDocumentMode =
      masterDocumentLaunchMode === "settlement" ||
      masterDocumentDataPreview?.documentLaunchMode === "settlement" ||
      masterDocumentDataPreview?.action === "settlement-documents-preview";

    if (!isSettlementDocumentMode) {
      alert(`${documentDeliverySafetyNote()}\n\nSend to Print Queue is reserved for the generalized finalized-document queue backend and is not yet writing queue records.\n\nDocument: ${context.documentLabel}`);
      return;
    }

    const finalizationId = Number(masterDocumentFinalizationResult?.finalizationRecord?.id || 0);

    if (!finalizationId) {
      alert("Finalize the settlement document before sending it to the print queue.");
      return;
    }

    setMasterDocumentPrintQueueLoading(true);
    setMasterDocumentPrintQueueResult(null);

    try {
      const response = await fetch("/api/settlements/documents-print-queue-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          finalizationId,
          confirmAdd: true,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        const message = json?.error || "Could not send the finalized settlement document placeholder to the print queue.";
        setMasterDocumentPrintQueueResult(json || { ok: false, error: message });
        alert(message);
        return;
      }

      setMasterDocumentPrintQueueResult(json);
    } catch (err: any) {
      const fallback = {
        ok: false,
        action: "settlement-document-print-queue-local",
        error: err?.message || "Could not send the finalized settlement document placeholder to the print queue.",
      };
      setMasterDocumentPrintQueueResult(fallback);
      alert(fallback.error);
    } finally {
      setMasterDocumentPrintQueueLoading(false);
    }
  }

  function formatMasterEmailThreadTimestamp(value: any): string {
    const raw = clean(value);
    if (!raw) return "—";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    return date.toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function summarizeMasterEmailRecipients(value: any): string {
    const recipients = Array.isArray(value) ? value : [];
    const labels = recipients
      .map((recipient: any) => {
        const emailAddress = recipient?.emailAddress || {};
        const name = clean(emailAddress.name || recipient?.name);
        const address = clean(emailAddress.address || recipient?.email || recipient?.address);
        if (name && address) return `${name} <${address}>`;
        return name || address;
      })
      .filter(Boolean);

    return labels.length ? labels.join(", ") : "—";
  }

  function currentMasterEmailLawsuitId(): string {
    return currentMasterLawsuitIdForDocumentPreview() || clean(value);
  }

  function firstMasterEmailConversationId(): string {
    const threads = Array.isArray(masterEmailThreadPreviewResult?.threads) ? masterEmailThreadPreviewResult.threads : [];
    return clean(threads[0]?.conversationId);
  }

  function masterEmailSyncContext(conversationId: string) {
    const masterId = currentMasterEmailLawsuitId();
    const threads = Array.isArray(masterEmailThreadPreviewResult?.threads) ? masterEmailThreadPreviewResult.threads : [];
    const matchingThread =
      threads.find((thread: any) => clean(thread?.conversationId) === conversationId) ||
      threads[0] ||
      {};

    return {
      conversationId,
      masterLawsuitId: masterId,
      clioDisplayNumber: clean(matchingThread?.clioDisplayNumber),
      clioMaildropLabel: clean(matchingThread?.clioMaildropLabel),
      limit: 25,
    };
  }

  async function loadMasterEmailThreadPreview() {
    const masterId = currentMasterEmailLawsuitId();

    if (!masterId) {
      setMasterEmailThreadPreviewResult({
        ok: false,
        error: "No Lawsuit ID is available for master Emails lookup.",
      });
      return;
    }

    const params = new URLSearchParams();
    params.set("masterLawsuitId", masterId);
    params.set("limit", "25");

    setMasterEmailThreadPreviewLoading(true);
    setMasterEmailThreadPreviewResult(null);

    try {
      const response = await fetch(`/api/graph/local-thread-preview?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await response.json().catch(() => ({}));
      setMasterEmailThreadPreviewResult(json);
    } catch (err: any) {
      setMasterEmailThreadPreviewResult({
        ok: false,
        error: err?.message || "Could not load local master email/thread records.",
      });
    } finally {
      setMasterEmailThreadPreviewLoading(false);
    }
  }

  async function previewMasterGraphThreadUpdates(conversationIdOverride?: string) {
    const conversationId = clean(conversationIdOverride) || firstMasterEmailConversationId();

    if (!conversationId) {
      setMasterGraphThreadSyncPreviewResult({
        ok: false,
        error: "Load local Master Emails first so Barsh Matters can identify the stored Microsoft Graph conversationId.",
      });
      return;
    }

    setMasterGraphThreadSyncPreviewLoading(true);
    setMasterGraphThreadSyncPreviewConversationId(conversationId);
    setMasterGraphThreadSyncPreviewResult(null);
    setMasterGraphThreadSyncResult(null);

    try {
      const params = new URLSearchParams();
      params.set("confirm", "preview-graph-thread-sync");
      params.set("conversationId", conversationId);
      params.set("limit", "25");

      const response = await fetch(`/api/graph/thread-sync-preview?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await response.json().catch(() => ({}));
      setMasterGraphThreadSyncPreviewResult(json);
    } catch (err: any) {
      setMasterGraphThreadSyncPreviewResult({
        ok: false,
        error: err?.message || "Master Graph thread sync preview failed.",
      });
    } finally {
      setMasterGraphThreadSyncPreviewLoading(false);
    }
  }

  async function syncMasterGraphThreadToBarshMatters(conversationIdOverride?: string) {
    const conversationId = clean(conversationIdOverride) || masterGraphThreadSyncPreviewConversationId || firstMasterEmailConversationId();

    if (!conversationId) {
      setMasterGraphThreadSyncResult({
        ok: false,
        error: "Load local Master Emails first so Barsh Matters can identify the stored Microsoft Graph conversationId.",
      });
      return;
    }

    if (!masterGraphThreadSyncPreviewResult || masterGraphThreadSyncPreviewResult.action !== "graph-thread-sync-preview") {
      setMasterGraphThreadSyncResult({
        ok: false,
        error: "Run Preview Graph Updates before syncing this master thread to Barsh Matters.",
      });
      return;
    }

    const previewConversationId = clean(masterGraphThreadSyncPreviewResult?.query?.conversationId || masterGraphThreadSyncPreviewConversationId);
    if (previewConversationId && previewConversationId !== conversationId) {
      setMasterGraphThreadSyncResult({
        ok: false,
        error: "Preview Graph Updates must be run for this specific master thread before syncing it.",
      });
      return;
    }

    const confirmed = window.confirm(
      "Sync this Microsoft Graph thread to this Master Lawsuit in Barsh Matters?\n\nThis will read Microsoft Graph and update local EmailThread / EmailMessage metadata only.  It will not create a draft, send email, write Clio, upload documents, or use local Outlook automation."
    );

    if (!confirmed) return;

    setMasterGraphThreadSyncLoading(true);
    setMasterGraphThreadSyncConversationId(conversationId);
    setMasterGraphThreadSyncResult(null);

    try {
      const response = await fetch("/api/graph/thread-sync?confirm=sync-graph-thread", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(masterEmailSyncContext(conversationId)),
      });

      const json = await response.json().catch(() => ({}));
      setMasterGraphThreadSyncResult(json);

      if (response.ok && json?.action === "graph-thread-sync" && json?.databaseRecordsChanged === true) {
        await loadMasterEmailThreadPreview();
      }
    } catch (err: any) {
      setMasterGraphThreadSyncResult({
        ok: false,
        error: err?.message || "Master Graph thread sync failed.",
      });
    } finally {
      setMasterGraphThreadSyncLoading(false);
    }
  }

  function renderMasterEmailThreadsPanel() {
    const threads = Array.isArray(masterEmailThreadPreviewResult?.threads) ? masterEmailThreadPreviewResult.threads : [];
    const counts = masterEmailThreadPreviewResult?.counts || {};
    const masterId = currentMasterEmailLawsuitId();
    const hasConversationId = Boolean(firstMasterEmailConversationId());
    const syncPreviewCounts = masterGraphThreadSyncPreviewResult?.counts || {};
    const syncCounts = masterGraphThreadSyncResult?.counts || {};

    return (
      <section id="master-email-threads-section" style={masterWorkspacePanelStyle}>
        <div style={masterWorkspacePanelHeaderStyle}>
          <div>
            <div style={masterWorkspacePanelEyebrowStyle}>Active Workspace</div>
            <h2 style={masterWorkspacePanelTitleStyle}>Emails</h2>
            <p style={{ margin: "6px 0 0", color: colors.muted, lineHeight: 1.5 }}>
              Unified Master Lawsuit email area.  Graph-synced messages and MailDrop-linked thread records appear here together from local Barsh Matters email metadata.  Opening this panel reads local records only; it does not create drafts, send email, write Clio, or change database records.
            </p>
          </div>
          <div style={masterWorkspacePanelPillStyle}>Automatic local email view</div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <button
            type="button"
            onClick={loadMasterEmailThreadPreview}
            disabled={masterEmailThreadPreviewLoading || masterGraphThreadSyncPreviewLoading || masterGraphThreadSyncLoading}
            style={{
              padding: "8px 11px",
              border: "1px solid #2563eb",
              background: masterEmailThreadPreviewLoading ? "#f3f4f6" : "#2563eb",
              color: masterEmailThreadPreviewLoading ? "#666" : "#fff",
              borderRadius: 8,
              cursor: masterEmailThreadPreviewLoading ? "not-allowed" : "pointer",
              fontWeight: 850,
              whiteSpace: "nowrap",
            }}
          >
            {masterEmailThreadPreviewLoading ? "Loading..." : "Refresh Emails"}
          </button>

          <button
            type="button"
            hidden
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => previewMasterGraphThreadUpdates()}
            disabled={!hasConversationId || masterEmailThreadPreviewLoading || masterGraphThreadSyncPreviewLoading || masterGraphThreadSyncLoading}
            title={!hasConversationId ? "Load local Master Emails first." : "Preview Microsoft Graph messages for this stored conversationId without persisting changes."}
            style={{
              padding: "8px 11px",
              border: "1px solid #0f766e",
              background:
                !hasConversationId || masterGraphThreadSyncPreviewLoading || masterGraphThreadSyncLoading ? "#f3f4f6" : "#0f766e",
              color:
                !hasConversationId || masterGraphThreadSyncPreviewLoading || masterGraphThreadSyncLoading ? "#666" : "#fff",
              borderRadius: 8,
              cursor:
                !hasConversationId || masterGraphThreadSyncPreviewLoading || masterGraphThreadSyncLoading ? "not-allowed" : "pointer",
              fontWeight: 850,
              whiteSpace: "nowrap",
            }}
          >
            {masterGraphThreadSyncPreviewLoading ? "Calculating..." : "Preview Graph Updates"}
          </button>

          <button
            type="button"
            hidden
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => syncMasterGraphThreadToBarshMatters()}
            disabled={
              !hasConversationId ||
              !masterGraphThreadSyncPreviewResult ||
              masterGraphThreadSyncPreviewLoading ||
              masterGraphThreadSyncLoading
            }
            title="Run only after Preview Graph Updates.  Persists local EmailThread / EmailMessage metadata only."
            style={{
              padding: "8px 11px",
              border: "1px solid #7c3aed",
              background:
                !hasConversationId ||
                !masterGraphThreadSyncPreviewResult ||
                masterGraphThreadSyncPreviewLoading ||
                masterGraphThreadSyncLoading
                  ? "#f3f4f6"
                  : "#7c3aed",
              color:
                !hasConversationId ||
                !masterGraphThreadSyncPreviewResult ||
                masterGraphThreadSyncPreviewLoading ||
                masterGraphThreadSyncLoading
                  ? "#666"
                  : "#fff",
              borderRadius: 8,
              cursor:
                !hasConversationId ||
                !masterGraphThreadSyncPreviewResult ||
                masterGraphThreadSyncPreviewLoading ||
                masterGraphThreadSyncLoading
                  ? "not-allowed"
                  : "pointer",
              fontWeight: 850,
              whiteSpace: "nowrap",
            }}
          >
            {masterGraphThreadSyncLoading ? "Syncing..." : "Sync Thread to Barsh Matters"}
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <div style={masterWorkspaceCardStyle}>
            <div style={masterWorkspaceCardLabelStyle}>Lawsuit ID</div>
            <div style={masterWorkspaceCardTextStyle}>{masterId || "—"}</div>
          </div>
          <div style={masterWorkspaceCardStyle}>
            <div style={masterWorkspaceCardLabelStyle}>Threads</div>
            <div style={masterWorkspaceCardTextStyle}>{Number(counts.threads || 0)}</div>
          </div>
          <div style={masterWorkspaceCardStyle}>
            <div style={masterWorkspaceCardLabelStyle}>Messages</div>
            <div style={masterWorkspaceCardTextStyle}>{Number(counts.messages || 0)}</div>
          </div>
          <div style={masterWorkspaceCardStyle}>
            <div style={masterWorkspaceCardLabelStyle}>Safety</div>
            <div style={{ ...masterWorkspaceCardTextStyle, color: "#16a34a", fontWeight: 950 }}>Preview First</div>
          </div>
        </div>

        {masterEmailThreadPreviewResult && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8, marginBottom: 14, fontSize: 12 }}>
            {[
              ["Graph calls", masterEmailThreadPreviewResult.graphCallsMade ? "YES" : "No"],
              ["Creates draft", masterEmailThreadPreviewResult.createsOutlookDraft ? "YES" : "No"],
              ["Sends email", masterEmailThreadPreviewResult.sendsEmail ? "YES" : "No"],
              ["Reads mailbox", masterEmailThreadPreviewResult.readsMailbox ? "YES" : "No"],
              ["Syncs mailbox", masterEmailThreadPreviewResult.syncsMailbox ? "YES" : "No"],
              ["DB changed", masterEmailThreadPreviewResult.databaseRecordsChanged ? "YES" : "No"],
            ].map(([label, itemValue]) => (
              <div key={label} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, background: "#f8fafc" }}>
                <div style={{ fontSize: 10, fontWeight: 950, color: colors.subtle, textTransform: "uppercase" }}>{label}</div>
                <div style={{ marginTop: 3, fontWeight: 950, color: itemValue === "YES" ? "#dc2626" : "#16a34a" }}>{itemValue}</div>
              </div>
            ))}
          </div>
        )}

        {masterGraphThreadSyncPreviewResult && (
          <section style={{ border: "1px solid #99f6e4", borderRadius: 16, padding: 14, background: "#f0fdfa", marginBottom: 14 }}>
            <div style={{ fontWeight: 950, color: "#0f766e", marginBottom: 8 }}>Graph Update Preview</div>
            {masterGraphThreadSyncPreviewResult.error ? (
              <div style={{ color: "#dc2626", fontWeight: 850 }}>{clean(masterGraphThreadSyncPreviewResult.error)}</div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8, fontSize: 12 }}>
                  {[
                    ["Graph calls", masterGraphThreadSyncPreviewResult.graphCallsMade ? "YES" : "No"],
                    ["Reads mailbox", masterGraphThreadSyncPreviewResult.readsMailbox ? "YES" : "No"],
                    ["Creates draft", masterGraphThreadSyncPreviewResult.createsOutlookDraft ? "YES" : "No"],
                    ["Sends email", masterGraphThreadSyncPreviewResult.sendsEmail ? "YES" : "No"],
                    ["Syncs mailbox", masterGraphThreadSyncPreviewResult.syncsMailbox ? "YES" : "No"],
                    ["DB changed", masterGraphThreadSyncPreviewResult.databaseRecordsChanged ? "YES" : "No"],
                  ].map(([label, itemValue]) => (
                    <div key={label} style={{ border: "1px solid #ccfbf1", borderRadius: 12, padding: 10, background: "#fff" }}>
                      <div style={{ fontSize: 10, fontWeight: 950, color: colors.subtle, textTransform: "uppercase" }}>{label}</div>
                      <div style={{ marginTop: 3, fontWeight: 950, color: itemValue === "YES" ? "#dc2626" : "#16a34a" }}>{itemValue}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, color: colors.ink, fontSize: 13, fontWeight: 800 }}>
                  Graph messages found: {Number(syncPreviewCounts.graphMessages || 0)} · Drafts: {Number(syncPreviewCounts.drafts || 0)} · Sent/received: {Number(syncPreviewCounts.sentOrReceived || 0)} · With attachments: {Number(syncPreviewCounts.withAttachments || 0)}
                </div>
                <div style={{ marginTop: 6, color: colors.muted, fontSize: 12 }}>Preview only.  No Barsh Matters records were updated.</div>
              </>
            )}
          </section>
        )}

        {masterGraphThreadSyncResult && (
          <section style={{ border: "1px solid #ddd6fe", borderRadius: 16, padding: 14, background: "#f5f3ff", marginBottom: 14 }}>
            <div style={{ fontWeight: 950, color: "#6d28d9", marginBottom: 8 }}>Graph Thread Sync Result</div>
            {masterGraphThreadSyncResult.error ? (
              <div style={{ color: "#dc2626", fontWeight: 850 }}>{clean(masterGraphThreadSyncResult.error)}</div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8, fontSize: 12 }}>
                  {[
                    ["Graph calls", masterGraphThreadSyncResult.graphCallsMade ? "YES" : "No"],
                    ["Reads mailbox", masterGraphThreadSyncResult.readsMailbox ? "YES" : "No"],
                    ["Creates draft", masterGraphThreadSyncResult.createsOutlookDraft ? "YES" : "No"],
                    ["Sends email", masterGraphThreadSyncResult.sendsEmail ? "YES" : "No"],
                    ["Syncs mailbox", masterGraphThreadSyncResult.syncsMailbox ? "YES" : "No"],
                    ["DB changed", masterGraphThreadSyncResult.databaseRecordsChanged ? "YES" : "No"],
                  ].map(([label, itemValue]) => (
                    <div key={label} style={{ border: "1px solid #ede9fe", borderRadius: 12, padding: 10, background: "#fff" }}>
                      <div style={{ fontSize: 10, fontWeight: 950, color: colors.subtle, textTransform: "uppercase" }}>{label}</div>
                      <div style={{ marginTop: 3, fontWeight: 950, color: itemValue === "YES" ? "#dc2626" : "#16a34a" }}>{itemValue}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, color: colors.ink, fontSize: 13, fontWeight: 800 }}>
                  Graph messages: {Number(syncCounts.graphMessages || 0)} · Messages upserted: {Number(masterGraphThreadSyncResult.persisted?.messagesUpserted || 0)} · Matter links created: {Number(masterGraphThreadSyncResult.persisted?.matterLinksCreated || 0)}
                </div>
                <div style={{ marginTop: 6, color: colors.muted, fontSize: 12 }}>
                  Confirmed sync persists local Barsh Matters email metadata only.  It does not send email, create drafts, write Clio, upload documents, or use local Outlook automation.
                </div>
              </>
            )}
          </section>
        )}

        {masterEmailThreadPreviewResult?.error && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 800 }}>
            {clean(masterEmailThreadPreviewResult.error)}
          </div>
        )}

        {!masterEmailThreadPreviewResult && !masterEmailThreadPreviewLoading && (
          <div style={{ marginTop: 12, color: colors.muted }}>
            Email records load automatically when this panel opens.  Background Graph/MailDrop sync will populate this area without user action.
          </div>
        )}

        {masterEmailThreadPreviewLoading && (
          <div style={{ marginTop: 12, color: colors.muted }}>Loading local master email/thread records...</div>
        )}

        {masterEmailThreadPreviewResult && threads.length === 0 && !masterEmailThreadPreviewResult?.error && (
          <div style={{ marginTop: 12, color: colors.muted }}>
            No local email/thread records found yet for this Master Lawsuit.
          </div>
        )}

        {threads.length > 0 && (
          <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
            {threads.map((thread: any) => {
              const threadKey = clean(thread.id || thread.conversationId);
              const threadExpanded = expandedMasterEmailThreadId === threadKey;
              const messages = Array.isArray(thread.messages) ? thread.messages : [];
              const anyMasterMessageOutlookLinkAvailable = messages.some((message: any) => Boolean(clean(message.webLink)));
              

              return (
                <article key={threadKey} style={{ display: "grid", gap: 10, padding: 14, borderRadius: 16, border: "1px solid #e2e8f0", background: "#ffffff", boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 950, color: colors.ink }}>{clean(thread.subject) || "Email thread"}</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: colors.subtle, fontWeight: 750 }}>
                        {formatMasterEmailThreadTimestamp(thread.latestMessageAt)} · {messages.length} message{messages.length === 1 ? "" : "s"} · {clean(thread.clioMaildropLabel) || "No MailDrop label"}
                      </div>
                      {anyMasterMessageOutlookLinkAvailable && (
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            marginTop: 7,
                            padding: "3px 8px",
                            border: "1px solid #0f766e",
                            borderRadius: 999,
                            background: "#ecfeff",
                            color: "#0f766e",
                            fontSize: 11,
                            fontWeight: 950,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Outlook link available
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => previewMasterGraphThreadUpdates(clean(thread.conversationId))}
                        disabled={!clean(thread.conversationId) || masterGraphThreadSyncPreviewLoading || masterGraphThreadSyncLoading}
                        title="Preview Microsoft Graph updates for this specific master thread without persisting changes."
                        style={{
                          fontSize: 12,
                          padding: "5px 9px",
                          border: "1px solid #0f766e",
                          borderRadius: 999,
                          background: masterGraphThreadSyncPreviewLoading && masterGraphThreadSyncPreviewConversationId === clean(thread.conversationId) ? "#f3f4f6" : "#ecfeff",
                          color: "#0f766e",
                          cursor: !clean(thread.conversationId) || masterGraphThreadSyncPreviewLoading || masterGraphThreadSyncLoading ? "not-allowed" : "pointer",
                          whiteSpace: "nowrap",
                          fontWeight: 800,
                        }}
                      >
                        {masterGraphThreadSyncPreviewLoading && masterGraphThreadSyncPreviewConversationId === clean(thread.conversationId) ? "Calculating..." : "Preview This Thread"}
                      </button>

                      <button
                        type="button"
                        onClick={() => syncMasterGraphThreadToBarshMatters(clean(thread.conversationId))}
                        disabled={
                          !clean(thread.conversationId) ||
                          !masterGraphThreadSyncPreviewResult ||
                          clean(masterGraphThreadSyncPreviewResult?.query?.conversationId || masterGraphThreadSyncPreviewConversationId) !== clean(thread.conversationId) ||
                          masterGraphThreadSyncPreviewLoading ||
                          masterGraphThreadSyncLoading
                        }
                        title="Run only after Preview This Thread.  Persists local EmailThread / EmailMessage metadata only."
                        style={{
                          fontSize: 12,
                          padding: "5px 9px",
                          border: "1px solid #7c3aed",
                          borderRadius: 999,
                          background:
                            masterGraphThreadSyncLoading && masterGraphThreadSyncConversationId === clean(thread.conversationId)
                              ? "#f3f4f6"
                              : "#f5f3ff",
                          color: "#6d28d9",
                          cursor:
                            !clean(thread.conversationId) ||
                            !masterGraphThreadSyncPreviewResult ||
                            clean(masterGraphThreadSyncPreviewResult?.query?.conversationId || masterGraphThreadSyncPreviewConversationId) !== clean(thread.conversationId) ||
                            masterGraphThreadSyncPreviewLoading ||
                            masterGraphThreadSyncLoading
                              ? "not-allowed"
                              : "pointer",
                          whiteSpace: "nowrap",
                          fontWeight: 800,
                        }}
                      >
                        {masterGraphThreadSyncLoading && masterGraphThreadSyncConversationId === clean(thread.conversationId) ? "Syncing..." : "Sync This Thread"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setExpandedMasterEmailThreadId(threadExpanded ? null : threadKey)}
                        style={{ fontSize: 12, padding: "5px 9px", border: "1px solid #94a3b8", borderRadius: 999, background: threadExpanded ? "#e2e8f0" : "#fff", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 800 }}
                      >
                        {threadExpanded ? "Hide Thread" : "View Thread"}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
                    <div><div style={{ fontSize: 11, color: colors.subtle, fontWeight: 900, textTransform: "uppercase" }}>Source</div><div style={{ marginTop: 3, fontSize: 13, fontWeight: 850, color: colors.ink }}>{clean(thread.source) || "—"}</div></div>
                    <div><div style={{ fontSize: 11, color: colors.subtle, fontWeight: 900, textTransform: "uppercase" }}>Direction</div><div style={{ marginTop: 3, fontSize: 13, fontWeight: 850, color: colors.ink }}>{clean(thread.direction) || "—"}</div></div>
                    <div><div style={{ fontSize: 11, color: colors.subtle, fontWeight: 900, textTransform: "uppercase" }}>Conversation ID</div><div style={{ marginTop: 3, fontSize: 13, fontWeight: 850, color: colors.ink, overflowWrap: "anywhere" }}>{clean(thread.conversationId) || "—"}</div></div>
                    <div><div style={{ fontSize: 11, color: colors.subtle, fontWeight: 900, textTransform: "uppercase" }}>MailDrop Present</div><div style={{ marginTop: 3, fontSize: 13, fontWeight: 850, color: thread.clioMaildropEmailPresent ? "#16a34a" : "#dc2626" }}>{thread.clioMaildropEmailPresent ? "Yes" : "No"}</div></div>
                  </div>

                  {threadExpanded && (
                    <div style={{ display: "grid", gap: 10, padding: 10, borderRadius: 12, border: "1px solid #e5e7eb", background: "#f8fafc" }}>
                      {messages.length === 0 && <div style={{ color: colors.muted }}>This local thread has no persisted message records yet.</div>}

                      {messages.map((message: any) => {
                        const messageKey = clean(message.id || message.graphMessageId);
                        const messageExpanded = expandedMasterEmailMessageId === messageKey;

                        return (
                          <div key={messageKey} style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#ffffff", padding: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                              <div>
                                <div style={{ fontWeight: 950, color: colors.ink }}>{message.isDraft ? "Draft" : message.isSent ? "Sent" : "Message"} · {clean(message.subject) || clean(thread.subject) || "No subject"}</div>
                                <div style={{ marginTop: 4, fontSize: 12, color: colors.subtle, fontWeight: 750 }}>
                                  {formatMasterEmailThreadTimestamp(message.sentAt || message.receivedAt)} · From: {clean(message.fromEmail || message.from) || "—"}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => setExpandedMasterEmailMessageId(messageExpanded ? null : messageKey)}
                                style={{ fontSize: 12, padding: "5px 9px", border: "1px solid #94a3b8", borderRadius: 999, background: messageExpanded ? "#e2e8f0" : "#fff", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 800 }}
                              >
                                {messageExpanded ? "Hide Details" : "Details"}
                              </button>
                            </div>

                            <div style={{ marginTop: 8, color: colors.muted, fontSize: 13, lineHeight: 1.45 }}>
                              {clean(message.bodyPreview) || "No local body preview available."}
                            </div>

                            {message.webLinkPresent && (
                              <div
                                style={{
                                  marginTop: 8,
                                  display: "flex",
                                  gap: 8,
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                  fontSize: 12,
                                  fontWeight: 850,
                                  color: "#16a34a",
                                }}
                              >
                                <span>Outlook web link is stored locally.</span>
                                {clean(message.webLink) && (
                                  <a
                                    href={clean(message.webLink)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      border: "1px solid #0f766e",
                                      borderRadius: 999,
                                      padding: "4px 8px",
                                      color: "#0f766e",
                                      background: "#ecfeff",
                                      textDecoration: "none",
                                      fontWeight: 950,
                                    }}
                                  >
                                    Open in Outlook
                                  </a>
                                )}
                              </div>
                            )}

                            {messageExpanded && (
                              <div style={{ marginTop: 10, display: "grid", gap: 8, fontSize: 12, color: colors.ink }}>
                                <div><strong>To:</strong> {summarizeMasterEmailRecipients(message.toRecipients)}</div>
                                <div><strong>Cc:</strong> {summarizeMasterEmailRecipients(message.ccRecipients)}</div>
                                <div><strong>Bcc:</strong> {summarizeMasterEmailRecipients(message.bccRecipients)}</div>
                                <div><strong>Graph Message ID:</strong> <span style={{ overflowWrap: "anywhere" }}>{clean(message.graphMessageId) || "—"}</span></div>
                                <div><strong>Attachments:</strong> {Array.isArray(message.attachments) ? message.attachments.length : 0}</div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {masterEmailThreadPreviewResult && (
          <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: "pointer", fontWeight: 850 }}>Raw local master thread preview JSON</summary>
            <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto", margin: "8px 0 0 0", padding: 10, background: "#0f172a", color: "#e5e7eb", borderRadius: 8, fontSize: 12 }}>
              {JSON.stringify(masterEmailThreadPreviewResult, null, 2)}
            </pre>
          </details>
        )}
      </section>
    );
  }

  function renderMasterDocumentGenerationPopup() {
    if (!masterDocumentGenerationPopupOpen) return null;
    const documentData = masterDocumentDataPreview?.packet?.metadata?.documentData;
    const templateFields = documentData?.templateFields || {};
    const uiFields = documentData?.uiFields || {};
    const claimIndexFields = documentData?.claimIndexFields || {};
    const referenceData = documentData?.referenceData || {};
    const query = masterDocumentTemplateQuery.trim().toLowerCase();

    const templateOptions = [
      {
        key: "summons-complaint",
        label: "Summons and Complaint",
        description: "Draft demand package for this master lawsuit.",
      },
      {
        key: "bill-schedule",
        label: "Bill Schedule",
        description: "Schedule of lawsuit bills and balances.",
      },
      {
        key: "packet-summary",
        label: "Packet Summary",
        description: "Internal filing and packet summary for the lawsuit.",
      },
    ];

    const sortedTemplateOptions = [...templateOptions].sort((a, b) => a.label.localeCompare(b.label));

    const filteredTemplateOptions = sortedTemplateOptions.filter((option) => {
      const haystack = `${option.label} ${option.description}`.toLowerCase();
      return !query || haystack.includes(query);
    });

    const isSettlementDocumentMode = masterDocumentLaunchMode === "settlement" || masterDocumentDataPreview?.documentLaunchMode === "settlement" || masterDocumentDataPreview?.action === "settlement-documents-preview";

    const repositoryDocumentOptions = Array.isArray(masterDocumentRepositoryTemplates)
      ? masterDocumentRepositoryTemplates.map((template: any) => ({
          key: String(template?.key || ""),
          label: String(template?.label || template?.key || "Document"),
          description: [
            template?.description ? String(template.description) : "",
            template?.mergeFieldSet ? `Merge fields: ${template.mergeFieldSet}` : "",
            template?.repositorySource ? `Repository: ${template.repositorySource}` : "Repository: Barsh Matters template repository",
            template?.editableLater ? "Editable/versioned repository support planned." : "",
          ].filter(Boolean).join("  "),
          availableNow: template?.enabled !== false,
          filename: template?.defaultFilenameSuffix ? `${template.defaultFilenameSuffix}.docx` : "",
          repositorySource: template?.repositorySource || "barsh-matters-template-repository-api",
          mergeFields: Array.isArray(template?.mergeFields) ? template.mergeFields : [],
        })).filter((template: any) => template.key)
      : [];

    const settlementPreviewDocumentOptions = Array.isArray(masterDocumentDataPreview?.plannedDocuments)
      ? masterDocumentDataPreview.plannedDocuments.map((doc: any) => ({
          key: String(doc?.key || ""),
          label: String(doc?.label || doc?.key || "Settlement Document"),
          description: [
            doc?.description ? String(doc.description) : "",
            doc?.filename ? `File: ${doc.filename}` : "",
            doc?.sourceOfTruth ? `Source of truth: ${doc.sourceOfTruth}` : "Source of truth: Barsh Matters local settlement record",
            doc?.availableNow === false ? "Currently blocked by settlement validation." : "Available from the active local settlement record.",
          ].filter(Boolean).join("  "),
          availableNow: doc?.availableNow !== false,
          filename: doc?.filename || "",
        })).filter((doc: any) => doc.key)
      : [];

    const settlementDocumentOptions = repositoryDocumentOptions.length > 0
      ? repositoryDocumentOptions
      : settlementPreviewDocumentOptions;

    const displayedTemplateOptions = isSettlementDocumentMode && settlementDocumentOptions.length > 0
      ? settlementDocumentOptions
      : sortedTemplateOptions;
    const displayedSelectedTemplate =
      displayedTemplateOptions.find((option: any) => option.key === masterSelectedDocumentTemplateKey) ||
      displayedTemplateOptions.find((option: any) => option.label.toLowerCase() === masterDocumentTemplateQuery.trim().toLowerCase()) ||
      null;

    const selectedTemplate =
      displayedSelectedTemplate || null;

    const canFinalize =
      Boolean(selectedTemplate) &&
      (masterDocumentWorkflowStage === "preview" ||
        masterDocumentWorkflowStage === "edit" ||
        masterDocumentWorkflowStage === "finalize");

    const showSelectStep = masterDocumentWorkflowStage === "select";
    const showActionStep = masterDocumentWorkflowStage === "chooseAction";
    const showPreviewStep = masterDocumentWorkflowStage === "preview";
    const showEditStep = masterDocumentWorkflowStage === "edit";
    const showFinalizeStep = masterDocumentWorkflowStage === "finalize";
    const showDeliveryStep = masterDocumentWorkflowStage === "delivery";

    const stepBadge = (step: number, label: string, active: boolean, complete = false) => (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 8px",
          borderRadius: 999,
          border: active ? "1px solid #4f46e5" : "1px solid #e5e7eb",
          background: active ? "#eef2ff" : complete ? "#f0fdf4" : "#f9fafb",
          color: active ? "#3730a3" : complete ? "#166534" : "#374151",
          fontSize: 12,
          fontWeight: 900,
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            borderRadius: 999,
            background: active ? "#4f46e5" : complete ? "#16a34a" : "#e5e7eb",
            color: active || complete ? "#fff" : "#374151",
          }}
        >
          {step}
        </span>
        {label}
      </div>
    );

    const actionButton = (
      label: string,
      onClick: () => void,
      disabled = false,
      title?: string
    ) => (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        style={{
          border: disabled ? "1px solid #d1d5db" : "1px solid #4f46e5",
          background: disabled ? "#f3f4f6" : "#4f46e5",
          color: disabled ? "#6b7280" : "#fff",
          borderRadius: 12,
          padding: "10px 14px",
          fontWeight: 900,
          cursor: disabled ? "not-allowed" : "pointer",
          boxShadow: disabled ? "none" : "0 10px 20px rgba(79, 70, 229, 0.18)",
        }}
      >
        {label}
      </button>
    );

    const stepArrow = (completed: boolean) => (
      <div
        aria-hidden="true"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: completed ? "#16a34a" : "#94a3b8",
          fontSize: 22,
          fontWeight: 900,
          lineHeight: 1,
          padding: "0 2px",
        }}
      >
        →
      </div>
    );

    const step1Complete = masterDocumentWorkflowStage !== "select";
    const step2Complete =
      masterDocumentWorkflowStage === "finalize" || masterDocumentWorkflowStage === "delivery";
    const step3Complete = masterDocumentWorkflowStage === "delivery";

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Master Lawsuit Document Generation"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10000,
          background: "rgba(15, 23, 42, 0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            width: "min(980px, 96vw)",
            maxHeight: "88vh",
            overflow: "auto",
            background: "#fff",
            borderRadius: 24,
            border: "1px solid #e5e7eb",
            boxShadow: "0 30px 70px rgba(15, 23, 42, 0.35)",
          }}
        >
          <div
            style={{
              padding: "22px 24px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 18,
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 22 }}>
                {isSettlementDocumentMode ? "Settlement Document Generation" : "Document Generation"}
              </h2>
              <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.45 }}>
                {isSettlementDocumentMode
                  ? "Select a settlement document, preview or edit it, then finalize.  This settlement path reads Barsh Matters local settlement records only.  It does not use Clio as the settlement source of truth."
                  : "Select a document, preview or edit it, then finalize when the backend is safely wired.  No documents are generated from this popup.  This popup does not generate files, upload to Clio, email, print, or change the print queue."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMasterDocumentGenerationPopupOpen(false)}
              style={{
                border: "1px solid #d1d5db",
                background: "#fff",
                borderRadius: 999,
                padding: "8px 12px",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>

          <div style={{ padding: 24, display: "grid", gap: 18 }}>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              {stepBadge(1, "Select Document", masterDocumentWorkflowStage === "select", step1Complete)}
              {stepArrow(step1Complete)}
              {stepBadge(
                2,
                "Preview PDF or Edit",
                masterDocumentWorkflowStage === "chooseAction" ||
                  masterDocumentWorkflowStage === "preview" ||
                  masterDocumentWorkflowStage === "edit",
                step2Complete
              )}
              {stepArrow(step2Complete)}
              {stepBadge(3, "Finalize", masterDocumentWorkflowStage === "finalize", step3Complete)}
              {stepArrow(step3Complete)}
              {stepBadge(4, "Email / Print / Queue", masterDocumentWorkflowStage === "delivery", false)}
            </div>

            <section
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                padding: "12px 18px",
                background: "#f8fafc",
                display: showSelectStep ? "grid" : "none",
                gap: 14,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 18 }}>Step 1: Select Document</h3>
                <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.45 }}>
                  {isSettlementDocumentMode
                    ? "Choose one of the settlement documents from the Barsh Matters document-template repository.  The current seeded settlement templates are Settlement Summary, Provider Remittance Breakdown, and Attorney Fee Breakdown."
                    : "Start typing to filter available document templates.  These are sample options until the real template source is wired."}
                </p>
                {isSettlementDocumentMode && (
                  <p style={{ margin: "6px 0 0", color: masterDocumentRepositoryTemplatesError ? "#991b1b" : "#64748b", lineHeight: 1.45, fontWeight: masterDocumentRepositoryTemplatesError ? 900 : 700 }}>
                    {masterDocumentRepositoryTemplatesLoading
                      ? "Loading document-template repository..."
                      : masterDocumentRepositoryTemplatesError
                        ? `Template repository warning: ${masterDocumentRepositoryTemplatesError}.  Falling back to the settlement preview document plan.`
                        : "Template source: /api/documents/templates?category=settlement."}
                  </p>
                )}
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <input
                  value={masterDocumentTemplateQuery}
                  list="master-document-template-options"
                  onChange={(event) => {
                    const value = event.target.value;
                    setMasterDocumentTemplateQuery(value);
                    const match = displayedTemplateOptions.find(
                      (option: any) => option.label.toLowerCase() === value.trim().toLowerCase()
                    );
                    if (match) {
                      setMasterSelectedDocumentTemplateKey(match.key);
                      setMasterDocumentWorkflowStage("chooseAction");
                    } else {
                      setMasterSelectedDocumentTemplateKey("");
                      setMasterDocumentWorkflowStage("select");
                    }
                  }}
                  placeholder={isSettlementDocumentMode ? "Choose Settlement Summary, Provider Remittance Breakdown, or Attorney Fee Breakdown." : "Start typing or choose a document..."}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    border: "1px solid #cbd5e1",
                    borderRadius: 12,
                    padding: "11px 12px",
                    fontSize: 15,
                    background: "#fff",
                  }}
                />
                <datalist id="master-document-template-options">
                  {displayedTemplateOptions.map((option: any) => (
                    <option key={option.key} value={option.label} />
                  ))}
                </datalist>

                {displayedSelectedTemplate && (
                  <div
                    style={{
                      border: "1px solid #c7d2fe",
                      background: "#eef2ff",
                      borderRadius: 14,
                      padding: 14,
                      color: "#3730a3",
                      lineHeight: 1.4,
                    }}
                  >
                    <strong>Selected:</strong> {displayedSelectedTemplate.label}
                    <div style={{ marginTop: 4, color: "#475569" }}>{displayedSelectedTemplate.description}</div>
                  </div>
                )}

                {displayedSelectedTemplate && masterDocumentWorkflowStage === "select" && (
                  <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                    {actionButton(
                      "Continue",
                      () => setMasterDocumentWorkflowStage("chooseAction"),
                      false,
                      "Continue to preview or edit the selected document.",
                    )}
                  </div>
                )}

                {masterDocumentTemplateQuery.trim() && displayedTemplateOptions.length === 0 && (
                  <div style={{ color: "#64748b", fontWeight: 800 }}>
                    No matching document templates.
                  </div>
                )}
              </div>
            </section>

            <section
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                padding: 18,
                background: "#fff",
                display: showActionStep ? "grid" : "none",
                gap: 14,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 18 }}>Step 2: Preview PDF or Edit</h3>
                <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.45 }}>
                  {displayedSelectedTemplate
                    ? `Selected: ${displayedSelectedTemplate?.label || "Selected document"}`
                    : "Select a document before previewing the PDF or editing."}
                </p>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {actionButton(
                  "Preview PDF",
                  () => setMasterDocumentWorkflowStage("preview"),
                  !displayedSelectedTemplate,
                  !displayedSelectedTemplate ? "Select a document first." : undefined
                )}
                {actionButton(
                  "Edit Document",
                  () => setMasterDocumentWorkflowStage("edit"),
                  !displayedSelectedTemplate,
                  !displayedSelectedTemplate ? "Select a document first." : undefined
                )}
                <button
                  type="button"
                  onClick={() => loadMasterDocumentDataPreview()}
                  style={{
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    color: "#334155",
                    borderRadius: 12,
                    padding: "10px 14px",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {masterDocumentDataPreview?.loading ? "Refreshing..." : "Refresh Data"}
                </button>
              </div>

              {masterDocumentWorkflowStage === "preview" && displayedSelectedTemplate && (
                <div
                  style={{
                    border: "1px solid #bfdbfe",
                    background: "#eff6ff",
                    borderRadius: 14,
                    padding: 14,
                    color: "#1e3a8a",
                    lineHeight: 1.45,
                  }}
                >
                  <strong>Preview shell:</strong> {displayedSelectedTemplate?.label || "Selected document"} opens in the Barsh Matters preview shell using the current master lawsuit or settlement document packet.  No final file is created until the workflow is finalized.
                  <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                    <div><strong>Lawsuit ID:</strong> {masterDocumentPreviewText(templateFields.masterLawsuitId || uiFields.masterLawsuitId) || "—"}</div>
                    <div><strong>Provider:</strong> {masterDocumentPreviewText(templateFields.providerName || claimIndexFields.providerName) || "—"}</div>
                    <div><strong>Patient:</strong> {masterDocumentPreviewText(templateFields.patientName || claimIndexFields.patientName) || "—"}</div>
                    <div><strong>Insurer:</strong> {masterDocumentPreviewText(templateFields.insurerName || claimIndexFields.insurerName) || "—"}</div>
                    <div><strong>Claim:</strong> {masterDocumentPreviewText(templateFields.claimNumber || claimIndexFields.claimNumber) || "—"}</div>
                    <div><strong>Lawsuit Amount:</strong> {money(templateFields.lawsuitAmount || uiFields.lawsuitAmount)}</div>
                  </div>
                </div>
              )}

              {masterDocumentWorkflowStage === "edit" && displayedSelectedTemplate && (
                <div
                  style={{
                    border: "1px solid #ddd6fe",
                    background: "#f5f3ff",
                    borderRadius: 14,
                    padding: 14,
                    color: "#4c1d95",
                    lineHeight: 1.45,
                  }}
                >
                  <strong>Word editing placeholder:</strong> {displayedSelectedTemplate?.label || "Selected document"} opens in the Barsh Matters edit shell using the current document data.  Full Word editing will be connected in the later template-generation phase.
                </div>
              )}
            </section>

            {(showPreviewStep || showEditStep) && displayedSelectedTemplate && (
              <section
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 18,
                  padding: 18,
                  background: "#fff",
                  display: "grid",
                  gap: 14,
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: 18 }}>
                    {showPreviewStep ? "PDF Preview" : "Edit Document"}
                  </h3>
                  <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.45 }}>
                    {showPreviewStep
                      ? "Review the PDF preview before finalizing.  The actual PDF route will be wired next; this step currently shows the safe local preview shell."
                      : "Word editing will be wired later.  This step currently confirms the intended edit workflow without faking Word integration."}
                  </p>
                </div>

                {showPreviewStep && (
                  <div
                    style={{
                      border: "1px solid #bfdbfe",
                      background: "#eff6ff",
                      borderRadius: 14,
                      padding: 14,
                      color: "#1e3a8a",
                      lineHeight: 1.45,
                    }}
                  >
                    <strong>PDF preview shell:</strong> {displayedSelectedTemplate?.label || "Selected document"} will launch as a PDF preview after the PDF preview route is safely wired.  {isSettlementDocumentMode ? "For now, this preview uses the local settlement document plan." : "For now, this preview uses the local master lawsuit document packet."}
                    <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                      <div><strong>Lawsuit ID:</strong> {masterDocumentPreviewText(masterDocumentDataPreview?.masterLawsuitId || templateFields.masterLawsuitId || uiFields.masterLawsuitId) || "—"}</div>
                      <div><strong>Provider:</strong> {masterDocumentPreviewText(masterDocumentDataPreview?.settlementSummary?.provider || templateFields.providerName || claimIndexFields.providerName) || "—"}</div>
                      <div><strong>Patient:</strong> {masterDocumentPreviewText(masterDocumentDataPreview?.settlementSummary?.patient || templateFields.patientName || claimIndexFields.patientName) || "—"}</div>
                      <div><strong>Insurer:</strong> {masterDocumentPreviewText(masterDocumentDataPreview?.settlementSummary?.insurer || templateFields.insurerName || claimIndexFields.insurerName) || "—"}</div>
                      <div><strong>Claim:</strong> {masterDocumentPreviewText(masterDocumentDataPreview?.settlementSummary?.claimNumber || templateFields.claimNumber || claimIndexFields.claimNumber) || "—"}</div>
                      <div><strong>{isSettlementDocumentMode ? "Gross Settlement" : "Lawsuit Amount"}:</strong> {isSettlementDocumentMode ? money(masterDocumentDataPreview?.settlementSummary?.grossSettlementAmount) : money(templateFields.lawsuitAmount || uiFields.lawsuitAmount)}</div>
                    </div>
                  </div>
                )}

                {showEditStep && (
                  <div
                    style={{
                      border: "1px solid #ddd6fe",
                      background: "#f5f3ff",
                      borderRadius: 14,
                      padding: 14,
                      color: "#4c1d95",
                      lineHeight: 1.45,
                    }}
                  >
                    <strong>Word editing placeholder:</strong> {displayedSelectedTemplate?.label || "Selected document"} opens in the Barsh Matters edit shell using the current document data.  Full Word editing will be connected in the later template-generation phase.
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setMasterDocumentWorkflowStage("chooseAction")}
                    style={{
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      color: "#334155",
                      borderRadius: 12,
                      padding: "10px 14px",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    Back
                  </button>
                  {actionButton("Finalize Document", () => setMasterDocumentWorkflowStage("finalize"), false)}
                </div>
              </section>
            )}

            <section
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                padding: 18,
                background: "#fff",
                display: showFinalizeStep ? "grid" : "none",
                gap: 14,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 18 }}>Step 3: Finalize</h3>
                <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.45 }}>
                  Finalization will later create the final document, store the finalized file through the Clio document-vault layer only, and make it available in the Barsh Matters Documents section.  Settlement data remains local-first.
                </p>
              </div>

              <div>
                {actionButton(
                  masterDocumentFinalizing ? "Finalizing..." : "Finalize Document",
                  () => finalizeMasterSettlementDocumentPlaceholder(displayedSelectedTemplate),
                  !canFinalize || masterDocumentFinalizing,
                  isSettlementDocumentMode
                    ? "Create a persistent local Barsh Matters finalized-document placeholder record.  This does not create a PDF, upload to Clio, email, or print."
                    : "Preview the PDF or edit the selected document before finalizing."
                )}
              </div>

              {masterDocumentWorkflowStage === "delivery" && (
                <div
                  style={{
                    border: "1px solid #fed7aa",
                    background: "#fff7ed",
                    borderRadius: 14,
                    padding: 14,
                    color: "#9a3412",
                    lineHeight: 1.45,
                  }}
                >
                  <strong>Finalize step:</strong> This is the final review step.  Use the delivery buttons below after reviewing the selected document data.  PDF finalization, Clio document-vault upload, and persistent Barsh Matters document records will be wired in the backend finalization phase.
                </div>
              )}
            </section>

            {masterDocumentWorkflowStage === "finalize" && displayedSelectedTemplate && (
              <section
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 18,
                  padding: 18,
                  background: "#f9fafb",
                  display: "none",
                  gap: 14,
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: 18 }}>Step 4: Email / Print / Queue</h3>
                  <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.45 }}>
                    These delivery actions use the shared Barsh Matters document-delivery workflow.  Email opens Outlook/mail compose with recipient and subject prefilled where local contact data is available.  Print and queue actions require the finalized PDF/print-queue backend.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {actionButton("Email Document", () => launchMasterDocumentEmail(displayedSelectedTemplate), false, "Open Outlook/mail compose with recipient and subject prefilled where available.")}
                  {actionButton("Print Document", () => launchMasterDocumentPrint(displayedSelectedTemplate), false, "Open the finalized PDF/printable document and show the print dialog when available.")}
                  {actionButton(masterDocumentPrintQueueLoading ? "Sending..." : "Send to Print Queue", () => sendMasterDocumentToPrintQueue(displayedSelectedTemplate), masterDocumentPrintQueueLoading, "Send this local finalized-document placeholder to the shared Barsh Matters print queue. PDF generation is not yet wired.")}
                </div>
              </section>
            )}

            {masterDocumentFinalizationResult && (
              <section
                style={{
                  border: masterDocumentFinalizationResult.ok ? "1px solid #86efac" : "1px solid #fecaca",
                  borderRadius: 18,
                  padding: 18,
                  background: masterDocumentFinalizationResult.ok ? "#f0fdf4" : "#fef2f2",
                  display: "grid",
                  gap: 8,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 18 }}>
                  {masterDocumentFinalizationResult.ok ? "Local Finalization Record Created" : "Local Finalization Failed"}
                </h3>
                <p style={{ margin: 0, color: "#475569", lineHeight: 1.45 }}>
                  {masterDocumentFinalizationResult.ok
                    ? `DocumentFinalization ID ${masterDocumentFinalizationResult.finalizationRecord?.id || "created"} was saved locally.  No PDF was generated, no Clio upload occurred, no Outlook draft was created, and no print queue record was written.`
                    : masterDocumentFinalizationResult.error || "Local settlement document finalization failed."}
                </p>
                {masterDocumentFinalizationResult?.selectedDocument?.filename && (
                  <p style={{ margin: 0, color: "#475569", lineHeight: 1.45 }}>
                    Planned filename: <strong>{masterDocumentFinalizationResult.selectedDocument.filename}</strong>
                  </p>
                )}
                {masterDocumentFinalizationResult?.generatedDocument?.downloadUrl && (
                  <p style={{ margin: 0, color: "#475569", lineHeight: 1.45 }}>
                    Placeholder DOCX route ready: <strong>{masterDocumentFinalizationResult.generatedDocument.downloadUrl}</strong>
                  </p>
                )}
              </section>
            )}

            {masterDocumentWorkflowStage === "delivery" && (
              <section
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 18,
                  padding: 18,
                  background: "#f9fafb",
                  display: "grid",
                  gap: 14,
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: 18 }}>Step 4: Email / Print / Queue</h3>
                  <span style={{ display: "none" }}>Step 4: Email / Print / Queue — Delivery Standalone</span>
                  <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.45 }}>
                    These delivery actions use the shared Barsh Matters document-delivery workflow.  Email opens Outlook/mail compose with recipient and subject prefilled where local contact data is available.  Print and queue actions require the finalized PDF/print-queue backend.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {actionButton("Email Document", () => launchMasterDocumentEmail(displayedSelectedTemplate), false, "Open Outlook/mail compose with recipient and subject prefilled where available.")}
                  {actionButton("Print Document", () => launchMasterDocumentPrint(displayedSelectedTemplate), false, "Open the finalized PDF/printable document and show the print dialog when available.")}
                  {actionButton(masterDocumentPrintQueueLoading ? "Sending..." : "Send to Print Queue", () => sendMasterDocumentToPrintQueue(displayedSelectedTemplate), masterDocumentPrintQueueLoading, "Send this local finalized-document placeholder to the shared Barsh Matters print queue. PDF generation is not yet wired.")}
                </div>
              </section>
            )}

            {masterDocumentPrintResult && (
              <section
                style={{
                  border: masterDocumentPrintResult.ok ? "1px solid #c4b5fd" : "1px solid #fecaca",
                  borderRadius: 18,
                  padding: 18,
                  background: masterDocumentPrintResult.ok ? "#f5f3ff" : "#fef2f2",
                  display: "grid",
                  gap: 8,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 18 }}>
                  {masterDocumentPrintResult.ok ? "DOCX Route Opened" : "Print Launch Failed"}
                </h3>
                <p style={{ margin: 0, color: "#475569", lineHeight: 1.45 }}>
                  {masterDocumentPrintResult.ok
                    ? "The placeholder-seeded generated DOCX route was opened.  This is not a final production template/document.  No PDF was generated, no Clio upload occurred, no Outlook draft was created, and no email was sent."
                    : masterDocumentPrintResult.error || "Could not open the generated settlement document route."}
                </p>
                {masterDocumentPrintResult?.docxDownloadUrl && (
                  <p style={{ margin: 0, color: "#475569", lineHeight: 1.45 }}>
                    Opened placeholder DOCX route: <strong>{masterDocumentPrintResult.docxDownloadUrl}</strong>
                  </p>
                )}
              </section>
            )}

            {masterDocumentPrintQueueResult && (
              <section
                style={{
                  border: masterDocumentPrintQueueResult.ok ? "1px solid #bfdbfe" : "1px solid #fecaca",
                  borderRadius: 18,
                  padding: 18,
                  background: masterDocumentPrintQueueResult.ok ? "#eff6ff" : "#fef2f2",
                  display: "grid",
                  gap: 8,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 18 }}>
                  {masterDocumentPrintQueueResult.ok ? "Sent to Print Queue" : "Print Queue Failed"}
                </h3>
                <p style={{ margin: 0, color: "#475569", lineHeight: 1.45 }}>
                  {masterDocumentPrintQueueResult.ok
                    ? `Print queue item ID ${masterDocumentPrintQueueResult.printQueueItem?.id || "created"} was saved locally.  No PDF was generated, no Clio upload occurred, no Outlook draft was created, and no email was sent.`
                    : masterDocumentPrintQueueResult.error || "Could not send this settlement document placeholder to the print queue."}
                </p>
                {masterDocumentPrintQueueResult?.printQueueItem?.filename && (
                  <p style={{ margin: 0, color: "#475569", lineHeight: 1.45 }}>
                    Queue filename: <strong>{masterDocumentPrintQueueResult.printQueueItem.filename}</strong>
                  </p>
                )}
                {masterDocumentPrintQueueResult?.printQueueItem?.docxDownloadUrl && (
                  <p style={{ margin: 0, color: "#475569", lineHeight: 1.45 }}>
                    Queued placeholder DOCX route: <strong>{masterDocumentPrintQueueResult.printQueueItem.docxDownloadUrl}</strong>
                  </p>
                )}
              </section>
            )}

            {(masterDocumentDeliveryPreviewLoading || masterDocumentDeliveryPreview) && (() => {
              const previewState = masterDocumentDeliveryPreview || {};
              const graphPayloadPreview = readDocumentDeliveryGraphPreview(previewState);
              const validation = graphPayloadPreview?.validation || graphPayloadPreview?.readiness || {};
              const draft = previewState?.draft || {};
              const graphMessagePayload = graphPayloadPreview?.graphMessagePayload || {};
              const attachmentPlan = Array.isArray(graphPayloadPreview?.attachmentPlan)
                ? graphPayloadPreview.attachmentPlan
                : Array.isArray(draft?.attachments)
                  ? draft.attachments
                  : [];
              const context = previewState?.context || {};
              const readyForGraphDraftCreate = isDocumentDeliveryReadyForGraphDraft(previewState);
              const manualToOverrideIsValid = isValidDocumentDeliveryEmail(masterDocumentDeliveryToOverride);
              const displayedWarnings = Array.isArray(validation?.warnings)
                ? validation.warnings.filter((warning: any) => {
                    const text = String(warning || "");
                    return !(manualToOverrideIsValid && text.includes("No To recipient"));
                  })
                : [];
              const toDisplay =
                masterDocumentDeliveryToOverride.trim() ||
                formatDocumentDeliveryRecipientList(draft?.to) ||
                formatDocumentDeliveryRecipientList(graphMessagePayload?.toRecipients) ||
                "not resolved";
              const maildropDisplay = context?.clioMaildropEmail
                ? `${context?.clioMaildropLabel || "MailDrop"} <${context.clioMaildropEmail}>`
                : "";
              const ccDisplay =
                maildropDisplay ||
                formatDocumentDeliveryRecipientList(draft?.cc) ||
                formatDocumentDeliveryRecipientList(graphMessagePayload?.ccRecipients) ||
                "not resolved";
              const subjectDisplay = draft?.subject || graphMessagePayload?.subject || "not resolved";

              return (
                <section
                  data-barsh-document-delivery-preview-panel="true"
                  style={{
                    border: previewState?.error || previewState?.createError ? "1px solid #fecaca" : "1px solid #bfdbfe",
                    borderRadius: 18,
                    padding: 18,
                    background: previewState?.error || previewState?.createError ? "#fef2f2" : "#eff6ff",
                    display: "grid",
                    gap: 14,
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18 }}>Document Delivery Preview</h3>
                    <p style={{ margin: "6px 0 0", color: "#475569", lineHeight: 1.45 }}>
                      Preview only.  No Outlook draft is created unless Create Outlook Draft is clicked.  This does not send email, write Clio, upload documents, print, or queue anything.
                    </p>
                  </div>

                  {masterDocumentDeliveryPreviewLoading && (
                    <div style={{ fontWeight: 900, color: "#1e3a8a" }}>
                      Building delivery preview...
                    </div>
                  )}

                  {!masterDocumentDeliveryPreviewLoading && (
                    <>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: 10,
                        }}
                      >
                        <div><strong>Document:</strong> {previewState?.documentLabel || context?.documentLabel || selectedTemplate?.label || "Document"}</div>
                        <div><strong>To:</strong> {toDisplay}</div>
                        <div><strong>Cc / MailDrop:</strong> {ccDisplay}</div>
                        <div><strong>Subject:</strong> {subjectDisplay}</div>
                        <div><strong>Attachments planned:</strong> {attachmentPlan.length}</div>
                        <div><strong>Graph draft creation available:</strong> {readyForGraphDraftCreate ? "Yes" : "No"}</div>
                      </div>

                      <div style={{ display: "grid", gap: 6 }}>
                        <label style={{ fontWeight: 950, color: "#334155" }}>
                          To recipient override
                        </label>
                        <input
                          value={masterDocumentDeliveryToOverride}
                          onChange={(event) => setMasterDocumentDeliveryToOverride(event.target.value)}
                          placeholder="Enter recipient email, e.g., name@example.com..."
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            border: "1px solid #cbd5e1",
                            borderRadius: 12,
                            padding: "6px 8px",
                            fontSize: 14,
                            background: "#fff",
                          }}
                        />
                        <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.4 }}>
                          Use this only when local contact/reference data has not supplied a recipient.  Enter a valid email address such as name@example.com.  It affects the draft creation request only; it does not write Clio or update reference data.
                        </div>
                        {masterDocumentDeliveryToOverride.trim() && !isValidDocumentDeliveryEmail(masterDocumentDeliveryToOverride) && (
                          <div style={{ color: "#991b1b", fontSize: 12, fontWeight: 900 }}>
                            Enter a valid email address before creating an Outlook draft.
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          border: "1px solid #dbeafe",
                          borderRadius: 14,
                          background: "#fff",
                          padding: 12,
                          display: "grid",
                          gap: 6,
                          color: "#334155",
                        }}
                      >
                        <div><strong>Safety flags</strong></div>
                        <div>Creates Outlook draft from preview alone: No</div>
                        <div>Sends email: No</div>
                        <div>Writes Clio: No</div>
                        <div>Uploads document: No</div>
                        <div>Prints or queues document: No</div>
                        <div>MailDrop in Cc only: {validation?.maildropInCcOnly ? "Yes" : "No"}</div>
                      </div>

                      {displayedWarnings.length > 0 && (
                        <div style={{ color: "#92400e", fontWeight: 850 }}>
                          Warnings: {displayedWarnings.join(" ")}
                        </div>
                      )}

                      {(previewState?.error || previewState?.createError) && (
                        <div style={{ color: "#991b1b", fontWeight: 900 }}>
                          Error: {previewState.error || previewState.createError}
                        </div>
                      )}

                      {previewState?.draftCreated && (
                        <div style={{ color: "#166534", fontWeight: 950 }}>
                          Outlook draft created through Microsoft Graph.  Local email metadata was persisted.  No email was sent.  This draft is saved to Outlook/Exchange and should also appear in the Outlook desktop app's Drafts folder.
                        </div>
                      )}

                      {previewState?.createResult?.draft?.webLink && (
                        <a
                          href={previewState.createResult.draft.webLink}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontWeight: 950,
                            color: "#1d4ed8",
                          }}
                        >
                          Open Outlook Draft in Web
                        </a>
                      )}

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={createMasterDocumentOutlookDraft}
                          disabled={!readyForGraphDraftCreate || masterDocumentDraftCreateLoading || Boolean(previewState?.draftCreated)}
                          title={!readyForGraphDraftCreate ? "Requires To recipient, MailDrop in Cc, and no MailDrop in Bcc." : undefined}
                          style={{
                            border: !readyForGraphDraftCreate || masterDocumentDraftCreateLoading || previewState?.draftCreated
                              ? "1px solid #d1d5db"
                              : "1px solid #2563eb",
                            background: !readyForGraphDraftCreate || masterDocumentDraftCreateLoading || previewState?.draftCreated
                              ? "#f3f4f6"
                              : "#2563eb",
                            color: !readyForGraphDraftCreate || masterDocumentDraftCreateLoading || previewState?.draftCreated
                              ? "#6b7280"
                              : "#fff",
                            borderRadius: 12,
                            padding: "10px 14px",
                            fontWeight: 950,
                            cursor: !readyForGraphDraftCreate || masterDocumentDraftCreateLoading || previewState?.draftCreated
                              ? "not-allowed"
                              : "pointer",
                          }}
                        >
                          {masterDocumentDraftCreateLoading ? "Creating Draft..." : previewState?.draftCreated ? "Draft Created" : "Create Outlook Draft"}
                        </button>
                      </div>
                    </>
                  )}
                </section>
              );
            })()}

            {masterDocumentDataPreview?.error && (
              <div style={{ color: "#991b1b", fontWeight: 900 }}>
                Error: {masterDocumentPreviewText(masterDocumentDataPreview.error)}
              </div>
            )}

            <details
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                padding: 14,
                background: "#fff",
              }}
            >
              <summary style={{ cursor: "pointer", fontWeight: 950 }}>
                Advanced / Data Preview
              </summary>
              <div style={{ marginTop: 14 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Template Data Review</h3>
                <p style={{ margin: "6px 0 12px", color: "#64748b", lineHeight: 1.45 }}>
                  Read-only local data available for future Master Lawsuit templates.  It does not generate documents, upload documents, write to Clio, or change the print queue.
                </p>
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    overflowX: "auto",
                    background: "#0f172a",
                    color: "#e5e7eb",
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 12,
                    lineHeight: 1.45,
                  }}
                >
                  {JSON.stringify({ templateFields, referenceData, documentData }, null, 2)}
                </pre>
                <div style={{ display: "none" }}>{renderMasterDocumentDataPreviewPanel()}</div>
              </div>
            </details>
          </div>
        </div>
      </div>
    );
  }

  function renderMasterDocumentDataPreviewPanel() {
    const documentData = masterDocumentDataPreview?.packet?.metadata?.documentData;
    const templateFields = documentData?.templateFields || {};
    const uiFields = documentData?.uiFields || {};
    const claimIndexFields = documentData?.claimIndexFields || {};
    const referenceData = documentData?.referenceData || {};
    const refresh = masterDocumentDataPreview?.packet?.refresh || {};
    const previewMasterLawsuitId = currentMasterLawsuitIdForDocumentPreview();

    return (
      <section
        id="master-document-data-preview-panel"
        style={{
          border: "1px solid #cbd5e1",
          borderRadius: 18,
          padding: 18,
          margin: "0 0 18px",
          background: "#f8fafc",
          boxShadow: "0 12px 26px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>Template Data Review</h3>
            <p style={{ margin: "6px 0 0", color: "#475569", fontSize: 13, maxWidth: 860 }}>
              This is a read-only review of the data available for future Master Lawsuit templates.  It reads local Lawsuit metadata, ClaimIndex, and local reference data only.  It does not generate documents, upload documents, write to Clio, or change the print queue.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadMasterDocumentDataPreview()}
            disabled={masterDocumentDataPreviewLoading || !previewMasterLawsuitId}
            style={{
              border: 0,
              borderRadius: 999,
              padding: "10px 16px",
              fontWeight: 900,
              background: masterDocumentDataPreviewLoading || !previewMasterLawsuitId ? "#e5e7eb" : "#2563eb",
              color: masterDocumentDataPreviewLoading || !previewMasterLawsuitId ? "#64748b" : "#fff",
              cursor: masterDocumentDataPreviewLoading || !previewMasterLawsuitId ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {masterDocumentDataPreviewLoading ? "Loading..." : "Refresh Data"}
          </button>
        </div>

        {masterDocumentDataPreview?.error && (
          <div style={{ marginTop: 12, color: "#991b1b", fontWeight: 800 }}>
            Error: {masterDocumentPreviewText(masterDocumentDataPreview.error)}
          </div>
        )}

        {documentData && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: 10,
                marginTop: 14,
              }}
            >
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Lawsuit ID</div>
                <div style={{ fontWeight: 900 }}>{masterDocumentPreviewText(templateFields.masterLawsuitId) || previewMasterLawsuitId || "—"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Ready for Templates</div>
                <div style={{ fontWeight: 900 }}>{documentData.readyForTemplates ? "Yes" : "No"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Generates Documents</div>
                <div style={{ fontWeight: 900 }}>{documentData.generatesDocuments ? "Yes" : "No"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Clio Correctness Dependency</div>
                <div style={{ fontWeight: 900 }}>{documentData.clioCorrectnessDependency ? "Yes" : "No"}</div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                gap: 10,
                marginTop: 12,
              }}
            >
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Provider</div>
                <div style={{ fontWeight: 900 }}>{masterDocumentPreviewText(templateFields.providerName) || masterDocumentPreviewText(claimIndexFields.providerName) || "—"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Patient</div>
                <div style={{ fontWeight: 900 }}>{masterDocumentPreviewText(templateFields.patientName) || masterDocumentPreviewText(claimIndexFields.patientName) || "—"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Insurer</div>
                <div style={{ fontWeight: 900 }}>{masterDocumentPreviewText(templateFields.insurerName) || masterDocumentPreviewText(claimIndexFields.insurerName) || "—"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Claim Number</div>
                <div style={{ fontWeight: 900 }}>{masterDocumentPreviewText(templateFields.claimNumber) || masterDocumentPreviewText(claimIndexFields.claimNumber) || "—"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Court</div>
                <div style={{ fontWeight: 900 }}>{masterDocumentPreviewText(templateFields.courtName) || masterDocumentPreviewText(uiFields.courtName) || "—"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Index / AAA Number</div>
                <div style={{ fontWeight: 900 }}>{masterDocumentPreviewText(templateFields.indexAaaNumber) || masterDocumentPreviewText(uiFields.indexAaaNumber) || "—"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Date of Loss</div>
                <div style={{ fontWeight: 900 }}>{masterDocumentPreviewDate(templateFields.dateOfLoss || uiFields.dateOfLoss) || "—"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Date Filed</div>
                <div style={{ fontWeight: 900 }}>{masterDocumentPreviewDate(templateFields.dateFiled || uiFields.dateFiled) || "—"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Court Costs Total</div>
                <div style={{ fontWeight: 900 }}>{money(templateFields.courtCostsTotal ?? uiFields.courtCostsTotal)}</div>
              </div>
            </div>

            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", fontWeight: 900 }}>Raw Template Fields</summary>
              <pre style={{ marginTop: 10, whiteSpace: "pre-wrap", overflowX: "auto", background: "#0f172a", color: "#e2e8f0", padding: 12, borderRadius: 12 }}>
                {JSON.stringify(templateFields, null, 2)}
              </pre>
            </details>

            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", fontWeight: 900 }}>Raw Reference Data</summary>
              <pre style={{ marginTop: 10, whiteSpace: "pre-wrap", overflowX: "auto", background: "#0f172a", color: "#e2e8f0", padding: 12, borderRadius: 12 }}>
                {JSON.stringify(referenceData, null, 2)}
              </pre>
            </details>

            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", fontWeight: 900 }}>Raw Court Details</summary>
              <pre style={{ marginTop: 10, whiteSpace: "pre-wrap", overflowX: "auto", background: "#0f172a", color: "#e2e8f0", padding: 12, borderRadius: 12 }}>
                {JSON.stringify(uiFields.selectedCourtDetails || templateFields.courtDetails || null, null, 2)}
              </pre>
            </details>

            <div style={{ marginTop: 10, fontSize: 12, color: "#64748b", fontWeight: 800 }}>
              Refresh: {masterDocumentPreviewText(refresh.reason) || "—"}.
            </div>
          </>
        )}
      </section>
    );
  }

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
            <div style={{ ...printButtonRowStyle, position: "relative" }}>
              <button
                type="button"
                onClick={openAdministratorMenu}
                title="Administrator functions require password access."
                style={{
                  ...printQueueButtonStyle,
                  cursor: "pointer",
                  opacity: 1,
                }}
              >
                <span aria-hidden="true">🔐</span>
                <span>Administrator</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.location.href = "/print-queue";
                }}
                title="Open Daily Print Queue."
                style={{
                  ...printQueueButtonStyle,
                  cursor: "pointer",
                  opacity: 1,
                }}
              >
                <span aria-hidden="true">🖨️</span>
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
                  <span>Provider</span>
                  <strong>{masterInfoDisplayValue("provider", masterProviderClientSummary)}</strong>
                </div>
                <div style={masterSummaryItemStyle}>
                  <span>Date of Loss</span>
                  <strong>{masterDateOfLossDisplayValue()}</strong>
                </div>
                <div style={masterSummaryItemStyle}>
                  <span>Index / AAA Number</span>
                  <strong>{masterIndexAaaDisplayValue()}</strong>
                </div>
                <div style={masterSummaryItemStyle}>
                  <span>Court</span>
                  <strong>—</strong>
                </div>
                <div style={masterSummaryItemStyle}>
                  <span>Date Filed</span>
                  <strong>{masterDateFiledDisplayValue()}</strong>
                </div>
                <div style={masterSummaryItemStyle}>
                  <span>Lawsuit Amount</span>
                  <strong>{money(masterWorkspaceBillTotal(masterSettlementDetailRows))}</strong>
                </div>
                <div style={masterSummaryItemStyle}>
                  <span>Court Costs</span>
                  <strong>{masterCourtCostsDisplayValue()}</strong>
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
                This is a visual/local draft only.  It does not run external settlement posting, document generation, or Close Paid Settlements.
              </div>

            </div>
          </section>
        )}

        {kind === "master" && activeMasterWorkspaceTab === "email_threads" && renderMasterEmailThreadsPanel()}

        {kind === "master" && activeMasterWorkspaceTab !== "settlement" && activeMasterWorkspaceTab !== "email_threads" && (
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
                      
      
              {activeMasterWorkspaceTab === "documents" ? (
                        <>
                          <div>
                            Move the existing read-only packet preview shell into this Documents workspace.
                          </div>
                          {renderMasterDocumentDataPreviewPanel()}
                          {renderMasterClioDocumentsPanel()}
                        </>
                      ) : (
                        "Move settlement close preview into this Close Paid Settlements workspace."
                      )}
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
                          {clean(masterInfoDisplayValue("provider", masterProviderClientSummary)) && masterInfoDisplayValue("provider", masterProviderClientSummary) !== "—" ? (
                            <a
                              href={filteredUrl("provider", masterInfoDisplayValue("provider", masterProviderClientSummary))}
                              className="barsh-filter-field-link"
                              style={fieldLinkStyle}
                            >
                              {masterInfoDisplayValue("provider", masterProviderClientSummary)}
                            </a>
                          ) : (
                            "—"
                          )}
                        </strong>
                        <button
                          type="button"
                          onClick={() => openMasterInfoEditDialog("provider", "Provider", masterInfoDisplayValue("provider", masterProviderClientSummary))}
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
                        <strong style={masterSummaryCardValueStyle}>{masterDateOfLossDisplayValue()}</strong>
                        <button
                          type="button"
                          onClick={() => openMasterInfoEditDialog("dateOfLoss", "Date of Loss", masterInfoDisplayValue("dateOfLoss", masterDateOfLossDisplayValue()))}
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
                        <strong style={masterSummaryCardValueStyle}>{masterIndexAaaDisplayValue()}</strong>
                        <button
                          type="button"
                          onClick={() => openMasterInfoEditDialog("indexAaaNumber", "Index / AAA Number", masterIndexAaaDisplayValue())}
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
                        <strong style={masterSummaryCardValueStyle}>{masterCourtDisplayValue()}</strong>
                        <button
                          type="button"
                          onClick={() => openMasterInfoEditDialog("court", "Court", masterCourtDisplayValue())}
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
                        <strong style={masterSummaryCardValueStyle}>{masterDateFiledDisplayValue()}</strong>
                        <button
                          type="button"
                          onClick={() => openMasterInfoEditDialog("dateFiled", "Date Filed", masterDateFiledDisplayValue())}
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
                        <strong style={masterSummaryCardValueStyle}>{masterMetadataMoneyDisplayValue("filingFee")}</strong>
                        <button
                          type="button"
                          onClick={() => openMasterInfoEditDialog("filingFee", "Index Fee", masterMetadataMoneyDisplayValue("filingFee"))}
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
                        <strong style={masterSummaryCardValueStyle}>{masterMetadataMoneyDisplayValue("serviceFee")}</strong>
                        <button
                          type="button"
                          onClick={() => openMasterInfoEditDialog("serviceFee", "Service Fee", masterMetadataMoneyDisplayValue("serviceFee"))}
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
                        <strong style={masterSummaryCardValueStyle}>{masterMetadataMoneyDisplayValue("otherCourtCosts")}</strong>
                        <button
                          type="button"
                          onClick={() => openMasterInfoEditDialog("otherCourtCosts", "Other Court Fees", masterMetadataMoneyDisplayValue("otherCourtCosts"))}
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
                        title="Open lawsuit-level payment preview popup.  Local payment workflow only."
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
                        title="Open settlement preview popup.  Local settlement workflow only."
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
                      title="Open the Master Lawsuit Clio document picker."
                      onClick={() => void openMasterViewDocumentsPopup()}
                      style={{
                        width: "100%",
                        minWidth: 0,
                        height: 44,
                        border: "1px solid #0e7490",
                        borderRadius: 999,
                        background: "#ecfeff",
                        color: "#0e7490",
                        fontSize: 12,
                        fontWeight: 950,
                        cursor: "pointer",
                        boxShadow: "0 10px 22px rgba(14, 116, 144, 0.20)",
                      }}
                    >
                      View Documents
                    </button>

                    <button
                      type="button"
                      title="Open the Master Lawsuit document generation preview popup."
                      onClick={() => void launchMasterDocumentGenerationDialog()}
                      style={{
                        width: "100%",
                        minWidth: 0,
                        height: 44,
                        border: "1px solid #4338ca",
                        borderRadius: 999,
                        background: "#4f46e5",
                        color: "#ffffff",
                        fontSize: 12,
                        fontWeight: 950,
                        cursor: "pointer",
                        boxShadow: "0 10px 22px rgba(79, 70, 229, 0.28)",
                      }}
                    >
                      Document Generation
                    </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveMasterWorkspaceTab("email_threads");
                          void loadMasterEmailThreadPreview();
                        }}
                        title="Open master lawsuit email/thread records and preview-first Microsoft Graph sync."
                        style={{
                          width: "100%",
                          minWidth: 0,
                          height: 44,
                          border: "1px solid #0f766e",
                          borderRadius: 999,
                          background: "#ecfeff",
                          color: "#0f766e",
                          fontSize: 12,
                          fontWeight: 950,
                          cursor: "pointer",
                          boxShadow: "none",
                        }}
                      >
                        Emails
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
                          cursor: "pointer",
                        }}
                      >
                        Close Lawsuit
                      </button>

                    {renderMasterViewDocumentsPopup()}
                    {renderMasterDocumentGenerationPopup()}
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
                        {masterPaymentReceiptsLoading
                          ? "Loading..."
                          : `${masterPaymentVisibleReceipts.length} shown / ${masterPaymentReceipts.length} total`}
                      </span>
                    </div>

                    <label
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 8,
                        fontSize: 11,
                        fontWeight: 900,
                        color: "#475569",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={masterPaymentShowVoided}
                        onChange={(event) => setMasterPaymentShowVoided(event.target.checked)}
                      />
                      Show Voided
                    </label>

                    {masterPaymentReceiptsError && (
                      <div style={{ fontSize: 13, fontWeight: 750, color: "#991b1b" }}>
                        {masterPaymentReceiptsError}
                      </div>
                    )}

                    {!masterPaymentReceiptsError && masterPaymentVisibleReceipts.length === 0 && (
                      <div style={{ fontSize: 13, fontWeight: 750, color: "#64748b" }}>
                        No child bill payment receipts are currently shown for this lawsuit.
                      </div>
                    )}

                    {!masterPaymentReceiptsError && masterPaymentVisibleReceipts.length > 0 && (
                      <div
                        style={{
                          display: "grid",
                          gap: 6,
                          maxHeight: 230,
                          overflowY: "auto",
                          paddingRight: 2,
                        }}
                      >
                        {masterPaymentVisibleReceipts.slice(0, 8).map((receipt: any) => (
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
                  padding: "7px 10px",
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
                    top: masterSettlementPopupPosition.y,
                    left: `calc(50% + ${masterSettlementPopupPosition.x}px)`,
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
                    data-barsh-draggable-settlement-popup-header="true"
                    onPointerDown={beginMasterSettlementPopupDrag}
                    title="Drag to move this settlement popup."
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
                      cursor: masterSettlementPopupDragging ? "grabbing" : "grab",
                      userSelect: "none",
                      touchAction: "none",
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
                        padding: "7px 10px",
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
                        Master Lawsuit field edit · Local save.
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

                      void confirmMasterInfoEditDialog();
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

                    {masterInfoFieldKind(masterInfoEditDialog.field) === "court" ? (
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
                          Court / Venue
                          <select
                            value={masterInfoEditValue}
                            onChange={(event) => setMasterInfoEditValue(event.target.value)}
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
                          >
                            <option value="">Select court / venue...</option>
                            {masterCourtOptions.map((option: any) => {
                              const value = String(option?.displayName || option?.label || option?.value || "");
                              return (
                                <option key={String(option?.id || value)} value={value}>
                                  {value}
                                </option>
                              );
                            })}
                          </select>
                        </label>

                        {masterCourtOptionsLoading && (
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>
                            Loading court list...
                          </div>
                        )}

                        {masterCourtOptionsError && (
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#991b1b" }}>
                            {masterCourtOptionsError}
                          </div>
                        )}

                        {(() => {
                          const selected = masterCourtOptions.find((option: any) => String(option?.displayName || option?.label || option?.value || "") === masterInfoEditValue);
                          const details = selected?.details || null;
                          if (!details) return null;

                          return (
                            <div
                              style={{
                                padding: "7px 10px",
                                border: "1px solid #dbe4f0",
                                borderRadius: 12,
                                background: "#f8fafc",
                                color: "#334155",
                                fontSize: 12,
                                fontWeight: 750,
                                lineHeight: 1.45,
                              }}
                            >
                              <div><strong>Hidden details stored:</strong></div>
                              <div>{details.longName1 || "—"}</div>
                              {details.longName2 && <div>{details.longName2}</div>}
                              <div>{details.addressStreet || "—"}</div>
                              <div>{[details.city, details.state].filter(Boolean).join(", ") || "—"}</div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : masterInfoFieldKind(masterInfoEditDialog.field) === "contact" ? (
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
                        padding: "7px 10px",
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


            {activeMasterWorkspaceTab === "payments" && (
        <section
          data-barsh-local-settlement-history-panel="true"
          style={{
            border: "1px solid #dbeafe",
            background: "#f8fbff",
            borderRadius: 18,
            padding: 18,
            marginTop: 18,
            marginBottom: 18,
            boxShadow: "0 10px 24px rgba(30, 64, 175, 0.08)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#172554" }}>Recorded Settlement</div>
              <div style={{ marginTop: 4, fontSize: 13, color: "#475569" }}>
                Barsh Matters local settlement readback.  Clio is not the source of truth for this panel.
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadMasterSettlementHistory()}
              disabled={masterSettlementHistoryLoading}
              style={{
                border: "1px solid #bfdbfe",
                background: "#ffffff",
                color: "#1d4ed8",
                borderRadius: 999,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 800,
                cursor: masterSettlementHistoryLoading ? "not-allowed" : "pointer",
              }}
            >
              {masterSettlementHistoryLoading ? "Refreshing..." : "Refresh Settlement"}
            </button>
          </div>

          <div
            data-barsh-settlement-payment-due-tickler-strip="true"
            style={{
              marginTop: 14,
              border: "1px solid #fef3c7",
              background: "#fffbeb",
              borderRadius: 14,
              padding: 12,
              display: "flex",
              justifyContent: "space-between",
              gap: 14,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#92400e" }}>Payment Due Follow-Up</div>
              <div style={{ marginTop: 3, fontSize: 12, color: "#78350f" }}>
                Generic Barsh Matters tickler system.  Settlement payment due is the first tickler kind.
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "#475569" }}>
                {masterSettlementTicklersLoading
                  ? "Loading ticklers..."
                  : masterSettlementTicklers?.ok && Array.isArray(masterSettlementTicklers.ticklers) && masterSettlementTicklers.ticklers.length > 0
                    ? `${masterSettlementTicklers.ticklers.length} open payment due follow-up(s): ${masterSettlementTicklers.ticklers.map((tickler: any) => tickler.dueDate || "no due date").join(", ")}`
                    : masterSettlementTicklers?.ok
                      ? "No open payment due follow-up tickler yet."
                      : masterSettlementTicklers?.error || "Ticklers not loaded yet."}
              </div>
              {masterSettlementTicklerCreate?.error && (
                <div style={{ marginTop: 6, fontSize: 12, color: "#991b1b", fontWeight: 800 }}>
                  {masterSettlementTicklerCreate.error}
                </div>
              )}
              {masterSettlementTicklerCreate?.duplicatePrevented && (
                <div style={{ marginTop: 6, fontSize: 12, color: "#166534", fontWeight: 800 }}>
                  Existing open payment due tickler reused.
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => void createMasterSettlementPaymentDueTickler(masterSettlementHistory?.activeRecordId)}
              disabled={masterSettlementTicklerCreateLoading}
              style={{
                border: "1px solid #f59e0b",
                background: "#ffffff",
                color: "#92400e",
                borderRadius: 999,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 900,
                cursor: masterSettlementTicklerCreateLoading ? "not-allowed" : "pointer",
              }}
            >
              {masterSettlementTicklerCreateLoading ? "Creating..." : "Create Payment Due Tickler"}
            </button>
          </div>
          {masterSettlementHistoryLoading && !masterSettlementHistory ? (
            <div style={{ marginTop: 14, color: "#475569", fontSize: 13 }}>Loading local settlement history...</div>
          ) : masterSettlementHistory?.ok && Array.isArray(masterSettlementHistory.records) && masterSettlementHistory.records.length > 0 ? (
            <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
              {masterSettlementHistory.records.map((record: any) => (
                <div
                  key={record.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    background: "#ffffff",
                    borderRadius: 14,
                    padding: 14,
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(110px, 1fr))", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Status</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: record.voided ? "#991b1b" : "#166534" }}>
                        {record.voided ? "Voided" : record.status || "Recorded"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Settled With</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{record.settledWith || "—"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Settlement Date</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{record.settlementDate || "—"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Payment Due</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{record.paymentExpectedDate || "—"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Principal</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{formatSettlementHistoryMoney(record.allocatedSettlementTotal || 0)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Interest</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{formatSettlementHistoryMoney(record.interestAmountTotal || 0)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Attorney Fee</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{formatSettlementHistoryMoney(record.totalFee || 0)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Provider Net</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{formatSettlementHistoryMoney(record.providerNetTotal || 0)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Rows</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{record.rowCount || record.rows?.length || 0}</div>
                    </div>
                  </div>

                  {Array.isArray(record.rows) && record.rows.length > 0 && (
                    <div style={{ marginTop: 14, overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "#f8fafc", color: "#475569" }}>
                            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e2e8f0" }}>Matter</th>
                            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e2e8f0" }}>Provider</th>
                            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e2e8f0" }}>Patient</th>
                            <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #e2e8f0" }}>Principal</th>
                            <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #e2e8f0" }}>Interest</th>
                            <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #e2e8f0" }}>Fee</th>
                            <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #e2e8f0" }}>Provider Net</th>
                          </tr>
                        </thead>
                        <tbody>
                          {record.rows.map((row: any) => (
                            <tr key={row.id}>
                              <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9", fontWeight: 800 }}>{row.displayNumber || row.matterId}</td>
                              <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>{row.provider || "—"}</td>
                              <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>{row.patient || "—"}</td>
                              <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9", textAlign: "right" }}>{formatSettlementHistoryMoney(row.allocatedSettlement || 0)}</td>
                              <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9", textAlign: "right" }}>{formatSettlementHistoryMoney(row.interestAmount || 0)}</td>
                              <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9", textAlign: "right" }}>{formatSettlementHistoryMoney(row.totalFee || 0)}</td>
                              <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9", textAlign: "right", fontWeight: 800 }}>{formatSettlementHistoryMoney(row.providerNet || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : masterSettlementHistory?.ok ? (
            <div style={{ marginTop: 14, color: "#475569", fontSize: 13 }}>
              No local settlement has been recorded for this lawsuit yet.
            </div>
          ) : (
            <div style={{ marginTop: 14, color: "#991b1b", fontSize: 13, fontWeight: 700 }}>
              {masterSettlementHistory?.error || "Local settlement history is not loaded yet."}
            </div>
          )}
        </section>
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
                onClick={(event) => event.stopPropagation()}
              >
                <div
                  data-barsh-draggable-settlement-popup-shell="true"
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    position: "fixed",
                    top: masterSettlementPopupPosition.y,
                    left: `calc(50% + ${masterSettlementPopupPosition.x}px)`,
                    transform: "translateX(-50%)",
                    width: "min(1480px, 98vw)",
                    minWidth: 980,
                    minHeight: 420,
                    maxWidth: "98vw",
                    maxHeight: "calc(100vh - 24px)",
                    overflow: "auto",
                    resize: "both",
                    border: "1px solid #bfdbfe",
                    borderRadius: 22,
                    background: "#ffffff",
                    boxShadow: "0 30px 90px rgba(15, 23, 42, 0.38)",
                  }}
                >
                  <div
                    data-barsh-draggable-settlement-popup-header="true"
                    onPointerDown={beginMasterSettlementPopupDrag}
                    title="Drag this blue header to move the settlement popup."
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
                      cursor: masterSettlementPopupDragging ? "grabbing" : "grab",
                      userSelect: "none",
                      touchAction: "none",
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
                        Settlement of {currentMasterLawsuitIdForDocumentPreview() || "—"}
                      </div>
                    </div>

                  </div>

                  <div
                    style={{
                      margin: "8px 18px 0",
                      padding: "7px 10px",
                      border: "1px solid #dbe4f0",
                      borderRadius: 14,
                      background: "#f8fafc",
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 950, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569" }}>
                      Settlement Based on
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, alignItems: "start" }}>
                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 900, color: "#0f172a" }}>
                          <input
                            type="radio"
                            name="master-settlement-popup-based-on"
                            checked={masterSettlementDraft.settlementBasedOn === "lawsuit_amount"}
                            onChange={() => applyMasterSettlementBasisAmount("lawsuit_amount")}
                          />
                          <span>Lawsuit Amount</span>
                        </span>
                        <div
                          style={{
                            width: "100%",
                            border: "1px solid #cbd5e1",
                            borderRadius: 8,
                            padding: "7px 10px",
                            background: "#f8fafc",
                            color: "#0f172a",
                            fontWeight: 900,
                          }}
                        >
                          {money(masterSettlementLawsuitAmountValue())}
                        </div>
                      </label>

                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 900, color: "#0f172a" }}>
                          <input
                            type="radio"
                            name="master-settlement-popup-based-on"
                            checked={masterSettlementDraft.settlementBasedOn === "fee_schedule_amount"}
                            onChange={() => applyMasterSettlementBasisAmount("fee_schedule_amount", masterSettlementDraft.feeScheduleAmount)}
                          />
                          <span>Fee Schedule Amount</span>
                        </span>
                        <input
                          data-master-settlement-entry-field="true"
                          value={masterSettlementDraft.feeScheduleAmount}
                          onChange={(event) => applyMasterSettlementBasisAmount("fee_schedule_amount", event.target.value)}
                          onBlur={() => {
                            const formatted = formatMasterSettlementDollarInput(masterSettlementDraft.feeScheduleAmount);
                            setMasterSettlementDraft((prev) => ({ ...prev, feeScheduleAmount: formatted }));
                          }}
                          placeholder="$ amount"
                          inputMode="decimal"
                          style={{
                            width: "100%",
                            border: "1px solid #cbd5e1",
                            borderRadius: 8,
                            padding: "7px 10px",
                            background: "#fff",
                            color: "#0f172a",
                            fontWeight: 800,
                            outline: "none",
                          }}
                        />
                      </label>

                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 900, color: "#0f172a" }}>
                          <input
                            type="radio"
                            name="master-settlement-popup-based-on"
                            checked={masterSettlementDraft.settlementBasedOn === "custom_amount"}
                            onChange={() => applyMasterSettlementBasisAmount("custom_amount", masterSettlementDraft.customAmount)}
                          />
                          <span>Custom Amount</span>
                        </span>
                        <input
                          data-master-settlement-entry-field="true"
                          value={masterSettlementDraft.customAmount}
                          onChange={(event) => applyMasterSettlementBasisAmount("custom_amount", event.target.value)}
                          onBlur={() => {
                            const formatted = formatMasterSettlementDollarInput(masterSettlementDraft.customAmount);
                            setMasterSettlementDraft((prev) => ({ ...prev, customAmount: formatted }));
                          }}
                          placeholder="$ amount"
                          inputMode="decimal"
                          style={{
                            width: "100%",
                            border: "1px solid #cbd5e1",
                            borderRadius: 8,
                            padding: "7px 10px",
                            background: "#fff",
                            color: "#0f172a",
                            fontWeight: 800,
                            outline: "none",
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <div
                    onKeyDown={handleMasterSettlementEntryKeyDown}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: 16,
                      padding: "12px 18px",
                      alignItems: "start",
                    }}
                  >
                    <div style={{ display: "grid", gap: 12 }}>
                      <label className="barsh-direct-payment-field">
                        <span>Principal *</span>
                        <input
                          data-master-settlement-entry-field="true"
                          value={masterSettlementGrossInput}
                          onChange={(event) => setMasterSettlementGrossInput(event.target.value)}
                          onBlur={() => setMasterSettlementGrossInput((current) => formatMasterSettlementAmountOrPercentInput(current))}
                          placeholder="$ amount or % of selected basis"
                          inputMode="decimal"
                          style={{
                            width: "100%",
                            border: "1px solid #cbd5e1",
                            borderRadius: 8,
                            padding: "8px 10px",
                            background: "#fff",
                            color: "#0f172a",
                            fontWeight: 800,
                            outline: "none",
                          }}
                        />
                      </label>

                      <label className="barsh-direct-payment-field">
                        <span>Interest</span>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "0.65fr auto auto auto 0.85fr",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <input
                            data-master-settlement-entry-field="true"
                            value={masterSettlementInterestAmountInput}
                            onChange={(event) => {
                              setMasterSettlementInterestAmountInput(event.target.value);
                              setMasterSettlementSettledInterestInput("");
                            }}
                            onBlur={() => {
                              const n = masterSettlementInterestSettlementPercentValue();
                              setMasterSettlementInterestAmountInput(`${Math.round(n)}%`);
                              setMasterSettlementSettledInterestInput("");
                            }}
                            placeholder="%"
                            inputMode="decimal"
                            title="Enter the percentage of calculated interest being settled.  Example: 50 means 50%."
                            style={{
                              width: "100%",
                              border: "1px solid #cbd5e1",
                              borderRadius: 8,
                              padding: "8px 10px",
                              background: "#fff",
                              color: "#0f172a",
                              fontWeight: 800,
                              outline: "none",
                            }}
                          />
                          <span style={{ color: "#475569", fontWeight: 900 }}>of</span>
                          <span
                            style={{
                              color: "#0f172a",
                              fontWeight: 950,
                              fontSize: 18,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {money(masterSettlementSimpleInterestAmountValue())}
                          </span>
                          <span style={{ color: "#475569", fontWeight: 900 }}>=</span>
                          <input
                            data-master-settlement-entry-field="true"
                            value={masterSettlementSettledInterestInput || money(masterSettlementCalculatedSettledInterestValue())}
                            onChange={(event) => setMasterSettlementSettledInterestInput(event.target.value)}
                            onBlur={() =>
                              setMasterSettlementSettledInterestInput((current) =>
                                formatMasterSettlementDollarInput(current || String(masterSettlementCalculatedSettledInterestValue()))
                              )
                            }
                            title="Editable settled interest amount.  Defaults to the selected percentage of calculated interest."
                            inputMode="decimal"
                            style={{
                              width: "100%",
                              border: "1px solid #cbd5e1",
                              borderRadius: 8,
                              padding: "8px 10px",
                              background: "#fff",
                              color: "#0f172a",
                              fontWeight: 800,
                              outline: "none",
                            }}
                          />
                        </div>
                      </label>

                      <label className="barsh-direct-payment-field">
                        <span>Costs</span>
                        <input
                          data-master-settlement-entry-field="true"
                          value={masterSettlementCostsInput}
                          onChange={(event) => setMasterSettlementCostsInput(event.target.value)}
                          onBlur={() => setMasterSettlementCostsInput((current) => formatMasterSettlementDollarInput(current))}
                          placeholder="$0.00"
                          inputMode="decimal"
                          style={{
                            width: "100%",
                            border: "1px solid #cbd5e1",
                            borderRadius: 8,
                            padding: "8px 10px",
                            background: "#fff",
                            color: "#0f172a",
                            fontWeight: 800,
                            outline: "none",
                          }}
                        />
                      </label>
                    </div>

                    <div style={{ display: "grid", gap: 12 }}>
                      <label className="barsh-direct-payment-field">
                        <span>Settled With *</span>
                        <input
                          data-master-settlement-entry-field="true"
                          value={masterSettlementWithInput}
                          onChange={(event) => setMasterSettlementWithInput(event.target.value)}
                          placeholder="Search Local Contact"
                          style={{
                            width: "100%",
                            border: "1px solid #cbd5e1",
                            borderRadius: 8,
                            padding: "8px 10px",
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
                          data-master-settlement-entry-field="true"
                          type="date"
                          value={masterSettlementDateInput}
                          onChange={(event) => {
                            const nextDate = event.target.value;
                            setMasterSettlementDateInput(nextDate);
                            setMasterSettlementPaymentExpectedDateInput(addDaysToDateInput(nextDate, 45));
                          }}
                          style={{
                            width: "100%",
                            border: "1px solid #cbd5e1",
                            borderRadius: 8,
                            padding: "8px 10px",
                            background: "#fff",
                            color: "#0f172a",
                            fontWeight: 800,
                            outline: "none",
                          }}
                        />
                      </label>

                      <label className="barsh-direct-payment-field">
                        <span>Payment Due Date</span>
                        <input
                          data-master-settlement-entry-field="true"
                          type="date"
                          value={masterSettlementPaymentExpectedDateInput}
                          onChange={(event) => setMasterSettlementPaymentExpectedDateInput(event.target.value)}
                          style={{
                            width: "100%",
                            border: "1px solid #cbd5e1",
                            borderRadius: 8,
                            padding: "8px 10px",
                            background: "#fff",
                            color: "#0f172a",
                            fontWeight: 800,
                            outline: "none",
                          }}
                        />
                      </label>
                    </div>

                    <div style={{ display: "grid", gap: 12 }}>
                      <label className="barsh-direct-payment-field" style={{ minHeight: "100%" }}>
                        <span>Notes</span>
                        <textarea
                          data-master-settlement-entry-field="true"
                          value={masterSettlementNotesInput}
                          onChange={(event) => setMasterSettlementNotesInput(event.target.value)}
                          placeholder="Optional settlement notes"
                          style={{
                            width: "100%",
                            minHeight: 132,
                            border: "1px solid #cbd5e1",
                            borderRadius: 8,
                            padding: "8px 10px",
                            background: "#fff",
                            color: "#0f172a",
                            fontWeight: 800,
                            outline: "none",
                            resize: "vertical",
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <div
                    className="barsh-direct-payment-preview"
                    style={{
                      margin: "0 18px 10px",
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(220px, 1fr))",
                      gap: 6,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ gridColumn: "1 / -1", display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
                      <span>Retainer Principal: {masterSettlementProviderFeeDefaultsLoading ? "Loading..." : masterSettlementWholePercentLabel(masterSettlementPrincipalFeePercentInput)}</span>
                      <span>Retainer Interest: {masterSettlementProviderFeeDefaultsLoading ? "Loading..." : masterSettlementWholePercentLabel(masterSettlementInterestFeePercentInput)}</span>
                      <span>Interest Days: {masterSettlementInterestDaysValue().toLocaleString("en-US")}</span>
                      <span>Fee defaults source: {masterSettlementProviderFeeDefaults?.matchedProvider?.displayName || masterSettlementProviderForFeeDefaults() || "—"}</span>
                    </div>
                  </div>

                  <div
                    style={{
                      margin: "0 18px 10px",
                      border: "1px solid #dbe4f0",
                      borderRadius: 14,
                      overflow: "hidden",
                      background: "#ffffff",
                    }}
                  >
                    <div
                      style={{
                        padding: "7px 10px",
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
                          minWidth: 1180,
                          borderCollapse: "collapse",
                          fontSize: 12,
                          color: "#0f172a",
                        }}
                      >
                        <thead>
                          <tr style={{ background: "#e2e8f0" }}>
                            <th style={{ textAlign: "left", padding: "6px 8px", border: "1px solid #cbd5e1" }}>Matter</th>
                            <th style={{ textAlign: "left", padding: "6px 8px", border: "1px solid #cbd5e1" }}>Provider</th>
                            <th style={{ textAlign: "left", padding: "6px 8px", border: "1px solid #cbd5e1" }}>Patient</th>
                            <th style={{ textAlign: "right", padding: "6px 8px", border: "1px solid #cbd5e1" }}>Bill Amount</th>
                            <th style={{ textAlign: "right", padding: "6px 8px", border: "1px solid #cbd5e1" }}>Settled Principal</th>
                            <th style={{ textAlign: "right", padding: "6px 8px", border: "1px solid #cbd5e1" }}>Settled Interest</th>
                            <th style={{ textAlign: "right", padding: "6px 8px", border: "1px solid #cbd5e1" }}>Settled Costs</th>
                            <th style={{ textAlign: "right", padding: "6px 8px", border: "1px solid #cbd5e1" }}>Settled Attorney Fee</th>
                            <th style={{ textAlign: "right", padding: "6px 8px", border: "1px solid #cbd5e1" }}>Total Settlement</th>
                          </tr>
                        </thead>
                        <tbody>
                          {masterWorkspaceBillRows(masterSettlementDetailRows).map((row: any) => {
                            const rowId = clean(row.id);
                            const billAmount = masterWorkspaceBillAmount(row);
                            const billTotal = masterWorkspaceBillTotal(masterSettlementDetailRows);
                            const allocationRatio = billTotal > 0 ? billAmount / billTotal : 0;
                            const settledPrincipal =
                              billTotal > 0
                                ? Math.min(masterSettlementGrossValue() * allocationRatio, billAmount)
                                : 0;
                            const settledInterest = billTotal > 0 ? masterSettlementInterestValue() * allocationRatio : 0;
                            const settledCosts = rowId === clean(masterWorkspaceBillRows(masterSettlementDetailRows)[0]?.id) ? masterSettlementCostsValue() : 0;
                            const defaultSettledAttorneyFee = Math.min((settledPrincipal + settledInterest) * 0.2, 1360 * allocationRatio);
                            const settledAttorneyFee = masterSettlementAttorneyFeeOverrides[rowId] !== undefined
                              ? masterSettlementMoneyValue(masterSettlementAttorneyFeeOverrides[rowId])
                              : defaultSettledAttorneyFee;
                            const totalSettlement = settledPrincipal + settledInterest + settledCosts + settledAttorneyFee;

                            return (
                              <tr key={`master-settlement-popup-${rowId}`}>
                                <td style={{ padding: "6px 8px", border: "1px solid #e5e7eb", fontWeight: 900 }}>
                                  {clean(row.displayNumber) || rowId}
                                </td>
                                <td style={{ padding: "6px 8px", border: "1px solid #e5e7eb" }}>
                                  {clean(row.provider) || "—"}
                                </td>
                                <td style={{ padding: "6px 8px", border: "1px solid #e5e7eb" }}>
                                  {clean(row.patient) || "—"}
                                </td>
                                <td style={{ padding: "6px 8px", border: "1px solid #e5e7eb", textAlign: "right", fontWeight: 900 }}>
                                  {money(billAmount)}
                                </td>
                                <td style={{ padding: "6px 8px", border: "1px solid #e5e7eb", textAlign: "right", fontWeight: 950, color: "#1d4ed8" }}>
                                  {money(settledPrincipal)}
                                </td>
                                <td style={{ padding: "6px 8px", border: "1px solid #e5e7eb", textAlign: "right", fontWeight: 950, color: "#1d4ed8" }}>
                                  {money(settledInterest)}
                                </td>
                                <td style={{ padding: "6px 8px", border: "1px solid #e5e7eb", textAlign: "right", fontWeight: 950, color: "#1d4ed8" }}>
                                  {money(settledCosts)}
                                </td>
                                <td style={{ padding: "6px 8px", border: "1px solid #e5e7eb", textAlign: "right" }}>
                                  <input
                                    value={masterSettlementAttorneyFeeOverrides[rowId] ?? formatMasterSettlementDollarInput(String(defaultSettledAttorneyFee))}
                                    onChange={(event) =>
                                      setMasterSettlementAttorneyFeeOverrides((prev) => ({
                                        ...prev,
                                        [rowId]: event.target.value,
                                      }))
                                    }
                                    onBlur={() =>
                                      setMasterSettlementAttorneyFeeOverrides((prev) => ({
                                        ...prev,
                                        [rowId]: formatMasterSettlementDollarInput(prev[rowId] ?? String(defaultSettledAttorneyFee)),
                                      }))
                                    }
                                    inputMode="decimal"
                                    style={{
                                      width: 108,
                                      border: "1px solid #cbd5e1",
                                      borderRadius: 8,
                                      padding: "6px 8px",
                                      textAlign: "right",
                                      fontWeight: 900,
                                      color: "#1d4ed8",
                                    }}
                                  />
                                </td>
                                <td style={{ padding: "6px 8px", border: "1px solid #e5e7eb", textAlign: "right", fontWeight: 950 }}>
                                  {money(totalSettlement)}
                                </td>
                              </tr>
                            );
                          })}
                          {(() => {
                            const billRows = masterWorkspaceBillRows(masterSettlementDetailRows);
                            const billTotal = masterWorkspaceBillTotal(masterSettlementDetailRows);
                            const firstRowId = clean((billRows[0] as any)?.id);

                            const settledPrincipalTotal = billRows.reduce((sum: number, row: any) => {
                              const billAmount = masterWorkspaceBillAmount(row);
                              const allocationRatio = billTotal > 0 ? billAmount / billTotal : 0;
                              return sum + Math.min(masterSettlementGrossValue() * allocationRatio, billAmount);
                            }, 0);

                            const settledInterestTotal = masterSettlementInterestValue();
                            const settledCostsTotal = masterSettlementCostsValue();

                            const attorneyFeeTotal = billRows.reduce((sum: number, row: any) => {
                              const rowId = clean(row.id);
                              const billAmount = masterWorkspaceBillAmount(row);
                              const allocationRatio = billTotal > 0 ? billAmount / billTotal : 0;
                              const settledPrincipal = Math.min(masterSettlementGrossValue() * allocationRatio, billAmount);
                              const settledInterest = masterSettlementInterestValue() * allocationRatio;
                              const defaultSettledAttorneyFee = Math.min((settledPrincipal + settledInterest) * 0.2, 1360 * allocationRatio);
                              return sum + (
                                masterSettlementAttorneyFeeOverrides[rowId] !== undefined
                                  ? masterSettlementMoneyValue(masterSettlementAttorneyFeeOverrides[rowId])
                                  : defaultSettledAttorneyFee
                              );
                            }, 0);

                            const totalSettlementTotal = settledPrincipalTotal + settledInterestTotal + settledCostsTotal + attorneyFeeTotal;

                            return (
                              <tr style={{ background: "#f8fafc", fontWeight: 950 }}>
                                <td style={{ padding: "6px 8px", border: "1px solid #cbd5e1" }}>Total</td>
                                <td style={{ padding: "6px 8px", border: "1px solid #cbd5e1" }}></td>
                                <td style={{ padding: "6px 8px", border: "1px solid #cbd5e1" }}></td>
                                <td style={{ padding: "6px 8px", border: "1px solid #cbd5e1", textAlign: "right" }}>{money(billTotal)}</td>
                                <td style={{ padding: "6px 8px", border: "1px solid #cbd5e1", textAlign: "right" }}>{money(settledPrincipalTotal)}</td>
                                <td style={{ padding: "6px 8px", border: "1px solid #cbd5e1", textAlign: "right" }}>{money(settledInterestTotal)}</td>
                                <td style={{ padding: "6px 8px", border: "1px solid #cbd5e1", textAlign: "right" }}>{money(settledCostsTotal)}</td>
                                <td style={{ padding: "6px 8px", border: "1px solid #cbd5e1", textAlign: "right" }}>{money(attorneyFeeTotal)}</td>
                                <td style={{ padding: "6px 8px", border: "1px solid #cbd5e1", textAlign: "right" }}>{money(totalSettlementTotal)}</td>
                              </tr>
                            );
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {masterSettlementLocalPreview && (
                    <section
                      data-barsh-local-settlement-preview-panel="true"
                      style={{
                        border: masterSettlementLocalPreview.ok ? "1px solid #bbf7d0" : "1px solid #fecaca",
                        borderRadius: 16,
                        background: masterSettlementLocalPreview.ok ? "#f0fdf4" : "#fef2f2",
                        padding: 14,
                        display: "grid",
                        gap: 10,
                      }}
                    >
                      <div style={{ fontWeight: 950, color: masterSettlementLocalPreview.ok ? "#166534" : "#991b1b" }}>
                        Local-First Settlement Calculation Preview
                      </div>
                      <div style={{ color: "#475569", lineHeight: 1.45 }}>
                        Preview only.  This reads Barsh Matters ClaimIndex data and does not write Clio, write the database, generate documents, print, queue, or close matters.
                      </div>

                      {masterSettlementLocalPreview.error && (
                        <div style={{ color: "#991b1b", fontWeight: 900 }}>
                          Error: {masterSettlementLocalPreview.error}
                        </div>
                      )}

                      {masterSettlementLocalPreview.summary && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                          <div><strong>Rows:</strong> {masterSettlementLocalPreview.summary.rowCount ?? "—"}</div>
                          <div><strong>Gross:</strong> {money(masterSettlementLocalPreview.summary.grossSettlementAmount)}</div>
                          <div><strong>Allocated:</strong> {money(masterSettlementLocalPreview.summary.allocatedSettlementTotal)}</div>
                          <div><strong>Interest:</strong> {money(masterSettlementLocalPreview.summary.interestAmountTotal)}</div>
                          <div><strong>Principal Fee:</strong> {money(masterSettlementLocalPreview.summary.principalFeeTotal)}</div>
                          <div><strong>Interest Fee:</strong> {money(masterSettlementLocalPreview.summary.interestFeeTotal)}</div>
                          <div><strong>Total Fee:</strong> {money(masterSettlementLocalPreview.summary.totalFee)}</div>
                          <div><strong>Provider Net:</strong> {money(masterSettlementLocalPreview.summary.providerNetTotal)}</div>
                        </div>
                      )}

                      {masterSettlementLocalPreview.settlementRecordPayload && (
                        <div
                          data-barsh-local-settlement-record-payload-preview="true"
                          style={{
                            border: "1px solid #86efac",
                            borderRadius: 12,
                            background: "#ffffff",
                            padding: "7px 10px",
                            display: "grid",
                            gap: 6,
                          }}
                        >
                          <div style={{ fontWeight: 950, color: "#166534" }}>
                            Local Settlement Record Payload Preview
                          </div>
                          <div style={{ color: "#475569", lineHeight: 1.45 }}>
                            Preview-only payload prepared for a future Barsh Matters local settlement record.  No database record is created here.
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8 }}>
                            <div><strong>Payload:</strong> {masterSettlementLocalPreview.settlementRecordPayload.payloadKind || "—"}</div>
                            <div><strong>Record Intent:</strong> {masterSettlementLocalPreview.settlementRecordPayload.recordIntent || "—"}</div>
                            <div><strong>Rows in Payload:</strong> {Array.isArray(masterSettlementLocalPreview.settlementRecordPayload.settlementRows) ? masterSettlementLocalPreview.settlementRecordPayload.settlementRows.length : "—"}</div>
                            <div><strong>DB Changed:</strong> {masterSettlementLocalPreview.settlementRecordPayload.databaseRecordsChanged ? "Yes" : "No"}</div>
                          </div>
                        </div>
                      )}

                      {masterSettlementRecordSave && (
                        <div
                          data-barsh-local-settlement-save-preview-panel="true"
                          style={{
                            border: masterSettlementRecordSave.ok ? "1px solid #93c5fd" : "1px solid #fecaca",
                            borderRadius: 12,
                            background: masterSettlementRecordSave.ok ? "#eff6ff" : "#fef2f2",
                            padding: "7px 10px",
                            display: "grid",
                            gap: 6,
                          }}
                        >
                          <div style={{ fontWeight: 950, color: masterSettlementRecordSave.ok ? "#1d4ed8" : "#991b1b" }}>
                            Local Settlement Save Result
                          </div>
                          <div style={{ color: "#475569", lineHeight: 1.45 }}>
                            Local save result.  This saves to Barsh Matters local settlement tables only and does not write Clio, generate documents, print, queue, or close matters.
                          </div>
                          {masterSettlementRecordSave.error && (
                            <div style={{ color: "#991b1b", fontWeight: 900 }}>
                              Error: {masterSettlementRecordSave.error}
                            </div>
                          )}
                          {masterSettlementRecordSave.savedRecord && (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8 }}>
                              <div><strong>Target:</strong> {masterSettlementRecordSave.savedRecord.targetModel || "—"}</div>
                              <div><strong>Rows:</strong> {Array.isArray(masterSettlementRecordSave.savedRecord.rowValues) ? masterSettlementRecordSave.savedRecord.rowValues.length : "—"}</div>
                              <div><strong>Total Fee:</strong> {money(masterSettlementRecordSave.savedRecord.recordValues?.totalFee)}</div>
                              <div><strong>Provider Net:</strong> {money(masterSettlementRecordSave.savedRecord.recordValues?.providerNetTotal)}</div>
                              <div><strong>DB Changed:</strong> {masterSettlementRecordSave.savedRecord.databaseRecordsChanged ? "Yes" : "No"}</div>
                            </div>
                          )}
                          {Array.isArray(masterSettlementRecordSave?.validation?.blockingErrors) && masterSettlementRecordSave.validation.blockingErrors.length > 0 && (
                            <div style={{ color: "#991b1b", fontWeight: 900 }}>
                              Save Blocking: {masterSettlementRecordSave.validation.blockingErrors.join(" ")}
                            </div>
                          )}
                        </div>
                      )}

                      {Array.isArray(masterSettlementLocalPreview?.validation?.blockingErrors) && masterSettlementLocalPreview.validation.blockingErrors.length > 0 && (
                        <div style={{ color: "#991b1b", fontWeight: 900 }}>
                          Blocking: {masterSettlementLocalPreview.validation.blockingErrors.join(" ")}
                        </div>
                      )}

                      {Array.isArray(masterSettlementLocalPreview?.validation?.warnings) && masterSettlementLocalPreview.validation.warnings.length > 0 && (
                        <div style={{ color: "#92400e", fontWeight: 900 }}>
                          Warnings: {masterSettlementLocalPreview.validation.warnings.join(" ")}
                        </div>
                      )}
                    </section>
                  )}

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
                      onClick={clearMasterSettlementEntryFields}
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
                      onClick={runMasterSettlementLocalPreview}
                      disabled={masterSettlementLocalPreviewLoading || masterSettlementGrossValue() <= 0}
                      title="Preview local-first settlement calculations only.  No database write, document generation, print queue change, or matter closure occurs."
                      style={{
                        minWidth: 250,
                        height: 44,
                        border: masterSettlementLocalPreviewLoading || masterSettlementGrossValue() <= 0 ? "1px solid #bfdbfe" : "1px solid #2563eb",
                        borderRadius: 12,
                        background: masterSettlementLocalPreviewLoading || masterSettlementGrossValue() <= 0 ? "#dbeafe" : "#2563eb",
                        color: masterSettlementLocalPreviewLoading || masterSettlementGrossValue() <= 0 ? "#1d4ed8" : "#ffffff",
                        fontWeight: 950,
                        fontSize: 15,
                        cursor: masterSettlementLocalPreviewLoading || masterSettlementGrossValue() <= 0 ? "not-allowed" : "pointer",
                      }}
                    >
                      {masterSettlementLocalPreviewLoading ? "Calculating..." : "Calculate Settlement"}
                    </button>

                    <button
                      type="button"
                      data-barsh-record-local-settlement-guarded-button="true"
                      onClick={commitMasterSettlementAndLaunchDocuments}
                      disabled={
                        masterSettlementRecordSaveLoading ||
                        !masterSettlementLocalPreview?.ok ||
                        !masterSettlementLocalPreview?.settlementRecordPayload
                      }
                      title="Save the settlement to Barsh Matters local settlement tables only.  This does not write Clio, generate documents, print, queue, or close matters."
                      style={{
                        minWidth: 230,
                        height: 44,
                        border:
                          masterSettlementRecordSaveLoading ||
                          !masterSettlementLocalPreview?.ok ||
                          !masterSettlementLocalPreview?.settlementRecordPayload
                            ? "1px solid #bbf7d0"
                            : "1px solid #16a34a",
                        borderRadius: 12,
                        background:
                          masterSettlementRecordSaveLoading ||
                          !masterSettlementLocalPreview?.ok ||
                          !masterSettlementLocalPreview?.settlementRecordPayload
                            ? "#dcfce7"
                            : "#16a34a",
                        color:
                          masterSettlementRecordSaveLoading ||
                          !masterSettlementLocalPreview?.ok ||
                          !masterSettlementLocalPreview?.settlementRecordPayload
                            ? "#166534"
                            : "#ffffff",
                        fontWeight: 950,
                        fontSize: 15,
                        cursor:
                          masterSettlementRecordSaveLoading ||
                          !masterSettlementLocalPreview?.ok ||
                          !masterSettlementLocalPreview?.settlementRecordPayload
                            ? "not-allowed"
                            : "pointer",
                        opacity:
                          masterSettlementRecordSaveLoading ||
                          !masterSettlementLocalPreview?.ok ||
                          !masterSettlementLocalPreview?.settlementRecordPayload
                            ? 0.78
                            : 1,
                      
                ...masterSettlementCommitButtonStyle(),}}
                    >
                      {masterSettlementRecordSaveLoading ? "Committing..." : "Commit Settlement"}
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
                        Master Lawsuit Payment · Local child-bill receipts.
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
                          borderRadius: 8,
                          padding: "7px 10px",
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
                          borderRadius: 8,
                          padding: "7px 10px",
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
                          borderRadius: 8,
                          padding: "7px 10px",
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
                            borderRadius: 8,
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
                          borderRadius: 8,
                          padding: "7px 10px",
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
                          borderRadius: 8,
                          padding: "7px 10px",
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
                        padding: "6px 8px",
                        border: "1px solid #bae6fd",
                        borderRadius: 8,
                        background: "#e0f2fe",
                        color: "#075985",
                        fontWeight: 900,
                      }}
                    >
                      This posts local Barsh Matters payment receipts to the child bill matters.
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
                        padding: "7px 10px",
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
                            <th style={{ textAlign: "left", padding: "6px 8px", border: "1px solid #cbd5e1" }}>Matter</th>
                            <th style={{ textAlign: "left", padding: "6px 8px", border: "1px solid #cbd5e1" }}>Provider</th>
                            <th style={{ textAlign: "left", padding: "6px 8px", border: "1px solid #cbd5e1" }}>Patient</th>
                            <th style={{ textAlign: "right", padding: "6px 8px", border: "1px solid #cbd5e1" }}>Bill Amount</th>
                            <th style={{ textAlign: "right", padding: "6px 8px", border: "1px solid #cbd5e1" }}>Allocation %</th>
                            <th style={{ textAlign: "right", padding: "6px 8px", border: "1px solid #cbd5e1" }}>Payment To Post</th>
                            <th style={{ textAlign: "right", padding: "6px 8px", border: "1px solid #cbd5e1" }}>Expected Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {masterPaymentAllocationRows().map((item: any) => {
                            const row = item.row;
                            const billTotal = masterWorkspaceBillTotal(masterSettlementDetailRows);
                            const allocationPercent = billTotal > 0 ? (item.billAmount / billTotal) * 100 : 0;

                            return (
                              <tr key={`master-payment-popup-${item.displayNumber || item.rowId}`}>
                                <td style={{ padding: "6px 8px", border: "1px solid #e5e7eb", fontWeight: 900 }}>
                                  {item.displayNumber || item.rowId}
                                </td>
                                <td style={{ padding: "6px 8px", border: "1px solid #e5e7eb" }}>
                                  {clean(row.provider) || "—"}
                                </td>
                                <td style={{ padding: "6px 8px", border: "1px solid #e5e7eb" }}>
                                  {clean(row.patient) || "—"}
                                </td>
                                <td style={{ padding: "6px 8px", border: "1px solid #e5e7eb", textAlign: "right", fontWeight: 900 }}>
                                  {money(item.billAmount)}
                                </td>
                                <td style={{ padding: "6px 8px", border: "1px solid #e5e7eb", textAlign: "right" }}>
                                  {allocationPercent.toFixed(2)}%
                                </td>
                                <td style={{ padding: "6px 8px", border: "1px solid #e5e7eb", textAlign: "right", fontWeight: 950, color: "#166534" }}>
                                  {money(item.paymentToPost)}
                                </td>
                                <td style={{ padding: "6px 8px", border: "1px solid #e5e7eb", textAlign: "right", fontWeight: 950 }}>
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
                      title="Post local Barsh Matters payment receipts to the child bill matters."
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
  width: 560,
  height: 152,
  display: "block",
};

const printButtonRowStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  right: 342,
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: 8,
  flexWrap: "nowrap",
  zIndex: 2,
};

const bmLogoLinkStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  display: "inline-flex",
  alignItems: "flex-start",
  justifyContent: "flex-end",
  textDecoration: "none",
  width: 330,
  height: 152,
  flexShrink: 0,
  zIndex: 1,
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
  minWidth: 330,
  objectFit: "contain",
  objectPosition: "right top",
  display: "block",
  flexShrink: 0,
};

const printQueueButtonStyle: React.CSSProperties = {
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
  borderRadius: 8,
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
  borderRadius: 8,
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
  padding: "6px 8px",
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
  padding: "6px 8px",
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
