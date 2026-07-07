"use client";

import { formatDateOnlyForDisplay } from "@/lib/dateOnlyDisplay";
import { BARSH_MATTER_STATUS_OPTIONS } from "@/lib/matterStatusOptions";
import { normalizeProviderName } from "@/lib/providerNameCase";

import React, { useEffect, useMemo, useRef, useState } from "react";
import BarshHeaderQuickNav from "@/app/components/BarshHeaderQuickNav";
import BarshHeaderActions from "@/app/components/BarshHeaderActions";
import { bmConfirm, bmAlert, bmPrompt } from "@/app/components/BmDialogHost";
import LawsuitDocuments from "@/components/documents/LawsuitDocuments";
import MatterEmailCompose from "@/components/email/MatterEmailCompose";
import InboundAttachmentReview from "@/components/email/InboundAttachmentReview";
import { type FiledDoc } from "@/components/documents/FolderTree";
import BarshHeader from "@/app/components/BarshHeader";
import { documentDeliverySafetyNote, resolvePrintableUrl, type DocumentDeliveryContext } from "@/lib/documents/delivery";

type FilterKind = "patient" | "provider" | "insurer" | "claim" | "master" | "treatingProvider" | "dateOfLoss";

type MatterRow = {
  id: string;
  displayNumber: string;
  description: string;
  patient: string;
  provider: string;
  insurer: string;
  claimNumber: string;
  dosStart: string;
  dosEnd: string;
  dateOfLoss: string;
  date_of_loss: string;
  denialReason: string;
  status: string;
  finalStatus: "Open" | "Closed";
  masterLawsuitId: string;
  treatingProvider: string;
  claimAmount: any;
  balancePresuit: any;
  paymentVoluntary?: any;
  billAmount: any;
  isMaster: boolean;
  matchedBy: string;
};

type ClaimResultsSortKey =
  | "matter"
  | "patient"
  | "provider"
  | "insurer"
  | "claim"
  | "dos"
  | "denialReason"
  | "masterLawsuit"
  | "claimAmount"
  | "balance"
  | "status"
  | "finalStatus";

type ClaimResultsSortState = {
  key: ClaimResultsSortKey;
  direction: "asc" | "desc";
} | null;

const colors = {
  ink: "#00346e",
  muted: "#385a83",
  subtle: "#385a83",
  line: "#d7dee9",
  lineSoft: "#e5e7eb",
  page: "#f8fafc",
  panel: "#ffffff",
  blue: "#00346e",
  blueDark: "#00346e",
  errorBg: "#fef2f2",
  errorBorder: "#fecaca",
};

function clean(v: any) {
  return String(v || "").trim();
}

function displayDate(v: any) {
  const raw = clean(v);
  if (!raw) return "";

  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return `${Number(month)}/${Number(day)}/${year}`;
  }

  return raw;
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
    dosStart: clean(row?.dosStart ?? row?.dos_start),
    dosEnd: clean(row?.dosEnd ?? row?.dos_end),
    dateOfLoss: clean(row?.dateOfLoss ?? row?.date_of_loss ?? row?.lossDate ?? row?.loss_date),
    date_of_loss: clean(row?.dateOfLoss ?? row?.date_of_loss ?? row?.lossDate ?? row?.loss_date),
    denialReason: clean(row?.denialReason ?? row?.denial_reason),
    status: clean(row?.matterStage?.name ?? row?.matter_stage_name ?? row?.status),
    finalStatus: (() => {
      const rawFinalStatus = clean(row?.finalStatus ?? row?.final_status).toLowerCase();
      if (rawFinalStatus === "closed") return "Closed";
      if (rawFinalStatus === "open") return "Open";
      return clean(row?.closeReason ?? row?.close_reason) ? "Closed" : "Open";
    })(),
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

function matterRowSortValue(row: MatterRow, key: ClaimResultsSortKey): string | number {
  if (key === "matter") return clean(row.displayNumber || row.id).toLowerCase();
  if (key === "patient") return clean(row.patient).toLowerCase();
  if (key === "provider") return clean(row.provider).toLowerCase();
  if (key === "insurer") return clean(row.insurer).toLowerCase();
  if (key === "claim") return clean(row.claimNumber).toLowerCase();
  if (key === "dos") return clean(row.dosStart || row.dosEnd);
  if (key === "denialReason") return clean(row.denialReason).toLowerCase();
  if (key === "masterLawsuit") return clean(row.masterLawsuitId).toLowerCase();
  if (key === "claimAmount") return Number(row.claimAmount ?? 0) || 0;
  if (key === "balance") return Number(row.balancePresuit ?? 0) || 0;
  if (key === "status") return clean(row.status).toLowerCase();
  if (key === "finalStatus") return clean(row.finalStatus).toLowerCase();

  return "";
}

function sortMatterRows(rows: MatterRow[], sort: ClaimResultsSortState): MatterRow[] {
  if (!sort) return rows;

  const direction = sort.direction === "desc" ? -1 : 1;

  return [...rows].sort((a, b) => {
    const av = matterRowSortValue(a, sort.key);
    const bv = matterRowSortValue(b, sort.key);

    if (typeof av === "number" && typeof bv === "number") {
      return (av - bv) * direction;
    }

    return String(av).localeCompare(String(bv), undefined, {
      numeric: true,
      sensitivity: "base",
    }) * direction;
  });
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
  const dateOfLoss = clean(params.get("dateOfLoss"));

  if (treatingProvider) return { kind: "treatingProvider", value: treatingProvider };
  if (dateOfLoss) return { kind: "dateOfLoss", value: dateOfLoss };
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
  if (kind === "dateOfLoss") return `Matters for Date of Loss: ${formatDateOnlyForDisplay(value) || value}`;
  return `Matters for Claim: ${value}`;
}

function filterLabel(kind: FilterKind | "") {
  if (kind === "patient") return "Patient";
  if (kind === "provider") return "Provider";
  if (kind === "treatingProvider") return "Treating Provider";
  if (kind === "insurer") return "Insurer";
  if (kind === "claim") return "Claim Number";
  if (kind === "master") return "Master Lawsuit";
  if (kind === "dateOfLoss") return "Date of Loss";
  return "Filter";
}

function filteredUrl(kind: FilterKind, value: string) {
  const params = new URLSearchParams();
  params.set(kind, value);
  return `/matters?${params.toString()}`;
}

type WorkflowKind = "patient" | "claim" | "";
type MasterWorkspaceTab = "documents" | "settlement" | "payments" | "email_threads" | "close_paid_settlements";

const MASTER_WORKSPACE_TABS: MasterWorkspaceTab[] = [
  "documents",
  "settlement",
  "payments",
  "email_threads",
  "close_paid_settlements",
];

function normalizeMasterWorkspaceTab(value: unknown): MasterWorkspaceTab {
  const raw = String(value ?? "").trim();
  return (MASTER_WORKSPACE_TABS as string[]).includes(raw) ? (raw as MasterWorkspaceTab) : "payments";
}

function masterWorkspaceTabFromUrl(): MasterWorkspaceTab {
  if (typeof window === "undefined") return "payments";
  return normalizeMasterWorkspaceTab(new URLSearchParams(window.location.search).get("tab"));
}

function mattersUrlWithMasterWorkspaceTab(tab: MasterWorkspaceTab) {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  url.searchParams.set("tab", tab);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

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

type DirectMatterSingleMasterDocumentPayloadParams = {
  directMatterId: string | number;
  directMatterDisplayNumber: string;
  documentKeys: string[];
  workingDocumentDriveItemId?: string;
  workingDocumentKey?: string;
  confirmUpload?: boolean;
  singleMasterDryRun?: boolean;
  singleMasterResolveFolders?: boolean;
  allowDuplicateUploads?: boolean;
};

function buildDirectMatterSingleMasterWorkingDocxPayload(params: DirectMatterSingleMasterDocumentPayloadParams) {
  return {
    confirmCreate: true,
    uploadTargetMode: "direct-matter",
    directMatterId: String(params.directMatterId || ""),
    directMatterDisplayNumber: params.directMatterDisplayNumber,
    useSingleMasterClioStorage: true,
    singleMasterDirectStorage: true,
    documentKeys: params.documentKeys,
  };
}

function buildDirectMatterSingleMasterFinalizePayload(params: DirectMatterSingleMasterDocumentPayloadParams) {
  return {
    uploadTargetMode: "direct-matter",
    directMatterId: String(params.directMatterId || ""),
    directMatterDisplayNumber: params.directMatterDisplayNumber,
    useSingleMasterClioStorage: true,
    confirmUpload: params.confirmUpload === true,
    singleMasterDryRun: params.singleMasterDryRun !== false,
    singleMasterResolveFolders: params.singleMasterResolveFolders === true,
    allowDuplicateUploads: false,
    documentKeys: params.documentKeys,
    workingDocumentDriveItemId: params.workingDocumentDriveItemId || "",
    workingDocumentKey: params.workingDocumentKey || "",
  };
}

function buildDirectMatterSingleMasterFinalizeDryRunPayload(
  params: Omit<DirectMatterSingleMasterDocumentPayloadParams, "confirmUpload" | "singleMasterDryRun" | "singleMasterResolveFolders">
) {
  return buildDirectMatterSingleMasterFinalizePayload({
    ...params,
    confirmUpload: false,
    singleMasterDryRun: true,
    singleMasterResolveFolders: true,
  });
}

export default function FilteredMattersPage() {
  // Route legacy alert() through the BM-styled dialog (no native "localhost says" popups).
  const alert = (message: React.ReactNode) => { void bmAlert({ message }); };
  const [kind, setKind] = useState<FilterKind | "">("");
  const [workflowKind, setWorkflowKind] = useState<WorkflowKind>("");
  const [value, setValue] = useState("");
  const [rows, setRows] = useState<MatterRow[]>([]);
  const [claimResultsSort, setClaimResultsSort] = useState<ClaimResultsSortState>(null);
  const sortedRows = useMemo(() => sortMatterRows(rows, claimResultsSort), [rows, claimResultsSort]);
  const [masterLawsuitMetadata, setMasterLawsuitMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeMasterWorkspaceTab, setActiveMasterWorkspaceTabState] =
    useState<MasterWorkspaceTab>(() => masterWorkspaceTabFromUrl());

  function setActiveMasterWorkspaceTab(tab: MasterWorkspaceTab, options: { updateUrl?: boolean; replaceUrl?: boolean } = {}) {
    const nextTab = normalizeMasterWorkspaceTab(tab);
    setActiveMasterWorkspaceTabState(nextTab);

    if (typeof window !== "undefined" && options.updateUrl !== false) {
      const nextUrl = mattersUrlWithMasterWorkspaceTab(nextTab);
      const currentUrl = `${window.location.pathname}${window.location.search}`;

      if (nextUrl && nextUrl !== currentUrl) {
        if (options.replaceUrl) {
          window.history.replaceState({ barshMattersMattersMasterTab: true }, "", nextUrl);
        } else {
          window.history.pushState({ barshMattersMattersMasterTab: true }, "", nextUrl);
        }
      }
    }
  }
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
    if (typeof window === "undefined") return;

    function applyMasterWorkspaceTabFromUrl() {
      setActiveMasterWorkspaceTabState(masterWorkspaceTabFromUrl());
    }

    applyMasterWorkspaceTabFromUrl();
    window.addEventListener("popstate", applyMasterWorkspaceTabFromUrl);

    return () => {
      window.removeEventListener("popstate", applyMasterWorkspaceTabFromUrl);
    };
  }, []);

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
  const [masterPaymentTransactionTypeOptions, setMasterPaymentTransactionTypeOptions] = useState<any[]>([]);
  const [masterPaymentTransactionStatusOptions, setMasterPaymentTransactionStatusOptions] = useState<any[]>([]);
  const [masterPaymentTransactionOptionsLoading, setMasterPaymentTransactionOptionsLoading] = useState(false);
  const [masterPaymentCheckDateInput, setMasterPaymentCheckDateInput] = useState("");
  const [masterPaymentCheckNumberInput, setMasterPaymentCheckNumberInput] = useState("");
  const [masterPaymentAllocationMethodInput, setMasterPaymentAllocationMethodInput] = useState("proportional_by_balance");
  const [masterPaymentSelectedOnlyInput, setMasterPaymentSelectedOnlyInput] = useState(false);
  const [masterPaymentSelectedRowIds, setMasterPaymentSelectedRowIds] = useState<Record<string, boolean>>({});
  const [masterPaymentManualAllocationInputs, setMasterPaymentManualAllocationInputs] = useState<Record<string, string>>({});
  const [masterPaymentPosting, setMasterPaymentPosting] = useState(false);
  const [masterPaymentPostResult, setMasterPaymentPostResult] = useState<any>(null);
  const [masterPaymentClosePromptOpen, setMasterPaymentClosePromptOpen] = useState(false);
  const [masterPaymentReceiptsLoading, setMasterPaymentReceiptsLoading] = useState(false);
  const [masterPaymentReceipts, setMasterPaymentReceipts] = useState<any[]>([]);
  const [masterPaymentReceiptsError, setMasterPaymentReceiptsError] = useState("");
  const [masterPaymentShowVoided, setMasterPaymentShowVoided] = useState(false);
  const [masterPaymentVoidLoadingId, setMasterPaymentVoidLoadingId] = useState<number | null>(null);
  const [masterCloseDialogOpen, setMasterCloseDialogOpen] = useState(false);
  const [masterAddCourtDateDialogOpen, setMasterAddCourtDateDialogOpen] = useState(false);
  const [masterAddCourtDateSaving, setMasterAddCourtDateSaving] = useState(false);
  const [masterAddCourtDateResult, setMasterAddCourtDateResult] = useState<any>(null);
  const [masterAddCourtDateCourtOptions, setMasterAddCourtDateCourtOptions] = useState<string[]>([]);
  const [masterAddCourtDateCourtOptionsLoading, setMasterAddCourtDateCourtOptionsLoading] = useState(false);
  const [masterCourtDatesList, setMasterCourtDatesList] = useState<any[]>([]);
  const [masterCourtDatesListLoading, setMasterCourtDatesListLoading] = useState(false);
  const [masterCourtDatesListError, setMasterCourtDatesListError] = useState("");
  const [masterAddCourtDateForm, setMasterAddCourtDateForm] = useState({ eventDate: "", eventTime: "09:30", court: "", calendarNumber: "", judgeOrArbitrator: "", appearanceType: "", notes: "" });
  const [masterEditCourtDatesDialogOpen, setMasterEditCourtDatesDialogOpen] = useState(false);
  const [masterEditCourtDatesSavingId, setMasterEditCourtDatesSavingId] = useState<string | null>(null);
  const [masterEditCourtDatesResult, setMasterEditCourtDatesResult] = useState<any>(null);
  const [masterEditCourtDatesSelectedId, setMasterEditCourtDatesSelectedId] = useState<string>("");
  const [masterEditCourtDatesSelectedEvent, setMasterEditCourtDatesSelectedEvent] = useState<any>(null);
  const [masterEditCourtDatesForms, setMasterEditCourtDatesForms] = useState<Record<string, { eventDate: string; eventTime: string; court: string; calendarNumber: string; judgeOrArbitrator: string; appearanceType: string; notes: string }>>({});
  const [masterActionGroup, setMasterActionGroup] = useState<"payments" | "settlement" | "documents" | "court_dates" | "emails" | null>(null);
  const [masterEmailComposeOpen, setMasterEmailComposeOpen] = useState(false);
  const [masterEmailUnread, setMasterEmailUnread] = useState(0);
  async function refreshMasterEmailUnread() {
    const masterId = typeof window === "undefined" ? "" : currentMasterLawsuitIdForDocumentPreview();
    if (!masterId) { setMasterEmailUnread(0); return; }
    try {
      const res = await fetch(`/api/graph/matter-email/unread-count?masterLawsuitId=${encodeURIComponent(masterId)}`);
      const j = await res.json().catch(() => ({}));
      if (typeof j?.unread === "number") setMasterEmailUnread(j.unread);
    } catch { /* non-fatal */ }
  }
  useEffect(() => { void refreshMasterEmailUnread(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const [masterPaymentsPanelOpen, setMasterPaymentsPanelOpen] = useState(false);
  const [masterCloseReason, setMasterCloseReason] = useState("");
  const [masterClosing, setMasterClosing] = useState(false);
  const [masterReopening, setMasterReopening] = useState(false);
  const [masterCloseResult, setMasterCloseResult] = useState<any>(null);

  const fallbackMasterPaymentTransactionTypeOptions = [
    "Collection Payment",
    "Interest",
    "Index Fee",
    "Service Fee",
    "Other Court Costs",
    "PreC to Provider",
    "Attorney Fee",
  ];

  const fallbackMasterPaymentTransactionStatusOptions = [
    "Show on Remittance",
    "Do Not Show on Remittance",
  ];

  function masterReferenceOptionDisplayName(option: any): string {
    return String(option?.displayName || option?.label || option?.value || "").trim();
  }

  function masterPaymentTransactionTypeDisplay(value: unknown): string {
    const text = String(value ?? "").trim();
    const normalized = text.toLowerCase();
    if (normalized === "collection payment") return "Collection";
    if (normalized === "prec to provider" || normalized === "direct pay to provider (pre-suit)") return "Direct Pay to Provider (Pre-suit)";
    if (normalized === "filing fee" || normalized === "filing fee collected" || normalized === "index fee collected") return "Index Fee";
    if (normalized === "service fee collected") return "Service Fee";
    if (normalized === "other court costs collected" || normalized === "other court fees collected") return "Other Court Costs";
    return text || "—";
  }

  function masterPaymentTransactionTypeDropdownOptions(): string[] {
    return fallbackMasterPaymentTransactionTypeOptions;
  }

  function masterPaymentTransactionStatusDropdownOptions(): string[] {
    const loaded = masterPaymentTransactionStatusOptions.map(masterReferenceOptionDisplayName).filter(Boolean);
    return loaded.length ? loaded : fallbackMasterPaymentTransactionStatusOptions;
  }

  function isMasterPaymentDirectProviderTransactionType(value: unknown): boolean {
    const normalized = String(value ?? "").trim().toLowerCase();
    return normalized === "prec to provider" || normalized === "direct pay to provider" || normalized === "direct pay to provider (pre-suit)";
  }

  function handleMasterPaymentTransactionTypeChange(nextType: string) {
    setMasterPaymentTransactionTypeInput(nextType);
    setMasterPaymentPostResult(null);
    if (isMasterPaymentDirectProviderTransactionType(nextType)) {
      setMasterPaymentSelectedOnlyInput(true);
      setMasterPaymentSelectedRowIds({});
      setMasterPaymentManualAllocationInputs({});
      setMasterPaymentAllocationMethodInput("proportional_by_balance");
    } else {
      setMasterPaymentSelectedOnlyInput(false);
    }
    if (String(nextType || "").trim() === "Attorney Fee") {
      setMasterPaymentTransactionStatusInput("Do Not Show on Remittance");
      return;
    }
    setMasterPaymentTransactionStatusInput("Show on Remittance");
  }

  async function loadMasterPaymentTransactionReferenceOptions() {
    setMasterPaymentTransactionOptionsLoading(true);
    try {
      const [typeResponse, statusResponse] = await Promise.all([
        fetch("/api/reference-data/options?type=transaction_type", { cache: "no-store" }),
        fetch("/api/reference-data/options?type=transaction_status", { cache: "no-store" }),
      ]);

      const [typeJson, statusJson] = await Promise.all([
        typeResponse.json().catch(() => ({})),
        statusResponse.json().catch(() => ({})),
      ]);

      setMasterPaymentTransactionTypeOptions(Array.isArray(typeJson?.options) ? typeJson.options : []);
      setMasterPaymentTransactionStatusOptions(Array.isArray(statusJson?.options) ? statusJson.options : []);
    } catch {
      setMasterPaymentTransactionTypeOptions([]);
      setMasterPaymentTransactionStatusOptions([]);
    } finally {
      setMasterPaymentTransactionOptionsLoading(false);
    }
  }

  useEffect(() => {
    void loadMasterPaymentTransactionReferenceOptions();
  }, []);

  function isMasterPaymentCostRecoveryTransactionType(value: unknown): boolean {
    const normalized = String(value ?? "").trim().toLowerCase();
    return [
      "index fee",
      "filing fee",
      "filing fee collected",
      "index fee collected",
      "service fee",
      "service fee collected",
      "other court costs",
      "other court costs collected",
      "other court fees collected",
    ].includes(normalized);
  }

  function isMasterPaymentBalanceCapExemptTransactionType(value: unknown): boolean {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (normalized === "interest" || normalized === "interest payment" || normalized.includes("interest collected")) return true;
    return [
      "index fee",
      "filing fee",
      "filing fee collected",
      "index fee collected",
      "service fee",
      "service fee collected",
      "other court costs",
      "other court costs collected",
      "other court fees collected",
    ].includes(normalized);
  }

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
    setMasterPaymentAllocationMethodInput("proportional_by_balance");
    setMasterPaymentSelectedOnlyInput(false);
    setMasterPaymentSelectedRowIds({});
    setMasterPaymentManualAllocationInputs({});
  }

  function masterPaymentRowKey(row: any): string {
    return String(
      row?.rowId ??
        row?.id ??
        row?.matterId ??
        row?.matter_id ??
        row?.displayNumber ??
        row?.display_number ??
        ""
    );
  }

  function masterPaymentManualAllocationValue(rowKey: string): number {
    const cleaned = String(masterPaymentManualAllocationInputs[rowKey] || "").replace(/[$,\s]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function masterPaymentAllocationRows(): any[] {
    const amount = masterPaymentPreviewAmountValue();
    const balanceCapExempt = isMasterPaymentBalanceCapExemptTransactionType(masterPaymentTransactionTypeInput);
    const costRecoveryPayment = isMasterPaymentCostRecoveryTransactionType(masterPaymentTransactionTypeInput);
    const rows = masterWorkspaceBillRows(masterSettlementDetailRows);

    const preparedRows = rows.map((row: any) => {
      const rowKey = masterPaymentRowKey(row);
      const billAmount = Number(row?.claimAmount ?? row?.claim_amount ?? row?.amount ?? 0) || 0;
      const currentPayments = Number(row?.paymentVoluntary ?? row?.payment_voluntary ?? 0) || 0;
      const currentBalance = Math.max(billAmount - currentPayments, 0);
      const selected = !!masterPaymentSelectedRowIds[rowKey];

      return {
        ...row,
        rowKey,
        rowId: row?.rowId ?? row?.id ?? row?.matterId ?? row?.matter_id ?? row?.displayNumber ?? row?.display_number,
        matterId: row?.matterId ?? row?.matter_id ?? row?.id,
        displayNumber: row?.displayNumber ?? row?.display_number,
        billAmount,
        currentPayments,
        currentBalance,
        selected,
        allocationWeight: balanceCapExempt ? Math.max(currentBalance, 1) : currentBalance,
        allocationEligible: (balanceCapExempt || currentBalance > 0) && (!masterPaymentSelectedOnlyInput || selected),
      };
    });

    const costRecoveryTargetRowKey = costRecoveryPayment
      ? preparedRows.find((item: any) => !masterPaymentSelectedOnlyInput || item.selected)?.rowKey || ""
      : "";

    if (costRecoveryTargetRowKey) {
      for (const item of preparedRows) {
        item.allocationEligible = item.rowKey === costRecoveryTargetRowKey;
        item.allocationWeight = item.allocationEligible ? 1 : 0;
      }
    }

    const totalEligibleBalance = preparedRows
      .filter((item: any) => item.allocationEligible)
      .reduce((sum: number, item: any) => sum + item.allocationWeight, 0);

    let remaining = balanceCapExempt ? amount : Math.min(amount, totalEligibleBalance);

    return preparedRows.map((item: any, index: number) => {
      let paymentToPost = 0;

      if (costRecoveryPayment && item.allocationEligible) {
        paymentToPost = Math.max(Math.round(remaining * 100) / 100, 0);
        remaining = Math.max(Math.round((remaining - paymentToPost) * 100) / 100, 0);
      } else if (item.allocationEligible && masterPaymentAllocationMethodInput === "manual") {
        paymentToPost = Math.max(masterPaymentManualAllocationValue(item.rowKey), 0);
      } else if (item.allocationEligible) {
        const rawAllocation =
          totalEligibleBalance > 0 && amount > 0
            ? amount * (item.allocationWeight / totalEligibleBalance)
            : 0;

        paymentToPost = balanceCapExempt ? Math.min(rawAllocation, remaining) : Math.min(rawAllocation, item.currentBalance, remaining);
        paymentToPost = Math.max(Math.round(paymentToPost * 100) / 100, 0);

        const isLastEligibleRow =
          item.allocationEligible &&
          preparedRows
            .slice(index + 1)
            .every((next: any) => !next.allocationEligible);

        if (isLastEligibleRow) {
          paymentToPost = balanceCapExempt ? Math.round(remaining * 100) / 100 : Math.min(Math.round(remaining * 100) / 100, item.currentBalance);
        }

        remaining = Math.max(Math.round((remaining - paymentToPost) * 100) / 100, 0);
      }

      return {
        ...item,
        allocationBase: masterPaymentAllocationMethodInput === "manual" ? "manual" : "current-balance",
        allocationPercent:
          totalEligibleBalance > 0 && item.allocationEligible
            ? (item.allocationWeight / totalEligibleBalance) * 100
            : 0,
        paymentToPost,
        expectedBalance: balanceCapExempt ? item.currentBalance : Math.max(item.currentBalance - Math.min(paymentToPost, item.currentBalance), 0),
        allocationExceedsBalance: balanceCapExempt ? false : paymentToPost > item.currentBalance + 0.005,
      };
    });
  }

  function masterPaymentAllocationTotalValue(): number {
    return masterPaymentAllocationRows().reduce(
      (sum: number, item: any) => sum + (Number(item?.paymentToPost) || 0),
      0
    );
  }

  function masterPaymentUnallocatedAmountValue(): number {
    return Math.round((masterPaymentPreviewAmountValue() - masterPaymentAllocationTotalValue()) * 100) / 100;
  }

  function masterPaymentAllocationHasOverage(): boolean {
    return masterPaymentAllocationRows().some((item: any) => !!item.allocationExceedsBalance);
  }

  function masterPaymentSelectedOnlyHasEligibleSelection(): boolean {
    if (!masterPaymentSelectedOnlyInput) return true;
    if (isMasterPaymentBalanceCapExemptTransactionType(masterPaymentTransactionTypeInput)) {
      return masterPaymentAllocationRows().some((item: any) => item.selected);
    }
    return masterPaymentAllocationRows().some((item: any) => item.selected && item.currentBalance > 0);
  }

  function masterPaymentAllocationValidationMessage(): string {
    const amount = masterPaymentPreviewAmountValue();
    const allocated = masterPaymentAllocationTotalValue();

    if (amount <= 0) return "Enter a payment amount before allocating.";
    const balanceCapExempt = isMasterPaymentBalanceCapExemptTransactionType(masterPaymentTransactionTypeInput);

    if (isMasterPaymentDirectProviderTransactionType(masterPaymentTransactionTypeInput)) {
      const selectedCount = masterPaymentAllocationRows().filter((item: any) => item.selected).length;
      if (selectedCount !== 1) return "Select exactly one child matter for Direct Pay to Provider (Pre-suit).";
    }
    if (masterPaymentSelectedOnlyHasEligibleSelection() === false) {
      return balanceCapExempt ? "Select at least one child matter for this interest or cost-recovery payment." : "Select at least one child matter with an open balance.";
    }
    if (masterPaymentAllocationHasOverage()) return "One or more allocations exceed the child matter's current balance.";
    if (Math.abs(allocated - amount) >= 0.005) {
      return `Allocate the full payment amount before posting.  Allocated: ${money(allocated)} / Payment Amount: ${money(amount)}.`;
    }

    return "";
  }

  function masterPaymentRequiredFieldsComplete(): boolean {
    return (
      masterPaymentPreviewAmountValue() > 0 &&
      !!String(masterPaymentDateInput || "").trim() &&
      !!String(masterPaymentTransactionTypeInput || "").trim() &&
      !!String(masterPaymentTransactionStatusInput || "").trim() &&
      !!String(masterPaymentCheckDateInput || "").trim() &&
      !!String(masterPaymentCheckNumberInput || "").trim()
    );
  }

  function masterPaymentAllocationComplete(): boolean {
    return !masterPaymentAllocationValidationMessage();
  }

  function masterPaymentSubmitDisabled(): boolean {
    return masterPaymentPosting || !masterPaymentRequiredFieldsComplete() || !masterPaymentAllocationComplete();
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
            sourceClaimAmount: claimAmount,
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

  async function handleVoidMasterPaymentReceipt(receipt: any) {
    const receiptId = Number(receipt?.id || 0);
    const matterId = Number(receipt?.sourceMatterId || receipt?.matterId || 0);
    const expectedDisplayNumber = clean(receipt?.sourceDisplayNumber || receipt?.displayNumber);
    const claimAmount = Number(receipt?.sourceClaimAmount || receipt?.claimAmount || receipt?.claim_amount || 0);
    const amount = Number(receipt?.paymentAmount || 0);

    if (!receiptId || !matterId) {
      setMasterPaymentPostResult({ ok: false, error: "Could not identify the child payment receipt to void." });
      return;
    }

    if (receipt?.voided) {
      setMasterPaymentPostResult({ ok: false, error: "This payment receipt is already voided." });
      return;
    }

    const confirmed = await bmConfirm(
      `Void receipt #${receiptId} for ${money(amount)} from ${expectedDisplayNumber || "this child matter"}?`
    );
    if (!confirmed) return;

    setMasterPaymentVoidLoadingId(receiptId);
    setMasterPaymentPostResult(null);

    try {
      const response = await fetch("/api/matters/apply-payment", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptId,
          matterId,
          expectedDisplayNumber,
          claimAmount,
          voidReason: `Voided from master lawsuit ${clean(value) || "payment"} screen`,
          voidedBy: "Barsh Matters UI",
        }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Payment receipt could not be voided.");
      }

      if (json?.after) {
        setRows((currentRows: any[]) =>
          currentRows.map((row: any) => {
            const rowMatterId = Number(row?.matterId || row?.matter_id || row?.id || 0);
            if (rowMatterId !== matterId) return row;

            return {
              ...row,
              paymentVoluntary: json.after.paymentVoluntary,
              payment_voluntary: json.after.paymentVoluntary,
              balancePresuit: json.after.balancePresuit,
              balance_presuit: json.after.balancePresuit,
            };
          })
        );
      }

      setMasterPaymentPostResult({
        ok: true,
        action: "void-payment",
        message: `Voided receipt #${receiptId} for ${money(json?.paymentVoided || amount)}.`,
        result: json,
      });

      await loadMasterPaymentReceipts();
    } catch (error: any) {
      setMasterPaymentPostResult({
        ok: false,
        action: "void-payment",
        error: error?.message || String(error),
      });
    } finally {
      setMasterPaymentVoidLoadingId(null);
    }
  }

  async function postMasterPaymentLocally() {
    setMasterPaymentPostResult(null);

    const amount = masterPaymentPreviewAmountValue();
    if (!Number.isFinite(amount) || amount <= 0) {
      setMasterPaymentPostResult({ ok: false, error: "Enter a valid lawsuit payment amount greater than $0.00." });
      return;
    }

    if (!masterPaymentRequiredFieldsComplete()) {
      setMasterPaymentPostResult({ ok: false, error: "Complete all required payment fields before posting." });
      return;
    }

    const allocations = masterPaymentAllocationRows().filter((item) => item.paymentToPost > 0.005);
    if (allocations.length === 0) {
      setMasterPaymentPostResult({ ok: false, error: "No eligible bill balance was found for this lawsuit payment." });
      return;
    }

    const allocationValidationMessage = masterPaymentAllocationValidationMessage();
    if (allocationValidationMessage) {
      setMasterPaymentPostResult({
        ok: false,
        error: allocationValidationMessage,
      });
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
            postingContext: "lawsuit-allocation",
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
      setMasterPaymentClosePromptOpen(true);
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
  const settlementCommitButtonGreenMarker = "data-barsh-settlement-commit-button-green-marker: Record Settlement uses the same solid green action styling as other primary green buttons";
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
  const settlementCalculateCommitMarker = "data-barsh-settlement-calculate-commit-marker: Record Settlement calculates local preview internally before saving";
  const settlementPopupBottomButtonsMarker = "data-barsh-settlement-popup-bottom-buttons-marker: Cancel | Clear | Record Settlement";
  const settlementCommitFlowMarker = "data-barsh-settlement-commit-flow-marker: Cancel | Clear | Record Settlement | internal-preview | tickler | document-dialog";
  const [masterSettlementFormOpen, setMasterSettlementFormOpen] = useState(false);
  const [masterSettlementGrossInput, setMasterSettlementGrossInput] = useState("");
  const [masterSettlementWithInput, setMasterSettlementWithInput] = useState("");
  const [masterSettlementContacts, setMasterSettlementContacts] = useState<any[]>([]);
  const [masterSettlementContactsLoading, setMasterSettlementContactsLoading] = useState(false);
  const [masterSettlementContactsError, setMasterSettlementContactsError] = useState("");
  const [masterSettlementDateInput, setMasterSettlementDateInput] = useState(() => masterPaymentTodayInput());
  const [masterSettlementPaymentExpectedDateInput, setMasterSettlementPaymentExpectedDateInput] = useState(() => addDaysToDateInput(masterPaymentTodayInput(), 45));
  const [masterSettlementPrincipalFeePercentInput, setMasterSettlementPrincipalFeePercentInput] = useState("");
  const [masterSettlementInterestAmountInput, setMasterSettlementInterestAmountInput] = useState("");
  const [masterSettlementSettledInterestInput, setMasterSettlementSettledInterestInput] = useState("");
  const [masterSettlementCostsInput, setMasterSettlementCostsInput] = useState("");
  const [masterSettlementAttorneyFeeOverrides, setMasterSettlementAttorneyFeeOverrides] = useState<Record<string, string>>({});
  const [masterSettlementInterestFeePercentInput, setMasterSettlementInterestFeePercentInput] = useState("");
  // data-barsh-normalize-settlement-amount-percent-threshold-open-effect
  useEffect(() => {
    if (!masterSettlementFormOpen) return;

    setMasterSettlementGrossInput((current) => {
      if (!masterSettlementAmountOrPercentShouldUsePercent(current) && !masterSettlementBareNumericInput(current)) return current;
      const normalized = formatMasterSettlementAmountOrPercentInput(current);
      return normalized || current;
    });

    setMasterSettlementInterestAmountInput((current) => {
      if (!masterSettlementAmountOrPercentShouldUsePercent(current) && !masterSettlementBareNumericInput(current)) return current;
      const normalized = formatMasterSettlementAmountOrPercentInput(current);
      return normalized || current;
    });
  }, [masterSettlementFormOpen]);

  // data-barsh-normalize-settlement-percent-open-effect
  useEffect(() => {
    if (!masterSettlementFormOpen) return;

    setMasterSettlementPrincipalFeePercentInput((current) => {
      if (!shouldNormalizeDisplayedSettlementPercent(current)) return current;
      const normalized = formatMasterSettlementPercentInput(current);
      return normalized || current;
    });

    setMasterSettlementInterestFeePercentInput((current) => {
      if (!shouldNormalizeDisplayedSettlementPercent(current)) return current;
      const normalized = formatMasterSettlementPercentInput(current);
      return normalized || current;
    });
  }, [masterSettlementFormOpen]);


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
  const masterHasActiveRecordedSettlement = Boolean(
    masterSettlementHistory?.activeRecordId ||
      (
        masterSettlementHistory?.ok &&
        Array.isArray(masterSettlementHistory.records) &&
        masterSettlementHistory.records.some((record: any) => !record?.voided)
      )
  );

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
  const [masterSettlementUploadNotice, setMasterSettlementUploadNotice] = useState("");
  const [masterSettlementEmailNotice, setMasterSettlementEmailNotice] = useState("");
  const [masterSettlementVoidLoading, setMasterSettlementVoidLoading] = useState(false);
  const [masterSettlementVoidNotice, setMasterSettlementVoidNotice] = useState("");
  const [masterFinalizePreview, setMasterFinalizePreview] = useState<any>(null);
  const [masterFinalizeUploadLoading, setMasterFinalizeUploadLoading] = useState(false);
  const [masterFinalizeUploadResult, setMasterFinalizeUploadResult] = useState<any>(null);
  const [masterDocumentPrintQueueLoading, setMasterDocumentPrintQueueLoading] = useState(false);
  const [masterDocumentPrintQueueResult, setMasterDocumentPrintQueueResult] = useState<any>(null);
  const [masterDocumentPrintResult, setMasterDocumentPrintResult] = useState<any>(null);
  const [masterClioDocumentsLoading, setMasterClioDocumentsLoading] = useState(false);
  const [masterClioDocumentsResult, setMasterClioDocumentsResult] = useState<any>(null);
  const [masterViewDocumentsPopupOpen, setMasterViewDocumentsPopupOpen] = useState(false);
  const [masterFiledReloadKey, setMasterFiledReloadKey] = useState(0);
  const [masterSelectedViewDocumentId, setMasterSelectedViewDocumentId] = useState("");

  const [masterDocumentDataPreview, setMasterDocumentDataPreview] = useState<any>(null);
  const [masterDocumentGenerationPopupOpen, setMasterDocumentGenerationPopupOpen] = useState(false);
  const [masterDocumentDeliveryPopupOpen, setMasterDocumentDeliveryPopupOpen] = useState(false);
  const [masterSettlementEmailPreviewPopupOpen, setMasterSettlementEmailPreviewPopupOpen] = useState(false);
  const [masterDocumentDeliveryPreview, setMasterDocumentDeliveryPreview] = useState<any>(null);
  const [masterDocumentDeliveryPreviewLoading, setMasterDocumentDeliveryPreviewLoading] = useState(false);
  const [masterDocumentDraftCreateLoading, setMasterDocumentDraftCreateLoading] = useState(false);
  const [masterDocumentDeliveryToOverride, setMasterDocumentDeliveryToOverride] = useState("");
  const [masterDocumentHistoryPopupOpen, setMasterDocumentHistoryPopupOpen] = useState(false);
  const [masterDocumentHistoryLoading, setMasterDocumentHistoryLoading] = useState(false);
  const [masterDocumentHistoryError, setMasterDocumentHistoryError] = useState("");
  const [masterDocumentHistoryResult, setMasterDocumentHistoryResult] = useState<any>(null);
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

  useEffect(() => {
    if (!masterDocumentGenerationPopupOpen) return;

    let cancelled = false;

    async function loadMasterDocumentRepositoryTemplates() {
      setMasterDocumentRepositoryTemplatesLoading(true);
      setMasterDocumentRepositoryTemplatesError("");

      try {
        const response = await fetch(`/api/documents/templates?ts=${Date.now()}`, { cache: "no-store" });
        const json = await response.json().catch(() => null);

        if (!response.ok || !json) {
          throw new Error(json?.error || "Document-template repository lookup failed.");
        }

        const templates =
          Array.isArray(json.templates) ? json.templates :
          Array.isArray(json.documentTemplates) ? json.documentTemplates :
          Array.isArray(json.items) ? json.items :
          Array.isArray(json.results) ? json.results :
          Array.isArray(json) ? json :
          [];

        if (!cancelled) {
          setMasterDocumentRepositoryTemplates(templates);
        }
      } catch (error: any) {
        if (!cancelled) {
          setMasterDocumentRepositoryTemplates([]);
          setMasterDocumentRepositoryTemplatesError(error?.message || String(error));
        }
      } finally {
        if (!cancelled) {
          setMasterDocumentRepositoryTemplatesLoading(false);
        }
      }
    }

    loadMasterDocumentRepositoryTemplates();

    return () => {
      cancelled = true;
    };
  }, [masterDocumentGenerationPopupOpen]);

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

  function masterViewDocumentListDisplayName(doc: any): string {
    const raw = masterDocumentPreviewText(doc?.latestDocumentVersion?.filename) || masterDocumentPreviewText(doc?.clioDocumentFilename) || masterDocumentPreviewText(doc?.clioDocumentName);
    if (!raw) return "Untitled";
    const parts = raw.split(" - ").map((part) => part.trim()).filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : raw;
  }

  function formatMasterDocumentUploadedSavedDate(value: unknown): string {
    const raw = masterDocumentPreviewText(value);
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

  function openMasterFiledTreeDocument(doc: FiledDoc): void {
    const id = clean((doc as any)?.clioDocumentId);
    if (!id) return;
    const displayName = clean((doc as any)?.fileName) || clean((doc as any)?.titleLabel) || "Document";
    const params = new URLSearchParams();
    params.set("documentId", id);
    params.set("filename", displayName);
    params.set("mode", displayName.toLowerCase().endsWith(".eml") ? "email-pdf" : "inline");
    window.open("/api/documents/clio-document-open?" + params.toString(), "_blank", "noopener,noreferrer");
  }

  async function removeMasterFiledTreeDocument(doc: FiledDoc): Promise<void> {
    if (!(doc as any)?.id) return;
    if (!(await bmConfirm(`Delete "${(doc as any).titleLabel}"?`))) return;
    try {
      const res = await fetch(`/api/documents/filed?id=${encodeURIComponent((doc as any).id)}`, { method: "DELETE" });
      const j = await res.json().catch(() => null);
      if (j?.ok) setMasterFiledReloadKey((k) => k + 1);
      else void bmAlert(j?.error || "Could not delete the document.");
    } catch {
      void bmAlert("Delete request failed.");
    }
  }

  function renderMasterEmailComposePopup() {
    if (!masterEmailComposeOpen) return null;
    const masterId = currentMasterLawsuitIdForDocumentPreview();
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New email"
        onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setMasterEmailComposeOpen(false); } }}
        tabIndex={-1}
        style={{ position: "fixed", inset: 0, zIndex: 50000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(15, 23, 42, 0.5)" }}
        data-barsh-master-email-compose-popup="true"
      >
        <div onClick={(event) => event.stopPropagation()} style={{ width: "min(760px, 96vw)", maxHeight: "90vh", overflow: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#0078d4", color: "#fff", borderTopLeftRadius: 6, borderTopRightRadius: 6, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>New email</span>
            <button type="button" onClick={() => setMasterEmailComposeOpen(false)} aria-label="Close" style={{ background: "transparent", border: "none", color: "#fff", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>×</button>
          </div>
          <div style={{ background: "#fff", borderBottomLeftRadius: 6, borderBottomRightRadius: 6, padding: 12 }}>
            <MatterEmailCompose masterLawsuitId={masterId} displayNumber={masterId} initialSubject={buildMasterEmailSubject()} onSent={() => { /* keep open for follow-up sends */ }} />
          </div>
        </div>
      </div>
    );
  }

  function renderMasterViewDocumentsPopup() {
    if (masterViewDocumentsPopupOpen === false) return null;

    const docs = masterClioDocumentsArray();
    const selectedDoc = selectedMasterViewDocument();
    const masterLawsuitIdForTree = currentMasterLawsuitIdForDocumentPreview();

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="View Lawsuit Documents"
        tabIndex={-1}
        onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeMasterViewDocumentsPopup(); } }}
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
            overflow: "hidden",
            border: "1px solid #00346e",
            borderRadius: 18,
            background: "#ffffff",
            boxShadow: "0 28px 90px rgba(15, 23, 42, 0.34)",
          }}
        >
          <div style={{ padding: "16px 20px", background: "#00346e", color: "#ffffff", textAlign: "center", borderTopLeftRadius: 18, borderTopRightRadius: 18 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 950, color: "#ffffff" }}>View Lawsuit Documents</h2>
          </div>

          <div style={{ padding: 20, display: "grid", gap: 14, maxHeight: "calc(88vh - 154px)", overflowY: "auto" }}>
            {/* BM folder tree: the lawsuit's own documents + a folder per child matter. */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#ffffff", padding: 14 }}>
              {masterLawsuitIdForTree ? (
                <LawsuitDocuments
                  masterLawsuitId={masterLawsuitIdForTree}
                  reloadKey={masterFiledReloadKey}
                  onOpenDoc={openMasterFiledTreeDocument}
                  onRemoveDoc={removeMasterFiledTreeDocument}
                />
              ) : (
                <div style={{ color: "#385a83", fontSize: 13, fontWeight: 800 }}>
                  Could not resolve this lawsuit for the document tree.
                </div>
              )}
            </div>

            {masterClioDocumentsResult?.ok === false && (
              <div style={{ padding: 12, border: "1px solid #fecaca", borderRadius: 10, background: "#fef2f2", color: "#991b1b", fontWeight: 850 }}>
                {masterDocumentPreviewText(masterClioDocumentsResult.error) || "Could not load Clio documents."}
              </div>
            )}

            {masterClioDocumentsLoading && (
              <div style={{ padding: 12, border: "1px solid #cbd5e1", borderRadius: 10, background: "#f8fafc", color: "#385a83", fontWeight: 800 }}>Loading documents from Clio...</div>
            )}

            {masterClioDocumentsResult?.ok && docs.length === 0 && (
              <div style={{ padding: 12, border: "1px dashed #cbd5e1", borderRadius: 10, background: "#f8fafc", color: "#385a83", fontWeight: 800 }}>No documents are currently listed in Barsh Matters Master Repository storage.</div>
            )}

            {docs.length > 0 && (
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                {docs.map((doc: any) => {
                  const id = masterDocumentPreviewText(doc.clioDocumentId);
                  const displayName = masterViewDocumentListDisplayName(doc);
                  const contentType = masterDocumentPreviewText(doc.latestDocumentVersion?.contentType).toLowerCase();
                  const opensInline = displayName.toLowerCase().endsWith(".pdf") || contentType.includes("pdf");
                  const opensEmail = displayName.toLowerCase().endsWith(".eml") || contentType.includes("message/rfc822") || contentType.includes("eml");
                  const opensWord = displayName.toLowerCase().endsWith(".docx") || displayName.toLowerCase().endsWith(".doc") || contentType.includes("word") || contentType.includes("docx") || contentType.includes("msword");
                  const selected = Boolean(id) && id === masterSelectedViewDocumentId;
                  return (
                    <button key={id || masterDocumentPreviewText(doc.clioDocumentName)} type="button" title={opensInline ? "Select and open PDF in a new tab." : opensEmail ? "Select and open email as PDF." : opensWord ? "Select and open document in Word." : "Select document."} onClick={() => { if (!id) return; setMasterSelectedViewDocumentId(id); const params = new URLSearchParams(); params.set("documentId", id); params.set("filename", displayName); if (opensInline) { params.set("mode", "inline"); window.open("/api/documents/clio-document-open?" + params.toString(), "_blank", "noopener,noreferrer"); return; } if (opensEmail) { params.set("mode", "email-pdf"); window.open("/api/documents/clio-document-open?" + params.toString(), "_blank", "noopener,noreferrer"); return; } if (opensWord) { params.set("mode", "edit"); const editUrl = window.location.origin + "/api/documents/clio-document-open?" + params.toString(); window.location.href = "ms-word:ofe|u|" + editUrl; return; } }} style={{ display: "block", width: "100%", textAlign: "left", border: 0, borderBottom: "1px solid #e5e7eb", background: selected ? "#eff6ff" : "#ffffff", color: "#00346e", padding: 12, cursor: id ? "pointer" : "not-allowed", opacity: id ? 1 : 0.6 }}>
                      <div style={{ fontWeight: 950 }}>{displayName}</div>
                      <div style={{ marginTop: 4, color: "#385a83", fontSize: 12, fontWeight: 700 }}>
                        Uploaded/Saved: {formatMasterDocumentUploadedSavedDate(doc.updatedAt || doc.latestDocumentVersion?.updatedAt)}
                      </div>
                      <div style={{ marginTop: 4, color: "#385a83", fontSize: 12, fontWeight: 850 }}>
                        Source: {masterDocumentPreviewText(doc.sourceLabel) || masterDocumentPreviewText(doc.sourceClioDisplayNumber) || "—"}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#f8fafc", padding: 14 }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 950, color: "#00346e" }}>Selected Document</h3>
              {selectedDoc ? (
                <div style={{ display: "grid", gap: 8, color: "#385a83", fontSize: 13, fontWeight: 800 }}>
                  <div><strong>Source:</strong> {masterDocumentPreviewText(selectedDoc.sourceLabel) || "—"}</div>
                  <div><strong>Source Matter:</strong> {masterDocumentPreviewText(selectedDoc.sourceClioDisplayNumber) || "—"}</div>
                  <div><strong>Filename:</strong> {masterViewDocumentListDisplayName(selectedDoc)}</div>
                  <div><strong>Updated:</strong> {formatMasterDocumentUploadedSavedDate(selectedDoc.updatedAt || selectedDoc.latestDocumentVersion?.updatedAt)}</div>
                </div>
              ) : (
                <div style={{ color: "#385a83", fontSize: 13, fontWeight: 800 }}>Select a document to view its stored Clio source metadata.</div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 20px 18px", borderTop: "1px solid #e2e8f0", background: "#ffffff", borderBottomLeftRadius: 18, borderBottomRightRadius: 18 }}>
            <button type="button" onClick={closeMasterViewDocumentsPopup} disabled={masterClioDocumentsLoading} style={{ minWidth: 96, height: 38, border: "1px solid #dc2626", borderRadius: 10, background: masterClioDocumentsLoading ? "#fca5a5" : "#dc2626", color: masterClioDocumentsLoading ? "#ffffff" : "#ffffff", fontWeight: 900, cursor: masterClioDocumentsLoading ? "not-allowed" : "pointer" }}>Close</button>
            <button type="button" onClick={() => void loadMasterClioDocuments()} disabled={masterClioDocumentsLoading} style={{ minWidth: 148, height: 38, border: "1px solid #00346e", borderRadius: 10, background: masterClioDocumentsLoading ? "#93c5fd" : "#00346e", color: "#ffffff", fontWeight: 900, cursor: masterClioDocumentsLoading ? "not-allowed" : "pointer" }}>{masterClioDocumentsLoading ? "Refreshing..." : "Refresh Documents"}</button>
          </div>
        </div>
      </div>
    );
  }

  function masterInfoDisplayValue(field: string, fallback: any): string {
    const override = masterInfoOverrides[field];
    const raw = override !== undefined ? override : clean(fallback);
    // Normalize provider/client capitalization at display so all-caps stored names render properly
    // (system-wide provider name casing — same normalizer used on the matter page and in documents).
    if (field === "provider") return normalizeProviderName(raw) || "—";
    return raw || "—";
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
    const local: any = masterLawsuitMetadata || {};
    const options = local?.lawsuitOptions && typeof local.lawsuitOptions === "object" && !Array.isArray(local.lawsuitOptions)
      ? local.lawsuitOptions
      : {};

    const candidatesByField: Record<string, string[]> = {
      filingFee: ["filingFee", "indexFee", "filing_fee", "index_fee"],
      filingFeeEntryDate: ["filingFeeEntryDate", "filing_fee_entry_date", "indexFeeEntryDate", "index_fee_entry_date"],
      filingFeeEntryAmount: ["filingFeeEntryAmount", "filing_fee_entry_amount", "indexFeeEntryAmount", "index_fee_entry_amount"],
      filingFeeEntryHistory: ["filingFeeEntryHistory", "filing_fee_entry_history", "indexFeeEntryHistory", "index_fee_entry_history"],
      serviceFee: ["serviceFee", "service_fee"],
      serviceFeeEntryDate: ["serviceFeeEntryDate", "service_fee_entry_date"],
      serviceFeeEntryAmount: ["serviceFeeEntryAmount", "service_fee_entry_amount"],
      serviceFeeEntryHistory: ["serviceFeeEntryHistory", "service_fee_entry_history"],
      otherCourtCosts: ["otherCourtCosts", "otherCourtFees", "other_court_costs", "other_court_fees"],
      otherCourtCostsEntryDate: ["otherCourtCostsEntryDate", "otherCourtFeesEntryDate", "other_court_costs_entry_date", "other_court_fees_entry_date"],
      otherCourtCostsEntryAmount: ["otherCourtCostsEntryAmount", "otherCourtFeesEntryAmount", "other_court_costs_entry_amount", "other_court_fees_entry_amount"],
      otherCourtCostsEntryHistory: ["otherCourtCostsEntryHistory", "otherCourtFeesEntryHistory", "other_court_costs_entry_history", "other_court_fees_entry_history"],
    };

    const candidates = candidatesByField[field] || [field];

    for (const key of candidates) {
      const optionValue = clean(options?.[key]);
      if (optionValue) return optionValue;
    }

    for (const key of candidates) {
      const localValue = clean(local?.[key]);
      if (localValue) return localValue;
    }

    return "";
  }

  function masterDetailedStatusDisplayValue(): string {
    const options = masterLawsuitOptions();
    return (
      clean(options?.status) ||
      clean(options?.matterStatus) ||
      clean(options?.matter_status) ||
      clean(options?.workflowStatus) ||
      clean(options?.workflow_status) ||
      "—"
    );
  }

  function masterFinalStatusDisplayValue(): "Open" | "Closed" {
    const options = masterLawsuitOptions();
    const rawFinalStatus = clean(options?.finalStatus || options?.final_status).toLowerCase();

    if (rawFinalStatus === "closed") return "Closed";
    if (rawFinalStatus === "open") return "Open";
    if (clean(options?.closeReason || options?.close_reason)) return "Closed";

    return "Open";
  }

  function masterClosedReasonDisplayValue(): string {
    const options = masterLawsuitOptions();
    return clean(options?.closeReason || options?.close_reason) || "—";
  }

  function masterIndexAaaDisplayValue(): string {
    return masterInfoDisplayValue("indexAaaNumber", masterLocalMetadataValue("indexAaaNumber") || "—");
  }

  function masterDateFiledDisplayValue(): string {
    const override = masterInfoOverrides.dateFiled;
    if (override !== undefined) return formatMasterDateDisplay(override);

    return formatMasterDateDisplay(masterLocalMetadataValue("dateFiled") || "—");
  }

  function masterAdversaryAttorneyDisplayValue(): string {
    return masterInfoDisplayValue("adversaryAttorney", masterLocalMetadataValue("adversaryAttorney") || "—");
  }

  function masterCostEntryDateField(field: string): string {
  if (field === "filingFee") return "filingFeeEntryDate";
  if (field === "serviceFee") return "serviceFeeEntryDate";
  if (field === "otherCourtCosts") return "otherCourtCostsEntryDate";
  return "";
}

function masterCostEntryAmountField(field: string): string {
  if (field === "filingFee") return "filingFeeEntryAmount";
  if (field === "serviceFee") return "serviceFeeEntryAmount";
  if (field === "otherCourtCosts") return "otherCourtCostsEntryAmount";
  return "";
}

function masterCostEntryHistoryField(field: string): string {
  if (field === "filingFee") return "filingFeeEntryHistory";
  if (field === "serviceFee") return "serviceFeeEntryHistory";
  if (field === "otherCourtCosts") return "otherCourtCostsEntryHistory";
  return "";
}

function masterCostRecordAmountNumber(value: unknown): number {
  const numeric = Number(String(value ?? "").replace(/[$,%\s,]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

type MasterCostField = "filingFee" | "serviceFee" | "otherCourtCosts";

type MasterCostEntryRecord = {
  amount: string;
  date: string;
  voided?: boolean;
  voidedAt?: string;
  voidReason?: string;
};

function parseMasterCostEntryHistory(value: unknown): MasterCostEntryRecord[] {
  const text = clean(value);
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((row) => ({
        amount: clean(row?.amount),
        date: clean(row?.date),
        voided: Boolean(row?.voided),
        voidedAt: clean(row?.voidedAt),
        voidReason: clean(row?.voidReason),
      }))
      .filter((row) => row.amount && row.date);
  } catch {
    return [];
  }
}

function todayIsoDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

function costEntryDateDisplay(value: unknown): string {
  return formatDateOnlyForDisplay(value);
}

function masterCostEntryRecords(field: MasterCostField): MasterCostEntryRecord[] {
  const entryDateField = masterCostEntryDateField(field);
  const entryAmountField = masterCostEntryAmountField(field);
  const entryHistoryField = masterCostEntryHistoryField(field);

  const historyText = clean(masterInfoOverrides[entryHistoryField] ?? masterLocalMetadataValue(entryHistoryField));
  let history = parseMasterCostEntryHistory(historyText);

  if (!history.length) {
    const legacyDate = clean(masterInfoOverrides[entryDateField] ?? masterLocalMetadataValue(entryDateField));
    const legacyAmount = clean(masterInfoOverrides[entryAmountField] ?? masterLocalMetadataValue(entryAmountField));
    if (legacyDate && legacyAmount) {
      history = [{ amount: legacyAmount, date: legacyDate }];
    }
  }

  return history;
}

function masterCostEntryActiveRecords(field: MasterCostField): MasterCostEntryRecord[] {
  return masterCostEntryRecords(field).filter((row) => !row.voided);
}

function masterCostEntryTotal(field: MasterCostField): number {
  return masterCostEntryActiveRecords(field).reduce((sum, row) => sum + masterCostRecordAmountNumber(row.amount), 0);
}

function masterCostEntryTotalDisplay(field: MasterCostField): string {
  return money(masterCostEntryTotal(field));
}

function masterCostEntryPersistedTotalValue(field: MasterCostField, history: MasterCostEntryRecord[]): string {
  return money(history.filter((row) => !row.voided).reduce((sum, row) => sum + masterCostRecordAmountNumber(row.amount), 0));
}

function masterCostEntryRecordDisplay(field: MasterCostField): string {
  return masterCostEntryRecords(field)
    .map((row) => `${money(masterCostRecordAmountNumber(row.amount))} added ${costEntryDateDisplay(row.date)}${row.voided ? " · VOIDED" : ""}.`)
    .join("\n");
}

function masterCostEntryRecordLines(field: MasterCostField): string[] {
  return masterCostEntryRecordDisplay(field)
    .split("\n")
    .map((line) => clean(line))
    .filter(Boolean);
}

function masterMetadataMoneyDisplayValue(field: "filingFee" | "serviceFee" | "otherCourtCosts"): string {
    const override = masterInfoOverrides[field];
    if (override !== undefined) return override || "$0.00";

    const raw = masterLocalMetadataValue(field);
    const n = Number(String(raw || "").replace(/[^0-9.-]/g, ""));

    return Number.isFinite(n) && n !== 0 ? money(n) : "$0.00";
  }

  function masterStaticLawsuitAmountValue(): number {
    const directAmountSought = Number(
      String(masterLocalMetadataValue("amountSought") || "").replace(/[$,\s]/g, "")
    );
    if (Number.isFinite(directAmountSought) && directAmountSought > 0) return directAmountSought;

    const options = masterLawsuitOptions();

    const optionAmountSought = Number(
      String(options?.amountSought ?? options?.amount_sought ?? "").replace(/[$,\s]/g, "")
    );
    if (Number.isFinite(optionAmountSought) && optionAmountSought > 0) return optionAmountSought;

    const customAmountSought = Number(
      String(options?.customAmountSought ?? options?.custom_amount_sought ?? "").replace(/[$,\s]/g, "")
    );
    if (Number.isFinite(customAmountSought) && customAmountSought > 0) return customAmountSought;

    return masterWorkspaceBillRows(masterSettlementDetailRows).reduce((sum: number, row: any) => {
      return sum + (Number(row?.claimAmount ?? row?.claim_amount ?? row?.amount ?? 0) || 0);
    }, 0);
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
      adversaryAttorney: clean(options?.adversaryAttorney),
      selectedAdversaryAttorneyDetails: options?.selectedAdversaryAttorneyDetails || null,
      filingFee: clean(options?.filingFee),
      serviceFee: clean(options?.serviceFee),
      otherCourtCosts: clean(options?.otherCourtCosts),
      selectedCourtDetails: options?.selectedCourtDetails || null,
      status:
        clean(options?.status) ||
        clean(options?.matterStatus) ||
        clean(options?.matter_status) ||
        clean(options?.workflowStatus) ||
        clean(options?.workflow_status),
      matterStatus:
        clean(options?.matterStatus) ||
        clean(options?.status) ||
        clean(options?.matter_status) ||
        clean(options?.workflowStatus) ||
        clean(options?.workflow_status),
      matter_status:
        clean(options?.matter_status) ||
        clean(options?.matterStatus) ||
        clean(options?.status) ||
        clean(options?.workflowStatus) ||
        clean(options?.workflow_status),
      workflowStatus:
        clean(options?.workflowStatus) ||
        clean(options?.workflow_status) ||
        clean(options?.status) ||
        clean(options?.matterStatus) ||
        clean(options?.matter_status),
      workflow_status:
        clean(options?.workflow_status) ||
        clean(options?.workflowStatus) ||
        clean(options?.status) ||
        clean(options?.matterStatus) ||
        clean(options?.matter_status),
    };

    if (field === "court") {
      payload.venue = after;
      payload.venueSelection = after;
      payload.venueOther = "";
      payload.selectedCourtDetails = selectedCourtDetails || null;
    }

    if (field === "status") {
      payload.status = after;
      payload.matterStatus = after;
      payload.matter_status = after;
      payload.workflowStatus = after;
      payload.workflow_status = after;
    }

    if (field === "indexAaaNumber") payload.indexAaaNumber = after;
    if (field === "dateOfLoss") payload.dateOfLoss = after;
    if (field === "dateFiled") payload.dateFiled = after;
    if (field === "adversaryAttorney") {
      payload.adversaryAttorney = after;
      payload.selectedAdversaryAttorneyDetails = masterInfoSelectedContact?.details || null;
    }
    if (field === "filingFee") payload.filingFee = after;
    if (field === "serviceFee") payload.serviceFee = after;
    if (field === "otherCourtCosts") payload.otherCourtCosts = after;

    const costEntryDateField = masterCostEntryDateField(field);
    const costEntryAmountField = masterCostEntryAmountField(field);
    const costEntryHistoryField = masterCostEntryHistoryField(field);
    const costEntryDateValue = clean(after) ? todayIsoDateOnly() : "";
    const costEntryAmountValue = clean(after) ? after : "";
    const existingCostEntryHistory = costEntryHistoryField
      ? parseMasterCostEntryHistory(masterInfoOverrides[costEntryHistoryField] ?? masterLocalMetadataValue(costEntryHistoryField))
      : [];
    const nextCostEntryHistory =
      costEntryHistoryField && costEntryAmountValue && costEntryDateValue
        ? [...existingCostEntryHistory, { amount: costEntryAmountValue, date: costEntryDateValue }]
        : existingCostEntryHistory;
    const costEntryHistoryValue = costEntryHistoryField ? JSON.stringify(nextCostEntryHistory) : "";
    const costEntryTotalValue = costEntryHistoryField ? masterCostEntryPersistedTotalValue(field as MasterCostField, nextCostEntryHistory) : after;

    if (costEntryHistoryField) {
      payload[field] = costEntryTotalValue;
    }
    if (costEntryDateField) {
      payload[costEntryDateField] = costEntryDateValue;
    }
    if (costEntryAmountField) {
      payload[costEntryAmountField] = costEntryAmountValue;
    }
    if (costEntryHistoryField) {
      payload[costEntryHistoryField] = costEntryHistoryValue;
    }

    setMasterInfoOverrides((current) => ({
      ...current,
      [field]: costEntryHistoryField ? costEntryTotalValue : after,
      ...(costEntryDateField ? { [costEntryDateField]: costEntryDateValue } : {}),
      ...(costEntryAmountField ? { [costEntryAmountField]: costEntryAmountValue } : {}),
      ...(costEntryHistoryField ? { [costEntryHistoryField]: costEntryHistoryValue } : {}),
    }));

    return payload;
  }

  async function voidMasterCostEntry(field: MasterCostField, entryIndex: number) {
    const masterLawsuitId = clean(value);
    if (!masterLawsuitId) {
      alert("Cannot void cost entry because no Master Lawsuit ID is available.");
      return;
    }

    const entries = masterCostEntryRecords(field);
    const target = entries[entryIndex];

    if (!target || target.voided) return;

    const confirmed = await bmConfirm(
      `Void this ${money(masterCostRecordAmountNumber(target.amount))} cost entry from ${costEntryDateDisplay(target.date)}?`
    );
    if (!confirmed) return;

    const nextEntries = entries.map((row, index) =>
      index === entryIndex
        ? {
            ...row,
            voided: true,
            voidedAt: new Date().toISOString(),
            voidReason: "Voided from master cost card",
          }
        : row
    );

    const entryDateField = masterCostEntryDateField(field);
    const entryAmountField = masterCostEntryAmountField(field);
    const entryHistoryField = masterCostEntryHistoryField(field);
    const activeEntries = nextEntries.filter((row) => !row.voided);
    const lastActiveEntry = activeEntries[activeEntries.length - 1] || null;
    const totalValue = masterCostEntryPersistedTotalValue(field, nextEntries);
    const historyValue = JSON.stringify(nextEntries);

    const payload: Record<string, any> = {
      masterLawsuitId,
      [field]: totalValue,
      [entryHistoryField]: historyValue,
      [entryDateField]: lastActiveEntry?.date || "",
      [entryAmountField]: lastActiveEntry?.amount || "",
      status: masterDetailedStatusDisplayValue() === "—" ? "" : masterDetailedStatusDisplayValue(),
      matterStatus: masterDetailedStatusDisplayValue() === "—" ? "" : masterDetailedStatusDisplayValue(),
      matter_status: masterDetailedStatusDisplayValue() === "—" ? "" : masterDetailedStatusDisplayValue(),
      workflowStatus: masterDetailedStatusDisplayValue() === "—" ? "" : masterDetailedStatusDisplayValue(),
      workflow_status: masterDetailedStatusDisplayValue() === "—" ? "" : masterDetailedStatusDisplayValue(),
      venue: masterCourtDisplayValue() === "—" ? "" : masterCourtDisplayValue(),
      venueSelection: masterCourtDisplayValue() === "—" ? "" : masterCourtDisplayValue(),
      venueOther: "",
      indexAaaNumber: masterIndexAaaDisplayValue() === "—" ? "" : masterIndexAaaDisplayValue(),
      adversaryAttorney: masterAdversaryAttorneyDisplayValue() === "—" ? "" : masterAdversaryAttorneyDisplayValue(),
    };

    try {
      const response = await fetch("/api/lawsuits/update-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Cost entry could not be voided.");
      }

      setMasterInfoOverrides((current) => ({
        ...current,
        [field]: totalValue,
        [entryHistoryField]: historyValue,
        [entryDateField]: lastActiveEntry?.date || "",
        [entryAmountField]: lastActiveEntry?.amount || "",
      }));

      setMasterInfoAuditEntries((prev) => [
        {
          id: `${Date.now()}-${field}-void-${entryIndex}`,
          field,
          label: "Void Cost Entry",
          before: `${money(masterCostRecordAmountNumber(target.amount))} added ${costEntryDateDisplay(target.date)}`,
          after: "Voided",
          timestamp: new Date().toLocaleString(),
          details: { field, entryIndex, entry: target },
        },
        ...prev,
      ]);

      await loadMasterLawsuitMetadata();
    } catch (error: any) {
      alert(error?.message || "Cost entry could not be voided.");
    }
  }


  function masterInfoFieldPersistsLocally(field: string): boolean {
    return [
      "court",
      "status",
      "indexAaaNumber",
      "dateFiled",
      "adversaryAttorney",
      "filingFee",
      "serviceFee",
      "otherCourtCosts",
      "filingFeeEntryDate",
      "filingFeeEntryAmount",
      "serviceFeeEntryDate",
      "serviceFeeEntryAmount",
      "otherCourtCostsEntryDate",
      "otherCourtCostsEntryAmount",
      "filingFeeEntryHistory",
      "serviceFeeEntryHistory",
      "otherCourtCostsEntryHistory",
    ].includes(field);
  }

  function masterInfoMoneyNumber(field: string, fallback: any): number {
    const raw = masterInfoDisplayValue(field, fallback);
    const cleaned = String(raw || "").replace(/[^0-9.-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function masterInfoFieldKind(field: string): "contact" | "date" | "money" | "court" | "status" | "text" {
    if (field === "status") return "status";
    if (["provider", "patient", "insurer", "adversaryAttorney"].includes(field)) return "contact";
    if (["court", "venue", "venueSelection"].includes(field)) return "court";
    if (["dateOfLoss", "dateFiled"].includes(field)) return "date";
    if (["filingFee", "serviceFee", "otherCourtCosts"].includes(field)) return "money";

    return "text";
  }

  function masterInfoContactType(field: string): "person" | "insurer_company" | "provider_client" | "adversary_attorney" | "all" {
    if (field === "patient") return "person";
    if (field === "insurer") return "insurer_company";
    if (field === "adversaryAttorney") return "adversary_attorney";
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
    return formatDateOnlyForDisplay(value) || "—";
  }

  function masterInfoDateInputValue(value: any): string {
    const raw = clean(value);
    if (!raw || raw === "—") return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const slashMatch = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (slashMatch) {
      return `${slashMatch[3]}-${slashMatch[1].padStart(2, "0")}-${slashMatch[2].padStart(2, "0")}`;
    }

    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

    return "";
  }

  function openMasterInfoEditDialog(field: string, label: string, currentValue: any) {
    const value = masterInfoDisplayValue(field, currentValue);

    setMasterInfoEditDialog({
      field,
      label,
      currentValue: value,
    });

    // The Current box shows the existing value.  Most editable fields intentionally start blank.
    // Status starts with the current value because it is a controlled picklist.
    setMasterInfoEditValue(field === "status" && value !== "—" ? value : "");
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

  function openMasterCloseLawsuitDialog() {
    const masterLawsuitId = currentMasterLawsuitIdForDocumentPreview();
    if (!masterLawsuitId || masterClosing) return;
    setMasterCloseResult(null);
    setMasterCloseReason("");
    setMasterCloseDialogOpen(true);
  }

  function closeMasterCloseLawsuitDialog() {
    if (masterClosing) return;
    setMasterCloseDialogOpen(false);
    setMasterCloseReason("");
    setMasterCloseResult(null);
  }

  async function handleMasterCloseLawsuit() {
    const masterLawsuitId = currentMasterLawsuitIdForDocumentPreview();
    if (!masterLawsuitId || !masterCloseReason || masterClosing) return;

    setMasterClosing(true);
    setMasterCloseResult(null);

    try {
      const response = await fetch("/api/lawsuits/close", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          masterLawsuitId,
          closeReason: masterCloseReason,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        setMasterCloseResult({
          ok: false,
          error: json?.error || "Close Lawsuit failed.",
          details: json,
        });
        return;
      }

      setMasterCloseResult(json);
      setMasterCloseDialogOpen(false);
      setMasterCloseReason("");
      await loadMasterLawsuitMetadata();
      window.location.reload();
    } catch (error: any) {
      setMasterCloseResult({
        ok: false,
        error: error?.message || String(error),
      });
    } finally {
      setMasterClosing(false);
    }
  }

  // Admin-only: reopen a closed lawsuit; cascades child matters back to Open (local only, no Clio write).
  function handleMasterReopenLawsuit() {
    const masterLawsuitId = currentMasterLawsuitIdForDocumentPreview();
    if (!masterLawsuitId || masterReopening) return;
    void runAdministratorGate("Reopen Lawsuit", async () => {
      if (
        !(await bmConfirm(
          "Reopen this lawsuit? Its child matters will also be reopened (marked Open)."
        ))
      ) {
        return;
      }
      setMasterReopening(true);
      try {
        const response = await fetch("/api/lawsuits/reopen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ masterLawsuitId }),
        });
        const json = await response.json().catch(() => ({ ok: false }));
        if (!response.ok || !json?.ok) {
          alert(json?.error || "Reopen Lawsuit failed.");
          return;
        }
        await loadMasterLawsuitMetadata();
        window.location.reload();
      } catch (error: any) {
        alert(error?.message || "Reopen Lawsuit failed.");
      } finally {
        setMasterReopening(false);
      }
    });
  }

  const masterCloseReasonOptions = [
    "PAID VOLUNTARY",
    "PAID AFTER SETTLEMENT",
    "PAID AFTER JUDGMENT",
    "DISCONTINUED WITH PREJUDICE",
    "DISCONTINUED WITHOUT PREJUDICE",
    "PER CLIENT",
    "ADMIN CLOSE",
  ];


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
      setMasterNotes(parseMasterNotesFromMetadata(json.lawsuit || null));
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
        alert(`Cannot save ${label} because no Master Lawsuit ID is available.`);
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
        alert(json?.error || `${label} could not be saved locally.`);
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

  type MasterNoteEntry = {
    id: string;
    note: string;
    timestamp: string;
    user: string;
    editedAt?: string;
  };

  function parseMasterNotesFromMetadata(lawsuitInput?: any): MasterNoteEntry[] {
    const local: any = lawsuitInput || masterLawsuitMetadata || {};
    const options = local?.lawsuitOptions && typeof local.lawsuitOptions === "object" && !Array.isArray(local.lawsuitOptions) ? local.lawsuitOptions : {};
    const raw = clean(local?.lawsuitNotes) || clean(options?.lawsuitNotes) || clean(options?.notes);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((entry: any, index: number) => ({
          id: clean(entry?.id) || String(Date.now()) + "-" + String(index) + "-note",
          note: clean(entry?.note),
          timestamp: clean(entry?.timestamp) || new Date().toLocaleString(),
          user: clean(entry?.user) || masterNoteUserName(),
          ...(clean(entry?.editedAt) ? { editedAt: clean(entry.editedAt) } : {}),
        }))
        .filter((entry: any) => clean(entry.note));
    } catch {
      return raw ? [{ id: String(Date.now()) + "-legacy-note", note: raw, timestamp: new Date().toLocaleString(), user: masterNoteUserName() }] : [];
    }
  }

  async function persistMasterNotes(nextNotes: MasterNoteEntry[]): Promise<boolean> {
    const masterLawsuitId = clean(value);
    if (kind !== "master" || !masterLawsuitId) {
      alert("Cannot save note because no Master Lawsuit ID is available.");
      return false;
    }

    const local: any = masterLawsuitMetadata || {};
    const options = masterLawsuitOptions();
    const serializedNotes = JSON.stringify(nextNotes);
    const payload = {
      masterLawsuitId,
      venue: clean(local?.venue) || clean(options?.venue),
      venueSelection: clean(local?.venueSelection) || clean(options?.venueSelection),
      venueOther: clean(local?.venueOther) || clean(options?.venueOther),
      indexAaaNumber: clean(local?.indexAaaNumber) || clean(options?.indexAaaNumber),
      adversaryAttorney: clean(options?.adversaryAttorney),
      dateFiled: clean(options?.dateFiled) || clean(local?.dateFiled),
      status: clean(options?.status || options?.matterStatus || options?.workflowStatus),
      amountSoughtMode: clean(local?.amountSoughtMode) || clean(options?.amountSoughtMode),
      customAmountSought: clean(local?.customAmountSought) || clean(options?.customAmountSought),
      lawsuitNotes: serializedNotes,
      notes: serializedNotes,
    };

    const response = await fetch("/api/lawsuits/update-metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });

    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.ok) {
      alert(json?.error || "Note could not be saved locally.");
      return false;
    }

    setMasterLawsuitMetadata(json.lawsuit || null);
    setMasterInfoOverrides((current) => ({ ...current, lawsuitNotes: serializedNotes, notes: serializedNotes }));
    return true;
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
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      const json = await response.json().catch(() => null);

      if (response.ok && json?.ok && json?.authenticated) {
        onAuthorized();
        return;
      }

      const fromPath = `${window.location.pathname}${window.location.search}`;
      window.location.href = `/login?from=${encodeURIComponent(fromPath || "/admin")}`;
    } catch (error: any) {
      alert(error?.message || "Administrator session check failed.");
    }
  }

  function currentMasterCourtDateDefaultCourt() {
    return clean(masterAddCourtDateForm.court);
  }

  function masterCourtDateCourtOptions() {
    return Array.from(new Set(masterAddCourtDateCourtOptions.map((item) => clean(item)).filter(Boolean)));
  }

  const masterAddCourtDateReady =
    Boolean(masterAddCourtDateForm.eventDate) &&
    Boolean(masterAddCourtDateForm.eventTime) &&
    Boolean(masterAddCourtDateForm.appearanceType) &&
    Boolean(masterAddCourtDateForm.court);

  function masterCourtDateTodayKey() {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function masterCourtDateDateKey(courtEvent: any) {
    return clean(courtEvent?.eventDate);
  }

  function masterCourtDateTimeKey(courtEvent: any) {
    return clean(courtEvent?.eventTime) || "00:00";
  }

  function compareMasterCourtDatesSoonest(a: any, b: any) {
    const dateCompare = masterCourtDateDateKey(a).localeCompare(masterCourtDateDateKey(b));
    if (dateCompare !== 0) return dateCompare;
    return masterCourtDateTimeKey(a).localeCompare(masterCourtDateTimeKey(b));
  }

  function compareMasterCourtDatesLatest(a: any, b: any) {
    const dateCompare = masterCourtDateDateKey(b).localeCompare(masterCourtDateDateKey(a));
    if (dateCompare !== 0) return dateCompare;
    return masterCourtDateTimeKey(b).localeCompare(masterCourtDateTimeKey(a));
  }

  function splitMasterCourtDatesByTiming() {
    const today = masterCourtDateTodayKey();
    const upcoming: any[] = [];
    const past: any[] = [];
    for (const courtEvent of masterCourtDatesList) {
      const eventDate = masterCourtDateDateKey(courtEvent);
      if (eventDate && eventDate < today) past.push(courtEvent);
      else upcoming.push(courtEvent);
    }
    upcoming.sort(compareMasterCourtDatesSoonest);
    past.sort(compareMasterCourtDatesLatest);
    return { upcoming, past };
  }

  function renderMasterCourtDateCard(courtEvent: any) {
    return (
      <div key={courtEvent.id || `${courtEvent.eventDate}-${courtEvent.eventTime}-${courtEvent.appearanceType}`} style={{ border: "1px solid #e2e8f0", borderRadius: 10, background: "#ffffff", padding: "7px 8px", display: "grid", gap: 2 }}>
        <div style={{ fontSize: 12, fontWeight: 950, color: "#00346e" }}>{displayDate(courtEvent.eventDate)}{courtEvent.eventTime ? " · " + courtEvent.eventTime : ""} · {clean(courtEvent.appearanceType) || clean(courtEvent.eventType) || "Court Date"}</div>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#385a83" }}>{clean(courtEvent.court || courtEvent.venue) || "—"}{clean(courtEvent.calendarNumber) ? " · Cal. " + clean(courtEvent.calendarNumber) : ""}</div>
      </div>
    );
  }

  function renderMasterCourtDateSection(title: string, courtDates: any[], emptyText: string, marker: string) {
    return (
      <div style={{ display: "grid", gap: 6 }} data-barsh-master-court-dates-section={marker}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 950, color: "#385a83", textTransform: "uppercase", letterSpacing: 0.4 }}>{title}</div>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#385a83" }}>{courtDates.length}</div>
        </div>
        {courtDates.length === 0 ? (
          <div style={{ fontSize: 12, color: "#385a83", fontWeight: 800 }}>{emptyText}</div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {courtDates.map((courtEvent: any) => renderMasterCourtDateCard(courtEvent))}
          </div>
        )}
      </div>
    );
  }

  function masterCourtDateInputDateValue(value: any) {
    const raw = clean(value);
    if (!raw) return "";
    const match = raw.match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : "";
  }

  function masterCourtDateEventKey(courtEvent: any) {
    const rawId = courtEvent?.id;
    const idKey = rawId === null || rawId === undefined ? "" : String(rawId).trim();
    if (idKey) return idKey;
    return [
      masterCourtDateInputDateValue(courtEvent?.eventDate),
      clean(courtEvent?.eventTime),
      clean(courtEvent?.court || courtEvent?.venue),
      clean(courtEvent?.calendarNumber),
      clean(courtEvent?.appearanceType || courtEvent?.eventType),
    ].join("|");
  }

  function masterCourtDateEditFormFromEvent(courtEvent: any) {
    return {
      eventDate: masterCourtDateInputDateValue(courtEvent?.eventDate),
      eventTime: clean(courtEvent?.eventTime) || "09:30",
      court: clean(courtEvent?.court || courtEvent?.venue),
      calendarNumber: clean(courtEvent?.calendarNumber),
      judgeOrArbitrator: clean(courtEvent?.judgeOrArbitrator),
      appearanceType: clean(courtEvent?.appearanceType || courtEvent?.eventType),
      notes: clean(courtEvent?.notes),
    };
  }

  function seedMasterEditCourtDatesForms() {
    const next: Record<string, { eventDate: string; eventTime: string; court: string; calendarNumber: string; judgeOrArbitrator: string; appearanceType: string; notes: string }> = {};
    for (const courtEvent of masterCourtDatesList) {
      const key = masterCourtDateEventKey(courtEvent);
      if (!key) continue;
      next[key] = masterCourtDateEditFormFromEvent(courtEvent);
    }
    setMasterEditCourtDatesForms(next);
  }

  function updateMasterEditCourtDateForm(eventKey: string, field: "eventDate" | "eventTime" | "court" | "calendarNumber" | "judgeOrArbitrator" | "appearanceType" | "notes", value: string) {
    setMasterEditCourtDatesResult(null);
    setMasterEditCourtDatesForms((current) => ({
      ...current,
      [eventKey]: {
        ...(current[eventKey] || { eventDate: "", eventTime: "09:30", court: "", calendarNumber: "", judgeOrArbitrator: "", appearanceType: "", notes: "" }),
        [field]: value,
      },
    }));
  }

  function masterEditCourtDateFormReady(eventKey: string) {
    const selectedEvent = selectedMasterEditCourtDate();
    const fallbackForm = selectedEvent && masterCourtDateEventKey(selectedEvent) === eventKey ? masterCourtDateEditFormFromEvent(selectedEvent) : null;
    const form = masterEditCourtDatesForms[eventKey] || fallbackForm;
    return Boolean(form?.eventDate && form?.eventTime && form?.appearanceType && form?.court);
  }

  function masterEditableCourtDatesInDisplayOrder() {
    const courtDateGroups = splitMasterCourtDatesByTiming();
    return [...courtDateGroups.upcoming, ...courtDateGroups.past];
  }

  function selectedMasterEditCourtDate() {
    if (masterEditCourtDatesSelectedEvent) return masterEditCourtDatesSelectedEvent;
    if (!masterEditCourtDatesSelectedId) return null;
    return masterEditableCourtDatesInDisplayOrder().find((courtEvent: any) => String(courtEvent?.id || "") === masterEditCourtDatesSelectedId) || null;
  }

  function masterCourtDateChoiceLabel(courtEvent: any) {
    return [
      displayDate(courtEvent?.eventDate),
      clean(courtEvent?.eventTime),
      clean(courtEvent?.appearanceType) || clean(courtEvent?.eventType) || "Court Date",
      clean(courtEvent?.court || courtEvent?.venue),
      clean(courtEvent?.calendarNumber) ? "Cal. " + clean(courtEvent?.calendarNumber) : "",
    ].filter(Boolean).join(" · ");
  }

  function openMasterEditCourtDatesDialog() {
    const masterId = currentMasterLawsuitIdForDocumentPreview();
    setMasterEditCourtDatesResult(null);
    setMasterEditCourtDatesSelectedId("");
    setMasterEditCourtDatesSelectedEvent(null);
    seedMasterEditCourtDatesForms();
    setMasterEditCourtDatesDialogOpen(true);
    if (masterId) void loadMasterAddCourtDateCourtOptions(masterId);
  }

  function closeMasterEditCourtDatesDialog() {
    if (masterEditCourtDatesSavingId !== null) return;
    setMasterEditCourtDatesDialogOpen(false);
    setMasterEditCourtDatesSelectedId("");
    setMasterEditCourtDatesSelectedEvent(null);
    setMasterEditCourtDatesResult(null);
  }

  async function saveMasterCourtDateEdit(courtEvent: any) {
    setMasterEditCourtDatesResult(null);
    const selectedEvent = courtEvent || masterEditCourtDatesSelectedEvent || selectedMasterEditCourtDate();
    const eventKey = masterCourtDateEventKey(selectedEvent) || masterEditCourtDatesSelectedId;
    const eventId = eventKey;
    const hasEventId = Boolean(eventId);
    const masterId = currentMasterLawsuitIdForDocumentPreview();
    const form = masterEditCourtDatesForms[eventKey] || (selectedEvent ? masterCourtDateEditFormFromEvent(selectedEvent) : null);
    if (!selectedEvent || !eventKey || !form) {
      setMasterEditCourtDatesResult({ ok: false, error: "Selected appearance could not be saved because the selected appearance is missing." });
      return;
    }
    if (!form.eventDate) {
      setMasterEditCourtDatesResult({ ok: false, error: "Court Date is required." });
      return;
    }
    if (!form.eventTime) {
      setMasterEditCourtDatesResult({ ok: false, error: "Time is required." });
      return;
    }
    if (!form.appearanceType) {
      setMasterEditCourtDatesResult({ ok: false, error: "Appearance Type is required." });
      return;
    }
    if (!form.court) {
      setMasterEditCourtDatesResult({ ok: false, error: "Court is required." });
      return;
    }

    setMasterEditCourtDatesSavingId(eventKey);
    setMasterEditCourtDatesResult(null);
    try {
      const response = await fetch("/api/court-calendar/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: hasEventId ? eventId : null,
          masterLawsuitId: masterId,
          originalEventDate: masterCourtDateInputDateValue(selectedEvent?.eventDate),
          originalEventTime: clean(selectedEvent?.eventTime),
          originalCourt: clean(selectedEvent?.court || selectedEvent?.venue),
          originalCalendarNumber: clean(selectedEvent?.calendarNumber),
          originalAppearanceType: clean(selectedEvent?.appearanceType || selectedEvent?.eventType),
          eventDate: form.eventDate,
          eventTime: form.eventTime || "09:30",
          court: form.court,
          calendarNumber: form.calendarNumber,
          judgeOrArbitrator: form.judgeOrArbitrator,
          appearanceType: form.appearanceType,
          notes: form.notes,
          sourcePage: "matters-master-court-dates",
          sourceAction: "edit-court-date",
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Edit Court Date failed.");
      if (json?.event) setMasterEditCourtDatesSelectedEvent(json.event);
      setMasterEditCourtDatesForms((current) => ({ ...current, [eventKey]: { ...form } }));
      if (masterId) await loadMasterCourtDatesForStatusBox(masterId);
      setMasterEditCourtDatesResult({ ok: true, message: "Appearance changes saved." });
      window.setTimeout(() => {
        setMasterEditCourtDatesDialogOpen(false);
        setMasterEditCourtDatesSelectedId("");
        setMasterEditCourtDatesSelectedEvent(null);
        setMasterEditCourtDatesResult(null);
      }, 900);
    } catch (error: any) {
      setMasterEditCourtDatesResult({ ok: false, error: error?.message || "Edit Court Date failed." });
    } finally {
      setMasterEditCourtDatesSavingId(null);
    }
  }

  function masterCourtDateEditFieldChanged(courtEvent: any, field: "eventDate" | "eventTime" | "court" | "calendarNumber" | "judgeOrArbitrator" | "appearanceType" | "notes") {
    const eventKey = masterCourtDateEventKey(courtEvent);
    const form = masterEditCourtDatesForms[eventKey] || masterCourtDateEditFormFromEvent(courtEvent);
    const original = masterCourtDateEditFormFromEvent(courtEvent);
    return clean(form[field]) !== clean(original[field]);
  }

  function masterCourtDateEditInputStyle(courtEvent: any, field: "eventDate" | "eventTime" | "court" | "calendarNumber" | "judgeOrArbitrator" | "appearanceType" | "notes"): React.CSSProperties {
    const changed = masterCourtDateEditFieldChanged(courtEvent, field);
    return { height: 38, width: "100%", minWidth: 0, boxSizing: "border-box", border: changed ? "2px solid #f97316" : "1px solid #cbd5e1", borderRadius: 10, padding: "0 10px", fontWeight: 800, background: changed ? "#fff7ed" : "#ffffff" };
  }

  function masterCourtDateEditTextareaStyle(courtEvent: any, field: "notes"): React.CSSProperties {
    const changed = masterCourtDateEditFieldChanged(courtEvent, field);
    return { minHeight: 68, width: "100%", minWidth: 0, boxSizing: "border-box", border: changed ? "2px solid #f97316" : "1px solid #cbd5e1", borderRadius: 10, padding: 10, fontWeight: 800, background: changed ? "#fff7ed" : "#ffffff" };
  }

  function renderMasterEditCourtDateRow(courtEvent: any) {
    const eventKey = masterCourtDateEventKey(courtEvent);
    const eventId = eventKey;
    const form = masterEditCourtDatesForms[eventKey] || masterCourtDateEditFormFromEvent(courtEvent);
    const saving = masterEditCourtDatesSavingId === eventKey;
    return (
      <div key={eventKey || `${courtEvent.eventDate}-${courtEvent.eventTime}-${courtEvent.appearanceType}`} style={{ border: "1px solid #e2e8f0", borderRadius: 14, background: "#ffffff", padding: 12, display: "grid", gap: 10, minWidth: 0, overflow: "hidden", boxSizing: "border-box" }} data-barsh-master-edit-court-date-row="true">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, minWidth: 0 }}>
          <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>Court Date<input type="date" required value={form.eventDate} onChange={(event) => updateMasterEditCourtDateForm(eventKey, "eventDate", event.target.value)} style={masterCourtDateEditInputStyle(courtEvent, "eventDate")} /></label>
          <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>Time<input type="time" required value={form.eventTime} onChange={(event) => updateMasterEditCourtDateForm(eventKey, "eventTime", event.target.value)} style={masterCourtDateEditInputStyle(courtEvent, "eventTime")} /></label>
          <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>Appearance Type<select required value={form.appearanceType} onChange={(event) => updateMasterEditCourtDateForm(eventKey, "appearanceType", event.target.value)} style={masterCourtDateEditInputStyle(courtEvent, "appearanceType")} data-barsh-master-edit-court-date-appearance-type-required="true"><option value="">Select Appearance Type</option><option value="Motion">Motion</option><option value="Trial/Arbitration">Trial/Arbitration</option><option value="Conference">Conference</option><option value="Other">Other</option></select></label>
          <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>Court<select required value={form.court} onChange={(event) => updateMasterEditCourtDateForm(eventKey, "court", event.target.value)} style={masterCourtDateEditInputStyle(courtEvent, "court")} data-barsh-master-edit-court-date-court-dropdown="true"><option value="">{masterAddCourtDateCourtOptionsLoading ? "Loading Courts..." : "Select Court"}</option>{masterCourtDateCourtOptions().map((court) => <option key={court} value={court}>{court}</option>)}</select></label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, minWidth: 0 }}>
          <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>Calendar Number<input value={form.calendarNumber} onChange={(event) => updateMasterEditCourtDateForm(eventKey, "calendarNumber", event.target.value)} style={masterCourtDateEditInputStyle(courtEvent, "calendarNumber")} /></label>
          <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>Judge / Arbitrator<input value={form.judgeOrArbitrator} onChange={(event) => updateMasterEditCourtDateForm(eventKey, "judgeOrArbitrator", event.target.value)} style={masterCourtDateEditInputStyle(courtEvent, "judgeOrArbitrator")} /></label>
        </div>
        <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>Notes<textarea value={form.notes} onChange={(event) => updateMasterEditCourtDateForm(eventKey, "notes", event.target.value)} style={masterCourtDateEditTextareaStyle(courtEvent, "notes")} /></label>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={() => void saveMasterCourtDateEdit(courtEvent)} disabled={saving || !masterEditCourtDateFormReady(eventKey)} style={{ minHeight: 34, border: "1px solid #00346e", borderRadius: 999, background: saving || !masterEditCourtDateFormReady(eventKey) ? "#93c5fd" : "#00346e", color: "#ffffff", fontWeight: 950, padding: "0 14px", cursor: saving || !masterEditCourtDateFormReady(eventKey) ? "not-allowed" : "pointer" }} data-barsh-master-edit-court-date-save-button="true">{saving ? "Saving..." : "Save Changes"}</button>
        </div>
      </div>
    );
  }

  function resetMasterAddCourtDateForm(defaultCourt = "") {
    setMasterAddCourtDateResult(null);
    setMasterAddCourtDateForm({ eventDate: "", eventTime: "09:30", court: clean(defaultCourt), calendarNumber: "", judgeOrArbitrator: "", appearanceType: "", notes: "" });
  }

  async function loadMasterCourtDatesForStatusBox(masterId: string) {
    const cleanMasterId = clean(masterId);
    if (!cleanMasterId) return;
    setMasterCourtDatesListLoading(true);
    setMasterCourtDatesListError("");
    try {
      const response = await fetch("/api/court-calendar/events?masterLawsuitId=" + encodeURIComponent(cleanMasterId) + "&status=all", { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Court Dates could not be loaded.");
      const events = Array.isArray(json?.events) ? json.events : [];
      events.sort((a: any, b: any) => {
        const dateCompare = clean(b?.eventDate).localeCompare(clean(a?.eventDate));
        if (dateCompare !== 0) return dateCompare;
        return clean(b?.eventTime).localeCompare(clean(a?.eventTime));
      });
      setMasterCourtDatesList(events);
    } catch (error: any) {
      setMasterCourtDatesListError(error?.message || "Court Dates could not be loaded.");
      setMasterCourtDatesList([]);
    } finally {
      setMasterCourtDatesListLoading(false);
    }
  }

  async function loadMasterAddCourtDateCourtOptions(masterId: string) {
    setMasterAddCourtDateCourtOptionsLoading(true);
    try {
      const response = await fetch("/api/court-calendar/filter-options?masterLawsuitId=" + encodeURIComponent(masterId), { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      const options = Array.isArray(json?.venues) ? json.venues.map((item: any) => clean(item)).filter(Boolean) : [];
      const defaultCourt = clean(json?.defaultCourt || json?.defaultVenue);
      const merged = Array.from(new Set([defaultCourt, ...options, "Nassau County District Court", "Suffolk County District Court", "New York City Civil Court", "AAA", "Other"].map((item) => clean(item)).filter(Boolean)));
      setMasterAddCourtDateCourtOptions(merged);
      setMasterAddCourtDateForm((prev) => ({ ...prev, court: clean(prev.court) || defaultCourt || merged[0] || "" }));
    } catch (error: any) {
      setMasterAddCourtDateResult({ ok: false, error: error?.message || "Could not load court options." });
      setMasterAddCourtDateCourtOptions(["Nassau County District Court", "Suffolk County District Court", "New York City Civil Court", "AAA", "Other"]);
    } finally {
      setMasterAddCourtDateCourtOptionsLoading(false);
    }
  }

  function openMasterAddCourtDateDialog() {
    const masterId = currentMasterLawsuitIdForDocumentPreview();
    resetMasterAddCourtDateForm();
    setMasterAddCourtDateDialogOpen(true);
    if (masterId) void loadMasterAddCourtDateCourtOptions(masterId);
  }

  function closeMasterAddCourtDateDialog() {
    if (masterAddCourtDateSaving) return;
    setMasterAddCourtDateDialogOpen(false);
    setMasterAddCourtDateResult(null);
  }

  async function submitMasterAddCourtDate(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const masterId = currentMasterLawsuitIdForDocumentPreview();
    if (!masterId) {
      setMasterAddCourtDateResult({ ok: false, error: "No master lawsuit is selected." });
      return;
    }
    if (!masterAddCourtDateForm.eventDate) {
      setMasterAddCourtDateResult({ ok: false, error: "Court Date is required." });
      return;
    }
    if (!masterAddCourtDateForm.eventTime) {
      setMasterAddCourtDateResult({ ok: false, error: "Time is required." });
      return;
    }
    if (!masterAddCourtDateForm.appearanceType) {
      setMasterAddCourtDateResult({ ok: false, error: "Appearance Type is required." });
      return;
    }
    if (!masterAddCourtDateForm.court) {
      setMasterAddCourtDateResult({ ok: false, error: "Court is required." });
      return;
    }
    setMasterAddCourtDateSaving(true);
    setMasterAddCourtDateResult(null);
    try {
      const response = await fetch("/api/court-calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterLawsuitId: masterId,
          displayNumber: masterId,
          eventType: "appearance",
          eventDate: masterAddCourtDateForm.eventDate,
          eventTime: masterAddCourtDateForm.eventTime || "09:30",
          court: masterAddCourtDateForm.court,
          calendarNumber: masterAddCourtDateForm.calendarNumber,
          judgeOrArbitrator: masterAddCourtDateForm.judgeOrArbitrator,
          appearanceType: masterAddCourtDateForm.appearanceType,
          notes: masterAddCourtDateForm.notes,
          sourcePage: "matters-master-court-dates",
          sourceAction: "add-new-court-date",
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Add New Court Date failed.");
      setMasterAddCourtDateResult(json);
      setMasterAddCourtDateDialogOpen(false);
      void loadMasterCourtDatesForStatusBox(masterId);
    } catch (error: any) {
      setMasterAddCourtDateResult({ ok: false, error: error?.message || "Add New Court Date failed." });
    } finally {
      setMasterAddCourtDateSaving(false);
    }
  }

  useEffect(() => {
    if (kind !== "master") return;
    const masterId = currentMasterLawsuitIdForDocumentPreview();
    if (!masterId) return;
    void loadMasterCourtDatesForStatusBox(masterId);
  }, [kind, value]);

  function activeMasterSettlementRecordForVoid() {
    const records = Array.isArray(masterSettlementHistory?.records) ? masterSettlementHistory.records : [];
    return masterSettlementHistory?.activeRecord || records.find((record: any) => !record?.voided) || null;
  }

  async function voidActiveMasterSettlementRecord(record: any, options: { skipTypedConfirm?: boolean; skipReasonPrompt?: boolean } = {}) {
    if (!record?.id) {
      setMasterSettlementVoidNotice("No active settlement record was found to void.");
      return;
    }

    const reason = options.skipReasonPrompt
      ? "Temporary no-password development void"
      : await bmPrompt(
          "VOID SETTLEMENT\n\nThis will void the active local settlement record and restore the Record Settlement workflow.\n\nEnter a reason for voiding this settlement:"
        );

    if (reason === null) return;
    if (!options.skipReasonPrompt && !String(reason).trim()) {
      alert("A void reason is required.");
      return;
    }

    if (!options.skipTypedConfirm) {
      const typed = await bmPrompt(
        "Confirm settlement void.\n\nType confirm to void this settlement."
      );

      if (String(typed || "").trim().toLowerCase() !== "confirm") {
        alert("Settlement void cancelled.  Confirmation text did not match.");
        return;
      }
    }

    setMasterSettlementVoidLoading(true);
    setMasterSettlementVoidNotice("Voiding active local settlement record...");

    try {
      const voidMasterLawsuitId = currentMasterLawsuitIdForDocumentPreview();

      const response = await fetch("/api/settlements/local-void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterLawsuitId: voidMasterLawsuitId,
          settlementRecordId: record?.id || "",
          voidReason: String(reason).trim(),
          voidedBy: "Administrator",
          confirmVoid: true,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || `Settlement void failed: ${response.status}`);
      }

      setMasterSettlementVoidNotice(
        `Voided settlement record ${record.id}.  Record Settlement is available again.`
      );

      await loadMasterSettlementHistory();
      await loadMasterSettlementTicklers();
    } catch (error: any) {
      setMasterSettlementVoidNotice(error?.message || "Settlement void failed.");
    } finally {
      setMasterSettlementVoidLoading(false);
    }
  }

  function openVoidActiveSettlementAdminFlow() {
    const record = activeMasterSettlementRecordForVoid();

    if (!record?.id) {
      setMasterSettlementVoidNotice("No active settlement record was found to void.");
      return;
    }

    void runAdministratorGate(
      "Void Active Settlement",
      () => void voidActiveMasterSettlementRecord(record)
    );
  }

  function openTemporaryNoPasswordVoidSettlementFlow() {
    const record = activeMasterSettlementRecordForVoid();

    if (!record?.id) {
      setMasterSettlementVoidNotice("No active settlement record was found to void.");
      return;
    }

    void voidActiveMasterSettlementRecord(record, { skipTypedConfirm: true, skipReasonPrompt: true });
  }

  function openAdministratorMenu() {
    window.location.href = "/admin";
  }



  function formatMasterDocumentHistoryDate(value: unknown): string {
    if (!value) return "—";
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  }

  function formatMasterDocumentHistoryStatus(value: unknown): string {
    const text = String(value || "").trim();
    return text || "—";
  }

  function describeMasterDocumentHistoryEvent(event: any): string {
    if (!event) return "Document activity";
    const type = String(event.type || "");
    const row = event.row || {};

    if (type === "finalization") {
      const uploaded = Array.isArray(row.uploaded) ? row.uploaded.length : 0;
      const skipped = Array.isArray(row.skipped) ? row.skipped.length : 0;
      return `Finalized document packet · Uploaded ${uploaded} · Skipped ${skipped}`;
    }

    if (type === "print_queue") {
      return `${row.documentLabel || row.documentKey || row.filename || "Document"} · ${row.filename || "No filename"}`;
    }

    if (type === "email_draft" || type === "email_message") {
      const message = row.message || {};
      return `${message.subject || row.thread?.subject || "Email"}${message.hasAttachments ? " · Attachment present" : ""}`;
    }

    if (type === "email_filing_log") {
      return `${row.action || "Email filing"} · ${row.targetType || "Target"} ${row.targetId || ""}`.trim();
    }

    return String(event.label || "Document activity");
  }

  async function loadMasterDocumentHistory() {
    const lookupMasterLawsuitId = clean(value);
    if (kind !== "master" || !lookupMasterLawsuitId) {
      setMasterDocumentHistoryResult(null);
      setMasterDocumentHistoryError("Missing lawsuit ID.");
      return;
    }

    setMasterDocumentHistoryLoading(true);
    setMasterDocumentHistoryError("");

    try {
      const response = await fetch(
        `/api/documents/finalization-history?masterLawsuitId=${encodeURIComponent(lookupMasterLawsuitId)}&limit=50`,
        { cache: "no-store" }
      );
      const json = await response.json();
      setMasterDocumentHistoryResult(json);
      if (!response.ok || !json?.ok) {
        setMasterDocumentHistoryError(json?.error || "Document activity lookup failed.");
      }
    } catch (err: any) {
      setMasterDocumentHistoryResult(null);
      setMasterDocumentHistoryError(err?.message || "Document activity lookup failed.");
    } finally {
      setMasterDocumentHistoryLoading(false);
    }
  }

  function openMasterDocumentHistoryPopup() {
    setMasterDocumentHistoryPopupOpen(true);
    void loadMasterDocumentHistory();
  }

  function closeMasterDocumentHistoryPopup() {
    setMasterDocumentHistoryPopupOpen(false);
    setMasterDocumentHistoryError("");
  }

  function renderMasterDocumentHistoryPopup() {
    if (!masterDocumentHistoryPopupOpen) return null;

    const events = Array.isArray(masterDocumentHistoryResult?.events)
      ? masterDocumentHistoryResult.events
      : [];

    const sections = masterDocumentHistoryResult?.sections || {};
    const summaryItems = [
      ["Finalizations", sections.finalizations?.count ?? 0],
      ["Print Queue", sections.printQueueItems?.count ?? 0],
      ["Email Threads", sections.emailThreads?.count ?? 0],
      ["Filing Logs", sections.emailFilingLogs?.count ?? 0],
    ];

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Master Lawsuit Document Activity"
        style={{
          position: "fixed",
          inset: "76px 24px 24px 24px",
          zIndex: 10000,
          background: "rgba(15, 23, 42, 0.45)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: 12,
        }}
      >
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            width: "min(1180px, calc(100vw - 64px))",
            maxHeight: "calc(100vh - 124px)",
            overflow: "auto",
            resize: "both",
            minWidth: 780,
            minHeight: 460,
            background: "#ffffff",
            borderRadius: 22,
            border: "1px solid #cbd5e1",
            boxShadow: "0 28px 90px rgba(15, 23, 42, 0.34)",
            padding: 22,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#385a83", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Document Activity
              </div>
              <div style={{ marginTop: 4, fontSize: 24, fontWeight: 950, color: "#00346e" }}>
                Lawsuit {clean(value) || "—"}
              </div>
              <div style={{ marginTop: 6, fontSize: 13, color: "#385a83", lineHeight: 1.5 }}>
                Document history.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => void loadMasterDocumentHistory()}
                disabled={masterDocumentHistoryLoading}
                style={{
                  border: "1px solid #bfdbfe",
                  background: masterDocumentHistoryLoading ? "#eff6ff" : "#dbeafe",
                  color: "#00346e",
                  borderRadius: 999,
                  padding: "9px 14px",
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: masterDocumentHistoryLoading ? "default" : "pointer",
                }}
              >
                {masterDocumentHistoryLoading ? "Loading..." : "Refresh"}
              </button>
              <button
                type="button"
                onClick={closeMasterDocumentHistoryPopup}
                style={{
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#385a83",
                  borderRadius: 999,
                  padding: "9px 14px",
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 10,
            }}
          >
            {summaryItems.map(([label, count]) => (
              <div
                key={String(label)}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 16,
                  background: "#f8fafc",
                  padding: 14,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 900, color: "#385a83", textTransform: "uppercase" }}>
                  {label}
                </div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950, color: "#00346e" }}>
                  {String(count)}
                </div>
              </div>
            ))}
          </div>

          {masterDocumentHistoryError && (
            <div
              style={{
                marginTop: 16,
                border: "1px solid #fecaca",
                background: "#fef2f2",
                color: "#991b1b",
                borderRadius: 16,
                padding: 12,
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {masterDocumentHistoryError}
            </div>
          )}

          <div style={{ marginTop: 18, border: "1px solid #e2e8f0", borderRadius: 18, overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "170px 170px 150px 1fr",
                background: "#f1f5f9",
                borderBottom: "1px solid #e2e8f0",
                fontSize: 12,
                fontWeight: 950,
                color: "#385a83",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              <div style={{ padding: 12 }}>Date</div>
              <div style={{ padding: 12 }}>Activity</div>
              <div style={{ padding: 12 }}>Status</div>
              <div style={{ padding: 12 }}>Details</div>
            </div>

            {masterDocumentHistoryLoading && events.length === 0 ? (
              <div style={{ padding: 18, fontSize: 13, color: "#385a83", fontWeight: 800 }}>
                Loading document activity...
              </div>
            ) : events.length === 0 ? (
              <div style={{ padding: 18, fontSize: 13, color: "#385a83", fontWeight: 800 }}>
                No document activity found for this lawsuit.
              </div>
            ) : (
              events.map((event: any, index: number) => (
                <div
                  key={`${event.type || "event"}-${event.occurredAt || index}-${index}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "170px 170px 150px 1fr",
                    borderBottom: index === events.length - 1 ? "none" : "1px solid #f1f5f9",
                    fontSize: 13,
                    color: "#00346e",
                  }}
                >
                  <div style={{ padding: 12, color: "#385a83", fontWeight: 800 }}>
                    {formatMasterDocumentHistoryDate(event.occurredAt)}
                  </div>
                  <div style={{ padding: 12, fontWeight: 950 }}>
                    {event.label || event.type || "Activity"}
                  </div>
                  <div style={{ padding: 12 }}>
                    <span
                      style={{
                        display: "inline-flex",
                        border: "1px solid #cbd5e1",
                        background: "#f8fafc",
                        borderRadius: 999,
                        padding: "4px 9px",
                        fontSize: 12,
                        fontWeight: 900,
                        color: "#385a83",
                      }}
                    >
                      {formatMasterDocumentHistoryStatus(event.status)}
                    </span>
                  </div>
                  <div style={{ padding: 12, color: "#385a83", lineHeight: 1.45 }}>
                    {describeMasterDocumentHistoryEvent(event)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
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

  async function saveMasterNote() {
    const note = clean(masterNoteDraft);
    if (!note) return;

    if (masterNoteEditingId) {
      const existingNote = masterNotes.find((entry) => entry.id === masterNoteEditingId);
      const before = existingNote?.note || "";
      const nextNotes = masterNotes.map((entry) =>
        entry.id === masterNoteEditingId
          ? {
              ...entry,
              note,
              editedAt: new Date().toLocaleString(),
              user: entry.user || masterNoteUserName(),
            }
          : entry
      );

      const persisted = await persistMasterNotes(nextNotes);
      if (!persisted) return;
      setMasterNotes(nextNotes);

      void writeMasterAuditEntry({
        action: "master_note_edited",
        summary: "Master lawsuit note edited",
        entityType: "master_lawsuit_note",
        fieldName: "note",
        priorValue: before,
        newValue: note,
        details: {
          noteId: masterNoteEditingId,
          localLawsuitPersisted: true,
        },
      });

      closeMasterNoteDialog();
      return;
    }

    const noteId = String(Date.now()) + "-note";
    const nextNotes = [
      {
        id: noteId,
        note,
        timestamp: new Date().toLocaleString(),
        user: masterNoteUserName(),
      },
      ...masterNotes,
    ];

    const persisted = await persistMasterNotes(nextNotes);
    if (!persisted) return;
    setMasterNotes(nextNotes);

    void writeMasterAuditEntry({
      action: "master_note_added",
      summary: "Master lawsuit note added",
      entityType: "master_lawsuit_note",
      fieldName: "note",
      priorValue: null,
      newValue: note,
      details: {
        noteId,
        localLawsuitPersisted: true,
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

  async function confirmDeleteMasterNote() {
    if (!masterNoteDeleteTarget?.id) return;

    const deletedNote = masterNoteDeleteTarget.note || "";
    const deletedNoteId = masterNoteDeleteTarget.id;
    const nextNotes = masterNotes.filter((entry) => entry.id !== deletedNoteId);

    const persisted = await persistMasterNotes(nextNotes);
    if (!persisted) return;
    setMasterNotes(nextNotes);

    void writeMasterAuditEntry({
      action: "master_note_deleted",
      summary: "Master lawsuit note deleted",
      entityType: "master_lawsuit_note",
      fieldName: "note",
      priorValue: deletedNote,
      newValue: null,
      details: {
        noteId: deletedNoteId,
        localLawsuitPersisted: true,
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
    const raw = String(masterSettlementInterestAmountInput || "").trim();
    if (!raw) return 0;

    if (masterSettlementAmountOrPercentShouldUsePercent(raw)) {
      const percentRaw = raw.endsWith("%") ? raw : `${raw}%`;
      return masterSettlementPercentValue(percentRaw);
    }

    const interestBasis = masterSettlementSimpleInterestAmountValue();
    const settledInterestAmount = masterSettlementLooseNumericValue(raw);
    return interestBasis > 0 ? (settledInterestAmount / interestBasis) * 100 : 0;
  }

  function masterSettlementCalculatedSettledInterestValue(): number {
    const raw = String(masterSettlementInterestAmountInput || "").trim();
    if (!raw) return 0;

    if (masterSettlementAmountOrPercentShouldUsePercent(raw)) {
      return masterSettlementSimpleInterestAmountValue() * (masterSettlementInterestSettlementPercentValue() / 100);
    }

    return masterSettlementLooseNumericValue(raw);
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

  function shouldNormalizeDisplayedSettlementPercent(value: string): boolean {
    return /^\s*-?\d+\.0+%?\s*$/.test(String(value || ""));
  }

  function formatMasterSettlementPercentInput(value: string): string {
    const n = masterSettlementPercentValue(value);
    if (!Number.isFinite(n)) return value;

    const rounded = Math.round(n * 100) / 100;
    return Number.isInteger(rounded)
      ? String(rounded)
      : rounded.toFixed(2).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
  }

  function masterSettlementLooseNumericValue(value: string): number {
    const raw = String(value || "")
      .trim()
      .replace(/^\$/, "")
      .replace(/%$/, "")
      .replace(/,/g, "")
      .trim();

    if (!raw) return 0;

    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  function masterSettlementBareNumericInput(value: string): boolean {
    const raw = String(value || "").trim();
    if (!raw || raw.startsWith("$") || raw.endsWith("%")) return false;
    return /^-?\d{1,3}(?:,\d{3})*(?:\.\d+)?$|^-?\d+(?:\.\d+)?$/.test(raw);
  }

  function masterSettlementAmountOrPercentShouldUsePercent(value: string): boolean {
    const raw = String(value || "").trim();
    if (!raw) return false;
    if (raw.endsWith("%")) return true;
    if (raw.startsWith("$")) return false;
    if (!masterSettlementBareNumericInput(raw)) return false;

    const n = masterSettlementLooseNumericValue(raw);
    return Number.isFinite(n) && n >= 0 && n < 101;
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

    if (masterSettlementAmountOrPercentShouldUsePercent(raw)) {
      const percentRaw = raw.endsWith("%") ? raw : `${raw}%`;
      const percentage = masterSettlementPercentValue(percentRaw);
      return (masterSettlementBasisAmountValue() * percentage) / 100;
    }

    return masterSettlementLooseNumericValue(raw);
  }

  function formatMasterSettlementAmountOrPercentInput(value: string): string {
    const raw = String(value || "").trim();
    if (!raw) return "";

    if (masterSettlementAmountOrPercentShouldUsePercent(raw)) {
      const percentRaw = raw.endsWith("%") ? raw : `${raw}%`;
      const percentage = masterSettlementPercentValue(percentRaw);
      return Number.isFinite(percentage) ? `${formatMasterSettlementPercentInput(String(percentage))}%` : value;
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
        setMasterSettlementPrincipalFeePercentInput(formatMasterSettlementPercentInput(String(principalFeePercent)));
      } else {
        setMasterSettlementPrincipalFeePercentInput("");
      }

      if (typeof interestFeePercent === "number" && Number.isFinite(interestFeePercent)) {
        setMasterSettlementInterestFeePercentInput(formatMasterSettlementPercentInput(String(interestFeePercent)));
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

  function settlementContactDisplay(contact: any): string {
    const name = clean(contact?.name);
    const email = clean(contact?.email);
    if (name && email) return `${name} <${email}>`;
    return name || email || "";
  }

  async function loadMasterSettlementContacts() {
    setMasterSettlementContactsLoading(true);
    setMasterSettlementContactsError("");

    try {
      const response = await fetch("/api/settlements/contacts", { cache: "no-store" });
      const json = await response.json().catch(() => null);

      if (response.ok === false || json?.ok !== true) {
        throw new Error(json?.error || "Settlement contact lookup failed.");
      }

      setMasterSettlementContacts(Array.isArray(json.contacts) ? json.contacts : []);
    } catch (error: any) {
      setMasterSettlementContacts([]);
      setMasterSettlementContactsError(error?.message || "Settlement contact lookup failed.");
    } finally {
      setMasterSettlementContactsLoading(false);
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
    const currentPrincipalRetainer = formatMasterSettlementPercentInput(masterSettlementPrincipalFeePercentInput);
    const currentInterestRetainer = formatMasterSettlementPercentInput(masterSettlementInterestFeePercentInput);
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
          principalSettlementInput: masterSettlementGrossInput,
          settledWith: masterSettlementWithInput,
          settlementDate: masterSettlementDateInput,
          paymentExpectedDate: masterSettlementPaymentExpectedDateInput,
          allocationMode: "pro_rata_by_principal_balance",
          principalFeePercent: masterSettlementPercentValue(masterSettlementPrincipalFeePercentInput),
          interestAmount: masterSettlementInterestValue(),
          interestSettlementInput: masterSettlementInterestAmountInput,
          settledInterestAmountInput: masterSettlementSettledInterestInput || money(masterSettlementCalculatedSettledInterestValue()),
          costsAmount: masterSettlementCostsValue(),
          interestFeePercent: masterSettlementPercentValue(masterSettlementInterestFeePercentInput),
          notes: masterSettlementNotesInput,
        }),
      });

      const json = await response.json().catch(() => null);
      const previewResult = {
        ...(json || {}),
        ok: Boolean(response.ok && json?.ok),
        responseStatus: response.status,
      };

      setMasterSettlementLocalPreview(previewResult);
      return previewResult;
    } catch (error: any) {
      const previewResult = {
        ok: false,
        action: "settlement-local-preview",
        previewOnly: true,
        localFirst: true,
        error: error?.message || "Local settlement preview failed.",
      };

      setMasterSettlementLocalPreview(previewResult);
      return previewResult;
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

  function formatSettlementHistoryDate(value: unknown): string {
    return formatDateOnlyForDisplay(value) || "—";
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

  function formatSettlementTicklerDate(value: unknown): string {
    return formatDateOnlyForDisplay(value);
  }

  function masterSettlementPaymentDueFollowUpLabel(): string {
    if (masterSettlementTicklersLoading) return "Payment Due Follow-Up";

    const ticklers = masterSettlementTicklers?.ok && Array.isArray(masterSettlementTicklers.ticklers)
      ? masterSettlementTicklers.ticklers
      : [];

    const firstDueDate = ticklers.length > 0
      ? formatSettlementTicklerDate(ticklers[0]?.dueDate)
      : "";

    return firstDueDate ? `Payment Due Follow-Up- ${firstDueDate}` : "Payment Due Follow-Up";
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

  function masterSettlementBasisReady(): boolean {
    if (masterSettlementDraft.settlementBasedOn === "fee_schedule_amount") {
      return masterSettlementMoneyValue(masterSettlementDraft.feeScheduleAmount) > 0;
    }

    if (masterSettlementDraft.settlementBasedOn === "custom_amount") {
      return masterSettlementMoneyValue(masterSettlementDraft.customAmount) > 0;
    }

    return masterSettlementDraft.settlementBasedOn === "lawsuit_amount";
  }

  function masterSettlementPrincipalReady(): boolean {
    return clean(masterSettlementGrossInput).length > 0 && masterSettlementGrossValue() > 0;
  }

  function masterSettlementInterestReady(): boolean {
    return clean(masterSettlementInterestAmountInput).length > 0 || clean(masterSettlementSettledInterestInput).length > 0;
  }

  function masterSettlementSettledWithReady(): boolean {
    return clean(masterSettlementWithInput).length > 0;
  }

  function masterSettlementRequiredFieldMessage(): string {
    if (!masterSettlementBasisReady()) {
      if (masterSettlementDraft.settlementBasedOn === "fee_schedule_amount") {
        return "Enter a Fee Schedule amount before recording the settlement.";
      }

      if (masterSettlementDraft.settlementBasedOn === "custom_amount") {
        return "Enter a Custom amount before recording the settlement.";
      }

      return "Select a settlement basis before recording the settlement.";
    }

    if (!masterSettlementPrincipalReady()) {
      return "Enter the principal settlement before recording the settlement.";
    }

    if (!masterSettlementInterestReady()) {
      return "Select or enter the interest settlement before recording the settlement.";
    }

    if (!masterSettlementSettledWithReady()) {
      return "Select the settled-with contact before recording the settlement.";
    }

    if (masterHasActiveRecordedSettlement) {
      return "A settlement has already been recorded for this lawsuit.  Only one active settlement is permitted per lawsuit.";
    }

    return "";
  }

  function masterSettlementCanCommit(): boolean {
    return Boolean(
      masterSettlementRequiredFieldMessage() === "" &&
      !masterSettlementRecordSaveLoading &&
      !masterSettlementLocalPreviewLoading
    );
  }

  async function commitMasterSettlementAndLaunchDocuments() {
    const requiredFieldMessage = masterSettlementRequiredFieldMessage();
    if (requiredFieldMessage) {
      setMasterSettlementRecordSave({
        ok: false,
        duplicateSettlementBlocked: masterHasActiveRecordedSettlement,
        error: requiredFieldMessage,
      });
      return;
    }

    setMasterSettlementRecordSaveLoading(true);
    setMasterSettlementRecordSave(null);

    try {
      const previewResult = await runMasterSettlementLocalPreview();
      const settlementRecordPayload = previewResult?.settlementRecordPayload;

      if (!previewResult?.ok || !settlementRecordPayload) {
        setMasterSettlementRecordSave({
          ...(previewResult || {}),
          ok: false,
          action: "settlement-record-internal-preview",
          error: previewResult?.error || "Settlement calculation failed.  Review the settlement fields and try again.",
        });
        return;
      }

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
        error: error?.message || "Local settlement record failed.",
      });
    } finally {
      setMasterSettlementRecordSaveLoading(false);
    }
  }


  useEffect(() => {
    if (!masterSettlementFormOpen || activeMasterWorkspaceTab !== "payments") return;

    loadMasterSettlementProviderFeeDefaults();
    void loadMasterSettlementContacts();

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

  const masterPaymentSummary = (() => {
    const billRows = masterWorkspaceBillRows(masterSettlementDetailRows);
    const lawsuitAmount = masterStaticLawsuitAmountValue();

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
  })();

  useEffect(() => {
    if (kind !== "master" || activeMasterWorkspaceTab !== "payments") return;
    void loadMasterPaymentReceipts();
  }, [kind, activeMasterWorkspaceTab, masterSettlementDetailRows]);

  const masterPaymentVisibleReceipts = masterPaymentShowVoided
    ? masterPaymentReceipts
    : masterPaymentReceipts.filter((receipt: any) => !receipt?.voided);

  function masterPaymentReceiptPostingContext(receipt: any): string {
    const snapshot = receipt?.safetySnapshot || {};
    return clean(
      snapshot?.postingContext ||
        snapshot?.posting?.postingContext ||
        snapshot?.sourcePostingContext ||
        ""
    );
  }

  function masterPaymentReceiptIsLawsuitAllocation(receipt: any): boolean {
    const context = masterPaymentReceiptPostingContext(receipt).toLowerCase();
    const description = clean(receipt?.description).toLowerCase();
    return context === "lawsuit-allocation" || description.includes("lawsuit payment");
  }

  function masterLawsuitPaymentAmountForRow(row: any): number {
    const matterId = Number(row?.matterId || row?.matter_id || row?.id || 0);
    const displayNumber = clean(row?.displayNumber || row?.display_number);

    return masterPaymentReceipts
      .filter((receipt: any) => !receipt?.voided && receipt?.posted !== false)
      .filter((receipt: any) => masterPaymentReceiptIsLawsuitAllocation(receipt))
      .filter((receipt: any) => {
        const receiptMatterId = Number(receipt?.matterId || 0);
        const receiptDisplayNumber = clean(receipt?.displayNumber || receipt?.sourceDisplayNumber);
        return (!!matterId && receiptMatterId === matterId) || (!!displayNumber && receiptDisplayNumber === displayNumber);
      })
      .reduce((sum: number, receipt: any) => sum + (Number(receipt?.paymentAmount) || 0), 0);
  }

  function masterLawsuitBillAmountForRow(row: any): number {
    const directClaimAmount = Number(row?.claimAmount ?? row?.claim_amount);
    if (Number.isFinite(directClaimAmount) && directClaimAmount > 0) return directClaimAmount;

    const currentBalance = Number(row?.balancePresuit ?? row?.balance_presuit ?? row?.balance);
    if (Number.isFinite(currentBalance)) {
      return currentBalance + masterLawsuitPaymentAmountForRow(row);
    }

    return masterWorkspaceBillAmount(row);
  }

  function masterLawsuitBalanceAmountForRow(row: any): number {
    const explicitBalance = Number(row?.balancePresuit ?? row?.balance_presuit ?? row?.balance);
    if (Number.isFinite(explicitBalance)) return explicitBalance;

    return Math.max(masterLawsuitBillAmountForRow(row) - masterLawsuitPaymentAmountForRow(row), 0);
  }

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

  // Default lawsuit email subject: "[file#] Provider a/a/o Patient and Insurer <index>" (+ " - <doc type>").
  function buildMasterEmailSubject(docType?: string): string {
    const val = (v: unknown) => { const s = clean(v); return s && s !== "—" ? s : ""; };
    const provider = val(masterInfoDisplayValue("provider", masterProviderClientSummary));
    const patient = val(masterInfoDisplayValue("patient", clean((masterSettlementDetailRows as any[])[0]?.patient)));
    const insurer = val(masterInfoDisplayValue("insurer", masterInsurerSummary));
    const index = val(masterIndexAaaDisplayValue());
    const fileNumber = typeof window === "undefined" ? "" : currentMasterLawsuitIdForDocumentPreview();
    const caption = [provider, patient ? `a/a/o ${patient}` : "", insurer ? `and ${insurer}` : ""].filter(Boolean).join(" ");
    const doc = clean(docType);
    return `${fileNumber ? `[${fileNumber}] ` : ""}${caption}${index ? ` ${index}` : ""}${doc ? ` - ${doc}` : ""}`.replace(/\s+/g, " ").trim();
  }

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
                    : filter.kind === "dateOfLoss"
                      ? `/api/claim-index/search?dateOfLoss=${encodeURIComponent(filter.value)}`
                      : `/api/claim-index/search?claim=${encodeURIComponent(filter.value)}`;

        const rawRows = await fetchRows(url);
        const mapped: MatterRow[] = [];

        for (const row of rawRows) {
          if (filter.kind === "patient" && !exactOrContains(patientName(row), filter.value)) continue;
          if (filter.kind === "provider" && !exactOrContains(providerName(row), filter.value)) continue;
          if (filter.kind === "treatingProvider" && !exactOrContains(treatingProviderName(row), filter.value)) continue;
          if (filter.kind === "insurer" && !exactOrContains(insurerName(row), filter.value)) continue;
          if (filter.kind === "claim" && !exactOrContains(claimNumberFromMatter(row), filter.value)) continue;
          if (filter.kind === "dateOfLoss" && !exactOrContains(clean((row as any).dateOfLoss || (row as any).date_of_loss), filter.value)) continue;

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


  async function runDirectMatterSingleMasterFinalizeDryRunFromUi(params: DirectMatterSingleMasterDocumentPayloadParams) {
    const payload = buildDirectMatterSingleMasterFinalizeDryRunPayload(params);

    const response = await fetch("/api/documents/finalize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await response.json().catch(() => null);

    return {
      ok: Boolean(response.ok && json?.ok),
      responseStatus: response.status,
      payload,
      result: json,
      safety: {
        uiOriginatedDirectMatterDryRun: true,
        confirmUpload: false,
        singleMasterDryRun: true,
        noUploadPerformed: json?.noUploadPerformed === true || json?.safety?.noDocumentUploadPerformed === true,
        databaseMutation: json?.databaseMutation === false ? false : null,
        uploadRewired: json?.uploadRewired === false ? false : null,
      },
    };
  }


  // Phase 43E static/no-server/no-upload guarded direct matter dry-run control.
  const directMatterSingleMasterDryRunControlEnabled = false;
  const directMatterSingleMasterLiveFinalizeControlEnabled =
    String(process.env.NEXT_PUBLIC_BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED || "").trim() === "1";

  async function handleDirectMatterSingleMasterDryRunControl(params: DirectMatterSingleMasterDocumentPayloadParams) {
    return runDirectMatterSingleMasterFinalizeDryRunFromUi({
      ...params,
      confirmUpload: false,
      singleMasterDryRun: true,
      singleMasterResolveFolders: true,
    });
  }


  async function handleDirectMatterSingleMasterLiveFinalizeControl(params: DirectMatterSingleMasterDocumentPayloadParams) {
    const payload = buildDirectMatterSingleMasterFinalizePayload({
      ...params,
      confirmUpload: true,
      singleMasterDryRun: false,
      singleMasterResolveFolders: true,
      allowDuplicateUploads: false,
    });

    const response = await fetch("/api/documents/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        uiOriginatedDirectMatterLiveFinalize: true,
      }),
    });

    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.ok) {
      alert(json?.error || "Direct matter repository finalization failed.");
      return { ok: false, responseStatus: response.status, payload, result: json };
    }

    alert("Direct matter finalized to Barsh Matters Master Repository storage.");
    return { ok: true, responseStatus: response.status, payload, result: json };
  }

function renderDirectMatterSingleMasterDryRunControl(params: DirectMatterSingleMasterDocumentPayloadParams) {
    if (!directMatterSingleMasterDryRunControlEnabled) return null;

    return (
      <button
        type="button"
        data-phase43e-direct-matter-dry-run-control="true"
        onClick={() => void handleDirectMatterSingleMasterDryRunControl(params)}
        style={{
          border: "1px solid #bfdbfe",
          background: "#eff6ff",
          color: "#00346e",
          borderRadius: 999,
          padding: "8px 12px",
          fontSize: 12,
          fontWeight: 900,
          cursor: "pointer",
        }}
      >
        Direct Matter Clio Dry Run
      </button>
    );
  }



  function renderDirectMatterSingleMasterLiveFinalizeControl(params: DirectMatterSingleMasterDocumentPayloadParams) {
    if (!directMatterSingleMasterLiveFinalizeControlEnabled) return null;

    return (
      <button
        type="button"
        data-phase44d-direct-matter-live-finalize-control="true"
        onClick={() => void handleDirectMatterSingleMasterLiveFinalizeControl(params)}
        title="Owner/admin only. Server-side admin authorization is required before direct matter live finalize can upload to Clio storage."
        style={{
          border: "1px solid #00346e",
          borderRadius: 999,
          background: "#00346e",
          color: "white",
          fontSize: 12,
          fontWeight: 950,
          padding: "6px 10px",
          cursor: "pointer",
        }}
      >
        Admin Finalize Direct Matter to Clio
      </button>
    );
  }

function directMatterSingleMasterDryRunSurfaceRow(): MatterRow | null {
    const directRows = rows.filter((row: any) => row && !row.isMaster && !row.is_master);
    return directRows[0] || null;
  }

  type DirectMatterSingleMasterDryRunSelection = {
    selectedDocumentKey: string;
    workingDocumentDriveItemId: string;
    workingDocumentKey: string;
  };

    function renderDirectMatterSingleMasterDryRunControlForRow(row: MatterRow, selection: DirectMatterSingleMasterDryRunSelection) {
    const selectedDocumentKey = String(selection.selectedDocumentKey || "").trim();
    const workingDocumentDriveItemId = String(selection.workingDocumentDriveItemId || "").trim();
    const workingDocumentKey = String(selection.workingDocumentKey || "").trim();

    if (!selectedDocumentKey || !workingDocumentDriveItemId || !workingDocumentKey) return null;

    const params: DirectMatterSingleMasterDocumentPayloadParams = {
      directMatterId: row.id,
      directMatterDisplayNumber: row.displayNumber,
      documentKeys: [selectedDocumentKey],
      workingDocumentDriveItemId,
      workingDocumentKey,
      confirmUpload: false,
      singleMasterDryRun: true,
      singleMasterResolveFolders: true,
      allowDuplicateUploads: false,
    };

    return (
      <>
        {renderDirectMatterSingleMasterDryRunControl(params)}
        {renderDirectMatterSingleMasterLiveFinalizeControl(params)}
      </>
    );
  }

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
    const category = mode === "settlement" ? "settlement" : "all";

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
    return {
      ...context,
      clioMaildropEmail: "",
      clioMaildropLabel: "",
      maildropDeprecated: true,
      maildropDeprecationReason: "Deprecated Clio MailDrop is deprecated because Barsh Matters no longer uses legacy Clio storage references.",
    } as DocumentDeliveryContext;
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

  function settlementFinalizedPdfCandidateFromResult() {
    const result = masterDocumentFinalizationResult || {};
    const uploaded = Array.isArray(result.uploaded) ? result.uploaded : [];
    const skipped = Array.isArray(result.skipped) ? result.skipped : [];
    const source = uploaded[0] || skipped[0] || null;

    if (!source) return null;

    const clioDocumentId =
      source.clioDocumentId ||
      source.existingClioDocumentId ||
      source.documentId ||
      source.id ||
      "";

    const clioDocumentVersionUuid =
      source.clioDocumentVersionUuid ||
      source.documentVersionUuid ||
      source.existingClioDocumentVersionUuid ||
      source.latestDocumentVersion?.uuid ||
      "";

    const filename =
      source.filename ||
      source.clioDocumentName ||
      source.existingClioDocumentName ||
      result.selectedDocument?.filename ||
      result.generatedDocument?.filename ||
      "Finalized Settlement Document.pdf";

    const clioDisplayNumber =
      result.clioUploadTarget?.displayNumber ||
      source.clioDisplayNumber ||
      source.clioUploadTargetDisplayNumber ||
      "";

    const clioMatterId =
      result.clioUploadTarget?.id ||
      result.clioUploadTarget?.matterId ||
      result.clioUploadTarget?.clioMatterId ||
      source.clioMatterId ||
      source.clioUploadTargetMatterId ||
      masterClioDocumentsResult?.clioMatterId ||
      "";

    return {
      ...source,
      id: clioDocumentId,
      clioDocumentId,
      clioDocumentVersionUuid,
      filename,
      clioDocumentName: filename,
      name: filename,
      mimeType: "application/pdf",
      contentType: "application/pdf",
      documentType: "settlement_finalized_pdf",
      sourceType: "settlement_finalization_result",
      masterLawsuitId,
      masterDisplayNumber: clioDisplayNumber,
      clioDisplayNumber,
      clioMatterId,
      clioUploadTargetMatterId: clioMatterId,
      downloadUrl: source.downloadUrl || source.url || "",
      webUrl: source.webUrl || source.url || "",
    };
  }

  async function launchSettlementFinalizedDocumentEmail() {
    const draftWindow = window.open("", "_blank");
    if (draftWindow) {
      draftWindow.document.write("<!doctype html><title>Preparing Outlook Draft</title><body style='font-family: system-ui, sans-serif; padding: 24px;'>Preparing Outlook draft from Barsh Matters...</body>");
    }

    setMasterSettlementEmailPreviewPopupOpen(false);
    setMasterSettlementEmailNotice("Preparing Outlook draft for finalized settlement PDF...");

    const selectedCandidate = settlementFinalizedPdfCandidateFromResult();

    if (!selectedCandidate?.clioDocumentId) {
      if (draftWindow && !draftWindow.closed) draftWindow.close();

      setMasterSettlementEmailNotice("Finalize the settlement document first.  The email workflow requires a finalized PDF from the Barsh Matters Master Repository document storage.");
      setMasterDocumentDeliveryPreview({
        ok: false,
        error: "Finalize the settlement document first.  The email workflow requires a finalized PDF from the Barsh Matters Master Repository document storage.",
      });
      return;
    }

    setMasterDocumentDeliveryPreview(null);
    setMasterDocumentDeliveryPreviewLoading(true);

    try {
      const baseContext = buildMasterDocumentDeliveryContext(null);
      const finalizedPdfUrl = finalizedDocumentLooksLikePdf(selectedCandidate)
        ? selectedFinalizedDocumentUrl(selectedCandidate, "download")
        : "";

      const finalizedDocumentUrl = selectedFinalizedDocumentUrl(selectedCandidate, "download");

      const context = {
        ...baseContext,
        documentLabel: selectedCandidate.filename || baseContext.documentLabel || "Finalized Settlement Document",
        documentUrl: finalizedDocumentUrl || baseContext.documentUrl,
        pdfUrl: finalizedPdfUrl || baseContext.pdfUrl,
        pdfFilename: selectedCandidate.filename || baseContext.documentLabel || "Finalized Settlement Document.pdf",
        clioDocumentId:
          selectedCandidate.clioDocumentId ||
          selectedCandidate.existingClioDocumentId ||
          selectedCandidate.documentId ||
          selectedCandidate.id ||
          "",
        existingClioDocumentId: selectedCandidate.existingClioDocumentId || selectedCandidate.id || "",
        clioMatterId:
          selectedCandidate.clioMatterId ||
          selectedCandidate.clioUploadTargetMatterId ||
          masterDocumentFinalizationResult?.clioUploadTarget?.id ||
          masterDocumentFinalizationResult?.clioUploadTarget?.matterId ||
          masterDocumentFinalizationResult?.clioUploadTarget?.clioMatterId ||
          masterClioDocumentsResult?.clioMatterId ||
          "",
        clioUploadTargetMatterId:
          selectedCandidate.clioUploadTargetMatterId ||
          selectedCandidate.clioMatterId ||
          masterDocumentFinalizationResult?.clioUploadTarget?.id ||
          masterDocumentFinalizationResult?.clioUploadTarget?.matterId ||
          masterDocumentFinalizationResult?.clioUploadTarget?.clioMatterId ||
          masterClioDocumentsResult?.clioMatterId ||
          "",
        clioDisplayNumber:
          selectedCandidate.clioDisplayNumber ||
          selectedCandidate.masterDisplayNumber ||
          masterDocumentFinalizationResult?.clioUploadTarget?.displayNumber ||
          masterClioDocumentsResult?.clioDisplayNumber ||
          "",
        clioDocumentVersionUuid: selectedCandidate.clioDocumentVersionUuid || selectedCandidate.existingClioDocumentVersionUuid || "",
        existingClioDocumentVersionUuid: selectedCandidate.existingClioDocumentVersionUuid || selectedCandidate.clioDocumentVersionUuid || "",
        source: "settlement_finalized_pdf_delivery",
      };

      const response = await fetch("/api/documents/delivery-draft-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "settlement_finalized_pdf_delivery",
          masterLawsuitId,
          matterId: masterLawsuitId,
          context,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        if (draftWindow && !draftWindow.closed) {
          draftWindow.document.write("<!doctype html><title>Outlook Draft</title><body style='font-family: system-ui, sans-serif; padding: 24px;'>Outlook draft could not be prepared.  Return to Barsh Matters for details.</body>");
        }

        setMasterDocumentDeliveryPreview({
          ok: false,
          error: json?.error || `Could not prepare settlement finalized PDF email draft preview: ${response.status}`,
        });
        setMasterSettlementEmailNotice(json?.error || `Could not prepare Outlook draft: ${response.status}`);
        return;
      }

      const nextPreview = {
        ...json,
        settlementFinalizedPdfDelivery: true,
        selectedFinalizedDocument: selectedCandidate,
        context,
      };

      setMasterDocumentDeliveryPreview(nextPreview);
      setMasterSettlementEmailNotice("Creating Outlook draft with finalized settlement PDF attached.  You can add or edit recipients in Outlook...");
      await createMasterDocumentOutlookDraft(nextPreview, draftWindow);
      setMasterSettlementEmailNotice("Outlook draft created and opened.  Review, edit, and send from Outlook when ready.");
    } catch (error: any) {
      if (draftWindow && !draftWindow.closed) {
        draftWindow.document.write("<!doctype html><title>Outlook Draft</title><body style='font-family: system-ui, sans-serif; padding: 24px;'>Outlook draft could not be created.  Return to Barsh Matters for details.</body>");
      }

      setMasterSettlementEmailNotice(error?.message || "Could not prepare settlement finalized PDF email draft preview.");
      setMasterDocumentDeliveryPreview({
        ok: false,
        error: error?.message || "Could not prepare settlement finalized PDF email draft preview.",
      });
    } finally {
      setMasterDocumentDeliveryPreviewLoading(false);
    }
  }

  async function launchMasterDocumentEmail(selectedTemplate: { key: string; label: string; description: string } | null) {
    setMasterDocumentDeliveryPreview(null);
    setMasterDocumentDeliveryPreviewLoading(true);
    setMasterDocumentDraftCreateLoading(false);

    try {
      const baseContext = buildMasterDocumentDeliveryContext(selectedTemplate);
      const { selectedCandidate } = await loadSelectedMasterFinalizedDocumentCandidate(selectedTemplate);
      const finalizedPdfUrl = finalizedDocumentLooksLikePdf(selectedCandidate)
        ? selectedFinalizedDocumentUrl(selectedCandidate, "download")
        : "";
      const finalizedDocumentUrl = selectedFinalizedDocumentUrl(selectedCandidate, "download");

      const context = await resolveMasterMaildropForDelivery({
        ...baseContext,
        documentUrl: finalizedDocumentUrl || baseContext.documentUrl,
        pdfUrl: finalizedPdfUrl || baseContext.pdfUrl,
        pdfFilename: selectedCandidate?.filename || selectedCandidate?.clioDocumentName || baseContext.documentLabel,
        clioDocumentId: selectedCandidate?.clioDocumentId || selectedCandidate?.id || "",
        clioDocumentVersionUuid: selectedCandidate?.clioDocumentVersionUuid || selectedCandidate?.latestDocumentVersion?.uuid || "",
      } as any);

      if (!context.pdfUrl) {
        setMasterDocumentDeliveryPreview({
          ok: false,
          error: "Finalize the document before preparing an email draft.  The email workflow requires a finalized PDF from the Barsh Matters Master Repository document storage.",
          context,
          documentLabel: selectedTemplate?.label || "Document",
          draft: {},
          graphDraftPayloadPreview: {},
        });
        return;
      }

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

      const draft = preview?.draft || {};
      const graphPreview = preview?.graphDraftPayloadPreview || {};
      const readiness = graphPreview?.readiness || {};
      const attachmentPlan = Array.isArray(graphPreview?.attachmentPlan)
        ? graphPreview.attachmentPlan
        : Array.isArray(draft?.attachments)
          ? draft.attachments
          : [];

      const overrideTo = masterDocumentDeliveryToOverride.trim()
        ? buildDocumentDeliveryToOverrideRecipient()
        : undefined;

      const createResponse = await fetch("/api/graph/create-draft?confirm=create-graph-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "master_lawsuit",
          context,
          draft: {
            ...draft,
            ...(overrideTo ? { to: overrideTo } : {}),
          },
          ...(overrideTo ? {} : { graphDraftPayloadPreview: preview?.graphDraftPayloadPreview }),
          to: overrideTo,
          masterLawsuitId: context.masterLawsuitId,
          matterId: context.masterLawsuitId,
        }),
      });

      const createResult = await createResponse.json().catch(() => null);

      if (!createResponse.ok || !createResult?.createsOutlookDraft) {
        alert(
          "Document Email Draft Preview Ready, But Draft Creation Failed\n\n" +
            "No email was sent.\n\n" +
            `Document: ${context.documentLabel || selectedTemplate?.label || "Document"}\n` +
            `To: ${draft.to || "not resolved"}\n` +
            `Cc / Deprecated MailDrop: ${context.clioMaildropLabel || "MailDrop"} ${context.clioMaildropEmail ? "<" + context.clioMaildropEmail + ">" : "not resolved"}\n` +
            `Subject: ${draft.subject || "not resolved"}\n` +
            `Attachments planned: ${attachmentPlan.length}\n` +
            `Ready for Graph draft creation: ${readiness.readyForGraphDraftCreate ? "Yes" : "No"}\n\n` +
            `Error: ${createResult?.error || "Graph draft creation failed."}` +
            (Array.isArray(createResult?.attachmentErrors) && createResult.attachmentErrors.length
              ? "\n\nAttachment errors:\n" +
                createResult.attachmentErrors
                  .map((item: any) =>
                    [
                      item?.name ? "Name: " + item.name : "",
                      item?.clioDocumentId ? "Clio Document ID: " + item.clioDocumentId : "",
                      item?.error ? "Error: " + item.error : "",
                    ].filter(Boolean).join("\n")
                  )
                  .join("\n\n")
              : "")
        );
        return;
      }

      const outlookDraftUrl = String(createResult?.draft?.webLink || createResult?.draftMetadata?.webLink || createResult?.webLink || "").trim();
      if (outlookDraftUrl) {
        window.open(outlookDraftUrl, "_blank", "noopener,noreferrer");
      }

      setMasterDocumentDeliveryPreview({
        ...nextPreview,
        draftCreated: true,
        outlookDraftUrl,
        draftMetadata: createResult?.draftMetadata || createResult?.draft || null,
        attachmentUploads: Array.isArray(createResult?.attachmentUploads) ? createResult.attachmentUploads : [],
        attachmentErrors: Array.isArray(createResult?.attachmentErrors) ? createResult.attachmentErrors : [],
        createError: "",
      });
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

  function appendDocumentOpenMode(rawUrl: string, mode: "download" | "inline" | "edit"): string {
    const value = String(rawUrl || "").trim();
    if (!value) return "";

    try {
      const url = new URL(value, window.location.origin);
      url.searchParams.set("mode", mode);
      return url.toString();
    } catch {
      const separator = value.includes("?") ? "&" : "?";
      return `${value}${separator}mode=${encodeURIComponent(mode)}`;
    }
  }

  function selectedFinalizedDocumentUrl(candidate: any, mode: "download" | "inline" | "edit"): string {
    const raw =
      candidate?.documentUrl ||
      candidate?.downloadUrl ||
      candidate?.pdfUrl ||
      candidate?.docxUrl ||
      candidate?.url ||
      candidate?.webUrl ||
      candidate?.clioDocumentUrl ||
      candidate?.previewUrl ||
      "";

    if (raw) return appendDocumentOpenMode(raw, mode);

    const clioDocumentId =
      candidate?.clioDocumentId ||
      candidate?.existingClioDocumentId ||
      candidate?.documentId ||
      candidate?.id ||
      "";

    if (clioDocumentId) {
      const params = new URLSearchParams();
      params.set("documentId", String(clioDocumentId));
      params.set("mode", mode);
      const filename = String(candidate?.filename || candidate?.clioDocumentName || candidate?.name || "").trim();
      if (filename) params.set("filename", filename);
      return `/api/documents/clio-document-open?${params.toString()}`;
    }

    return "";
  }

  function finalizedDocumentLooksLikePdf(candidate: any): boolean {
    const filename = String(candidate?.filename || candidate?.clioDocumentName || "").toLowerCase();
    const contentType = String(candidate?.contentType || candidate?.mimeType || "").toLowerCase();
    return filename.endsWith(".pdf") || contentType.includes("pdf");
  }

  function finalizedDocumentLooksLikeDocx(candidate: any): boolean {
    const filename = String(candidate?.filename || candidate?.clioDocumentName || "").toLowerCase();
    const contentType = String(candidate?.contentType || candidate?.mimeType || "").toLowerCase();
    return filename.endsWith(".docx") || contentType.includes("wordprocessingml");
  }

  async function loadSelectedMasterFinalizedDocumentCandidate(selectedTemplate: { key: string; label: string; description: string } | null) {
    const masterLawsuitId = currentMasterLawsuitIdForDocumentPreview();

    if (!masterLawsuitId) {
      throw new Error("No Lawsuit ID is available for finalized-document lookup.");
    }

    const params = new URLSearchParams();
    params.set("masterLawsuitId", masterLawsuitId);
    params.set("limit", "25");

    const response = await fetch("/api/documents/print-queue-preview?" + params.toString(), {
      cache: "no-store",
    });
    const json = await response.json().catch(() => null);

    if (!response.ok || !json?.ok) {
      throw new Error(json?.error || "Could not load finalized document candidates.");
    }

    const candidates = Array.isArray(json?.candidateDocuments) ? json.candidateDocuments : [];

    if (candidates.length === 0) {
      throw new Error("No finalized repository documents are available. Finalize documents to Barsh Matters Master Repository storage first.");
    }

    const selectedKey = String(selectedTemplate?.key || "").trim().toLowerCase();
    const selectedLabel = String(selectedTemplate?.label || "").trim().toLowerCase();

    const masterDisplay =
      String(json?.clioUploadTarget?.displayNumber || json?.masterDisplayNumber || "").trim().toLowerCase();

    const candidateMatchesSelection = (candidate: any) => {
      const key = String(candidate?.key || "").trim().toLowerCase();
      const documentKey = String(candidate?.documentKey || "").trim().toLowerCase();
      const label = String(candidate?.label || "").trim().toLowerCase();
      const documentLabel = String(candidate?.documentLabel || "").trim().toLowerCase();
      const filename = String(candidate?.filename || "").trim().toLowerCase();

      return (
        (selectedKey && key === selectedKey) ||
        (selectedKey && documentKey === selectedKey) ||
        (selectedLabel && label === selectedLabel) ||
        (selectedLabel && documentLabel === selectedLabel) ||
        (selectedKey && filename.includes(selectedKey))
      );
    };

    const candidateLooksLikeMaster = (candidate: any) => {
      const filename = String(candidate?.filename || candidate?.clioDocumentName || "").trim().toLowerCase();
      const displayNumber =
        String(candidate?.masterDisplayNumber || candidate?.clioDisplayNumber || candidate?.displayNumber || "").trim().toLowerCase();

      return Boolean(
        (masterDisplay && displayNumber === masterDisplay) ||
        (masterDisplay && filename.includes(masterDisplay))
      );
    };

    const matchingPdfCandidates = candidates
      .filter((candidate: any) => candidateMatchesSelection(candidate) && finalizedDocumentLooksLikePdf(candidate))
      .sort((a: any, b: any) => Number(b?.masterMatterId || 0) - Number(a?.masterMatterId || 0));

    const matchingCandidates = candidates
      .filter((candidate: any) => candidateMatchesSelection(candidate))
      .sort((a: any, b: any) => Number(b?.masterMatterId || 0) - Number(a?.masterMatterId || 0));

    const selectedCandidate =
      candidates.find((candidate: any) => candidateLooksLikeMaster(candidate) && candidateMatchesSelection(candidate) && finalizedDocumentLooksLikePdf(candidate)) ||
      candidates.find((candidate: any) => candidateLooksLikeMaster(candidate) && candidateMatchesSelection(candidate)) ||
      matchingPdfCandidates[0] ||
      matchingCandidates[0] ||
      candidates.find((candidate: any) => finalizedDocumentLooksLikePdf(candidate)) ||
      candidates[0];

    return {
      json,
      candidates,
      selectedCandidate,
      masterLawsuitId,
    };
  }

  async function launchMasterDocumentEdit(selectedTemplate: { key: string; label: string; description: string } | null) {
    try {
      const { json, candidates, selectedCandidate, masterLawsuitId } =
        await loadSelectedMasterFinalizedDocumentCandidate(selectedTemplate);

      const editUrl = selectedFinalizedDocumentUrl(selectedCandidate, "edit");
      const inlineUrl = selectedFinalizedDocumentUrl(selectedCandidate, "inline");

      if (!editUrl && !inlineUrl) {
        throw new Error("Barsh Matters found a finalized document, but the preview contract did not expose an openable file URL.");
      }

      const filename = String(selectedCandidate?.filename || selectedCandidate?.clioDocumentName || selectedTemplate?.label || "Document");
      const isPdf = finalizedDocumentLooksLikePdf(selectedCandidate);
      const isDocx = finalizedDocumentLooksLikeDocx(selectedCandidate);

      let openedWindow: Window | null = null;
      let launchUrl = inlineUrl || editUrl;
      let action = "master-document-edit-open";
      let note = "Opened the finalized document for editing/viewing.";

      if (isDocx && editUrl) {
        const absoluteEditUrl = new URL(editUrl, window.location.origin).toString();
        launchUrl = `ms-word:ofe|u|${absoluteEditUrl}`;
        action = "master-document-edit-word";
        note = "Requested Microsoft Word desktop edit/open for the finalized DOCX.  If Word does not launch, use the browser download/open prompt.";
      } else if (isPdf && inlineUrl) {
        launchUrl = inlineUrl;
        action = "master-document-edit-pdf-inline";
        note = "Opened the finalized PDF inline so the workstation/browser can hand it to Adobe if configured.";
      }

      openedWindow = window.open(launchUrl, "_blank", "noopener,noreferrer");

      if (!openedWindow) {
        throw new Error("The browser blocked the document edit/open window.  Please allow popups for Barsh Matters and try again.");
      }

      setMasterDocumentPrintResult({
        ok: true,
        action,
        masterLawsuitId,
        documentLabel:
          selectedCandidate?.label ||
          selectedCandidate?.documentLabel ||
          selectedTemplate?.label ||
          "Document",
        filename,
        editUrl,
        inlineUrl,
        selectedCandidate,
        candidateDocumentCount: candidates.length,
        currentClioExistenceVerified: json?.verification?.currentClioExistenceVerified === true,
        opensInWordRequested: isDocx,
        opensInlineForAdobe: isPdf,
        clioDocumentsTabRemainsSourceOfTruth: true,
        note,
      });
    } catch (err: any) {
      const fallback = {
        ok: false,
        action: "master-document-edit-open",
        error: err?.message || "Could not open the finalized document for editing.",
      };
      setMasterDocumentPrintResult(fallback);
      alert(fallback.error);
    }
  }

  async function createMasterDocumentOutlookDraft(previewOverride?: any, draftWindow?: Window | null) {
    const previewState = previewOverride || masterDocumentDeliveryPreview;
    const settlementFinalizedPdfDelivery =
      Boolean(previewState?.settlementFinalizedPdfDelivery) ||
      previewState?.context?.source === "settlement_finalized_pdf_delivery" ||
      previewState?.source === "settlement_finalized_pdf_delivery";

    if (!previewState || (!settlementFinalizedPdfDelivery && !isDocumentDeliveryReadyForGraphDraft(previewState))) {
      const message = settlementFinalizedPdfDelivery
        ? "Graph draft creation is blocked because no finalized settlement PDF payload was available."
        : "Graph draft creation is blocked until the preview has a To recipient, MailDrop in Cc, and no MailDrop in Bcc.";

      if (draftWindow && !draftWindow.closed) {
        draftWindow.document.write(`<!doctype html><title>Outlook Draft</title><body style='font-family: system-ui, sans-serif; padding: 24px;'>${message}</body>`);
      }

      setMasterDocumentDeliveryPreview({
        ...(previewState || {}),
        draftCreated: false,
        createError: message,
      });
      return;
    }

    setMasterDocumentDraftCreateLoading(true);

    try {
      const graphDraftPayloadPreview = readDocumentDeliveryGraphPreview(previewState);
      const settlementFinalizedPdfDraft =
        Boolean(previewState?.settlementFinalizedPdfDelivery) ||
        previewState?.context?.source === "settlement_finalized_pdf_delivery" ||
        previewState?.source === "settlement_finalized_pdf_delivery";

      const response = await fetch("/api/graph/create-draft?confirm=create-graph-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          previewState?.graphDraftPayload
            ? {
                ...previewState.graphDraftPayload,
                source: settlementFinalizedPdfDraft ? "settlement_finalized_pdf_delivery" : previewState.graphDraftPayload?.source,
                context: previewState?.context || previewState.graphDraftPayload?.context || {},
                selectedFinalizedDocument: previewState?.selectedFinalizedDocument || null,
              }
            : {
                source: settlementFinalizedPdfDraft ? "settlement_finalized_pdf_delivery" : previewState?.source,
                context: previewState?.context || {},
                selectedFinalizedDocument: previewState?.selectedFinalizedDocument || null,
                graphDraftPayloadPreview,
              }
        ),
      });

      const result = await response.json().catch(() => null);
      const outlookDraftUrl = String(result?.draftMetadata?.webLink || result?.webLink || result?.draft?.webLink || "").trim();

      if (result?.createsOutlookDraft && outlookDraftUrl) {
        if (draftWindow && !draftWindow.closed) {
          draftWindow.location.href = outlookDraftUrl;
        } else {
          window.open(outlookDraftUrl, "_blank", "noopener,noreferrer");
        }
      } else if (draftWindow && !draftWindow.closed) {
        const safeErrorJson = JSON.stringify(
          {
            status: response.status,
            statusText: response.statusText,
            result,
            outlookDraftUrl,
          },
          null,
          2
        )
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        draftWindow.document.write(
          "<!doctype html><title>Outlook Draft Error</title><body style='font-family: system-ui, sans-serif; padding: 24px; white-space: pre-wrap;'><h1 style='font-size: 20px;'>Outlook draft could not be created</h1><p>Copy the diagnostic text below back into ChatGPT.</p><pre style='background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px; overflow: auto;'>" +
            safeErrorJson +
            "</pre></body>"
        );
      }

      setMasterDocumentDeliveryPreview({
        ...previewState,
        draftCreated: Boolean(result?.createsOutlookDraft),
        outlookDraftUrl,
        draftMetadata: result?.draftMetadata || null,
        attachmentUploads: Array.isArray(result?.attachmentUploads) ? result.attachmentUploads : [],
        attachmentErrors: Array.isArray(result?.attachmentErrors) ? result.attachmentErrors : [],
        createError: response.ok ? "" : result?.error || "Graph draft creation failed.",
      });
    } catch (error: any) {
      if (draftWindow && !draftWindow.closed) {
        draftWindow.document.write("<!doctype html><title>Outlook Draft</title><body style='font-family: system-ui, sans-serif; padding: 24px;'>Outlook draft could not be created.  Return to Barsh Matters for details.</body>");
      }

      setMasterDocumentDeliveryPreview({
        ...previewState,
        draftCreated: false,
        createError: error?.message || "Graph draft creation failed.",
      });
    } finally {
      setMasterDocumentDraftCreateLoading(false);
    }
  }

  async function saveMasterSettlementDocumentLocally(selectedTemplate: { key: string; label: string; description: string } | null) {
    const settlementFinalizedPdfSaveLocalSuccessCopy = "The finalized settlement PDF from the Barsh Matters Master Repository document storage was opened for local saving.";
    const context = buildMasterDocumentDeliveryContext(selectedTemplate);
    const isSettlementDocumentMode =
      masterDocumentLaunchMode === "settlement" ||
      masterDocumentDataPreview?.documentLaunchMode === "settlement" ||
      masterDocumentDataPreview?.action === "settlement-documents-preview";

    if (isSettlementDocumentMode) {
      const finalizationId = Number(masterDocumentFinalizationResult?.finalizationRecord?.id || 0);

      if (!finalizationId) {
        alert("Finalize the settlement document before saving it locally.");
        return;
      }

      const selectedCandidate =
        masterDocumentFinalizationResult?.deliveryCandidate ||
        masterDocumentFinalizationResult?.finalizedDocument ||
        masterDocumentFinalizationResult?.uploaded?.[0] ||
        masterDocumentFinalizationResult?.skipped?.[0] ||
        masterDocumentFinalizationResult?.selectedDocument ||
        null;

      const finalizedPdfDownloadUrl = selectedCandidate
        ? selectedFinalizedDocumentUrl(selectedCandidate, "download")
        : "";

      if (!finalizedPdfDownloadUrl) {
        alert("The finalized settlement PDF does not expose a local save/download route.");
        return;
      }

      const finalizedPdfFilename =
        selectedCandidate?.filename ||
        selectedCandidate?.clioDocumentName ||
        selectedCandidate?.existingClioDocumentName ||
        masterDocumentFinalizationResult?.pdfFilename ||
        context.documentLabel ||
        "Settlement Document.pdf";

      const downloadLink = document.createElement("a");
      downloadLink.href = finalizedPdfDownloadUrl;
      downloadLink.target = "_blank";
      downloadLink.rel = "noopener noreferrer";
      downloadLink.download = finalizedPdfFilename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      setMasterDocumentPrintResult({
        ok: true,
        action: "settlement-document-finalized-pdf-save-local-opened",
        documentLabel: context.documentLabel,
        filename: finalizedPdfFilename,
        finalizedPdfDownloadUrl,
        finalizationId,
        finalizedPdfGenerated: false,
        printablePdfReady: false,
        clioRecordsChanged: false,
        emailSent: false,
        note: "Opened the generated DOCX route so the user can save the settlement document locally.",
      });
      return;
    }

    alert("Save Finalized PDF is currently wired for settlement documents only.");
  }

  async function launchMasterDocumentPrint(selectedTemplate: { key: string; label: string; description: string } | null) {
    const masterLawsuitId = currentMasterLawsuitIdForDocumentPreview();
    const context = buildMasterDocumentDeliveryContext(selectedTemplate);
    const isSettlementDocumentMode =
      masterDocumentLaunchMode === "settlement" ||
      masterDocumentDataPreview?.documentLaunchMode === "settlement" ||
      masterDocumentDataPreview?.action === "settlement-documents-preview";

    if (isSettlementDocumentMode) {
      const finalizationId = Number(masterDocumentFinalizationResult?.finalizationRecord?.id || 0);

      if (!finalizationId) {
        alert("Finalize the settlement document before opening the print dialog.");
        return;
      }

      const selectedCandidate = settlementFinalizedPdfCandidateFromResult();

      if (!selectedCandidate?.clioDocumentId && !selectedCandidate?.clioDocumentVersionUuid && !selectedCandidate?.downloadUrl) {
        alert("Finalize the settlement document first.  The print workflow requires a finalized PDF from the Barsh Matters Master Repository document storage.");
        return;
      }

      const printableUrl = finalizedDocumentLooksLikePdf(selectedCandidate)
        ? selectedFinalizedDocumentUrl(selectedCandidate, "inline")
        : selectedFinalizedDocumentUrl(selectedCandidate, "download");

      if (!printableUrl) {
        alert("Barsh Matters found the finalized settlement document, but no printable PDF URL is available.");
        return;
      }

      const printWindow = window.open("", "_blank");

      if (!printWindow) {
        alert("The browser blocked the settlement print window.  Please allow popups for Barsh Matters and try again.");
        return;
      }

      printWindow.document.write("<!doctype html><title>Preparing Settlement PDF</title><body style='font-family: system-ui, sans-serif; padding: 24px;'>Preparing finalized settlement PDF for printing...</body>");
      printWindow.document.close();
      printWindow.location.href = printableUrl;

      setMasterDocumentPrintResult({
        ok: true,
        action: "settlement-document-finalized-pdf-print-opened",
        documentLabel: selectedCandidate.filename || context.documentLabel,
        filename:
          selectedCandidate.filename ||
          selectedCandidate.clioDocumentName ||
          context.documentLabel ||
          "Finalized Settlement Document.pdf",
        printableUrl,
        finalizationId,
        clioDocumentId: selectedCandidate.clioDocumentId || "",
        clioDocumentVersionUuid: selectedCandidate.clioDocumentVersionUuid || "",
        finalizedPdfGenerated: true,
        printablePdfReady: true,
        clioRecordsChanged: false,
        emailSent: false,
        note: "Opened the finalized settlement PDF from the Barsh Matters Master Repository document storage for printing.",
      });
      return;
    }

    if (!masterLawsuitId) {
      alert("No Lawsuit ID is available for finalized-document print lookup.");
      return;
    }

    setMasterDocumentPrintResult(null);

    try {
      const { json, candidates, selectedCandidate } =
        await loadSelectedMasterFinalizedDocumentCandidate(selectedTemplate);

      const printableUrl = finalizedDocumentLooksLikePdf(selectedCandidate)
        ? selectedFinalizedDocumentUrl(selectedCandidate, "inline")
        : selectedFinalizedDocumentUrl(selectedCandidate, "download");

      if (!printableUrl) {
        throw new Error("Barsh Matters found a current finalized document in repository storage, but the preview contract did not expose an openable file URL.");
      }

      const printWindow = window.open("", "_blank");

      if (!printWindow) {
        return;
      }

      printWindow.document.write("<!doctype html><title>Preparing Print Document</title><body style='font-family: system-ui, sans-serif; padding: 24px;'>Preparing finalized PDF for printing...</body>");
      printWindow.document.close();
      printWindow.location.href = printableUrl;

      [2000, 4000, 6500].forEach((delay) => {
        window.setTimeout(() => {
          try {
            printWindow.focus();
            printWindow.print();
          } catch {
            // Browser-controlled print behavior; the opened document can still be printed manually.
          }
        }, delay);
      });

      setMasterDocumentPrintResult({
        ok: true,
        action: "master-document-print-open",
        masterLawsuitId,
        documentLabel:
          selectedCandidate?.label ||
          selectedCandidate?.documentLabel ||
          selectedTemplate?.label ||
          context.documentLabel ||
          "Document",
        filename: selectedCandidate?.filename || selectedCandidate?.clioDocumentName || "",
        printableUrl,
        selectedCandidate,
        candidateDocumentCount: candidates.length,
        currentClioExistenceVerified: json?.verification?.currentClioExistenceVerified === true,
        opensInlineForAdobe: finalizedDocumentLooksLikePdf(selectedCandidate),
        clioDocumentsTabRemainsSourceOfTruth: true,
        note: finalizedDocumentLooksLikePdf(selectedCandidate)
          ? "Opened the finalized PDF inline for browser/Adobe printing."
          : "Opened/downloaded the finalized DOCX.  True DOCX printing requires Word or PDF conversion.",
      });
    } catch (err: any) {
      const fallback = {
        ok: false,
        action: "master-document-print-open",
        error: err?.message || "Could not open the finalized document for printing.",
      };
      setMasterDocumentPrintResult(fallback);
      alert(fallback.error);
    }
  }

  async function loadMasterFinalizePreview() {
    const masterLawsuitId = currentMasterLawsuitIdForDocumentPreview();

    if (!masterLawsuitId) {
      alert("No valid Master Lawsuit ID is available for finalization preview.");
      return;
    }

    setMasterDocumentFinalizing(true);
    setMasterFinalizePreview(null);
    setMasterFinalizeUploadResult(null);
    setMasterDocumentFinalizationResult(null);

    try {
      const params = new URLSearchParams();
      params.set("masterLawsuitId", masterLawsuitId);
      params.set("uploadTarget", "master-lawsuit");

      const res = await fetch(`/api/documents/finalize-preview?${params.toString()}`);
      const json = await res.json().catch(() => null);

      if (!res.ok || !json) {
        const result = json || { ok: false, error: "Master finalization preview failed." };
        setMasterFinalizePreview(result);
        alert(result.error || "Master finalization preview failed.");
        return;
      }

      setMasterFinalizePreview(json);
      setMasterDocumentWorkflowStage("finalize");

      if (!json.ok && Array.isArray(json?.validation?.blockingErrors) && json.validation.blockingErrors.length > 0) {
        alert(`Master finalization is blocked:\n\n${json.validation.blockingErrors.join("\n")}`);
      }
    } catch (err: any) {
      const result = { ok: false, error: err?.message || "Master finalization preview failed." };
      setMasterFinalizePreview(result);
      alert(result.error);
    } finally {
      setMasterDocumentFinalizing(false);
    }
  }

  async function uploadMasterFinalDocumentsToClio() {
    if (masterFinalizeUploadLoading) return;

    const masterLawsuitId = currentMasterLawsuitIdForDocumentPreview();

    if (!masterLawsuitId) {
      alert("No valid Master Lawsuit ID is available for final upload.");
      return;
    }

    if (masterFinalizePreview?.action !== "finalize-preview" || !masterFinalizePreview?.ok) {
      alert("Run Master Finalization Preview successfully before uploading final documents to Barsh Matters Master Repository storage.");
      return;
    }

    const plannedDocuments = Array.isArray(masterFinalizePreview?.plannedDocuments)
      ? masterFinalizePreview.plannedDocuments
      : [];

    const uploadableDocuments = plannedDocuments.filter((doc: any) => doc?.wouldGenerate && doc?.wouldUploadToClio);

    if (uploadableDocuments.length === 0) {
      alert("No final Master/Lawsuit documents are ready for upload.");
      return;
    }

    const targetDisplay =
      masterDocumentPreviewText(masterFinalizePreview?.clioUploadTarget?.displayNumber) || "the Barsh Matters Master Repository storage";
    const targetMatterId = masterDocumentPreviewText(masterFinalizePreview?.clioUploadTarget?.matterId);

    const documentList = uploadableDocuments
      .map((doc: any) => `- ${masterDocumentPreviewText(doc?.label) || masterDocumentPreviewText(doc?.key)}: ${masterDocumentPreviewText(doc?.filename)}`)
      .join("\n");

    const confirmed = await bmConfirm(
      `FINALIZE AND UPLOAD MASTER/LAWSUIT DOCUMENTS TO CLIO\n\n` +
        `Target: ${targetDisplay}${targetMatterId ? ` / Matter ID ${targetMatterId}` : ""}\n\n` +
        `This will upload the following final document copy/copies to the Barsh Matters Master Repository document storage:\n\n` +
        `${documentList}\n\n` +
        `This is an explicit finalization action.\n\n` +
        `WARNING: Running this again may create duplicate uploaded documents in Clio.\n\n` +
        `Continue?`
    );

    if (!confirmed) return;

    setMasterFinalizeUploadLoading(true);
    setMasterFinalizeUploadResult(null);

    try {
      const res = await fetch("/api/documents/finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          masterLawsuitId,
          uploadTargetMode: "master-lawsuit",
          confirmUpload: true,
          documentKeys: uploadableDocuments.map((doc: any) => masterDocumentPreviewText(doc?.key)).filter(Boolean),
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        const result = json || { ok: false, error: "Master final upload failed." };
        setMasterFinalizeUploadResult(result);
        alert(result.error || "Master final upload failed.");
        return;
      }

      setMasterFinalizeUploadResult(json);
      setMasterDocumentFinalizationResult(json);
      await loadMasterClioDocuments();

      const uploadedCount = Array.isArray(json.uploaded) ? json.uploaded.length : 0;
      alert(`Master final upload complete.\n\nUploaded to Clio: ${uploadedCount} document(s).`);
    } catch (err: any) {
      const result = {
        ok: false,
        error: err?.message || "Master final upload failed.",
      };
      setMasterFinalizeUploadResult(result);
      alert(result.error);
    } finally {
      setMasterFinalizeUploadLoading(false);
    }
  }

  function masterGeneratedDocumentRouteForTemplate(selectedTemplate: { key: string; label: string; description: string } | null): string {
    const masterLawsuitId = currentMasterLawsuitIdForDocumentPreview();

    if (!masterLawsuitId || !selectedTemplate?.key) return "";

    const params = new URLSearchParams();
    params.set("masterLawsuitId", masterLawsuitId);
    params.set("mode", "edit");

    if (selectedTemplate.key === "bill-schedule") {
      return "/api/documents/bill-schedule?" + params.toString();
    }

    if (selectedTemplate.key === "packet-summary") {
      return "/api/documents/packet-summary?" + params.toString();
    }

    if (selectedTemplate.key === "summons-complaint") {
      return "/api/documents/summons-complaint?" + params.toString();
    }

    return "";
  }

  async function launchMasterStep2GeneratedDocumentEdit(selectedTemplate: { key: string; label: string; description: string } | null) {
    const masterLawsuitId = currentMasterLawsuitIdForDocumentPreview();

    if (!masterLawsuitId || !selectedTemplate?.key) {
      alert("Select a document before editing.");
      return;
    }

    try {
      const isSettlementDocumentMode =
        masterDocumentLaunchMode === "settlement" ||
        masterDocumentDataPreview?.documentLaunchMode === "settlement" ||
        masterDocumentDataPreview?.action === "settlement-documents-preview";

      const response = await fetch("/api/documents/working-docx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          masterLawsuitId,
          uploadTargetMode: "master-lawsuit",
          documentLaunchMode: isSettlementDocumentMode ? "settlement" : "lawsuit",
          settlementRecordId: isSettlementDocumentMode
            ? masterDocumentPreviewText(masterDocumentDataPreview?.settlementRecordId || masterDocumentSettlementRecordId)
            : "",
          documentKeys: [selectedTemplate.key],
          confirmCreate: true,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        alert(json?.error || "Could not create the working Word document.");
        return;
      }

      const working = json.workingDocument || {};
      const desktopWordUrl = working.msWordEditUrl || "";
      const wordWebUrl = working.webUrl || "";

      if (!desktopWordUrl && !wordWebUrl) {
        alert("The working document was created, but Graph did not return an editable URL.");
        return;
      }

      // Do not auto-launch desktop Word here.  Desktop Word may show an OS-level
      // "Can't Open File" dialog for SharePoint/OneDrive business URLs.  Instead,
      // create the working DOCX and show explicit Desktop Word / Word Web choices
      // in the edit panel below.

      setMasterDocumentFinalizationResult({
        ok: true,
        action: "working-docx-create",
        selectedDocument: json.selectedDocument,
        workingDocument: working,
        note: "Working DOCX created in Microsoft Graph/OneDrive. Edit and save in Word, then finalize to create the PDF delivery document.",
      });
      setMasterDocumentWorkflowStage("edit");
    } catch (err: any) {
      alert(err?.message || "Could not create the working Word document.");
    }
  }

  async function launchMasterStep2PdfPreview(selectedTemplate: { key: string; label: string; description: string } | null) {
    if (!selectedTemplate?.key) {
      alert("Select a document before previewing.");
      return;
    }

    const masterLawsuitId = currentMasterLawsuitIdForDocumentPreview();

    if (!masterLawsuitId) {
      alert("No valid Master Lawsuit ID is available for PDF preview.");
      return;
    }

    const previewWindow = window.open("", "_blank");

    if (previewWindow) {
      previewWindow.document.write("<!doctype html><title>Preparing PDF Preview</title><body style='font-family: system-ui, sans-serif; padding: 24px;'>Preparing PDF preview...</body>");
      previewWindow.document.close();
    }

    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (ch) => (
        {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[ch] || ch
      ));

    const showPreviewWindowError = (message: string) => {
      if (!previewWindow || previewWindow.closed) return;
      previewWindow.document.open();
      previewWindow.document.write(
        `<!doctype html><title>PDF Preview Failed</title><body style="font-family: system-ui, sans-serif; padding: 24px; color: #7f1d1d;"><h1 style="font-size: 20px; margin: 0 0 12px;">PDF preview could not be prepared.</h1><p style="line-height: 1.5; white-space: pre-wrap;">${escapeHtml(message)}</p></body>`
      );
      previewWindow.document.close();
    };

    try {
      setMasterDocumentWorkflowStage("preview");

      const isSettlementDocumentMode =
        masterDocumentLaunchMode === "settlement" ||
        masterDocumentDataPreview?.documentLaunchMode === "settlement" ||
        masterDocumentDataPreview?.action === "settlement-documents-preview";

      let workingDocumentForPreview = masterDocumentFinalizationResult?.workingDocument || null;

      if (!workingDocumentForPreview?.driveItemId) {
        const workingResponse = await fetch("/api/documents/working-docx", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            confirmCreate: true,
            masterLawsuitId,
            uploadTargetMode: "master",
            documentLaunchMode: isSettlementDocumentMode ? "settlement" : "lawsuit",
            settlementRecordId: isSettlementDocumentMode
              ? masterDocumentPreviewText(masterDocumentDataPreview?.settlementRecordId || masterDocumentSettlementRecordId)
              : "",
            documentKeys: [selectedTemplate.key],
          }),
        });

        const workingJson = await workingResponse.json().catch(() => null);

        if (!workingResponse.ok || !workingJson?.ok || !workingJson?.workingDocument?.driveItemId) {
          const message = workingJson?.error || "Could not create a working Word document for PDF preview.";
          showPreviewWindowError(message);
          alert(message);
          return;
        }

        workingDocumentForPreview = workingJson.workingDocument;
        setMasterDocumentFinalizationResult({
          ok: true,
          action: "working-docx-create",
          selectedDocument: workingJson.selectedDocument,
          workingDocument: workingDocumentForPreview,
          note: "Working DOCX created in Microsoft Graph/OneDrive for temporary PDF preview.",
        });
      }

      const previewResponse = await fetch("/api/documents/preview-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workingDocumentDriveItemId: workingDocumentForPreview.driveItemId,
          workingDocumentName: workingDocumentForPreview.name || selectedTemplate.label,
          filename: workingDocumentForPreview.originalFilename || workingDocumentForPreview.name || selectedTemplate.label,
        }),
      });

      if (!previewResponse.ok) {
        const errorJson = await previewResponse.json().catch(() => null);
        const message = errorJson?.error || "Could not generate the PDF preview.";
        showPreviewWindowError(message);
        alert(message);
        return;
      }

      const pdfBlob = await previewResponse.blob();
      const pdfUrl = URL.createObjectURL(pdfBlob);

      if (previewWindow) {
        previewWindow.location.href = pdfUrl;
      }

      window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 120000);
    } catch (err: any) {
      const message = err?.message || "Could not generate the PDF preview.";
      showPreviewWindowError(message);
      alert(message);
    }
  }

  async function finalizeMasterDocumentFromStep2(selectedTemplate: { key: string; label: string; description: string } | null) {
    if (masterDocumentFinalizing || masterFinalizeUploadLoading) return;

    if (!selectedTemplate?.key) {
      alert("Select a document before finalizing.");
      return;
    }

    const isSettlementDocumentMode =
      masterDocumentLaunchMode === "settlement" ||
      masterDocumentDataPreview?.documentLaunchMode === "settlement" ||
      masterDocumentDataPreview?.action === "settlement-documents-preview";

    if (isSettlementDocumentMode) {
      await finalizeMasterSettlementDocumentPlaceholder(selectedTemplate);
      return;
    }

    const masterLawsuitId = currentMasterLawsuitIdForDocumentPreview();

    if (!masterLawsuitId) {
      alert("No valid Master Lawsuit ID is available for final upload.");
      return;
    }

    let workingDocumentForFinalization = masterDocumentFinalizationResult?.workingDocument || null;

    if (!workingDocumentForFinalization?.driveItemId) {
      try {
        const params = new URLSearchParams();
        params.set("templateKey", selectedTemplate.key);
        params.set("templateLabel", selectedTemplate.label || selectedTemplate.key);

        const latestResponse = await fetch("/api/documents/working-docx-latest?" + params.toString(), {
          cache: "no-store",
        });
        const latestJson = await latestResponse.json().catch(() => null);

        if (latestResponse.ok && latestJson?.ok && latestJson?.workingDocument?.driveItemId) {
          workingDocumentForFinalization = latestJson.workingDocument;
          setMasterDocumentFinalizationResult({
            ok: true,
            action: "working-docx-recovered",
            selectedDocument: {
              key: selectedTemplate.key,
              label: selectedTemplate.label,
            },
            workingDocument: workingDocumentForFinalization,
            note: "Recovered latest working DOCX from Microsoft Graph/OneDrive for PDF finalization.",
          });
        }
      } catch {
        // Fall through to user-facing block below.
      }
    }

    if (!workingDocumentForFinalization?.driveItemId) {
      alert("Barsh Matters could not find the working Word document.  Click Edit Document again to recreate the working-document link before finalizing.");
      return;
    }


    setMasterDocumentFinalizing(true);
    setMasterFinalizeUploadLoading(true);
    setMasterFinalizePreview(null);
    setMasterFinalizeUploadResult(null);
    setMasterDocumentFinalizationResult(null);

    try {
      const res = await fetch("/api/documents/finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          masterLawsuitId,
          uploadTargetMode: "master-lawsuit",
          useSingleMasterClioStorage: true,
          confirmUpload: true,
          singleMasterDryRun: false,
          singleMasterResolveFolders: true,
          documentKeys: [selectedTemplate.key],
          workingDocumentDriveItemId: workingDocumentForFinalization?.driveItemId || "",
          workingDocumentKey: masterDocumentFinalizationResult?.selectedDocument?.key || selectedTemplate.key,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        const result = json || { ok: false, error: "Document finalization failed." };
        setMasterFinalizeUploadResult(result);
        setMasterDocumentFinalizationResult(result);
        alert(result.error || "Document finalization failed.");
        return;
      }

      setMasterFinalizeUploadResult(json);
      setMasterDocumentFinalizationResult(json);
      setMasterDocumentWorkflowStage("delivery");

      await loadMasterClioDocuments();

      const uploadedCount = Array.isArray(json.uploaded) ? json.uploaded.length : 0;
      const skippedCount = Array.isArray(json.skipped) ? json.skipped.length : 0;
      const uploadedNames = Array.isArray(json.uploaded)
        ? json.uploaded.map((doc: any) => clean(doc?.filename)).filter(Boolean)
        : [];

    } catch (err: any) {
      const result = {
        ok: false,
        error: err?.message || "Document finalization failed.",
      };
      setMasterFinalizeUploadResult(result);
      setMasterDocumentFinalizationResult(result);
      alert(result.error);
    } finally {
      setMasterDocumentFinalizing(false);
      setMasterFinalizeUploadLoading(false);
    }
  }

  function waitForWordWebAutosaveBeforeFinalize(): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, 5000));
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
    setMasterSettlementUploadNotice("Waiting for Word Web autosave before finalizing...");

    try {
      if (masterDocumentFinalizationResult?.workingDocument?.driveItemId) {
        await waitForWordWebAutosaveBeforeFinalize();
      }

      setMasterSettlementUploadNotice("Uploading finalized PDF to Barsh Matters Master Repository lawsuit storage.");

      const response = await fetch("/api/settlements/documents-finalize-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterLawsuitId,
          settlementRecordId,
          templateKey: selectedTemplate.key,
          templateLabel: selectedTemplate.label || context.documentLabel,
          workingDocumentDriveItemId: masterDocumentFinalizationResult?.workingDocument?.driveItemId || "",
          workingDocumentName: masterDocumentFinalizationResult?.workingDocument?.name || "",
          workingDocumentWebUrl: masterDocumentFinalizationResult?.workingDocument?.webUrl || "",
          workingDocumentSourceDocxSha256: masterDocumentFinalizationResult?.workingDocument?.sourceDocxSha256 || "",
          workingDocumentKey: masterDocumentFinalizationResult?.selectedDocument?.key || selectedTemplate.key,
          confirmFinalize: true,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        const message = json?.error || "Master document finalization failed.";
        setMasterDocumentFinalizationResult(json || { ok: false, error: message });
        alert(message);
        return;
      }

      setMasterDocumentFinalizationResult(json);
      setMasterDocumentWorkflowStage("delivery");

      const settlementUploadedCount = Array.isArray(json.uploaded) ? json.uploaded.length : 0;
      const settlementSkippedCount = Array.isArray(json.skipped) ? json.skipped.length : 0;
      const settlementClioDisplayNumber = json?.clioUploadTarget?.displayNumber || json?.masterLawsuitId || "Barsh Matters Master Repository";
      const settlementUploadMessage =
        settlementUploadedCount > 0
          ? `Uploaded finalized PDF to Barsh Matters Master Repository storage target ${settlementClioDisplayNumber}`
          : `Finalized PDF already exists in Clio matter ${settlementClioDisplayNumber}; duplicate upload skipped`;

      setMasterSettlementUploadNotice(settlementUploadMessage);
      window.setTimeout(() => {
        setMasterSettlementUploadNotice("");
      }, 4500);
    } catch (err: any) {
      const fallback = {
        ok: false,
        action: "settlement-document-finalize-local",
        error: err?.message || "Master document finalization failed.",
      };
      setMasterDocumentFinalizationResult(fallback);
      setMasterSettlementUploadNotice("");
      alert(fallback.error);
    } finally {
      setMasterDocumentFinalizing(false);
    }
  }

  async function sendMasterDocumentToPrintQueue(selectedTemplate: { key: string; label: string; description: string } | null) {
    const masterLawsuitId = currentMasterLawsuitIdForDocumentPreview();
    const context = buildMasterDocumentDeliveryContext(selectedTemplate);
    const isSettlementDocumentMode =
      masterDocumentLaunchMode === "settlement" ||
      masterDocumentDataPreview?.documentLaunchMode === "settlement" ||
      masterDocumentDataPreview?.action === "settlement-documents-preview";

    if (isSettlementDocumentMode) {
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
          const message = json?.error || "Could not send the finalized settlement document to the print queue.";
          setMasterDocumentPrintQueueResult(json || { ok: false, error: message });
          alert(message);
          return;
        }

        setMasterDocumentPrintQueueResult(json);
      } catch (err: any) {
        const fallback = {
          ok: false,
          action: "settlement-document-print-queue-local",
          error: err?.message || "Could not send the finalized settlement document to the print queue.",
        };
        setMasterDocumentPrintQueueResult(fallback);
        alert(fallback.error);
      } finally {
        setMasterDocumentPrintQueueLoading(false);
      }

      return;
    }

    if (!masterLawsuitId) {
      alert("No Lawsuit ID is available for sending finalized documents to the print queue.");
      return;
    }

    const confirmed = await bmConfirm(
      "SEND FINALIZED DOCUMENTS TO PRINT QUEUE\n\n" +
        "Lawsuit ID: " + masterLawsuitId + "\n" +
        "Document: " + (context.documentLabel || selectedTemplate?.label || "Selected finalized document(s)") + "\n\n" +
        "Barsh Matters will add currently finalized document file(s) in repository storage to the print queue.  Existing queue records are skipped.\n\n" +
        "Continue?"
    );

    if (!confirmed) return;

    setMasterDocumentPrintQueueLoading(true);
    setMasterDocumentPrintQueueResult(null);

    try {
      const response = await fetch("/api/documents/print-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterLawsuitId,
          confirmAdd: true,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        const message = json?.error || "Could not send finalized document(s) to the print queue.";
        setMasterDocumentPrintQueueResult(json || { ok: false, error: message });
        alert(message);
        return;
      }

      setMasterDocumentPrintQueueResult(json);
      alert(
        "Print queue updated.\n\n" +
          "Created: " + Number(json.createdCount || 0) + "\n" +
          "Already queued: " + Number(json.existingCount || 0)
      );
    } catch (err: any) {
      const fallback = {
        ok: false,
        action: "master-document-print-queue-add",
        error: err?.message || "Could not send finalized document(s) to the print queue.",
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

    const confirmed = await bmConfirm(
      "Sync this Microsoft Graph thread to this Master Lawsuit in Barsh Matters?\n\nThis will read Microsoft Graph and update local EmailThread / EmailMessage metadata."
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
              Unified Master Lawsuit email area.  Graph-synced messages and MailDrop-linked thread records appear here together.
            </p>
          </div>
        </div>

        {/* Phase D — inbound email attachments awaiting OCR review/filing for this lawsuit. */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 950, letterSpacing: "0.06em", textTransform: "uppercase", color: "#00346e", margin: "0 0 6px" }}>
            Inbound attachments to review
          </div>
          <InboundAttachmentReview masterLawsuitId={masterId} onChanged={() => { void loadMasterEmailThreadPreview(); }} />
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <button
            type="button"
            onClick={loadMasterEmailThreadPreview}
            disabled={masterEmailThreadPreviewLoading || masterGraphThreadSyncPreviewLoading || masterGraphThreadSyncLoading}
            style={{
              padding: "8px 11px",
              border: "1px solid #00346e",
              background: masterEmailThreadPreviewLoading ? "#f3f4f6" : "#00346e",
              color: masterEmailThreadPreviewLoading ? "#666" : "#ffffff",
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
                !hasConversationId || masterGraphThreadSyncPreviewLoading || masterGraphThreadSyncLoading ? "#666" : "#ffffff",
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
            title="Run only after Preview Graph Updates."
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
              </>
            )}
          </section>
        )}

        {masterEmailThreadPreviewResult?.error && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 800 }}>
            {clean(masterEmailThreadPreviewResult.error)}
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
                        title="Run only after Preview This Thread."
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

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, minWidth: 0 }}>
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

    const isSettlementDocumentMode = masterDocumentLaunchMode === "settlement" || masterDocumentDataPreview?.documentLaunchMode === "settlement" || masterDocumentDataPreview?.action === "settlement-documents-preview";

    const repositoryDocumentOptions = Array.isArray(masterDocumentRepositoryTemplates)
      ? masterDocumentRepositoryTemplates.map((template: any) => {
          const currentVersion = template?.currentVersion || null;
          const hasStoredDocx = Boolean(
            currentVersion?.hasStoredDocx ||
            currentVersion?.storageKind === "db-docx-base64" ||
            template?.storageKind === "db-docx-base64"
          );
          return {
            key: String(template?.key || ""),
            label: String(template?.label || template?.key || "Document"),
            description: [
              template?.description ? String(template.description) : "",
              hasStoredDocx ? `Stored DOCX: ${currentVersion?.storedDocxBytes || currentVersion?.sizeBytes || currentVersion?.fileSize || currentVersion?.contentLength || template?.storedDocxBytes || 0} bytes` : "",
              template?.mergeFieldSet ? `Merge fields: ${template.mergeFieldSet}` : "",
              template?.repositorySource ? `Repository: ${template.repositorySource}` : "Repository: Barsh Matters template repository",
              template?.editableLater ? "Editable/versioned repository support planned." : "",
            ].filter(Boolean).join("  "),
            availableNow: template?.enabled !== false,
            filename: template?.defaultFilenameSuffix ? `${template.defaultFilenameSuffix}.docx` : "",
            repositorySource: template?.repositorySource || "barsh-matters-template-repository-api",
            repositoryStatus: template?.repositoryStatus || "",
            currentVersionId: currentVersion?.id || "",
            hasStoredDocx,
            storedDocxBytes: currentVersion?.storedDocxBytes || currentVersion?.sizeBytes || currentVersion?.fileSize || currentVersion?.contentLength || template?.storedDocxBytes || 0,
            templateSource: hasStoredDocx ? "barsh-matters-db-template-repository" : "barsh-matters-template-repository",
            mergeFields: Array.isArray(template?.mergeFields) ? template.mergeFields : [],
          };
        }).filter((template: any) => template.key)
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

    const settlementDocumentOptions = settlementPreviewDocumentOptions;

    const storedRepositoryDocumentOptions = repositoryDocumentOptions.filter((option: any) => option.hasStoredDocx);

    const displayedTemplateOptions = isSettlementDocumentMode
      ? settlementDocumentOptions
      : [
          ...storedRepositoryDocumentOptions,
          ...sortedTemplateOptions,
        ];
    const filteredDisplayedTemplateOptions = displayedTemplateOptions.filter((option: any) => {
      const haystack = `${option.label || ""} ${option.description || ""}`.toLowerCase();
      return !query || haystack.includes(query);
    });

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

    const stepBadge = (step: number, label: string, active: boolean, complete: boolean) => {
      const isComplete = complete;
      const isActive = active && !complete;

      const badgeBackground = isComplete ? "#16a34a" : isActive ? "#dcfce7" : "#dcfce7";
      const badgeBorder = isComplete ? "#16a34a" : isActive ? "#bbf7d0" : "#bbf7d0";
      const badgeColor = isComplete ? "#ffffff" : "#166534";
      const circleBackground = isComplete ? "#15803d" : isActive ? "#16a34a" : "#bbf7d0";
      const circleColor = isComplete || isActive ? "#ffffff" : "#166534";

      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 12px",
            borderRadius: 999,
            border: `1px solid ${badgeBorder}`,
            background: badgeBackground,
            color: badgeColor,
            fontSize: 13,
            fontWeight: 950,
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
              background: circleBackground,
              color: circleColor,
              fontWeight: 950,
            }}
          >
            {step}
          </span>
          {label}
        </span>
      );
    };

    const stepArrow = (completed: boolean) => (
      <div
        aria-hidden="true"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: completed ? "#16a34a" : "#385a83",
          fontSize: 22,
          fontWeight: 900,
          lineHeight: 1,
          padding: "0 2px",
        }}
      >
        →
      </div>
    );

    const actionButton = (label: string, onClick: () => void, disabled = false, title = "") => (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        style={{
          border: disabled ? "1px solid #cbd5e1" : "1px solid #00346e",
          background: disabled ? "#f8fafc" : "#00346e",
          color: disabled ? "#385a83" : "#ffffff",
          borderRadius: 12,
          padding: "10px 14px",
          fontWeight: 900,
          cursor: disabled ? "not-allowed" : "pointer",
          boxShadow: disabled ? "none" : "0 8px 18px rgba(0, 52, 110, 0.22)",
        }}
      >
        {label}
      </button>
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
        onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setMasterDocumentGenerationPopupOpen(false); } }}
        tabIndex={-1}
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
            data-barsh-master-document-generation-header-standard="true"
            style={{
              display: "grid",
              gridTemplateColumns: "90px minmax(0, 1fr) 90px",
              alignItems: "center",
              gap: 14,
              padding: "16px 20px",
              borderBottom: "1px solid #00346e",
              background: "#00346e",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
            }}
          >
            <span aria-hidden="true" />
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 950,
                color: "#ffffff",
                textAlign: "center",
              }}
            >
              {isSettlementDocumentMode ? "Settlement Document Generation" : "Document Generation"}
            </h2>
            <span data-barsh-standard-modal-close="removed" aria-hidden="true" />
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
                "Preview PDF / Edit / Finalize",
                masterDocumentWorkflowStage === "chooseAction" ||
                  masterDocumentWorkflowStage === "preview" ||
                  masterDocumentWorkflowStage === "edit",
                step2Complete
              )}
              {stepArrow(step2Complete)}
              {stepBadge(3, "Document Delivery", masterDocumentWorkflowStage === "delivery", false)}
              {stepArrow(step3Complete)}
              {/* Step 4 removed: delivery is now Step 3. */}
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
                <p style={{ margin: "6px 0 0", color: "#385a83", lineHeight: 1.45 }}>
                  Select the document template for this matter.
                </p>
                {isSettlementDocumentMode && (
                  <p style={{ margin: "6px 0 0", color: masterDocumentRepositoryTemplatesError ? "#991b1b" : "#385a83", lineHeight: 1.45, fontWeight: masterDocumentRepositoryTemplatesError ? 900 : 700 }}>
                    {masterDocumentRepositoryTemplatesLoading
                      ? "Loading document-template repository..."
                      : masterDocumentRepositoryTemplatesError
                        ? `Template repository warning: ${masterDocumentRepositoryTemplatesError}.  Falling back to the settlement preview document plan.`
                        : "Template source: /api/documents/templates.  Settlement mode uses settlement templates; lawsuit mode loads all stored local DOCX templates first."}
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
                  placeholder="Select document template"
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
                      color: "#00346e",
                      lineHeight: 1.4,
                    }}
                  >
                    <strong>Selected:</strong> {displayedSelectedTemplate.label}
                    {displayedSelectedTemplate.hasStoredDocx && (
                      <span style={{ marginLeft: 8, color: "#166534", fontWeight: 950 }}>
                        Stored DOCX
                      </span>
                    )}
                    <div style={{ marginTop: 4, color: "#385a83" }}>{displayedSelectedTemplate.description}</div>
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
                  <div style={{ color: "#385a83", fontWeight: 800 }}>
                    No matching document templates.
                  </div>
                )}
              </div>
            </section>

            {masterDocumentWorkflowStage === "select" && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 0 0",
                  borderTop: "1px solid #e5e7eb",
                }}
              >
                <button
                  type="button"
                  disabled
                  style={{
                    minWidth: 118,
                    height: 38,
                    border: "1px solid #cbd5e1",
                    borderRadius: 10,
                    background: "#f8fafc",
                    color: "#385a83",
                    fontWeight: 900,
                    cursor: "not-allowed",
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setMasterDocumentGenerationPopupOpen(false)}
                  style={{
                    minWidth: 118,
                    height: 38,
                    border: "1px solid #dc2626",
                    borderRadius: 10,
                    background: "#dc2626",
                    color: "#ffffff",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            )}


            <section
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                padding: 18,
                background: "#fff",
                display: showActionStep || showPreviewStep || showEditStep ? "grid" : "none",
                gap: 14,
              }}
            >
              <div style={{ display: showActionStep ? "block" : "none" }}>
                <h3 style={{ margin: 0, fontSize: 18 }}>Step 2: Preview PDF / Edit / Finalize</h3>
                <p style={{ margin: "6px 0 0", color: "#385a83", lineHeight: 1.45 }}>
                  {displayedSelectedTemplate
                    ? `Selected: ${displayedSelectedTemplate?.label || "Selected document"}`
                    : "Select a document before previewing, editing, or finalizing."}
                </p>
              </div>

              <div style={{ display: showActionStep ? "flex" : "none", gap: 10, flexWrap: "wrap" }}>
{actionButton(
                  "Preview PDF",
                  () => launchMasterStep2PdfPreview(displayedSelectedTemplate),
                  !displayedSelectedTemplate,
                  !displayedSelectedTemplate ? "Select a document first." : "Open a temporary PDF preview of the selected document.  No files are finalized, uploaded, emailed, or queued by preview."
                )}
                {actionButton(
                  "Edit Document",
                  () => launchMasterStep2GeneratedDocumentEdit(displayedSelectedTemplate),
                  !displayedSelectedTemplate,
                  !displayedSelectedTemplate ? "Select a document first." : "Open the generated DOCX in Microsoft Word."
                )}
                {actionButton(
                  masterFinalizeUploadLoading || masterDocumentFinalizing ? "Finalizing..." : "Finalize Document",
                  () => finalizeMasterDocumentFromStep2(displayedSelectedTemplate),
                  !displayedSelectedTemplate || masterFinalizeUploadLoading || masterDocumentFinalizing,
                  !displayedSelectedTemplate ? "Select a document first." : "Finalize and upload the selected document to Clio."
                )}
              </div>

              {masterDocumentWorkflowStage === "preview" && (
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 18,
                    padding: 18,
                    background: "#fff",
                    display: "grid",
                    gap: 14,
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 18 }}>Preview PDF</h3>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>

                    {actionButton(masterFinalizeUploadLoading || masterDocumentFinalizing ? "Finalizing..." : "Finalize Document", () => finalizeMasterDocumentFromStep2(displayedSelectedTemplate), masterFinalizeUploadLoading || masterDocumentFinalizing)}
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
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <div>
                    <strong>Working Word document:</strong> {masterDocumentFinalizationResult?.workingDocument?.name || displayedSelectedTemplate?.label || "Selected document"} was created in the Barsh Matters working-docs folder.  Use Word Web for editing.  Desktop Word remains available as an experimental option, but Word Web is the reliable editing path for this SharePoint/OneDrive working document.  Save your edits in Word Web, then return here and click Finalize Document.
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => {
                        const url = masterDocumentFinalizationResult?.workingDocument?.msWordEditUrl || "";
                        if (!url) {
                          alert("No desktop Word link is available for this working document.");
                          return;
                        }
                        const link = document.createElement("a");
                        link.href = url;
                        link.style.display = "none";
                        link.rel = "noopener noreferrer";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      disabled={!masterDocumentFinalizationResult?.workingDocument?.msWordEditUrl}
                      style={{
                        border: "1px solid #00346e",
                        background: "#00346e",
                        color: "#ffffff",
                        borderRadius: 12,
                        padding: "10px 14px",
                        fontWeight: 900,
                        cursor: masterDocumentFinalizationResult?.workingDocument?.msWordEditUrl ? "pointer" : "not-allowed",
                        opacity: masterDocumentFinalizationResult?.workingDocument?.msWordEditUrl ? 1 : 0.55,
                      }}
                    >
                      Try Desktop Word
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const url = masterDocumentFinalizationResult?.workingDocument?.webUrl || "";
                        if (!url) {
                          alert("No Word web link is available for this working document.");
                          return;
                        }
                        window.open(url, "_blank", "noopener,noreferrer");
                      }}
                      disabled={!masterDocumentFinalizationResult?.workingDocument?.webUrl}
                      style={{
                        border: "1px solid #c4b5fd",
                        background: "#fff",
                        color: "#4c1d95",
                        borderRadius: 12,
                        padding: "10px 14px",
                        fontWeight: 900,
                        cursor: masterDocumentFinalizationResult?.workingDocument?.webUrl ? "pointer" : "not-allowed",
                        opacity: masterDocumentFinalizationResult?.workingDocument?.webUrl ? 1 : 0.55,
                      }}
                    >
                      Open in Word Web Close older working-document tabs to avoid editing the wrong file.
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        const url = masterDocumentFinalizationResult?.workingDocument?.webUrl || "";
                        if (!url) {
                          alert("No Word web link is available to copy.");
                          return;
                        }
                        try {
                          await navigator.clipboard.writeText(url);
                          alert("Word web link copied.");
                        } catch {
                          alert("Could not copy the Word web link automatically.");
                        }
                      }}
                      disabled={!masterDocumentFinalizationResult?.workingDocument?.webUrl}
                      style={{
                        border: "1px solid #c4b5fd",
                        background: "#fff",
                        color: "#4c1d95",
                        borderRadius: 12,
                        padding: "10px 14px",
                        fontWeight: 900,
                        cursor: masterDocumentFinalizationResult?.workingDocument?.webUrl ? "pointer" : "not-allowed",
                        opacity: masterDocumentFinalizationResult?.workingDocument?.webUrl ? 1 : 0.55,
                      }}
                    >
                      Copy Word Web Link
                    </button>
                  </div>
                </div>
              )}
            </section>

            {(showActionStep || showPreviewStep || showEditStep) && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 0 0",
                  borderTop: "1px solid #e5e7eb",
                }}
              >
                <button
                  type="button"
                  onClick={() => setMasterDocumentWorkflowStage(showPreviewStep || showEditStep ? "chooseAction" : "select")}
                  style={{
                    minWidth: 118,
                    height: 38,
                    border: "1px solid #cbd5e1",
                    borderRadius: 10,
                    background: "#ffffff",
                    color: "#385a83",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setMasterDocumentGenerationPopupOpen(false)}
                  style={{
                    minWidth: 118,
                    height: 38,
                    border: "1px solid #dc2626",
                    borderRadius: 10,
                    background: "#dc2626",
                    color: "#ffffff",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            )}



            <section
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                padding: 18,
                background: "#fff",
                display: "none",
                gap: 14,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 18 }}>Finalization Details</h3>
                <p style={{ margin: "6px 0 0", color: "#385a83", lineHeight: 1.45 }}>
                  Run the finalization preview first.  If the Barsh Matters Master Repository storage is resolved and the document plan is generation-ready, Upload Final Documents to Repository becomes available.
                </p>
              </div>

              <div>
                {actionButton(
                  masterDocumentFinalizing ? "Checking..." : "Run Finalization Preview",
                  loadMasterFinalizePreview,
                  !canFinalize || masterDocumentFinalizing,
                  "Preview the mapped master Clio upload target and planned final documents before uploading."
                )}

                {actionButton(
                  masterFinalizeUploadLoading ? "Uploading..." : "Upload Final Documents to Repository",
                  uploadMasterFinalDocumentsToClio,
                  masterDocumentFinalizing ||
                    masterFinalizeUploadLoading ||
                    masterFinalizePreview?.action !== "finalize-preview" ||
                    !masterFinalizePreview?.ok,
                  "Requires a successful Master Finalization Preview first."
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
                  <strong>Delivery step:</strong> This is the final review and delivery step.  Review the selected document data, then use the delivery buttons below to send the finalized PDF to the shared print queue, print it, or email it.  Delivery uses the finalized document stored in the Barsh Matters Master Repository, so finalize the document first if you have not already.
                </div>
              )}
            </section>


            {masterFinalizePreview && (
              <section
                style={{
                  border: masterFinalizePreview.ok ? "1px solid #86efac" : "1px solid #fecaca",
                  borderRadius: 18,
                  padding: 18,
                  background: masterFinalizePreview.ok ? "#f0fdf4" : "#fef2f2",
                  display: "grid",
                  gap: 8,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 18 }}>
                  {masterFinalizePreview.ok ? "Master Finalization Preview Ready" : "Master Finalization Preview Blocked"}
                </h3>


                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                  <div>
                    <strong>Clio Upload Target:</strong><br />
                    {masterDocumentPreviewText(masterFinalizePreview?.clioUploadTarget?.displayNumber) || "—"}
                    {masterFinalizePreview?.clioUploadTarget?.matterId
                      ? ` / Matter ID ${masterFinalizePreview.clioUploadTarget.matterId}`
                      : ""}
                  </div>
                  <div>
                    <strong>Upload Destination:</strong><br />
                    {masterDocumentPreviewText(masterFinalizePreview?.clioUploadTarget?.type) || "—"}
                  </div>
                  <div>
                    <strong>Status:</strong><br />
                    {masterFinalizePreview.ok ? "Ready" : "Blocked"}
                  </div>
                </div>

                {Array.isArray(masterFinalizePreview?.plannedDocuments) && masterFinalizePreview.plannedDocuments.length > 0 && (
                  <div>
                    <strong>Planned Documents:</strong>{" "}
                    {masterFinalizePreview.plannedDocuments
                      .map((doc: any) => masterDocumentPreviewText(doc?.label) || masterDocumentPreviewText(doc?.filename) || masterDocumentPreviewText(doc?.key))
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                )}

                {Array.isArray(masterFinalizePreview?.validation?.blockingErrors) &&
                  masterFinalizePreview.validation.blockingErrors.length > 0 && (
                    <div style={{ color: "#991b1b", fontWeight: 900 }}>
                      Blocking errors: {masterFinalizePreview.validation.blockingErrors.join(" ")}
                    </div>
                  )}

                {masterFinalizePreview?.existingDocumentCheck?.matchCount > 0 && (
                  <div
                    style={{
                      padding: 8,
                      borderRadius: 10,
                      background: "#fef2f2",
                      border: "1px solid #dc2626",
                      color: "#991b1b",
                      fontWeight: 850,
                    }}
                  >
                    Existing repository document warning: one or more planned final documents already exists in the Barsh Matters Master Repository document storage.  The upload endpoint skips exact filename matches by default to prevent duplicates.
                  </div>
                )}
              </section>
            )}



            {masterSettlementUploadNotice && (
              <section
                style={{
                  border: "1px solid #bfdbfe",
                  borderRadius: 18,
                  padding: 16,
                  background: "#eff6ff",
                  color: "#00346e",
                  fontWeight: 900,
                  lineHeight: 1.45,
                }}
              >
                {masterSettlementUploadNotice}
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
                  <h3 style={{ margin: 0, fontSize: 18 }}>Document Delivery</h3>
                  <span style={{ display: "none" }}>Document Delivery — Standalone</span>
                </div>
                {isSettlementDocumentMode ? (
                  <div
                    style={{
                      display: "grid",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 10,
                      }}
                    >
                      {actionButton(
                        masterDocumentPrintQueueLoading ? "Sending to Print Queue..." : "Send to Print Queue",
                        () => sendMasterDocumentToPrintQueue(displayedSelectedTemplate),
                        masterDocumentPrintQueueLoading || !masterDocumentFinalizationResult?.finalizationRecord?.id
                      )}
                      {actionButton(
                        "Save Finalized PDF",
                        () => saveMasterSettlementDocumentLocally(displayedSelectedTemplate),
                        !masterDocumentFinalizationResult?.finalizationRecord?.id
                      )}
                      {actionButton(
                        "Print Finalized Document",
                        () => launchMasterDocumentPrint(displayedSelectedTemplate),
                        !masterDocumentFinalizationResult?.finalizationRecord?.id
                      )}
                      <button
                        onClick={() => void launchSettlementFinalizedDocumentEmail()}
                        type="button"
                        disabled={!masterDocumentFinalizationResult?.finalizationRecord?.id}
                        title="Create an Outlook draft with the finalized settlement PDF attached from the Barsh Matters Master Repository storage."
                        style={{
                          border: "none",
                          background: masterDocumentFinalizationResult?.finalizationRecord?.id ? "#00346e" : "#c7d2fe",
                          boxShadow: "0 10px 25px rgba(0, 52, 110,0.18)",
                          color: "#ffffff",
                          borderRadius: 14,
                          padding: "12px 16px",
                          fontWeight: 900,
                          cursor: masterDocumentFinalizationResult?.finalizationRecord?.id ? "pointer" : "not-allowed",
                        }}
                      >
                        Email Finalized Document
                      </button>
                      {masterSettlementEmailNotice && (
                        <div
                          style={{
                            marginTop: 10,
                            border: "1px solid #bbf7d0",
                            background: "#f0fdf4",
                            color: "#166534",
                            borderRadius: 12,
                            padding: "10px 12px",
                            fontWeight: 800,
                            fontSize: 13,
                          }}
                        >
                          {masterSettlementEmailNotice}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    <label style={{ display: "grid", gap: 6, maxWidth: 420 }}>
                      <span style={{ fontWeight: 850, color: "#385a83" }}>To Email for Document Delivery</span>
                      <input
                        value={masterDocumentDeliveryToOverride}
                        onChange={(event) => setMasterDocumentDeliveryToOverride(event.target.value)}
                        placeholder="Recipient email"
                        style={{
                          border: "1px solid #cbd5e1",
                          borderRadius: 10,
                          padding: "9px 10px",
                          fontWeight: 750,
                        }}
                      />
                      {masterDocumentDeliveryToOverride.trim() && !isValidDocumentDeliveryEmail(masterDocumentDeliveryToOverride) && (
                        <span style={{ color: "#b91c1c", fontSize: 12, fontWeight: 800 }}>Enter a valid email address.</span>
                      )}
                    </label>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {actionButton(
                        "Email Document",
                        () => launchMasterDocumentEmail(displayedSelectedTemplate),
                        Boolean(masterDocumentDeliveryToOverride.trim()) && !isValidDocumentDeliveryEmail(masterDocumentDeliveryToOverride),
                        "Create an Outlook draft with the finalized PDF attached."
                      )}
                      {actionButton("Print Document", () => launchMasterDocumentPrint(displayedSelectedTemplate), false, "Open the finalized PDF/printable document.")}
                      {actionButton("Send to Print Queue", () => sendMasterDocumentToPrintQueue(displayedSelectedTemplate), false, "Send this finalized document to the shared Barsh Matters print queue.")}
                    </div>
                  </div>
                )}
              </section>
            )}


            {showDeliveryStep && (
              <div
                data-barsh-master-generate-documents-delivery-footer="true"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 0 0",
                  borderTop: "1px solid #e5e7eb",
                }}
              >
                <button
                  type="button"
                  onClick={() => setMasterDocumentWorkflowStage("chooseAction")}
                  style={{
                    minWidth: 118,
                    height: 38,
                    border: "1px solid #cbd5e1",
                    borderRadius: 10,
                    background: "#ffffff",
                    color: "#385a83",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setMasterDocumentGenerationPopupOpen(false)}
                  style={{
                    minWidth: 118,
                    height: 38,
                    border: "1px solid #dc2626",
                    borderRadius: 10,
                    background: "#dc2626",
                    color: "#ffffff",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
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
                <p style={{ margin: 0, color: "#385a83", lineHeight: 1.45 }}>
                  {masterDocumentPrintQueueResult.ok
                    ? `Print queue item ID ${masterDocumentPrintQueueResult.printQueueItem?.id || "created"} was saved locally.  No PDF was generated, no Clio upload occurred, no Outlook draft was created, and no email was sent.`
                    : masterDocumentPrintQueueResult.error || "Could not send this settlement document placeholder to the print queue."}
                </p>
                {masterDocumentPrintQueueResult?.printQueueItem?.filename && (
                  <p style={{ margin: 0, color: "#385a83", lineHeight: 1.45 }}>
                    Queue filename: <strong>{masterDocumentPrintQueueResult.printQueueItem.filename}</strong>
                  </p>
                )}
              </section>
            )}


            {masterDocumentDataPreview?.error && (
              <div style={{ color: "#991b1b", fontWeight: 900 }}>
                Error: {masterDocumentPreviewText(masterDocumentDataPreview.error)}
              </div>
            )}

            <details
              style={{
                display: "none",
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
                <p style={{ margin: "6px 0 12px", color: "#385a83", lineHeight: 1.45 }}>
                  Template data.
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

  function renderSettlementFinalizedEmailPreviewPopup() {
    if (!masterSettlementEmailPreviewPopupOpen) return null;

    const previewState = masterDocumentDeliveryPreview || {};
    const graphPayloadPreview = readDocumentDeliveryGraphPreview(previewState);
    const validation = graphPayloadPreview?.validation || graphPayloadPreview?.readiness || {};
    const validationErrors = Array.isArray(validation?.errors) ? validation.errors : [];
    const graphMessagePayload = graphPayloadPreview?.graphMessagePayload || {};
    const attachmentPlan = Array.isArray(graphPayloadPreview?.attachmentPlan)
      ? graphPayloadPreview.attachmentPlan
      : Array.isArray(previewState?.attachmentPlan)
        ? previewState.attachmentPlan
        : [];
    const readyForGraphDraftCreate = isDocumentDeliveryReadyForGraphDraft(previewState);

    const recipientSummary = (items: any) => {
      const list = Array.isArray(items) ? items : [];
      const labels = list
        .map((item: any) => {
          const emailAddress = item?.emailAddress || item || {};
          return emailAddress?.address || emailAddress?.email || item?.address || item?.email || "";
        })
        .filter(Boolean);
      return labels.length ? labels.join(", ") : "—";
    };

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settlement finalized document email draft preview popup"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50000,
          background: "rgba(15, 23, 42, 0.35)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "72px 24px 24px",
        }}
      >
        <div
          style={{
            width: "min(980px, calc(100vw - 48px))",
            maxHeight: "calc(100vh - 96px)",
            overflow: "auto",
            resize: "both",
            borderRadius: 24,
            border: "1px solid #bfdbfe",
            background: "#ffffff",
            boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
          }}
        >
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 1,
              borderBottom: "1px solid #dbeafe",
              background: "linear-gradient(135deg, #eff6ff, #f8fafc)",
              padding: "18px 22px",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 22, color: "#00346e" }}>Email Draft Preview</h2>
            <p style={{ margin: "6px 0 0", color: "#385a83", fontWeight: 650 }}>
              Settlement finalized PDF delivery.  This prepares an Outlook draft through Microsoft Graph.
            </p>
          </div>

          <div style={{ padding: 22 }}>
            {masterDocumentDeliveryPreviewLoading && (
              <div
                style={{
                  border: "1px solid #bfdbfe",
                  background: "#eff6ff",
                  color: "#00346e",
                  borderRadius: 16,
                  padding: 14,
                  fontWeight: 850,
                }}
              >
                Preparing Outlook draft preview...
              </div>
            )}

            {!masterDocumentDeliveryPreviewLoading && (
              <div style={{ display: "grid", gap: 14 }}>
                {previewState?.error && (
                  <div
                    style={{
                      border: "1px solid #fecaca",
                      background: "#fef2f2",
                      color: "#991b1b",
                      borderRadius: 16,
                      padding: 14,
                      fontWeight: 850,
                    }}
                  >
                    {previewState.error}
                  </div>
                )}

                <div
                  style={{
                    border: "1px solid #bbf7d0",
                    background: "#f0fdf4",
                    color: "#166534",
                    borderRadius: 16,
                    padding: 14,
                    display: "grid",
                    gap: 8,
                    fontWeight: 750,
                  }}
                >
                  <div><strong>Graph draft creation available:</strong> {readyForGraphDraftCreate ? "Yes" : "No"}</div>
                  <div><strong>To:</strong> {recipientSummary(graphMessagePayload?.toRecipients)}</div>
                  <div><strong>Cc:</strong> {recipientSummary(graphMessagePayload?.ccRecipients)}</div>
                  <div><strong>Bcc:</strong> {recipientSummary(graphMessagePayload?.bccRecipients)}</div>
                  <div><strong>Subject:</strong> {graphMessagePayload?.subject || "—"}</div>
                  <div><strong>Attachments planned:</strong> {attachmentPlan.length}</div>
                </div>

                {attachmentPlan.length > 0 && (
                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      borderRadius: 16,
                      padding: 14,
                    }}
                  >
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>Attachment Plan</div>
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {attachmentPlan.map((attachment: any, index: number) => (
                        <li key={`${attachment?.clioDocumentId || attachment?.name || "attachment"}-${index}`}>
                          {attachment?.name || attachment?.filename || "Finalized PDF"} · {attachment?.contentType || "application/pdf"}
                          {attachment?.graphUploadRequired ? " · Graph upload required" : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {validationErrors.length > 0 && (
                  <div
                    style={{
                      border: "1px solid #fde68a",
                      background: "#fffbeb",
                      color: "#92400e",
                      borderRadius: 16,
                      padding: 14,
                      fontWeight: 750,
                    }}
                  >
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>Draft Requirements</div>
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {validationErrors.map((error: any, index: number) => (
                        <li key={`settlement-email-validation-${index}`}>{String(error)}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {previewState?.draftCreated && (
                  <div
                    style={{
                      border: "1px solid #bbf7d0",
                      background: "#f0fdf4",
                      color: "#166534",
                      borderRadius: 16,
                      padding: 14,
                      fontWeight: 850,
                    }}
                  >
                    Outlook draft created.  Open Outlook to review and send when ready.
                  </div>
                )}

                {previewState?.createError && (
                  <div
                    style={{
                      border: "1px solid #fecaca",
                      background: "#fef2f2",
                      color: "#991b1b",
                      borderRadius: 16,
                      padding: 14,
                      fontWeight: 850,
                    }}
                  >
                    {previewState.createError}
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            style={{
              position: "sticky",
              bottom: 0,
              borderTop: "1px solid #e2e8f0",
              background: "#ffffff",
              padding: "14px 22px",
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={() => setMasterSettlementEmailPreviewPopupOpen(false)}
              style={{
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#385a83",
                borderRadius: 999,
                padding: "10px 16px",
                fontWeight: 850,
                cursor: "pointer",
              }}
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => void createMasterDocumentOutlookDraft()}
              disabled={!readyForGraphDraftCreate || masterDocumentDraftCreateLoading || Boolean(previewState?.draftCreated)}
              style={{
                border: !readyForGraphDraftCreate || masterDocumentDraftCreateLoading || previewState?.draftCreated ? "1px solid #cbd5e1" : "1px solid #00346e",
                background: !readyForGraphDraftCreate || masterDocumentDraftCreateLoading || previewState?.draftCreated ? "#f8fafc" : "#00346e",
                color: !readyForGraphDraftCreate || masterDocumentDraftCreateLoading || previewState?.draftCreated ? "#385a83" : "#ffffff",
                borderRadius: 999,
                padding: "10px 16px",
                fontWeight: 900,
                cursor: !readyForGraphDraftCreate || masterDocumentDraftCreateLoading || previewState?.draftCreated ? "not-allowed" : "pointer",
              }}
            >
              {masterDocumentDraftCreateLoading ? "Creating Draft..." : previewState?.draftCreated ? "Draft Created" : "Create Outlook Draft"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderMasterDocumentDeliveryPopup() {
    if (!masterDocumentDeliveryPopupOpen) return null;

    const documentData = masterDocumentDataPreview?.packet?.metadata?.documentData;
    const templateFields = documentData?.templateFields || {};
    const uiFields = documentData?.uiFields || {};
    const claimIndexFields = documentData?.claimIndexFields || {};
    const isSettlementDocumentMode =
      masterDocumentLaunchMode === "settlement" ||
      masterDocumentDataPreview?.documentLaunchMode === "settlement" ||
      masterDocumentDataPreview?.action === "settlement-documents-preview";

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
    const repositoryDocumentOptions = Array.isArray(masterDocumentRepositoryTemplates)
      ? masterDocumentRepositoryTemplates.map((template: any) => {
          const currentVersion = template?.currentVersion || null;
          const hasStoredDocx = Boolean(currentVersion?.hasStoredDocx);
          return {
            key: String(template?.key || ""),
            label: String(template?.label || template?.key || "Document"),
            description: [
              template?.description ? String(template.description) : "",
              hasStoredDocx ? `Stored DOCX: ${currentVersion?.storedDocxBytes || 0} bytes` : "",
              template?.mergeFieldSet ? `Merge fields: ${template.mergeFieldSet}` : "",
              template?.repositorySource ? `Repository: ${template.repositorySource}` : "Repository: Barsh Matters template repository",
            ].filter(Boolean).join("  "),
            hasStoredDocx,
            storedDocxBytes: currentVersion?.storedDocxBytes || 0,
            currentVersionId: currentVersion?.id || "",
            templateSource: hasStoredDocx ? "barsh-matters-db-template-repository" : "barsh-matters-template-repository",
          };
        }).filter((template: any) => template.key)
      : [];
    const settlementPreviewDocumentOptions = Array.isArray(masterDocumentDataPreview?.plannedDocuments)
      ? masterDocumentDataPreview.plannedDocuments.map((doc: any) => ({
          key: String(doc?.key || ""),
          label: String(doc?.label || doc?.key || "Settlement Document"),
          description: [
            doc?.description ? String(doc.description) : "",
            doc?.filename ? `File: ${doc.filename}` : "",
          ].filter(Boolean).join("  "),
        })).filter((doc: any) => doc.key)
      : [];
    const settlementDocumentOptions = repositoryDocumentOptions.length > 0
      ? repositoryDocumentOptions
      : settlementPreviewDocumentOptions;
    const storedRepositoryDocumentOptions = repositoryDocumentOptions.filter((option: any) => option.hasStoredDocx);
    const displayedTemplateOptions = isSettlementDocumentMode
      ? settlementDocumentOptions
      : [
          ...storedRepositoryDocumentOptions,
          ...sortedTemplateOptions,
        ];
    const displayedSelectedTemplate =
      displayedTemplateOptions.find((option: any) => option.key === masterSelectedDocumentTemplateKey) ||
      displayedTemplateOptions.find((option: any) => option.label.toLowerCase() === query) ||
      null;

    const deliveryButtonStyle: React.CSSProperties = {
      border: "1px solid #00346e",
      background: "#00346e",
      color: "#ffffff",
      borderRadius: 12,
      padding: "10px 14px",
      fontWeight: 900,
      cursor: "pointer",
      boxShadow: "0 10px 20px rgba(0, 52, 110, 0.18)",
    };

    const pendingButtonStyle: React.CSSProperties = {
      border: "1px solid #d1d5db",
      background: "#f3f4f6",
      color: "#385a83",
      borderRadius: 12,
      padding: "10px 14px",
      fontWeight: 900,
      cursor: "not-allowed",
    };

    const secondaryDeliveryButtonStyle: React.CSSProperties = {
      border: "1px solid #cbd5e1",
      background: "#ffffff",
      color: "#00346e",
      borderRadius: 12,
      padding: "10px 14px",
      fontWeight: 900,
      cursor: "pointer",
      boxShadow: "0 8px 16px rgba(15, 23, 42, 0.08)",
    };

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Master Lawsuit Document Delivery"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10001,
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
            background: "#ffffff",
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
              <h2 style={{ margin: 0, fontSize: 22 }}>Document Delivery</h2>
              <p style={{ margin: "8px 0 0", color: "#385a83", lineHeight: 1.45 }}>
                Use this delivery popup after Master/Lawsuit final upload completes or is safely processed with duplicate-file skipping.  Email prepares an Outlook draft preview, Print opens a current finalized document in repository storage, and Queue adds current finalized document in repository storage records to the Barsh Matters print queue.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMasterDocumentDeliveryPopupOpen(false)}
              style={{
                border: "1px solid #d1d5db",
                background: "#ffffff",
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
            <section
              data-barsh-master-document-delivery-popup-actions="true"
              style={{
                border: "1px solid #dbeafe",
                borderRadius: 18,
                padding: 18,
                background: "#eff6ff",
                display: "grid",
                gap: 14,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 18 }}>Delivery Options</h3>
                <p style={{ margin: "6px 0 0", color: "#385a83", lineHeight: 1.45 }}>
                  Choose how to deliver the finalized document.  Email prepares an Outlook draft preview; Edit opens DOCX files through Word when available; Print opens PDFs inline and DOCX files as a browser-controlled file; Queue adds finalized repository files to the Barsh Matters print queue.
                </p>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => launchMasterDocumentEmail(displayedSelectedTemplate)}
                  disabled={!displayedSelectedTemplate}
                  title={!displayedSelectedTemplate ? "Select a document before opening delivery options." : undefined}
                  style={displayedSelectedTemplate ? deliveryButtonStyle : pendingButtonStyle}
                >
                  Email Document
                </button>

                <button
                  type="button"
                  onClick={() => launchMasterDocumentEdit(displayedSelectedTemplate)}
                  disabled={!displayedSelectedTemplate}
                  title={!displayedSelectedTemplate ? "Select a finalized document before editing." : undefined}
                  style={displayedSelectedTemplate ? secondaryDeliveryButtonStyle : pendingButtonStyle}
                >
                  Edit Document
                </button>

                <button
                  type="button"
                  onClick={() => launchMasterDocumentPrint(displayedSelectedTemplate)}
                  disabled={!displayedSelectedTemplate}
                  title={!displayedSelectedTemplate ? "Select a finalized document before printing." : undefined}
                  style={displayedSelectedTemplate ? secondaryDeliveryButtonStyle : pendingButtonStyle}
                >
                  Print Document
                </button>

                <button
                  type="button"
                  onClick={() => sendMasterDocumentToPrintQueue(displayedSelectedTemplate)}
                  disabled={!displayedSelectedTemplate || masterDocumentPrintQueueLoading}
                  title={!displayedSelectedTemplate ? "Select a finalized document before sending it to the print queue." : undefined}
                  style={displayedSelectedTemplate && !masterDocumentPrintQueueLoading ? secondaryDeliveryButtonStyle : pendingButtonStyle}
                >
                  {masterDocumentPrintQueueLoading ? "Sending to Print Queue..." : "Send to Print Queue"}
                </button>
              </div>
            </section>

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
                    <h3 style={{ margin: 0, fontSize: 18 }}>Email Draft Preview</h3>
                  </div>

                  {masterDocumentDeliveryPreviewLoading && (
                    <div style={{ fontWeight: 900, color: "#00346e" }}>
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
                        <div><strong>Document:</strong> {previewState?.documentLabel || context?.documentLabel || displayedSelectedTemplate?.label || "Document"}</div>
                        <div><strong>To:</strong> {toDisplay}</div>
                        <div><strong>Cc / Deprecated MailDrop:</strong> {ccDisplay}</div>
                        <div><strong>Subject:</strong> {subjectDisplay}</div>
                        <div><strong>Attachments planned:</strong> {attachmentPlan.length}</div>
                        <div><strong>Finalized PDF attachments uploaded:</strong> {Array.isArray(previewState?.attachmentUploads) ? previewState.attachmentUploads.length : 0}</div>
                        <div><strong>Graph draft creation available:</strong> {readyForGraphDraftCreate ? "Yes" : "No"}</div>
                      </div>

                      <div style={{ display: "grid", gap: 6 }}>
                        <label style={{ fontWeight: 950, color: "#385a83" }}>
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
                            background: "#ffffff",
                          }}
                        />
                        <div style={{ color: "#385a83", fontSize: 12, lineHeight: 1.4 }}>
                          Use this only when local contact/reference data has not supplied a recipient.  Enter a valid email address such as name@example.com.
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
                          background: "#ffffff",
                          padding: 12,
                          display: "grid",
                          gap: 6,
                          color: "#385a83",
                        }}
                      >
                        <div><strong>Safety flags</strong></div>
                        <div>Creates Outlook draft from preview alone: No</div>
                        <div>Sends email: No</div>
                        <div>Writes Clio: No</div>
                        <div>Uploads document: No</div>
                        <div>Prints or queues document: No</div>
                        <div>MailDrop deprecated: {validation?.maildropInCcOnly ? "Yes" : "No"}</div>
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
                            color: "#00346e",
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
                              : "1px solid #00346e",
                            background: !readyForGraphDraftCreate || masterDocumentDraftCreateLoading || previewState?.draftCreated
                              ? "#f3f4f6"
                              : "#00346e",
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
          background: "#ffffff",
          boxShadow: "0 12px 26px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>Template Data Review</h3>
            <p style={{ margin: "6px 0 0", color: "#385a83", fontSize: 13, maxWidth: 860 }}>
              Template data review.
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
              background: masterDocumentDataPreviewLoading || !previewMasterLawsuitId ? "#e5e7eb" : "#00346e",
              color: masterDocumentDataPreviewLoading || !previewMasterLawsuitId ? "#385a83" : "#ffffff",
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
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#ffffff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#385a83", textTransform: "uppercase" }}>Lawsuit ID</div>
                <div style={{ fontWeight: 900 }}>{masterDocumentPreviewText(templateFields.masterLawsuitId) || previewMasterLawsuitId || "—"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#ffffff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#385a83", textTransform: "uppercase" }}>Ready for Templates</div>
                <div style={{ fontWeight: 900 }}>{documentData.readyForTemplates ? "Yes" : "No"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#ffffff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#385a83", textTransform: "uppercase" }}>Generates Documents</div>
                <div style={{ fontWeight: 900 }}>{documentData.generatesDocuments ? "Yes" : "No"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#ffffff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#385a83", textTransform: "uppercase" }}>Clio Correctness Dependency</div>
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
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#ffffff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#385a83", textTransform: "uppercase" }}>Provider</div>
                <div style={{ fontWeight: 900 }}>{masterDocumentPreviewText(templateFields.providerName) || masterDocumentPreviewText(claimIndexFields.providerName) || "—"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#ffffff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#385a83", textTransform: "uppercase" }}>Patient</div>
                <div style={{ fontWeight: 900 }}>{masterDocumentPreviewText(templateFields.patientName) || masterDocumentPreviewText(claimIndexFields.patientName) || "—"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#ffffff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#385a83", textTransform: "uppercase" }}>Insurer</div>
                <div style={{ fontWeight: 900 }}>{masterDocumentPreviewText(templateFields.insurerName) || masterDocumentPreviewText(claimIndexFields.insurerName) || "—"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#ffffff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#385a83", textTransform: "uppercase" }}>Claim Number</div>
                <div style={{ fontWeight: 900 }}>{masterDocumentPreviewText(templateFields.claimNumber) || masterDocumentPreviewText(claimIndexFields.claimNumber) || "—"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#ffffff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#385a83", textTransform: "uppercase" }}>Court</div>
                <div style={{ fontWeight: 900 }}>{masterDocumentPreviewText(templateFields.courtName) || masterDocumentPreviewText(uiFields.courtName) || "—"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#ffffff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#385a83", textTransform: "uppercase" }}>Index / AAA Number</div>
                <div style={{ fontWeight: 900 }}>{masterDocumentPreviewText(templateFields.indexAaaNumber) || masterDocumentPreviewText(uiFields.indexAaaNumber) || "—"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#ffffff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#385a83", textTransform: "uppercase" }}>Date of Loss</div>
                <div style={{ fontWeight: 900 }}>{masterDocumentPreviewDate(templateFields.dateOfLoss || uiFields.dateOfLoss) || "—"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#ffffff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#385a83", textTransform: "uppercase" }}>Date Filed</div>
                <div style={{ fontWeight: 900 }}>{masterDocumentPreviewDate(templateFields.dateFiled || uiFields.dateFiled) || "—"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#ffffff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#385a83", textTransform: "uppercase" }}>Court Costs Total</div>
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

            <div style={{ marginTop: 10, fontSize: 12, color: "#385a83", fontWeight: 800 }}>
              Refresh: {masterDocumentPreviewText(refresh.reason) || "—"}.
            </div>
          </>
        )}
      </section>
    );
  }

  function toggleClaimResultsSort(key: ClaimResultsSortKey) {
    setClaimResultsSort((current) => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        key,
        direction: "asc",
      };
    });
  }

  function claimResultsSortIndicator(key: ClaimResultsSortKey): string {
    if (claimResultsSort?.key !== key) return "";
    return claimResultsSort.direction === "asc" ? " ▲" : " ▼";
  }

  function sortableClaimResultsHeader(
    label: string,
    key: ClaimResultsSortKey,
    style: React.CSSProperties = thStyle
  ) {
    return (
      <th style={style}>
        <button
          type="button"
          onClick={() => toggleClaimResultsSort(key)}
          title={`Sort by ${label}`}
          style={claimResultsSortButtonStyle}
        >
          {label}
          {claimResultsSortIndicator(key)}
        </button>
      </th>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <BarshHeader
          onAdministratorClick={openAdministratorMenu}
          center={
            kind === "master" && value ? (
              <div
                style={{
                  justifySelf: "center",
                  alignSelf: "center",
                  display: "grid",
                  justifyItems: "center",
                  gap: 8,
                  textAlign: "center",
                  minWidth: 320,
                }}
              >
                <div
                  style={{
                    color: "#00346e",
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
                      border: masterFinalStatusDisplayValue() === "Closed" ? "2px solid #dc2626" : "2px solid #16a34a",
                      borderRadius: 999,
                      background: masterFinalStatusDisplayValue() === "Closed" ? "#fee2e2" : "#dcfce7",
                      color: masterFinalStatusDisplayValue() === "Closed" ? "#991b1b" : "#14532d",
                      fontSize: 34,
                      lineHeight: 1,
                      fontWeight: 950,
                      letterSpacing: "-0.01em",
                      whiteSpace: "nowrap",
                      boxShadow: masterFinalStatusDisplayValue() === "Closed" ? "0 10px 30px rgba(220, 38, 38, 0.18)" : "0 10px 30px rgba(22, 163, 74, 0.18)",
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
                      background: masterFinalStatusDisplayValue() === "Closed" ? "#dc2626" : "#16a34a",
                      color: "#ffffff",
                      fontSize: 13,
                      fontWeight: 950,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      boxShadow:
                        masterFinalStatusDisplayValue() === "Closed"
                          ? "0 4px 12px rgba(220, 38, 38, 0.25)"
                          : "0 4px 12px rgba(22, 163, 74, 0.25)",
                    }}
                  >
                    {masterFinalStatusDisplayValue()}
                  </span>

                  {(() => {
                    // Sibling (child) matter bubbles — one per child matter of this lawsuit,
                    // deduped by display number, colored by each matter's own Open/Closed status,
                    // linking to the individual matter page. Same look/feel as the header pills.
                    const seen = new Set<string>();
                    const siblings: { key: string; label: string; href: string; closed: boolean }[] = [];
                    for (const row of masterWorkspaceBillRows(masterSettlementDetailRows) as any[]) {
                      const display = clean(row?.displayNumber) || clean(row?.display_number);
                      const rowId = clean(row?.id);
                      const label = display || rowId;
                      const dedupeKey = (display || rowId).toLowerCase();
                      if (!label || seen.has(dedupeKey)) continue;
                      seen.add(dedupeKey);
                      siblings.push({
                        key: dedupeKey,
                        label,
                        href: `/matter/${encodeURIComponent(display || rowId)}`,
                        closed: clean(row?.finalStatus) === "Closed",
                      });
                    }
                    if (siblings.length === 0) return null;
                    return (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          justifyContent: "center",
                          alignItems: "center",
                          gap: 6,
                          marginTop: 8,
                          maxWidth: 520,
                        }}
                        data-barsh-master-sibling-matter-bubbles="true"
                      >
                        {siblings.map((s) => (
                          <a
                            key={s.key}
                            href={s.href}
                            title={`Open matter ${s.label}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "5px 13px",
                              borderRadius: 999,
                              border: s.closed ? "1px solid #fecaca" : "1px solid #bbf7d0",
                              background: s.closed ? "#fef2f2" : "#dcfce7",
                              color: s.closed ? "#991b1b" : "#166534",
                              fontSize: 14,
                              fontWeight: 800,
                              letterSpacing: "-0.01em",
                              whiteSpace: "nowrap",
                              textDecoration: "none",
                            }}
                          >
                            {s.label}
                          </a>
                        ))}
                      </div>
                    );
                  })()}
                </div>

              </div>
            ) : null
          }
        />

        <style jsx global>{`
          .barsh-filter-row:hover td {
            background: #f8fbff !important;
          }

          .barsh-filter-field-link:hover {
            color: #00346e !important;
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
                        color: "#00346e",
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
                  <input aria-label="Search Local Contact"
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
                                {normalizeProviderName(row.provider)}
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


            </div>
          </section>
        )}

        {kind === "master" && activeMasterWorkspaceTab === "email_threads" && renderMasterEmailThreadsPanel()}

        {kind === "master" && activeMasterWorkspaceTab !== "settlement" && activeMasterWorkspaceTab !== "email_threads" && activeMasterWorkspaceTab !== "documents" && (
          <section style={masterWorkspacePanelStyle}>

            {activeMasterWorkspaceTab !== "payments" && (
              <>
                <div style={masterWorkspacePanelHeaderStyle}>
                  <div>
                    <div style={masterWorkspacePanelEyebrowStyle}>Active Workspace</div>
                    <h2 style={masterWorkspacePanelTitleStyle}>
                      "Close Paid Settlements"
                    </h2>
                  </div>
                </div>

                <div style={masterWorkspaceCardsStyle}>
                  <div style={masterWorkspaceCardStyle}>
                    <div style={masterWorkspaceCardLabelStyle}>Purpose</div>
                    <div style={masterWorkspaceCardTextStyle}>
                      "Review paid settlement eligibility and close only confirmed paid settlement matters from the Master Lawsuit screen."
                    </div>
                  </div>

                  <div style={masterWorkspaceCardStyle}>
                    <div style={masterWorkspaceCardLabelStyle}>Safety</div>
                    <div style={masterWorkspaceCardTextStyle}>
                      "Close actions will remain payment-confirmed only, preview-first, and limited to eligible child/bill matters."
                    </div>
                  </div>

                  <div style={masterWorkspaceCardStyle}>
                    <div style={masterWorkspaceCardLabelStyle}>Next UI Step</div>
                    <div style={masterWorkspaceCardTextStyle}>


              "Move settlement close preview into this Close Paid Settlements workspace."
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
                  <div
                    data-barsh-master-claim-lawsuit-costs-notes-status-layout="true"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) 680px",
                      gap: 10,
                      alignItems: "stretch",
                    }}
                  >
                    <div
                      data-barsh-master-left-info-column="true"
                      style={{
                        display: "grid",
                        gap: 14,
                        alignItems: "start",
                        width: "calc(100% + 490px)",
                        maxWidth: "calc(100% + 490px)",
                      }}
                    >

                  <section
                    style={{
                      display: "grid",
                      gap: 10,
                      padding: "0 12px 12px",
                      borderTop: "none",
                      borderBottom: "none",
                      borderLeft: "none",
                      borderRight: "none",
                      borderRadius: 0,
                      background: "#ffffff",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 950,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#00346e",
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
                      </div>

                      <div style={masterInfoCardStyle}>
                        <span style={masterSummaryCardTitleStyle}>Date of Loss</span>
                        <strong style={masterSummaryCardValueStyle}>{masterDateOfLossDisplayValue()}</strong>
                      </div>
                    </div>
                  </section>

                  <section
                    style={{
                      display: "grid",
                      gap: 10,
                      padding: 12,
                      borderTop: "1px solid #cbd5e1",
                      borderBottom: "none",
                      borderLeft: "none",
                      borderRight: "none",
                      borderRadius: 0,
                      background: "#ffffff",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 950,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#00346e",
                      }}
                    >
                      Lawsuit Information
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
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
                            color: "#00346e",
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
                            color: "#00346e",
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                      </div>

                      <div style={masterInfoCardStyle}>
                        <span style={masterSummaryCardTitleStyle}>Adversary Attorney</span>
                        <strong style={masterSummaryCardValueStyle}>
                          {clean(masterAdversaryAttorneyDisplayValue()) && masterAdversaryAttorneyDisplayValue() !== "—" ? (
                            <button
                              type="button"
                              onClick={() => openMasterInfoEditDialog("adversaryAttorney", "Adversary Attorney", masterAdversaryAttorneyDisplayValue())}
                              className="barsh-filter-field-link"
                              style={{
                                ...fieldLinkStyle,
                                border: 0,
                                background: "transparent",
                                padding: 0,
                                margin: 0,
                                cursor: "pointer",
                                font: "inherit",
                                textAlign: "left",
                                display: "block",
                                width: "100%",
                              }}
                            >
                              {masterAdversaryAttorneyDisplayValue()}
                            </button>
                          ) : (
                            "—"
                          )}
                        </strong>
                        <button
                          type="button"
                          onClick={() => openMasterInfoEditDialog("adversaryAttorney", "Adversary Attorney", masterAdversaryAttorneyDisplayValue())}
                          title="Open Adversary Attorney edit dialog."
                          style={{
                            ...masterInfoCardEditButtonStyle,
                            borderColor: "#93c5fd",
                            background: "#ffffff",
                            color: "#00346e",
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
                            color: "#00346e",
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                      </div>






                    </div>
                  </section>

                  <section
                    data-barsh-master-costs-section="true"
                    style={{
                      display: "grid",
                      gap: 10,
                      padding: 12,
                      borderTop: "1px solid #cbd5e1",
                      borderBottom: "none",
                      borderLeft: "none",
                      borderRight: "none",
                      borderRadius: 0,
                      background: "#ffffff",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 950,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#00346e",
                      }}
                    >
                      Costs
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                        gap: 12,
                        alignItems: "stretch",
                      }}
                    >
                      {([
                        ["filingFee", "Index Fee"],
                        ["serviceFee", "Service Fee"],
                        ["otherCourtCosts", "Other Court Costs"],
                      ] as Array<[MasterCostField, string]>).map(([field, label]) => (
                        <div key={field} style={masterInfoCardStyle}>
                          <span style={masterSummaryCardTitleStyle}>{label}</span>
                          <strong style={masterSummaryCardValueStyle}>{masterCostEntryTotalDisplay(field)}</strong>
                          {masterCostEntryRecords(field).length > 0 && (
                            <div style={{ marginTop: 6, display: "grid", gap: 4, fontSize: 11, color: "#385a83", fontWeight: 800, lineHeight: 1.25 }}>
                              {masterCostEntryRecords(field).map((entry, entryIndex) => (
                                <div
                                  key={`${field}-${entry.date}-${entry.amount}-${entryIndex}`}
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr auto",
                                    alignItems: "center",
                                    gap: 6,
                                    opacity: entry.voided ? 0.58 : 1,
                                    textDecoration: entry.voided ? "line-through" : "none",
                                  }}
                                >
                                  <span>
                                    {money(masterCostRecordAmountNumber(entry.amount))} added {costEntryDateDisplay(entry.date)}
                                    {entry.voided ? " · VOIDED" : ""}
                                  </span>
                                  {entry.voided ? (
                                    <span style={{ color: "#991b1b", fontWeight: 950 }}>Voided</span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => void voidMasterCostEntry(field, entryIndex)}
                                      title={`Void ${label} entry.`}
                                      style={{
                                        border: "1px solid #ef4444",
                                        borderRadius: 999,
                                        background: "#ffffff",
                                        color: "#dc2626",
                                        fontSize: 10,
                                        fontWeight: 950,
                                        padding: "2px 7px",
                                        cursor: "pointer",
                                      }}
                                    >
                                      Void
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => openMasterInfoEditDialog(field, label, masterCostEntryTotalDisplay(field))}
                            title={`Add ${label}.`}
                            style={{
                              ...masterInfoCardEditButtonStyle,
                              borderColor: "#93c5fd",
                              background: "#ffffff",
                              color: "#00346e",
                              cursor: "pointer",
                            }}
                          >
                            Add Cost
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section
                    style={{
                      display: "grid",
                      gap: 10,
                      padding: 12,
                      borderTop: "1px solid #cbd5e1",
                      borderBottom: "none",
                      borderLeft: "none",
                      borderRight: "none",
                      borderRadius: 0,
                      background: "#ffffff",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 950,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#00346e",
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
                            border: "1px solid #00346e",
                            borderRadius: 999,
                            background: "#eff6ff",
                            color: "#00346e",
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
                                <div style={{ fontSize: 13, fontWeight: 850, color: "#00346e", whiteSpace: "pre-wrap" }}>
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
                                      background: "#ffffff",
                                      color: "#00346e",
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

                              <div style={{ fontSize: 11, fontWeight: 800, color: "#385a83" }}>
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

                  <section
                    data-barsh-master-status-section="true"
                    style={{
                      position: "relative",
                      display: "grid",
                      gap: 10,
                      width: 170,
                      maxWidth: "100%",
                      justifySelf: "start",
                      transform: "translateX(510px)",
                      padding: "12px 0 0 12",
                      alignSelf: "stretch",
                      alignContent: "start",
                      borderTop: "none",
                      borderBottom: "none",
                      borderLeft: "none",
                      borderRight: "none",
                      borderRadius: 0,
                      background: "transparent",
                    }}
                  >
                    <div
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        left: -18,
                        top: 0,
                        bottom: 0,
                        width: 1,
                        background: "#94a3b8",
                      }}
                    />
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 950,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#00346e",
                      }}
                    >
                      Lawsuit Status
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr",
                        gap: 12,
                        alignItems: "stretch",
                      }}
                    >
                      <div style={masterInfoCardStyle}>
                        <span style={masterSummaryCardTitleStyle}>Status</span>
                        <strong style={masterSummaryCardValueStyle}>{masterDetailedStatusDisplayValue()}</strong>
                        <button
                          type="button"
                          onClick={() => openMasterInfoEditDialog("status", "Status", masterDetailedStatusDisplayValue())}
                          title="Open Status edit dialog."
                          style={{
                            ...masterInfoCardEditButtonStyle,
                            borderColor: "#93c5fd",
                            background: "#ffffff",
                            color: "#00346e",
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                      </div>

                      <div style={masterInfoCardStyle}>
                        <span style={masterSummaryCardTitleStyle}>Final Status</span>
                        <strong
                          style={{
                            ...masterSummaryCardValueStyle,
                            color: masterFinalStatusDisplayValue() === "Closed" ? "#991b1b" : "#166534",
                          }}
                        >
                          {masterFinalStatusDisplayValue()}
                        </strong>
                      </div>

                      <div style={masterInfoCardStyle}>
                        <span style={masterSummaryCardTitleStyle}>Closed Reason</span>
                        <strong style={masterSummaryCardValueStyle}>{masterClosedReasonDisplayValue()}</strong>
                      </div>

                      <div style={{ border: "1px solid #dbe4f0", borderRadius: 14, background: "#ffffff", padding: 12, display: "grid", gap: 8, boxShadow: "0 10px 22px rgba(15, 23, 42, 0.04)" }} data-barsh-master-court-dates-status-box="true">
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                          <span style={masterSummaryCardTitleStyle}>Court Dates</span>
                        </div>
                        {masterCourtDatesListLoading ? (
                          <div style={{ fontSize: 12, color: "#385a83", fontWeight: 800 }}>Loading Court Dates...</div>
                        ) : masterCourtDatesListError ? (
                          <div style={{ fontSize: 12, color: "#991b1b", fontWeight: 850 }}>{masterCourtDatesListError}</div>
                        ) : masterCourtDatesList.length === 0 ? (
                          <div style={{ fontSize: 12, color: "#385a83", fontWeight: 800 }}>No Court Dates.</div>
                        ) : (() => {
                          const courtDateGroups = splitMasterCourtDatesByTiming();
                          return (
                            <div style={{ display: "grid", gap: 10 }} data-barsh-master-court-dates-upcoming-past="true">
                              {renderMasterCourtDateSection("Upcoming Appearances", courtDateGroups.upcoming, "No upcoming appearances.", "upcoming")}
                              {renderMasterCourtDateSection("Past Appearances", courtDateGroups.past, "No past appearances.", "past")}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </section>
                  </div>
                </div>

                <div
                  data-barsh-master-actions-outer-section="true"
                  style={{
                    position: "relative",
                    display: "grid",
                    gap: 8,
                    background: "transparent",
                    padding: "0 0 0 20px",
                    border: "none",
                    borderRadius: 0,
                    boxShadow: "none",
                    alignSelf: "stretch",
                    alignContent: "start",
                  }}
                >
                  {/* Vertical divider separating the Lawsuit Status column from this Actions rail. */}
                  <div
                    aria-hidden="true"
                    style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 1, background: "#94a3b8" }}
                  />
                  <div
                    data-barsh-master-actions-section-heading="true"
                    style={{
                      fontSize: 12,
                      fontWeight: 950,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "#00346e",
                      marginBottom: 8,
                    }}
                  >
                    Actions
                  </div>

                  <div
                    data-barsh-master-action-area-option-e="true"
                    style={{
                      display: "grid",
                      gap: 10,
                      marginBottom: 14,
                      padding: 12,
                      border: "1px solid #dbeafe",
                      borderRadius: 14,
                      background: "#ffffff",
                    }}
                  >
                    <div
                      data-barsh-master-action-tab-row="true"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                        gap: 8,
                        alignItems: "stretch",
                      }}
                    >
                      {[
                        { key: "payments", label: "Payments", fill: "#16a34a", soft: "#f0fdf4", text: "#166534" },
                        { key: "settlement", label: "Settlement", fill: "#00346e", soft: "#eff6ff", text: "#00346e" },
                        { key: "documents", label: "Documents", fill: "#8b5e3c", soft: "#f8efe7", text: "#7c4a22" },
                        { key: "court_dates", label: "Court Dates", fill: "#ea580c", soft: "#fff7ed", text: "#c2410c" },
                        { key: "emails", label: "Emails", fill: "#00346e", soft: "#eef4fb", text: "#00346e" },
                      ].map(({ key, label, fill, soft, text }) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setMasterActionGroup(key as any)}
                            data-barsh-master-action-tab={key}
                            style={{
                              width: "100%",
                              minHeight: 40,
                              border: `1px solid ${fill}`,
                              borderRadius: 999,
                              background: masterActionGroup === key ? fill : soft,
                              color: masterActionGroup === key ? "#ffffff" : text,
                              fontSize: 12,
                              fontWeight: 950,
                              cursor: "pointer",
                              padding: "0 8px",
                              whiteSpace: "nowrap",
                              position: "relative",
                            }}
                          >
                            {label}
                            {key === "emails" && masterEmailUnread > 0 && (
                              <span data-barsh-master-emails-unread-badge="true" title={`${masterEmailUnread} unread incoming email${masterEmailUnread === 1 ? "" : "s"}`} style={{ position: "absolute", top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 999, background: "#dc2626", color: "#fff", fontSize: 11, fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px", border: "2px solid #fff" }}>{masterEmailUnread > 99 ? "99+" : masterEmailUnread}</span>
                            )}
                          </button>
                      ))}
                    </div>

                    <div data-barsh-master-action-panel="true" style={{ minHeight: masterActionGroup ? 52 : 0 }}>
                      {masterActionGroup === "payments" && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} data-barsh-master-action-section="payment-actions">
                          <button type="button" onClick={() => setMasterPaymentFormOpen(true)} title="Open lawsuit-level payment preview popup." style={{ minHeight: 36, border: "1px solid #16a34a", borderRadius: 999, background: "#f0fdf4", color: "#166534", fontSize: 12, fontWeight: 950, cursor: "pointer", padding: "0 14px" }}>Post Payment</button>
                          <button type="button" onClick={() => setMasterPaymentsPanelOpen((open) => open ? false : true)} title="Show recent lawsuit payment receipts." style={{ minHeight: 36, border: "1px solid #16a34a", borderRadius: 999, background: "#f0fdf4", color: "#166534", fontSize: 12, fontWeight: 950, cursor: "pointer", padding: "0 14px" }} data-barsh-master-view-payments-button="true">View Payments</button>
                        </div>
                      )}

                      {masterActionGroup === "settlement" && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} data-barsh-master-action-section="record-settlement">
                          <button type="button" onClick={() => { if (masterHasActiveRecordedSettlement) { openVoidActiveSettlementAdminFlow(); return; } resetMasterSettlementPreviewForm(); setMasterSettlementFormOpen(true); }} title={masterHasActiveRecordedSettlement ? "" : "Open settlement preview popup."} style={{ minHeight: 36, border: "1px solid #00346e", borderRadius: 999, background: "#eff6ff", color: "#00346e", fontSize: 12, fontWeight: 950, cursor: "pointer", padding: "0 14px" }}>{masterHasActiveRecordedSettlement ? "Settlement Recorded" : "Record Settlement"}</button>
                          <button type="button" onClick={() => setActiveMasterWorkspaceTab("settlement")} title="View settlement workspace for this lawsuit." style={{ minHeight: 36, border: "1px solid #00346e", borderRadius: 999, background: "#eff6ff", color: "#00346e", fontSize: 12, fontWeight: 950, cursor: "pointer", padding: "0 14px" }} data-barsh-master-view-settlements-button="true">View Settlements</button>
                          {masterHasActiveRecordedSettlement && (<button type="button" onClick={() => void openTemporaryNoPasswordVoidSettlementFlow()} disabled={masterSettlementVoidLoading || !activeMasterSettlementRecordForVoid()?.id} title="Temporary local-development shortcut: void the active local settlement without the administrator password gate." style={{ minHeight: 36, border: "1px solid #00346e", borderRadius: 999, background: masterSettlementVoidLoading || !activeMasterSettlementRecordForVoid()?.id ? "#f8fafc" : "#fff7ed", color: masterSettlementVoidLoading || !activeMasterSettlementRecordForVoid()?.id ? "#385a83" : "#9a3412", fontSize: 12, fontWeight: 950, cursor: masterSettlementVoidLoading || !activeMasterSettlementRecordForVoid()?.id ? "not-allowed" : "pointer", padding: "0 14px" }}>{masterSettlementVoidLoading ? "Voiding..." : "Temporary Void Settlement"}</button>)}
                        </div>
                      )}

                      {masterActionGroup === "documents" && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} data-barsh-master-action-section="documents-communications">
                          <button type="button" title="Open the Master Lawsuit Clio document picker." onClick={() => void openMasterViewDocumentsPopup()} style={{ minHeight: 36, border: "1px solid #8b5e3c", borderRadius: 999, background: "#f8efe7", color: "#7c4a22", fontSize: 12, fontWeight: 950, cursor: "pointer", padding: "0 14px" }} data-barsh-master-view-documents-button="true">View Documents</button>
                          <button type="button" title="Open the Master Lawsuit document generation preview popup." onClick={() => void launchMasterDocumentGenerationDialog()} style={{ minHeight: 36, border: "1px solid #8b5e3c", borderRadius: 999, background: "#f8efe7", color: "#7c4a22", fontSize: 12, fontWeight: 950, cursor: "pointer", padding: "0 14px" }} data-barsh-master-generate-documents-button="true">Generate Documents</button>
                      <span data-phase43f-direct-matter-ui-surface-attachment="true">{(() => { const phase43fDirectMatterDryRunRow = directMatterSingleMasterDryRunSurfaceRow(); return phase43fDirectMatterDryRunRow ? renderDirectMatterSingleMasterDryRunControlForRow(phase43fDirectMatterDryRunRow, {
                        selectedDocumentKey: masterSelectedDocumentTemplateKey,
                        workingDocumentDriveItemId: masterDocumentFinalizationResult?.workingDocument?.driveItemId || "",
                        workingDocumentKey: masterDocumentFinalizationResult?.selectedDocument?.key || masterSelectedDocumentTemplateKey,
                      }) : null; })()}</span>
                        </div>
                      )}

                      {masterActionGroup === "court_dates" && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} data-barsh-master-action-section="court-dates">
                          <button type="button" onClick={openMasterAddCourtDateDialog} title="Add a new Court Date for this lawsuit." style={{ minHeight: 36, border: "1px solid #ea580c", borderRadius: 999, background: "#fff7ed", color: "#c2410c", fontSize: 12, fontWeight: 950, cursor: "pointer", padding: "0 14px" }} data-barsh-master-add-new-court-date-button="true">Add New Court Date</button>
                          <button type="button" onClick={openMasterEditCourtDatesDialog} title="Edit Court Calendar dates, appearance results, and notes for this lawsuit." style={{ minHeight: 36, border: "1px solid #ea580c", borderRadius: 999, background: "#fff7ed", color: "#c2410c", fontSize: 12, fontWeight: 950, cursor: "pointer", padding: "0 14px" }} data-barsh-master-edit-court-dates-button="true">Edit Court Dates</button>
                        </div>
                      )}

                      {masterActionGroup === "emails" && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} data-barsh-master-action-section="emails">
                          <button type="button" title="View this lawsuit's email threads." onClick={() => { setMasterEmailComposeOpen(false); setActiveMasterWorkspaceTab("email_threads"); void loadMasterEmailThreadPreview(); }} style={{ minHeight: 36, border: "1px solid #00346e", borderRadius: 999, background: "#eef4fb", color: "#00346e", fontSize: 12, fontWeight: 950, cursor: "pointer", padding: "0 14px" }} data-barsh-master-view-emails-button="true">View Emails</button>
                          <button type="button" title="Compose and send a new email from this lawsuit." onClick={() => setMasterEmailComposeOpen(true)} style={{ minHeight: 36, border: "1px solid #00346e", borderRadius: 999, background: "#00346e", color: "#ffffff", fontSize: 12, fontWeight: 950, cursor: "pointer", padding: "0 14px" }} data-barsh-master-send-email-button="true">Send Email</button>
                        </div>
                      )}
                    </div>
                  </div>

                      {masterEditCourtDatesDialogOpen && (
                        <div role="dialog" aria-modal="true" aria-label="Edit Court Dates" onClick={closeMasterEditCourtDatesDialog} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeMasterEditCourtDatesDialog(); } }} tabIndex={-1} style={{ position: "fixed", inset: 0, zIndex: 50000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(15, 23, 42, 0.58)" }} data-barsh-master-edit-court-dates-popup="true">
                          <div onClick={(event) => event.stopPropagation()} style={{ width: "min(920px, calc(100vw - 48px))", maxHeight: "88vh", overflow: "auto", borderRadius: 18, background: "#ffffff", boxShadow: "0 28px 80px rgba(15, 23, 42, 0.35)", boxSizing: "border-box" }}>
                            <div style={{ background: "#00346e", color: "#ffffff", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 950, color: "#ffffff" }}>Edit Court Dates</h2>
                            </div>
                            <div style={{ padding: 18, display: "grid", gap: 14 }}>
                              {masterEditCourtDatesResult && !masterEditCourtDatesResult.ok && (<div style={{ border: "1px solid #fecaca", borderRadius: 12, background: "#fef2f2", color: "#991b1b", padding: 10, fontWeight: 900 }}>{masterEditCourtDatesResult.error || "Edit Court Date failed."}</div>)}
                              {masterEditCourtDatesResult?.ok && (<div style={{ border: "1px solid #bbf7d0", borderRadius: 12, background: "#f0fdf4", color: "#166534", padding: 10, fontWeight: 900 }}>{masterEditCourtDatesResult.message || "Court Date saved."}</div>)}
                              {masterCourtDatesList.length === 0 ? (
                                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#ffffff", color: "#385a83", padding: 12, fontWeight: 900 }}>No Court Dates to edit.</div>
                              ) : !masterEditCourtDatesSelectedId ? (
                                <div style={{ display: "grid", gap: 12 }} data-barsh-master-edit-court-date-chooser="true">
                                  <div style={{ fontSize: 14, fontWeight: 950, color: "#00346e" }}>Which Court Date do you want to edit?</div>
                                  <div style={{ display: "grid", gap: 8 }}>
                                    {masterEditableCourtDatesInDisplayOrder().map((courtEvent: any) => (
                                      <button key={courtEvent.id || `${courtEvent.eventDate}-${courtEvent.eventTime}-${courtEvent.appearanceType}`} type="button" onClick={() => { const selectedId = masterCourtDateEventKey(courtEvent); setMasterEditCourtDatesResult(null); setMasterEditCourtDatesSelectedEvent(courtEvent); setMasterEditCourtDatesForms((current) => ({ ...current, [selectedId]: masterCourtDateEditFormFromEvent(courtEvent) })); setMasterEditCourtDatesSelectedId(selectedId); }} style={{ minHeight: 42, border: "1px solid #e2e8f0", borderRadius: 12, background: "#ffffff", color: "#00346e", fontWeight: 900, textAlign: "left", padding: "8px 12px", cursor: "pointer" }} data-barsh-master-edit-court-date-choice-button="true">{masterCourtDateChoiceLabel(courtEvent)}</button>
                                    ))}
                                  </div>
                                </div>
                              ) : selectedMasterEditCourtDate() ? (
                                <div style={{ display: "grid", gap: 12 }} data-barsh-master-edit-court-date-selected-editor="true">
                                  <div style={{ fontSize: 13, fontWeight: 950, color: "#00346e" }}>{masterCourtDateChoiceLabel(selectedMasterEditCourtDate())}</div>
                                  {renderMasterEditCourtDateRow(selectedMasterEditCourtDate())}
                                </div>
                              ) : (
                                <div style={{ border: "1px solid #fecaca", borderRadius: 12, background: "#fef2f2", color: "#991b1b", padding: 12, fontWeight: 900, display: "grid", gap: 10 }}><div>Selected Court Date could not be found.</div><button type="button" onClick={() => { setMasterEditCourtDatesSelectedId(""); setMasterEditCourtDatesSelectedEvent(null); setMasterEditCourtDatesResult(null); }} style={{ minHeight: 32, border: "1px solid #00346e", borderRadius: 999, background: "#eff6ff", color: "#00346e", fontWeight: 950, padding: "0 12px", cursor: "pointer" }}>Choose Court Date</button></div>
                              )}
                            </div>
                            <div style={{ padding: "0 18px 18px", display: "flex", justifyContent: masterEditCourtDatesSelectedId ? "space-between" : "flex-end", gap: 10 }}>
                              {masterEditCourtDatesSelectedId && (<button type="button" onClick={() => { setMasterEditCourtDatesSelectedId(""); setMasterEditCourtDatesSelectedEvent(null); setMasterEditCourtDatesResult(null); }} disabled={masterEditCourtDatesSavingId !== null} style={{ minHeight: 38, border: "1px solid #00346e", borderRadius: 999, background: "#eff6ff", color: "#00346e", fontWeight: 950, padding: "0 16px", cursor: masterEditCourtDatesSavingId !== null ? "not-allowed" : "pointer" }} data-barsh-master-edit-court-date-back-button="true">Back</button>)}
                              <button type="button" onClick={closeMasterEditCourtDatesDialog} disabled={masterEditCourtDatesSavingId !== null} style={{ minHeight: 38, border: "1px solid #dc2626", borderRadius: 999, background: "#dc2626", color: "#ffffff", fontWeight: 950, padding: "0 16px", cursor: masterEditCourtDatesSavingId !== null ? "not-allowed" : "pointer" }}>Cancel</button>
                            </div>
                          </div>
                        </div>
                      )}

                      {masterAddCourtDateDialogOpen && (
                        <div role="dialog" aria-modal="true" aria-label="Add New Court Date" onClick={closeMasterAddCourtDateDialog} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeMasterAddCourtDateDialog(); } }} tabIndex={-1} style={{ position: "fixed", inset: 0, zIndex: 50000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(15, 23, 42, 0.58)" }} data-barsh-master-add-new-court-date-popup="true">
                          <form onSubmit={(event) => void submitMasterAddCourtDate(event)} onClick={(event) => event.stopPropagation()} style={{ width: "min(500px, calc(100vw - 96px))", maxHeight: "88vh", overflow: "hidden", border: "1px solid #00346e", borderRadius: 18, background: "#ffffff", boxShadow: "0 28px 90px rgba(15, 23, 42, 0.34)", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
                            <div style={{ padding: "16px 20px", background: "#00346e", color: "#ffffff", textAlign: "center", borderTopLeftRadius: 18, borderTopRightRadius: 18 }}>
                              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 950, color: "#ffffff" }}>Add New Court Date</h2>
                            </div>
                            <div style={{ padding: 20, display: "grid", gap: 14, background: "#ffffff", overflowY: "auto" }}>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                                <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>Court Date<input type="date" required value={masterAddCourtDateForm.eventDate} onChange={(event) => setMasterAddCourtDateForm((prev) => ({ ...prev, eventDate: event.target.value }))} autoFocus style={{ height: 42, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 10px", fontWeight: 800, background: "#ffffff" }} /></label>
                                <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>Time<input type="time" required value={masterAddCourtDateForm.eventTime} onChange={(event) => setMasterAddCourtDateForm((prev) => ({ ...prev, eventTime: event.target.value }))} style={{ height: 42, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 10px", fontWeight: 800, background: "#ffffff" }} /></label>
                                <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>Appearance Type<select required value={masterAddCourtDateForm.appearanceType} onChange={(event) => setMasterAddCourtDateForm((prev) => ({ ...prev, appearanceType: event.target.value }))} style={{ height: 42, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 10px", fontWeight: 800, background: "#ffffff" }} data-barsh-master-court-date-appearance-type-required="true"><option value="">Select Appearance Type</option><option value="Motion">Motion</option><option value="Trial/Arbitration">Trial/Arbitration</option><option value="Conference">Conference</option><option value="Other">Other</option></select></label>
                                <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>Court<select required value={masterAddCourtDateForm.court} onChange={(event) => setMasterAddCourtDateForm((prev) => ({ ...prev, court: event.target.value }))} style={{ height: 42, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 10px", fontWeight: 800, background: "#ffffff" }} data-barsh-master-court-date-court-dropdown="true"><option value="">{masterAddCourtDateCourtOptionsLoading ? "Loading Courts..." : "Select Court"}</option>{masterCourtDateCourtOptions().map((court) => <option key={court} value={court}>{court}</option>)}</select></label>
                                <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>Calendar Number<input value={masterAddCourtDateForm.calendarNumber} onChange={(event) => setMasterAddCourtDateForm((prev) => ({ ...prev, calendarNumber: event.target.value }))} style={{ height: 42, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 10px", fontWeight: 800, background: "#ffffff" }} /></label>
                                <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>Judge / Arbitrator<input value={masterAddCourtDateForm.judgeOrArbitrator} onChange={(event) => setMasterAddCourtDateForm((prev) => ({ ...prev, judgeOrArbitrator: event.target.value }))} style={{ height: 42, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 10px", fontWeight: 800, background: "#ffffff" }} /></label>
                              </div>
                              <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>Notes<textarea value={masterAddCourtDateForm.notes} onChange={(event) => setMasterAddCourtDateForm((prev) => ({ ...prev, notes: event.target.value }))} style={{ minHeight: 82, border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, fontWeight: 800, background: "#ffffff" }} /></label>
                              {masterAddCourtDateResult && !masterAddCourtDateResult.ok && (<div style={{ border: "1px solid #fecaca", borderRadius: 12, background: "#fef2f2", color: "#991b1b", padding: 10, fontWeight: 900 }}>{masterAddCourtDateResult.error || "Add New Court Date failed."}</div>)}
                            </div>
                            <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 10, justifyContent: "flex-end", background: "#ffffff" }}>
                              <button type="button" onClick={closeMasterAddCourtDateDialog} disabled={masterAddCourtDateSaving} style={{ minHeight: 38, border: "1px solid #dc2626", borderRadius: 999, background: "#dc2626", color: "#ffffff", fontWeight: 950, padding: "0 16px", cursor: masterAddCourtDateSaving ? "not-allowed" : "pointer" }}>Cancel</button>
                              <button type="submit" disabled={masterAddCourtDateSaving || !masterAddCourtDateReady} style={{ minHeight: 38, border: "1px solid #00346e", borderRadius: 999, background: masterAddCourtDateSaving || !masterAddCourtDateReady ? "#93c5fd" : "#00346e", color: "#ffffff", fontWeight: 950, padding: "0 16px", cursor: masterAddCourtDateSaving || !masterAddCourtDateReady ? "not-allowed" : "pointer" }} data-barsh-master-court-date-add-button-gated="true">{masterAddCourtDateSaving ? "Adding..." : "Add Court Date"}</button>
                            </div>
                          </form>
                        </div>
                      )}

                      {masterCloseDialogOpen && (
                        <div
                          role="dialog"
                          aria-modal="true"
                          aria-label="Close Lawsuit"
                          onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeMasterCloseLawsuitDialog(); } }}
                          tabIndex={-1}
                          style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 50000,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 24,
                            background: "rgba(15, 23, 42, 0.58)",
                          }}
                        >
                          <div
                            onClick={(event) => event.stopPropagation()}
                            style={{
                              width: "min(520px, calc(100vw - 48px))",
                              maxHeight: "88vh",
                              overflow: "hidden",
                              border: "1px solid #00346e",
                              borderRadius: 18,
                              background: "#ffffff",
                              boxShadow: "0 28px 90px rgba(15, 23, 42, 0.34)",
                              display: "flex",
                              flexDirection: "column",
                            }}
                          >
                            <div style={{ padding: "16px 20px", background: "#00346e", color: "#ffffff", textAlign: "center", borderTopLeftRadius: 18, borderTopRightRadius: 18 }}>
                              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 950, color: "#ffffff" }}>Close Lawsuit</h2>
                            </div>

                            <div style={{ padding: 20, display: "grid", gap: 14, background: "#ffffff" }}>
                              <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>
                                <span>Closed Reason</span>
                                <select
                                  value={masterCloseReason}
                                  onChange={(event) => setMasterCloseReason(event.target.value)}
                                  disabled={masterClosing}
                                  autoFocus
                                  style={{
                                    height: 42,
                                    border: "1px solid #cbd5e1",
                                    borderRadius: 10,
                                    padding: "0 10px",
                                    fontWeight: 800,
                                    background: "#ffffff",
                                  }}
                                >
                                  <option value="">Select Closed Reason</option>
                                  {masterCloseReasonOptions.map((reason) => (
                                    <option key={reason} value={reason}>
                                      {reason}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              {masterCloseResult && !masterCloseResult.ok && (
                                <div style={{ padding: 12, border: "1px solid #fecaca", borderRadius: 10, background: "#fef2f2", color: "#991b1b", fontWeight: 850 }}>
                                  {clean(masterCloseResult.error) || "Close Lawsuit failed."}
                                </div>
                              )}
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 20px 18px", borderTop: "1px solid #e2e8f0", background: "#ffffff" }}>
                              <button
                                type="button"
                                onClick={closeMasterCloseLawsuitDialog}
                                disabled={masterClosing}
                                style={{
                                  minWidth: 96,
                                  height: 40,
                                  border: "1px solid #dc2626",
                                  borderRadius: 10,
                                  background: masterClosing ? "#fecaca" : "#dc2626",
                                  color: "#ffffff",
                                  fontWeight: 900,
                                  cursor: masterClosing ? "not-allowed" : "pointer",
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleMasterCloseLawsuit}
                                disabled={masterClosing || !masterCloseReason}
                                style={{
                                  minWidth: 132,
                                  height: 40,
                                  border: "1px solid #b91c1c",
                                  borderRadius: 10,
                                  background: masterClosing || !masterCloseReason ? "#fecaca" : "#b91c1c",
                                  color: "#ffffff",
                                  fontWeight: 950,
                                  cursor: masterClosing || !masterCloseReason ? "not-allowed" : "pointer",
                                }}
                              >
                                {masterClosing ? "Closing..." : "Close Lawsuit"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {renderMasterViewDocumentsPopup()}
                      {renderMasterEmailComposePopup()}
                      {renderMasterDocumentHistoryPopup()}
                      {renderMasterDocumentGenerationPopup()}
                      {renderMasterDocumentDeliveryPopup()}
                      {renderSettlementFinalizedEmailPreviewPopup()}

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
                        color: "#385a83",
                        fontWeight: 800,
                      }}
                    >
                      <span>Lawsuit Amount</span>
                      <strong style={{ color: "#00346e", fontSize: 18 }}>{money(masterPaymentSummary.lawsuitAmount)}</strong>
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
                        color: "#385a83",
                        fontWeight: 800,
                      }}
                    >
                      <span>Costs</span>
                      <strong style={{ color: "#00346e", fontSize: 17 }}>
                        {masterCourtCostsDisplayValue()}
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
                        color: "#385a83",
                        fontWeight: 800,
                      }}
                    >
                      <span>Payments</span>
                      <strong style={{ color: "#00346e", fontSize: 18 }}>{money(masterPaymentSummary.paymentsPosted)}</strong>
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
                        color: "#385a83",
                        fontWeight: 950,
                      }}
                    >
                      <span>Balance</span>
                      <strong style={{ color: "#00346e", fontSize: 22 }}>
                        {money(
                          masterPaymentSummary.lawsuitAmount +
                            masterSettlementCostDefaultValue() -
                            masterPaymentSummary.paymentsPosted
                        )}
                      </strong>
                    </div>

                    <button
                      type="button"
                      onClick={openMasterCloseLawsuitDialog}
                      disabled={masterClosing || !currentMasterLawsuitIdForDocumentPreview()}
                      title="Close this lawsuit locally and mark all child matters Closed with reason Closed Lawsuit."
                      data-barsh-master-close-under-balance="true"
                      style={{
                        width: "100%",
                        minWidth: 0,
                        height: 42,
                        border: "1px solid #ea580c",
                        borderRadius: 999,
                        background: masterClosing || !currentMasterLawsuitIdForDocumentPreview() ? "#f3f4f6" : "#dc2626",
                        color: masterClosing || !currentMasterLawsuitIdForDocumentPreview() ? "#385a83" : "#ffffff",
                        fontSize: 12,
                        fontWeight: 950,
                        cursor: masterClosing || !currentMasterLawsuitIdForDocumentPreview() ? "not-allowed" : "pointer",
                      }}
                    >
                      {masterClosing ? "Closing..." : "Close Lawsuit"}
                    </button>

                    {masterFinalStatusDisplayValue() === "Closed" && (
                      <button
                        type="button"
                        onClick={handleMasterReopenLawsuit}
                        disabled={masterReopening || !currentMasterLawsuitIdForDocumentPreview()}
                        title="Admin: reopen this lawsuit and reopen its child matters (local only)."
                        style={{
                          width: "100%",
                          minWidth: 0,
                          height: 42,
                          marginTop: 8,
                          border: "1px solid #00346e",
                          borderRadius: 999,
                          background: masterReopening || !currentMasterLawsuitIdForDocumentPreview() ? "#c7d2e4" : "#00346e",
                          color: "#ffffff",
                          fontSize: 12,
                          fontWeight: 950,
                          cursor: masterReopening || !currentMasterLawsuitIdForDocumentPreview() ? "not-allowed" : "pointer",
                        }}
                      >
                        {masterReopening ? "Reopening…" : "Reopen Lawsuit (Admin)"}
                      </button>
                    )}
                  </div>

                  {masterPaymentsPanelOpen && (
                    <div
                      data-barsh-master-payments-panel="true"
                      style={{
                        marginTop: 14,
                        paddingTop: 12,
                        borderTop: "1px solid #e2e8f0",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase", color: "#385a83" }}>
                          Recent Receipts
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#385a83" }}>
                          {masterPaymentReceiptsLoading ? "Loading..." : `${masterPaymentVisibleReceipts.length} shown / ${masterPaymentReceipts.length} total`}
                        </span>
                      </div>

                      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 11, fontWeight: 900, color: "#385a83", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        <input type="checkbox" checked={masterPaymentShowVoided} onChange={(event) => setMasterPaymentShowVoided(event.target.checked)} />
                        Show Voided
                      </label>

                      {masterPaymentReceiptsError && (
                        <div style={{ fontSize: 13, fontWeight: 750, color: "#385a83" }}>
                          {masterPaymentReceiptsError}
                        </div>
                      )}

                      {!masterPaymentReceiptsError && masterPaymentVisibleReceipts.length === 0 && (
                        <div style={{ fontSize: 13, fontWeight: 750, color: "#385a83" }}>
                          No child bill payment receipts are currently shown for this lawsuit.
                        </div>
                      )}

                      {!masterPaymentReceiptsError && masterPaymentVisibleReceipts.length > 0 && (
                        <div style={{ display: "grid", gap: 6, maxHeight: 230, overflowY: "auto", paddingRight: 2 }}>
                          {masterPaymentVisibleReceipts.slice(0, 8).map((receipt: any) => (
                            <div key={`master-payment-receipt-${receipt.sourceDisplayNumber || receipt.displayNumber}-${receipt.id}`} style={{ display: "grid", gridTemplateColumns: receipt.voided ? "1fr auto" : "1fr auto auto", gap: 6, padding: "8px 9px", border: receipt.voided ? "1px solid #fecaca" : "1px solid #dbe4f0", borderRadius: 12, background: receipt.voided ? "#fff7f7" : "#ffffff" }}>
                              <div style={{ display: "grid", gap: 2 }}>
                                <div style={{ fontSize: 12, fontWeight: 950, color: "#385a83" }}>
                                  {receipt.sourceDisplayNumber || receipt.displayNumber || "—"} · {receipt.paymentDate || receipt.transactionDate || "—"}
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 750, color: "#385a83" }}>
                                  {masterPaymentTransactionTypeDisplay(receipt.transactionType) || "Payment"} · {receipt.transactionStatus || "—"} · Check {receipt.checkNumber || "—"}
                                </div>
                                {receipt.voided && <div style={{ fontSize: 11, fontWeight: 900, color: "#385a83" }}>Voided</div>}
                              </div>
                              <strong style={{ fontSize: 13, color: receipt.voided ? "#991b1b" : "#166534", whiteSpace: "nowrap" }}>
                                {money(receipt.paymentAmount)}
                              </strong>
                              {!receipt.voided && (
                                <button type="button" disabled={masterPaymentVoidLoadingId === Number(receipt.id)} onClick={() => void handleVoidMasterPaymentReceipt(receipt)} title="Void this child payment receipt from the master lawsuit screen." style={{ border: "1px solid #cbd5e1", borderRadius: 999, background: "#ffffff", color: "#385a83", fontSize: 11, fontWeight: 950, padding: "3px 8px", cursor: masterPaymentVoidLoadingId === Number(receipt.id) ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                                  {masterPaymentVoidLoadingId === Number(receipt.id) ? "Voiding..." : "Void"}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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

            {masterPaymentClosePromptOpen && activeMasterWorkspaceTab === "payments" && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Close After Payment?"
                onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setMasterPaymentClosePromptOpen(false); } }}
                tabIndex={-1}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 50001,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 24,
                  background: "rgba(15, 23, 42, 0.58)",
                }}
              >
                <div
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    width: "min(520px, calc(100vw - 48px))",
                    maxHeight: "88vh",
                    overflow: "hidden",
                    border: "1px solid #00346e",
                    borderRadius: 18,
                    background: "#ffffff",
                    boxShadow: "0 28px 90px rgba(15, 23, 42, 0.34)",
                  }}
                >
                  <div style={{ padding: "16px 20px", background: "#00346e", color: "#ffffff", textAlign: "center", borderTopLeftRadius: 18, borderTopRightRadius: 18 }}>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 950, color: "#ffffff" }}>Close After Payment?</h2>
                  </div>

                  <div style={{ padding: 20, background: "#ffffff", color: "#00346e", fontSize: 15, fontWeight: 850, lineHeight: 1.45 }}>
                    Payment posted. Do you want to close this lawsuit now?
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 20px 18px", borderTop: "1px solid #e2e8f0", background: "#ffffff" }}>
                    <button
                      type="button"
                      onClick={() => setMasterPaymentClosePromptOpen(false)}
                      style={{
                        minWidth: 110,
                        height: 40,
                        border: "1px solid #dc2626",
                        borderRadius: 10,
                        background: "#dc2626",
                        color: "#ffffff",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMasterPaymentClosePromptOpen(false);
                        openMasterCloseLawsuitDialog();
                      }}
                      style={{
                        minWidth: 190,
                        height: 40,
                        border: "1px solid #15803d",
                        borderRadius: 10,
                        background: "#16a34a",
                        color: "#ffffff",
                        fontWeight: 950,
                        cursor: "pointer",
                      }}
                    >
                      Yes, Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {masterNoteDeleteTarget && activeMasterWorkspaceTab === "payments" && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Confirm note deletion"
                onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeDeleteMasterNoteDialog(); } }}
                tabIndex={-1}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 50001,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 24,
                  background: "rgba(15, 23, 42, 0.58)",
                }}
              >
                <div
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    width: "min(440px, calc(100vw - 48px))",
                    border: "1px solid #00346e",
                    borderRadius: 18,
                    background: "#ffffff",
                    boxShadow: "0 28px 90px rgba(15, 23, 42, 0.34)",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ padding: "16px 20px", background: "#00346e", color: "#ffffff", textAlign: "center", borderTopLeftRadius: 18, borderTopRightRadius: 18 }}>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 950, color: "#ffffff" }}>Delete Note?</h2>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "18px 20px", background: "#ffffff" }}>
                    <button
                      type="button"
                      onClick={closeDeleteMasterNoteDialog}
                      style={{
                        minWidth: 110,
                        height: 40,
                        border: "1px solid #dc2626",
                        borderRadius: 10,
                        background: "#dc2626",
                        color: "#ffffff",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      ref={masterNoteDeleteConfirmButtonRef}
                      type="button"
                      onClick={() => void confirmDeleteMasterNote()}
                      style={{
                        minWidth: 110,
                        height: 40,
                        border: "1px solid #b91c1c",
                        borderRadius: 10,
                        background: "#b91c1c",
                        color: "#ffffff",
                        fontWeight: 950,
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}

            {masterNoteDialogOpen && activeMasterWorkspaceTab === "payments" && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label={masterNoteEditingId ? "Edit Note" : "Add Note"}
                onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeMasterNoteDialog(); } }}
                tabIndex={-1}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 50000,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 24,
                  overflow: "hidden",
                  background: "rgba(15, 23, 42, 0.58)",
                }}
              >
                <div
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    width: "min(720px, 94vw)",
                    maxHeight: "88vh",
                    overflow: "hidden",
                    border: "1px solid #00346e",
                    borderRadius: 18,
                    background: "#ffffff",
                    boxShadow: "0 28px 90px rgba(15, 23, 42, 0.34)",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div style={{ padding: "16px 20px", background: "#00346e", color: "#ffffff", textAlign: "center", borderTopLeftRadius: 18, borderTopRightRadius: 18 }}>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 950, color: "#ffffff" }}>{masterNoteEditingId ? "Edit Note" : "Add Note"}</h2>
                  </div>

                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveMasterNote();
                    }}
                    style={{ display: "contents" }}
                  >
                    <div style={{ padding: 20, display: "grid", gap: 14, overflowY: "auto", background: "#ffffff" }}>
                      <label style={{ display: "grid", gap: 7, fontSize: 12, fontWeight: 950, color: "#00346e", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Note
                        <textarea
                          ref={masterNoteTextareaRef}
                          value={masterNoteDraft}
                          onChange={(event) => setMasterNoteDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            if (!event.metaKey && !event.ctrlKey) return;

                            event.preventDefault();
                            void saveMasterNote();
                          }}
                          placeholder="Type note here..."
                          style={{
                            width: "100%",
                            minHeight: 160,
                            border: "1px solid #cbd5e1",
                            borderRadius: 12,
                            padding: "11px 12px",
                            background: "#ffffff",
                            color: "#00346e",
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
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 20px 18px", borderTop: "1px solid #e2e8f0", background: "#ffffff" }}>
                      <button
                        type="button"
                        onClick={closeMasterNoteDialog}
                        style={{
                          minWidth: 110,
                          height: 40,
                          border: "1px solid #dc2626",
                          borderRadius: 10,
                          background: "#dc2626",
                          color: "#ffffff",
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!clean(masterNoteDraft)}
                        style={{
                          minWidth: 128,
                          height: 40,
                          border: "1px solid #15803d",
                          borderRadius: 10,
                          background: clean(masterNoteDraft) ? "#16a34a" : "#bbf7d0",
                          color: clean(masterNoteDraft) ? "#ffffff" : "#166534",
                          fontWeight: 950,
                          cursor: clean(masterNoteDraft) ? "pointer" : "not-allowed",
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
                data-barsh-master-info-edit-standard-modal="true"
                data-barsh-standard-modal-overlay="true"
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 50000,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 24,
                  overflow: "hidden",
                  background: "rgba(15, 23, 42, 0.58)",
                }}
                onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeMasterInfoEditDialog(); } }}
                tabIndex={-1}
              >
                <div
                  onClick={(event) => event.stopPropagation()}
                  data-barsh-standard-modal-shell="compact-field-edit"
                  style={{
                    width: "min(620px, 94vw)",
                    maxHeight: "88vh",
                    overflow: "hidden",
                    border: "1px solid #00346e",
                    borderRadius: 18,
                    background: "#ffffff",
                    boxShadow: "0 28px 90px rgba(15, 23, 42, 0.34)",
                  }}
                >
                  <div
                    data-barsh-standard-modal-header="true"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "32px minmax(0, 1fr) 32px",
                      alignItems: "center",
                      gap: 8,
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      padding: "12px 14px",
                      borderBottom: "1px solid #00346e",
                      background: "#00346e",
                      borderTopLeftRadius: 18,
                      borderTopRightRadius: 18,
                    }}
                  >
                    <div style={{ gridColumn: 2, justifySelf: "center", minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 17,
                          fontWeight: 950,
                          color: "#ffffff",
                          textAlign: "center",
                        }}
                        data-barsh-standard-modal-title="true"
                      >
                        {masterInfoFieldKind(masterInfoEditDialog.field) === "money" ? "Add" : "Edit"} {masterInfoEditDialog.label}
                      </div>
                      <div data-barsh-standard-modal-subtitle="true" />
                    </div>

                    <span data-barsh-standard-modal-close="removed" aria-hidden="true" />
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
                      gap: 12,
                      padding: 16,
                    }}
                  >
                    <div
                      data-barsh-standard-modal-current-card="true"
                      style={{
                        display: "grid",
                        gap: 6,
                        padding: "10px 12px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 12,
                        background: "#ffffff",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 950,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "#00346e",
                        }}
                      >
                        Current
                      </span>
                      <strong style={{ fontSize: 16, color: "#00346e" }}>
                        {masterInfoEditDialog.currentValue || "—"}
                      </strong>
                    </div>

                    {masterInfoFieldKind(masterInfoEditDialog.field) === "status" ? (
                      <label
                        style={{
                          display: "grid",
                          gap: 7,
                          fontSize: 12,
                          fontWeight: 950,
                          color: "#00346e",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        New Status
                        <select
                          ref={masterInfoPrimaryInputRef as any}
                          value={masterInfoEditValue}
                          onChange={(event) => setMasterInfoEditValue(event.target.value)}
                          style={{
                            width: "100%",
                            border: "1px solid #cbd5e1",
                            borderRadius: 12,
                            padding: "11px 12px",
                            background: "#ffffff",
                            color: "#00346e",
                            fontSize: 15,
                            fontWeight: 850,
                            outline: "none",
                            textTransform: "none",
                            letterSpacing: 0,
                          }}
                        >
                          <option value="">Select Status...</option>
                          {BARSH_MATTER_STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : masterInfoFieldKind(masterInfoEditDialog.field) === "court" ? (
                      <div style={{ display: "grid", gap: 10 }}>
                        <label
                          style={{
                            display: "grid",
                            gap: 7,
                            fontSize: 12,
                            fontWeight: 950,
                            color: "#00346e",
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
                              background: "#ffffff",
                              color: "#00346e",
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
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#00346e" }}>
                            Loading court list...
                          </div>
                        )}

                        {masterCourtOptionsError && (
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#00346e" }}>
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
                                border: "1px solid #cbd5e1",
                                borderRadius: 12,
                                background: "#ffffff",
                                color: "#00346e",
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
                            color: "#00346e",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          Search Adversary Attorney
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
                              background: "#ffffff",
                              color: "#00346e",
                              fontSize: 15,
                              fontWeight: 850,
                              outline: "none",
                              textTransform: "none",
                              letterSpacing: 0,
                            }}
                          />
                        </label>

                        {masterInfoContactLoading && (
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#00346e" }}>
                            Loading suggestions...
                          </div>
                        )}

                        {masterInfoSelectedContact && (
                          <div
                            style={{
                              padding: "9px 11px",
                              border: "1px solid #cbd5e1",
                              borderRadius: 12,
                              background: "#ffffff",
                              color: "#00346e",
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
                                  border: "1px solid #cbd5e1",
                                  borderRadius: 12,
                                  background: "#ffffff",
                                  color: "#00346e",
                                  cursor: "pointer",
                                  fontWeight: 850,
                                }}
                              >
                                {contact.name}
                                {contact.type ? <span style={{ color: "#00346e" }}> — {contact.type}</span> : null}
                              </button>
                            ))}
                          </div>
                        )}

                        {!masterInfoContactLoading && masterInfoContactSearch.length >= 2 && masterInfoContactResults.length === 0 && !masterInfoSelectedContact && (
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#00346e" }}>
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
                          color: "#00346e",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {masterInfoFieldKind(masterInfoEditDialog.field) === "money" ? "New Cost Amount" : `New ${masterInfoEditDialog.label}`}
                        {masterInfoFieldKind(masterInfoEditDialog.field) === "money" ? (
                          <div style={{ position: "relative", width: "100%" }}>
                            <span
                              style={{
                                position: "absolute",
                                left: 12,
                                top: "50%",
                                transform: "translateY(-50%)",
                                color: "#00346e",
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
                                background: "#ffffff",
                                color: "#00346e",
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
                              background: "#ffffff",
                              color: "#00346e",
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
                          border: "1px solid #dc2626",
                          borderRadius: 10,
                          background: "#dc2626",
                          color: "#ffffff",
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
                          border: "1px solid #15803d",
                          borderRadius: 10,
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


            {activeMasterWorkspaceTab === "payments" && masterSettlementHistory?.ok && Boolean(masterSettlementHistory.activeRecordId) && (
        <section
          data-barsh-local-settlement-history-panel="true"
          style={{
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            borderRadius: 18,
            padding: 16,
            marginTop: 18,
            marginBottom: 18,
            boxShadow: "0 10px 24px rgba(0, 52, 110, 0.08)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#00346e" }}>Recorded Settlement</div>
            </div>
          </div>

          <div
            data-barsh-settlement-payment-due-tickler-strip="true"
            style={{
              marginTop: 14,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 12,
              padding: "10px 12px",
              display: "flex",
              justifyContent: "center",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#00346e" }}>{masterSettlementPaymentDueFollowUpLabel()}</div>
              {!masterSettlementTicklersLoading && masterSettlementTicklers?.ok && Array.isArray(masterSettlementTicklers.ticklers) && masterSettlementTicklers.ticklers.length === 0 && (
                <div style={{ marginTop: 6, fontSize: 12, color: "#00346e" }}>No open payment due follow-up tickler yet.</div>
              )}
              {!masterSettlementTicklersLoading && masterSettlementTicklers?.error && (
                <div style={{ marginTop: 6, fontSize: 12, color: "#00346e" }}>{masterSettlementTicklers.error}</div>
              )}
            </div>
          </div>
          {masterSettlementHistoryLoading && !masterSettlementHistory ? (
            <div style={{ marginTop: 14, color: "#00346e", fontSize: 13 }}>Loading local settlement history...</div>
          ) : masterSettlementHistory?.ok && Array.isArray(masterSettlementHistory.records) && masterSettlementHistory.records.length > 0 ? (
            <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
              {masterSettlementHistory.records.map((record: any) => (
                <div
                  key={record.id}
                  style={{
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    borderRadius: 12,
                    padding: 14,
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(130px, 1fr))", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#00346e", fontWeight: 800, textTransform: "uppercase" }}>Principal Settlement</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#00346e" }}>{record.principalSettlementDisplay || formatSettlementHistoryMoney(record.allocatedSettlementTotal || 0)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#00346e", fontWeight: 800, textTransform: "uppercase" }}>Interest Settlement</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#00346e" }}>{record.interestSettlementDisplay || formatSettlementHistoryMoney(record.interestAmountTotal || 0)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#00346e", fontWeight: 800, textTransform: "uppercase" }}>Costs</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#00346e" }}>{formatSettlementHistoryMoney(record.costsAmount || 0)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#00346e", fontWeight: 800, textTransform: "uppercase" }}>Attorney Fee</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#00346e" }}>{formatSettlementHistoryMoney(record.totalFee || 0)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#00346e", fontWeight: 800, textTransform: "uppercase" }}>Total</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#00346e" }}>{formatSettlementHistoryMoney(record.totalSettlementAmount || 0)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#00346e", fontWeight: 800, textTransform: "uppercase" }}>Status</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: record.voided ? "#991b1b" : "#166534" }}>
                        {record.voided ? "Voided" : record.status || "Recorded"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#00346e", fontWeight: 800, textTransform: "uppercase" }}>Settled With</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#00346e" }}>{record.settledWith || "—"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#00346e", fontWeight: 800, textTransform: "uppercase" }}>Settlement Date</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#00346e" }}>{formatSettlementHistoryDate(record.settlementDate)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#00346e", fontWeight: 800, textTransform: "uppercase" }}>Payment Due</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#00346e" }}>{formatSettlementHistoryDate(record.paymentExpectedDate)}</div>
                    </div>
                  </div>

                  {Array.isArray(record.rows) && record.rows.length > 0 && (
                    <div style={{ marginTop: 14, overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "#ffffff", color: "#385a83" }}>
                            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e2e8f0" }}>Matter</th>
                            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e2e8f0" }}>Provider</th>
                            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e2e8f0" }}>Patient</th>
                            <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #e2e8f0" }}>Principal</th>
                            <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #e2e8f0" }}>Interest</th>
                            <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #e2e8f0" }}>Costs</th>
                            <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #e2e8f0" }}>Fee</th>
                            <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #e2e8f0" }}>Total</th>
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
                              <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9", textAlign: "right" }}>{formatSettlementHistoryMoney(row.costAmount || 0)}</td>
                              <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9", textAlign: "right" }}>{formatSettlementHistoryMoney(row.totalFee || 0)}</td>
                              <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9", textAlign: "right", fontWeight: 800 }}>{formatSettlementHistoryMoney(row.settlementTotal || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: "#ffffff" }}>
                            <td colSpan={3} style={{ padding: 8, borderTop: "1px solid #cbd5e1", textAlign: "right", fontWeight: 900, color: "#385a83", textTransform: "uppercase" }}>
                              Column Totals
                            </td>
                            <td style={{ padding: 8, borderTop: "1px solid #cbd5e1", textAlign: "right", fontWeight: 950, color: "#00346e" }}>
                              {formatSettlementHistoryMoney(record.allocatedSettlementTotal || 0)}
                            </td>
                            <td style={{ padding: 8, borderTop: "1px solid #cbd5e1", textAlign: "right", fontWeight: 950, color: "#00346e" }}>
                              {formatSettlementHistoryMoney(record.interestAmountTotal || 0)}
                            </td>
                            <td style={{ padding: 8, borderTop: "1px solid #cbd5e1", textAlign: "right", fontWeight: 950, color: "#00346e" }}>
                              {formatSettlementHistoryMoney(record.costsAmount || 0)}
                            </td>
                            <td style={{ padding: 8, borderTop: "1px solid #cbd5e1", textAlign: "right", fontWeight: 950, color: "#00346e" }}>
                              {formatSettlementHistoryMoney(record.totalFee || 0)}
                            </td>
                            <td style={{ padding: 8, borderTop: "1px solid #cbd5e1", textAlign: "right", fontWeight: 950, color: "#00346e" }}>
                              {formatSettlementHistoryMoney(record.totalSettlementAmount || 0)}
                            </td>
                          </tr>
                          <tr style={{ background: "#f1f5f9" }}>
                            <td colSpan={7} style={{ padding: 8, borderTop: "1px solid #cbd5e1", textAlign: "right", fontWeight: 950, color: "#385a83", textTransform: "uppercase" }}>
                              Gross Total
                            </td>
                            <td style={{ padding: 8, borderTop: "1px solid #cbd5e1", textAlign: "right", fontWeight: 950, color: "#00346e" }}>
                              {formatSettlementHistoryMoney(record.totalSettlementAmount || 0)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : masterSettlementHistory?.ok ? (
            <div style={{ marginTop: 14, color: "#385a83", fontSize: 13 }}>
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
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 24,
                  overflow: "hidden",
                  background: "rgba(15, 23, 42, 0.58)",
                }}
                onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setMasterSettlementFormOpen(false); } }}
                tabIndex={-1}
              >
                <div
                  data-barsh-standard-settlement-popup-shell="true"
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    width: "min(1480px, 98vw)",
                    minWidth: 980,
                    maxHeight: "88vh",
                    overflow: "auto",
                    border: "1px solid #00346e",
                    borderRadius: 18,
                    background: "#ffffff",
                    boxShadow: "0 28px 90px rgba(15, 23, 42, 0.34)",
                  }}
                >
                  <div
                    data-barsh-standard-settlement-popup-header="true"
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      padding: "16px 20px",
                      borderBottom: "1px solid #00346e",
                      background: "#00346e",
                      borderTopLeftRadius: 18,
                      borderTopRightRadius: 18,
                    }}
                  >
                    <span aria-hidden="true" />
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 950,
                        color: "#ffffff",
                        textAlign: "center",
                      }}
                    >
                      Record Settlement
                    </div>
                    <span data-barsh-standard-modal-close="removed" aria-hidden="true" />
                  </div>

                  <div
                    style={{
                      margin: "8px 18px 0",
                      padding: "7px 10px",
                      border: "1px solid #dbe4f0",
                      borderRadius: 14,
                      background: "#ffffff",
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 950, letterSpacing: "0.08em", textTransform: "uppercase", color: "#385a83" }}>
                      Settlement Based on
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, alignItems: "start" }}>
                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 900, color: "#00346e" }}>
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
                            background: "#ffffff",
                            color: "#00346e",
                            fontWeight: 900,
                          }}
                        >
                          {money(masterSettlementLawsuitAmountValue())}
                        </div>
                      </label>

                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 900, color: "#00346e" }}>
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
                            background: "#ffffff",
                            color: "#00346e",
                            fontWeight: 800,
                            outline: "none",
                          }}
                        />
                      </label>

                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 900, color: "#00346e" }}>
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
                            background: "#ffffff",
                            color: "#00346e",
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
                          value={shouldNormalizeDisplayedSettlementPercent(masterSettlementGrossInput) ? formatMasterSettlementAmountOrPercentInput(masterSettlementGrossInput) : masterSettlementGrossInput}
                          onChange={(event) => setMasterSettlementGrossInput(event.target.value)}
                          onBlur={() => setMasterSettlementGrossInput((current) => formatMasterSettlementAmountOrPercentInput(current))}
                          placeholder="$ amount or % of selected basis"
                          inputMode="decimal"
                          style={{
                            width: "100%",
                            border: "1px solid #cbd5e1",
                            borderRadius: 8,
                            padding: "8px 10px",
                            background: "#ffffff",
                            color: "#00346e",
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
                              background: "#ffffff",
                              color: "#00346e",
                              fontWeight: 800,
                              outline: "none",
                            }}
                          />
                          <span style={{ color: "#385a83", fontWeight: 900 }}>of</span>
                          <span
                            style={{
                              color: "#00346e",
                              fontWeight: 950,
                              fontSize: 18,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {money(masterSettlementSimpleInterestAmountValue())}
                          </span>
                          <span style={{ color: "#385a83", fontWeight: 900 }}>=</span>
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
                              background: "#ffffff",
                              color: "#00346e",
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
                            background: "#ffffff",
                            color: "#00346e",
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
                          list="master-settlement-contacts-list"
                          value={masterSettlementWithInput}
                          onChange={(event) => setMasterSettlementWithInput(event.target.value)}
                          placeholder="Start typing settled-with contact"
                          style={masterSettlementInputStyle}
                        />
                        <datalist id="master-settlement-contacts-list">
                          {masterSettlementContacts.map((contact: any) => {
                            const display = settlementContactDisplay(contact);
                            return <option key={contact.id || display} value={display} />;
                          })}
                        </datalist>
                        <div style={{ marginTop: 4, fontSize: 11, color: "#385a83", fontWeight: 700 }}>
                          Start typing, then choose a settlement contact from the predictive list.
                        </div>
                        {masterSettlementContactsLoading && (
                          <div style={{ marginTop: 4, fontSize: 11, color: "#385a83", fontWeight: 700 }}>
                            Loading settlement contacts...
                          </div>
                        )}
                        {masterSettlementContactsError && (
                          <div style={{ marginTop: 4, fontSize: 11, color: "#991b1b", fontWeight: 800 }}>
                            {masterSettlementContactsError}
                          </div>
                        )}
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
                            background: "#ffffff",
                            color: "#00346e",
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
                            background: "#ffffff",
                            color: "#00346e",
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
                            background: "#ffffff",
                            color: "#00346e",
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
                      display: masterPaymentRequiredFieldsComplete() ? "block" : "none",
                    }}
                  >
                    <div
                      style={{
                        padding: "7px 10px",
                        borderBottom: "1px solid #e2e8f0",
                        background: "#ffffff",
                        fontSize: 12,
                        fontWeight: 950,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "#385a83",
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
                          color: "#00346e",
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
                                <td style={{ padding: "6px 8px", border: "1px solid #e5e7eb", textAlign: "right", fontWeight: 950, color: "#00346e" }}>
                                  {money(settledPrincipal)}
                                </td>
                                <td style={{ padding: "6px 8px", border: "1px solid #e5e7eb", textAlign: "right", fontWeight: 950, color: "#00346e" }}>
                                  {money(settledInterest)}
                                </td>
                                <td style={{ padding: "6px 8px", border: "1px solid #e5e7eb", textAlign: "right", fontWeight: 950, color: "#00346e" }}>
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
                                      color: "#00346e",
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
                              <tr style={{ background: "#ffffff", fontWeight: 950 }}>
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
                          <div style={{ color: "#385a83", lineHeight: 1.45 }}>
                            Preview-only payload prepared for a future Barsh Matters local settlement record.  No final file is created until the workflow is finalized.  No database record is created here.
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
                          <div style={{ fontWeight: 950, color: masterSettlementRecordSave.ok ? "#00346e" : "#991b1b" }}>
                            Local Settlement Save Result
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
                      background: "#ffffff",
                      borderBottomLeftRadius: 18,
                      borderBottomRightRadius: 18,
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
                        color: "#ffffff",
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
                        color: "#385a83",
                        fontWeight: 900,
                        fontSize: 15,
                        cursor: "pointer",
                      }}
                    >
                      Clear
                    </button>

                    <button
                      type="button"
                      data-barsh-record-local-settlement-guarded-button="true"
                      onClick={commitMasterSettlementAndLaunchDocuments}
                      disabled={!masterSettlementCanCommit()}
                      title={
                        masterSettlementRequiredFieldMessage() ||
                        "Calculate and record the settlement in Barsh Matters, then open the settlement document workflow."
                      }
                      style={{
                        minWidth: 230,
                        height: 44,
                        border: !masterSettlementCanCommit() ? "1px solid #bbf7d0" : "1px solid #16a34a",
                        borderRadius: 12,
                        background: !masterSettlementCanCommit() ? "#dcfce7" : "#16a34a",
                        color: !masterSettlementCanCommit() ? "#166534" : "#ffffff",
                        fontWeight: 950,
                        fontSize: 15,
                        cursor: !masterSettlementCanCommit() ? "not-allowed" : "pointer",
                        opacity: !masterSettlementCanCommit() ? 0.78 : 1,
                        boxShadow: masterSettlementCanCommit() ? "0 10px 20px rgba(22, 163, 74, 0.24)" : "none",
                      }}
                    >
                      {masterSettlementRecordSaveLoading || masterSettlementLocalPreviewLoading
                        ? "Recording..."
                        : masterHasActiveRecordedSettlement
                          ? "Settlement Already Recorded"
                          : masterSettlementRequiredFieldMessage()
                            ? "Complete Required Fields"
                            : "Record Settlement"}
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

                    width: "min(1120px, 96vw)",
                    maxHeight: "calc(100vh - 178px)",
                    overflowY: "auto",
                    border: "1px solid #bfdbfe",
                    borderRadius: 18,
                    background: "#eff6ff",
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
                          color: "#00346e",
                        }}
                      >
                        Matter-Specific Audit / History
                      </div>
                      <div
                        style={{
                          marginTop: 3,
                          fontSize: 12,
                          fontWeight: 800,
                          color: "#00346e",
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
                          color: "#00346e",
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
                          color: "#385a83",
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
                          background: "#ffffff",
                          color: "#385a83",
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
                          background: "#ffffff",
                          color: "#385a83",
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
                                <div style={{ fontSize: 15, fontWeight: 950, color: "#00346e" }}>
                                  {entry.summary || entry.action || "Audit entry"}
                                </div>
                                <div style={{ marginTop: 4, fontSize: 12, color: "#385a83", fontWeight: 750 }}>
                                  {formatMasterAuditTimestamp(entry.createdAt)} · {entry.actorName || entry.actorEmail || "Unknown user"} · {entry.sourcePage || "unknown source"}
                                </div>
                              </div>

                              <div
                                style={{
                                  padding: "5px 9px",
                                  borderRadius: 999,
                                  border: "1px solid #bfdbfe",
                                  background: "#eff6ff",
                                  color: "#00346e",
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
                                <span style={{ fontSize: 11, color: "#385a83", fontWeight: 900, textTransform: "uppercase" }}>Field</span>
                                <strong style={{ fontSize: 13, color: "#00346e" }}>{entry.fieldName || "—"}</strong>
                              </div>

                              <div style={{ display: "grid", gap: 3 }}>
                                <span style={{ fontSize: 11, color: "#385a83", fontWeight: 900, textTransform: "uppercase" }}>Prior Value</span>
                                <strong style={{ fontSize: 13, color: "#00346e", overflowWrap: "anywhere" }}>{formatMasterAuditValue(entry.priorValue)}</strong>
                              </div>

                              <div style={{ display: "grid", gap: 3 }}>
                                <span style={{ fontSize: 11, color: "#385a83", fontWeight: 900, textTransform: "uppercase" }}>New Value</span>
                                <strong style={{ fontSize: 13, color: "#00346e", overflowWrap: "anywhere" }}>{formatMasterAuditValue(entry.newValue)}</strong>
                              </div>

                              <div style={{ display: "grid", gap: 3 }}>
                                <span style={{ fontSize: 11, color: "#385a83", fontWeight: 900, textTransform: "uppercase" }}>Matter</span>
                                <strong style={{ fontSize: 13, color: "#00346e" }}>{entry.masterMatterDisplayNumber || entry.matterDisplayNumber || "—"}</strong>
                              </div>
                            </div>

                            {Array.isArray(entry.affectedMatterIds) && entry.affectedMatterIds.length > 0 && (
                              <div style={{ fontSize: 12, color: "#385a83", fontWeight: 700 }}>
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
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 24,
                  background: "rgba(15, 23, 42, 0.58)",
                }}
                onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setMasterPaymentFormOpen(false); } }}
                tabIndex={-1}
              >
                <div
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    width: "min(1080px, 96vw)",
                    maxHeight: "88vh",
                    overflowY: "auto",
                    border: "1px solid #00346e",
                    borderRadius: 18,
                    background: "#ffffff",
                    boxShadow: "0 28px 90px rgba(15, 23, 42, 0.34)",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "38px minmax(0, 1fr) 38px",
                      alignItems: "center",
                      gap: 10,
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      padding: "16px 20px",
                      borderBottom: "1px solid #00346e",
                      background: "#00346e",
                      borderTopLeftRadius: 18,
                      borderTopRightRadius: 18,
                    }}
                  >
                    <div aria-hidden="true" />

                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 950,
                        color: "#ffffff",
                        textAlign: "center",
                      }}
                    >
                      Post Lawsuit Payment
                    </div>

                    <span data-barsh-standard-modal-close="removed" aria-hidden="true" />
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
                      <span>Transaction Type{masterPaymentTransactionOptionsLoading ? " · loading..." : ""}</span>
                      <select
                        value={masterPaymentTransactionTypeInput}
                        onChange={(event) => handleMasterPaymentTransactionTypeChange(event.target.value)}
                        style={{
                          width: "100%",
                          border: "1px solid #cbd5e1",
                          borderRadius: 8,
                          padding: "7px 10px",
                          background: "#ffffff",
                          color: "#00346e",
                          fontWeight: 700,
                          outline: "none",
                        }}
                      >
                        {masterPaymentTransactionTypeDropdownOptions().map((option) => (
                          <option key={option} value={option}>{masterPaymentTransactionTypeDisplay(option)}</option>
                        ))}
                      </select>
                    </label>

                    <label className="barsh-direct-payment-field">
                      <span>Transaction Status</span>
                      <select
                        value={masterPaymentTransactionStatusInput}
                        onChange={(event) => setMasterPaymentTransactionStatusInput(event.target.value)}
                        style={{
                          width: "100%",
                          border: "1px solid #cbd5e1",
                          borderRadius: 8,
                          padding: "7px 10px",
                          background: "#ffffff",
                          color: "#00346e",
                          fontWeight: 700,
                          outline: "none",
                        }}
                      >
                        {masterPaymentTransactionStatusDropdownOptions().map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </label>

                    <label className="barsh-direct-payment-field">
                      <span>Transaction Date</span>
                      <input
                        type="date"
                        value={masterPaymentDateInput}
                        onChange={(event) => setMasterPaymentDateInput(event.target.value)}
                        style={{
                          width: "100%",
                          border: "1px solid #cbd5e1",
                          borderRadius: 8,
                          padding: "7px 10px",
                          background: "#ffffff",
                          color: "#00346e",
                          fontWeight: 800,
                          outline: "none",
                        }}
                      />
                    </label>

                    <label className="barsh-direct-payment-field">
                      <span>Amount</span>
                      <div style={{ position: "relative", width: "100%" }}>
                        <span
                          style={{
                            position: "absolute",
                            left: 12,
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "#385a83",
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
                            background: "#ffffff",
                            color: "#00346e",
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
                          background: "#ffffff",
                          color: "#00346e",
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
                          background: "#ffffff",
                          color: "#00346e",
                          fontWeight: 800,
                          outline: "none",
                        }}
                      />
                    </label>
                  </div>

                  <div
                    style={{
                      margin: "0 18px 12px",
                      border: "1px solid #dbe4f0",
                      borderRadius: 14,
                      padding: 12,
                      background: "#ffffff",
                      display: masterPaymentRequiredFieldsComplete() ? "grid" : "none",
                      gridTemplateColumns: "minmax(220px, 1fr) minmax(220px, 1fr)",
                      gap: 12,
                      alignItems: "end",
                    }}
                  >
                    <label
                      className="barsh-direct-payment-field"
                      style={{
                        display: "grid",
                        gap: 6,
                        padding: "10px 12px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 12,
                        background: "#ffffff",
                        justifySelf: "start",
                        width: "min(340px, 100%)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
                      }}
                    >
                      <span
                        style={{
                          color: "#385a83",
                          fontWeight: 800,
                          fontSize: 12,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        Allocation Method
                      </span>
                      <select
                        value={masterPaymentAllocationMethodInput}
                        disabled={isMasterPaymentDirectProviderTransactionType(masterPaymentTransactionTypeInput)}
                        onChange={(event) => {
                          setMasterPaymentAllocationMethodInput(event.target.value);
                          setMasterPaymentPostResult(null);
                        }}
                        style={{
                          width: "100%",
                          minHeight: 40,
                          border: "1px solid #94a3b8",
                          borderRadius: 10,
                          background: "#ffffff",
                          color: "#00346e",
                          fontWeight: 700,
                          fontSize: 14,
                          padding: "8px 40px 8px 12px",
                          outline: "none",
                          appearance: "auto",
                        }}
                      >
                        <option value="proportional_by_balance">Allocate Equally by Percentage</option>
                        <option value="manual">Allocate Manually</option>
                      </select>
                      {isMasterPaymentDirectProviderTransactionType(masterPaymentTransactionTypeInput) && (
                        <div style={{ fontSize: 11, fontWeight: 850, color: "#385a83", lineHeight: 1.35 }}>
                          Direct Pay to Provider (Pre-suit) is claim-specific. Select exactly one child matter below.
                        </div>
                      )}
                    </label>

                    <div
                      style={{
                        gridColumn: "1 / -1",
                        padding: "8px 10px",
                        border: masterPaymentAllocationValidationMessage() ? "1px solid #fca5a5" : "1px solid #bbf7d0",
                        borderRadius: 10,
                        background: masterPaymentAllocationValidationMessage() ? "#fef2f2" : "#f0fdf4",
                        color: masterPaymentAllocationValidationMessage() ? "#991b1b" : "#166534",
                        fontSize: 12,
                        fontWeight: 850,
                      }}
                    >
                      {masterPaymentAllocationValidationMessage() ||
                        "Allocation is complete. Posted payments cannot be edited; void and repost if correction is needed."}
                    </div>
                  </div>

                  <div
                    style={{
                      margin: "0 18px 18px",
                      border: "1px solid #dbe4f0",
                      borderRadius: 14,
                      overflow: "hidden",
                      background: "#ffffff",
                      display: masterPaymentRequiredFieldsComplete() ? "block" : "none",
                    }}
                  >
                    <div
                      style={{
                        padding: "7px 10px",
                        borderBottom: "1px solid #e2e8f0",
                        background: "#ffffff",
                        fontSize: 12,
                        fontWeight: 950,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "#385a83",
                      }}
                    >
                      Allocation Preview · {masterPaymentAllocationMethodInput === "manual" ? "Allocate Manually" : "Allocate Equally by Percentage"}
                    </div>

                    <div style={{ overflowX: "auto" }}>
                      <table
                        style={{
                          width: "100%",
                          minWidth: 760,
                          borderCollapse: "collapse",
                          fontSize: 12,
                          color: "#00346e",
                        }}
                      >
                        <thead>
                          <tr style={{ background: "#e2e8f0" }}>
                            {masterPaymentSelectedOnlyInput && (
                              <th style={{ textAlign: "center", padding: "6px 8px", border: "1px solid #cbd5e1" }}>Selected</th>
                            )}
                            <th style={{ textAlign: "left", padding: "6px 8px", border: "1px solid #cbd5e1" }}>Matter</th>
                            <th style={{ textAlign: "left", padding: "6px 8px", border: "1px solid #cbd5e1" }}>Provider</th>
                            <th style={{ textAlign: "left", padding: "6px 8px", border: "1px solid #cbd5e1" }}>Patient</th>
                            <th style={{ textAlign: "right", padding: "6px 8px", border: "1px solid #cbd5e1" }}>Bill Amount</th>
                            {masterPaymentAllocationMethodInput !== "manual" && (
                              <th style={{ textAlign: "right", padding: "6px 8px", border: "1px solid #cbd5e1" }}>Balance Allocation %</th>
                            )}
                            <th style={{ textAlign: "right", padding: "6px 8px", border: "1px solid #cbd5e1" }}>Allocation</th>
                            <th style={{ textAlign: "right", padding: "6px 8px", border: "1px solid #cbd5e1" }}>Remaining Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {masterPaymentAllocationRows().map((item: any) => {
                            const row = item;
                            const allocationPercent = Number(item.allocationPercent || 0);

                            return (
                              <tr key={`master-payment-popup-${item.displayNumber || item.rowId}`}>
                                {masterPaymentSelectedOnlyInput && (
                                  <td style={{ padding: "6px 8px", border: "1px solid #e5e7eb", textAlign: "center" }}>
                                    <input
                                      type="checkbox"
                                      checked={!!masterPaymentSelectedRowIds[item.rowKey]}
                                      disabled={!isMasterPaymentBalanceCapExemptTransactionType(masterPaymentTransactionTypeInput) && item.currentBalance <= 0}
                                      onChange={(event) => {
                                        setMasterPaymentSelectedRowIds((current) => ({
                                          ...current,
                                          [item.rowKey]: event.target.checked,
                                        }));
                                        setMasterPaymentPostResult(null);
                                      }}
                                      title={!isMasterPaymentBalanceCapExemptTransactionType(masterPaymentTransactionTypeInput) && item.currentBalance <= 0 ? "This child matter has no open balance." : "Include this child matter in the allocation."}
                                    />
                                  </td>
                                )}
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
                                {masterPaymentAllocationMethodInput !== "manual" && (
                                  <td style={{ padding: "6px 8px", border: "1px solid #e5e7eb", textAlign: "right" }}>
                                    {allocationPercent.toFixed(2)}%
                                  </td>
                                )}
                                <td style={{ padding: "6px 8px", border: "1px solid #e5e7eb", textAlign: "right", fontWeight: 950, color: item.allocationExceedsBalance ? "#991b1b" : "#166534" }}>
                                  {masterPaymentAllocationMethodInput === "manual" ? (
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={masterPaymentManualAllocationInputs[item.rowKey] || ""}
                                      onChange={(event) => {
                                        const value = event.target.value;
                                        setMasterPaymentManualAllocationInputs((current) => ({
                                          ...current,
                                          [item.rowKey]: value,
                                        }));
                                        setMasterPaymentPostResult(null);
                                      }}
                                      onBlur={() => {
                                        setMasterPaymentManualAllocationInputs((current) => ({
                                          ...current,
                                          [item.rowKey]: formatMasterPaymentAmountInput(current[item.rowKey] || ""),
                                        }));
                                      }}
                                      disabled={masterPaymentSelectedOnlyInput && !item.selected}
                                      placeholder="0.00"
                                      style={{
                                        width: 96,
                                        textAlign: "right",
                                        border: item.allocationExceedsBalance ? "1px solid #dc2626" : "1px solid #cbd5e1",
                                        borderRadius: 8,
                                        padding: "5px 7px",
                                        fontWeight: 900,
                                      }}
                                    />
                                  ) : (
                                    money(item.paymentToPost)
                                  )}
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
                      background: "#ffffff",
                      borderBottomLeftRadius: 18,
                      borderBottomRightRadius: 18,
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
                        color: "#ffffff",
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
                        color: "#385a83",
                        fontWeight: 900,
                        fontSize: 15,
                        cursor: "pointer",
                      }}
                    >
                      Clear
                    </button>

                    <button
                      type="button"
                      disabled={masterPaymentSubmitDisabled()}
                      onClick={postMasterPaymentLocally}
                      title={
                        masterPaymentSubmitDisabled() && !masterPaymentPosting
                          ? "Complete all required payment fields and allocate the full payment amount before posting."
                          : "Post payment."
                      }
                      style={{
                        display: masterPaymentRequiredFieldsComplete() ? "inline-flex" : "none",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 190,
                        height: 44,
                        border: "1px solid #16a34a",
                        borderRadius: 12,
                        background: masterPaymentSubmitDisabled() ? "#bbf7d0" : "#16a34a",
                        color: masterPaymentSubmitDisabled() ? "#166534" : "#ffffff",
                        fontWeight: 950,
                        fontSize: 15,
                        cursor: masterPaymentSubmitDisabled() ? "not-allowed" : "pointer",
                        opacity: masterPaymentSubmitDisabled() ? 0.72 : 1,
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
                {activeMasterWorkspaceTab === "payments"
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
                      <th style={masterSettlementRightThStyle}>Lawsuit Payment</th>
                      <th style={masterSettlementRightThStyle}>Balance</th>
                      <th style={masterSettlementThStyle}>Insurer</th>
                      <th style={masterSettlementThStyle}>Claim Number</th>
                    </tr>
                  </thead>
                  <tbody>
                    {masterWorkspaceBillRows(masterSettlementDetailRows).map((row: any) => {
                      const rowId = clean(row.id);
                      const billAmount = masterLawsuitBillAmountForRow(row);
                      const balanceAmount = masterLawsuitBalanceAmountForRow(row);
                      const lawsuitPaymentAmount = masterLawsuitPaymentAmountForRow(row);
                      const totalPaymentAmount = Math.max(billAmount - balanceAmount, 0);
                      const preSuitPaymentAmount = Math.max(totalPaymentAmount - lawsuitPaymentAmount, 0);
                      const dosStart = clean(row.dosStart ?? row.dos_start ?? row.serviceStart ?? row.service_start ?? "");
                      const dosEnd = clean(row.dosEnd ?? row.dos_end ?? row.serviceEnd ?? row.service_end ?? "");
                      const formattedDosStart = formatDateOnlyForDisplay(dosStart);
                      const formattedDosEnd = formatDateOnlyForDisplay(dosEnd);
                      const dosLabel =
                        formattedDosStart && formattedDosEnd && formattedDosStart !== formattedDosEnd
                          ? `${formattedDosStart} – ${formattedDosEnd}`
                          : formattedDosStart || formattedDosEnd || formatDateOnlyForDisplay(row.dos) || clean(row.dos) || "—";
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
                                {normalizeProviderName(row.provider)}
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
                          <td style={masterSettlementMoneyTdStyle}>{money(lawsuitPaymentAmount)}</td>
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
                      <td style={masterSettlementMoneyTdStyle}>
                        {money(
                          masterWorkspaceBillRows(masterSettlementDetailRows).reduce((sum: number, row: any) => {
                            return sum + masterLawsuitBillAmountForRow(row);
                          }, 0)
                        )}
                      </td>
                      <td style={masterSettlementMoneyTdStyle}>
                        {money(
                          masterWorkspaceBillRows(masterSettlementDetailRows).reduce((sum: number, row: any) => {
                            const billAmount = masterLawsuitBillAmountForRow(row);
                            const balanceAmount = masterLawsuitBalanceAmountForRow(row);
                            const lawsuitPaymentAmount = masterLawsuitPaymentAmountForRow(row);
                            const totalPaymentAmount = Math.max(billAmount - balanceAmount, 0);
                            return sum + Math.max(totalPaymentAmount - lawsuitPaymentAmount, 0);
                          }, 0)
                        )}
                      </td>
                      <td style={masterSettlementMoneyTdStyle}>
                        {money(
                          masterWorkspaceBillRows(masterSettlementDetailRows).reduce((sum: number, row: any) => {
                            return sum + masterLawsuitPaymentAmountForRow(row);
                          }, 0)
                        )}
                      </td>
                      <td style={masterSettlementMoneyTdStyle}>
                        {money(
                          masterWorkspaceBillRows(masterSettlementDetailRows).reduce((sum: number, row: any) => {
                            return sum + masterLawsuitBalanceAmountForRow(row);
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
                  {sortableClaimResultsHeader("Matter", "matter")}
                  {sortableClaimResultsHeader("Patient", "patient")}
                  {sortableClaimResultsHeader("Provider", "provider")}
                  {sortableClaimResultsHeader("Insurer", "insurer")}
                  {sortableClaimResultsHeader("Claim", "claim")}
                  {sortableClaimResultsHeader("DOS", "dos")}
                  {sortableClaimResultsHeader("Denial Reason", "denialReason")}
                  {sortableClaimResultsHeader("Master Lawsuit", "masterLawsuit")}
                  {sortableClaimResultsHeader("Claim Amount", "claimAmount", rightThStyle)}
                  {sortableClaimResultsHeader("Balance", "balance", rightThStyle)}
                  {sortableClaimResultsHeader("Status", "status")}
                  {sortableClaimResultsHeader("Final Status", "finalStatus")}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
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
                    <td style={tdStyle}>
                      {row.dosStart || row.dosEnd
                        ? `${displayDate(row.dosStart)}${row.dosEnd && row.dosEnd !== row.dosStart ? ` - ${displayDate(row.dosEnd)}` : ""}`
                        : "—"}
                    </td>
                    <td style={tdStyle}>{row.denialReason || "—"}</td>
                    <td style={tdStyle}>
                      {row.masterLawsuitId ? (
                        <a
                          href={filteredUrl("master", row.masterLawsuitId)}
                          className="barsh-filter-field-link"
                          style={fieldLinkStyle}
                        >
                          {row.masterLawsuitId}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={rightTdStyle}>{money(row.claimAmount)}</td>
                    <td style={rightTdStyle}>{money(row.balancePresuit)}</td>
                    <td style={tdStyle}>{row.status || "—"}</td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minWidth: 54,
                          padding: "4px 10px",
                          borderRadius: 999,
                          border: row.finalStatus === "Closed" ? "1px solid #fecaca" : "1px solid #bbf7d0",
                          background: row.finalStatus === "Closed" ? "#fef2f2" : "#dcfce7",
                          color: row.finalStatus === "Closed" ? "#991b1b" : "#166534",
                          fontSize: 12,
                          fontWeight: 950,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.finalStatus}
                      </span>
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
  width: "100%",
  maxWidth: "none",
  margin: 0,
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  color: colors.ink,
  background: "#ffffff",
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
  background: "#ffffff",
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

const claimResultsSortButtonStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  background: "transparent",
  color: "inherit",
  font: "inherit",
  fontWeight: 950,
  textAlign: "left",
  padding: 0,
  cursor: "pointer",
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
  color: "#385a83",
  fontSize: 12,
  boxShadow: "0 6px 16px rgba(15, 23, 42, 0.055)",
};

const masterSummaryCardTitleStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.15,
  fontWeight: 950,
  color: "#385a83",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const masterSummaryCardValueStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 14,
  lineHeight: 1.25,
  fontWeight: 850,
  color: "#00346e",
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
  color: "#385a83",
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
  color: "#00346e",
  padding: "8px 13px",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
  opacity: 0.9,
};

const masterWorkflowLockedButtonStyle: React.CSSProperties = {
  ...masterWorkflowButtonStyle,
  borderColor: "#cbd5e1",
  background: "#ffffff",
  color: "#385a83",
};

const masterWorkflowActiveButtonStyle: React.CSSProperties = {
  ...masterWorkflowButtonStyle,
  background: "#00346e",
  borderColor: "#00346e",
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
  color: "#385a83",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  marginBottom: 4,
};

const masterWorkspacePanelTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#00346e",
  fontSize: 20,
};

const masterWorkspacePanelPillStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 999,
  background: "#f8fafc",
  color: "#385a83",
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const masterWorkspacePanelTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#385a83",
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
  color: "#00346e",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  marginBottom: 6,
};

const masterWorkspaceCardTextStyle: React.CSSProperties = {
  color: "#385a83",
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
  color: "#385a83",
  fontSize: 13,
  fontWeight: 900,
};

const masterSettlementInlineOptionStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  color: "#385a83",
  fontSize: 13,
  whiteSpace: "nowrap",
};

const masterSettlementTermBoxStyle: React.CSSProperties = {
  padding: "12px 16px 14px",
  borderBottom: "1px solid #e5e7eb",
};

const masterSettlementTermTitleStyle: React.CSSProperties = {
  color: "#385a83",
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
  color: "#385a83",
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
  color: "#00346e",
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
  color: "#00346e",
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
  color: "#00346e",
  fontWeight: 800,
};

const masterSettlementTextareaStyle: React.CSSProperties = {
  ...masterSettlementInputStyle,
  minHeight: 54,
  resize: "vertical",
};

const masterSettlementTermFootnoteStyle: React.CSSProperties = {
  marginTop: 8,
  color: "#385a83",
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
  color: "#385a83",
};

const masterSettlementSummaryTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#00346e",
};

const masterSettlementSummaryPillStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#00346e",
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
  color: "#385a83",
  fontSize: 12,
  minHeight: 156,
};

const masterSettlementSummaryValueStyle: React.CSSProperties = {
  display: "block",
  textAlign: "center",
  fontSize: 30,
  fontWeight: 900,
  lineHeight: 1.1,
  color: "#385a83",
  marginTop: "auto",
  marginBottom: "auto",
};

const masterSettlementAttorneyFeeControlStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
};

const masterSettlementAutoCalculationLabelStyle: React.CSSProperties = {
  color: "#00346e",
  fontSize: 12,
  fontWeight: 900,
};

const masterSettlementSmallRadioStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontSize: 12,
  color: "#385a83",
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
  color: "#00346e",
};

const masterSettlementNotAppliedStyle: React.CSSProperties = {
  color: "#385a83",
  fontWeight: 800,
};

const masterWorkspaceBillListStyle: React.CSSProperties = {
  marginTop: 16,
};

const masterSettlementDetailsTitleStyle: React.CSSProperties = {
  textAlign: "center",
  color: "#385a83",
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
  color: "#00346e",
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
  color: "#385a83",
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
  color: "#00346e",
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
  border: "1px solid #00346e",
  background: "#00346e",
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
  background: "#00346e",
  borderColor: "#00346e",
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
  color: "#00346e",
};

const workflowBannerEyebrowStyle: React.CSSProperties = {
  marginBottom: 4,
  color: "#00346e",
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const workflowBannerTextStyle: React.CSSProperties = {
  color: "#385a83",
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
  color: "#00346e",
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
  color: "#00346e",
  textDecoration: "none",
  fontWeight: 850,
  fontSize: 12,
};
