"use client";

const DIRECT_MATTER_SETTLEMENTS_ENABLED = false;

import { Fragment, useEffect, useMemo, useState } from "react";
import BarshHeaderQuickNav from "@/app/components/BarshHeaderQuickNav";

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function money(v: any) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num(v));
}

function formatDate(v?: string) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString("en-US");
}

function formatDOS(start?: string, end?: string) {
  const s = formatDate(start);
  const e = formatDate(end);
  if (s && e) return s === e ? s : `${s} - ${e}`;
  return s || e || "";
}

function formatPaymentDateMMDDYYYY(value?: any): string {
  const raw = String(value ?? "").trim();

  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return `${ymd[2]}/${ymd[3]}/${ymd[1]}`;

  const mdy = raw.match(/^(\d{2})[\/.](\d{2})[\/.](\d{4})$/);
  if (mdy) return `${mdy[1]}/${mdy[2]}/${mdy[3]}`;

  const d = value instanceof Date ? value : new Date(value || Date.now());

  if (Number.isNaN(d.getTime())) return "";

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${mm}/${dd}/${yyyy}`;
}

function formatPaymentDateYYYYMMDD(value?: any): string {
  const d = value instanceof Date ? value : new Date(value || Date.now());

  if (Number.isNaN(d.getTime())) return "";

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function paymentDateInputIsValid(value: string): boolean {
  const raw = String(value || "").trim();
  return (
    /^\d{2}\.\d{2}\.\d{4}$/.test(raw) ||
    /^\d{2}\/\d{2}\/\d{4}$/.test(raw) ||
    /^\d{4}-\d{2}-\d{2}$/.test(raw)
  );
}

function formatPaymentAmountInput(value: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/[$,\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n.toFixed(2) : raw;
}

function currentDirectMatterBalancePresuit(matter: any): number {
  const claimAmount = num(matter?.claimAmount);
  const paymentVoluntary = num(matter?.paymentVoluntary);
  const calculated = Math.max(claimAmount - paymentVoluntary, 0);

  const raw = matter?.balancePresuit;
  const hasRaw =
    raw !== null &&
    raw !== undefined &&
    String(raw).trim() !== "";

  const clioBalance = num(raw);

  if (hasRaw) {
    if (clioBalance > 0) return clioBalance;
    if (calculated === 0) return 0;
  }

  return calculated;
}

function stageColor(stage?: string) {
  if (!stage) return {};
  if (stage.includes("READY FOR ARBITRATION/LITIGATION")) {
    return { color: "green", fontWeight: "600" };
  }
  return { color: "red" };
}

function statusColor(status?: string) {
  if (!status) return {};
  const s = status.toLowerCase();

  if (s.includes("open")) {
    return { color: "green", fontWeight: "600" };
  }

  if (s.includes("pending") || s.includes("closed")) {
    return { color: "red", fontWeight: "700" };
  }

  return {};
}

function isSelectable(r: any) {
  return !String(r.closeReason || "").trim();
}

function isDisabledByGroup(r: any, activeGroupKey?: string | null) {
  if (!activeGroupKey) return false;

  const rowGroup = String(r?.masterLawsuitId || "").trim();
  if (!rowGroup) return false;

  return rowGroup !== activeGroupKey;
}


function isAggregated(r: any) {
  return !!(r?.masterLawsuitId && String(r.masterLawsuitId).trim());
}

function getColorForLawsuit(id: string): string {
  const colors = [
    "#f0f7ff",
    "#f5fff0",
    "#fff7f0",
    "#f9f0ff",
    "#fff0f5",
    "#f0fff9",
  ];

  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

function statusDisplay(status?: string) {
  if (!status) return "";
  const s = status.toLowerCase();

  if (s.includes("pending") || s.includes("closed")) {
    return "**" + status + "**";
  }

  return status;
}

function clioMatterUrl(matterId: any): string {
  return `https://app.clio.com/nc/#/matters/${matterId}`;
}

function textValue(v: any): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);

  if (Array.isArray(v)) {
    return v.map(textValue).filter(Boolean).join(", ");
  }

  if (typeof v === "object") {
    if (typeof v.name === "string" && v.name.trim()) return v.name;
    if (typeof v.value === "string" && v.value.trim()) return v.value;
    if (typeof v.label === "string" && v.label.trim()) return v.label;
    if (typeof v.description === "string" && v.description.trim()) return v.description;
    if (typeof v.display_value === "string" && v.display_value.trim()) return v.display_value;
    if (typeof v.displayName === "string" && v.displayName.trim()) return v.displayName;
    if (typeof v.text === "string" && v.text.trim()) return v.text;

    if (v.contact) return textValue(v.contact);
    if (v.person) return textValue(v.person);
    if (v.company) return textValue(v.company);
    if (v.client) return textValue(v.client);
    if (v.insurer) return textValue(v.insurer);
  }

  return "";
}

function providerValue(v: any): string {
  return textValue(v?.client) || textValue(v?.clientName) || "";
}

function insurerValue(v: any): string {
  

return (
    textValue(v?.insurer) ||
    textValue(v?.insuranceCompany) ||
    textValue(v?.insurance_company) ||
    ""
  );
}

const DENIAL_REASON_LABELS: Record<string, string> = {
  "12497990": "Medical Necessity (Peer Review)",
  "12497975": "Medical Necessity (IME)",
  "12498065": "Fee Schedule / Coding",
};

function denialReasonValue(v: any): string {
  const raw =
    textValue(v?.denialReason) ||
    textValue(v?.denial_reason) ||
    "";

  if (!raw) return "";
  return DENIAL_REASON_LABELS[raw] || raw;
}

const VALID_CLOSE_REASONS = [
  "AAA- DECISION- DISMISSED WITH PREJUDICE",
  "AAA- VOLUNTARILY WITHDRAWN WITH PREJUDICE",
  "DISCONTINUED WITH PREJUDICE",
  "MOTION LOSS",
  "OUT OF STATE CARRIER",
  "PAID (DECISION)",
  "PAID (JUDGMENT)",
  "PAID (SETTLEMENT)",
  "PAID (FEE SCHEDULE)",
  "PAID (VOLUNTARY)",
  "PER CLIENT",
  "POLICY CANCELLED",
  "POLICY EXHAUSTED/NO COVERAGE",
  "PPO",
  "SOL",
  "TRIAL LOSS",
  "WORKERS COMPENSATION",
  "TRANSFERRED TO LB",
];

const VENUE_OPTIONS = [
  "Civil Court of the City of New York, Queens County",
  "Civil Court of the City of New York, Kings County",
  "Civil Court of the City of New York, New York County",
  "Civil Court of the City of New York, Bronx County",
  "Civil Court of the City of New York, Richmond County",
  "Nassau County District Court",
  "Suffolk County District Court",
  "AAA No-Fault Arbitration",
  "Other",
];

type AmountSoughtMode = "balance_presuit" | "claim_amount" | "custom";

type MatterSortKey =
  | "matter"
  | "patient"
  | "provider"
  | "insurer"
  | "dos"
  | "claim"
  | "payment"
  | "balance"
  | "denial"
  | "status"
  | "finalStatus";

type MatterSortDirection = "asc" | "desc";

type MatterSortConfig = {
  key: MatterSortKey;
  direction: MatterSortDirection;
};

type LawsuitOptions = {
  venue: string;
  venueOther: string;
  amountSoughtMode: AmountSoughtMode;
  customAmountSought: string;
  indexAaaNumber: string;
  notes: string;
};

type LawsuitMetadataEdit = {
  venueSelection: string;
  venueOther: string;
  amountSoughtMode: AmountSoughtMode;
  customAmountSought: string;
  indexAaaNumber: string;
  lawsuitNotes: string;
};

function defaultLawsuitMetadataEdit(): LawsuitMetadataEdit {
  return {
    venueSelection: "",
    venueOther: "",
    amountSoughtMode: "balance_presuit",
    customAmountSought: "",
    indexAaaNumber: "",
    lawsuitNotes: "",
  };
}

function defaultLawsuitOptions(): LawsuitOptions {
  return {
    venue: "",
    venueOther: "",
    amountSoughtMode: "balance_presuit",
    customAmountSought: "",
    indexAaaNumber: "",
    notes: "",
  };
}

type MatterWorkspaceTab =
  | "overview"
  | "lawsuit"
  | "documents"
  | "settlement"
  | "print_queue"
  | "audit_history";

const matterWorkspaceTabs: Array<{ key: MatterWorkspaceTab; label: string; note: string }> = [
  { key: "lawsuit", label: "Lawsuit", note: "Aggregation and lawsuit metadata" },
  { key: "documents", label: "Documents", note: "Preview, finalize, and Clio upload" },
  { key: "audit_history", label: "Audit / History", note: "Local workflow history" },
];

const bmColors = {
  ink: "#0f172a",
  muted: "#475569",
  subtle: "#64748b",
  line: "#e2e8f0",
  softLine: "#e5e7eb",
  panel: "#ffffff",
  page: "#f8fafc",
  blue: "#2563eb",
  blueSoft: "#eff6ff",
  green: "#16a34a",
  red: "#dc2626",
  redSoft: "#fef2f2",
  amber: "#92400e",
  amberSoft: "#fffbeb",
};

const bmShadow = "0 18px 45px rgba(15, 23, 42, 0.08)";

function matterWorkspaceTabStyle(active: boolean) {
  return {
    border: "1px solid " + (active ? bmColors.ink : bmColors.line),
    background: active ? bmColors.ink : bmColors.panel,
    boxShadow: active ? "0 10px 22px rgba(15, 23, 42, 0.18)" : "0 1px 2px rgba(15, 23, 42, 0.06)",
    transform: active ? "translateY(-1px)" : "none",
    color: active ? "#ffffff" : bmColors.ink,
    borderRadius: 12,
    padding: "9px 14px",
    fontSize: 13,
    fontWeight: 850,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    transition: "background 120ms ease, border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease",
  };
}

const tabPlaceholderPanelStyle: React.CSSProperties = {
  border: "1px solid " + bmColors.line,
  borderRadius: 18,
  padding: 18,
  background: bmColors.panel,
  margin: "0 0 18px",
};

const tabPlaceholderTextStyle: React.CSSProperties = {
  color: bmColors.muted,
  lineHeight: 1.5,
  marginBottom: 0,
};

const bmPrimaryButtonStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "12px 14px",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 850,
  fontSize: 14,
};

const bmDisabledButtonStyle: React.CSSProperties = {
  background: "#cbd5e1",
  color: "#475569",
  cursor: "not-allowed",
  boxShadow: "none",
};

const bmStatCardStyle: React.CSSProperties = {
  padding: 14,
  border: "1px solid " + bmColors.line,
  borderRadius: 16,
  background: bmColors.panel,
  boxShadow: "0 6px 18px rgba(15, 23, 42, 0.05)",
};

const bmGlobalTopBarStyle: React.CSSProperties = {
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

const bmGlobalLeftLogoWrapStyle: React.CSSProperties = {
  gridColumn: "1",
  display: "flex",
  justifyContent: "flex-start",
  alignItems: "flex-start",
};

const bmGlobalRightWrapStyle: React.CSSProperties = {
  gridColumn: "3",
  justifySelf: "end",
  position: "relative",
  width: 330,
  height: 152,
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "flex-start",
};

const bmGlobalBrlLogoStyle: React.CSSProperties = {
  width: 190,
  height: 126,
  objectFit: "contain",
  display: "block",
};

const bmGlobalLogoLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "flex-start",
  justifyContent: "flex-end",
  textDecoration: "none",
};

const bmGlobalLogoStyle: React.CSSProperties = {
  width: 330,
  height: 152,
  objectFit: "contain",
  objectPosition: "right top",
  display: "block",
};

const bmGlobalPrintButtonRowStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  right: 218,
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: 8,
  flexWrap: "nowrap",
};

const bmGlobalLockedPrintQueueStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "7px 11px",
  border: "1px solid #cbd5e1",
  borderRadius: 999,
  background: "#f8fafc",
  color: bmColors.muted,
  fontSize: 12,
  fontWeight: 750,
  whiteSpace: "nowrap",
  cursor: "not-allowed",
  opacity: 0.9,
};

function parseMoneyInput(v: string): number | null {
  const cleaned = String(v || "").replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const [matterId, setMatterId] = useState<string>("");

  useEffect(() => {
    params.then((p) => setMatterId(p.id));
  }, [params]);

  const [matter, setMatter] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [matterHydrationLoading, setMatterHydrationLoading] = useState(false);
  const [matterHydrationError, setMatterHydrationError] = useState("");
  const [selected, setSelected] = useState<number[]>([]);

const selectedRows = useMemo(() => {
  return rows.filter((r) => selected.includes(Number(r.id)));
}, [rows, selected]);

const selectedGroupKeys = useMemo(() => {
  return Array.from(
    new Set(
      selectedRows
        .map((r) => String(r.masterLawsuitId || "").trim())
        .filter(Boolean)
    )
  );
}, [selectedRows]);

const activeGroupKey =
  selectedGroupKeys.length === 1 ? selectedGroupKeys[0] : null;

  const [submitting, setSubmitting] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [closing, setClosing] = useState(false);
  const [closeMatterTarget, setCloseMatterTarget] = useState<any>(null);
  const [showClosed, setShowClosed] = useState(true);
  const [matterSort, setMatterSort] = useState<MatterSortConfig | null>(null);
  const [showLawsuitOptionsModal, setShowLawsuitOptionsModal] = useState(false);
  const [lawsuitOptions, setLawsuitOptions] = useState<LawsuitOptions>(() =>
    defaultLawsuitOptions()
  );
  const [packetPreview, setPacketPreview] = useState<any>(null);
  const [packetPreviewOpen, setPacketPreviewOpen] = useState(false);
  const [packetLoading, setPacketLoading] = useState(false);
  const [documentPreview, setDocumentPreview] = useState<any>(null);
  const [documentPreviewLoading, setDocumentPreviewLoading] = useState(false);
  const [finalizeUploadLoading, setFinalizeUploadLoading] = useState(false);
  const [finalizeUploadResult, setFinalizeUploadResult] = useState<any>(null);
  const [finalizationHistory, setFinalizationHistory] = useState<any>(null);
  const [finalizationHistoryLoading, setFinalizationHistoryLoading] = useState(false);
  const [expandedFinalizationId, setExpandedFinalizationId] = useState<string | null>(null);
  const [matterAuditHistoryLoading, setMatterAuditHistoryLoading] = useState(false);
  const [matterAuditHistoryResult, setMatterAuditHistoryResult] = useState<any>(null);
  const [expandedMatterAuditEntryId, setExpandedMatterAuditEntryId] = useState<string | null>(null);
  const [matterAuditHistoryPopupOpen, setMatterAuditHistoryPopupOpen] = useState(false);
  const [printQueuePreview, setPrintQueuePreview] = useState<any>(null);
  const [printQueuePreviewLoading, setPrintQueuePreviewLoading] = useState(false);
  const [printQueueAddLoading, setPrintQueueAddLoading] = useState(false);
  const [printQueueAddResult, setPrintQueueAddResult] = useState<any>(null);
  const [printQueueList, setPrintQueueList] = useState<any>(null);
  const [printQueueListLoading, setPrintQueueListLoading] = useState(false);
  const [printQueueStatusFilter, setPrintQueueStatusFilter] = useState<"" | "queued" | "printed" | "hold" | "skipped">("");
  const [printQueueStatusLoadingId, setPrintQueueStatusLoadingId] = useState<number | null>(null);
  const [printQueueStatusResult, setPrintQueueStatusResult] = useState<any>(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] =
    useState<MatterWorkspaceTab>("overview");
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  const [metadataSaving, setMetadataSaving] = useState(false);
  const [metadataEdit, setMetadataEdit] = useState<LawsuitMetadataEdit>(() =>
    defaultLawsuitMetadataEdit()
  );

  const [settlementPreviewInput, setSettlementPreviewInput] = useState({
    grossSettlementAmount: "",
    settledWith: "",
    settledWithContactId: "",
    settledWithContactName: "",
    settledWithContactType: "",
    settledWithContactSearch: "",
    settlementDate: "",
    paymentExpectedDate: "",
    allocationMode: "proportional_balance_presuit",
    principalFeePercent: "",
    interestAmount: "",
    interestFeePercent: "",
    notes: "",
  });
  const [settlementPreviewLoading, setSettlementPreviewLoading] = useState(false);
  const [settledWithContactResults, setSettledWithContactResults] = useState<any[]>([]);
  const [settledWithContactLoading, setSettledWithContactLoading] = useState(false);
  const [settlementPreviewResult, setSettlementPreviewResult] = useState<any>(null);
  const [providerFeeDefaultsLoading, setProviderFeeDefaultsLoading] = useState(false);
  const [providerFeeDefaultsResult, setProviderFeeDefaultsResult] = useState<any>(null);
  const [providerFeeDefaultsAutoLoadedMatterId, setProviderFeeDefaultsAutoLoadedMatterId] = useState<string>("");
  const [settlementWritebackPreviewLoading, setSettlementWritebackPreviewLoading] = useState(false);
  const [settlementWritebackPreviewResult, setSettlementWritebackPreviewResult] = useState<any>(null);
  const [settlementWritebackLoading, setSettlementWritebackLoading] = useState(false);
  const [settlementWritebackResult, setSettlementWritebackResult] = useState<any>(null);
  const [settlementClosePreviewLoading, setSettlementClosePreviewLoading] = useState(false);
  const [settlementClosePreviewResult, setSettlementClosePreviewResult] = useState<any>(null);
  const [settlementCloseWritebackLoading, setSettlementCloseWritebackLoading] = useState(false);
  const [settlementCloseWritebackResult, setSettlementCloseWritebackResult] = useState<any>(null);
  const [settlementHistoryLoading, setSettlementHistoryLoading] = useState(false);
  const [settlementHistoryResult, setSettlementHistoryResult] = useState<any>(null);
  const [expandedSettlementHistoryId, setExpandedSettlementHistoryId] = useState<string | null>(null);
  const [currentSettlementValuesLoading, setCurrentSettlementValuesLoading] = useState(false);
  const [currentSettlementValuesResult, setCurrentSettlementValuesResult] = useState<any>(null);
  const [currentSettlementValuesLoadedMasterId, setCurrentSettlementValuesLoadedMasterId] = useState<string>("");
  const [settlementDocumentsPreviewLoading, setSettlementDocumentsPreviewLoading] = useState(false);
  const [settlementDocumentsPreviewResult, setSettlementDocumentsPreviewResult] = useState<any>(null);
  const [paymentApplyLoading, setPaymentApplyLoading] = useState(false);
  const [paymentApplyResult, setPaymentApplyResult] = useState<any>(null);
  const [paymentReceiptsLoading, setPaymentReceiptsLoading] = useState(false);
  const [paymentReceipts, setPaymentReceipts] = useState<any[]>([]);
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [paymentAmountInput, setPaymentAmountInput] = useState("");
  const [paymentDateInput, setPaymentDateInput] = useState(() => formatPaymentDateYYYYMMDD(new Date()));
  const [paymentTransactionTypeInput, setPaymentTransactionTypeInput] = useState("Collection Payment");
  const [paymentTransactionStatusInput, setPaymentTransactionStatusInput] = useState("Show on Remittance");
  const [paymentCheckDateInput, setPaymentCheckDateInput] = useState("");
  const [paymentCheckNumberInput, setPaymentCheckNumberInput] = useState("");
  const [paymentVoidLoadingId, setPaymentVoidLoadingId] = useState<number | null>(null);
  const [paymentEditingReceipt, setPaymentEditingReceipt] = useState<any>(null);
  const [paymentShowVoided, setPaymentShowVoided] = useState(true);
  const [expandedPaymentReceiptId, setExpandedPaymentReceiptId] = useState<number | null>(null);
  const [paymentClosePromptOpen, setPaymentClosePromptOpen] = useState(false);
  const [directFieldEditModal, setDirectFieldEditModal] = useState<"dos" | "denialReason" | "status" | "finalStatus" | null>(null);
  const [directFieldEditLoading, setDirectFieldEditLoading] = useState(false);
  const [directFieldEditResult, setDirectFieldEditResult] = useState<any>(null);
  const [directFieldPicklistsLoading, setDirectFieldPicklistsLoading] = useState(false);
  const [directFieldPicklists, setDirectFieldPicklists] = useState<any>(null);
  const [identityFieldEditModal, setIdentityFieldEditModal] = useState<"patient_name" | "client_name" | "insurer_name" | "claim_number_raw" | null>(null);
  const [identityFieldEditInput, setIdentityFieldEditInput] = useState("");
  const [identityFieldEditLoading, setIdentityFieldEditLoading] = useState(false);
  const [identityFieldEditResult, setIdentityFieldEditResult] = useState<any>(null);
  const [dosStartInput, setDosStartInput] = useState("");
  const [dosEndInput, setDosEndInput] = useState("");
  const [denialReasonInput, setDenialReasonInput] = useState("");
  const [matterStageInput, setMatterStageInput] = useState("");
  const [finalStatusInput, setFinalStatusInput] = useState("");
  const [treatingProviderOptions, setTreatingProviderOptions] = useState<any[]>([]);
  const [treatingProviderOptionsLoading, setTreatingProviderOptionsLoading] = useState(false);
  const [claimIndexTreatingProviderField, setClaimIndexTreatingProviderField] = useState<any>(null);
  const [treatingProviderInput, setTreatingProviderInput] = useState("");
  const [treatingProviderSaving, setTreatingProviderSaving] = useState(false);
  const [treatingProviderResult, setTreatingProviderResult] = useState<any>(null);
  const [treatingProviderEditOpen, setTreatingProviderEditOpen] = useState(false);

  function formatMatterAuditValue(value: any): string {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  function formatMatterAuditTimestamp(value: any): string {
    const date = new Date(String(value || ""));
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString();
  }

  async function loadMatterAuditHistory() {
    const numericMatterId = Number(matterId);
    const displayNumber = textValue(matter?.displayNumber || matter?.display_number);
    const masterLawsuitId = textValue(matter?.masterLawsuitId || matter?.master_lawsuit_id);

    if ((!Number.isFinite(numericMatterId) || numericMatterId <= 0) && !displayNumber && !masterLawsuitId) {
      setMatterAuditHistoryResult({
        ok: false,
        error: "No matter identifier is available for audit history lookup.",
        entries: [],
      });
      return;
    }

    try {
      setMatterAuditHistoryLoading(true);

      const params = new URLSearchParams();
      params.set("limit", "100");

      if (Number.isFinite(numericMatterId) && numericMatterId > 0) {
        params.set("matterId", String(numericMatterId));
      }

      if (displayNumber) {
        params.set("matterDisplayNumber", displayNumber);
      }

      if (masterLawsuitId) {
        params.set("masterLawsuitId", masterLawsuitId);
      }

      const response = await fetch(`/api/audit-log?${params.toString()}`, {
        cache: "no-store",
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Matter audit history lookup failed.");
      }

      setMatterAuditHistoryResult(json);
    } catch (err: any) {
      setMatterAuditHistoryResult({
        ok: false,
        error: err?.message || "Matter audit history lookup failed.",
        entries: [],
      });
    } finally {
      setMatterAuditHistoryLoading(false);
    }
  }

  function openReferenceImportsAdmin() {
    const confirmed = window.confirm(
      "ADMIN ACCESS REQUIRED\n\nOpen Reference Data Import?\n\nThis area controls local Barsh Matters reference-data import, import history, cleanup previews, and deactivate-only cleanup tools.\n\nContinue?"
    );

    if (!confirmed) return;

    window.location.href = "/admin/reference-data";
  }

  function openMatterAuditHistoryTab() {
    setMatterAuditHistoryPopupOpen(true);
    void loadMatterAuditHistory();
  }

  function closeMatterAuditHistoryPopup() {
    setMatterAuditHistoryPopupOpen(false);
  }

  function selectedTreatingProviderOption(): any {
    return treatingProviderOptions.find((option: any) => String(option?.id) === String(treatingProviderInput)) || null;
  }

  function localTreatingProviderName(): string {
    return textValue(claimIndexTreatingProviderField?.fieldValue);
  }

  function claimIndexTreatingProviderSaved(): boolean {
    return !!localTreatingProviderName();
  }

  async function openTreatingProviderEditDialog() {
    setTreatingProviderResult(null);
    setTreatingProviderInput(textValue(claimIndexTreatingProviderField?.fieldValueId));
    setTreatingProviderEditOpen(true);
    await loadTreatingProviderOptions();
  }

  function closeTreatingProviderEditDialog() {
    if (treatingProviderSaving) return;
    setTreatingProviderEditOpen(false);
    setTreatingProviderResult(null);
    setTreatingProviderInput(textValue(claimIndexTreatingProviderField?.fieldValueId));
  }

  async function loadTreatingProviderOptions() {
    setTreatingProviderOptionsLoading(true);

    try {
      const json = await fetch("/api/reference-data/options?type=treating_provider", {
        cache: "no-store",
      }).then((result) => result.json());

      if (json?.ok && Array.isArray(json.options)) {
        setTreatingProviderOptions(json.options);
      } else {
        setTreatingProviderOptions([]);
      }

      return json;
    } catch {
      setTreatingProviderOptions([]);
      return null;
    } finally {
      setTreatingProviderOptionsLoading(false);
    }
  }

  async function loadClaimIndexTreatingProviderField() {
    if (!matterId) return;

    setTreatingProviderResult(null);

    const [optionsJson, fieldJson] = await Promise.all([
      loadTreatingProviderOptions(),
      fetch(
        `/api/matters/identity-field?matterId=${encodeURIComponent(String(matterId))}&fieldName=treating_provider`,
        { cache: "no-store" }
      ).then((result) => result.json()).catch(() => null),
    ]);

    if (fieldJson?.ok) {
      const field = fieldJson.field || null;
      setClaimIndexTreatingProviderField(field);
      setTreatingProviderInput(textValue(field?.fieldValueId));
    } else {
      setClaimIndexTreatingProviderField(null);
      setTreatingProviderInput("");
    }

    if (optionsJson?.ok === false) {
      setTreatingProviderResult(optionsJson);
    }
  }

  async function saveClaimIndexTreatingProvider() {
    if (!matterId) {
      setTreatingProviderResult({ ok: false, error: "No matter ID is available." });
      return;
    }

    const option = selectedTreatingProviderOption();

    if (!option) {
      setTreatingProviderResult({ ok: false, error: "Select a Treating Provider before saving." });
      return;
    }

    try {
      setTreatingProviderSaving(true);
      setTreatingProviderResult(null);

      const response = await fetch("/api/matters/identity-field", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matterId: Number(matterId),
          matterDisplayNumber: textValue(matter?.displayNumber || matter?.display_number),
          fieldName: "treating_provider",
          fieldValueId: option.id,
          fieldValue: option.displayName,
          actorName: "Barsh Matters User",
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        setTreatingProviderResult({
          ok: false,
          error: json?.error || "Treating Provider could not be saved.",
          details: json,
        });
        return;
      }

      setClaimIndexTreatingProviderField(json.field || null);
      setTreatingProviderInput(textValue(json.field?.fieldValueId || option.id));
      setTreatingProviderResult({
        ok: true,
        message: "Treating Provider saved.",
        safety: json.safety,
      });
      setTreatingProviderEditOpen(false);
    } catch (err: any) {
      setTreatingProviderResult({
        ok: false,
        error: err?.message || "Treating Provider could not be saved.",
      });
    } finally {
      setTreatingProviderSaving(false);
    }
  }

  useEffect(() => {
    if (!matterId) return;
    void loadClaimIndexTreatingProviderField();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matterId]);

  function paymentFormAmountValue(): number {
    return num(paymentAmountInput);
  }

  function paymentFormOriginalAmountValue(): number {
    return paymentEditingReceipt ? num(paymentEditingReceipt?.paymentAmount) : 0;
  }

  function paymentFormDeltaValue(): number {
    const entered = paymentFormAmountValue();
    return paymentEditingReceipt ? entered - paymentFormOriginalAmountValue() : entered;
  }

  function signedMoneyValue(value: number): string {
    const amount = Number(value || 0);
    return `${amount >= 0 ? "+" : "-"}${money(Math.abs(amount))}`;
  }

  function expectedPaymentsPostedAfterPaymentForm(): number {
    return num(matter?.paymentVoluntary) + paymentFormDeltaValue();
  }

  function expectedBalancePresuitAfterPaymentForm(): number {
    return Math.max(currentDirectMatterBalancePresuit(matter) - paymentFormDeltaValue(), 0);
  }

  function visiblePaymentReceipts(): any[] {
    return paymentReceipts.filter((receipt) => paymentShowVoided || !receipt?.voided);
  }

  function selectedPaymentReceipt(): any {
    if (!expandedPaymentReceiptId) return null;
    return paymentReceipts.find((receipt) => Number(receipt?.id) === Number(expandedPaymentReceiptId)) || null;
  }

  function paymentReceiptAuditStatus(receipt: any): string {
    if (receipt?.voided) return "VOIDED";
    if (receipt?.editedAt) return "Edited";
    if (receipt?.createdAt) return "Posted";
    return "—";
  }

  function paymentReceiptPrimaryTimestamp(receipt: any): string {
    return textValue(receipt?.voidedAt || receipt?.editedAt || receipt?.createdAt);
  }

  function latestPaymentReceipt(): any {
    return paymentReceipts[0] || null;
  }

  function matterIsClosedForPayment(): boolean {
    return String(matter?.status || "").trim().toLowerCase() === "closed";
  }

  function matterHasFinalStatusForPayment(): boolean {
    return !!String(matter?.closeReason || "").trim();
  }

  function paymentCloseMatterAvailable(): boolean {
    return !!matter?.id && !matterIsClosedForPayment();
  }

  function openCloseMatterDialogFromMatter() {
    if (!matter?.id || matterIsClosedForPayment()) return;

    setCloseMatterTarget({
      id: matter?.id,
      displayNumber: matter?.displayNumber,
      patient: matter?.patient,
      provider: matter?.provider,
      clientName: matter?.clientName,
      closeReason: matter?.closeReason,
    });
    setCloseReason("PAID VOLUNTARY");
    setShowCloseModal(true);
  }

  function openCloseMatterFromPayment() {
    if (!paymentCloseMatterAvailable()) return;
    setPaymentClosePromptOpen(false);
    openCloseMatterDialogFromMatter();
  }

  function maybePromptCloseMatterAfterPayment() {
    if (paymentCloseMatterAvailable()) {
      setPaymentClosePromptOpen(true);
    }
  }

  function directFieldDateInputValue(value: any): string {
    const raw = String(value || "").trim();
    if (!raw) return "";

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const dotMatch = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (dotMatch) {
      const month = dotMatch[1].padStart(2, "0");
      const day = dotMatch[2].padStart(2, "0");
      const year = dotMatch[3];
      return `${year}-${month}-${day}`;
    }

    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) {
      const year = String(date.getFullYear());
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    return "";
  }

  function identityFieldEditLabel(field: "patient_name" | "client_name" | "insurer_name" | "claim_number_raw" | null): string {
    if (field === "patient_name") return "Patient";
    if (field === "client_name") return "Provider";
    if (field === "insurer_name") return "Insurer";
    if (field === "claim_number_raw") return "Claim Number";
    return "Identity Field";
  }

  function identityFieldCurrentValue(field: "patient_name" | "client_name" | "insurer_name" | "claim_number_raw" | null): string {
    if (field === "patient_name") return textValue(matter?.patient?.name || matter?.patient);
    if (field === "client_name") return providerValue(matter);
    if (field === "insurer_name") return insurerValue(matter);
    if (field === "claim_number_raw") return textValue(matter?.claimNumber);
    return "";
  }

  function openIdentityFieldEditDialog(field: "patient_name" | "client_name" | "insurer_name" | "claim_number_raw") {
    setIdentityFieldEditResult(null);
    setIdentityFieldEditInput(identityFieldCurrentValue(field));
    setIdentityFieldEditModal(field);
  }

  function closeIdentityFieldEditDialog() {
    if (identityFieldEditLoading) return;
    setIdentityFieldEditModal(null);
    setIdentityFieldEditResult(null);
    setIdentityFieldEditInput("");
  }

  function normalizeClaimIndexMatter(row: any): any {
    if (!row) return null;

    const matterIdValue = Number(row.matterId ?? row.matter_id ?? row.id ?? 0);
    const displayNumber = textValue(row.displayNumber || row.display_number);

    const patientName = textValue(row.patientName || row.patient_name || row.patient?.name || row.patient);
    const clientName = textValue(row.clientName || row.client_name || row.provider || row.providerName || row.provider_name || row.client?.name);
    const providerName = textValue(row.providerName || row.provider_name || clientName);
    const insurerName = textValue(row.insurerName || row.insurer_name || row.insurer || row.insuranceCompany || row.insurance_company);
    const claimNumber = textValue(row.claimNumber || row.claim_number || row.claimNumberRaw || row.claim_number_raw || row.claim_number_normalized);
    const matterStageName = textValue(row.matterStageName || row.matter_stage_name || row.matterStage?.name || row.status);

    return {
      ...(row || {}),
      id: matterIdValue,
      matterId: matterIdValue,
      matter_id: matterIdValue,

      displayNumber,
      display_number: displayNumber,

      description: textValue(row.description),

      patient: patientName ? { name: patientName } : "",
      patientName,
      patient_name: patientName,

      client: clientName ? { name: clientName } : "",
      clientName,
      client_name: clientName,

      provider: clientName,
      providerName,
      provider_name: providerName,

      insurer: insurerName,
      insurerName,
      insurer_name: insurerName,
      insuranceCompany: insurerName,
      insurance_company: insurerName,

      claimNumber,
      claim_number: claimNumber,
      claimNumberRaw: textValue(row.claimNumberRaw || row.claim_number_raw || claimNumber),
      claim_number_raw: textValue(row.claimNumberRaw || row.claim_number_raw || claimNumber),
      claimNumberNormalized: textValue(row.claimNumberNormalized || row.claim_number_normalized || claimNumber),
      claim_number_normalized: textValue(row.claimNumberNormalized || row.claim_number_normalized || claimNumber),

      claimAmount: num(row.claimAmount ?? row.claim_amount),
      claim_amount: num(row.claimAmount ?? row.claim_amount),
      paymentVoluntary: num(row.paymentVoluntary ?? row.payment_voluntary),
      payment_voluntary: num(row.paymentVoluntary ?? row.payment_voluntary),
      balancePresuit: num(row.balancePresuit ?? row.balance_presuit),
      balance_presuit: num(row.balancePresuit ?? row.balance_presuit),

      billNumber: textValue(row.billNumber || row.bill_number),
      bill_number: textValue(row.billNumber || row.bill_number),

      dosStart: textValue(row.dosStart || row.dos_start),
      dos_start: textValue(row.dosStart || row.dos_start),
      dosEnd: textValue(row.dosEnd || row.dos_end),
      dos_end: textValue(row.dosEnd || row.dos_end),

      denialReason: textValue(row.denialReason || row.denial_reason),
      denial_reason: textValue(row.denialReason || row.denial_reason),

      serviceType: textValue(row.serviceType || row.service_type),
      service_type: textValue(row.serviceType || row.service_type),
      policyNumber: textValue(row.policyNumber || row.policy_number),
      policy_number: textValue(row.policyNumber || row.policy_number),
      dateOfLoss: textValue(row.dateOfLoss || row.date_of_loss),
      date_of_loss: textValue(row.dateOfLoss || row.date_of_loss),

      masterLawsuitId: textValue(row.masterLawsuitId || row.master_lawsuit_id),
      master_lawsuit_id: textValue(row.masterLawsuitId || row.master_lawsuit_id),

      matterStage: matterStageName ? { name: matterStageName } : null,
      matterStageName,
      matter_stage_name: matterStageName,

      status: textValue(row.status || matterStageName),
      closeReason: textValue(row.closeReason || row.close_reason),
      close_reason: textValue(row.closeReason || row.close_reason),

      indexAaaNumber: textValue(row.indexAaaNumber || row.index_aaa_number),
      index_aaa_number: textValue(row.indexAaaNumber || row.index_aaa_number),

      treatingProvider: textValue(row.treatingProvider || row.treating_provider),
      treating_provider: textValue(row.treatingProvider || row.treating_provider),

      localClaimIndexHydration: true,
    };
  }

  function applyIdentityFieldToMatterState(field: "patient_name" | "client_name" | "insurer_name" | "claim_number_raw", value: string) {
    setMatter((current: any) => {
      if (!current) return current;

      if (field === "patient_name") {
        const existingPatient = current.patient && typeof current.patient === "object" ? current.patient : {};
        return {
          ...current,
          patient: {
            ...existingPatient,
            name: value,
          },
          patientName: value,
          patient_name: value,
        };
      }

      if (field === "client_name") {
        const existingClient = current.client && typeof current.client === "object" ? current.client : {};
        return {
          ...current,
          client: {
            ...existingClient,
            name: value,
          },
          clientName: value,
          client_name: value,
          provider: value,
          providerName: value,
          provider_name: value,
        };
      }

      if (field === "insurer_name") {
        return {
          ...current,
          insurer: value,
          insurerName: value,
          insurer_name: value,
          insuranceCompany: value,
          insurance_company: value,
        };
      }

      if (field === "claim_number_raw") {
        return {
          ...current,
          claimNumber: value,
          claim_number: value,
          claimNumberRaw: value,
          claim_number_raw: value,
        };
      }

      return current;
    });
  }

  async function saveIdentityFieldEditDialog() {
    if (!identityFieldEditModal) return;

    const value = textValue(identityFieldEditInput);

    if (!value) {
      setIdentityFieldEditResult({
        ok: false,
        error: identityFieldEditLabel(identityFieldEditModal) + " is required.",
      });
      return;
    }

    try {
      setIdentityFieldEditLoading(true);
      setIdentityFieldEditResult(null);

      const response = await fetch("/api/matters/identity-field", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matterId: Number(matterId),
          matterDisplayNumber: textValue(matter?.displayNumber || matter?.display_number),
          fieldName: identityFieldEditModal,
          fieldValue: value,
          actorName: "Barsh Matters User",
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        setIdentityFieldEditResult({
          ok: false,
          error: json?.error || identityFieldEditLabel(identityFieldEditModal) + " could not be saved.",
          details: json,
        });
        return;
      }

      applyIdentityFieldToMatterState(identityFieldEditModal, json?.field?.fieldValue || value);

      setIdentityFieldEditResult({
        ok: true,
        message: identityFieldEditLabel(identityFieldEditModal) + " saved.",
        safety: json.safety,
      });

      setIdentityFieldEditModal(null);
      setIdentityFieldEditInput("");
    } catch (error: any) {
      setIdentityFieldEditResult({
        ok: false,
        error: error?.message || String(error),
      });
    } finally {
      setIdentityFieldEditLoading(false);
    }
  }

  const identityEditButtonStyle = {
    border: "1px solid #93c5fd",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 11,
    fontWeight: 900,
    padding: "3px 8px",
    cursor: identityFieldEditLoading ? "not-allowed" : "pointer",
  };

  function openDosEditDialog() {
    setDirectFieldEditResult(null);
    setDosStartInput(directFieldDateInputValue(matter?.dosStart));
    setDosEndInput(directFieldDateInputValue(matter?.dosEnd));
    setDirectFieldEditModal("dos");
  }

  async function saveDosEditDialog() {
    const dosStart = String(dosStartInput || "").trim();
    const dosEnd = String(dosEndInput || "").trim();

    if (!dosStart || !dosEnd) {
      setDirectFieldEditResult({
        ok: false,
        error: "DOS Start and DOS End are required.",
      });
      return;
    }

    try {
      setDirectFieldEditLoading(true);
      setDirectFieldEditResult(null);

      const response = await fetch("/api/matters/update-direct-field", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matterId,
          field: "dos",
          dosStart,
          dosEnd,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        setDirectFieldEditResult({
          ok: false,
          error: json?.error || "Date of Service could not be updated.",
          details: json,
        });
        return;
      }

      if (json?.matter) {
        setMatter((current: any) => ({
          ...(current || {}),
          ...json.matter,
        }));
      }

      setDirectFieldEditResult({
        ok: true,
        message: "Date of Service updated locally.",
        safety: json.safety,
      });
      setDirectFieldEditModal(null);
    } catch (error: any) {
      setDirectFieldEditResult({
        ok: false,
        error: error?.message || String(error),
      });
    } finally {
      setDirectFieldEditLoading(false);
    }
  }

  function picklistOptionsForDirectField(field: "denialReason" | "status" | "finalStatus"): any[] {
    if (field === "denialReason") {
      return directFieldPicklists?.denialReason?.options || directFieldPicklists?.denialReasons || [];
    }

    if (field === "finalStatus") {
      return directFieldPicklists?.closeReason?.options || directFieldPicklists?.closeReasons || [];
    }

    return directFieldPicklists?.status?.options || directFieldPicklists?.status || directFieldPicklists?.matterStages || [];
  }

  function optionLabel(option: any): string {
    return textValue(option?.label || option?.name || option?.value || option?.id);
  }

  function optionValue(option: any): string {
    return textValue(option?.value || option?.id || option?.label || option?.name);
  }

  function findOptionValueByLabel(options: any[], label: string): string {
    const target = textValue(label).toLowerCase();
    if (!target) return "";
    const found = options.find((option) => optionLabel(option).toLowerCase() === target);
    return found ? optionValue(found) : "";
  }

  async function loadDirectFieldPicklists() {
    if (directFieldPicklists) return directFieldPicklists;

    setDirectFieldPicklistsLoading(true);

    try {
      const [denialJson, closedJson] = await Promise.all([
        fetch("/api/reference-data/options?type=denial_reason", { cache: "no-store" })
          .then((result) => result.json())
          .catch(() => null),
        fetch("/api/reference-data/options?type=closed_reason", { cache: "no-store" })
          .then((result) => result.json())
          .catch(() => null),
      ]);

      const currentStatus = textValue(matter?.matterStage?.name || matter?.matter_stage_name || matter?.status);
      const statusOptions = Array.from(
        new Set(
          [
            currentStatus,
            "INTAKE - NEW BILLING TO REVIEW",
            "VERIFICATION - 1st RESPONSE SENT",
            "READY FOR ARBITRATION/LITIGATION",
            "Open",
            "Pending",
            "Closed",
          ].filter(Boolean)
        )
      ).map((label) => ({
        id: label,
        value: label,
        label,
        name: label,
      }));

      const json = {
        ok: true,
        source: "reference-data-options",
        noClioWrite: true,
        noClioRead: true,
        denialReason: {
          options: Array.isArray(denialJson?.options) ? denialJson.options : [],
        },
        denialReasons: Array.isArray(denialJson?.options) ? denialJson.options : [],
        closeReason: {
          options: Array.isArray(closedJson?.options) ? closedJson.options : [],
        },
        closeReasons: Array.isArray(closedJson?.options) ? closedJson.options : [],
        status: {
          options: statusOptions,
        },
        matterStages: statusOptions,
      };

      setDirectFieldPicklists(json);
      return json;
    } finally {
      setDirectFieldPicklistsLoading(false);
    }
  }

  async function openPicklistEditDialog(field: "denialReason" | "status" | "finalStatus") {
    setDirectFieldEditResult(null);
    setDirectFieldEditModal(field);

    const picklists = await loadDirectFieldPicklists();

    if (field === "denialReason") {
      const options = picklists?.denialReason?.options || picklists?.denialReasons || [];
      setDenialReasonInput(findOptionValueByLabel(options, denialReasonValue(matter)));
    }

    if (field === "status") {
      const options = picklists?.status?.options || picklists?.status || picklists?.matterStages || [];
      setMatterStageInput(findOptionValueByLabel(options, textValue(matter?.matterStage?.name)));
    }

    if (field === "finalStatus") {
      const options = picklists?.closeReason?.options || picklists?.closeReasons || [];
      setFinalStatusInput(findOptionValueByLabel(options, textValue(matter?.closeReason)));
    }
  }

  function directPicklistFieldLabel(field: "denialReason" | "status" | "finalStatus"): string {
    if (field === "denialReason") return "Denial Reason";
    if (field === "status") return "Status";
    return "Closed Reason";
  }

  function directPicklistInputValue(field: "denialReason" | "status" | "finalStatus"): string {
    if (field === "denialReason") return denialReasonInput;
    if (field === "status") return matterStageInput;
    return finalStatusInput;
  }

  function setDirectPicklistInputValue(field: "denialReason" | "status" | "finalStatus", value: string) {
    if (field === "denialReason") setDenialReasonInput(value);
    if (field === "status") setMatterStageInput(value);
    if (field === "finalStatus") setFinalStatusInput(value);
  }

  async function savePicklistEditDialog(field: "denialReason" | "status" | "finalStatus") {
    const value = directPicklistInputValue(field);

    if (!value) {
      setDirectFieldEditResult({
        ok: false,
        error: `${directPicklistFieldLabel(field)} is required.`,
      });
      return;
    }

    try {
      setDirectFieldEditLoading(true);
      setDirectFieldEditResult(null);

      const body: any = {
        matterId,
        field,
      };

      const selectedOption = picklistOptionsForDirectField(field).find((option: any) => optionValue(option) === value);
      const selectedLabel = optionLabel(selectedOption || { label: value, value });

      if (field === "denialReason") {
        body.denialReasonValue = value;
        body.denialReasonLabel = selectedLabel;
      }

      if (field === "status") {
        body.statusValue = selectedLabel || value;
        body.statusLabel = selectedLabel || value;
      }

      if (field === "finalStatus") {
        body.finalStatusValue = value;
        body.finalStatusLabel = selectedLabel;
      }

      const response = await fetch("/api/matters/update-direct-field", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        setDirectFieldEditResult({
          ok: false,
          error: json?.error || `${directPicklistFieldLabel(field)} could not be updated.`,
          details: json,
        });
        return;
      }

      if (json?.matter) {
        setMatter((current: any) => ({
          ...(current || {}),
          ...json.matter,
        }));
      }

      setDirectFieldEditResult({
        ok: true,
        message: `${directPicklistFieldLabel(field)} updated locally.`,
        safety: json.safety,
      });
      setDirectFieldEditModal(null);
    } catch (error: any) {
      setDirectFieldEditResult({
        ok: false,
        error: error?.message || String(error),
      });
    } finally {
      setDirectFieldEditLoading(false);
    }
  }

  async function loadPaymentReceipts(matterIdInput?: string) {
    const targetMatterId = String(matterIdInput || matterId || "").trim();

    if (!targetMatterId) return;

    setPaymentReceiptsLoading(true);

    try {
      const json = await fetch(
        `/api/matters/apply-payment?matterId=${encodeURIComponent(targetMatterId)}&claimAmount=${encodeURIComponent(String(num(matter?.claimAmount)))}`,
        { cache: "no-store" }
      ).then((r) => r.json());

      if (json?.ok && Array.isArray(json.rows)) {
        const rows = Array.isArray(json.rows) ? json.rows : [];
        setPaymentReceipts(rows);

        if (json?.after) {
          setMatter((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              paymentVoluntary: json.after.paymentVoluntary ?? prev.paymentVoluntary,
              balancePresuit: json.after.balancePresuit ?? prev.balancePresuit,
            };
          });
        }
      }
    } catch {
      setPaymentReceipts([]);
    } finally {
      setPaymentReceiptsLoading(false);
    }
  }



  function resetPaymentFormInputs() {
    setPaymentAmountInput("");
    setPaymentDateInput(formatPaymentDateYYYYMMDD(new Date()));
    setPaymentTransactionTypeInput("Collection Payment");
    setPaymentTransactionStatusInput("Show on Remittance");
    setPaymentCheckDateInput("");
    setPaymentCheckNumberInput("");
    setPaymentEditingReceipt(null);
  }

  function beginEditPaymentReceipt(receipt: any) {
    if (receipt?.voided) {
      setPaymentApplyResult({ ok: false, error: "Cannot edit a voided payment receipt." });
      return;
    }

    setPaymentApplyResult(null);
    setPaymentEditingReceipt(receipt);
    setPaymentAmountInput(String(num(receipt?.paymentAmount).toFixed(2)));
    setPaymentDateInput(formatPaymentDateYYYYMMDD(receipt?.paymentDate));
    setPaymentTransactionTypeInput(textValue(receipt?.transactionType) || "Collection Payment");
    setPaymentTransactionStatusInput(textValue(receipt?.transactionStatus) || "Show on Remittance");
    setPaymentCheckDateInput(receipt?.checkDate ? formatPaymentDateYYYYMMDD(receipt.checkDate) : "");
    setPaymentCheckNumberInput(textValue(receipt?.checkNumber));
    setPaymentFormOpen(true);
  }

  async function handleVoidPaymentReceipt(receipt: any) {
    const receiptId = Number(receipt?.id || 0);
    const receiptDisplayNumber = textValue(receipt?.displayNumber) || textValue(matter?.displayNumber);
    const receiptAmount = num(receipt?.paymentAmount);

    if (!receiptId) {
      setPaymentApplyResult({ ok: false, error: "Could not identify the payment receipt to void." });
      return;
    }

    if (receipt?.voided) {
      setPaymentApplyResult({ ok: false, error: "This payment receipt is already voided." });
      return;
    }

    const confirmed = window.confirm(
      [
        "Void this payment?",
        "",
        `Receipt: ${receiptDisplayNumber || "—"}`,
        `Amount: ${money(receiptAmount)}`,
        "",
        "This will void the Barsh Matters local payment record and keep the receipt as a voided audit record.",
      ].join("\\n")
    );

    if (!confirmed) return;

    try {
      setPaymentVoidLoadingId(receiptId);
      setPaymentApplyResult(null);

      const response = await fetch("/api/matters/apply-payment", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptId,
          matterId,
          expectedDisplayNumber: textValue(matter?.displayNumber),
          voidReason: `Voided from ${textValue(matter?.displayNumber) || "matter"} payment table`,
          voidedBy: "Barsh Matters UI",
          claimAmount: num(matter?.claimAmount),
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        setPaymentApplyResult({
          ok: false,
          error: json?.error || "Payment could not be voided.",
          details: json,
        });
        return;
      }

      setPaymentApplyResult({
        ok: true,
        action: "void-payment",
        paymentApplied: -receiptAmount,
        after: json?.after,
        receipt: json?.receipt,
        message: `Voided ${money(receiptAmount)} payment receipt.`,
      });

      await loadPaymentReceipts(matterId);

      setMatter((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          paymentVoluntary: json?.after?.paymentVoluntary ?? prev.paymentVoluntary,
          balancePresuit: json?.after?.balancePresuit ?? prev.balancePresuit,
        };
      });

      maybePromptCloseMatterAfterPayment();
    } catch (error: any) {
      setPaymentApplyResult({ ok: false, error: error?.message || String(error) });
    } finally {
      setPaymentVoidLoadingId(null);
    }
  }

  async function applyVoluntaryPaymentFromSummary() {
    setPaymentApplyResult(null);

    const paymentAmount = Number(String(paymentAmountInput).replace(/[$,\s]/g, ""));
    const paymentDate = String(paymentDateInput || "").trim();

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      setPaymentApplyResult({
        ok: false,
        error: "Enter a valid payment amount greater than $0.00.",
      });
      return;
    }

    if (!paymentDateInputIsValid(paymentDate)) {
      setPaymentApplyResult({
        ok: false,
        error: "Enter the payment date in MM.DD.YYYY format.",
      });
      return;
    }

    const editingReceipt = paymentEditingReceipt;
    const previousPaymentAmount = editingReceipt ? num(editingReceipt?.paymentAmount) : 0;
    const paymentDelta = editingReceipt ? paymentAmount - previousPaymentAmount : paymentAmount;

    const claimAmount = num(matter?.claimAmount);
    const currentPaymentVoluntary = num(matter?.paymentVoluntary);
    const currentBalancePresuit = currentDirectMatterBalancePresuit(matter);
    const newPaymentVoluntary = currentPaymentVoluntary + paymentDelta;
    const newBalancePresuit = Math.max(currentBalancePresuit - paymentDelta, 0);

    if (paymentDelta > currentBalancePresuit) {
      setPaymentApplyResult({
        ok: false,
        error:
          `Payment exceeds the current Balance Presuit.  Current Balance Presuit: ${money(currentBalancePresuit)}.  ${editingReceipt ? "Edit Delta" : "Payment Entered"}: ${money(paymentDelta)}.`,
      });
      return;
    }

    setPaymentApplyLoading(true);

    try {
      const response = await fetch("/api/matters/apply-payment", {
        method: editingReceipt ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receiptId: editingReceipt?.id,
          matterId,
          expectedDisplayNumber: textValue(matter?.displayNumber),
          paymentAmount,
          paymentDate,
          transactionType: paymentTransactionTypeInput,
          transactionStatus: paymentTransactionStatusInput,
          checkDate: paymentCheckDateInput,
          checkNumber: paymentCheckNumberInput,
          description: editingReceipt ? textValue(editingReceipt?.description) || paymentTransactionTypeInput : undefined,
          editedBy: "Barsh Matters UI",
          editReason: editingReceipt ? "Edited from individual payment form" : undefined,
          claimAmount: num(matter?.claimAmount),
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || (editingReceipt ? "Payment edit failed." : "Payment save failed."));
      }

      setPaymentApplyResult(json);

      setMatter((prev: any) => {
        if (!prev || !json?.after) return prev;
        return {
          ...prev,
          paymentVoluntary: json.after.paymentVoluntary ?? prev.paymentVoluntary,
          balancePresuit: json.after.balancePresuit ?? prev.balancePresuit,
        };
      });

      await loadPaymentReceipts(matterId);
      resetPaymentFormInputs();
      setPaymentFormOpen(false);
      maybePromptCloseMatterAfterPayment();
    } catch (error: any) {
      setPaymentApplyResult({
        ok: false,
        error: error?.message || String(error),
      });
    } finally {
      setPaymentApplyLoading(false);
    }
  }


  useEffect(() => {
    if (!matterId) return;
    loadPaymentReceipts(matterId);
  }, [matterId]);

  useEffect(() => {
    if (!matterId) return;

    let cancelled = false;

    async function load() {
      setMatterHydrationLoading(true);
      setMatterHydrationError("");

      try {
        const localParams = new URLSearchParams();
        const numericMatterId = Number(matterId);

        if (Number.isFinite(numericMatterId) && numericMatterId > 0) {
          localParams.set("matterId", String(numericMatterId));
        } else {
          localParams.set("displayNumber", String(matterId));
        }

        const baseResponse = await fetch(`/api/claim-index/by-matter?${localParams.toString()}`, {
          cache: "no-store",
        }).then((result) => result.json());

        if (!baseResponse?.ok || !baseResponse?.overlay) {
          throw new Error(baseResponse?.error || "Matter was not found in local ClaimIndex.");
        }

        const base = normalizeClaimIndexMatter(baseResponse.overlay);
        const claimNumber = textValue(base?.claimNumber || base?.claim_number);

        let relatedRows: any[] = [];

        if (claimNumber) {
          const searchResponse = await fetch(
            `/api/claim-index/search?claim=${encodeURIComponent(claimNumber)}`,
            { cache: "no-store" }
          ).then((result) => result.json()).catch(() => null);

          if (searchResponse?.ok && Array.isArray(searchResponse.rows)) {
            relatedRows = searchResponse.rows.map(normalizeClaimIndexMatter).filter(Boolean);
          }
        }

        if (!relatedRows.some((row) => Number(row?.id) === Number(base?.id))) {
          relatedRows.unshift(base);
        }

        const deduped = Array.from(
          new Map(relatedRows.map((row) => [Number(row?.id), row])).values()
        ).filter((row) => Number(row?.id));

        const sortedAll = deduped.sort((a, b) => {
          const aIsBase = Number(a?.id) === Number(base?.id);
          const bIsBase = Number(b?.id) === Number(base?.id);

          if (aIsBase && !bIsBase) return -1;
          if (!aIsBase && bIsBase) return 1;

          const aMaster = String(a?.masterLawsuitId || "").trim();
          const bMaster = String(b?.masterLawsuitId || "").trim();

          if (aMaster && bMaster) {
            const cmp = aMaster.localeCompare(bMaster);
            if (cmp !== 0) return cmp;
          } else if (aMaster && !bMaster) {
            return -1;
          } else if (!aMaster && bMaster) {
            return 1;
          }

          return String(a?.displayNumber || "").localeCompare(String(b?.displayNumber || ""));
        });

        if (cancelled) return;

        setMatter(base);
        setRows(sortedAll);
        setSelected((prev) =>
          prev.filter((id) => {
            const row = sortedAll.find((r) => Number(r.id) === id);
            return row && !isAggregated(row) && isSelectable(row);
          })
        );
      } catch (err: any) {
        if (!cancelled) {
          setMatterHydrationError(err?.message || "Matter workspace refresh from local ClaimIndex failed.");
        }
      } finally {
        if (!cancelled) {
          setMatterHydrationLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [matterId]);

  function toggle(id: number) {
    const row = rows.find((r) => Number(r.id) === id);

    if (!row) return;
    if (isAggregated(row)) return;
    if (!isSelectable(row)) return;
  if (isDisabledByGroup(row, activeGroupKey)) return;

    const alreadySelected = selected.includes(id);

    if (alreadySelected) {
      setSelected((prev) => prev.filter((x) => x !== id));
      return;
    }

    const selectedRows = rows.filter((r) => selected.includes(Number(r.id)));

    const selectedMasterIds = new Set(
      selectedRows
        .map((r) => textValue(r.masterLawsuitId))
        .filter(Boolean)
    );

    const rowMasterId = textValue(row.masterLawsuitId);

    if (
      selectedMasterIds.size > 0 &&
      rowMasterId &&
      !selectedMasterIds.has(rowMasterId)
    ) {
      alert("Cannot mix matters from different existing lawsuits.");
      return;
    }

    setSelected((prev) => [...prev, id]);
  }

    async function handleCloseMatter() {
    if (!closeMatterTarget?.id || !closeReason) return;

    setClosing(true);

    try {
      const res = await fetch("/api/matters/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matterId: Number(closeMatterTarget.id),
          closeReason,
        }),
      });

      const json = await res.json();

      if (!json.ok) {
        alert(json.error || "Close failed");
        return;
      }

      setShowCloseModal(false);
      setCloseMatterTarget(null);
      setCloseReason("");

      // FORCE fresh Clio-backed refresh (not cache)
      await fetch(`/api/claim-index/refresh-cluster?matterId=${Number(closeMatterTarget.id)}`);

      window.location.reload();
    } catch (err) {
      alert("Close failed");
    } finally {
      setClosing(false);
    }
  }

  async function submitAggregationWithOptions() {
    if (submitting) return;

    const selectedRows = rows.filter((r) => selected.includes(Number(r.id)));

    if (selectedRows.length === 0) {
      alert("Select at least one matter.");
      return;
    }

    const invalid = selectedRows.filter(
      (r) => isAggregated(r) || !isSelectable(r)
    );

    if (invalid.length > 0) {
      alert("One or more selected matters are not eligible for aggregation.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/aggregation/build-lawsuit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          baseMatterId: Number(matter.id),
          selectedMatterIds: selectedRows.map((r) => Number(r.id)),
          lawsuitOptions: {
            venue:
              lawsuitOptions.venue === "Other"
                ? lawsuitOptions.venueOther.trim()
                : lawsuitOptions.venue.trim(),
            venueSelection: lawsuitOptions.venue,
            venueOther: lawsuitOptions.venueOther.trim(),
            amountSoughtMode: lawsuitOptions.amountSoughtMode,
            customAmountSought:
              lawsuitOptions.amountSoughtMode === "custom"
                ? parseMoneyInput(lawsuitOptions.customAmountSought)
                : null,
            indexAaaNumber: lawsuitOptions.indexAaaNumber.trim(),
            notes: lawsuitOptions.notes.trim(),
          },
        }),
      });

      const json = await res.json();

      if (!json.ok) {
        alert(json.error || "Lawsuit build failed");
        return;
      }

      setShowLawsuitOptionsModal(false);

      alert(
        `MASTER CREATED\n\nMaster Matter ID: ${json.masterMatterId}\nMaster Lawsuit ID: ${json.masterLawsuitId}`
      );

      await new Promise((r) => setTimeout(r, 2000));
      window.location.reload();
    } catch (err: any) {
      alert(err?.message || "Lawsuit build failed");
    } finally {
      setSubmitting(false);
    }
  }

  

  function openLawsuitOptionsModal() {
    if (submitting) return;

    const selectedRows = rows.filter((r) => selected.includes(Number(r.id)));

    if (selectedRows.length === 0) {
      alert("Select at least one matter.");
      return;
    }

    const invalid = selectedRows.filter(
      (r) => isAggregated(r) || !isSelectable(r)
    );

    if (invalid.length > 0) {
      alert("One or more selected matters are not eligible for lawsuit generation.");
      return;
    }

    setLawsuitOptions(defaultLawsuitOptions());
    setShowLawsuitOptionsModal(true);
  }

  async function deaggregateCluster() {
    if (!matter?.masterLawsuitId) {
      alert("This matter is not part of a lawsuit.");
      return;
    }

    const clusterRows = rows.filter(
      (r) => String(r.masterLawsuitId || "").trim() === String(matter.masterLawsuitId).trim()
    );

    const clusterSize = clusterRows.length;

    const confirmed = confirm(
      `DE-AGGREGATE LAWSUIT\n\n` +
      `Master Lawsuit ID: ${matter.masterLawsuitId}\n` +
      `Total Matters: ${clusterSize}\n\n` +
      `This will REMOVE ALL matters from this lawsuit.\n\n` +
      `Continue?`
    );

    if (!confirmed) return;

    try {
      const res = await fetch("/api/deaggregate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matters: clusterRows.map((r) => ({
            id: r.id,
            displayNumber: r.displayNumber,
          })),
        }),
      });

      const json = await res.json();

      if (!json.ok) {
        alert(json.error || "De-aggregation failed");
        return;
      }

      alert(
        `DE-AGGREGATION COMPLETE\n\n` +
        `Master Lawsuit ID: ${json.masterLawsuitId}\n` +
        `Cleared: ${json.cleared} matters`
      );

      window.location.reload();
    } catch (err: any) {
      alert(err?.message || "De-aggregation failed");
    }
  }


  async function expandClaim() {
    if (expanding) return;

    setExpanding(true);

    try {
      const res = await fetch(
        `/api/aggregation/expand-claim?matterId=${matterId}&limit=20&delayMs=1200`
      );

      const json = await res.json();

      if (!json.ok) {
        alert(json.error || "Expansion failed");
        return;
      }

      alert(`Expanded claim cluster.\nRefreshed: ${json.refreshed} matters.`);
      window.location.reload();
    } catch (err: any) {
      alert(err?.message || "Expansion failed");
    } finally {
      setExpanding(false);
    }
  }

  async function fetchPacketPreview(masterLawsuitId: string) {
    const res = await fetch(
      `/api/documents/packet?masterLawsuitId=${encodeURIComponent(masterLawsuitId)}`
    );

    const json = await res.json();

    if (!json?.packet) {
      throw new Error(json?.error || "Document packet preview failed.");
    }

    setPacketPreview(json);
    setPacketPreviewOpen(true);

    if (json?.packet?.masterLawsuitId) {
      await loadFinalizationHistory(json.packet.masterLawsuitId);
      await loadPrintQueuePreview(json.packet.masterLawsuitId);
      await loadPrintQueueList(json.packet.masterLawsuitId);
    }

    return json;
  }

  async function loadPacketPreviewForMaster(masterLawsuitId: string) {
    const cleanMasterLawsuitId = textValue(masterLawsuitId);

    if (!cleanMasterLawsuitId) {
      alert("No Master Lawsuit ID found.");
      return;
    }

    setPacketLoading(true);

    try {
      await fetchPacketPreview(cleanMasterLawsuitId);
    } catch (err: any) {
      alert(err?.message || "Document packet preview failed.");
    } finally {
      setPacketLoading(false);
    }
  }

  async function loadPacketPreview() {
    const masterLawsuitId = textValue(matter?.masterLawsuitId);

    if (!masterLawsuitId) {
      alert("This matter is not part of a lawsuit.");
      return;
    }

    await loadPacketPreviewForMaster(masterLawsuitId);
  }

  function packetAmountSoughtValue(packet: any): number {
    const metadataAmount = packet?.metadata?.amountSought?.amount;
    const lawsuitAmount = packet?.lawsuit?.amountSought;
    const totalClaimAmount = packet?.totals?.claimAmountTotal;

    if (metadataAmount !== null && metadataAmount !== undefined && String(metadataAmount).trim() !== "") {
      return num(metadataAmount);
    }

    if (lawsuitAmount !== null && lawsuitAmount !== undefined && String(lawsuitAmount).trim() !== "") {
      return num(lawsuitAmount);
    }

    return num(totalClaimAmount);
  }

  function packetAmountSoughtModeValue(packet: any): string {
    return (
      textValue(packet?.metadata?.amountSought?.mode) ||
      textValue(packet?.lawsuit?.amountSoughtMode) ||
      "claim_amount"
    );
  }

  function packetBillDisplayAmount(child: any): number {
    const billAmount = child?.billAmount ?? child?.amount;
    if (billAmount !== null && billAmount !== undefined && String(billAmount).trim() !== "") {
      return num(billAmount);
    }

    return num(child?.claimAmount);
  }

  function packetChildMatters(packet: any): any[] {
    return (Array.isArray(packet?.childMatters) ? packet.childMatters : []).filter(
      (child: any) => !(child?.isMaster || child?.is_master)
    );
  }

  function packetChildBillTotal(packet: any): number {
    return packetChildMatters(packet).reduce(
      (sum: number, child: any) => sum + packetBillDisplayAmount(child),
      0
    );
  }

  function buildPacketSummaryText(packet: any): string {
    const metadata = packet?.metadata || {};
    const totals = packet?.totals || {};
    const validation = packet?.validation || {};
    const masterMatter = packet?.masterMatter || {};
    const children = Array.isArray(packet?.childMatters) ? packet.childMatters : [];

    const lines: string[] = [];

    lines.push("DOCUMENT PACKET SUMMARY");
    lines.push("");
    lines.push(`Master Lawsuit ID: ${textValue(packet?.masterLawsuitId) || "—"}`);
    lines.push(`Master Matter: ${textValue(masterMatter.displayNumber) || "—"}`);
    lines.push(`Venue: ${textValue(metadata?.venue?.value) || "—"}`);
    lines.push(`Index / AAA Number: ${textValue(metadata?.indexAaaNumber?.value) || "—"}`);
    lines.push(
      `Amount Sought: ${money(metadata?.amountSought?.amount)} (${textValue(metadata?.amountSought?.mode) || "—"})`
    );

    lines.push("");
    lines.push("CAPTION / CLAIM METADATA");
    lines.push(`Provider: ${textValue(metadata?.provider?.value) || "—"}`);
    lines.push(`Patient: ${textValue(metadata?.patient?.value) || "—"}`);
    lines.push(`Insurer: ${textValue(metadata?.insurer?.value) || "—"}`);
    lines.push(`Claim Number: ${textValue(metadata?.claimNumber?.value) || "—"}`);

    lines.push("");
    lines.push("TOTALS");
    lines.push(`Bill Count: ${num(totals.billCount)}`);
    lines.push(`Claim Amount Total: ${money(totals.claimAmountTotal)}`);
    lines.push(`Payment Voluntary Total: ${money(totals.paymentVoluntaryTotal)}`);
    lines.push(`Balance Presuit Total: ${money(totals.balancePresuitTotal)}`);
    lines.push(`Balance Amount Total: ${money(totals.balanceAmountTotal)}`);

    lines.push("");
    lines.push("CHILD BILL MATTERS");

    if (children.length === 0) {
      lines.push("—");
    } else {
      for (const child of children) {
        lines.push(
          [
            textValue(child.displayNumber) || "—",
            `Patient: ${textValue(child.patientName) || "—"}`,
            `Provider: ${textValue(child.providerName) || "—"}`,
            `DOS: ${formatDOS(child.dosStart, child.dosEnd) || "—"}`,
            `Claim Amount: ${money(packetBillDisplayAmount(child))}`,
            `Balance Presuit: ${money(child.balancePresuit)}`,
          ].join(" | ")
        );
      }
    }

    if (validation?.warnings?.length) {
      lines.push("");
      lines.push("WARNINGS");
      for (const warning of validation.warnings) lines.push(`- ${warning}`);
    }

    if (validation?.blockingErrors?.length) {
      lines.push("");
      lines.push("BLOCKING ERRORS");
      for (const error of validation.blockingErrors) lines.push(`- ${error}`);
    }

    return lines.join("\n");
  }

  async function copyPacketSummary() {
    if (!packetPreview?.packet) {
      alert("Load the packet preview first.");
      return;
    }

    const summary = buildPacketSummaryText(packetPreview.packet);

    try {
      await navigator.clipboard.writeText(summary);
      alert("Packet summary copied to clipboard.");
    } catch {
      alert("Could not copy to clipboard.");
    }
  }

  function buildFilingDemandSummaryText(packet: any): string {
    const metadata = packet?.metadata || {};
    const totals = packet?.totals || {};
    const children = Array.isArray(packet?.childMatters) ? packet.childMatters : [];

    const provider = textValue(metadata?.provider?.value) || "—";
    const patient = textValue(metadata?.patient?.value) || "—";
    const insurer = textValue(metadata?.insurer?.value) || "—";
    const claimNumber = textValue(metadata?.claimNumber?.value) || "—";
    const indexAaaNumber = textValue(metadata?.indexAaaNumber?.value) || "—";
    const venue = textValue(metadata?.venue?.value) || "—";
    const amountSought = money(metadata?.amountSought?.amount);
    const amountMode = textValue(metadata?.amountSought?.mode) || "—";

    const dosValues = Array.from(
      new Set(
        children
          .map((child: any) => formatDOS(child.dosStart, child.dosEnd))
          .filter(Boolean)
      )
    );

    const denialReasons = Array.from(
      new Set(
        children
          .map((child: any) => textValue(child.denialReason))
          .filter(Boolean)
      )
    );

    const lines: string[] = [];

    lines.push("FILING / DEMAND SUMMARY");
    lines.push("");
    lines.push(provider);
    lines.push(`as assignee of ${patient}`);
    lines.push("against");
    lines.push(insurer);

    lines.push("");
    lines.push(`Venue: ${venue}`);
    lines.push(`Index / AAA No.: ${indexAaaNumber}`);
    lines.push(`Claim No.: ${claimNumber}`);
    lines.push(`Amount Sought: ${amountSought} (${amountMode})`);

    lines.push("");
    lines.push(`Bill Count: ${num(totals.billCount)}`);
    lines.push(`Claim Amount Total: ${money(totals.claimAmountTotal)}`);
    lines.push(`Payment Voluntary Total: ${money(totals.paymentVoluntaryTotal)}`);
    lines.push(`Balance Presuit Total: ${money(totals.balancePresuitTotal)}`);

    if (dosValues.length > 0) {
      lines.push(`Date(s) of Service: ${dosValues.join("; ")}`);
    }

    if (denialReasons.length > 0) {
      lines.push(`Denial Reason(s): ${denialReasons.join("; ")}`);
    }

    lines.push("");
    lines.push("Bill Matter(s):");

    if (children.length === 0) {
      lines.push("—");
    } else {
      for (const child of children) {
        lines.push(
          [
            textValue(child.displayNumber) || "—",
            `DOS: ${formatDOS(child.dosStart, child.dosEnd) || "—"}`,
            `Claim Amount: ${money(child.claimAmount)}`,
            `Balance Presuit: ${money(child.balancePresuit)}`,
          ].join(" | ")
        );
      }
    }

    return lines.join("\n");
  }

  async function copyFilingDemandSummary() {
    if (!packetPreview?.packet) {
      alert("Load the packet preview first.");
      return;
    }

    const summary = buildFilingDemandSummaryText(packetPreview.packet);

    try {
      await navigator.clipboard.writeText(summary);
      alert("Filing / demand summary copied to clipboard.");
    } catch {
      alert("Could not copy to clipboard.");
    }
  }

  async function loadDocumentGenerationPreview() {
    const masterLawsuitId =
      textValue(packetPreview?.packet?.masterLawsuitId) ||
      textValue(matter?.masterLawsuitId);

    if (!masterLawsuitId) {
      alert("Load a lawsuit packet first.");
      return;
    }

    setDocumentPreviewLoading(true);

    try {
      const res = await fetch(
        `/api/documents/generate-preview?masterLawsuitId=${encodeURIComponent(masterLawsuitId)}`
      );

      const json = await res.json();

      if (!json) {
        alert("Document generation preview failed.");
        return;
      }

      setDocumentPreview(json);
      setFinalizeUploadResult(null);

      if (!json.ok && json?.validation?.blockingErrors?.length) {
        alert(`Documents are blocked:\n\n${json.validation.blockingErrors.join("\n")}`);
      }
    } catch (err: any) {
      alert(err?.message || "Document generation preview failed.");
    } finally {
      setDocumentPreviewLoading(false);
    }
  }

  async function loadFinalizationHistory(masterLawsuitIdInput?: string) {
    const masterLawsuitId =
      textValue(masterLawsuitIdInput) ||
      textValue(packetPreview?.packet?.masterLawsuitId) ||
      textValue(matter?.masterLawsuitId);

    if (!masterLawsuitId) {
      setFinalizationHistory(null);
      return null;
    }

    setFinalizationHistoryLoading(true);

    try {
      const res = await fetch(
        `/api/documents/finalization-history?masterLawsuitId=${encodeURIComponent(masterLawsuitId)}&limit=10`
      );

      const json = await res.json().catch(() => null);

      setFinalizationHistory(json);

      return json;
    } catch (err: any) {
      setFinalizationHistory({
        ok: false,
        error: err?.message || "Could not load finalization history.",
      });

      return null;
    } finally {
      setFinalizationHistoryLoading(false);
    }
  }

  async function loadPrintQueuePreview(masterLawsuitIdInput?: string) {
    const masterLawsuitId =
      textValue(masterLawsuitIdInput) ||
      textValue(packetPreview?.packet?.masterLawsuitId) ||
      textValue(matter?.masterLawsuitId);

    if (!masterLawsuitId) {
      setPrintQueuePreview(null);
      return null;
    }

    setPrintQueuePreviewLoading(true);

    try {
      const res = await fetch(
        `/api/documents/print-queue-preview?masterLawsuitId=${encodeURIComponent(masterLawsuitId)}&limit=10`
      );

      const json = await res.json().catch(() => null);

      setPrintQueuePreview(json);

      return json;
    } catch (err: any) {
      setPrintQueuePreview({
        ok: false,
        error: err?.message || "Could not load print queue preview.",
      });

      return null;
    } finally {
      setPrintQueuePreviewLoading(false);
    }
  }

  async function loadPrintQueueList(
    masterLawsuitIdInput?: string,
    statusFilterInput?: "" | "queued" | "printed" | "hold" | "skipped"
  ) {
    const masterLawsuitId =
      textValue(masterLawsuitIdInput) ||
      textValue(packetPreview?.packet?.masterLawsuitId) ||
      textValue(matter?.masterLawsuitId);

    const statusFilter =
      statusFilterInput === undefined ? printQueueStatusFilter : statusFilterInput;

    if (!masterLawsuitId) {
      setPrintQueueList(null);
      return null;
    }

    setPrintQueueListLoading(true);

    try {
      const url = new URL("/api/documents/print-queue", window.location.origin);
      url.searchParams.set("masterLawsuitId", masterLawsuitId);
      url.searchParams.set("limit", "20");

      if (statusFilter) {
        url.searchParams.set("status", statusFilter);
      }

      const res = await fetch(url.toString());

      const json = await res.json().catch(() => null);
      setPrintQueueList(json);

      return json;
    } catch (err: any) {
      setPrintQueueList({
        ok: false,
        error: err?.message || "Could not load print queue.",
      });

      return null;
    } finally {
      setPrintQueueListLoading(false);
    }
  }


  async function changePrintQueueStatusFilter(
    nextStatusFilter: "" | "queued" | "printed" | "hold" | "skipped"
  ) {
    setPrintQueueStatusFilter(nextStatusFilter);

    const masterLawsuitId =
      textValue(packetPreview?.packet?.masterLawsuitId) ||
      textValue(matter?.masterLawsuitId);

    if (masterLawsuitId) {
      await loadPrintQueueList(masterLawsuitId, nextStatusFilter);
    }
  }


  async function addVerifiedCandidatesToPrintQueue(masterLawsuitIdInput?: string) {
    const masterLawsuitId =
      masterLawsuitIdInput || packetPreview?.packet?.masterLawsuitId || "";

    if (!masterLawsuitId) {
      setPrintQueueAddResult({
        ok: false,
        error: "No MASTER_LAWSUIT_ID is available for print queue creation.",
      });
      return;
    }

    setPrintQueueAddLoading(true);
    setPrintQueueAddResult(null);

    try {
      const res = await fetch("/api/documents/print-queue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          masterLawsuitId,
          confirmAdd: true,
        }),
      });

      const json = await res.json();
      setPrintQueueAddResult(json);

      if (json?.ok) {
        await loadPrintQueuePreview(masterLawsuitId);
        await loadPrintQueueList(masterLawsuitId);
      }
    } catch (err: any) {
      setPrintQueueAddResult({
        ok: false,
        error: err?.message || "Could not add documents to the print queue.",
      });
    } finally {
      setPrintQueueAddLoading(false);
    }
  }


  async function updatePrintQueueStatus(row: any, status: "queued" | "printed" | "hold" | "skipped") {
    const id = Number(row?.id);
    const masterLawsuitId =
      textValue(row?.masterLawsuitId) ||
      textValue(packetPreview?.packet?.masterLawsuitId) ||
      textValue(matter?.masterLawsuitId);

    if (!Number.isFinite(id) || id <= 0) {
      setPrintQueueStatusResult({
        ok: false,
        error: "Missing print queue item id.",
      });
      return;
    }

    const label =
      status === "printed"
        ? "mark this document as printed"
        : status === "hold"
          ? "place this document on hold"
          : status === "skipped"
            ? "mark this document as skipped"
            : "return this document to queued status";

    const confirmed = confirm(
      `UPDATE PRINT QUEUE STATUS\n\n` +
        `Document: ${textValue(row?.documentLabel) || textValue(row?.documentKey) || "—"}\n` +
        `Filename: ${textValue(row?.filename) || "—"}\n\n` +
        `This will ${label}.\n\n` +
        `This updates only the local print queue record.  It will not change Clio, upload documents, create folders, or modify document contents.\n\n` +
        `Continue?`
    );

    if (!confirmed) return;

    setPrintQueueStatusLoadingId(id);
    setPrintQueueStatusResult(null);

    try {
      const res = await fetch("/api/documents/print-queue", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          status,
          confirmStatusUpdate: true,
        }),
      });

      const json = await res.json().catch(() => null);
      setPrintQueueStatusResult(json);

      if (json?.ok && masterLawsuitId) {
        await loadPrintQueueList(masterLawsuitId);
      }
    } catch (err: any) {
      setPrintQueueStatusResult({
        ok: false,
        error: err?.message || "Could not update print queue status.",
      });
    } finally {
      setPrintQueueStatusLoadingId(null);
    }
  }


  async function loadFinalizePreview() {
    const masterLawsuitId =
      textValue(packetPreview?.packet?.masterLawsuitId) ||
      textValue(matter?.masterLawsuitId);

    if (!masterLawsuitId) {
      alert("Load a lawsuit packet first.");
      return;
    }

    setDocumentPreviewLoading(true);

    try {
      const res = await fetch(
        `/api/documents/finalize-preview?masterLawsuitId=${encodeURIComponent(masterLawsuitId)}`
      );

      const json = await res.json();

      if (!json) {
        alert("Finalize documents preview failed.");
        return;
      }

      setDocumentPreview(json);
      setFinalizeUploadResult(null);

      if (!json.ok && json?.validation?.blockingErrors?.length) {
        alert(`Finalization is blocked:\n\n${json.validation.blockingErrors.join("\n")}`);
      }
    } catch (err: any) {
      alert(err?.message || "Finalize documents preview failed.");
    } finally {
      setDocumentPreviewLoading(false);
    }
  }


  async function uploadFinalDocumentsToClio() {
    if (finalizeUploadLoading) return;

    const masterLawsuitId =
      textValue(packetPreview?.packet?.masterLawsuitId) ||
      textValue(matter?.masterLawsuitId);

    if (!masterLawsuitId) {
      alert("Load a lawsuit packet first.");
      return;
    }

    if (documentPreview?.action !== "finalize-preview" || !documentPreview?.ok) {
      alert("Run Finalize Documents Preview successfully before uploading final documents to Clio.");
      return;
    }

    const plannedDocuments = Array.isArray(documentPreview?.plannedDocuments)
      ? documentPreview.plannedDocuments
      : [];

    const uploadableDocuments = plannedDocuments.filter(
      (doc: any) => doc?.wouldGenerate && doc?.wouldUploadToClio
    );

    if (uploadableDocuments.length === 0) {
      alert("No final documents are ready for upload.");
      return;
    }

    const targetDisplay =
      textValue(documentPreview?.clioUploadTarget?.displayNumber) || "the Clio master matter";
    const targetMatterId = textValue(documentPreview?.clioUploadTarget?.matterId);

    const documentList = uploadableDocuments
      .map((doc: any) => `- ${textValue(doc.label) || textValue(doc.key)}: ${textValue(doc.filename)}`)
      .join("\n");

    const confirmed = confirm(
      `FINALIZE AND UPLOAD TO CLIO\n\n` +
        `Target: ${targetDisplay}${targetMatterId ? ` / Matter ID ${targetMatterId}` : ""}\n\n` +
        `This will upload the following final document copy/copies to the Clio master matter Documents tab:\n\n` +
        `${documentList}\n\n` +
        `This is an explicit finalization action. Preview and download actions remain non-persistent.\n\n` +
        `WARNING: Running this again may create duplicate uploaded documents in Clio.\n\n` +
        `Continue?`
    );

    if (!confirmed) return;

    setFinalizeUploadLoading(true);
    setFinalizeUploadResult(null);

    try {
      const res = await fetch("/api/documents/finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          masterLawsuitId,
          confirmUpload: true,
          documentKeys: uploadableDocuments.map((doc: any) => textValue(doc.key)).filter(Boolean),
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setFinalizeUploadResult(json || { ok: false, error: "Finalize upload failed." });
        alert(json?.error || "Finalize upload failed.");
        return;
      }

      setFinalizeUploadResult(json);
      await loadFinalizationHistory(masterLawsuitId);
      await loadPrintQueuePreview(masterLawsuitId);

      const uploadedCount = Array.isArray(json.uploaded) ? json.uploaded.length : 0;
      alert(`Final upload complete.\n\nUploaded to Clio: ${uploadedCount} document(s).`);
    } catch (err: any) {
      const result = {
        ok: false,
        error: err?.message || "Finalize upload failed.",
      };

      setFinalizeUploadResult(result);
      alert(result.error);
    } finally {
      setFinalizeUploadLoading(false);
    }
  }

  function downloadBillScheduleDocx() {
    const masterLawsuitId = textValue(packetPreview?.packet?.masterLawsuitId || matter?.masterLawsuitId);

    if (!masterLawsuitId) {
      alert("No Master Lawsuit ID found.");
      return;
    }

    window.open(
      `/api/documents/bill-schedule?masterLawsuitId=${encodeURIComponent(masterLawsuitId)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function downloadPacketSummaryDocx() {
    const masterLawsuitId = textValue(packetPreview?.packet?.masterLawsuitId || matter?.masterLawsuitId);

    if (!masterLawsuitId) {
      alert("No Master Lawsuit ID found.");
      return;
    }

    window.open(
      `/api/documents/packet-summary?masterLawsuitId=${encodeURIComponent(masterLawsuitId)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function downloadSummonsComplaintDocx() {
    const masterLawsuitId = textValue(packetPreview?.packet?.masterLawsuitId || matter?.masterLawsuitId);

    if (!masterLawsuitId) {
      alert("No Master Lawsuit ID found.");
      return;
    }

    window.open(
      `/api/documents/summons-complaint?masterLawsuitId=${encodeURIComponent(masterLawsuitId)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }


  async function openMetadataModalForMaster(masterLawsuitIdInput?: string) {
    const masterLawsuitId =
      textValue(masterLawsuitIdInput) || textValue(matter?.masterLawsuitId);

    if (!masterLawsuitId) {
      alert("This matter is not part of a lawsuit.");
      return;
    }

    setPacketLoading(true);

    try {
      const currentPreviewMasterId = textValue(packetPreview?.packet?.masterLawsuitId);
      const json =
        packetPreview?.packet && currentPreviewMasterId === masterLawsuitId
          ? packetPreview
          : await fetchPacketPreview(masterLawsuitId);

      const lawsuit = json?.packet?.lawsuit || null;
      const metadata = json?.packet?.metadata || {};

      setMetadataEdit({
        venueSelection:
          textValue(lawsuit?.venueSelection) ||
          textValue(metadata?.venue?.selection) ||
          textValue(lawsuit?.venue) ||
          "",
        venueOther: textValue(lawsuit?.venueOther),
        amountSoughtMode:
          textValue(lawsuit?.amountSoughtMode) === "claim_amount" ||
          textValue(lawsuit?.amountSoughtMode) === "custom"
            ? (textValue(lawsuit?.amountSoughtMode) as AmountSoughtMode)
            : "balance_presuit",
        customAmountSought:
          textValue(lawsuit?.customAmountSought) ||
          textValue(metadata?.amountSought?.customAmount) ||
          "",
        indexAaaNumber:
          textValue(lawsuit?.indexAaaNumber) ||
          textValue(metadata?.indexAaaNumber?.value) ||
          "",
        lawsuitNotes:
          textValue(lawsuit?.lawsuitNotes) ||
          textValue(metadata?.lawsuitNotes) ||
          "",
      });

      setShowMetadataModal(true);
    } catch (err: any) {
      alert(err?.message || "Could not load lawsuit metadata.");
    } finally {
      setPacketLoading(false);
    }
  }

  async function openMetadataModal() {
    await openMetadataModalForMaster();
  }

  async function searchSettledWithContacts() {
    const query = textValue(settlementPreviewInput.settledWithContactSearch || settlementPreviewInput.settledWith);

    if (query.length < 2) {
      alert("Enter at least 2 characters to search local contacts.");
      return;
    }

    setSettledWithContactLoading(true);

    try {
      const res = await fetch(`/api/reference-data/${"contact-search"}?q=${encodeURIComponent(query)}&type=individual`);
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        alert(json?.error || "Could not search local contacts.");
        setSettledWithContactResults([]);
        return;
      }

      setSettledWithContactResults(Array.isArray(json.contacts) ? json.contacts : []);
    } catch (err: any) {
      alert(err?.message || "Could not search local contacts.");
      setSettledWithContactResults([]);
    } finally {
      setSettledWithContactLoading(false);
    }
  }

  function selectSettledWithContact(contact: any) {
    const id = textValue(contact?.id);
    const name = textValue(contact?.name);

    if (!id || !name) return;

    setSettlementPreviewInput({
      ...settlementPreviewInput,
      settledWith: name,
      settledWithContactId: id,
      settledWithContactName: name,
      settledWithContactType: textValue(contact?.type),
      settledWithContactSearch: name,
    });

    setSettledWithContactResults([]);
    setSettlementPreviewResult(null);
    setSettlementWritebackPreviewResult(null);
    setSettlementWritebackResult(null);
  }

  async function loadProviderFeeDefaultsFromClio(options?: { silent?: boolean }) {
    const silent = !!options?.silent;

    if (!matterId) {
      if (!silent) {
        alert("No matterId found.  Open a matter before loading provider fee defaults.");
      }
      return;
    }

    setProviderFeeDefaultsLoading(true);
    setProviderFeeDefaultsResult(null);

    try {
      const res = await fetch(
        `/api/settlements/provider-fee-defaults?matterId=${encodeURIComponent(String(matterId))}`
      );
      const json = await res.json();
      setProviderFeeDefaultsResult(json);

      if (!res.ok || !json?.ok) {
        if (!silent) {
          alert(json?.error || "Could not load provider fee defaults from Clio.");
        }
        return;
      }

      const principalDefault = json?.defaults?.principalFeePercent;
      const interestDefault = json?.defaults?.interestFeePercent;

      if (principalDefault == null && interestDefault == null) {
        if (!silent) {
          const missing = Array.isArray(json?.validation?.missingDefaults)
            ? json.validation.missingDefaults.join(", ")
            : "provider fee defaults";
          alert(`No provider fee defaults are populated in Clio for this provider.  Missing: ${missing}.  You may enter the percentages manually.`);
        }
        return;
      }

      setSettlementPreviewInput((prev) => ({
        ...prev,
        principalFeePercent:
          principalDefault == null ? prev.principalFeePercent : String(principalDefault),
        interestFeePercent:
          interestDefault == null ? prev.interestFeePercent : String(interestDefault),
      }));
      setSettlementPreviewResult(null);
      setSettlementWritebackPreviewResult(null);
      setSettlementWritebackResult(null);

      if (!silent && (principalDefault == null || interestDefault == null)) {
        const missing = Array.isArray(json?.validation?.missingDefaults)
          ? json.validation.missingDefaults.join(", ")
          : "one or more provider fee defaults";
        alert(`Partial provider fee defaults loaded.  Missing: ${missing}.  Any missing percentage field was left unchanged and may be entered manually.`);
      }
    } catch (err: any) {
      const fallback = {
        ok: false,
        action: "settlement-provider-fee-defaults",
        error: err?.message || "Could not load provider fee defaults from Clio.",
        safety: {
          readOnly: true,
          noClioRecordsChanged: true,
          noDatabaseRecordsChanged: true,
          noDocumentsGenerated: true,
          noPrintQueueRecordsChanged: true,
        },
      };
      setProviderFeeDefaultsResult(fallback);
      if (!silent) {
        alert(fallback.error);
      }
    } finally {
      setProviderFeeDefaultsLoading(false);
    }
  }

  useEffect(() => {
    if (activeWorkspaceTab !== "settlement") return;
    if (!matterId) return;

    const matterKey = String(matterId);
    if (providerFeeDefaultsAutoLoadedMatterId === matterKey) return;

    setProviderFeeDefaultsAutoLoadedMatterId(matterKey);
    void loadProviderFeeDefaultsFromClio({ silent: true });
  }, [activeWorkspaceTab, matterId, providerFeeDefaultsAutoLoadedMatterId]);

  async function loadSettlementPreview() {
    const masterLawsuitId = tabMasterLawsuitId;

    if (!masterLawsuitId) {
      alert("No MASTER_LAWSUIT_ID found.  Generate or connect a lawsuit before previewing settlement.");
      return;
    }

    const grossSettlementAmount = parseMoneyInput(settlementPreviewInput.grossSettlementAmount);

    if (grossSettlementAmount === null || grossSettlementAmount <= 0) {
      alert("Enter a gross settlement amount greater than zero.");
      return;
    }

    if (!textValue(settlementPreviewInput.settledWithContactId)) {
      alert("Select Settled With from local contacts before previewing settlement.");
      return;
    }

    setSettlementPreviewLoading(true);
    setSettlementPreviewResult(null);

    try {
      const res = await fetch("/api/settlements/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          masterLawsuitId,
          grossSettlementAmount,
          settledWith: settlementPreviewInput.settledWithContactName || settlementPreviewInput.settledWith,
          settledWithContactId: settlementPreviewInput.settledWithContactId,
          settledWithContactName: settlementPreviewInput.settledWithContactName || settlementPreviewInput.settledWith,
          settledWithContactType: settlementPreviewInput.settledWithContactType,
          settlementDate: settlementPreviewInput.settlementDate,
          paymentExpectedDate: settlementPreviewInput.paymentExpectedDate,
          allocationMode: settlementPreviewInput.allocationMode,
          principalFeePercent: parseMoneyInput(settlementPreviewInput.principalFeePercent) ?? 0,
          interestAmount: parseMoneyInput(settlementPreviewInput.interestAmount) ?? 0,
          interestFeePercent: parseMoneyInput(settlementPreviewInput.interestFeePercent) ?? 0,
          notes: settlementPreviewInput.notes,
        }),
      });

      const json = await res.json();
      setSettlementPreviewResult(json);

      if (!res.ok || !json?.ok) {
        const blockingErrors = Array.isArray(json?.validation?.blockingErrors)
          ? json.validation.blockingErrors
          : [];
        alert(
          json?.error ||
            (blockingErrors.length > 0
              ? `Settlement preview blocked:\n\n${blockingErrors.join("\n")}`
              : "Settlement preview failed.")
        );
      }
    } catch (err: any) {
      setSettlementPreviewResult({
        ok: false,
        action: "settlement-preview",
        dryRun: true,
        error: err?.message || "Settlement preview failed.",
        safety: {
          noClioRecordsChanged: true,
          noDatabaseRecordsChanged: true,
          noDocumentsGenerated: true,
          noPrintQueueRecordsChanged: true,
          noPersistentFilesCreated: true,
        },
      });
      alert(err?.message || "Settlement preview failed.");
    } finally {
      setSettlementPreviewLoading(false);
    }
  }

  async function loadSettlementWritebackPreview() {
    const masterLawsuitId = tabMasterLawsuitId;

    if (!masterLawsuitId) {
      alert("No MASTER_LAWSUIT_ID found.  Generate or connect a lawsuit before validating settlement writeback.");
      return;
    }

    if (!settlementPreviewResult?.ok || !Array.isArray(settlementPreviewResult.rows)) {
      alert("Run a successful settlement preview before validating Clio writeback readiness.");
      return;
    }

    setSettlementWritebackPreviewLoading(true);
    setSettlementWritebackPreviewResult(null);

    try {
      const res = await fetch("/api/settlements/writeback-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          masterLawsuitId,
          rows: settlementPreviewResult.rows.map((row: any) => ({
            clioWritebackPreview: row.clioWritebackPreview,
          })),
        }),
      });

      const json = await res.json();
      setSettlementWritebackPreviewResult(json);

      if (!res.ok || !json?.ok) {
        const blockingErrors = Array.isArray(json?.validation?.blockingErrors)
          ? json.validation.blockingErrors
          : [];
        alert(
          json?.error ||
            (blockingErrors.length > 0
              ? `Settlement writeback readiness blocked:\n\n${blockingErrors.join("\n")}`
              : "Settlement writeback readiness validation failed.")
        );
      }
    } catch (err: any) {
      setSettlementWritebackPreviewResult({
        ok: false,
        action: "settlement-writeback-preview",
        dryRun: true,
        error: err?.message || "Settlement writeback readiness validation failed.",
        safety: {
          noClioRecordsChanged: true,
          noDatabaseRecordsChanged: true,
          noDocumentsGenerated: true,
          noPrintQueueRecordsChanged: true,
          noPersistentFilesCreated: true,
        },
      });
      alert(err?.message || "Settlement writeback readiness validation failed.");
    } finally {
      setSettlementWritebackPreviewLoading(false);
    }
  }

  async function saveSettlementToClio() {
    const masterLawsuitId = tabMasterLawsuitId;

    if (!masterLawsuitId) {
      alert("No MASTER_LAWSUIT_ID found.  Generate or connect a lawsuit before saving settlement to Clio.");
      return;
    }

    if (!settlementPreviewResult?.ok || !Array.isArray(settlementPreviewResult.rows)) {
      alert("Run a successful settlement preview before saving to Clio.");
      return;
    }

    if (!settlementWritebackPreviewResult?.ok || !settlementWritebackPreviewResult?.validation?.canWriteIfConfirmed) {
      alert("Validate Clio writeback readiness successfully before saving to Clio.");
      return;
    }

    const confirmed = window.confirm(
      "This will write final settlement values to the child/bill matter(s) in Clio.\n\n" +
        "It will not write settlement financial values to the master matter.\n" +
        "It will not generate documents or change the print queue.\n\n" +
        "Continue?"
    );

    if (!confirmed) return;

    setSettlementWritebackLoading(true);
    setSettlementWritebackResult(null);

    try {
      const res = await fetch("/api/settlements/writeback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          masterLawsuitId,
          confirmWrite: true,
          rows: settlementPreviewResult.rows.map((row: any) => ({
            clioWritebackPreview: row.clioWritebackPreview,
          })),
        }),
      });

      const json = await res.json();
      setSettlementWritebackResult(json);

      if (!res.ok || !json?.ok) {
        const blockingErrors = Array.isArray(json?.readiness?.validation?.blockingErrors)
          ? json.readiness.validation.blockingErrors
          : [];
        alert(
          json?.error ||
            (blockingErrors.length > 0
              ? `Settlement save blocked:\n\n${blockingErrors.join("\n")}`
              : "Settlement save failed.")
        );
        return;
      }

      alert(`Settlement saved to Clio for ${num(json.count)} child/bill matter(s).`);
      setSettlementClosePreviewResult(null);
      await loadCurrentSettlementValues(masterLawsuitId);
      await loadSettlementHistory(masterLawsuitId);
      await expandClaim();
    } catch (err: any) {
      setSettlementWritebackResult({
        ok: false,
        action: "settlement-writeback",
        error: err?.message || "Settlement save failed.",
        safety: {
          clioRecordsMayHaveChanged: true,
          noDocumentsGenerated: true,
          noPrintQueueRecordsChanged: true,
          noPersistentFilesCreated: true,
        },
      });
      alert(err?.message || "Settlement save failed.");
    } finally {
      setSettlementWritebackLoading(false);
    }
  }

  async function loadCurrentSettlementValues(masterLawsuitIdInput?: string) {
    const masterLawsuitId = masterLawsuitIdInput || tabMasterLawsuitId;

    if (!masterLawsuitId) {
      return;
    }

    setCurrentSettlementValuesLoading(true);

    try {
      const res = await fetch(
        `/api/settlements/current-values?masterLawsuitId=${encodeURIComponent(masterLawsuitId)}`
      );
      const json = await res.json();
      setCurrentSettlementValuesResult(json);
    } catch (err: any) {
      setCurrentSettlementValuesResult({
        ok: false,
        action: "settlement-current-values",
        error: err?.message || "Could not load current Clio settlement values.",
        safety: {
          readOnly: true,
          liveClioReadOnly: true,
          noClioRecordsChanged: true,
          noDatabaseRecordsChanged: true,
          noDocumentsGenerated: true,
          noPrintQueueRecordsChanged: true,
        },
      });
    } finally {
      setCurrentSettlementValuesLoading(false);
    }
  }

  async function loadSettlementDocumentsPreview(masterLawsuitIdInput?: string) {
    const masterLawsuitId = masterLawsuitIdInput || tabMasterLawsuitId;

    if (!masterLawsuitId) {
      alert("No MASTER_LAWSUIT_ID found.  Generate or connect a lawsuit before previewing settlement documents.");
      return;
    }

    setSettlementDocumentsPreviewLoading(true);
    setSettlementDocumentsPreviewResult(null);

    try {
      const res = await fetch(
        `/api/settlements/documents-preview?masterLawsuitId=${encodeURIComponent(masterLawsuitId)}`
      );

      const json = await res.json();
      setSettlementDocumentsPreviewResult(json);

      if (!res.ok && json?.error) {
        alert(json.error);
      }
    } catch (err: any) {
      const fallback = {
        ok: false,
        action: "settlement-documents-preview",
        dryRun: true,
        error: err?.message || "Settlement documents preview failed.",
        safety: {
          dryRun: true,
          previewOnly: true,
          readOnly: true,
          noClioRecordsChanged: true,
          noDatabaseRecordsChanged: true,
          noDocumentsGenerated: true,
          noPrintQueueRecordsChanged: true,
          noPersistentFilesCreated: true,
        },
      };
      setSettlementDocumentsPreviewResult(fallback);
      alert(fallback.error);
    } finally {
      setSettlementDocumentsPreviewLoading(false);
    }
  }

  async function loadSettlementClosePreview(masterLawsuitIdInput?: string) {
    const masterLawsuitId = masterLawsuitIdInput || tabMasterLawsuitId;

    if (!masterLawsuitId) {
      alert("No MASTER_LAWSUIT_ID found.  Generate or connect a lawsuit before previewing settlement close.");
      return;
    }

    setSettlementClosePreviewLoading(true);
    setSettlementClosePreviewResult(null);
    setSettlementCloseWritebackResult(null);

    try {
      const res = await fetch("/api/settlements/close-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          masterLawsuitId,
        }),
      });

      const json = await res.json();
      setSettlementClosePreviewResult(json);

      if (!res.ok && json?.error) {
        alert(json.error);
      }
    } catch (err: any) {
      const fallback = {
        ok: false,
        action: "paid-settlement-close-preview",
        dryRun: true,
        error: err?.message || "Paid settlement close preview failed.",
        safety: {
          dryRun: true,
          previewOnly: true,
          noClioRecordsChanged: true,
          noDatabaseRecordsChanged: true,
          noDocumentsGenerated: true,
          noPrintQueueRecordsChanged: true,
        },
      };
      setSettlementClosePreviewResult(fallback);
      alert(fallback.error);
    } finally {
      setSettlementClosePreviewLoading(false);
    }
  }

  async function closePaidSettlements(masterLawsuitIdInput?: string) {
    const masterLawsuitId = masterLawsuitIdInput || tabMasterLawsuitId;

    if (!masterLawsuitId) {
      alert("No MASTER_LAWSUIT_ID found.  Generate or connect a lawsuit before closing paid settlements.");
      return;
    }

    if (!settlementClosePreviewResult?.ok || !settlementClosePreviewResult?.validation?.canCloseIfConfirmed) {
      alert("Run Preview Paid Settlement Close first.  Only preview-eligible child/bill matters can be closed.");
      return;
    }

    const confirmed = window.confirm(
      "Close Paid Settlements?\\n\\nUse this only after payment is confirmed.  This will write Close Reason = PAID (SETTLEMENT) and set eligible child/bill matters to closed in Clio.  Master matters and already closed/final matters will remain blocked.  No documents or print queue records will be changed."
    );

    if (!confirmed) {
      return;
    }

    setSettlementCloseWritebackLoading(true);
    setSettlementCloseWritebackResult(null);

    try {
      const res = await fetch("/api/settlements/close", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          masterLawsuitId,
          confirmPaid: true,
          confirmClosePaidSettlements: true,
        }),
      });

      const json = await res.json();
      setSettlementCloseWritebackResult(json);

      if (json?.ok) {
        await loadSettlementClosePreview(masterLawsuitId);
      }
    } catch (err: any) {
      setSettlementCloseWritebackResult({
        ok: false,
        action: "close-paid-settlements",
        error: err?.message || "Close Paid Settlements failed.",
        safety: {
          actionLabel: "Close Paid Settlements",
          explicitPaymentConfirmationRequired: true,
          noDocumentsGenerated: true,
          noPrintQueueRecordsChanged: true,
        },
      });
    } finally {
      setSettlementCloseWritebackLoading(false);
    }
  }

  async function loadSettlementHistory(masterLawsuitIdInput?: string) {
    const masterLawsuitId = masterLawsuitIdInput || tabMasterLawsuitId;

    if (!masterLawsuitId) {
      alert("No MASTER_LAWSUIT_ID found.  Generate or connect a lawsuit before loading settlement history.");
      return;
    }

    setSettlementHistoryLoading(true);

    try {
      const res = await fetch(
        `/api/settlements/history?masterLawsuitId=${encodeURIComponent(masterLawsuitId)}`
      );
      const json = await res.json();
      setSettlementHistoryResult(json);

      if (!res.ok || !json?.ok) {
        alert(json?.error || "Could not load settlement history.");
      }
    } catch (err: any) {
      setSettlementHistoryResult({
        ok: false,
        action: "settlement-history",
        error: err?.message || "Could not load settlement history.",
        safety: {
          readOnly: true,
          localAuditHistoryOnly: true,
          noClioRecordsChanged: true,
          noDatabaseRecordsChanged: true,
          noDocumentsGenerated: true,
          noPrintQueueRecordsChanged: true,
        },
      });
      alert(err?.message || "Could not load settlement history.");
    } finally {
      setSettlementHistoryLoading(false);
    }
  }

  async function saveMetadataEdit() {
    const masterLawsuitId = textValue(matter?.masterLawsuitId);

    if (!masterLawsuitId) {
      alert("This matter is not part of a lawsuit.");
      return;
    }

    setMetadataSaving(true);

    try {
      const venue =
        metadataEdit.venueSelection === "Other"
          ? metadataEdit.venueOther.trim()
          : metadataEdit.venueSelection.trim();

      const res = await fetch("/api/lawsuits/update-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterLawsuitId,
          venue,
          venueSelection: metadataEdit.venueSelection,
          venueOther: metadataEdit.venueOther,
          amountSoughtMode: metadataEdit.amountSoughtMode,
          customAmountSought:
            metadataEdit.amountSoughtMode === "custom"
              ? parseMoneyInput(metadataEdit.customAmountSought)
              : null,
          indexAaaNumber: metadataEdit.indexAaaNumber,
          lawsuitNotes: metadataEdit.lawsuitNotes,
        }),
      });

      const json = await res.json();

      if (!json.ok) {
        alert(json.error || "Failed to update lawsuit metadata.");
        return;
      }

      await fetchPacketPreview(masterLawsuitId);
      setShowMetadataModal(false);
    } catch (err: any) {
      alert(err?.message || "Failed to update lawsuit metadata.");
    } finally {
      setMetadataSaving(false);
    }
  }

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        if (!selected.includes(Number(r.id))) return acc;

        const claim = num(r.claimAmount);
        const payment = num(r.paymentVoluntary);
        const balance = claim - payment;

        acc.claim += claim;
        acc.payment += payment;
        acc.balance += balance;

        return acc;
      },
      { claim: 0, payment: 0, balance: 0 }
    );
  }, [rows, selected]);

  function matterSortValue(row: any, key: MatterSortKey) {
    if (key === "matter") return textValue(row?.displayNumber);
    if (key === "patient") return textValue(row?.patient);
    if (key === "provider") return providerValue(row);
    if (key === "insurer") return insurerValue(row);
    if (key === "dos") return textValue(row?.dosStart) || textValue(row?.dosEnd);
    if (key === "claim") return num(row?.claimAmount);
    if (key === "payment") return num(row?.paymentVoluntary);
    if (key === "balance") return num(row?.claimAmount) - num(row?.paymentVoluntary);
    if (key === "denial") return denialReasonValue(row);
    if (key === "status") return textValue(row?.matterStage?.name);
    if (key === "finalStatus") return textValue(row?.closeReason || "");
    return "";
  }

  function compareMatterSortValues(a: any, b: any, key: MatterSortKey) {
    const av = matterSortValue(a, key);
    const bv = matterSortValue(b, key);

    if (typeof av === "number" || typeof bv === "number") {
      const an = Number(av || 0);
      const bn = Number(bv || 0);
      return an === bn ? 0 : an > bn ? 1 : -1;
    }

    const as = textValue(av).toLowerCase();
    const bs = textValue(bv).toLowerCase();

    if (as === bs) return 0;
    if (!as) return 1;
    if (!bs) return -1;

    return as.localeCompare(bs, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }

  function requestMatterSort(key: MatterSortKey) {
    setMatterSort((current) => {
      if (!current || current.key !== key) {
        return { key, direction: "asc" };
      }

      if (current.direction === "asc") {
        return { key, direction: "desc" };
      }

      return null;
    });
  }

  function matterSortIndicator(key: MatterSortKey) {
    if (!matterSort || matterSort.key !== key) return "↕";
    return matterSort.direction === "asc" ? "↑" : "↓";
  }

  const directMatterRows = useMemo(() => {
    const currentMatterId = Number(matter?.id || matterId || 0);
    const sourceRows = Array.isArray(rows) ? rows : [];

    if (!Number.isFinite(currentMatterId) || currentMatterId <= 0) {
      return [];
    }

    const directRows = sourceRows.filter((row: any) => Number(row?.id) === currentMatterId);

    if (directRows.length > 0) {
      return directRows;
    }

    return matter?.id ? [matter] : [];
  }, [rows, matter, matterId]);

  const displayRows = useMemo(() => {
    const sourceRows = directMatterRows.filter((r: any) => {
      if (showClosed) return true;
      return !String(r.closeReason || "").trim();
    });

    let reordered: any[] = [];

    if (matterSort) {
      reordered = [...sourceRows].sort((a, b) => {
        const result = compareMatterSortValues(a, b, matterSort.key);
        return matterSort.direction === "asc" ? result : -result;
      });
    } else {
      const grouped = new Map<string, any[]>();

      for (const row of sourceRows) {
        const key = String(row?.masterLawsuitId || "").trim();

        if (!key) {
          reordered.push(row);
          continue;
        }

        const group = grouped.get(key) || [];
        group.push(row);
        grouped.set(key, group);
      }

      for (const group of grouped.values()) {
        const master = group.find((row) => !!(row.isMaster || row.is_master));

        if (master) {
          reordered.push(master);
          reordered.push(...group.filter((row) => row !== master));
        } else {
          reordered.push(...group);
        }
      }
    }

    return reordered.map((row, index) => {
      const currentMaster = String(row?.masterLawsuitId || "").trim();
      const prevMaster =
        index > 0 ? String(reordered[index - 1]?.masterLawsuitId || "").trim() : "";

      const startsNewGroup =
        !matterSort &&
        index > 0 &&
        currentMaster !== prevMaster &&
        (currentMaster !== "" || prevMaster !== "");

      const showGroupLabel =
        !matterSort &&
        currentMaster !== "" &&
        (index === 0 || currentMaster !== prevMaster);

      return {
        ...row,
        isLocked: !!(row.masterLawsuitId && String(row.masterLawsuitId).trim()),
        startsNewGroup,
        showGroupLabel,
      };
    });
  }, [directMatterRows, showClosed, matterSort]);

  const thStyle: React.CSSProperties = {
    border: "1px solid #bfbfbf",
    padding: "8px 8px",
    textAlign: "center",
    verticalAlign: "middle",
    fontSize: 15,
    fontWeight: 700,
    background: "#f3f3f3",
  };

  function matterSortHeader(label: string, key: MatterSortKey) {
    const active = matterSort?.key === key;

    return (
      <button
        type="button"
        onClick={() => requestMatterSort(key)}
        title={`Sort by ${label}`}
        style={{
          appearance: "none",
          border: 0,
          padding: 0,
          margin: 0,
          background: "transparent",
          color: "inherit",
          font: "inherit",
          fontWeight: 900,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          width: "100%",
          lineHeight: 1.2,
        }}
      >
        <span>{label}</span>
        <span
          aria-hidden="true"
          style={{
            color: active ? "#1e3a8a" : "#94a3b8",
            fontSize: 12,
            fontWeight: 650,
          }}
        >
          {matterSortIndicator(key)}
        </span>
      </button>
    );
  }


  const tdStyle: React.CSSProperties = {
    border: "1px solid #bfbfbf",
    padding: "8px 8px",
    fontSize: 13,
    verticalAlign: "middle",
  };

  const alreadyAggregated = isAggregated(matter);
  const tabMasterLawsuitId =
    textValue(packetPreview?.packet?.masterLawsuitId) ||
    textValue(matter?.masterLawsuitId);

  const settlementPreviewReady =
    !!settlementPreviewResult?.ok &&
    Array.isArray(settlementPreviewResult?.rows) &&
    settlementPreviewResult.rows.length > 0;

  const providerFeeDefaultsLoaded =
    !!providerFeeDefaultsResult?.ok ||
    !!providerFeeDefaultsResult?.defaults ||
    !!providerFeeDefaultsResult?.providerContact;

  const settlementWritebackPreviewReady =
    !!settlementWritebackPreviewResult?.ok &&
    Array.isArray(settlementWritebackPreviewResult?.rows) &&
    settlementWritebackPreviewResult.rows.length > 0;

  const settlementValuesWrittenToClio =
    !!settlementWritebackResult?.ok &&
    Number(settlementWritebackResult?.count || 0) > 0;

  const currentClioValuesLoaded =
    !!currentSettlementValuesResult?.ok &&
    Array.isArray(currentSettlementValuesResult?.rows);

  const cents = (value: any) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  };

  const expectedSettlementRows = Array.isArray(settlementPreviewResult?.rows)
    ? settlementPreviewResult.rows
    : [];

  const currentSettlementRows = Array.isArray(currentSettlementValuesResult?.rows)
    ? currentSettlementValuesResult.rows
    : [];

  const settlementValueComparisonFields = [
    {
      label: "Settled Amount",
      expected: (row: any) => row?.clioWritebackPreview?.fields?.SETTLED_AMOUNT,
      actual: (row: any) => row?.settledAmount,
    },
    {
      label: "Allocated Settlement",
      expected: (row: any) => row?.allocatedSettlement,
      actual: (row: any) => row?.allocatedSettlement,
    },
    {
      label: "Interest Amount",
      expected: (row: any) => row?.interestAmount,
      actual: (row: any) => row?.interestAmount,
    },
    {
      label: "Principal Fee",
      expected: (row: any) => row?.principalFee,
      actual: (row: any) => row?.principalFee,
    },
    {
      label: "Interest Fee",
      expected: (row: any) => row?.interestFee,
      actual: (row: any) => row?.interestFee,
    },
    {
      label: "Total Fee",
      expected: (row: any) => row?.totalFee,
      actual: (row: any) => row?.totalFee,
    },
    {
      label: "Provider Net",
      expected: (row: any) => row?.providerNet,
      actual: (row: any) => row?.providerNet,
    },
    {
      label: "Provider Principal Net",
      expected: (row: any) => row?.providerPrincipalNet,
      actual: (row: any) => row?.providerPrincipalNet,
    },
    {
      label: "Provider Interest Net",
      expected: (row: any) => row?.providerInterestNet,
      actual: (row: any) => row?.providerInterestNet,
    },
  ];

  const expectedRowsByMatterId = new Map(
    expectedSettlementRows
      .map((row: any) => [String(row?.matterId || ""), row])
      .filter(([matterId]: any) => matterId)
  );

  const currentRowsByMatterId = new Map(
    currentSettlementRows
      .map((row: any) => [String(row?.matterId || ""), row])
      .filter(([matterId]: any) => matterId)
  );

  const settlementValueComparisonMismatches: string[] = [];

  if (settlementValuesWrittenToClio && currentClioValuesLoaded) {
    for (const [matterId, expectedRow] of expectedRowsByMatterId.entries()) {
      const currentRow = currentRowsByMatterId.get(matterId);

      if (!currentRow) {
        settlementValueComparisonMismatches.push(
          `Matter ${textValue((expectedRow as any)?.displayNumber) || matterId} is missing from current Clio readback.`
        );
        continue;
      }

      for (const field of settlementValueComparisonFields) {
        const expectedValue = cents(field.expected(expectedRow));
        const actualValue = cents(field.actual(currentRow));

        if (expectedValue !== actualValue) {
          settlementValueComparisonMismatches.push(
            `${textValue((expectedRow as any)?.displayNumber) || matterId}: ${field.label} expected ${money(Number(expectedValue ?? 0) / 100)} but Clio shows ${money(Number(actualValue ?? 0) / 100)}.`
          );
        }
      }
    }
  }

  const currentClioValuesMatchExpected =
    settlementValuesWrittenToClio &&
    currentClioValuesLoaded &&
    expectedRowsByMatterId.size > 0 &&
    currentRowsByMatterId.size > 0 &&
    settlementValueComparisonMismatches.length === 0;

  const childBillMattersEligibleToClose =
    !!settlementClosePreviewResult?.ok &&
    Number(settlementClosePreviewResult?.summary?.eligibleCount || settlementClosePreviewResult?.eligibleCount || 0) > 0;

  const closePaidSettlementsCompleted =
    !!settlementCloseWritebackResult?.ok &&
    Number(settlementCloseWritebackResult?.count || 0) > 0;

  const paymentConfirmedForClose = closePaidSettlementsCompleted;

  const settlementWorkflowChecklist = [
    {
      label: "Settlement preview ready",
      done: settlementPreviewReady,
      detail: settlementPreviewReady
        ? `${num(settlementPreviewResult.rows.length)} child/bill matter(s) previewed.`
        : "Run Preview Settlement after entering settlement terms.",
    },
    {
      label: "Provider fee defaults loaded",
      done: providerFeeDefaultsLoaded,
      detail: providerFeeDefaultsLoaded
        ? "Provider/client Clio defaults were loaded or checked.  Missing defaults remain non-blocking."
        : "Open the Settlement tab and confirm provider fee defaults were checked.",
    },
    {
      label: "Writeback preview ready",
      done: settlementWritebackPreviewReady,
      detail: settlementWritebackPreviewReady
        ? "Settlement writeback readiness has been previewed."
        : "Run the writeback readiness preview before saving to Clio.",
    },
    {
      label: "Settlement values written to Clio",
      done: settlementValuesWrittenToClio,
      detail: settlementValuesWrittenToClio
        ? `${num(settlementWritebackResult.count)} child/bill matter(s) updated.`
        : "Not complete until Save Settlement to Clio succeeds.",
    },
    {
      label: "Current Clio values match expected settlement values",
      done: currentClioValuesMatchExpected,
      detail: currentClioValuesMatchExpected
        ? `Current Clio readback matches expected settlement values for ${num(expectedRowsByMatterId.size)} child/bill matter(s).`
        : settlementValueComparisonMismatches.length > 0
          ? `${num(settlementValueComparisonMismatches.length)} mismatch(es) found.  Review Current Clio Settlement Values and refresh after any correction.`
          : currentClioValuesLoaded
            ? "Current Clio values are loaded.  Save settlement values first, then refresh/read back for exact value comparison."
            : "Refresh Current Clio Settlement Values after saving.",
    },
    {
      label: "Payment confirmed",
      done: paymentConfirmedForClose,
      detail: paymentConfirmedForClose
        ? "Payment was confirmed through the Close Paid Settlements flow."
        : "Payment is not treated as confirmed until Close Paid Settlements is explicitly confirmed.",
    },
    {
      label: "Child/bill matters eligible to close",
      done: childBillMattersEligibleToClose,
      detail: childBillMattersEligibleToClose
        ? "Preview found eligible child/bill matter(s)."
        : "Run Preview Paid Settlement Close after payment is confirmed.",
    },
    {
      label: "Close Paid Settlements completed",
      done: closePaidSettlementsCompleted,
      detail: closePaidSettlementsCompleted
        ? `${num(settlementCloseWritebackResult.count)} child/bill matter(s) closed as PAID (SETTLEMENT).`
        : "Not complete until Close Paid Settlements succeeds.",
    },
  ];

  const settlementWorkflowCompletedCount = settlementWorkflowChecklist.filter((item) => item.done).length;

  useEffect(() => {
    if (activeWorkspaceTab !== "settlement") return;
    if (!tabMasterLawsuitId) return;
    if (currentSettlementValuesLoadedMasterId === tabMasterLawsuitId) return;

    setCurrentSettlementValuesLoadedMasterId(tabMasterLawsuitId);
    void loadCurrentSettlementValues(tabMasterLawsuitId);
  }, [activeWorkspaceTab, tabMasterLawsuitId, currentSettlementValuesLoadedMasterId]);


  return (
    <>

    <main
      style={{
        padding: "12px 14px 30px",
        width: "100vw",
        maxWidth: "none",
        marginLeft: "calc(50% - 50vw)",
        marginRight: "calc(50% - 50vw)",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: bmColors.ink,
        background: "#f8fafc",
        minHeight: "100vh",
       }}
    >
      <div style={bmGlobalTopBarStyle}>
        <div style={bmGlobalLeftLogoWrapStyle}>
          <img src="/brl-logo.png" alt="BRL Logo" style={bmGlobalBrlLogoStyle} />
          <div style={{ paddingTop: 8 }}>
            <BarshHeaderQuickNav />
          </div>
        </div>
        <div
          style={{
            gridColumn: 2,
            justifySelf: "center",
            alignSelf: "center",
            display: "grid",
            justifyItems: "center",
            gap: 9,
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
                border: `2px solid ${matterIsClosedForPayment() ? "#dc2626" : "#16a34a"}`,
                borderRadius: 999,
                background: matterIsClosedForPayment() ? "#fee2e2" : "#dcfce7",
                color: matterIsClosedForPayment() ? "#991b1b" : "#14532d",
                fontSize: 34,
                lineHeight: 1,
                fontWeight: 950,
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap",
                boxShadow: matterIsClosedForPayment()
                  ? "0 10px 30px rgba(220, 38, 38, 0.18)"
                  : "0 10px 30px rgba(22, 163, 74, 0.18)",
              }}
            >
              {textValue(matter?.displayNumber)}
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
                background: matterIsClosedForPayment() ? "#dc2626" : "#16a34a",
                color: "#fff",
                fontSize: 13,
                fontWeight: 950,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                boxShadow: matterIsClosedForPayment()
                  ? "0 4px 12px rgba(220, 38, 38, 0.25)"
                  : "0 4px 12px rgba(22, 163, 74, 0.25)",
              }}
            >
              {matterIsClosedForPayment() ? "Closed" : "Open"}
            </span>
          </div>

          {alreadyAggregated && (
            <a
              href={`/matters?master=${encodeURIComponent(textValue(matter?.masterLawsuitId))}`}
              title={`Open all matters for master lawsuit ${textValue(matter?.masterLawsuitId)}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 11px",
                border: "1px solid #86efac",
                borderRadius: 999,
                background: "#dcfce7",
                color: "#14532d",
                fontSize: 12,
                fontWeight: 900,
                whiteSpace: "nowrap",
                textDecoration: "none",
                cursor: "pointer"
              }}
            >
              <span>MASTER LAWSUIT ID:</span>
              <span>{textValue(matter?.masterLawsuitId)}</span>
            </a>
          )}
</div>
<div style={bmGlobalRightWrapStyle}>
          <div style={bmGlobalPrintButtonRowStyle}>
            <button
              type="button"
              onClick={openReferenceImportsAdmin}
              title="Admin access required. Open Reference Data Import."
              style={{
                ...bmGlobalLockedPrintQueueStyle,
                cursor: "pointer",
                opacity: 1,
              }}
            >
              <span aria-hidden="true">🔐</span>
              <span>Import</span>
            </button>

            <button
              type="button"
              onClick={openMatterAuditHistoryTab}
              title="Open matter-specific Audit / History log."
              style={{
                ...bmGlobalLockedPrintQueueStyle,
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
              style={bmGlobalLockedPrintQueueStyle}
            >
              <span aria-hidden="true">🔒</span>
              <span>Print Queue</span>
            </button>
          </div>

          <a href="/" title="Return to Barsh Matters entry screen" style={bmGlobalLogoLinkStyle}>
            <img src="/barsh-matters-cropped-transparent.png" alt="Barsh Matters Logo" style={bmGlobalLogoStyle} />
          </a>
        </div>
      </div>



{matterAuditHistoryPopupOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Matter Audit History"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50000,
            display: "block",
            padding: 0,
            overflow: "hidden",
            background: "rgba(15, 23, 42, 0.58)",
          }}
          onClick={closeMatterAuditHistoryPopup}
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
                  Matter-Level Audit / History
                </div>
                <div
                  style={{
                    marginTop: 3,
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#1e40af",
                  }}
                >
                  {textValue(matter?.displayNumber || matter?.display_number) || matterId || "Matter"} · Local database audit log.
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={loadMatterAuditHistory}
                  disabled={matterAuditHistoryLoading}
                  style={{
                    minWidth: 98,
                    height: 38,
                    border: "1px solid #bfdbfe",
                    borderRadius: 999,
                    background: "#ffffff",
                    color: "#1d4ed8",
                    fontWeight: 900,
                    cursor: matterAuditHistoryLoading ? "default" : "pointer",
                  }}
                >
                  {matterAuditHistoryLoading ? "Loading..." : "Refresh"}
                </button>

                <button
                  type="button"
                  onClick={closeMatterAuditHistoryPopup}
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
                  aria-label="Close matter audit history popup"
                >
                  ×
                </button>
              </div>
            </div>

            <div style={{ padding: 18 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <div style={bmStatCardStyle}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: bmColors.subtle, textTransform: "uppercase" }}>Matter</div>
                  <div style={{ marginTop: 4, fontSize: 14, fontWeight: 900, color: bmColors.ink }}>
                    {textValue(matter?.displayNumber || matter?.display_number) || matterId || "—"}
                  </div>

                </div>

                <div style={bmStatCardStyle}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: bmColors.subtle, textTransform: "uppercase" }}>Matter ID</div>
                  <div style={{ marginTop: 4, fontSize: 14, fontWeight: 900, color: bmColors.ink }}>
                    {matterId || "—"}
                  </div>
                </div>

                <div style={bmStatCardStyle}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: bmColors.subtle, textTransform: "uppercase" }}>Master Lawsuit</div>
                  <div style={{ marginTop: 4, fontSize: 14, fontWeight: 900, color: bmColors.ink }}>
                    {textValue(matter?.masterLawsuitId || matter?.master_lawsuit_id) || "—"}
                  </div>
                </div>

                <div style={bmStatCardStyle}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: bmColors.subtle, textTransform: "uppercase" }}>Entries</div>
                  <div style={{ marginTop: 4, fontSize: 14, fontWeight: 900, color: bmColors.ink }}>
                    {Array.isArray(matterAuditHistoryResult?.entries) ? matterAuditHistoryResult.entries.length : 0}
                  </div>
                </div>
              </div>

              {matterAuditHistoryResult?.error && (
                <div
                  style={{
                    marginBottom: 14,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #fecaca",
                    background: "#fef2f2",
                    color: "#991b1b",
                    fontWeight: 800,
                  }}
                >
                  {textValue(matterAuditHistoryResult.error)}
                </div>
              )}

              {matterAuditHistoryLoading && !matterAuditHistoryResult && (
                <div style={{ color: bmColors.muted }}>
                  Loading matter audit history...
                </div>
              )}

              {matterAuditHistoryResult?.ok &&
                Array.isArray(matterAuditHistoryResult.entries) &&
                matterAuditHistoryResult.entries.length === 0 && (
                  <div style={{ color: bmColors.muted }}>
                    No matter-specific audit entries found yet.
                  </div>
                )}

              {matterAuditHistoryResult?.ok &&
                Array.isArray(matterAuditHistoryResult.entries) &&
                matterAuditHistoryResult.entries.length > 0 && (
                  <div style={{ display: "grid", gap: 12 }}>
                    {matterAuditHistoryResult.entries.map((entry: any) => {
                      const rowKey = textValue(entry.id);
                      const isExpanded = expandedMatterAuditEntryId === rowKey;

                      return (
                        <article
                          key={rowKey}
                          style={{
                            display: "grid",
                            gap: 10,
                            padding: 14,
                            borderRadius: 16,
                            border: "1px solid " + bmColors.line,
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
                              <div style={{ fontSize: 15, fontWeight: 950, color: bmColors.ink }}>
                                {textValue(entry.summary) || textValue(entry.action) || "Audit entry"}
                              </div>
                              <div style={{ marginTop: 4, fontSize: 12, color: bmColors.subtle, fontWeight: 750 }}>
                                {formatMatterAuditTimestamp(entry.createdAt)} · {textValue(entry.actorName || entry.actorEmail) || "Unknown user"} · {textValue(entry.sourcePage) || "unknown source"}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setExpandedMatterAuditEntryId(isExpanded ? null : rowKey)}
                              style={{
                                fontSize: 12,
                                padding: "5px 9px",
                                border: "1px solid #94a3b8",
                                borderRadius: 999,
                                background: isExpanded ? "#e2e8f0" : "#fff",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                                fontWeight: 800,
                              }}
                            >
                              {isExpanded ? "Hide Details" : "Details"}
                            </button>
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                              gap: 10,
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 11, color: bmColors.subtle, fontWeight: 900, textTransform: "uppercase" }}>Action</div>
                              <div style={{ marginTop: 3, fontSize: 13, fontWeight: 850, color: bmColors.ink }}>{textValue(entry.action) || "—"}</div>
                            </div>

                            <div>
                              <div style={{ fontSize: 11, color: bmColors.subtle, fontWeight: 900, textTransform: "uppercase" }}>Field</div>
                              <div style={{ marginTop: 3, fontSize: 13, fontWeight: 850, color: bmColors.ink }}>{textValue(entry.fieldName) || "—"}</div>
                            </div>

                            <div>
                              <div style={{ fontSize: 11, color: bmColors.subtle, fontWeight: 900, textTransform: "uppercase" }}>Prior Value</div>
                              <div style={{ marginTop: 3, fontSize: 13, fontWeight: 850, color: bmColors.ink, overflowWrap: "anywhere" }}>{formatMatterAuditValue(entry.priorValue)}</div>
                            </div>

                            <div>
                              <div style={{ fontSize: 11, color: bmColors.subtle, fontWeight: 900, textTransform: "uppercase" }}>New Value</div>
                              <div style={{ marginTop: 3, fontSize: 13, fontWeight: 850, color: bmColors.ink, overflowWrap: "anywhere" }}>{formatMatterAuditValue(entry.newValue)}</div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

{directFieldEditModal === "dos" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit Date of Service"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 12000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "rgba(15, 23, 42, 0.45)",
          }}
        >
          <div
            style={{
              width: "min(520px, calc(100vw - 48px))",
              border: "1px solid #cbd5e1",
              borderRadius: 18,
              background: "#fff",
              boxShadow: "0 28px 90px rgba(15, 23, 42, 0.34)",
              padding: 20,
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>Edit Date of Service</h2>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 16 }}>
              This updates DOS Start and DOS End locally.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>
                <span>DOS Start</span>
                <input
                  type="date"
                  value={dosStartInput}
                  onChange={(event) => setDosStartInput(event.target.value)}
                  style={{
                    height: 40,
                    border: "1px solid #cbd5e1",
                    borderRadius: 10,
                    padding: "0 10px",
                    fontWeight: 800,
                  }}
                />
              </label>

              <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>
                <span>DOS End</span>
                <input
                  type="date"
                  value={dosEndInput}
                  onChange={(event) => setDosEndInput(event.target.value)}
                  style={{
                    height: 40,
                    border: "1px solid #cbd5e1",
                    borderRadius: 10,
                    padding: "0 10px",
                    fontWeight: 800,
                  }}
                />
              </label>
            </div>

            {directFieldEditResult && !directFieldEditResult.ok && (
              <div style={{ color: "#991b1b", fontWeight: 800, marginBottom: 12 }}>
                {textValue(directFieldEditResult.error) || "Date of Service could not be updated."}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setDirectFieldEditModal(null);
                  setDirectFieldEditResult(null);
                }}
                disabled={directFieldEditLoading}
                style={{
                  minWidth: 96,
                  height: 38,
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  background: "#f8fafc",
                  color: "#334155",
                  fontWeight: 900,
                  cursor: directFieldEditLoading ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveDosEditDialog}
                disabled={directFieldEditLoading}
                style={{
                  minWidth: 118,
                  height: 38,
                  border: "1px solid #16a34a",
                  borderRadius: 10,
                  background: directFieldEditLoading ? "#bbf7d0" : "#16a34a",
                  color: "#fff",
                  fontWeight: 900,
                  cursor: directFieldEditLoading ? "not-allowed" : "pointer",
                }}
              >
                {directFieldEditLoading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {directFieldEditModal && directFieldEditModal !== "dos" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Edit ${directPicklistFieldLabel(directFieldEditModal)}`}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 12000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "rgba(15, 23, 42, 0.45)",
          }}
        >
          <div
            style={{
              width: "min(560px, calc(100vw - 48px))",
              border: "1px solid #cbd5e1",
              borderRadius: 18,
              background: "#fff",
              boxShadow: "0 28px 90px rgba(15, 23, 42, 0.34)",
              padding: 20,
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>
              Edit {directPicklistFieldLabel(directFieldEditModal)}
            </h2>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 16 }}>
              This writes {directPicklistFieldLabel(directFieldEditModal)} directly.
            </div>

            <label style={{ display: "grid", gap: 6, fontWeight: 900, marginBottom: 16 }}>
              <span>{directPicklistFieldLabel(directFieldEditModal)}</span>
              <select
                value={directPicklistInputValue(directFieldEditModal)}
                onChange={(event) => setDirectPicklistInputValue(directFieldEditModal, event.target.value)}
                disabled={directFieldPicklistsLoading || directFieldEditLoading}
                style={{
                  height: 42,
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  padding: "0 10px",
                  fontWeight: 800,
                  background: "#fff",
                }}
              >
                <option value="">
                  {directFieldPicklistsLoading ? "Loading..." : "Select..."}
                </option>
                {picklistOptionsForDirectField(directFieldEditModal).map((option: any) => {
                  const value = optionValue(option);
                  const label = optionLabel(option);
                  return (
                    <option key={`${value}-${label}`} value={value}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </label>

            {directFieldEditResult && !directFieldEditResult.ok && (
              <div style={{ color: "#991b1b", fontWeight: 800, marginBottom: 12 }}>
                {textValue(directFieldEditResult.error) || `${directPicklistFieldLabel(directFieldEditModal)} could not be updated.`}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setDirectFieldEditModal(null);
                  setDirectFieldEditResult(null);
                }}
                disabled={directFieldEditLoading}
                style={{
                  minWidth: 96,
                  height: 38,
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  background: "#f8fafc",
                  color: "#334155",
                  fontWeight: 900,
                  cursor: directFieldEditLoading ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => savePicklistEditDialog(directFieldEditModal)}
                disabled={directFieldEditLoading || directFieldPicklistsLoading || !directPicklistInputValue(directFieldEditModal)}
                style={{
                  minWidth: 118,
                  height: 38,
                  border: "1px solid #16a34a",
                  borderRadius: 10,
                  background: directFieldEditLoading ? "#bbf7d0" : "#16a34a",
                  color: "#fff",
                  fontWeight: 900,
                  cursor: directFieldEditLoading || directFieldPicklistsLoading || !directPicklistInputValue(directFieldEditModal) ? "not-allowed" : "pointer",
                }}
              >
                {directFieldEditLoading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {identityFieldEditModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={"Edit " + identityFieldEditLabel(identityFieldEditModal)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15, 23, 42, 0.42)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              width: "min(560px, calc(100vw - 48px))",
              maxHeight: "calc(100vh - 48px)",
              overflow: "auto",
              background: "#ffffff",
              border: "1px solid #bfdbfe",
              borderRadius: 22,
              boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "flex-start",
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#1d4ed8", letterSpacing: 1.2 }}>
                  CLAIMINDEX IDENTITY FIELD
                </div>
                <h2 style={{ margin: "4px 0 6px", fontSize: 24 }}>
                  Edit {identityFieldEditLabel(identityFieldEditModal)}
                </h2>
                <p style={{ margin: 0, color: "#64748b", fontSize: 13, lineHeight: 1.45 }}>
                  Matter: {textValue(matter?.displayNumber || matter?.display_number) || matterId || "—"}
                </p>
              </div>

              <button
                type="button"
                onClick={closeIdentityFieldEditDialog}
                disabled={identityFieldEditLoading}
                style={{
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  color: "#0f172a",
                  borderRadius: 12,
                  padding: "10px 12px",
                  fontWeight: 900,
                  cursor: identityFieldEditLoading ? "not-allowed" : "pointer",
                }}
              >
                Close
              </button>
            </div>

            <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 6 }}>
              {identityFieldEditLabel(identityFieldEditModal)}
            </label>

            <input
              value={identityFieldEditInput}
              onChange={(event) => {
                setIdentityFieldEditInput(event.target.value);
                setIdentityFieldEditResult(null);
              }}
              disabled={identityFieldEditLoading}
              style={{
                width: "100%",
                minWidth: 0,
                border: "1px solid #cbd5e1",
                borderRadius: 12,
                background: "#ffffff",
                color: "#0f172a",
                padding: "11px 12px",
                fontSize: 14,
                fontWeight: 800,
                marginBottom: 12,
              }}
            />

            {identityFieldEditResult && !identityFieldEditResult.ok ? (
              <div
                style={{
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#991b1b",
                  borderRadius: 12,
                  padding: 10,
                  marginBottom: 12,
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                {textValue(identityFieldEditResult.error) || "Identity field could not be saved."}
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={closeIdentityFieldEditDialog}
                disabled={identityFieldEditLoading}
                style={{
                  minWidth: 96,
                  height: 38,
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  background: "#f8fafc",
                  color: "#334155",
                  fontWeight: 900,
                  cursor: identityFieldEditLoading ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveIdentityFieldEditDialog}
                disabled={identityFieldEditLoading || !textValue(identityFieldEditInput)}
                style={{
                  minWidth: 118,
                  height: 38,
                  border: "1px solid #16a34a",
                  borderRadius: 10,
                  background: identityFieldEditLoading || !textValue(identityFieldEditInput) ? "#bbf7d0" : "#16a34a",
                  color: "#ffffff",
                  fontWeight: 900,
                  cursor: identityFieldEditLoading || !textValue(identityFieldEditInput) ? "not-allowed" : "pointer",
                }}
              >
                {identityFieldEditLoading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {treatingProviderEditOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit Treating Provider"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15, 23, 42, 0.42)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              width: "min(560px, calc(100vw - 48px))",
              maxHeight: "calc(100vh - 48px)",
              overflow: "auto",
              background: "#ffffff",
              border: "1px solid #bfdbfe",
              borderRadius: 22,
              boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "flex-start",
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#1d4ed8", letterSpacing: 1.2 }}>
                  CLAIMINDEX IDENTITY FIELD
                </div>
                <h2 style={{ margin: "4px 0 6px", fontSize: 24 }}>Edit Treating Provider</h2>
                <p style={{ margin: 0, color: "#64748b", fontSize: 13, lineHeight: 1.45 }}>
                  Matter: {textValue(matter?.displayNumber || matter?.display_number) || matterId || "—"}
                </p>
              </div>

              <button
                type="button"
                onClick={closeTreatingProviderEditDialog}
                disabled={treatingProviderSaving}
                style={{
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  color: "#0f172a",
                  borderRadius: 12,
                  padding: "10px 12px",
                  fontWeight: 900,
                  cursor: treatingProviderSaving ? "not-allowed" : "pointer",
                }}
              >
                Close
              </button>
            </div>

            <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 6 }}>
              Treating Provider
            </label>

            <select
              value={treatingProviderInput}
              onChange={(event) => {
                setTreatingProviderInput(event.target.value);
                setTreatingProviderResult(null);
              }}
              disabled={treatingProviderOptionsLoading || treatingProviderSaving}
              style={{
                width: "100%",
                minWidth: 0,
                border: "1px solid #cbd5e1",
                borderRadius: 12,
                background: "#ffffff",
                color: "#0f172a",
                padding: "11px 12px",
                fontSize: 14,
                fontWeight: 800,
                marginBottom: 12,
              }}
            >
              <option value="">
                {treatingProviderOptionsLoading ? "Loading Treating Providers..." : "Select Treating Provider"}
              </option>
              {treatingProviderOptions.map((option: any) => (
                <option key={option.id} value={option.id}>
                  {option.displayName}
                </option>
              ))}
            </select>

            {treatingProviderResult && !treatingProviderResult.ok ? (
              <div
                style={{
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#991b1b",
                  borderRadius: 12,
                  padding: 10,
                  marginBottom: 12,
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                {textValue(treatingProviderResult.error) || "Treating Provider could not be saved."}
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={closeTreatingProviderEditDialog}
                disabled={treatingProviderSaving}
                style={{
                  minWidth: 96,
                  height: 38,
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  background: "#f8fafc",
                  color: "#334155",
                  fontWeight: 900,
                  cursor: treatingProviderSaving ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveClaimIndexTreatingProvider}
                disabled={treatingProviderSaving || treatingProviderOptionsLoading || !treatingProviderInput}
                style={{
                  minWidth: 118,
                  height: 38,
                  border: "1px solid #16a34a",
                  borderRadius: 10,
                  background:
                    treatingProviderSaving || treatingProviderOptionsLoading || !treatingProviderInput
                      ? "#bbf7d0"
                      : "#16a34a",
                  color: "#ffffff",
                  fontWeight: 900,
                  cursor:
                    treatingProviderSaving || treatingProviderOptionsLoading || !treatingProviderInput
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {treatingProviderSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {(matterHydrationLoading || matterHydrationError) && (
        <div
          style={{
            margin: "0 0 14px",
            padding: "7px 12px",
            border: "1px solid " + (matterHydrationError ? "#fecaca" : "#bfdbfe"),
            borderRadius: 14,
            background: matterHydrationError ? "#fef2f2" : "#eff6ff",
            color: matterHydrationError ? "#991b1b" : "#1e3a8a",
            fontSize: 13,
            fontWeight: 650,
          }}
        >
          {matterHydrationError || "Refreshing matter workspace from Clio..."}
        </div>
      )}

            <section className="barsh-matter-top-workspace barsh-direct-matter-top-workspace">
        <div className="barsh-direct-matter-summary-grid">
          <div className="barsh-direct-matter-main">
<div className="barsh-direct-matter-detail-grid">
              <div className="barsh-direct-summary-column">
                <a
                  className="barsh-direct-summary-card barsh-direct-summary-link-card"
                  href={`/matters?patient=${encodeURIComponent(textValue(matter?.patient?.name || matter?.patient))}`}
                  title="Open all matters for this patient"
                >
                  <div
                    className="barsh-direct-summary-label"
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
                  >
                    <span>Patient</span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openIdentityFieldEditDialog("patient_name");
                      }}
                      disabled={identityFieldEditLoading}
                      title="Edit Patient."
                      style={identityEditButtonStyle}
                    >
                      Edit
                    </button>
                  </div>
                  <div className="barsh-direct-summary-value">
                    {textValue(matter?.patient?.name || matter?.patient) || "—"}
                  </div>
                </a>

                <a
                  className="barsh-direct-summary-card barsh-direct-summary-link-card"
                  href={`/matters?provider=${encodeURIComponent(providerValue(matter))}`}
                  title="Open all matters for this provider"
                >
                  <div
                    className="barsh-direct-summary-label"
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
                  >
                    <span>Provider</span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openIdentityFieldEditDialog("client_name");
                      }}
                      disabled={identityFieldEditLoading}
                      title="Edit Provider."
                      style={identityEditButtonStyle}
                    >
                      Edit
                    </button>
                  </div>
                  <div className="barsh-direct-summary-value">
                    {providerValue(matter) || "—"}
                  </div>
                </a>

                <div className="barsh-direct-summary-card">
                  <div
                    className="barsh-direct-summary-label"
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
                  >
                    <span>Treating Provider</span>
                    <button
                      type="button"
                      onClick={openTreatingProviderEditDialog}
                      disabled={treatingProviderOptionsLoading || treatingProviderSaving}
                      title="Edit Treating Provider."
                      style={{
                        border: "1px solid #93c5fd",
                        borderRadius: 999,
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontSize: 11,
                        fontWeight: 900,
                        padding: "3px 8px",
                        cursor: treatingProviderOptionsLoading || treatingProviderSaving ? "not-allowed" : "pointer",
                      }}
                    >
                      Edit
                    </button>
                  </div>

                  {localTreatingProviderName() ? (
                    <a
                      className="barsh-direct-summary-value"
                      href={`/matters?treatingProvider=${encodeURIComponent(localTreatingProviderName())}`}
                      title="Open all matters for this treating provider"
                      style={{
                        color: "#1d4ed8",
                        textDecoration: "underline",
                        textUnderlineOffset: 3,
                        fontWeight: 900,
                      }}
                    >
                      {localTreatingProviderName()}
                    </a>
                  ) : (
                    <div className="barsh-direct-summary-value">—</div>
                  )}
                </div>

                <a
                  className="barsh-direct-summary-card barsh-direct-summary-link-card"
                  href={`/matters?insurer=${encodeURIComponent(insurerValue(matter))}`}
                  title="Open all matters for this insurer"
                >
                  <div
                    className="barsh-direct-summary-label"
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
                  >
                    <span>Insurer</span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openIdentityFieldEditDialog("insurer_name");
                      }}
                      disabled={identityFieldEditLoading}
                      title="Edit Insurer."
                      style={identityEditButtonStyle}
                    >
                      Edit
                    </button>
                  </div>
                  <div className="barsh-direct-summary-value">
                    {insurerValue(matter) || "—"}
                  </div>
                </a>

                <a
                  className="barsh-direct-summary-card barsh-direct-summary-link-card"
                  href={`/matters?claim=${encodeURIComponent(textValue(matter?.claimNumber))}`}
                  title="Open all matters for this claim number"
                >
                  <div
                    className="barsh-direct-summary-label"
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
                  >
                    <span>Claim Number</span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openIdentityFieldEditDialog("claim_number_raw");
                      }}
                      disabled={identityFieldEditLoading}
                      title="Edit Claim Number."
                      style={identityEditButtonStyle}
                    >
                      Edit
                    </button>
                  </div>
                  <div className="barsh-direct-summary-value barsh-direct-summary-value-strong">
                    {textValue(matter?.claimNumber) || "—"}
                  </div>
                </a>
              </div>

              <div className="barsh-direct-summary-column">
                <div className="barsh-direct-summary-card">
                  <div
                    className="barsh-direct-summary-label"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span>Date of Service</span>
                    <button
                      type="button"
                      onClick={openDosEditDialog}
                      disabled={directFieldEditLoading}
                      title="Edit Date of Service."
                      style={{
                        border: "1px solid #93c5fd",
                        borderRadius: 999,
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontSize: 11,
                        fontWeight: 900,
                        padding: "3px 8px",
                        cursor: directFieldEditLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      Edit
                    </button>
                  </div>
                  <div className="barsh-direct-summary-value">
                    {formatDOS(matter?.dosStart, matter?.dosEnd) || "—"}
                  </div>
                </div>

                <div className="barsh-direct-summary-card">
                  <div
                    className="barsh-direct-summary-label"
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
                  >
                    <span>Denial Reason</span>
                    <button
                      type="button"
                      onClick={() => openPicklistEditDialog("denialReason")}
                      disabled={directFieldEditLoading}
                      title="Edit Denial Reason."
                      style={{ border: "1px solid #93c5fd", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", fontSize: 11, fontWeight: 900, padding: "3px 8px", cursor: directFieldEditLoading ? "not-allowed" : "pointer" }}
                    >
                      Edit
                    </button>
                  </div>
                  <div className="barsh-direct-summary-value">
                    {denialReasonValue(matter) || "—"}
                  </div>
                </div>
              </div>

              <div className="barsh-direct-summary-column">
                <div className="barsh-direct-summary-card">
                  <div
                    className="barsh-direct-summary-label"
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
                  >
                    <span>Status</span>
                    <button
                      type="button"
                      onClick={() => openPicklistEditDialog("status")}
                      disabled={directFieldEditLoading}
                      title="Edit Status."
                      style={{ border: "1px solid #93c5fd", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", fontSize: 11, fontWeight: 900, padding: "3px 8px", cursor: directFieldEditLoading ? "not-allowed" : "pointer" }}
                    >
                      Edit
                    </button>
                  </div>
                  <div className="barsh-direct-summary-value">
                    {textValue(matter?.matterStage?.name) || "—"}
                  </div>
                </div>

                <div className="barsh-direct-summary-card">
                  <div
                    className="barsh-direct-summary-label"
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
                  >
                    <span>Closed Reason</span>
                    <button
                      type="button"
                      onClick={() => openPicklistEditDialog("finalStatus")}
                      disabled={directFieldEditLoading}
                      title="Edit Closed Reason."
                      style={{ border: "1px solid #fdba74", borderRadius: 999, background: "#fff7ed", color: "#c2410c", fontSize: 11, fontWeight: 900, padding: "3px 8px", cursor: directFieldEditLoading ? "not-allowed" : "pointer" }}
                    >
                      Edit
                    </button>
                  </div>
                  <div className="barsh-direct-summary-value">
                    {textValue(matter?.closeReason || "") || "—"}
                  </div>
                </div>
              </div>

              <div
                className="barsh-direct-financial-bubble"
                style={{
                  border: matterIsClosedForPayment()
                    ? "1px solid rgba(220, 38, 38, 0.28)"
                    : "1px solid rgba(22, 163, 74, 0.26)",
                  boxShadow: matterIsClosedForPayment()
                    ? "0 10px 26px rgba(220, 38, 38, 0.075)"
                    : "0 10px 26px rgba(22, 163, 74, 0.075)",
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
                      className="barsh-direct-apply-payment-button"
                      onClick={() => {
                        setPaymentApplyResult(null);
                        setPaymentEditingReceipt(null);
                        setPaymentFormOpen((open) => !open);
                        setPaymentDateInput((current) => current || formatPaymentDateYYYYMMDD(new Date()));
                      }}
                      disabled={paymentApplyLoading || matterIsClosedForPayment()}
                      title={matterIsClosedForPayment() ? "Payment controls are locked because this matter is Closed." : "Open payment entry form."}
                      style={{
                        width: "100%",
                        minWidth: 0,
                        height: 44,
                        border: "1px solid #16a34a",
                        borderRadius: 999,
                        background: matterIsClosedForPayment() ? "#f3f4f6" : "#16a34a",
                        color: matterIsClosedForPayment() ? "#64748b" : "#fff",
                        fontSize: 12,
                        fontWeight: 950,
                        cursor: matterIsClosedForPayment() ? "not-allowed" : "pointer",
                        boxShadow: matterIsClosedForPayment() ? "none" : "0 8px 24px rgba(22, 163, 74, 0.22)",
                      }}
                    >
                      {paymentApplyLoading ? (paymentEditingReceipt ? "Saving Edit..." : "Saving Payment...") : paymentFormOpen ? "Close Payment Form" : "Apply Payment"}
                    </button>

                    <div style={{ display: "grid", alignContent: "start" }}>
                      {matterIsClosedForPayment() && (
                        <div style={{ color: "#991b1b", fontSize: 11, fontWeight: 850, textAlign: "center" }}>
                          Disabled because this matter is Closed.
                        </div>
                      )}
                    </div>
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
                      Matter Actions
                    </div>

                    <button
                      type="button"
                      onClick={openCloseMatterDialogFromMatter}
                      disabled={matterIsClosedForPayment()}
                      title={
                        matterIsClosedForPayment()
                          ? "Matter is already Closed."
                          : "Close this matter without posting a payment."
                      }
                      style={{
                        width: "100%",
                        minWidth: 0,
                        height: 44,
                        border: "1px solid #dc2626",
                        borderRadius: 999,
                        background: matterIsClosedForPayment() ? "#f3f4f6" : "#dc2626",
                        color: matterIsClosedForPayment() ? "#64748b" : "#fff",
                        fontSize: 12,
                        fontWeight: 950,
                        cursor: matterIsClosedForPayment() ? "not-allowed" : "pointer",
                      }}
                    >
                      Close Matter
                    </button>

                    <button
                      type="button"
                      disabled
                      title="Start Lawsuit action will be wired later."
                      style={{
                        width: "100%",
                        minWidth: 0,
                        height: 44,
                        border: "1px solid #93c5fd",
                        borderRadius: 999,
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontSize: 12,
                        fontWeight: 950,
                        cursor: "not-allowed",
                        opacity: 0.82,
                      }}
                    >
                      Start Lawsuit
                    </button>

                    <button
                      type="button"
                      disabled
                      title="View Documents action will be wired later."
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

                    <div style={{ display: "grid", alignContent: "start" }}>
                      {matterIsClosedForPayment() && (
                        <div style={{ color: "#991b1b", fontSize: 11, fontWeight: 850, textAlign: "center" }}>
                          Disabled because this matter is Closed.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "center", marginBottom: 12 }}>
                </div>

                <div className="barsh-direct-financial-row">
                  <span>Claim Amount</span>
                  <strong>{money(num(matter?.claimAmount))}</strong>
                </div>

                <div className="barsh-direct-financial-row">
                  <span>Barsh Matters Payments</span>
                  <strong>{money(num(matter?.paymentVoluntary))}</strong>
                </div>

                <div className="barsh-direct-financial-row total">
                  <span>Barsh Matters Balance</span>
                  <strong>{money(currentDirectMatterBalancePresuit(matter))}</strong>
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
                      fontSize: 11,
                      fontWeight: 900,
                      color: matterIsClosedForPayment() ? "#991b1b" : "#166534",
                    }}
                  >
                    <span>
                      Payment controls: {matterIsClosedForPayment() ? "Locked because matter status is Closed" : "Active"}
                    </span>
                    <a
                      href={clioMatterUrl(matter?.id)}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "4px 8px",
                        border: "1px solid #93c5fd",
                        borderRadius: 999,
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        textDecoration: "none",
                        fontSize: 11,
                        fontWeight: 900,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Open in Clio
                    </a>
                  </div>

                  {latestPaymentReceipt() && (
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>
                      Last activity: Receipt #{latestPaymentReceipt().id} {paymentReceiptAuditStatus(latestPaymentReceipt()).toLowerCase()} · {paymentReceiptPrimaryTimestamp(latestPaymentReceipt()) || "—"}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: "1px solid #e2e8f0",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 900,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "#475569",
                      }}
                    >
                      Recent Receipts
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>
                      {paymentReceipts.length ? `${Math.min(paymentReceipts.length, 5)} shown` : "None"}
                    </span>
                  </div>

                  {paymentReceipts.length === 0 ? (
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>
                      No receipts posted yet.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 5 }}>
                      {paymentReceipts.slice(0, 5).map((receipt) => (
                        <div
                          key={receipt.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "auto 1fr auto",
                            gap: 8,
                            alignItems: "center",
                            fontSize: 12,
                            lineHeight: 1.35,
                            padding: "4px 6px",
                            borderRadius: 8,
                            border: receipt?.voided
                              ? "1px solid #fecaca"
                              : receipt?.editedAt
                                ? "1px solid #bbf7d0"
                                : "1px solid #22c55e",
                            background: receipt?.voided
                              ? "#fee2e2"
                              : receipt?.editedAt
                                ? "#dcfce7"
                                : "#86efac",
                            color: receipt?.voided
                              ? "#991b1b"
                              : receipt?.editedAt
                                ? "#166534"
                                : "#052e16",
                            opacity: receipt?.voided ? 0.82 : 1,
                          }}
                        >
                          <strong style={{ whiteSpace: "nowrap" }}>#{receipt.id}</strong>
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={`${receipt.paymentDate ? formatPaymentDateMMDDYYYY(receipt.paymentDate) : "—"} · ${receipt?.voided ? "Voided" : receipt?.editedAt ? "Edited" : "Posted"} · ${textValue(receipt.description || receipt.transactionType) || "Payment"}`}
                          >
                            {receipt.paymentDate ? formatPaymentDateMMDDYYYY(receipt.paymentDate) : "—"} · {receipt?.voided ? "Voided" : receipt?.editedAt ? "Edited" : "Posted"} · {textValue(receipt.description || receipt.transactionType) || "Payment"}
                          </span>
                          <strong style={{ whiteSpace: "nowrap" }}>{money(receipt.paymentAmount)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {paymentFormOpen && (
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={paymentEditingReceipt ? "Edit Payment" : "Post Payment"}
                    style={{
                      position: "fixed",
                      inset: 0,
                      zIndex: 10000,
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "center",
                      padding: "18px 24px 24px",
                      overflowY: "auto",
                      background: "rgba(15, 23, 42, 0.52)",
                      backdropFilter: "blur(2px)",
                    }}
                  >
                    <div
                      className="barsh-direct-payment-inline-form"
                      style={{
                        width: "min(1040px, calc(100vw - 48px))",
                        maxHeight: "calc(100vh - 36px)",
                        marginTop: 0,
                        padding: 0,
                        border: "1px solid #dbeafe",
                        borderRadius: 18,
                        background: "#fff",
                        overflowY: "auto",
                        boxShadow: "0 28px 90px rgba(15, 23, 42, 0.34)",
                      }}
                    >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 16,
                        padding: "16px 18px",
                        borderBottom: "1px solid #e5e7eb",
                        background: "#f8fafc",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>
                          {paymentEditingReceipt ? "Edit Payment" : "Post Payment"}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginTop: 3 }}>
                          This posts only to {textValue(matter?.displayNumber) || "this bill/matter"}.
                        </div>
                      </div>

                      <div style={{ textAlign: "right", fontWeight: 900, color: "#334155" }}>
                        Payment Amount:{" "}
                        <span style={{ color: "#dc2626", fontSize: 20 }}>
                          {money(num(paymentAmountInput))}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setPaymentFormOpen(false);
                          setPaymentApplyResult(null);
                        }}
                        disabled={paymentApplyLoading || matterIsClosedForPayment()}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#64748b",
                          fontSize: 26,
                          fontWeight: 900,
                          cursor: paymentApplyLoading ? "not-allowed" : "pointer",
                          lineHeight: 1,
                        }}
                        aria-label="Close payment form"
                      >
                        ×
                      </button>
                    </div>

                    {paymentEditingReceipt && (
                      <div
                        style={{
                          margin: "18px 18px 0",
                          padding: "10px 12px",
                          border: "1px solid #bae6fd",
                          borderRadius: 12,
                          background: "#e0f2fe",
                          color: "#075985",
                          fontSize: 12,
                          fontWeight: 900,
                        }}
                      >
                        Editing Receipt #{paymentEditingReceipt.id} · Original Amount: {money(paymentEditingReceipt.paymentAmount)}
                      </div>
                    )}

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.25fr 1fr 1fr",
                        gap: 18,
                        padding: 18,
                      }}
                    >
                      <label className="barsh-direct-payment-field">
                        <span>Transaction Type *</span>
                        <select
                          value={paymentTransactionTypeInput}
                          onChange={(event) => setPaymentTransactionTypeInput(event.target.value)}
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
                          <option value="Filing Fee Collected">Filing Fee Collected</option>
                          <option value="Filing Fee Billed">Filing Fee Billed</option>
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
                          value={paymentTransactionStatusInput}
                          onChange={(event) => setPaymentTransactionStatusInput(event.target.value)}
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
                          value={paymentDateInput}
                          onChange={(event) => setPaymentDateInput(event.target.value)}
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
                            value={paymentAmountInput}
                            onChange={(event) => setPaymentAmountInput(event.target.value)}
                            onBlur={() => setPaymentAmountInput((current) => formatPaymentAmountInput(current))}
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
                          value={paymentCheckDateInput}
                          onChange={(event) => setPaymentCheckDateInput(event.target.value)}
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
                          value={paymentCheckNumberInput}
                          onChange={(event) => setPaymentCheckNumberInput(event.target.value)}
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

                    {paymentAmountInput && (
                      <div
                        className="barsh-direct-payment-preview"
                        style={{
                          margin: "0 18px 18px",
                          display: "grid",
                          gridTemplateColumns: paymentEditingReceipt ? "1fr 1fr 1fr 1fr 1fr" : "1fr 1fr 1fr",
                          gap: 10,
                        }}
                      >
                        {paymentEditingReceipt && (
                          <div>Original Amount: {money(paymentFormOriginalAmountValue())}</div>
                        )}
                        <div>{paymentEditingReceipt ? "New Amount" : "Payment Amount"}: {money(paymentFormAmountValue())}</div>
                        {paymentEditingReceipt && (
                          <div>Local Payment Delta: {signedMoneyValue(paymentFormDeltaValue())}</div>
                        )}
                        {paymentEditingReceipt && (
                          <div
                            style={{
                              gridColumn: "1 / -1",
                              padding: "8px 10px",
                              border: "1px solid #facc15",
                              borderRadius: 10,
                              background: "#fef9c3",
                              color: "#854d0e",
                              fontWeight: 900,
                            }}
                          >
                            {Math.abs(paymentFormDeltaValue()) >= 0.005
                              ? `This edit will change local payment totals by ${signedMoneyValue(paymentFormDeltaValue())}.`
                              : "Metadata-only edit.  Local payment totals will not change."}
                          </div>
                        )}
                        <div>Expected Payments Posted: {money(expectedPaymentsPostedAfterPaymentForm())}</div>
                        <div>
                          Expected Balance Presuit: {money(expectedBalancePresuitAfterPaymentForm())}
                        </div>
                      </div>
                    )}

                    <div
                      className="barsh-direct-payment-form-actions"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 14,
                        padding: "14px 18px",
                        borderTop: "1px solid #e5e7eb",
                        background: "#f8fafc",
                      }}
                    >
                      <button
                        type="button"
                        className="barsh-direct-payment-cancel-button"
                        onClick={() => {
                          resetPaymentFormInputs();
                          setPaymentApplyResult(null);
                          setPaymentFormOpen(false);
                        }}
                        disabled={paymentApplyLoading}
                        style={{
                          minWidth: 132,
                          height: 44,
                          border: "1px solid #dc2626",
                          borderRadius: 12,
                          background: paymentApplyLoading ? "#fecaca" : "#dc2626",
                          color: "#fff",
                          fontWeight: 900,
                          fontSize: 15,
                          cursor: paymentApplyLoading ? "not-allowed" : "pointer",
                        }}
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        className="barsh-direct-payment-cancel-button"
                        onClick={() => {
                          setPaymentAmountInput("");
                          setPaymentDateInput(formatPaymentDateYYYYMMDD(new Date()));
                          setPaymentTransactionTypeInput("Collection Payment");
                          setPaymentTransactionStatusInput("Show on Remittance");
                          setPaymentCheckDateInput("");
                          setPaymentCheckNumberInput("");
                          setPaymentApplyResult(null);
                        }}
                        disabled={paymentApplyLoading}
                        style={{
                          minWidth: 132,
                          height: 44,
                          border: "1px solid #cbd5e1",
                          borderRadius: 12,
                          background: paymentApplyLoading ? "#f1f5f9" : "#ffffff",
                          color: "#334155",
                          fontWeight: 900,
                          fontSize: 15,
                          cursor: paymentApplyLoading ? "not-allowed" : "pointer",
                        }}
                      >
                        Clear
                      </button>

                      <button
                        type="button"
                        className="barsh-direct-payment-submit-button"
                        onClick={applyVoluntaryPaymentFromSummary}
                        disabled={paymentApplyLoading}
                        style={{
                          minWidth: 150,
                          height: 44,
                          border: "1px solid #16a34a",
                          borderRadius: 12,
                          background: paymentApplyLoading ? "#bbf7d0" : "#16a34a",
                          color: "#fff",
                          fontWeight: 900,
                          fontSize: 15,
                          cursor: paymentApplyLoading ? "not-allowed" : "pointer",
                        }}
                      >
                        {paymentApplyLoading ? "Applying..." : "Apply Payment"}
                      </button>
                    </div>

                    <div style={{ padding: "0 18px 16px", fontSize: 12, color: "#64748b", fontWeight: 700 }}>
                      Payment amount changes update Barsh Matters local payment totals and Balance.  Other receipt fields are stored locally for posting history and remittance workflows.
                    </div>
                    </div>
                  </div>
                )}

                {paymentApplyResult?.ok && (
                  <div className="barsh-direct-payment-confirmation">
                    <div>
                      {paymentApplyResult?.action === "edit-payment"
                        ? `Receipt #${paymentApplyResult?.receipt?.id || "—"} edited.`
                        : paymentApplyResult?.action === "void-payment"
                          ? `Receipt #${paymentApplyResult?.receipt?.id || "—"} voided.`
                          : `Receipt #${paymentApplyResult?.receipt?.id || "—"} posted.`}
                    </div>
                    <div>
                      {paymentApplyResult?.action === "edit-payment"
                        ? `Edit delta: ${Number.isFinite(Number(paymentApplyResult?.amountDelta)) ? signedMoneyValue(paymentApplyResult.amountDelta) : "$0.00"}.  Payments Posted: ${money(paymentApplyResult.after?.paymentVoluntary)}.  Balance Presuit: ${money(paymentApplyResult.after?.balancePresuit)}.`
                        : paymentApplyResult?.action === "void-payment"
                          ? `Payment voided by ${money(paymentApplyResult.paymentVoided || paymentApplyResult.paymentApplied || 0)}.  Payments Posted: ${money(paymentApplyResult.after?.paymentVoluntary)}.  Balance Presuit: ${money(paymentApplyResult.after?.balancePresuit)}.`
                          : `Payment: ${money(paymentApplyResult.paymentApplied)}.  Payments Posted: ${money(paymentApplyResult.after?.paymentVoluntary)}.  Balance Presuit: ${money(paymentApplyResult.after?.balancePresuit)}.`}
                    </div>


                  </div>
                )}

                {paymentApplyResult && !paymentApplyResult.ok && (
                  <div className="barsh-direct-payment-error">
                    {textValue(paymentApplyResult.error) || "Payment could not be applied."}
                  </div>
                )}

                {paymentClosePromptOpen && (
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Close Matter?"
                    style={{
                      position: "fixed",
                      inset: 0,
                      zIndex: 11000,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 24,
                      background: "rgba(15, 23, 42, 0.45)",
                    }}
                  >
                    <div
                      style={{
                        width: "min(420px, calc(100vw - 48px))",
                        border: "1px solid #fecaca",
                        borderRadius: 18,
                        background: "#fff",
                        boxShadow: "0 28px 90px rgba(15, 23, 42, 0.34)",
                        padding: 20,
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 22, fontWeight: 950, color: "#0f172a", marginBottom: 8 }}>
                        Close Matter?
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 18 }}>
                        Payment activity was saved.  Do you want to close this matter now?
                      </div>

                      <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
                        <button
                          type="button"
                          onClick={() => setPaymentClosePromptOpen(false)}
                          style={{
                            minWidth: 104,
                            height: 40,
                            border: "1px solid #cbd5e1",
                            borderRadius: 12,
                            background: "#f8fafc",
                            color: "#334155",
                            fontSize: 14,
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                        >
                          No
                        </button>

                        <button
                          type="button"
                          onClick={openCloseMatterFromPayment}
                          style={{
                            minWidth: 104,
                            height: 40,
                            border: "1px solid #dc2626",
                            borderRadius: 12,
                            background: "#dc2626",
                            color: "#fff",
                            fontSize: 14,
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                        >
                          Yes
                        </button>
                      </div>
                    </div>
                  </div>
                )}


              </div>
            </div>
          </div>
        </div>

        <div
          className="barsh-direct-payment-receipts"
          style={{
            marginTop: -22,
            width: "100%",
            padding: "8px 16px 12px",
            border: "none",
            borderRadius: 12,
            background: "#f8fafc",
            boxShadow: "none",
          }}
        >
          <div
            className="barsh-direct-payment-receipts-title"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 10,
            }}
          >
            <span>Payments</span>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569", fontWeight: 900 }}>
                <input
                  type="checkbox"
                  checked={paymentShowVoided}
                  onChange={(event) => {
                    setPaymentShowVoided(event.target.checked);
                    if (!event.target.checked && selectedPaymentReceipt()?.voided) {
                      setExpandedPaymentReceiptId(null);
                    }
                  }}
                />
                Show voided
              </label>
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>
                {paymentReceiptsLoading
          ? "Loading..."
          : `${visiblePaymentReceipts().length.toLocaleString("en-US")} shown / ${paymentReceipts.length.toLocaleString("en-US")} total`}
              </span>
            </div>
          </div>

          {paymentReceiptsLoading && (
            <div className="barsh-direct-payment-receipt-empty">
              Loading payments...
            </div>
          )}

          {!paymentReceiptsLoading && paymentReceipts.length === 0 && (
            <div className="barsh-direct-payment-receipt-empty">
              No payments posted yet.
            </div>
          )}

          {!paymentReceiptsLoading && paymentReceipts.length > 0 && (
            <div
              style={{
        overflowX: "auto",
        border: "none",
        borderRadius: 10,
        background: "#f8fafc",
        boxShadow: "none",
              }}
            >
              <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
          color: "#0f172a",
          minWidth: 1420,
        }}
              >
        <thead>
          <tr style={{ background: "#94a3b8", color: "#1f2937" }}>
            <th style={{ textAlign: "left", padding: "9px 8px", border: "1px solid #cbd5e1" }}>Action</th>
            <th style={{ textAlign: "left", padding: "9px 8px", border: "1px solid #cbd5e1" }}>Receipt #</th>
            <th style={{ textAlign: "left", padding: "9px 8px", border: "1px solid #cbd5e1" }}>BRL Number</th>
            <th style={{ textAlign: "right", padding: "9px 8px", border: "1px solid #cbd5e1" }}>Transaction Amount</th>
            <th style={{ textAlign: "left", padding: "9px 8px", border: "1px solid #cbd5e1" }}>Master Lawsuit</th>
            <th style={{ textAlign: "left", padding: "9px 8px", border: "1px solid #cbd5e1" }}>Provider</th>
            <th style={{ textAlign: "left", padding: "9px 8px", border: "1px solid #cbd5e1" }}>Invoice ID</th>
            <th style={{ textAlign: "left", padding: "9px 8px", border: "1px solid #cbd5e1" }}>Transaction Type</th>
            <th style={{ textAlign: "left", padding: "9px 8px", border: "1px solid #cbd5e1" }}>Transaction Date</th>
            <th style={{ textAlign: "left", padding: "9px 8px", border: "1px solid #cbd5e1" }}>Transaction Status</th>
            <th style={{ textAlign: "left", padding: "9px 8px", border: "1px solid #cbd5e1" }}>Check No</th>
            <th style={{ textAlign: "left", padding: "9px 8px", border: "1px solid #cbd5e1" }}>Check Date</th>
            <th style={{ textAlign: "left", padding: "9px 8px", border: "1px solid #cbd5e1" }}>Description</th>
            <th style={{ textAlign: "left", padding: "9px 8px", border: "1px solid #cbd5e1" }}>Posted By</th>
            <th style={{ textAlign: "left", padding: "9px 8px", border: "1px solid #cbd5e1" }}>Audit Status</th>
          </tr>
        </thead>
        <tbody>
          {visiblePaymentReceipts().slice(0, 25).map((receipt, index) => {
            const zebra = index % 2 === 0 ? "#f8fafc" : "#ffffff";
            const provider =
              textValue(receipt.provider) ||
              textValue(receipt.clientName) ||
              providerValue(matter) ||
              "—";

            return (
              <tr
                key={receipt.id}
                style={{
                  background: receipt?.voided
                    ? "#fee2e2"
                    : receipt?.editedAt
                      ? "#dcfce7"
                      : "#86efac",
                  color: receipt?.voided
                    ? "#991b1b"
                    : receipt?.editedAt
                      ? "#166534"
                      : "#052e16",
                  opacity: receipt?.voided ? 0.82 : 1,
                }}
              >
                <td style={{ padding: "7px 8px", border: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>
                  <button
                    type="button"
                    onClick={() => setExpandedPaymentReceiptId((current) => Number(current) === Number(receipt.id) ? null : Number(receipt.id))}
                    title="Show receipt details."
                    style={{
                      marginRight: 6,
                      minWidth: 62,
                      height: 30,
                      border: "1px solid #64748b",
                      borderRadius: 8,
                      background: Number(expandedPaymentReceiptId) === Number(receipt.id) ? "#334155" : "#64748b",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    Details
                  </button>
                  {receipt?.voided ? (
                    <span
                      title="This payment receipt is already voided."
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 92,
                        height: 30,
                        border: "1px solid #991b1b",
                        borderRadius: 8,
                        background: "#991b1b",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 900,
                        textTransform: "uppercase",
                      }}
                    >
                      Voided
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={paymentApplyLoading}
                        onClick={() => beginEditPaymentReceipt(receipt)}
                        title="Edit payment receipt."
                        style={{
                          marginRight: 6,
                          minWidth: 48,
                          height: 30,
                          border: "1px solid #0891b2",
                          borderRadius: 8,
                          background: "#06b6d4",
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 900,
                          cursor: paymentApplyLoading ? "not-allowed" : "pointer",
                          opacity: paymentApplyLoading ? 0.65 : 1,
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={paymentVoidLoadingId === Number(receipt.id) || matterIsClosedForPayment()}
                        onClick={() => handleVoidPaymentReceipt(receipt)}
                        title="Void payment and reverse the local payment total."
                        style={{
                          minWidth: 48,
                          height: 30,
                          border: "1px solid #ef4444",
                          borderRadius: 8,
                          background: "#ef4444",
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 900,
                          cursor: paymentVoidLoadingId === Number(receipt.id) ? "not-allowed" : "pointer",
                          opacity: paymentVoidLoadingId === Number(receipt.id) ? 0.65 : 1,
                        }}
                      >
                        {paymentVoidLoadingId === Number(receipt.id) ? "…" : "Void"}
                      </button>
                    </>
                  )}
                </td>

                <td style={{ padding: "7px 8px", border: "1px solid #e5e7eb", fontWeight: 900, whiteSpace: "nowrap" }}>
                  #{receipt.id}
                </td>

                <td style={{ padding: "7px 8px", border: "1px solid #e5e7eb", fontWeight: 800 }}>
                  {textValue(receipt.displayNumber) || textValue(matter?.displayNumber) || "—"}
                </td>

                <td style={{ padding: "7px 8px", border: "1px solid #e5e7eb", textAlign: "right", fontWeight: 900 }}>
                  {money(receipt.paymentAmount)}
                </td>

                <td style={{ padding: "7px 8px", border: "1px solid #e5e7eb" }}>
                  {textValue(matter?.masterLawsuitId) || "—"}
                </td>

                <td style={{ padding: "7px 8px", border: "1px solid #e5e7eb", minWidth: 240 }}>
                  {provider}
                </td>

                <td style={{ padding: "7px 8px", border: "1px solid #e5e7eb" }}>
                  {textValue(receipt.invoiceId) || "—"}
                </td>

                <td style={{ padding: "7px 8px", border: "1px solid #e5e7eb" }}>
                  {textValue(receipt.transactionType) || "—"}
                </td>

                <td style={{ padding: "7px 8px", border: "1px solid #e5e7eb" }}>
                  {receipt.paymentDate ? formatPaymentDateMMDDYYYY(receipt.paymentDate) : "—"}
                </td>

                <td style={{ padding: "7px 8px", border: "1px solid #e5e7eb" }}>
                  {textValue(receipt.transactionStatus) || "—"}
                </td>

                <td style={{ padding: "7px 8px", border: "1px solid #e5e7eb" }}>
                  {textValue(receipt.checkNumber) || "—"}
                </td>

                <td style={{ padding: "7px 8px", border: "1px solid #e5e7eb" }}>
                  {receipt.checkDate ? formatPaymentDateMMDDYYYY(receipt.checkDate) : "—"}
                </td>

                <td style={{ padding: "7px 8px", border: "1px solid #e5e7eb", minWidth: 180 }}>
                  {textValue(receipt.description) || "—"}
                </td>


                <td style={{ padding: "7px 8px", border: "1px solid #e5e7eb" }}>
                  {textValue(receipt.postedBy) || "—"}
                </td>

                <td style={{ padding: "7px 8px", border: "1px solid #e5e7eb", fontWeight: receipt?.voided || receipt?.editedAt ? 900 : 700 }}>
                  {paymentReceiptAuditStatus(receipt)}
                </td>
              </tr>
            );
          })}
        </tbody>
              </table>
            </div>
          )}

          {!paymentReceiptsLoading && selectedPaymentReceipt() && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                border: "1px solid #cbd5e1",
                borderRadius: 12,
                background: "#ffffff",
                color: "#0f172a",
                fontSize: 12,
                boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontWeight: 950, color: "#0f172a" }}>
                  Receipt Details · #{selectedPaymentReceipt().id}
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedPaymentReceiptId(null)}
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 999,
                    background: "#f8fafc",
                    color: "#334155",
                    fontSize: 11,
                    fontWeight: 900,
                    padding: "4px 9px",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
                <div><strong>Status:</strong> {paymentReceiptAuditStatus(selectedPaymentReceipt())}</div>
                <div><strong>Amount:</strong> {money(selectedPaymentReceipt().paymentAmount)}</div>
                <div><strong>Receipt Date:</strong> {selectedPaymentReceipt().paymentDate ? formatPaymentDateMMDDYYYY(selectedPaymentReceipt().paymentDate) : "—"}</div>
                <div><strong>Last Activity:</strong> {paymentReceiptPrimaryTimestamp(selectedPaymentReceipt()) || "—"}</div>
                <div><strong>Created:</strong> {textValue(selectedPaymentReceipt().createdAt) || "—"}</div>
                <div><strong>Edited:</strong> {textValue(selectedPaymentReceipt().editedAt) || "—"}</div>
                <div><strong>Edited By:</strong> {textValue(selectedPaymentReceipt().editedBy) || "—"}</div>
                <div><strong>Edit Reason:</strong> {textValue(selectedPaymentReceipt().editReason) || "—"}</div>
                <div><strong>Voided:</strong> {textValue(selectedPaymentReceipt().voidedAt) || "—"}</div>
                <div><strong>Voided By:</strong> {textValue(selectedPaymentReceipt().voidedBy) || "—"}</div>
                <div style={{ gridColumn: "span 2" }}><strong>Void Reason:</strong> {textValue(selectedPaymentReceipt().voidReason) || "—"}</div>
                <div><strong>Before Payment Posted:</strong> {money(selectedPaymentReceipt().paymentVoluntaryBefore)}</div>
                <div><strong>After Payment Posted:</strong> {money(selectedPaymentReceipt().paymentVoluntaryAfter)}</div>
                <div><strong>Before Balance:</strong> {money(selectedPaymentReceipt().balancePresuitBefore)}</div>
                <div><strong>After Balance:</strong> {money(selectedPaymentReceipt().balancePresuitAfter)}</div>
              </div>
            </div>
          )}

          {!paymentReceiptsLoading && paymentReceipts.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#64748b", fontWeight: 700 }}>
              Edit updates payment receipt details; amount edits apply only the difference to local payment totals.  Void reverses the local payment total and keeps the receipt as an audit record.
            </div>
          )}
        </div>

        <div className="barsh-summary-workflow-divider" />

      </section>

      {activeWorkspaceTab === "lawsuit" && alreadyAggregated && (
        <section style={tabPlaceholderPanelStyle}>
          <h2 style={{ marginTop: 0, marginBottom: 6 }}>Lawsuit Workspace Locked</h2>
          <p style={tabPlaceholderTextStyle}>
            This matter is already part of lawsuit {tabMasterLawsuitId || textValue(matter?.masterLawsuitId) || "—"}.
            Use the connected lawsuit/document/settlement workflow instead of generating another lawsuit from this matter.
          </p>
        </section>
      )}

      {activeWorkspaceTab === "lawsuit" && !alreadyAggregated && (
        <section style={tabPlaceholderPanelStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            <div>
              <h2 style={{ marginTop: 0, marginBottom: 6 }}>Matter-Level Lawsuit Workspace</h2>
              <p style={tabPlaceholderTextStyle}>
                Lawsuit generation and metadata controls for this matter group.  Clio remains the source of truth,
                and Amount Sought calculations continue to exclude master matters.
              </p>
            </div>

            {tabMasterLawsuitId ? (
              <div
                style={{
                  padding: "6px 10px",
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#991b1b",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                }}
              >
                MASTER LAWSUIT ID: {tabMasterLawsuitId}
              </div>
            ) : (
              <div
                style={{
                  padding: "6px 10px",
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  color: "#475569",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                }}
              >
                No lawsuit generated yet
              </div>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                padding: 10,
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                background: "#f8fafc",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 4 }}>Selected Matters</div>
              <div style={{ color: "#475569", fontSize: 13 }}>
                {selected.length} selected for lawsuit generation.
              </div>
            </div>

            <div
              style={{
                padding: 10,
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                background: "#f8fafc",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 4 }}>Claim Amount</div>
              <div style={{ color: "#475569", fontSize: 13 }}>{money(totals.claim)}</div>
            </div>

            <div
              style={{
                padding: 10,
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                background: "#f8fafc",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 4 }}>Balance (Presuit)</div>
              <div style={{ color: "#475569", fontSize: 13 }}>{money(totals.balance)}</div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            <button
              type="button"
              onClick={openLawsuitOptionsModal}
              disabled={submitting || selected.length === 0}
              style={{
                padding: "8px 12px",
                border: "1px solid #0070f3",
                background: submitting || selected.length === 0 ? "#f3f4f6" : "#0070f3",
                color: submitting || selected.length === 0 ? "#666" : "#fff",
                borderRadius: 4,
                cursor: submitting || selected.length === 0 ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
            >
              {submitting
                ? "Generating..."
                : selected.length === 1
                ? "Generate Lawsuit"
                : selected.length > 1
                ? "Aggregate / Generate Lawsuit"
                : "Select Matters to Generate"}
            </button>

            {alreadyAggregated && (
              <button
                type="button"
                onClick={deaggregateCluster}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #dc3545",
                  background: "#dc3545",
                  color: "#fff",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                De-aggregate Lawsuit
              </button>
            )}

            {alreadyAggregated && (
              <button
                type="button"
                onClick={openMetadataModal}
                disabled={packetLoading}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #4b5563",
                  background: packetLoading ? "#f3f4f6" : "#4b5563",
                  color: packetLoading ? "#666" : "#fff",
                  borderRadius: 4,
                  cursor: packetLoading ? "not-allowed" : "pointer",
                  fontWeight: 700,
                }}
              >
                Edit Lawsuit Metadata
              </button>
            )}

            {alreadyAggregated && (
              <button
                type="button"
                onClick={loadPacketPreview}
                disabled={packetLoading}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #2563eb",
                  background: packetLoading ? "#f3f4f6" : "#2563eb",
                  color: packetLoading ? "#666" : "#fff",
                  borderRadius: 4,
                  cursor: packetLoading ? "not-allowed" : "pointer",
                  fontWeight: 700,
                }}
              >
                {packetLoading ? "Loading..." : "Refresh Lawsuit Packet Data"}
              </button>
            )}
          </div>

          {alreadyAggregated ? (
            <div
              style={{
                padding: 10,
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                color: "#475569",
                fontSize: 13,
              }}
            >
              Existing lawsuit metadata and document packet data can be reviewed here and in the Documents tab.
              Final document upload to Clio remains explicit only.
            </div>
          ) : (
            <div
              style={{
                padding: 10,
                background: "#fffbeb",
                border: "1px solid #f59e0b",
                borderRadius: 8,
                color: "#92400e",
                fontSize: 13,
              }}
            >
              Select one or more eligible matters, then generate the lawsuit.  Single-matter lawsuit generation remains supported.
            </div>
          )}

          {packetPreview?.packet && activeWorkspaceTab === "lawsuit" && (
            <div
              style={{
                marginTop: 12,
                padding: 10,
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Current Lawsuit Packet Summary</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 8,
                }}
              >
                <div>
                  <strong>Venue:</strong>
                  <br />
                  {textValue(packetPreview.packet.metadata?.venue?.value) || "—"}
                </div>
                <div>
                  <strong>Amount Sought:</strong>
                  <br />
                  {money(packetAmountSoughtValue(packetPreview.packet))}
                  {" "}
                  ({packetAmountSoughtModeValue(packetPreview.packet)})
                </div>
                <div>
                  <strong>Index / AAA:</strong>
                  <br />
                  {textValue(packetPreview.packet.metadata?.indexAaaNumber?.value) || "—"}
                </div>
                <div>
                  <strong>Can Generate Docs:</strong>
                  <br />
                  {packetPreview.packet.validation?.canGenerate ? "Yes" : "No"}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {activeWorkspaceTab === "documents" && !alreadyAggregated && (
        <section style={tabPlaceholderPanelStyle}>
          <h2 style={{ marginTop: 0 }}>Documents</h2>
          <p style={tabPlaceholderTextStyle}>
            Document generation becomes available after a lawsuit is generated or the matter is connected to a
            MASTER_LAWSUIT_ID.  Preview and download actions remain non-persistent; final upload to Clio remains explicit only.
          </p>
        </section>
      )}

      {DIRECT_MATTER_SETTLEMENTS_ENABLED && activeWorkspaceTab === "settlement" && (
        <section style={tabPlaceholderPanelStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            <div>
              <h2 style={{ marginTop: 0, marginBottom: 6 }}>Settlement Intake / Planning</h2>
              <p style={tabPlaceholderTextStyle}>
                Read-only settlement workspace draft.  This panel does not change Clio, ClaimIndex, document records,
                finalization records, or print queue records.
              </p>
            </div>

            {tabMasterLawsuitId ? (
              <div
                style={{
                  padding: "6px 10px",
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  color: "#0f172a",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                }}
              >
                MASTER LAWSUIT ID: {tabMasterLawsuitId}
              </div>
            ) : (
              <div
                style={{
                  padding: "6px 10px",
                  border: "1px solid #fde68a",
                  background: "#fffbeb",
                  color: "#92400e",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                }}
              >
                No lawsuit connected yet
              </div>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                padding: 10,
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                background: "#f8fafc",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 4 }}>Provider</div>
              <div style={{ color: "#475569", fontSize: 13 }}>{providerValue(matter) || "—"}</div>
            </div>

            <div
              style={{
                padding: 10,
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                background: "#f8fafc",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 4 }}>Insurer</div>
              <div style={{ color: "#475569", fontSize: 13 }}>{insurerValue(matter) || "—"}</div>
            </div>

            <div
              style={{
                padding: 10,
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                background: "#f8fafc",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 4 }}>Claim Number</div>
              <div style={{ color: "#475569", fontSize: 13 }}>{textValue(matter?.claimNumber) || "—"}</div>
            </div>

            <div
              style={{
                padding: 10,
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                background: "#f8fafc",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 4 }}>Balance (Presuit)</div>
              <div style={{ color: "#475569", fontSize: 13 }}>{money(totals.balance)}</div>
            </div>
          </div>

          <div
            style={{
              padding: 12,
              border: "1px solid #cbd5e1",
              borderRadius: 10,
              background: "#ffffff",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 10,
              }}
            >
              <div>
                <div style={{ fontWeight: 900, marginBottom: 4 }}>
                  Settlement Workflow Status
                </div>
                <div style={{ color: "#475569", fontSize: 12 }}>
                  Operational checklist for settlement processing.  This panel is read-only and does not write to Clio,
                  ClaimIndex, documents, finalization records, persistent files, or the print queue.
                </div>
              </div>

              <div
                style={{
                  padding: "6px 10px",
                  border: "1px solid #bfdbfe",
                  background: "#eff6ff",
                  color: "#1e3a8a",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 900,
                  whiteSpace: "nowrap",
                }}
              >
                {settlementWorkflowCompletedCount} / {settlementWorkflowChecklist.length} complete
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              {settlementWorkflowChecklist.map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: 10,
                    border: item.done ? "1px solid #bbf7d0" : "1px solid #e5e7eb",
                    borderRadius: 8,
                    background: item.done ? "#f0fdf4" : "#f8fafc",
                    minHeight: 92,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 6,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 999,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: item.done ? "#16a34a" : "#cbd5e1",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 900,
                        flex: "0 0 auto",
                      }}
                    >
                      {item.done ? "✓" : "•"}
                    </span>
                    <span style={{ fontWeight: 800, fontSize: 13 }}>{item.label}</span>
                  </div>
                  <div style={{ color: "#475569", fontSize: 12, lineHeight: 1.4 }}>
                    {item.detail}
                  </div>
                </div>
              ))}
            </div>

            {settlementValueComparisonMismatches.length > 0 && (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#991b1b",
                  borderRadius: 8,
                  fontSize: 12,
                  lineHeight: 1.45,
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 4 }}>Current Clio Value Mismatch Details</div>
                <ul style={{ margin: "0 0 0 18px", padding: 0 }}>
                  {settlementValueComparisonMismatches.slice(0, 8).map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
                {settlementValueComparisonMismatches.length > 8 && (
                  <div style={{ marginTop: 4 }}>
                    Plus {num(settlementValueComparisonMismatches.length - 8)} additional mismatch(es).
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 10, color: "#92400e", fontSize: 12, lineHeight: 1.45 }}>
              Closure remains separate from settlement writeback: payment must be confirmed before Close Paid
              Settlements is used, master matters remain excluded, and already closed/final-status matters remain blocked.
            </div>
          </div>

          <div
            style={{
              padding: 12,
              border: "1px solid #cbd5e1",
              borderRadius: 10,
              background: "#ffffff",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 10,
              }}
            >
              <div>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>
                  Current Clio Settlement Values
                </div>
                <div style={{ color: "#475569", fontSize: 12 }}>
                  Live read-only Clio readback for child/bill matters.  This does not write to Clio, ClaimIndex, documents, or the print queue.
                </div>
              </div>

              <button
                type="button"
                onClick={() => loadCurrentSettlementValues()}
                disabled={currentSettlementValuesLoading || !tabMasterLawsuitId}
                style={{
                  padding: "7px 10px",
                  border: "1px solid #2563eb",
                  background: currentSettlementValuesLoading || !tabMasterLawsuitId ? "#f3f4f6" : "#2563eb",
                  color: currentSettlementValuesLoading || !tabMasterLawsuitId ? "#666" : "#fff",
                  borderRadius: 4,
                  cursor: currentSettlementValuesLoading || !tabMasterLawsuitId ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                {currentSettlementValuesLoading ? "Refreshing..." : "Refresh Clio Values"}
              </button>
            </div>

            {currentSettlementValuesResult?.error && (
              <div style={{ color: "#991b1b", fontSize: 13, marginBottom: 8 }}>
                <strong>Error:</strong> {textValue(currentSettlementValuesResult.error)}
              </div>
            )}

            {currentSettlementValuesResult?.ok && currentSettlementValuesResult.totals && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                  gap: 8,
                  marginBottom: 10,
                  fontSize: 12,
                }}
              >
                <div>
                  <strong>Bill Matters:</strong>
                  <br />
                  {num(currentSettlementValuesResult.totals.childMatterCount)}
                </div>
                <div>
                  <strong>Settled Amount:</strong>
                  <br />
                  {money(currentSettlementValuesResult.totals.settledAmountTotal)}
                </div>
                <div>
                  <strong>Allocated:</strong>
                  <br />
                  {money(currentSettlementValuesResult.totals.allocatedSettlementTotal)}
                </div>
                <div>
                  <strong>Total Fee:</strong>
                  <br />
                  {money(currentSettlementValuesResult.totals.totalFeeTotal)}
                </div>
                <div>
                  <strong>Provider Net:</strong>
                  <br />
                  {money(currentSettlementValuesResult.totals.providerNetTotal)}
                </div>
              </div>
            )}

            {currentSettlementValuesResult?.ok &&
              Array.isArray(currentSettlementValuesResult.rows) &&
              currentSettlementValuesResult.rows.length > 0 && (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    background: "#fff",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Matter</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Bill</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Settled With</th>
                      <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Settled</th>
                      <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Allocated</th>
                      <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Interest</th>
                      <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Principal Fee</th>
                      <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Interest Fee</th>
                      <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Provider Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentSettlementValuesResult.rows.map((row: any) => (
                      <tr key={textValue(row.matterId)}>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                          {textValue(row.displayNumber) || textValue(row.matterId)}
                        </td>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                          {textValue(row.billNumber) || "—"}
                        </td>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                          {textValue(row.settledWith) || "—"}
                        </td>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5, textAlign: "right" }}>
                          {row.settledAmount == null ? "—" : money(row.settledAmount)}
                        </td>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5, textAlign: "right" }}>
                          {row.allocatedSettlement == null ? "—" : money(row.allocatedSettlement)}
                        </td>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5, textAlign: "right" }}>
                          {row.interestAmount == null ? "—" : money(row.interestAmount)}
                        </td>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5, textAlign: "right" }}>
                          {row.principalFee == null ? "—" : money(row.principalFee)}
                        </td>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5, textAlign: "right" }}>
                          {row.interestFee == null ? "—" : money(row.interestFee)}
                        </td>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5, textAlign: "right" }}>
                          {row.providerNet == null ? "—" : money(row.providerNet)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

            {currentSettlementValuesResult?.ok &&
              Array.isArray(currentSettlementValuesResult.rows) &&
              currentSettlementValuesResult.rows.length === 0 && (
                <div style={{ color: "#475569", fontSize: 13 }}>
                  No child/bill settlement values were found for this master lawsuit.
                </div>
              )}

            <div style={{ marginTop: 8, color: "#475569", fontSize: 12 }}>
              Source: {textValue(currentSettlementValuesResult?.source) || "live Clio readback when loaded"}.
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                padding: 12,
                border: "1px solid #dbeafe",
                borderRadius: 10,
                background: "#eff6ff",
              }}
            >
              <div
              style={{
                margin: "14px 0",
                padding: 12,
                border: "1px solid #bfdbfe",
                background: "#eff6ff",
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>
                    Settlement Documents Preview
                  </div>
                  <div style={{ color: "#1e3a8a", fontSize: 12 }}>
                    Read-only preview of planned settlement documents using current Clio settlement values.  This does not generate documents, upload to Clio, create database records, or change the print queue.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => loadSettlementDocumentsPreview()}
                  disabled={settlementDocumentsPreviewLoading || !tabMasterLawsuitId}
                  style={{
                    padding: "7px 10px",
                    border: "1px solid #2563eb",
                    background: settlementDocumentsPreviewLoading || !tabMasterLawsuitId ? "#f3f4f6" : "#2563eb",
                    color: settlementDocumentsPreviewLoading || !tabMasterLawsuitId ? "#666" : "#fff",
                    borderRadius: 4,
                    cursor: settlementDocumentsPreviewLoading || !tabMasterLawsuitId ? "not-allowed" : "pointer",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {settlementDocumentsPreviewLoading ? "Previewing..." : "Preview Settlement Documents"}
                </button>
              </div>

              {settlementDocumentsPreviewResult?.error && (
                <div style={{ color: "#991b1b", fontSize: 13, marginBottom: 8 }}>
                  <strong>Error:</strong> {textValue(settlementDocumentsPreviewResult.error)}
                </div>
              )}

              {settlementDocumentsPreviewResult?.settlementSummary && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: 8,
                    marginBottom: 10,
                    fontSize: 12,
                  }}
                >
                  <div>
                    <strong>Child Matters:</strong>
                    <br />
                    {num(settlementDocumentsPreviewResult.settlementSummary.childMatterCount)}
                  </div>
                  <div>
                    <strong>Settlement:</strong>
                    <br />
                    {money(settlementDocumentsPreviewResult.settlementSummary.settledAmountTotal)}
                  </div>
                  <div>
                    <strong>Total Fee:</strong>
                    <br />
                    {money(settlementDocumentsPreviewResult.settlementSummary.totalFeeTotal)}
                  </div>
                  <div>
                    <strong>Provider Net:</strong>
                    <br />
                    {money(settlementDocumentsPreviewResult.settlementSummary.providerNetTotal)}
                  </div>
                </div>
              )}

              {Array.isArray(settlementDocumentsPreviewResult?.plannedDocuments) &&
                settlementDocumentsPreviewResult.plannedDocuments.length > 0 && (
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      background: "#fff",
                      fontSize: 12,
                      marginTop: 8,
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Document</th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Status</th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Filename</th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Route-only DOCX</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settlementDocumentsPreviewResult.plannedDocuments.map((doc: any) => {
                        const endpoint = textValue(doc.generationEndpoint);
                        const canDownloadRouteOnlyDocx =
                          doc.availableNow === true &&
                          doc.routeOnly === true &&
                          endpoint &&
                          tabMasterLawsuitId;

                        return (
                          <tr key={textValue(doc.key)}>
                            <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                              {textValue(doc.label) || textValue(doc.key)}
                            </td>
                            <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                              {textValue(doc.status) || "—"}
                            </td>
                            <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                              {textValue(doc.filename) || "—"}
                            </td>
                            <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                              {canDownloadRouteOnlyDocx ? (
                                <a
                                  href={`${endpoint}?masterLawsuitId=${encodeURIComponent(tabMasterLawsuitId)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    display: "inline-block",
                                    padding: "5px 8px",
                                    border: "1px solid #2563eb",
                                    background: "#eff6ff",
                                    color: "#1d4ed8",
                                    borderRadius: 4,
                                    fontWeight: 700,
                                    textDecoration: "none",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  Download DOCX
                                </a>
                              ) : (
                                <span style={{ color: "#64748b" }}>Preview-only</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

              {settlementDocumentsPreviewResult?.validation && (
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  <strong>Can Preview:</strong>{" "}
                  {settlementDocumentsPreviewResult.validation.canPreviewSettlementDocuments ? "Yes" : "No"}
                </div>
              )}

              {Array.isArray(settlementDocumentsPreviewResult?.validation?.warnings) &&
                settlementDocumentsPreviewResult.validation.warnings.length > 0 && (
                  <div style={{ color: "#92400e", marginTop: 8, fontSize: 12 }}>
                    <strong>Warnings:</strong>
                    <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                      {settlementDocumentsPreviewResult.validation.warnings.map((msg: string) => (
                        <li key={msg}>{msg}</li>
                      ))}
                    </ul>
                  </div>
                )}

              {Array.isArray(settlementDocumentsPreviewResult?.validation?.blockingErrors) &&
                settlementDocumentsPreviewResult.validation.blockingErrors.length > 0 && (
                  <div style={{ color: "#991b1b", marginTop: 8, fontSize: 12 }}>
                    <strong>Blocking Errors:</strong>
                    <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                      {settlementDocumentsPreviewResult.validation.blockingErrors.map((msg: string) => (
                        <li key={msg}>{msg}</li>
                      ))}
                    </ul>
                  </div>
                )}

              <div style={{ marginTop: 8, color: "#1e3a8a", fontSize: 12 }}>
                Preview only.  No settlement documents are generated here.  No Clio records, database records, or print queue records are changed.
              </div>

              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                  Raw settlement documents preview JSON
                </summary>
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    overflowX: "auto",
                    margin: "6px 0 0 0",
                    padding: 6,
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                >
                  {JSON.stringify(settlementDocumentsPreviewResult, null, 2)}
                </pre>
              </details>
            </div>

            <div style={{ fontWeight: 800, marginBottom: 6 }}>Settlement Inputs</div>
              <ul style={{ margin: "0 0 0 18px", padding: 0, color: "#1e3a8a", fontSize: 13, lineHeight: 1.5 }}>
                <li>Gross settlement amount</li>
                <li>Settled with / adjuster or defense contact</li>
                <li>Settlement date and payment expected date</li>
                <li>Principal allocation method</li>
                <li>Interest allocation method</li>
              </ul>
            </div>

            <div
              style={{
                padding: 12,
                border: "1px solid #dcfce7",
                borderRadius: 10,
                background: "#f0fdf4",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Calculated Outputs</div>
              <ul style={{ margin: "0 0 0 18px", padding: 0, color: "#166534", fontSize: 13, lineHeight: 1.5 }}>
                <li>Allocated settlement per bill</li>
                <li>Principal fee and interest fee</li>
                <li>Total firm fee</li>
                <li>Provider principal net</li>
                <li>Provider interest net and total provider net</li>
              </ul>
            </div>

            <div
              style={{
                padding: 12,
                border: "1px solid #fef3c7",
                borderRadius: 10,
                background: "#fffbeb",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Safety Rules</div>
              <ul style={{ margin: "0 0 0 18px", padding: 0, color: "#92400e", fontSize: 13, lineHeight: 1.5 }}>
                <li>This direct matter settlement workspace is disabled. Settlements are handled only from the Master Lawsuit page.</li>
                <li>Settlement writeback must be explicit only.</li>
                <li>Preview calculations should be non-persistent.</li>
                <li>Provider-specific fee percentages are handled from the Master Lawsuit settlement workflow.</li>
              </ul>
            </div>
          </div>

          <div
            style={{
              padding: 12,
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              background: "#ffffff",
              marginBottom: 14,
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Proposed Settlement Workflow</div>
            <ol style={{ margin: "0 0 0 20px", padding: 0, color: "#475569", fontSize: 13, lineHeight: 1.6 }}>
              <li>Settlement workflow is handled only from the Master Lawsuit page.</li>
              <li>Enter or preview gross settlement details without saving.</li>
              <li>Calculate allocation, fees, and provider net amounts per bill.</li>
              <li>Review warnings before any writeback.</li>
              <li>Explicitly save final settlement values to the appropriate child/bill matters only.</li>
              <li>Generate settlement documents and add final print-ready copies through the existing document workflow.</li>
            </ol>
          </div>

          <div
            style={{
              padding: 12,
              border: "1px solid #cbd5e1",
              borderRadius: 10,
              background: "#f8fafc",
              marginBottom: 14,
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Preview Settlement Calculation</div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <label style={{ fontSize: 13, fontWeight: 700 }}>
                Gross Settlement Amount
                <input
                  value={settlementPreviewInput.grossSettlementAmount}
                  onChange={(e) =>
                    setSettlementPreviewInput((prev) => ({
                      ...prev,
                      grossSettlementAmount: e.target.value,
                    }))
                  }
                  placeholder="1000.00"
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    padding: 8,
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                  }}
                />
              </label>

              <label style={{ fontSize: 13, fontWeight: 700 }}>
                Settled With
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={settlementPreviewInput.settledWithContactSearch}
                    onChange={(e) =>
                      setSettlementPreviewInput({
                        ...settlementPreviewInput,
                        settledWithContactSearch: e.target.value,
                        settledWithContactId: "",
                        settledWithContactName: "",
                        settledWithContactType: "",
                        settledWith: e.target.value,
                      })
                    }
                    placeholder="Search local contacts"
                    style={{
                      width: "100%",
                      padding: 8,
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                    }}
                  />
                  <button
                    type="button"
                    onClick={searchSettledWithContacts}
                    disabled={settledWithContactLoading}
                    style={{
                      padding: "8px 10px",
                      border: "1px solid #2563eb",
                      background: settledWithContactLoading ? "#f3f4f6" : "#2563eb",
                      color: settledWithContactLoading ? "#666" : "#fff",
                      borderRadius: 4,
                      cursor: settledWithContactLoading ? "not-allowed" : "pointer",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {settledWithContactLoading ? "Searching..." : "Search"}
                  </button>
                </div>

                {settlementPreviewInput.settledWithContactId && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#166534", fontWeight: 700 }}>
                    Selected local person contact: {settlementPreviewInput.settledWithContactName} (ID {settlementPreviewInput.settledWithContactId})
                  </div>
                )}

                {settledWithContactResults.length > 0 && (
                  <div
                    style={{
                      marginTop: 6,
                      border: "1px solid #cbd5e1",
                      borderRadius: 6,
                      overflow: "hidden",
                      background: "#fff",
                    }}
                  >
                    {settledWithContactResults.map((contact: any) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => selectSettledWithContact(contact)}
                        style={{
                          display: "block",
                          width: "100%",
                          padding: "8px 10px",
                          textAlign: "left",
                          border: "none",
                          borderBottom: "1px solid #e5e7eb",
                          background: "#fff",
                          cursor: "pointer",
                        }}
                      >
                        <strong>{contact.name}</strong>
                        {contact.type ? <span style={{ color: "#64748b" }}> — {contact.type}</span> : null}
                      </button>
                    ))}
                  </div>
                )}
              </label>

              <label style={{ fontSize: 13, fontWeight: 700 }}>
                Settlement Date
                <input
                  type="date"
                  value={settlementPreviewInput.settlementDate}
                  onChange={(e) =>
                    setSettlementPreviewInput((prev) => ({
                      ...prev,
                      settlementDate: e.target.value,
                    }))
                  }
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    padding: 8,
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                  }}
                />
              </label>

              <label style={{ fontSize: 13, fontWeight: 700 }}>
                Payment Expected Date
                <input
                  type="date"
                  value={settlementPreviewInput.paymentExpectedDate}
                  onChange={(e) =>
                    setSettlementPreviewInput((prev) => ({
                      ...prev,
                      paymentExpectedDate: e.target.value,
                    }))
                  }
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    padding: 8,
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                  }}
                />
              </label>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <label style={{ fontSize: 13, fontWeight: 700 }}>
                Allocation Mode
                <select
                  value={settlementPreviewInput.allocationMode}
                  onChange={(e) =>
                    setSettlementPreviewInput((prev) => ({
                      ...prev,
                      allocationMode: e.target.value,
                    }))
                  }
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    padding: 8,
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    background: "#fff",
                  }}
                >
                  <option value="proportional_balance_presuit">Proportional to Balance (Presuit)</option>
                  <option value="proportional_claim_amount">Proportional to Claim Amount</option>
                  <option value="equal">Equal Per Bill</option>
                </select>
              </label>

              <label style={{ fontSize: 13, fontWeight: 700 }}>
                Principal Fee %
                <input
                  value={settlementPreviewInput.principalFeePercent}
                  onChange={(e) =>
                    setSettlementPreviewInput((prev) => ({
                      ...prev,
                      principalFeePercent: e.target.value,
                    }))
                  }
                  placeholder="0"
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    padding: 8,
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                  }}
                />
                <div style={{ marginTop: 4, color: "#64748b", fontSize: 11 }}>
                  Defaults from provider contact: Retainer Principal NF.
                </div>
              </label>

              <label style={{ fontSize: 13, fontWeight: 700 }}>
                Interest Amount
                <input
                  value={settlementPreviewInput.interestAmount}
                  onChange={(e) =>
                    setSettlementPreviewInput((prev) => ({
                      ...prev,
                      interestAmount: e.target.value,
                    }))
                  }
                  placeholder="0"
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    padding: 8,
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                  }}
                />
              </label>

              <label style={{ fontSize: 13, fontWeight: 700 }}>
                Interest Fee %
                <input
                  value={settlementPreviewInput.interestFeePercent}
                  onChange={(e) =>
                    setSettlementPreviewInput((prev) => ({
                      ...prev,
                      interestFeePercent: e.target.value,
                    }))
                  }
                  placeholder="0"
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    padding: 8,
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                  }}
                />
                <div style={{ marginTop: 4, color: "#64748b", fontSize: 11 }}>
                  Defaults from provider contact: Retainer Interest.
                </div>
              </label>
            </div>

            <div
              style={{
                marginBottom: 10,
                padding: 10,
                border: "1px solid #dbeafe",
                borderRadius: 8,
                background: "#eff6ff",
                fontSize: 13,
              }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>Provider Fee Defaults</div>
                <div style={{ color: "#1e3a8a", fontSize: 12 }}>
                  Provider defaults are handled from the Master Lawsuit settlement workflow.
                </div>
              </div>

              {providerFeeDefaultsResult && (
                <div
                  style={{
                    marginTop: 8,
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: 8,
                    color: providerFeeDefaultsResult.ok ? "#166534" : "#991b1b",
                  }}
                >
                  <div>
                    <strong>Provider:</strong>
                    <br />
                    {textValue(providerFeeDefaultsResult.providerContact?.name) || "—"}
                  </div>
                  <div>
                    <strong>Principal %:</strong>
                    <br />
                    {providerFeeDefaultsResult.defaults?.principalFeePercent == null
                      ? "—"
                      : providerFeeDefaultsResult.defaults.principalFeePercent}
                  </div>
                  <div>
                    <strong>Interest %:</strong>
                    <br />
                    {providerFeeDefaultsResult.defaults?.interestFeePercent == null
                      ? "—"
                      : providerFeeDefaultsResult.defaults.interestFeePercent}
                  </div>
                  <div>
                    <strong>Source:</strong>
                    <br />
                    {providerFeeDefaultsResult.ok
                      ? "Clio provider contact"
                      : textValue(providerFeeDefaultsResult.error) || "Error"}
                  </div>
                </div>
              )}

              {providerFeeDefaultsResult?.ok &&
                Array.isArray(providerFeeDefaultsResult.validation?.missingDefaults) &&
                providerFeeDefaultsResult.validation.missingDefaults.length > 0 && (
                  <div style={{ marginTop: 8, color: "#92400e", fontSize: 12 }}>
                    Missing Clio default(s): {providerFeeDefaultsResult.validation.missingDefaults.join(", ")}.  Missing values are not blocking; enter them manually if needed.
                  </div>
                )}
            </div>

            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
              Notes
              <textarea
                value={settlementPreviewInput.notes}
                onChange={(e) =>
                  setSettlementPreviewInput((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                placeholder="Preview notes only.  Not saved."
                rows={2}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 4,
                  padding: 8,
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  resize: "vertical",
                }}
              />
            </label>

            <div
              style={{
                marginBottom: 10,
                padding: 10,
                border: "1px solid #dbeafe",
                borderRadius: 8,
                background: "#eff6ff",
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 6 }}>
                Current Settlement Contact Selection
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 8,
                }}
              >
                <div>
                  <strong>Selected Person:</strong>
                  <br />
                  {textValue(settlementPreviewInput.settledWithContactName) || "—"}
                </div>
                <div>
                  <strong>Local Contact ID:</strong>
                  <br />
                  {textValue(settlementPreviewInput.settledWithContactId) || "—"}
                </div>
                <div>
                  <strong>Contact Type:</strong>
                  <br />
                  {textValue(settlementPreviewInput.settledWithContactType) || "—"}
                </div>
                <div>
                  <strong>Source:</strong>
                  <br />
                  {textValue(settlementPreviewInput.settledWithContactId)
                    ? "Selected from local person-contact search"
                    : "No local contact selected"}
                </div>
              </div>
              <div style={{ marginTop: 6, color: "#1e3a8a", fontSize: 12 }}>
                SETTLED_WITH selection is handled from the Master Lawsuit page.
              </div>
            </div>

            <button
              type="button"
              onClick={loadSettlementPreview}
              disabled={settlementPreviewLoading || !tabMasterLawsuitId}
              style={{
                padding: "8px 12px",
                border: "1px solid #2563eb",
                background:
                  settlementPreviewLoading || !tabMasterLawsuitId ? "#f3f4f6" : "#2563eb",
                color: settlementPreviewLoading || !tabMasterLawsuitId ? "#666" : "#fff",
                borderRadius: 4,
                cursor:
                  settlementPreviewLoading || !tabMasterLawsuitId ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
            >
              {settlementPreviewLoading ? "Previewing..." : "Preview Settlement"}
            </button>

            <div style={{ marginTop: 8, color: "#475569", fontSize: 12 }}>
              Preview only.  This does not write to Clio, does not write to the database, does not generate documents,
              and does not change the print queue.
            </div>
          </div>

          {settlementPreviewResult && (
            <div
              style={{
                padding: 12,
                border: settlementPreviewResult.ok ? "1px solid #bbf7d0" : "1px solid #fecaca",
                borderRadius: 10,
                background: settlementPreviewResult.ok ? "#f0fdf4" : "#fef2f2",
                marginBottom: 14,
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 8 }}>
                Settlement Preview Result
              </div>

              {settlementPreviewResult.error && (
                <div style={{ color: "#991b1b", marginBottom: 8 }}>
                  <strong>Error:</strong> {textValue(settlementPreviewResult.error)}
                </div>
              )}

              {Array.isArray(settlementPreviewResult.validation?.blockingErrors) &&
                settlementPreviewResult.validation.blockingErrors.length > 0 && (
                  <div style={{ color: "#991b1b", marginBottom: 8 }}>
                    <strong>Blocking Errors:</strong>
                    <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                      {settlementPreviewResult.validation.blockingErrors.map((msg: string) => (
                        <li key={msg}>{msg}</li>
                      ))}
                    </ul>
                  </div>
                )}

              {Array.isArray(settlementPreviewResult.validation?.warnings) &&
                settlementPreviewResult.validation.warnings.length > 0 && (
                  <div style={{ color: "#92400e", marginBottom: 8 }}>
                    <strong>Warnings:</strong>
                    <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                      {settlementPreviewResult.validation.warnings.map((msg: string) => (
                        <li key={msg}>{msg}</li>
                      ))}
                    </ul>
                  </div>
                )}

              {settlementPreviewResult.totals && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: 8,
                    marginBottom: 10,
                    fontSize: 13,
                  }}
                >
                  <div>
                    <strong>Gross Settlement:</strong>
                    <br />
                    {money(settlementPreviewResult.totals.grossSettlementAmount)}
                  </div>
                  <div>
                    <strong>Total Firm Fee:</strong>
                    <br />
                    {money(settlementPreviewResult.totals.totalFeeTotal)}
                  </div>
                  <div>
                    <strong>Provider Net:</strong>
                    <br />
                    {money(settlementPreviewResult.totals.providerNetTotal)}
                  </div>
                  <div>
                    <strong>Bill Count:</strong>
                    <br />
                    {num(settlementPreviewResult.totals.childMatterCount)}
                  </div>
                </div>
              )}

              {Array.isArray(settlementPreviewResult.rows) && settlementPreviewResult.rows.length > 0 && (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    background: "#fff",
                    fontSize: 12,
                    marginTop: 8,
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Matter</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Bill</th>
                      <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Allocated</th>
                      <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Interest</th>
                      <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Firm Fee</th>
                      <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Provider Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlementPreviewResult.rows.map((row: any) => (
                      <tr key={textValue(row.matterId)}>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                          {textValue(row.displayNumber) || textValue(row.matterId)}
                        </td>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                          {textValue(row.billNumber) || "—"}
                        </td>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5, textAlign: "right" }}>
                          {money(row.allocatedSettlement)}
                        </td>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5, textAlign: "right" }}>
                          {money(row.interestAmount)}
                        </td>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5, textAlign: "right" }}>
                          {money(row.totalFee)}
                        </td>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5, textAlign: "right" }}>
                          {money(row.providerNet)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  background: "#f8fafc",
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 6 }}>
                  Master Lawsuit Writeback Readiness
                </div>
                <p style={{ margin: "0 0 8px", color: "#475569", fontSize: 12 }}>
                  Dry-run validation only.  This checks whether the child/bill matters have the required existing Clio custom field value records for final settlement writeback.
                </p>
                <button
                  type="button"
                  onClick={loadSettlementWritebackPreview}
                  disabled={
                    settlementWritebackPreviewLoading ||
                    !settlementPreviewResult?.ok ||
                    !Array.isArray(settlementPreviewResult?.rows) ||
                    settlementPreviewResult.rows.length === 0
                  }
                  style={{
                    padding: "7px 10px",
                    border: "1px solid #0f766e",
                    background:
                      settlementWritebackPreviewLoading ||
                      !settlementPreviewResult?.ok ||
                      !Array.isArray(settlementPreviewResult?.rows) ||
                      settlementPreviewResult.rows.length === 0
                        ? "#f3f4f6"
                        : "#0f766e",
                    color:
                      settlementWritebackPreviewLoading ||
                      !settlementPreviewResult?.ok ||
                      !Array.isArray(settlementPreviewResult?.rows) ||
                      settlementPreviewResult.rows.length === 0
                        ? "#666"
                        : "#fff",
                    borderRadius: 4,
                    cursor:
                      settlementWritebackPreviewLoading ||
                      !settlementPreviewResult?.ok ||
                      !Array.isArray(settlementPreviewResult?.rows) ||
                      settlementPreviewResult.rows.length === 0
                        ? "not-allowed"
                        : "pointer",
                    fontWeight: 700,
                  }}
                >
                  {settlementWritebackPreviewLoading
                    ? "Validating..."
                    : "Validate Master Lawsuit Writeback Readiness"}
                </button>
              </div>

              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                  Raw settlement preview JSON
                </summary>
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    overflowX: "auto",
                    margin: "6px 0 0 0",
                    padding: 8,
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                >
                  {JSON.stringify(settlementPreviewResult, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {settlementWritebackPreviewResult && (
            <div
              style={{
                padding: 12,
                border: settlementWritebackPreviewResult.ok ? "1px solid #bbf7d0" : "1px solid #fecaca",
                borderRadius: 10,
                background: settlementWritebackPreviewResult.ok ? "#f0fdf4" : "#fef2f2",
                marginBottom: 14,
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 8 }}>
                Master Lawsuit Writeback Readiness Result
              </div>

              {settlementWritebackPreviewResult.error && (
                <div style={{ color: "#991b1b", marginBottom: 8 }}>
                  <strong>Error:</strong> {textValue(settlementWritebackPreviewResult.error)}
                </div>
              )}

              {settlementWritebackPreviewResult.validation && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                    gap: 8,
                    marginBottom: 10,
                    fontSize: 13,
                  }}
                >
                  <div>
                    <strong>Ready to Save:</strong>
                    <br />
                    {settlementWritebackPreviewResult.validation.canWriteIfConfirmed ? "Yes" : "No"}
                  </div>
                  <div>
                    <strong>Rows Checked:</strong>
                    <br />
                    {num(settlementWritebackPreviewResult.count)}
                  </div>
                  <div>
                    <strong>Missing CFVs:</strong>
                    <br />
                    {num(settlementWritebackPreviewResult.validation.missingRequiredFieldCount)}
                  </div>
                  <div>
                    <strong>Master Blocks:</strong>
                    <br />
                    {num(settlementWritebackPreviewResult.validation.masterMatterBlockedCount)}
                  </div>
                  <div>
                    <strong>Invalid Contacts:</strong>
                    <br />
                    {num(settlementWritebackPreviewResult.validation.invalidContactCount)}
                  </div>
                </div>
              )}

              {Array.isArray(settlementWritebackPreviewResult.validation?.blockingErrors) &&
                settlementWritebackPreviewResult.validation.blockingErrors.length > 0 && (
                  <div style={{ color: "#991b1b", marginBottom: 8 }}>
                    <strong>Blocking Errors:</strong>
                    <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                      {settlementWritebackPreviewResult.validation.blockingErrors.map((msg: string) => (
                        <li key={msg}>{msg}</li>
                      ))}
                    </ul>
                  </div>
                )}

              {Array.isArray(settlementWritebackPreviewResult.results) &&
                settlementWritebackPreviewResult.results.length > 0 && (
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      background: "#fff",
                      fontSize: 12,
                      marginTop: 8,
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Matter</th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Ready</th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Settled With</th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Contact Type</th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Master?</th>
                        <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Missing CFVs</th>
                        <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Planned Fields</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settlementWritebackPreviewResult.results.map((row: any) => (
                        <tr key={textValue(row.matterId)}>
                          <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                            {textValue(row.displayNumber) || textValue(row.matterId)}
                          </td>
                          <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                            {row.ok ? "Yes" : "No"}
                          </td>
                          <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                            {textValue(row.settledWithContact?.name) || textValue(row.settledWithContact?.id) || "—"}
                          </td>
                          <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                            {textValue(row.settledWithContact?.type) || "—"}
                          </td>
                          <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                            {row.isMasterMatter ? "Yes" : "No"}
                          </td>
                          <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5, textAlign: "right" }}>
                            {Array.isArray(row.missingRequiredFields)
                              ? row.missingRequiredFields.length
                              : 0}
                          </td>
                          <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5, textAlign: "right" }}>
                            {Array.isArray(row.plannedCustomFieldValues)
                              ? row.plannedCustomFieldValues.length
                              : 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

              <div style={{ marginTop: 8, color: "#475569", fontSize: 12 }}>
                Dry-run only.  No Clio records, database records, documents, or print queue records were changed.
              </div>

              {settlementWritebackPreviewResult?.ok &&
                settlementWritebackPreviewResult?.validation?.canWriteIfConfirmed && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 10,
                      border: "1px solid #f59e0b",
                      borderRadius: 8,
                      background: "#fffbeb",
                    }}
                  >
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>
                      Final Settlement Save
                    </div>
                    <p style={{ margin: "0 0 8px", color: "#92400e", fontSize: 12 }}>
                      This is the explicit final Clio writeback action.  It writes settlement values only to child/bill matters.
                      It does not write settlement financial values to the master matter, generate documents, or change the print queue.
                    </p>
                    <button
                      type="button"
                      onClick={saveSettlementToClio}
                      disabled={settlementWritebackLoading}
                      style={{
                        padding: "8px 12px",
                        border: "1px solid #b45309",
                        background: settlementWritebackLoading ? "#f3f4f6" : "#b45309",
                        color: settlementWritebackLoading ? "#666" : "#fff",
                        borderRadius: 4,
                        cursor: settlementWritebackLoading ? "not-allowed" : "pointer",
                        fontWeight: 800,
                      }}
                    >
                      {settlementWritebackLoading ? "Saving..." : "Save Settlement to Clio"}
                    </button>
                  </div>
                )}

              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                  Raw writeback readiness JSON
                </summary>
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    overflowX: "auto",
                    margin: "6px 0 0 0",
                    padding: 8,
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                >
                  {JSON.stringify(settlementWritebackPreviewResult, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {settlementWritebackResult && (
            <div
              style={{
                padding: 12,
                border: settlementWritebackResult.ok ? "1px solid #bbf7d0" : "1px solid #fecaca",
                borderRadius: 10,
                background: settlementWritebackResult.ok ? "#f0fdf4" : "#fef2f2",
                marginBottom: 14,
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 8 }}>
                Final Settlement Save Result
              </div>

              {settlementWritebackResult.error && (
                <div style={{ color: "#991b1b", marginBottom: 8 }}>
                  <strong>Error:</strong> {textValue(settlementWritebackResult.error)}
                </div>
              )}

              {settlementWritebackResult.ok && (
                <div style={{ color: "#166534", marginBottom: 8 }}>
                  Settlement values were written to Clio for {num(settlementWritebackResult.count)} child/bill matter(s).
                  ClaimIndex was refreshed after writeback.
                </div>
              )}

              {Array.isArray(settlementWritebackResult.results) &&
                settlementWritebackResult.results.length > 0 && (
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      background: "#fff",
                      fontSize: 12,
                      marginTop: 8,
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Matter</th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>OK</th>
                        <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Fields Written</th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>ClaimIndex Refreshed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settlementWritebackResult.results.map((row: any) => (
                        <tr key={textValue(row.matterId)}>
                          <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                            {textValue(row.displayNumber) || textValue(row.matterId)}
                          </td>
                          <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                            {row.ok ? "Yes" : "No"}
                          </td>
                          <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5, textAlign: "right" }}>
                            {num(row.customFieldCount)}
                          </td>
                          <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                            {row.claimIndexRefreshed ? "Yes" : "No"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                  Raw final settlement save JSON
                </summary>
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    overflowX: "auto",
                    margin: "6px 0 0 0",
                    padding: 8,
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                >
                  {JSON.stringify(settlementWritebackResult, null, 2)}
                </pre>
              </details>
            </div>
          )}

          <div
            style={{
              padding: 12,
              border: "1px solid #fef3c7",
              borderRadius: 10,
              background: "#fffbeb",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 10,
              }}
            >
              <div>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>
                  Paid Settlement Close Preview
                </div>
                <div style={{ color: "#92400e", fontSize: 12 }}>
                  Dry-run only.  This previews which child/bill matters may be eligible to be marked closed as PAID (SETTLEMENT) after payment is confirmed.  Settlement agreement or settlement financial writeback alone is not enough to close a matter.  It does not write to Clio, ClaimIndex, documents, or the print queue.
                </div>
              </div>

              <button
                type="button"
                onClick={() => loadSettlementClosePreview()}
                disabled={settlementClosePreviewLoading || !tabMasterLawsuitId}
                style={{
                  padding: "7px 10px",
                  border: "1px solid #b45309",
                  background: settlementClosePreviewLoading || !tabMasterLawsuitId ? "#f3f4f6" : "#b45309",
                  color: settlementClosePreviewLoading || !tabMasterLawsuitId ? "#666" : "#fff",
                  borderRadius: 4,
                  cursor: settlementClosePreviewLoading || !tabMasterLawsuitId ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                {settlementClosePreviewLoading ? "Previewing..." : "Preview Paid Settlement Close"}
              </button>
            </div>

            {settlementClosePreviewResult?.error && (
              <div style={{ color: "#991b1b", fontSize: 13, marginBottom: 8 }}>
                <strong>Error:</strong> {textValue(settlementClosePreviewResult.error)}
              </div>
            )}

            {settlementClosePreviewResult?.validation && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 8,
                  marginBottom: 10,
                  fontSize: 12,
                }}
              >
                <div>
                  <strong>Can Close:</strong>
                  <br />
                  {settlementClosePreviewResult.validation.canCloseIfConfirmed ? "Yes" : "No"}
                </div>
                <div>
                  <strong>Closable:</strong>
                  <br />
                  {num(settlementClosePreviewResult.validation.closableCount)}
                </div>
                <div>
                  <strong>Blocked:</strong>
                  <br />
                  {num(settlementClosePreviewResult.validation.blockedCount)}
                </div>
                <div>
                  <strong>Close Reason:</strong>
                  <br />
                  PAID (SETTLEMENT)
                </div>
              </div>
            )}

            {Array.isArray(settlementClosePreviewResult?.validation?.blockingErrors) &&
              settlementClosePreviewResult.validation.blockingErrors.length > 0 && (
                <div style={{ color: "#92400e", marginBottom: 8, fontSize: 12 }}>
                  <strong>Blocking / Already Final:</strong>
                  <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                    {settlementClosePreviewResult.validation.blockingErrors.map((msg: string) => (
                      <li key={msg}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}

            {Array.isArray(settlementClosePreviewResult?.results) &&
              settlementClosePreviewResult.results.length > 0 && (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    background: "#fff",
                    fontSize: 12,
                    marginTop: 8,
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Matter</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Status</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Master?</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Eligible</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Existing Closed Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlementClosePreviewResult.results.map((row: any) => (
                      <tr key={textValue(row.matterId)}>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                          {textValue(row.displayNumber) || textValue(row.matterId)}
                        </td>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                          {textValue(row.status) || "—"}
                        </td>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                          {row.isMasterMatter ? "Yes" : "No"}
                        </td>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                          {row.canCloseIfConfirmed ? "Yes" : "No"}
                        </td>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                          {textValue(row.existingCloseReasonValue) || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

            <div style={{ marginTop: 8, color: "#92400e", fontSize: 12 }}>
              Preview does not close anything.  Actual closure should occur only after payment is confirmed.  The Close Paid Settlements button requires explicit confirmation and writes back to Clio only for eligible child/bill matters.
            </div>

            {settlementClosePreviewResult?.ok &&
              settlementClosePreviewResult?.validation?.canCloseIfConfirmed && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 10,
                    border: "1px solid #fed7aa",
                    background: "#fff7ed",
                    borderRadius: 6,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => closePaidSettlements()}
                    disabled={settlementCloseWritebackLoading}
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #991b1b",
                      background: settlementCloseWritebackLoading ? "#f3f4f6" : "#991b1b",
                      color: settlementCloseWritebackLoading ? "#666" : "#fff",
                      borderRadius: 4,
                      cursor: settlementCloseWritebackLoading ? "not-allowed" : "pointer",
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {settlementCloseWritebackLoading ? "Closing..." : "Close Paid Settlements"}
                  </button>

                  <div style={{ marginTop: 8, color: "#7f1d1d", fontSize: 12 }}>
                    Use only after payment is confirmed.  This writes Close Reason = PAID (SETTLEMENT) and closes eligible child/bill matters in Clio.  Master matters, already closed matters, final-status matters, documents, and print queue records are not changed.
                  </div>
                </div>
              )}

            {settlementCloseWritebackResult && (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  border: settlementCloseWritebackResult.ok ? "1px solid #bbf7d0" : "1px solid #fecaca",
                  background: settlementCloseWritebackResult.ok ? "#f0fdf4" : "#fef2f2",
                  borderRadius: 6,
                  fontSize: 12,
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 6 }}>
                  Close Paid Settlements Result
                </div>

                {settlementCloseWritebackResult.error && (
                  <div style={{ color: "#991b1b", marginBottom: 6 }}>
                    <strong>Error:</strong> {textValue(settlementCloseWritebackResult.error)}
                  </div>
                )}

                {settlementCloseWritebackResult.ok && (
                  <div style={{ color: "#166534", marginBottom: 6 }}>
                    Closed {num(settlementCloseWritebackResult.closedCount)} paid settlement child/bill matter(s) in Clio.
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                  <div>
                    <strong>Total:</strong>
                    <br />
                    {num(settlementCloseWritebackResult.count)}
                  </div>
                  <div>
                    <strong>Closed:</strong>
                    <br />
                    {num(settlementCloseWritebackResult.closedCount)}
                  </div>
                  <div>
                    <strong>Blocked:</strong>
                    <br />
                    {num(settlementCloseWritebackResult.blockedCount)}
                  </div>
                </div>

                {Array.isArray(settlementCloseWritebackResult?.validation?.blockingErrors) &&
                  settlementCloseWritebackResult.validation.blockingErrors.length > 0 && (
                    <div style={{ color: "#92400e", marginTop: 8 }}>
                      <strong>Blocked / Not Closed:</strong>
                      <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                        {settlementCloseWritebackResult.validation.blockingErrors.map((msg: string) => (
                          <li key={msg}>{msg}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                    Raw Close Paid Settlements JSON
                  </summary>
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      overflowX: "auto",
                      margin: "6px 0 0 0",
                      padding: 8,
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  >
                    {JSON.stringify(settlementCloseWritebackResult, null, 2)}
                  </pre>
                </details>
              </div>
            )}

            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                Raw settlement close preview JSON
              </summary>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  overflowX: "auto",
                  margin: "6px 0 0 0",
                  padding: 8,
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 4,
                  fontSize: 12,
                }}
              >
                {JSON.stringify(settlementClosePreviewResult, null, 2)}
              </pre>
            </details>
          </div>

          <div
            style={{
              padding: 12,
              border: "1px solid #cbd5e1",
              borderRadius: 10,
              background: "#f8fafc",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>
                  Settlement Writeback History
                </div>
                <div style={{ color: "#475569", fontSize: 12 }}>
                  Local audit/history only.  This does not read or change Clio settlement fields.
                </div>
              </div>

              <button
                type="button"
                onClick={() => loadSettlementHistory()}
                disabled={settlementHistoryLoading || !tabMasterLawsuitId}
                style={{
                  padding: "7px 10px",
                  border: "1px solid #2563eb",
                  background: settlementHistoryLoading || !tabMasterLawsuitId ? "#f3f4f6" : "#2563eb",
                  color: settlementHistoryLoading || !tabMasterLawsuitId ? "#666" : "#fff",
                  borderRadius: 4,
                  cursor: settlementHistoryLoading || !tabMasterLawsuitId ? "not-allowed" : "pointer",
                  fontWeight: 700,
                }}
              >
                {settlementHistoryLoading ? "Loading..." : "Refresh Settlement History"}
              </button>
            </div>

            {settlementHistoryResult?.error && (
              <div style={{ marginTop: 10, color: "#991b1b", fontSize: 13 }}>
                <strong>Error:</strong> {textValue(settlementHistoryResult.error)}
              </div>
            )}

            {settlementHistoryResult?.ok &&
              Array.isArray(settlementHistoryResult.rows) &&
              settlementHistoryResult.rows.length > 0 &&
              (() => {
                const latestSettlementRow = settlementHistoryResult.rows[0];
                const latestPreviewRows = Array.isArray(latestSettlementRow.previewSnapshot?.rows)
                  ? latestSettlementRow.previewSnapshot.rows
                  : [];
                const latestWriteRows = Array.isArray(latestSettlementRow.writeResults)
                  ? latestSettlementRow.writeResults
                  : [];
                const latestReadinessRows = Array.isArray(latestSettlementRow.readinessSnapshot?.results)
                  ? latestSettlementRow.readinessSnapshot.results
                  : [];
                const latestReadinessContact = latestReadinessRows.find((r: any) => r?.settledWithContact)?.settledWithContact;

                return (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 10,
                      border: "1px solid #bfdbfe",
                      borderRadius: 8,
                      background: "#eff6ff",
                      fontSize: 13,
                    }}
                  >
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>
                      Latest Written Settlement Snapshot
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                        gap: 8,
                      }}
                    >
                      <div>
                        <strong>Audit Status:</strong>
                        <br />
                        {textValue(latestSettlementRow.status) || "—"}
                      </div>
                      <div>
                        <strong>Settled With:</strong>
                        <br />
                        {textValue(latestReadinessContact?.name) ||
                          textValue(latestSettlementRow.settledWith) ||
                          "—"}
                      </div>
                      <div>
                        <strong>Contact ID / Type:</strong>
                        <br />
                        {textValue(latestReadinessContact?.id) || "—"}
                        {textValue(latestReadinessContact?.type)
                          ? ` / ${textValue(latestReadinessContact.type)}`
                          : ""}
                      </div>
                      <div>
                        <strong>Finalized:</strong>
                        <br />
                        {latestSettlementRow.finalizedAt
                          ? new Date(latestSettlementRow.finalizedAt).toLocaleString()
                          : "—"}
                      </div>
                      <div>
                        <strong>Gross:</strong>
                        <br />
                        {latestSettlementRow.grossSettlement == null
                          ? "—"
                          : money(latestSettlementRow.grossSettlement)}
                      </div>
                      <div>
                        <strong>Preview Rows:</strong>
                        <br />
                        {num(latestPreviewRows.length)}
                      </div>
                      <div>
                        <strong>Write Results:</strong>
                        <br />
                        {num(latestWriteRows.length)}
                      </div>
                      <div>
                        <strong>Source:</strong>
                        <br />
                        Local settlement audit/history plus saved readiness snapshot
                      </div>
                    </div>
                  </div>
                );
              })()}

            {settlementHistoryLoading && !settlementHistoryResult && (
              <div style={{ marginTop: 10, color: "#475569", fontSize: 13 }}>
                Loading settlement history...
              </div>
            )}

            {settlementHistoryResult?.ok &&
              Array.isArray(settlementHistoryResult.rows) &&
              settlementHistoryResult.rows.length === 0 && (
                <div style={{ marginTop: 10, color: "#475569", fontSize: 13 }}>
                  No settlement writeback history recorded yet.
                </div>
              )}

            {settlementHistoryResult?.ok &&
              Array.isArray(settlementHistoryResult.rows) &&
              settlementHistoryResult.rows.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {settlementHistoryResult.rows.map((row: any) => {
                    const rowKey = textValue(row.id);
                    const isExpanded = expandedSettlementHistoryId === rowKey;
                    const childMatterIds = Array.isArray(row.childMatterIds) ? row.childMatterIds : [];

                    return (
                      <div
                        key={rowKey}
                        style={{
                          marginBottom: 10,
                          padding: 10,
                          background: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            alignItems: "flex-start",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 800 }}>
                              {row.finalizedAt
                                ? new Date(row.finalizedAt).toLocaleString()
                                : "Unknown date"}
                            </div>
                            <div style={{ color: "#475569", fontSize: 13, marginTop: 2 }}>
                              Audit ID {rowKey} · Status {textValue(row.status) || "unknown"} ·
                              {row.noWritePerformed ? " No Clio write" : " Clio write attempted"} ·
                              Child matters: {childMatterIds.length}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setExpandedSettlementHistoryId(isExpanded ? null : rowKey)
                            }
                            style={{
                              fontSize: 12,
                              padding: "4px 9px",
                              border: "1px solid #94a3b8",
                              borderRadius: 4,
                              background: isExpanded ? "#e2e8f0" : "#fff",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {isExpanded ? "Hide Details" : "Details"}
                          </button>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                            gap: 8,
                            marginTop: 8,
                            fontSize: 12,
                          }}
                        >
                          <div>
                            <strong>Gross:</strong>
                            <br />
                            {row.grossSettlement == null ? "—" : money(row.grossSettlement)}
                          </div>
                          <div>
                            <strong>Settled With:</strong>
                            <br />
                            {textValue(row.readinessSnapshot?.results?.[0]?.settledWithContact?.name) ||
                              textValue(row.settledWith) ||
                              "—"}
                          </div>
                          <div>
                            <strong>Contact ID / Type:</strong>
                            <br />
                            {textValue(row.readinessSnapshot?.results?.[0]?.settledWithContact?.id) || "—"}
                            {textValue(row.readinessSnapshot?.results?.[0]?.settledWithContact?.type)
                              ? ` / ${textValue(row.readinessSnapshot.results[0].settledWithContact.type)}`
                              : ""}
                          </div>
                          <div>
                            <strong>No Write:</strong>
                            <br />
                            {row.noWritePerformed ? "Yes" : "No"}
                          </div>
                          <div>
                            <strong>Error:</strong>
                            <br />
                            {textValue(row.error) || "—"}
                          </div>
                        </div>

                        {isExpanded && (
                          <div
                            style={{
                              marginTop: 10,
                              padding: 10,
                              background: "#f8fafc",
                              border: "1px solid #cbd5e1",
                              borderRadius: 4,
                              fontSize: 12,
                            }}
                          >
                            <details style={{ marginBottom: 6 }}>
                              <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                                Raw preview snapshot JSON
                              </summary>
                              <pre
                                style={{
                                  whiteSpace: "pre-wrap",
                                  overflowX: "auto",
                                  margin: "6px 0 0 0",
                                  padding: 8,
                                  background: "#fff",
                                  border: "1px solid #e5e7eb",
                                  borderRadius: 4,
                                }}
                              >
                                {JSON.stringify(row.previewSnapshot, null, 2)}
                              </pre>
                            </details>

                            <details style={{ marginBottom: 6 }}>
                              <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                                Raw readiness snapshot JSON
                              </summary>
                              <pre
                                style={{
                                  whiteSpace: "pre-wrap",
                                  overflowX: "auto",
                                  margin: "6px 0 0 0",
                                  padding: 8,
                                  background: "#fff",
                                  border: "1px solid #e5e7eb",
                                  borderRadius: 4,
                                }}
                              >
                                {JSON.stringify(row.readinessSnapshot, null, 2)}
                              </pre>
                            </details>

                            <details>
                              <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                                Raw write results JSON
                              </summary>
                              <pre
                                style={{
                                  whiteSpace: "pre-wrap",
                                  overflowX: "auto",
                                  margin: "6px 0 0 0",
                                  padding: 8,
                                  background: "#fff",
                                  border: "1px solid #e5e7eb",
                                  borderRadius: 4,
                                }}
                              >
                                {JSON.stringify(row.writeResults, null, 2)}
                              </pre>
                            </details>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
          </div>

          <div
            style={{
              padding: 10,
              background: "#f8fafc",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              color: "#475569",
              fontSize: 13,
            }}
          >
            Settlement writebacks now create local audit/history records.  Final save still requires preview, readiness validation, and explicit confirmation, and writes only child/bill matters.
          </div>
        </section>
      )}

      {activeWorkspaceTab === "print_queue" && (
        <section style={tabPlaceholderPanelStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ marginTop: 0, marginBottom: 6 }}>Matter-Level Print Queue</h2>
              <p style={tabPlaceholderTextStyle}>
                Local print queue workflow for this lawsuit.  Status controls update only local print queue records;
                they do not change Clio, upload documents, create folders, or modify document contents.
              </p>
            </div>

            <a
              href="/print-queue"
              style={{
                padding: "8px 12px",
                border: "1px solid #94a3b8",
                background: "#fff",
                color: "#0f172a",
                borderRadius: 4,
                textDecoration: "none",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              Open Global Daily Print Queue
            </a>
          </div>

          {!tabMasterLawsuitId ? (
            <div style={{ marginTop: 12, color: "#475569" }}>
              No MASTER_LAWSUIT_ID is available yet.  Generate or connect a lawsuit before loading matter-level print queue records.
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginTop: 14,
                  marginBottom: 12,
                }}
              >
                <button
                  type="button"
                  onClick={() => loadPrintQueuePreview(tabMasterLawsuitId)}
                  disabled={printQueuePreviewLoading}
                  style={{
                    padding: "7px 10px",
                    border: "1px solid #0f766e",
                    background: printQueuePreviewLoading ? "#f3f4f6" : "#0f766e",
                    color: printQueuePreviewLoading ? "#666" : "#fff",
                    borderRadius: 4,
                    cursor: printQueuePreviewLoading ? "not-allowed" : "pointer",
                    fontWeight: 700,
                  }}
                >
                  {printQueuePreviewLoading ? "Loading..." : "Refresh Print Preview"}
                </button>

                <button
                  type="button"
                  onClick={() => loadPrintQueueList(tabMasterLawsuitId)}
                  disabled={printQueueListLoading}
                  style={{
                    padding: "7px 10px",
                    border: "1px solid #2563eb",
                    background: printQueueListLoading ? "#f3f4f6" : "#2563eb",
                    color: printQueueListLoading ? "#666" : "#fff",
                    borderRadius: 4,
                    cursor: printQueueListLoading ? "not-allowed" : "pointer",
                    fontWeight: 700,
                  }}
                >
                  {printQueueListLoading ? "Loading..." : "Refresh Queue List"}
                </button>

                <button
                  type="button"
                  onClick={() => addVerifiedCandidatesToPrintQueue(tabMasterLawsuitId)}
                  disabled={
                    printQueueAddLoading ||
                    !printQueuePreview?.ok ||
                    !Array.isArray(printQueuePreview?.candidateDocuments) ||
                    printQueuePreview.candidateDocuments.length === 0
                  }
                  style={{
                    padding: "7px 10px",
                    border: "1px solid #b45309",
                    background:
                      printQueueAddLoading ||
                      !printQueuePreview?.ok ||
                      !Array.isArray(printQueuePreview?.candidateDocuments) ||
                      printQueuePreview.candidateDocuments.length === 0
                        ? "#f3f4f6"
                        : "#b45309",
                    color:
                      printQueueAddLoading ||
                      !printQueuePreview?.ok ||
                      !Array.isArray(printQueuePreview?.candidateDocuments) ||
                      printQueuePreview.candidateDocuments.length === 0
                        ? "#666"
                        : "#fff",
                    borderRadius: 4,
                    cursor:
                      printQueueAddLoading ||
                      !printQueuePreview?.ok ||
                      !Array.isArray(printQueuePreview?.candidateDocuments) ||
                      printQueuePreview.candidateDocuments.length === 0
                        ? "not-allowed"
                        : "pointer",
                    fontWeight: 700,
                  }}
                >
                  {printQueueAddLoading ? "Adding..." : "Add Verified Candidates"}
                </button>
              </div>

              {printQueueStatusResult && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: 10,
                    background: printQueueStatusResult.ok ? "#f0fdf4" : "#fef2f2",
                    border: `1px solid ${printQueueStatusResult.ok ? "#bbf7d0" : "#fecaca"}`,
                    borderRadius: 4,
                    color: printQueueStatusResult.ok ? "#166534" : "#991b1b",
                  }}
                >
                  {printQueueStatusResult.ok ? (
                    <>Print queue status updated to {textValue(printQueueStatusResult.status) || "—"}.</>
                  ) : (
                    <>
                      <strong>Error:</strong> {textValue(printQueueStatusResult.error)}
                    </>
                  )}
                </div>
              )}

              {printQueueList?.ok && (
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  {([
                    ["", "All", "all"],
                    ["queued", "Queued", "queued"],
                    ["printed", "Printed", "printed"],
                    ["hold", "Hold", "hold"],
                    ["skipped", "Skipped", "skipped"],
                  ] as const).map(([value, label, countKey]) => {
                    const active = printQueueStatusFilter === value;
                    const count = num(printQueueList?.statusCounts?.[countKey]);

                    return (
                      <button
                        key={countKey}
                        type="button"
                        onClick={() => changePrintQueueStatusFilter(value)}
                        disabled={printQueueListLoading}
                        style={{
                          fontSize: 12,
                          padding: "4px 9px",
                          border: `1px solid ${active ? "#0f172a" : "#94a3b8"}`,
                          borderRadius: 999,
                          background: active ? "#e2e8f0" : "#fff",
                          cursor: printQueueListLoading ? "not-allowed" : "pointer",
                          fontWeight: active ? 800 : 500,
                        }}
                      >
                        {label}: {count}
                      </button>
                    );
                  })}
                </div>
              )}

              {printQueueListLoading && !printQueueList && (
                <div style={{ color: "#475569" }}>Loading print queue...</div>
              )}

              {printQueueList?.error && (
                <div style={{ color: "#991b1b", marginBottom: 10 }}>
                  <strong>Error:</strong> {textValue(printQueueList.error)}
                </div>
              )}

              {printQueueList?.ok && num(printQueueList.count) === 0 && (
                <div style={{ color: "#475569", marginBottom: 10 }}>
                  {printQueueStatusFilter
                    ? `No print queue items currently match status "${printQueueStatusFilter}" for this lawsuit.`
                    : "No documents are currently queued for printing for this lawsuit."}
                </div>
              )}

              {printQueueList?.ok && Array.isArray(printQueueList.rows) && printQueueList.rows.length > 0 && (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    background: "#fff",
                    fontSize: 12,
                    marginBottom: 14,
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Document</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Filename</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Status</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Clio Document ID</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 5 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printQueueList.rows.map((row: any) => (
                      <tr key={textValue(row.id)}>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                          {textValue(row.documentLabel) || textValue(row.documentKey) || "—"}
                        </td>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                          {textValue(row.filename) || "—"}
                        </td>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                          {textValue(row.status) || "—"}
                        </td>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                          {textValue(row.clioDocumentId) || "—"}
                        </td>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 5 }}>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {(["queued", "printed", "hold", "skipped"] as const).map((statusOption) => (
                              <button
                                key={statusOption}
                                type="button"
                                onClick={() => updatePrintQueueStatus(row, statusOption)}
                                disabled={
                                  printQueueStatusLoadingId === num(row.id) ||
                                  textValue(row.status) === statusOption
                                }
                                style={{
                                  fontSize: 11,
                                  padding: "2px 6px",
                                  border: "1px solid #94a3b8",
                                  borderRadius: 4,
                                  background:
                                    textValue(row.status) === statusOption ? "#e2e8f0" : "#fff",
                                  cursor:
                                    printQueueStatusLoadingId === num(row.id) ||
                                    textValue(row.status) === statusOption
                                      ? "not-allowed"
                                      : "pointer",
                                }}
                              >
                                {statusOption}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {printQueuePreview?.error && (
                <div style={{ color: "#991b1b", marginBottom: 10 }}>
                  <strong>Error:</strong> {textValue(printQueuePreview.error)}
                </div>
              )}

              {printQueuePreviewLoading && !printQueuePreview && (
                <div style={{ color: "#475569" }}>Loading print candidates...</div>
              )}

              {printQueuePreview?.ok && num(printQueuePreview.candidateDocumentCount) === 0 && (
                <div style={{ color: "#475569" }}>
                  No verified print candidates are available yet.  Finalize documents before adding them to the print queue.
                </div>
              )}

              {printQueuePreview?.ok &&
                Array.isArray(printQueuePreview.candidateDocuments) &&
                printQueuePreview.candidateDocuments.length > 0 && (
                  <div
                    style={{
                      padding: 10,
                      background: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>
                      Verified Print Candidates: {num(printQueuePreview.candidateDocumentCount)}
                    </div>
                    <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                      {printQueuePreview.candidateDocuments.map((doc: any, index: number) => (
                        <li key={`${textValue(doc.documentKey)}-${index}`}>
                          <strong>{textValue(doc.documentLabel) || textValue(doc.documentKey)}:</strong>{" "}
                          {textValue(doc.filename) || "—"}
                          {doc.alreadyQueued ? " — already queued" : ""}
                        </li>
                      ))}
                    </ul>
                    <div style={{ marginTop: 8, color: "#475569" }}>
                      These are proposed print candidates only.  Each listed document has been verified against the current Clio master matter Documents tab.
                    </div>
                  </div>
                )}
            </>
          )}
        </section>
      )}

      {activeWorkspaceTab === "audit_history" && (
        <section id="matter-audit-history-section" style={tabPlaceholderPanelStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ marginTop: 0, marginBottom: 6 }}>Matter-Level Audit / History</h2>
              <p style={tabPlaceholderTextStyle}>
                Persistent local database audit entries for this matter and, when applicable, its master lawsuit context.  These records do not replace Clio as the source of truth.
              </p>
            </div>

            <button
              type="button"
              onClick={loadMatterAuditHistory}
              disabled={matterAuditHistoryLoading}
              style={{
                padding: "7px 10px",
                border: "1px solid #2563eb",
                background: matterAuditHistoryLoading ? "#f3f4f6" : "#2563eb",
                color: matterAuditHistoryLoading ? "#666" : "#fff",
                borderRadius: 4,
                cursor: matterAuditHistoryLoading ? "not-allowed" : "pointer",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              {matterAuditHistoryLoading ? "Loading..." : "Refresh Audit Log"}
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 10,
              marginTop: 14,
              marginBottom: 14,
            }}
          >
            <div style={bmStatCardStyle}>
              <div style={{ fontSize: 11, fontWeight: 900, color: bmColors.subtle, textTransform: "uppercase" }}>Matter</div>
              <div style={{ marginTop: 4, fontSize: 14, fontWeight: 900, color: bmColors.ink }}>
                {textValue(matter?.displayNumber || matter?.display_number) || matterId || "—"}
              </div>
            </div>

            <div style={bmStatCardStyle}>
              <div style={{ fontSize: 11, fontWeight: 900, color: bmColors.subtle, textTransform: "uppercase" }}>Matter ID</div>
              <div style={{ marginTop: 4, fontSize: 14, fontWeight: 900, color: bmColors.ink }}>
                {matterId || "—"}
              </div>
            </div>

            <div style={bmStatCardStyle}>
              <div style={{ fontSize: 11, fontWeight: 900, color: bmColors.subtle, textTransform: "uppercase" }}>Master Lawsuit</div>
              <div style={{ marginTop: 4, fontSize: 14, fontWeight: 900, color: bmColors.ink }}>
                {textValue(matter?.masterLawsuitId || matter?.master_lawsuit_id) || "—"}
              </div>
            </div>

            <div style={bmStatCardStyle}>
              <div style={{ fontSize: 11, fontWeight: 900, color: bmColors.subtle, textTransform: "uppercase" }}>Entries</div>
              <div style={{ marginTop: 4, fontSize: 14, fontWeight: 900, color: bmColors.ink }}>
                {Array.isArray(matterAuditHistoryResult?.entries) ? matterAuditHistoryResult.entries.length : 0}
              </div>
            </div>
          </div>

          {matterAuditHistoryResult?.error && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 12,
                border: "1px solid #fecaca",
                background: "#fef2f2",
                color: "#991b1b",
                fontWeight: 800,
              }}
            >
              {textValue(matterAuditHistoryResult.error)}
            </div>
          )}

          {matterAuditHistoryLoading && !matterAuditHistoryResult && (
            <div style={{ marginTop: 12, color: bmColors.muted }}>
              Loading matter audit history...
            </div>
          )}

          {matterAuditHistoryResult?.ok &&
            Array.isArray(matterAuditHistoryResult.entries) &&
            matterAuditHistoryResult.entries.length === 0 && (
              <div style={{ marginTop: 12, color: bmColors.muted }}>
                No matter-specific audit entries found yet.
              </div>
            )}

          {matterAuditHistoryResult?.ok &&
            Array.isArray(matterAuditHistoryResult.entries) &&
            matterAuditHistoryResult.entries.length > 0 && (
              <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
                {matterAuditHistoryResult.entries.map((entry: any) => {
                  const rowKey = textValue(entry.id);
                  const isExpanded = expandedMatterAuditEntryId === rowKey;

                  return (
                    <article
                      key={rowKey}
                      style={{
                        display: "grid",
                        gap: 10,
                        padding: 14,
                        borderRadius: 16,
                        border: "1px solid " + bmColors.line,
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
                          <div style={{ fontSize: 15, fontWeight: 950, color: bmColors.ink }}>
                            {textValue(entry.summary) || textValue(entry.action) || "Audit entry"}
                          </div>
                          <div style={{ marginTop: 4, fontSize: 12, color: bmColors.subtle, fontWeight: 750 }}>
                            {formatMatterAuditTimestamp(entry.createdAt)} · {textValue(entry.actorName || entry.actorEmail) || "Unknown user"} · {textValue(entry.sourcePage) || "unknown source"}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setExpandedMatterAuditEntryId(isExpanded ? null : rowKey)}
                          style={{
                            fontSize: 12,
                            padding: "5px 9px",
                            border: "1px solid #94a3b8",
                            borderRadius: 999,
                            background: isExpanded ? "#e2e8f0" : "#fff",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            fontWeight: 800,
                          }}
                        >
                          {isExpanded ? "Hide Details" : "Details"}
                        </button>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                          gap: 10,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 11, color: bmColors.subtle, fontWeight: 900, textTransform: "uppercase" }}>Action</div>
                          <div style={{ marginTop: 3, fontSize: 13, fontWeight: 850, color: bmColors.ink }}>{textValue(entry.action) || "—"}</div>
                        </div>

                        <div>
                          <div style={{ fontSize: 11, color: bmColors.subtle, fontWeight: 900, textTransform: "uppercase" }}>Field</div>
                          <div style={{ marginTop: 3, fontSize: 13, fontWeight: 850, color: bmColors.ink }}>{textValue(entry.fieldName) || "—"}</div>
                        </div>

                        <div>
                          <div style={{ fontSize: 11, color: bmColors.subtle, fontWeight: 900, textTransform: "uppercase" }}>Prior Value</div>
                          <div style={{ marginTop: 3, fontSize: 13, fontWeight: 850, color: bmColors.ink, overflowWrap: "anywhere" }}>{formatMatterAuditValue(entry.priorValue)}</div>
                        </div>

                        <div>
                          <div style={{ fontSize: 11, color: bmColors.subtle, fontWeight: 900, textTransform: "uppercase" }}>New Value</div>
                          <div style={{ marginTop: 3, fontSize: 13, fontWeight: 850, color: bmColors.ink, overflowWrap: "anywhere" }}>{formatMatterAuditValue(entry.newValue)}</div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div
                          style={{
                            padding: 10,
                            borderRadius: 12,
                            border: "1px solid " + bmColors.softLine,
                            background: bmColors.page,
                            fontSize: 12,
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                              gap: 8,
                              marginBottom: 10,
                            }}
                          >
                            <div>
                              <strong>Matter:</strong>
                              <br />
                              {textValue(entry.matterDisplayNumber) || textValue(entry.matterId) || "—"}
                            </div>
                            <div>
                              <strong>Master Matter:</strong>
                              <br />
                              {textValue(entry.masterMatterDisplayNumber) || textValue(entry.masterMatterId) || "—"}
                            </div>
                            <div>
                              <strong>Master Lawsuit:</strong>
                              <br />
                              {textValue(entry.masterLawsuitId) || "—"}
                            </div>
                            <div>
                              <strong>Workflow:</strong>
                              <br />
                              {textValue(entry.workflow) || "—"}
                            </div>
                          </div>

                          {Array.isArray(entry.affectedMatterIds) && entry.affectedMatterIds.length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                              <strong>Affected matter IDs:</strong> {entry.affectedMatterIds.join(", ")}
                            </div>
                          )}

                          <details>
                            <summary style={{ cursor: "pointer", fontWeight: 800 }}>
                              Raw audit entry JSON
                            </summary>
                            <pre
                              style={{
                                whiteSpace: "pre-wrap",
                                overflowX: "auto",
                                margin: "6px 0 0 0",
                                padding: 8,
                                background: "#ffffff",
                                border: "1px solid " + bmColors.softLine,
                                borderRadius: 4,
                              }}
                            >
                              {JSON.stringify(entry, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
        </section>
      )}


      {activeWorkspaceTab !== "settlement" && (
        <>
          <hr style={{ margin: "18px 0 20px 0", border: 0, borderTop: "1px solid #999"  }} />

          {activeWorkspaceTab === "documents" && alreadyAggregated && (
        <section
          style={{
            border: "1px solid #bfbfbf",
            borderRadius: 6,
            padding: 14,
            marginBottom: 16,
            background: "#fbfbfb",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: packetPreviewOpen && packetPreview?.packet ? 12 : 0,
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>
                Document Packet Preview
              </div>
              <div style={{ fontSize: 13, color: "#555", marginTop: 3 }}>
                Read-only packet data for MASTER LAWSUIT ID {textValue(packetPreview?.packet?.masterLawsuitId) || textValue(matter?.masterLawsuitId)}.
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                onClick={openMetadataModal}
                disabled={packetLoading}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #4b5563",
                  background: packetLoading ? "#f3f4f6" : "#4b5563",
                  color: packetLoading ? "#666" : "#fff",
                  borderRadius: 4,
                  cursor: packetLoading ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                Edit Lawsuit Metadata
              </button>

              <button
                onClick={loadPacketPreview}
                disabled={packetLoading}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #2563eb",
                  background: packetLoading ? "#f3f4f6" : "#2563eb",
                  color: packetLoading ? "#666" : "#fff",
                  borderRadius: 4,
                  cursor: packetLoading ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                {packetLoading
                  ? "Loading..."
                  : packetPreviewOpen
                  ? "Refresh Packet Preview"
                  : "Load Packet Preview"}
              </button>
            </div>
          </div>

          {packetPreviewOpen && packetPreview?.packet && (
            <div
              style={{
                borderTop: "1px solid #ddd",
                paddingTop: 12,
                fontSize: 13,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <div>
                  <strong>Master Matter:</strong>
                  <br />
                  {packetPreview.packet.masterMatter?.matterId ? (
                    <a
                      href={clioMatterUrl(packetPreview.packet.masterMatter.matterId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "#2563eb",
                        fontWeight: 700,
                        textDecoration: "underline",
                      }}
                    >
                      {textValue(packetPreview.packet.masterMatter.displayNumber) || "Open in Clio"}
                    </a>
                  ) : (
                    "—"
                  )}
                </div>
                <div>
                  <strong>Venue:</strong>
                  <br />
                  {textValue(packetPreview.packet.metadata?.venue?.value) || "—"}
                </div>
                <div>
                  <strong>Amount Sought:</strong>
                  <br />
                  {money(packetAmountSoughtValue(packetPreview.packet))}
                  {" "}
                  ({packetAmountSoughtModeValue(packetPreview.packet)})
                </div>
                <div>
                  <strong>Index / AAA:</strong>
                  <br />
                  {textValue(packetPreview.packet.metadata?.indexAaaNumber?.value) || "—"}
                </div>
                <div>
                  <strong>Can Generate:</strong>
                  <br />
                  {packetPreview.packet.validation?.canGenerate ? "Yes" : "No"}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <div>
                  <strong>Provider:</strong>
                  <br />
                  {textValue(packetPreview.packet.metadata?.provider?.value) || "—"}
                </div>
                <div>
                  <strong>Patient:</strong>
                  <br />
                  {textValue(packetPreview.packet.metadata?.patient?.value) || "—"}
                </div>
                <div>
                  <strong>Insurer:</strong>
                  <br />
                  {textValue(packetPreview.packet.metadata?.insurer?.value) || "—"}
                </div>
                <div>
                  <strong>Claim:</strong>
                  <br />
                  {textValue(packetPreview.packet.metadata?.claimNumber?.value) || "—"}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                  gap: 10,
                  marginBottom: 12,
                  padding: 10,
                  background: "#fff",
                  border: "1px solid #ddd",
                  borderRadius: 4,
                }}
              >
                <div>
                  <strong>Bills:</strong>
                  <br />
                  {num(packetPreview.packet.totals?.billCount)}
                </div>
                <div>
                  <strong>Claim Total:</strong>
                  <br />
                  {money(packetPreview.packet.totals?.claimAmountTotal)}
                </div>
                <div>
                  <strong>Voluntary Paid:</strong>
                  <br />
                  {money(packetPreview.packet.totals?.paymentVoluntaryTotal)}
                </div>
                <div>
                  <strong>Balance Presuit:</strong>
                  <br />
                  {money(packetPreview.packet.totals?.balancePresuitTotal)}
                </div>
                <div>
                  <strong>Balance:</strong>
                  <br />
                  {money(packetPreview.packet.totals?.balanceAmountTotal)}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginBottom: 10,
                  flexWrap: "wrap",
                }}
              >
                <a
                  href="/print-queue"
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #94a3b8",
                    background: "#fff",
                    color: "#0f172a",
                    borderRadius: 4,
                    textDecoration: "none",
                    fontWeight: 700,
                  }}
                >
                  Daily Print Queue
                </a>

                <button
                  onClick={loadDocumentGenerationPreview}
                  disabled={documentPreviewLoading}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #7c3aed",
                    background: documentPreviewLoading ? "#f3f4f6" : "#7c3aed",
                    color: documentPreviewLoading ? "#666" : "#fff",
                    borderRadius: 4,
                    cursor: documentPreviewLoading ? "not-allowed" : "pointer",
                    fontWeight: 700,
                  }}
                >
                  {documentPreviewLoading ? "Checking..." : "Generate Documents Preview"}
                </button>

                <button
                  onClick={loadFinalizePreview}
                  disabled={documentPreviewLoading || finalizeUploadLoading}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #9333ea",
                    background: documentPreviewLoading ? "#f3f4f6" : "#9333ea",
                    color: documentPreviewLoading ? "#666" : "#fff",
                    borderRadius: 4,
                    cursor: documentPreviewLoading ? "not-allowed" : "pointer",
                    fontWeight: 700,
                  }}
                >
                  {documentPreviewLoading ? "Checking..." : "Finalize Documents Preview"}
                </button>

                <button
                  onClick={uploadFinalDocumentsToClio}
                  disabled={
                    documentPreviewLoading ||
                    finalizeUploadLoading ||
                    documentPreview?.action !== "finalize-preview" ||
                    !documentPreview?.ok
                  }
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #b45309",
                    background:
                      documentPreviewLoading ||
                      finalizeUploadLoading ||
                      documentPreview?.action !== "finalize-preview" ||
                      !documentPreview?.ok
                        ? "#f3f4f6"
                        : "#b45309",
                    color:
                      documentPreviewLoading ||
                      finalizeUploadLoading ||
                      documentPreview?.action !== "finalize-preview" ||
                      !documentPreview?.ok
                        ? "#666"
                        : "#fff",
                    borderRadius: 4,
                    cursor:
                      documentPreviewLoading ||
                      finalizeUploadLoading ||
                      documentPreview?.action !== "finalize-preview" ||
                      !documentPreview?.ok
                        ? "not-allowed"
                        : "pointer",
                    fontWeight: 700,
                  }}
                  title="Requires a successful Finalize Documents Preview first."
                >
                  {finalizeUploadLoading ? "Uploading..." : "Upload Final Documents to Clio"}
                </button>

                <button
                  onClick={downloadBillScheduleDocx}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #0f766e",
                    background: "#0f766e",
                    color: "#fff",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Download Bill Schedule
                </button>

                <button
                  onClick={downloadPacketSummaryDocx}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #0369a1",
                    background: "#0369a1",
                    color: "#fff",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Download Packet Summary
                </button>

                <button
                  onClick={downloadSummonsComplaintDocx}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #7c3aed",
                    background: "#7c3aed",
                    color: "#fff",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Download Summons and Complaint
                </button>

                <button
                  onClick={copyFilingDemandSummary}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #047857",
                    background: "#047857",
                    color: "#fff",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Copy Filing / Demand Summary
                </button>

                <button
                  onClick={copyPacketSummary}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #111827",
                    background: "#111827",
                    color: "#fff",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Copy Packet Summary
                </button>
              </div>

              {documentPreview && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: 10,
                    background: documentPreview.ok ? "#ecfdf5" : "#fef2f2",
                    border: documentPreview.ok
                      ? "1px solid #10b981"
                      : "1px solid #dc2626",
                    borderRadius: 4,
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>
                    {documentPreview.action === "finalize-preview"
                      ? "Finalize Documents Preview"
                      : "Document Generation Preview"}
                  </div>

                  {documentPreview.action === "finalize-preview" ? (
                    <>
                      <div style={{ marginBottom: 6 }}>
                        <strong>Clio Upload Target:</strong>{" "}
                        {textValue(documentPreview.clioUploadTarget?.displayNumber) || "—"}
                        {documentPreview.clioUploadTarget?.matterId
                          ? ` / Matter ID ${documentPreview.clioUploadTarget.matterId}`
                          : ""}
                      </div>

                      <div style={{ marginBottom: 6 }}>
                        <strong>Upload Destination:</strong>{" "}
                        {textValue(documentPreview.clioUploadTarget?.type) || "—"}
                      </div>
                    </>
                  ) : (
                    <div style={{ marginBottom: 6 }}>
                      <strong>Output Folder:</strong>{" "}
                      {textValue(documentPreview.folderPath) || "—"}
                    </div>
                  )}

                  <div style={{ marginBottom: 6 }}>
                    <strong>Status:</strong>{" "}
                    {documentPreview.ok ? "Ready" : "Blocked"}
                  </div>

                  {Array.isArray(documentPreview.plannedDocuments) &&
                    documentPreview.plannedDocuments.length > 0 && (
                      <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                        {documentPreview.plannedDocuments.map((doc: any) => (
                          <li key={textValue(doc.key) || textValue(doc.filename)}>
                            <strong>{textValue(doc.label)}:</strong>{" "}
                            {textValue(doc.filename)}
                            {textValue(doc.status) ? ` — ${textValue(doc.status)}` : ""}
                            {doc.alreadyUploadedToClio ? (
                              <span style={{ color: "#b45309", fontWeight: 700 }}>
                                {" "}— already uploaded to Clio
                              </span>
                            ) : null}
                            {Array.isArray(doc.existingClioDocuments) &&
                            doc.existingClioDocuments.length > 0 ? (
                              <ul style={{ margin: "4px 0 4px 18px", padding: 0 }}>
                                {doc.existingClioDocuments.map((existing: any) => (
                                  <li key={textValue(existing.id)}>
                                    Existing Clio Document ID {textValue(existing.id)}
                                    {textValue(existing.latestDocumentVersion?.receivedAt)
                                      ? ` — received ${textValue(existing.latestDocumentVersion.receivedAt)}`
                                      : ""}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}

                  {documentPreview.action === "finalize-preview" && documentPreview.ok && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 8,
                        background:
                          documentPreview.existingDocumentCheck?.matchCount > 0
                            ? "#fef2f2"
                            : "#fffbeb",
                        border:
                          documentPreview.existingDocumentCheck?.matchCount > 0
                            ? "1px solid #dc2626"
                            : "1px solid #f59e0b",
                        borderRadius: 4,
                        color:
                          documentPreview.existingDocumentCheck?.matchCount > 0
                            ? "#991b1b"
                            : "#92400e",
                        fontSize: 12,
                      }}
                    >
                      <strong>
                        {documentPreview.existingDocumentCheck?.matchCount > 0
                          ? "Existing Clio document warning:"
                          : "Final upload is explicit:"}
                      </strong>{" "}
                      {documentPreview.existingDocumentCheck?.matchCount > 0
                        ? "one or more planned final documents already exists in the Clio master matter Documents tab.  The upload endpoint skips exact filename matches by default to prevent duplicates."
                        : "click Upload Final Documents to Clio only when these are the final print-ready copies.  Repeating the action may create duplicate documents in Clio."}
                    </div>
                  )}

                  <div style={{ marginTop: 8, color: "#555", fontSize: 12 }}>
                    {textValue(documentPreview.note) ||
                      "Dry run only.  No files were created, no Clio records were changed, and no database records were changed."}
                  </div>
                </div>
              )}

              {finalizeUploadResult && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: 10,
                    background: finalizeUploadResult.ok ? "#ecfdf5" : "#fef2f2",
                    border: finalizeUploadResult.ok
                      ? "1px solid #10b981"
                      : "1px solid #dc2626",
                    borderRadius: 4,
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>
                    Final Upload Result
                  </div>

                  <div style={{ marginBottom: 6 }}>
                    <strong>Status:</strong>{" "}
                    {finalizeUploadResult.ok ? "Uploaded to Clio" : "Failed"}
                  </div>

                  {textValue(finalizeUploadResult.error) && (
                    <div style={{ marginBottom: 6, color: "#991b1b" }}>
                      <strong>Error:</strong> {textValue(finalizeUploadResult.error)}
                    </div>
                  )}

                  {Array.isArray(finalizeUploadResult.uploaded) &&
                    finalizeUploadResult.uploaded.length > 0 && (
                      <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                        {finalizeUploadResult.uploaded.map((doc: any) => (
                          <li key={textValue(doc.clioDocumentId) || textValue(doc.filename)}>
                            <strong>{textValue(doc.label)}:</strong>{" "}
                            {textValue(doc.filename)}
                            {doc.clioDocumentId
                              ? ` — Clio Document ID ${doc.clioDocumentId}`
                              : ""}
                            {doc.fullyUploaded ? " — fully uploaded" : ""}
                          </li>
                        ))}
                      </ul>
                    )}

                  {Array.isArray(finalizeUploadResult.skipped) &&
                    finalizeUploadResult.skipped.some(
                      (doc: any) => textValue(doc.reason) === "already-uploaded-to-clio"
                    ) && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: 8,
                          background: "#fffbeb",
                          border: "1px solid #f59e0b",
                          borderRadius: 4,
                          color: "#92400e",
                          fontSize: 12,
                        }}
                      >
                        <strong>Skipped existing Clio document(s):</strong>
                        <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                          {finalizeUploadResult.skipped
                            .filter(
                              (doc: any) =>
                                textValue(doc.reason) === "already-uploaded-to-clio"
                            )
                            .map((doc: any) => (
                              <li key={textValue(doc.key) || textValue(doc.filename)}>
                                {textValue(doc.label)} was not uploaded again because an exact filename match already exists in Clio.
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}

                  {finalizeUploadResult.finalizationRecord && (
                    <div style={{ marginTop: 8, color: "#065f46", fontSize: 12 }}>
                      <strong>Audit Record:</strong>{" "}
                      {finalizeUploadResult.finalizationRecord.ok
                        ? `local finalization audit record ID ${finalizeUploadResult.finalizationRecord.id}`
                        : `audit record was not created: ${textValue(finalizeUploadResult.finalizationRecord.error) || "unknown error"}`}
                    </div>
                  )}

                  <div style={{ marginTop: 8, color: "#555", fontSize: 12 }}>
                    Uploaded only through the explicit finalization action.  Duplicate prevention skips exact filename matches by default.  Local database records are audit/history only, Clio remains the source of truth, and no OneDrive/SharePoint folders were created.
                  </div>
                </div>
              )}

              {packetPreview?.packet?.masterLawsuitId && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: 10,
                    background: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontWeight: 800 }}>Finalization History</div>
                    <button
                      type="button"
                      onClick={() => loadFinalizationHistory(packetPreview.packet.masterLawsuitId)}
                      disabled={finalizationHistoryLoading}
                      style={{
                        fontSize: 12,
                        padding: "3px 8px",
                        border: "1px solid #94a3b8",
                        borderRadius: 4,
                        background: "#fff",
                        cursor: finalizationHistoryLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      {finalizationHistoryLoading ? "Loading..." : "Refresh History"}
                    </button>
                  </div>

                  <div style={{ marginTop: 4, color: "#475569", fontSize: 12 }}>
                    Local audit/history only.  Clio Documents tab remains the source of truth for actual uploaded files.
                  </div>

                  {finalizationHistory?.error && (
                    <div style={{ marginTop: 8, color: "#991b1b", fontSize: 12 }}>
                      <strong>Error:</strong> {textValue(finalizationHistory.error)}
                    </div>
                  )}

                  {finalizationHistoryLoading && !finalizationHistory && (
                    <div style={{ marginTop: 8, color: "#475569", fontSize: 12 }}>
                      Loading finalization history...
                    </div>
                  )}

                  {finalizationHistory?.ok && Array.isArray(finalizationHistory.rows) && finalizationHistory.rows.length === 0 && (
                    <div style={{ marginTop: 8, color: "#475569", fontSize: 12 }}>
                      No finalization history recorded yet.
                    </div>
                  )}

                  {finalizationHistory?.ok && Array.isArray(finalizationHistory.rows) && finalizationHistory.rows.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12 }}>
                      {finalizationHistory.rows.map((row: any) => {
                        const uploaded = Array.isArray(row.uploaded) ? row.uploaded : [];
                        const skipped = Array.isArray(row.skipped) ? row.skipped : [];
                        const duplicateSkips = skipped.filter(
                          (doc: any) => textValue(doc.reason) === "already-uploaded-to-clio"
                        );
                        const rowKey = textValue(row.id);
                        const isExpanded = expandedFinalizationId === rowKey;
                        const requestedKeys = Array.isArray(row.requestedKeys) ? row.requestedKeys : [];
                        const uploadTarget = row.clioUploadTarget || {};
                        const validation = row.validationSnapshot || {};
                        const packetSummary = row.packetSummarySnapshot || {};
                        const validationWarnings = Array.isArray(validation.warnings) ? validation.warnings : [];
                        const validationBlockingErrors = Array.isArray(validation.blockingErrors) ? validation.blockingErrors : [];

                        return (
                          <div
                            key={rowKey}
                            style={{
                              marginBottom: 10,
                              padding: 10,
                              background: "#fff",
                              border: "1px solid #e2e8f0",
                              borderRadius: 4,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 10,
                                alignItems: "flex-start",
                              }}
                            >
                              <div>
                                <div>
                                  <strong>
                                    {row.finalizedAt
                                      ? new Date(row.finalizedAt).toLocaleString()
                                      : "Unknown date"}
                                  </strong>{" "}
                                  — {textValue(row.status) || "unknown status"}
                                </div>
                                <div style={{ color: "#475569", marginTop: 2 }}>
                                  Audit ID {rowKey} · Uploaded {uploaded.length} · Skipped {skipped.length}
                                  {row.noUploadPerformed ? " · No upload performed" : ""}
                                  {row.allowDuplicateUploads ? " · Duplicate override allowed" : ""}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedFinalizationId(isExpanded ? null : rowKey)
                                }
                                style={{
                                  fontSize: 12,
                                  padding: "3px 8px",
                                  border: "1px solid #94a3b8",
                                  borderRadius: 4,
                                  background: isExpanded ? "#e2e8f0" : "#fff",
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {isExpanded ? "Hide Details" : "Details"}
                              </button>
                            </div>

                            {uploaded.length > 0 && (
                              <div style={{ color: "#065f46", marginTop: 4 }}>
                                Uploaded:{" "}
                                {uploaded
                                  .map((doc: any) => `${textValue(doc.label) || textValue(doc.key)}${doc.clioDocumentId ? ` (Clio ${doc.clioDocumentId})` : ""}`)
                                  .join(", ")}
                              </div>
                            )}

                            {duplicateSkips.length > 0 && (
                              <div style={{ color: "#92400e", marginTop: 4 }}>
                                Existing Clio duplicate skip:{" "}
                                {duplicateSkips
                                  .map((doc: any) => textValue(doc.label) || textValue(doc.key))
                                  .join(", ")}
                              </div>
                            )}

                            {textValue(row.error) && (
                              <div style={{ color: "#991b1b", marginTop: 4 }}>
                                <strong>Error:</strong> {textValue(row.error)}
                              </div>
                            )}

                            {isExpanded && (
                              <div
                                style={{
                                  marginTop: 10,
                                  padding: 10,
                                  background: "#f8fafc",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: 4,
                                }}
                              >
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                                    gap: 8,
                                    marginBottom: 10,
                                  }}
                                >
                                  <div>
                                    <strong>Master Lawsuit ID:</strong>
                                    <br />
                                    {textValue(row.masterLawsuitId) || "—"}
                                  </div>
                                  <div>
                                    <strong>Master Matter:</strong>
                                    <br />
                                    {textValue(row.masterDisplayNumber) || textValue(row.masterMatterId) || "—"}
                                  </div>
                                  <div>
                                    <strong>Requested Docs:</strong>
                                    <br />
                                    {requestedKeys.length > 0 ? requestedKeys.map(textValue).join(", ") : "—"}
                                  </div>
                                  <div>
                                    <strong>Audit Updated:</strong>
                                    <br />
                                    {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "—"}
                                  </div>
                                </div>

                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                                    gap: 8,
                                    marginBottom: 10,
                                    padding: 8,
                                    background: "#fff",
                                    border: "1px solid #e5e7eb",
                                    borderRadius: 4,
                                  }}
                                >
                                  <div>
                                    <strong>Clio Target Type:</strong>
                                    <br />
                                    {textValue(uploadTarget.type) || "—"}
                                  </div>
                                  <div>
                                    <strong>Target Matter ID:</strong>
                                    <br />
                                    {textValue(uploadTarget.matterId) || textValue(row.masterMatterId) || "—"}
                                  </div>
                                  <div>
                                    <strong>Would Upload To Clio:</strong>
                                    <br />
                                    {uploadTarget.wouldUploadToClio ? "Yes" : "No"}
                                  </div>
                                </div>

                                <div style={{ marginBottom: 10 }}>
                                  <strong>Uploaded Documents</strong>
                                  {uploaded.length === 0 ? (
                                    <div style={{ color: "#475569", marginTop: 4 }}>
                                      No documents were uploaded in this finalization attempt.
                                    </div>
                                  ) : (
                                    <table
                                      style={{
                                        width: "100%",
                                        borderCollapse: "collapse",
                                        marginTop: 4,
                                        background: "#fff",
                                      }}
                                    >
                                      <thead>
                                        <tr>
                                          <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 4 }}>Document</th>
                                          <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 4 }}>Filename</th>
                                          <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 4 }}>Clio Document ID</th>
                                          <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 4 }}>Fully Uploaded</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {uploaded.map((doc: any, index: number) => (
                                          <tr key={`${textValue(doc.key) || textValue(doc.filename)}-${index}`}>
                                            <td style={{ borderBottom: "1px solid #f1f5f9", padding: 4 }}>
                                              {textValue(doc.label) || textValue(doc.key) || "—"}
                                            </td>
                                            <td style={{ borderBottom: "1px solid #f1f5f9", padding: 4 }}>
                                              {textValue(doc.filename) || "—"}
                                            </td>
                                            <td style={{ borderBottom: "1px solid #f1f5f9", padding: 4 }}>
                                              {textValue(doc.clioDocumentId) || "—"}
                                            </td>
                                            <td style={{ borderBottom: "1px solid #f1f5f9", padding: 4 }}>
                                              {doc.fullyUploaded ? "Yes" : "No"}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>

                                <div style={{ marginBottom: 10 }}>
                                  <strong>Skipped Documents</strong>
                                  {skipped.length === 0 ? (
                                    <div style={{ color: "#475569", marginTop: 4 }}>
                                      No documents were skipped in this finalization attempt.
                                    </div>
                                  ) : (
                                    <table
                                      style={{
                                        width: "100%",
                                        borderCollapse: "collapse",
                                        marginTop: 4,
                                        background: "#fff",
                                      }}
                                    >
                                      <thead>
                                        <tr>
                                          <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 4 }}>Document</th>
                                          <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 4 }}>Reason</th>
                                          <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 4 }}>Filename</th>
                                          <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 4 }}>Existing Clio Docs</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {skipped.map((doc: any, index: number) => (
                                          <tr key={`${textValue(doc.key) || textValue(doc.filename)}-${index}`}>
                                            <td style={{ borderBottom: "1px solid #f1f5f9", padding: 4 }}>
                                              {textValue(doc.label) || textValue(doc.key) || "—"}
                                            </td>
                                            <td style={{ borderBottom: "1px solid #f1f5f9", padding: 4 }}>
                                              {textValue(doc.reason) || "—"}
                                            </td>
                                            <td style={{ borderBottom: "1px solid #f1f5f9", padding: 4 }}>
                                              {textValue(doc.filename) || "—"}
                                            </td>
                                            <td style={{ borderBottom: "1px solid #f1f5f9", padding: 4 }}>
                                              {Array.isArray(doc.existingClioDocuments)
                                                ? doc.existingClioDocuments.length
                                                : 0}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>

                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                                    gap: 8,
                                    marginBottom: 10,
                                    padding: 8,
                                    background: "#fff",
                                    border: "1px solid #e5e7eb",
                                    borderRadius: 4,
                                  }}
                                >
                                  <div>
                                    <strong>Can Generate:</strong>
                                    <br />
                                    {validation.canGenerate ? "Yes" : "No"}
                                  </div>
                                  <div>
                                    <strong>Warnings:</strong>
                                    <br />
                                    {validationWarnings.length}
                                  </div>
                                  <div>
                                    <strong>Blocking Errors:</strong>
                                    <br />
                                    {validationBlockingErrors.length}
                                  </div>
                                  <div>
                                    <strong>Amount Mode:</strong>
                                    <br />
                                    {textValue(packetSummary.amountSoughtMode) || "—"}
                                  </div>
                                </div>

                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                                    gap: 8,
                                    marginBottom: 10,
                                    padding: 8,
                                    background: "#fff",
                                    border: "1px solid #e5e7eb",
                                    borderRadius: 4,
                                  }}
                                >
                                  <div>
                                    <strong>Venue:</strong>
                                    <br />
                                    {textValue(packetSummary.venue) || "—"}
                                  </div>
                                  <div>
                                    <strong>Provider:</strong>
                                    <br />
                                    {textValue(packetSummary.provider) || "—"}
                                  </div>
                                  <div>
                                    <strong>Patient:</strong>
                                    <br />
                                    {textValue(packetSummary.patient) || "—"}
                                  </div>
                                  <div>
                                    <strong>Insurer:</strong>
                                    <br />
                                    {textValue(packetSummary.insurer) || "—"}
                                  </div>
                                  <div>
                                    <strong>Claim Number:</strong>
                                    <br />
                                    {textValue(packetSummary.claimNumber) || "—"}
                                  </div>
                                  <div>
                                    <strong>Bill Count:</strong>
                                    <br />
                                    {textValue(packetSummary.billCount) || "—"}
                                  </div>
                                  <div>
                                    <strong>Amount Sought:</strong>
                                    <br />
                                    {textValue(packetSummary.amountSought) ? money(packetSummary.amountSought) : "—"}
                                  </div>
                                  <div>
                                    <strong>Index / AAA:</strong>
                                    <br />
                                    {textValue(packetSummary.indexAaaNumber) || "—"}
                                  </div>
                                </div>

                                <details style={{ marginBottom: 6 }}>
                                  <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                                    Raw Clio upload target JSON
                                  </summary>
                                  <pre
                                    style={{
                                      whiteSpace: "pre-wrap",
                                      overflowX: "auto",
                                      margin: "4px 0 0 0",
                                      padding: 8,
                                      background: "#fff",
                                      border: "1px solid #e5e7eb",
                                      borderRadius: 4,
                                    }}
                                  >
                                    {JSON.stringify(uploadTarget, null, 2)}
                                  </pre>
                                </details>

                                <details style={{ marginBottom: 6 }}>
                                  <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                                    Raw uploaded/skipped documents JSON
                                  </summary>
                                  <pre
                                    style={{
                                      whiteSpace: "pre-wrap",
                                      overflowX: "auto",
                                      margin: "4px 0 0 0",
                                      padding: 8,
                                      background: "#fff",
                                      border: "1px solid #e5e7eb",
                                      borderRadius: 4,
                                    }}
                                  >
                                    {JSON.stringify({ uploaded, skipped }, null, 2)}
                                  </pre>
                                </details>

                                <details style={{ marginBottom: 6 }}>
                                  <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                                    Raw validation snapshot JSON
                                  </summary>
                                  <pre
                                    style={{
                                      whiteSpace: "pre-wrap",
                                      overflowX: "auto",
                                      margin: "4px 0 0 0",
                                      padding: 8,
                                      background: "#fff",
                                      border: "1px solid #e5e7eb",
                                      borderRadius: 4,
                                    }}
                                  >
                                    {JSON.stringify(validation, null, 2)}
                                  </pre>
                                </details>

                                <details>
                                  <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                                    Raw packet summary snapshot JSON
                                  </summary>
                                  <pre
                                    style={{
                                      whiteSpace: "pre-wrap",
                                      overflowX: "auto",
                                      margin: "4px 0 0 0",
                                      padding: 8,
                                      background: "#fff",
                                      border: "1px solid #e5e7eb",
                                      borderRadius: 4,
                                    }}
                                  >
                                    {JSON.stringify(packetSummary, null, 2)}
                                  </pre>
                                </details>

                                <div style={{ marginTop: 8, color: "#475569" }}>
                                  This drilldown displays local audit/history data only.  It does not verify current Clio document existence.
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {packetPreview?.packet?.masterLawsuitId && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: 10,
                    background: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontWeight: 800 }}>Print Queue Preview</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => loadPrintQueuePreview(packetPreview.packet.masterLawsuitId)}
                        disabled={printQueuePreviewLoading}
                        style={{
                          fontSize: 12,
                          padding: "3px 8px",
                          border: "1px solid #94a3b8",
                          borderRadius: 4,
                          background: "#fff",
                          cursor: printQueuePreviewLoading ? "not-allowed" : "pointer",
                        }}
                      >
                        {printQueuePreviewLoading ? "Loading..." : "Refresh Print Preview"}
                      </button>
                      <button
                        type="button"
                        onClick={() => loadPrintQueueList(packetPreview.packet.masterLawsuitId)}
                        disabled={printQueueListLoading}
                        style={{
                          fontSize: 12,
                          padding: "3px 8px",
                          border: "1px solid #94a3b8",
                          borderRadius: 4,
                          background: "#fff",
                          cursor: printQueueListLoading ? "not-allowed" : "pointer",
                        }}
                      >
                        {printQueueListLoading ? "Loading..." : "Refresh Queue List"}
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: 4, color: "#475569", fontSize: 12 }}>
                    Read-only print-candidate preview from local finalization audit records, verified against the current Clio master matter Documents tab.  This does not create a print queue.
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      padding: 8,
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                      Existing Print Queue Items
                    </div>

                    <div style={{ color: "#475569", marginBottom: 6 }}>
                      Local print queue records for this lawsuit.  Status controls update only local print queue records; they do not change Clio, upload documents, create folders, or modify document contents.
                    </div>

                    {printQueueStatusResult && (
                      <div
                        style={{
                          marginBottom: 8,
                          padding: 8,
                          background: printQueueStatusResult.ok ? "#f0fdf4" : "#fef2f2",
                          border: `1px solid ${printQueueStatusResult.ok ? "#bbf7d0" : "#fecaca"}`,
                          borderRadius: 4,
                          color: printQueueStatusResult.ok ? "#166534" : "#991b1b",
                        }}
                      >
                        {printQueueStatusResult.ok ? (
                          <>
                            Print queue status updated to {textValue(printQueueStatusResult.status) || "—"}.
                          </>
                        ) : (
                          <>
                            <strong>Error:</strong> {textValue(printQueueStatusResult.error)}
                          </>
                        )}
                      </div>
                    )}

                    {printQueueList?.ok && (
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          flexWrap: "wrap",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        {([
                          ["", "All", "all"],
                          ["queued", "Queued", "queued"],
                          ["printed", "Printed", "printed"],
                          ["hold", "Hold", "hold"],
                          ["skipped", "Skipped", "skipped"],
                        ] as const).map(([value, label, countKey]) => {
                          const active = printQueueStatusFilter === value;
                          const count = num(printQueueList?.statusCounts?.[countKey]);

                          return (
                            <button
                              key={countKey}
                              type="button"
                              onClick={() => changePrintQueueStatusFilter(value)}
                              disabled={printQueueListLoading}
                              style={{
                                fontSize: 12,
                                padding: "3px 8px",
                                border: `1px solid ${active ? "#0f172a" : "#94a3b8"}`,
                                borderRadius: 999,
                                background: active ? "#e2e8f0" : "#fff",
                                cursor: printQueueListLoading ? "not-allowed" : "pointer",
                                fontWeight: active ? 800 : 500,
                              }}
                            >
                              {label}: {count}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {printQueueListLoading && !printQueueList && (
                      <div style={{ color: "#475569" }}>Loading print queue...</div>
                    )}

                    {printQueueList?.error && (
                      <div style={{ color: "#991b1b" }}>
                        <strong>Error:</strong> {textValue(printQueueList.error)}
                      </div>
                    )}

                    {printQueueList?.ok && num(printQueueList.count) === 0 && (
                      <div style={{ color: "#475569" }}>
                        {printQueueStatusFilter
                          ? `No print queue items currently match status "${printQueueStatusFilter}" for this lawsuit.`
                          : "No documents are currently queued for printing for this lawsuit."}
                      </div>
                    )}

                    {printQueueList?.ok && Array.isArray(printQueueList.rows) && printQueueList.rows.length > 0 && (
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          background: "#fff",
                        }}
                      >
                        <thead>
                          <tr>
                            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 4 }}>Document</th>
                            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 4 }}>Filename</th>
                            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 4 }}>Status</th>
                            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 4 }}>Queued At</th>
                            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 4 }}>Printed At</th>
                            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 4 }}>Clio Document ID</th>
                            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 4 }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {printQueueList.rows.map((row: any) => (
                            <tr key={textValue(row.id)}>
                              <td style={{ borderBottom: "1px solid #f1f5f9", padding: 4 }}>
                                {textValue(row.documentLabel) || textValue(row.documentKey) || "—"}
                              </td>
                              <td style={{ borderBottom: "1px solid #f1f5f9", padding: 4 }}>
                                {textValue(row.filename) || "—"}
                              </td>
                              <td style={{ borderBottom: "1px solid #f1f5f9", padding: 4 }}>
                                {textValue(row.status) || "—"}
                              </td>
                              <td style={{ borderBottom: "1px solid #f1f5f9", padding: 4 }}>
                                {textValue(row.queuedAt) || "—"}
                              </td>
                              <td style={{ borderBottom: "1px solid #f1f5f9", padding: 4 }}>
                                {textValue(row.printedAt) || "—"}
                              </td>
                              <td style={{ borderBottom: "1px solid #f1f5f9", padding: 4 }}>
                                {textValue(row.clioDocumentId) || "—"}
                              </td>
                              <td style={{ borderBottom: "1px solid #f1f5f9", padding: 4 }}>
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                  {(["printed", "hold", "skipped", "queued"] as const).map((statusOption) => (
                                    <button
                                      key={`${textValue(row.id)}-${statusOption}`}
                                      type="button"
                                      onClick={() => updatePrintQueueStatus(row, statusOption)}
                                      disabled={
                                        printQueueStatusLoadingId === Number(row.id) ||
                                        textValue(row.status).toLowerCase() === statusOption
                                      }
                                      style={{
                                        fontSize: 11,
                                        padding: "2px 6px",
                                        border: "1px solid #94a3b8",
                                        borderRadius: 4,
                                        background:
                                          textValue(row.status).toLowerCase() === statusOption
                                            ? "#e2e8f0"
                                            : "#fff",
                                        cursor:
                                          printQueueStatusLoadingId === Number(row.id) ||
                                          textValue(row.status).toLowerCase() === statusOption
                                            ? "not-allowed"
                                            : "pointer",
                                      }}
                                    >
                                      {printQueueStatusLoadingId === Number(row.id)
                                        ? "Updating..."
                                        : statusOption === "printed"
                                          ? "Printed"
                                          : statusOption === "hold"
                                            ? "Hold"
                                            : statusOption === "skipped"
                                              ? "Skipped"
                                              : "Re-Queue"}
                                    </button>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {printQueuePreview?.error && (
                    <div style={{ marginTop: 8, color: "#991b1b", fontSize: 12 }}>
                      <strong>Error:</strong> {textValue(printQueuePreview.error)}
                    </div>
                  )}

                  {printQueuePreviewLoading && !printQueuePreview && (
                    <div style={{ marginTop: 8, color: "#475569", fontSize: 12 }}>
                      Loading print queue preview...
                    </div>
                  )}

                  {printQueuePreview?.ok && num(printQueuePreview.candidateDocumentCount) === 0 && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: 8,
                        background: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 4,
                        color: "#475569",
                        fontSize: 12,
                      }}
                    >
                      No currently verified printable finalized documents are proposed for this lawsuit.  Duplicate-only, no-upload, or unverified finalization audit rows are intentionally excluded.
                    </div>
                  )}

                  {printQueuePreview?.ok && Array.isArray(printQueuePreview.candidateDocuments) && printQueuePreview.candidateDocuments.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12 }}>
                      <div
                        style={{
                          marginBottom: 6,
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                          alignItems: "center",
                          color: "#475569",
                        }}
                      >
                        <div>
                          Candidate documents: {num(printQueuePreview.candidateDocumentCount)}
                        </div>
                        <button
                          type="button"
                          onClick={() => addVerifiedCandidatesToPrintQueue(packetPreview.packet.masterLawsuitId)}
                          disabled={printQueueAddLoading}
                          style={{
                            fontSize: 12,
                            padding: "3px 8px",
                            border: "1px solid #15803d",
                            borderRadius: 4,
                            background: "#f0fdf4",
                            color: "#166534",
                            cursor: printQueueAddLoading ? "not-allowed" : "pointer",
                          }}
                        >
                          {printQueueAddLoading ? "Adding..." : "Add Verified Candidates to Print Queue"}
                        </button>
                      </div>

                      {printQueueAddResult && (
                        <div
                          style={{
                            marginBottom: 8,
                            padding: 8,
                            background: printQueueAddResult.ok ? "#f0fdf4" : "#fef2f2",
                            border: `1px solid ${printQueueAddResult.ok ? "#bbf7d0" : "#fecaca"}`,
                            borderRadius: 4,
                            color: printQueueAddResult.ok ? "#166534" : "#991b1b",
                          }}
                        >
                          {printQueueAddResult.ok ? (
                            <>
                              Added {num(printQueueAddResult.createdCount)} document(s) to the print queue.
                              {num(printQueueAddResult.existingCount) > 0
                                ? `  ${num(printQueueAddResult.existingCount)} duplicate queue item(s) were already present.`
                                : ""}
                            </>
                          ) : (
                            <>
                              <strong>Error:</strong> {textValue(printQueueAddResult.error)}
                            </>
                          )}
                        </div>
                      )}

                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          background: "#fff",
                        }}
                      >
                        <thead>
                          <tr>
                            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 4 }}>Document</th>
                            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 4 }}>Filename</th>
                            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 4 }}>Clio Document ID</th>
                            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 4 }}>Audit ID</th>
                            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 4 }}>Verified in Clio Now?</th>
                          </tr>
                        </thead>
                        <tbody>
                          {printQueuePreview.candidateDocuments.map((doc: any, index: number) => (
                            <tr key={`${textValue(doc.finalizationId)}-${textValue(doc.key)}-${index}`}>
                              <td style={{ borderBottom: "1px solid #f1f5f9", padding: 4 }}>
                                {textValue(doc.label) || textValue(doc.key) || "—"}
                              </td>
                              <td style={{ borderBottom: "1px solid #f1f5f9", padding: 4 }}>
                                {textValue(doc.filename) || "—"}
                              </td>
                              <td style={{ borderBottom: "1px solid #f1f5f9", padding: 4 }}>
                                {textValue(doc.clioDocumentId) || "—"}
                              </td>
                              <td style={{ borderBottom: "1px solid #f1f5f9", padding: 4 }}>
                                {textValue(doc.finalizationId) || "—"}
                              </td>
                              <td style={{ borderBottom: "1px solid #f1f5f9", padding: 4 }}>
                                {doc.currentClioExistenceVerified ? "Yes" : "No"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div style={{ marginTop: 8, color: "#475569" }}>
                        These are proposed print candidates only.  Each listed document has been verified against the current Clio master matter Documents tab, which remains the record-copy source of truth.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {packetPreview.packet.validation?.blockingErrors?.length > 0 && (
                <div style={{ color: "#991b1b", marginBottom: 8 }}>
                  <strong>Blocking Errors:</strong>{" "}
                  {packetPreview.packet.validation.blockingErrors.join("; ")}
                </div>
              )}

              {packetPreview.packet.validation?.warnings?.length > 0 && (
                <div style={{ color: "#92400e", marginBottom: 8 }}>
                  <strong>Warnings:</strong>{" "}
                  {packetPreview.packet.validation.warnings.join("; ")}
                </div>
              )}

              <details open style={{ marginTop: 8 }}>
                <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                  Child Bill Matters
                </summary>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    marginTop: 8,
                    background: "#fff",
                  }}
                >
                  <thead>
                    <tr>
                      <th style={thStyle}>{matterSortHeader("Matter", "matter")}</th>
                      <th style={thStyle}>{matterSortHeader("Patient", "patient")}</th>
                      <th style={thStyle}>{matterSortHeader("Provider", "provider")}</th>
                      <th style={thStyle}>DOS</th>
                      <th style={thStyle}>{matterSortHeader("Claim Amount", "claim")}</th>
                      <th style={thStyle}>Balance Presuit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packetChildMatters(packetPreview.packet).map((child: any) => (
                      <tr key={String(child.matterId)}>
                        <td style={tdStyle}>
                          {child.matterId ? (
                            <a
                              href={clioMatterUrl(child.matterId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: "#2563eb",
                                fontWeight: 700,
                                textDecoration: "underline",
                              }}
                            >
                              {textValue(child.displayNumber)}
                            </a>
                          ) : (
                            textValue(child.displayNumber)
                          )}
                        </td>
                        <td style={tdStyle}>{textValue(child.patientName)}</td>
                        <td style={tdStyle}>{textValue(child.providerName)}</td>
                        <td style={tdStyle}>{formatDOS(child.dosStart, child.dosEnd)}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          {money(child.claimAmount)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          {money(child.balancePresuit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </div>
          )}
        </section>
      )}

      
<section className="barsh-matter-list-card barsh-direct-matter-list-hidden">
<div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
  <label className="barsh-include-closed-row" style={{ cursor: "pointer", fontSize: 14 }}>
    <input
      type="checkbox"
      checked={showClosed}
      onChange={(e) => setShowClosed(e.target.checked)}
      style={{ marginRight: 6 }}
    />
    Include closed matters
  </label>
</div>

<table className="barsh-main-matter-table" style={{ width: "100%", borderCollapse: "collapse"  }}>
        <thead>
          <tr>
            <th style={thStyle}>Select</th>
            <th style={thStyle}>{matterSortHeader("Matter", "matter")}</th>
            <th style={thStyle}>{matterSortHeader("Patient", "patient")}</th>
            <th style={thStyle}>{matterSortHeader("Provider", "provider")}</th>
            <th style={thStyle}>{matterSortHeader("Insurer", "insurer")}</th>
            <th style={thStyle}>{matterSortHeader("Date of Service", "dos")}</th>
            <th style={thStyle}>Claim Amount</th>
            <th style={thStyle}>{matterSortHeader("Payment (Voluntary)", "payment")}</th>
            <th style={thStyle}>{matterSortHeader("Balance (Presuit)", "balance")}</th>
            <th style={thStyle}>{matterSortHeader("Denial Reason", "denial")}</th>
            <th style={thStyle}>{matterSortHeader("Status", "status")}</th>
            <th style={thStyle}>{matterSortHeader("Closed Reason", "finalStatus")}</th>
            <th style={thStyle}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {displayRows.map((r) => {
            const claim = num(r.claimAmount);
            const payment = num(r.paymentVoluntary);
            const balance = claim - payment;
            const isSelected = selected.includes(Number(r.id));
            const aggregated = isAggregated(r);
            const isMaster = !!(r.isMaster || r.is_master);
            const selectable = isSelectable(r);
            const locked = isMaster || aggregated || !selectable;
            const masterLawsuitId = textValue(r.masterLawsuitId);
            const lawsuitColor = aggregated
              ? getColorForLawsuit(String(r.masterLawsuitId))
              : "";

            return (
              <Fragment key={`row-fragment-${Number(r.id)}`}>
                {r.showGroupLabel && (
                  <tr key={`lawsuit-band-${masterLawsuitId}`}>
                    <td
                      colSpan={13}
                      style={{
                        padding: "5px 10px",
                        border: "1px solid #bfbfbf",
                        background: "#d9d9d9",
                        color: "#111827",
                        fontSize: 13,
                        fontWeight: 800,
                        letterSpacing: 0.2,
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto 1fr",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <span />

                        <div style={{ textAlign: "center" }}>
                          <span style={{ color: "#6b7280" }}>•••</span>
                          <span style={{ margin: "0 12px" }}>
                            LAWSUIT {masterLawsuitId}
                          </span>
                          <span style={{ color: "#6b7280" }}>•••</span>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: 6,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => openMetadataModalForMaster(masterLawsuitId)}
                            disabled={packetLoading}
                            style={{
                              padding: "3px 8px",
                              border: "1px solid #4b5563",
                              background: packetLoading ? "#f3f4f6" : "#4b5563",
                              color: packetLoading ? "#666" : "#fff",
                              borderRadius: 4,
                              cursor: packetLoading ? "not-allowed" : "pointer",
                              fontWeight: 700,
                              fontSize: 12,
                            }}
                          >
                            Edit Metadata
                          </button>

                          <button
                            type="button"
                            onClick={() => loadPacketPreviewForMaster(masterLawsuitId)}
                            disabled={packetLoading}
                            style={{
                              padding: "3px 8px",
                              border: "1px solid #2563eb",
                              background: packetLoading ? "#f3f4f6" : "#2563eb",
                              color: packetLoading ? "#666" : "#fff",
                              borderRadius: 4,
                              cursor: packetLoading ? "not-allowed" : "pointer",
                              fontWeight: 700,
                              fontSize: 12,
                            }}
                          >
                            Packet Preview
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

              <tr
                key={Number(r.id)}
                style={{
                  background: isMaster
                    ? "#ffe9b3"
                    : aggregated
                    ? lawsuitColor
                    : !selectable
                    ? "#f5f5f5"
                    : isSelected
                    ? "#eaf2ff"
                    : "#ffffff",
                  opacity: locked ? 0.8 : 1,
                  borderLeft: aggregated ? `4px solid ${lawsuitColor}` : undefined,
                }}
              >
                <td
                  style={{
                    ...tdStyle,
                    textAlign: "center",
                    padding: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "100%",
                      minHeight: 46,
                      position: "relative",
                    }}
                    title={
                      aggregated
                        ? `Already aggregated under ${textValue(r.masterLawsuitId)}`
                        : !selectable
                        ? `Stage: ${r?.stage?.name || r?.matterStage?.name || "N/A"} | Status: ${r?.status || "N/A"}`
                        : ""
                    }
                  >
                    {locked ? (
                      <span style={{ fontSize: 18, lineHeight: 1 }}>🔒</span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!selectable}
                        onChange={() => toggle(Number(r.id))}
                        style={{
                          width: 18,
                          height: 18,
                          cursor: selectable ? "pointer" : "not-allowed",
                          margin: 0,
                        }}
                      />
                    )}
                  </div>
                </td>

                <td style={tdStyle}>
                  {aggregated ? "🔒 " : ""}
                  <a
                    href={`/matter/${Number(r.id)}`}
                    style={{
                      color: "#0057b8",
                      textDecoration: "underline",
                      fontWeight: Number(r.id) === Number(matter?.id) ? 700 : 500,
                    }}
                  >
                    {isMaster ? "⭐ MASTER — " : ""}{textValue(r.displayNumber)}
                  </a>
                  {aggregated && r.masterLawsuitId
                    ? ` (${textValue(r.masterLawsuitId)})`
                    : ""}
                </td>
                <td style={tdStyle}>{textValue(r.patient)}</td>
                <td style={tdStyle}>{providerValue(r)}</td>
                <td style={tdStyle}>{insurerValue(r)}</td>
                <td style={tdStyle}>{formatDOS(r.dosStart, r.dosEnd)}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{money(claim)}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{money(payment)}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{money(balance)}</td>
                <td style={tdStyle}>{denialReasonValue(r)}</td>
                <td
                  style={{
                    ...tdStyle,
                    
                    whiteSpace: "nowrap",
                  }}
                >
                  {textValue(r?.matterStage?.name)}
                </td>
                <td style={{ ...tdStyle }}>
                  {textValue(r.closeReason || "")}
                </td>
                <td style={{ ...tdStyle, textAlign: "center", whiteSpace: "nowrap" }}>
                  <button
                    onClick={() => {
                      setCloseMatterTarget(r);
                      setCloseReason("");
                      setShowCloseModal(true);
                    }}
                    disabled={!!String(r.closeReason || "").trim()}
                    style={{
                      padding: "6px 10px",
                      border: "1px solid #dc2626",
                      background: !!String(r.closeReason || "").trim()
                        ? "#f3f4f6"
                        : "#fee2e2",
                      color: !!String(r.closeReason || "").trim()
                        ? "#6b7280"
                        : "#991b1b",
                      borderRadius: 4,
                      cursor: !!String(r.closeReason || "").trim()
                        ? "not-allowed"
                        : "pointer",
                      fontWeight: 700,
                    }}
                  >
                    Close
                  </button>
                </td>
              </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
</section>
        </>
      )}

    </main>

    {showMetadataModal && (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
      >
        <div
          style={{
            width: 520,
            maxWidth: "calc(100vw - 32px)",
            background: "#fff",
            borderRadius: 8,
            padding: 22,
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Edit Lawsuit Metadata</h2>

          <p style={{ marginBottom: 16, color: "#444", lineHeight: 1.45 }}>
            Venue, Amount Sought, and notes are stored locally for lawsuit metadata and document packet generation.
            Index / AAA Number and lawsuit matter display numbers are written to Clio as post-filing fields.
          </p>

          <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
            Venue
          </label>
          <select
            value={metadataEdit.venueSelection}
            onChange={(e) =>
              setMetadataEdit((prev) => ({
                ...prev,
                venueSelection: e.target.value,
                venueOther: e.target.value === "Other" ? prev.venueOther : "",
              }))
            }
            style={{
              width: "100%",
              padding: 10,
              marginBottom: 10,
              border: "1px solid #bbb",
              borderRadius: 4,
            }}
          >
            <option value="">Select Venue</option>
            {VENUE_OPTIONS.map((venue) => (
              <option key={venue} value={venue}>
                {venue}
              </option>
            ))}
          </select>

          {metadataEdit.venueSelection === "Other" && (
            <input
              value={metadataEdit.venueOther}
              onChange={(e) =>
                setMetadataEdit((prev) => ({
                  ...prev,
                  venueOther: e.target.value,
                }))
              }
              placeholder="Enter venue"
              style={{
                width: "100%",
                padding: 10,
                marginBottom: 14,
                border: "1px solid #bbb",
                borderRadius: 4,
              }}
            />
          )}

          <fieldset
            style={{
              border: "1px solid #ddd",
              borderRadius: 6,
              padding: 12,
              margin: "8px 0 14px",
            }}
          >
            <legend style={{ fontWeight: 700, padding: "0 6px" }}>
              Amount Sought
            </legend>

            <label style={{ display: "block", marginBottom: 8 }}>
              <input
                type="radio"
                name="metadataAmountSoughtMode"
                value="balance_presuit"
                checked={metadataEdit.amountSoughtMode === "balance_presuit"}
                onChange={() =>
                  setMetadataEdit((prev) => ({
                    ...prev,
                    amountSoughtMode: "balance_presuit",
                    customAmountSought: "",
                  }))
                }
                style={{ marginRight: 8 }}
              />
              Balance (Presuit) — default
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              <input
                type="radio"
                name="metadataAmountSoughtMode"
                value="claim_amount"
                checked={metadataEdit.amountSoughtMode === "claim_amount"}
                onChange={() =>
                  setMetadataEdit((prev) => ({
                    ...prev,
                    amountSoughtMode: "claim_amount",
                    customAmountSought: "",
                  }))
                }
                style={{ marginRight: 8 }}
              />
              Claim Amount
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              <input
                type="radio"
                name="metadataAmountSoughtMode"
                value="custom"
                checked={metadataEdit.amountSoughtMode === "custom"}
                onChange={() =>
                  setMetadataEdit((prev) => ({
                    ...prev,
                    amountSoughtMode: "custom",
                  }))
                }
                style={{ marginRight: 8 }}
              />
              Custom Amount
            </label>

            {metadataEdit.amountSoughtMode === "custom" && (
              <input
                value={metadataEdit.customAmountSought}
                onChange={(e) =>
                  setMetadataEdit((prev) => ({
                    ...prev,
                    customAmountSought: e.target.value,
                  }))
                }
                placeholder="Enter total lawsuit amount sought"
                style={{
                  width: "100%",
                  padding: 10,
                  marginTop: 2,
                  border: "1px solid #bbb",
                  borderRadius: 4,
                }}
              />
            )}
          </fieldset>

          <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
            Index / AAA Number
          </label>
          <input
            value={metadataEdit.indexAaaNumber}
            onChange={(e) =>
              setMetadataEdit((prev) => ({
                ...prev,
                indexAaaNumber: e.target.value,
              }))
            }
            placeholder="Enter after filing"
            style={{
              width: "100%",
              padding: 10,
              marginBottom: 14,
              border: "1px solid #bbb",
              borderRadius: 4,
            }}
          />

          <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
            Notes
          </label>
          <textarea
            value={metadataEdit.lawsuitNotes}
            onChange={(e) =>
              setMetadataEdit((prev) => ({
                ...prev,
                lawsuitNotes: e.target.value,
              }))
            }
            placeholder="Optional"
            rows={3}
            style={{
              width: "100%",
              padding: 10,
              marginBottom: 18,
              border: "1px solid #bbb",
              borderRadius: 4,
              resize: "vertical",
            }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              onClick={() => setShowMetadataModal(false)}
              disabled={metadataSaving}
              style={{
                padding: "8px 12px",
                border: "1px solid #aaa",
                background: "#fff",
                borderRadius: 4,
                cursor: metadataSaving ? "not-allowed" : "pointer",
              }}
            >
              Cancel
            </button>

            <button
              onClick={saveMetadataEdit}
              disabled={
                metadataSaving ||
                (metadataEdit.amountSoughtMode === "custom" &&
                  parseMoneyInput(metadataEdit.customAmountSought) === null)
              }
              style={{
                padding: "8px 12px",
                border: "1px solid #2563eb",
                background:
                  metadataSaving ||
                  (metadataEdit.amountSoughtMode === "custom" &&
                    parseMoneyInput(metadataEdit.customAmountSought) === null)
                    ? "#f3f4f6"
                    : "#2563eb",
                color:
                  metadataSaving ||
                  (metadataEdit.amountSoughtMode === "custom" &&
                    parseMoneyInput(metadataEdit.customAmountSought) === null)
                    ? "#666"
                    : "#fff",
                borderRadius: 4,
                cursor:
                  metadataSaving ||
                  (metadataEdit.amountSoughtMode === "custom" &&
                    parseMoneyInput(metadataEdit.customAmountSought) === null)
                    ? "not-allowed"
                    : "pointer",
                fontWeight: 700,
              }}
            >
              {metadataSaving ? "Saving..." : "Save Metadata"}
            </button>
          </div>
        </div>
      </div>
    )}

    {showLawsuitOptionsModal && (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
      >
        <div
          style={{
            width: 560,
            maxWidth: "calc(100vw - 32px)",
            background: "#fff",
            borderRadius: 8,
            padding: 22,
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Lawsuit Generation Options</h2>

          <p style={{ marginBottom: 16, color: "#444" }}>
            These options will be stored with the lawsuit and used for amount-sought calculation,
            document packet metadata, and future document generation.
          </p>

          <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
            Venue
          </label>
          <select
            value={lawsuitOptions.venue}
            onChange={(e) =>
              setLawsuitOptions((prev) => ({
                ...prev,
                venue: e.target.value,
                venueOther: e.target.value === "Other" ? prev.venueOther : "",
              }))
            }
            style={{
              width: "100%",
              padding: 10,
              marginBottom: 10,
              border: "1px solid #bbb",
              borderRadius: 4,
            }}
          >
            <option value="">Select Venue</option>
            {VENUE_OPTIONS.map((venue) => (
              <option key={venue} value={venue}>
                {venue}
              </option>
            ))}
          </select>

          {lawsuitOptions.venue === "Other" && (
            <input
              value={lawsuitOptions.venueOther}
              onChange={(e) =>
                setLawsuitOptions((prev) => ({
                  ...prev,
                  venueOther: e.target.value,
                }))
              }
              placeholder="Enter venue"
              style={{
                width: "100%",
                padding: 10,
                marginBottom: 14,
                border: "1px solid #bbb",
                borderRadius: 4,
              }}
            />
          )}

          <fieldset
            style={{
              border: "1px solid #ddd",
              borderRadius: 6,
              padding: 12,
              margin: "8px 0 14px",
            }}
          >
            <legend style={{ fontWeight: 700, padding: "0 6px" }}>
              Amount Sought
            </legend>

            <label style={{ display: "block", marginBottom: 8 }}>
              <input
                type="radio"
                name="amountSoughtMode"
                value="balance_presuit"
                checked={lawsuitOptions.amountSoughtMode === "balance_presuit"}
                onChange={() =>
                  setLawsuitOptions((prev) => ({
                    ...prev,
                    amountSoughtMode: "balance_presuit",
                    customAmountSought: "",
                  }))
                }
                style={{ marginRight: 8 }}
              />
              Balance (Presuit) — default
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              <input
                type="radio"
                name="amountSoughtMode"
                value="claim_amount"
                checked={lawsuitOptions.amountSoughtMode === "claim_amount"}
                onChange={() =>
                  setLawsuitOptions((prev) => ({
                    ...prev,
                    amountSoughtMode: "claim_amount",
                    customAmountSought: "",
                  }))
                }
                style={{ marginRight: 8 }}
              />
              Claim Amount
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              <input
                type="radio"
                name="amountSoughtMode"
                value="custom"
                checked={lawsuitOptions.amountSoughtMode === "custom"}
                onChange={() =>
                  setLawsuitOptions((prev) => ({
                    ...prev,
                    amountSoughtMode: "custom",
                  }))
                }
                style={{ marginRight: 8 }}
              />
              Custom Amount
            </label>

            {lawsuitOptions.amountSoughtMode === "custom" && (
              <input
                value={lawsuitOptions.customAmountSought}
                onChange={(e) =>
                  setLawsuitOptions((prev) => ({
                    ...prev,
                    customAmountSought: e.target.value,
                  }))
                }
                placeholder="Enter total lawsuit amount sought"
                style={{
                  width: "100%",
                  padding: 10,
                  marginTop: 2,
                  border: "1px solid #bbb",
                  borderRadius: 4,
                }}
              />
            )}
          </fieldset>

          <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
            Index / AAA Number
          </label>
          <input
            value={lawsuitOptions.indexAaaNumber}
            onChange={(e) =>
              setLawsuitOptions((prev) => ({
                ...prev,
                indexAaaNumber: e.target.value,
              }))
            }
            placeholder="Optional"
            style={{
              width: "100%",
              padding: 10,
              marginBottom: 14,
              border: "1px solid #bbb",
              borderRadius: 4,
            }}
          />

          <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
            Additional Metadata / Notes
          </label>
          <textarea
            value={lawsuitOptions.notes}
            onChange={(e) =>
              setLawsuitOptions((prev) => ({
                ...prev,
                notes: e.target.value,
              }))
            }
            placeholder="Optional"
            rows={3}
            style={{
              width: "100%",
              padding: 10,
              marginBottom: 18,
              border: "1px solid #bbb",
              borderRadius: 4,
              resize: "vertical",
            }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              onClick={() => setShowLawsuitOptionsModal(false)}
              disabled={submitting}
              style={{
                padding: "8px 12px",
                border: "1px solid #aaa",
                background: "#fff",
                borderRadius: 4,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              Cancel
            </button>

            <button
              onClick={submitAggregationWithOptions}
              disabled={
                submitting ||
                (lawsuitOptions.amountSoughtMode === "custom" &&
                  parseMoneyInput(lawsuitOptions.customAmountSought) === null)
              }
              style={{
                padding: "8px 12px",
                border: "1px solid #0070f3",
                background:
                  submitting ||
                  (lawsuitOptions.amountSoughtMode === "custom" &&
                    parseMoneyInput(lawsuitOptions.customAmountSought) === null)
                    ? "#f3f4f6"
                    : "#0070f3",
                color:
                  submitting ||
                  (lawsuitOptions.amountSoughtMode === "custom" &&
                    parseMoneyInput(lawsuitOptions.customAmountSought) === null)
                    ? "#666"
                    : "#fff",
                borderRadius: 4,
                cursor:
                  submitting ||
                  (lawsuitOptions.amountSoughtMode === "custom" &&
                    parseMoneyInput(lawsuitOptions.customAmountSought) === null)
                    ? "not-allowed"
                    : "pointer",
                fontWeight: 700,
              }}
            >
              {submitting ? "Generating..." : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    )}

    {showCloseModal && (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
      >
        <div
          style={{
            width: 460,
            background: "#fff",
            borderRadius: 8,
            padding: 22,
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Close Matter</h2>

          <p style={{ marginBottom: 14 }}>
            This will close matter <strong>{textValue(closeMatterTarget?.displayNumber)}</strong> in Clio
            and write the selected Close Reason.
          </p>

          <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
            Close Reason
          </label>

          <select
            value={closeReason}
            onChange={(e) => setCloseReason(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              marginBottom: 18,
              border: "1px solid #bbb",
              borderRadius: 4,
            }}
          >
            <option value="">Select Close Reason</option>
            {VALID_CLOSE_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              onClick={() => {
                setShowCloseModal(false);
                setCloseMatterTarget(null);
                setCloseReason("");
              }}
              disabled={closing}
              style={{
                padding: "8px 12px",
                border: "1px solid #aaa",
                background: "#fff",
                borderRadius: 4,
                cursor: closing ? "not-allowed" : "pointer",
              }}
            >
              Cancel
            </button>

            <button
              onClick={handleCloseMatter}
              disabled={!closeReason || closing}
              style={{
                padding: "8px 12px",
                border: "1px solid #dc2626",
                background: !closeReason || closing ? "#f3f4f6" : "#dc2626",
                color: !closeReason || closing ? "#666" : "#fff",
                borderRadius: 4,
                cursor: !closeReason || closing ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
            >
              {closing ? "Closing..." : "Close Matter"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
