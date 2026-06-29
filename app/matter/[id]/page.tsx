"use client";

import { formatDateOnlyForDisplay } from "@/lib/dateOnlyDisplay";
import { BARSH_MATTER_STATUS_OPTIONS } from "@/lib/matterStatusOptions";

const DIRECT_MATTER_SETTLEMENTS_ENABLED = false;

import { Fragment, useEffect, useMemo, useState } from "react";
import BarshHeaderQuickNav from "@/app/components/BarshHeaderQuickNav";
import BarshHeaderActions from "@/app/components/BarshHeaderActions";
import { documentDeliverySafetyNote, resolvePrintableUrl, type DocumentDeliveryContext } from "@/lib/documents/delivery";

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
  return formatDateOnlyForDisplay(v);
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

function directMatterClaimAmountValue(matter: any): number {
  return num(matter?.claimAmount ?? matter?.claim_amount);
}

function directMatterPaymentPostedValue(matter: any): number {
  return num(
    matter?.paymentVoluntary ??
      matter?.payment_voluntary ??
      matter?.paymentAmount ??
      matter?.payment_amount
  );
}

function currentDirectMatterBalancePresuit(matter: any): number {
  const storedBalance = num(
    matter?.balancePresuit ??
      matter?.balance_presuit ??
      matter?.balanceAmount ??
      matter?.balance_amount
  );
  if (storedBalance > 0) return storedBalance;

  const claimAmount = directMatterClaimAmountValue(matter);
  const paymentVoluntary = directMatterPaymentPostedValue(matter);
  return Math.max(claimAmount - paymentVoluntary, 0);
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
  | "email_threads"
  | "settlement"
  | "print_queue"
  | "audit_history";

const MATTER_WORKSPACE_TABS: MatterWorkspaceTab[] = [
  "overview",
  "lawsuit",
  "documents",
  "settlement",
  "print_queue",
  "email_threads",
  "audit_history",
];


const matterWorkspaceTabs: Array<{ key: MatterWorkspaceTab; label: string; note: string }> = [
  { key: "lawsuit", label: "Lawsuit", note: "Aggregation and lawsuit metadata" },
  { key: "documents", label: "Documents", note: "Preview, finalize, and Clio upload" },
  { key: "email_threads", label: "Emails", note: "Matter emails and MailDrop threads" },
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
  width: 560,
  height: 152,
  display: "block",
};

const bmGlobalBrlLogoStyle: React.CSSProperties = {
  width: 190,
  height: 126,
  objectFit: "contain",
  display: "block",
};

const bmGlobalLogoLinkStyle: React.CSSProperties = {
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

const bmGlobalLogoStyle: React.CSSProperties = {
  width: 330,
  height: 152,
  minWidth: 330,
  objectFit: "contain",
  objectPosition: "right top",
  display: "block",
  flexShrink: 0,
};

const bmGlobalPrintButtonRowStyle: React.CSSProperties = {
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

const bmGlobalPrintQueueButtonStyle: React.CSSProperties = {
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

function normalizeMatterWorkspaceTab(value: unknown): MatterWorkspaceTab {
  const raw = String(value ?? "").trim();
  return (MATTER_WORKSPACE_TABS as string[]).includes(raw) ? (raw as MatterWorkspaceTab) : "lawsuit";
}

function matterWorkspaceTabFromUrl(): MatterWorkspaceTab {
  if (typeof window === "undefined") return "lawsuit";
  return normalizeMatterWorkspaceTab(new URLSearchParams(window.location.search).get("tab"));
}

function matterUrlWithWorkspaceTab(tab: MatterWorkspaceTab) {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  url.searchParams.set("tab", tab);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const [matterId, setMatterId] = useState<string>("");

  useEffect(() => {
    params.then((p) => setMatterId(p.id));
  }, [params]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function applyMatterTabFromUrl() {
      setActiveWorkspaceTabState(matterWorkspaceTabFromUrl());
    }

    applyMatterTabFromUrl();
    window.addEventListener("popstate", applyMatterTabFromUrl);

    return () => {
      window.removeEventListener("popstate", applyMatterTabFromUrl);
    };
  }, []);

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
  const [startLawsuitPreview, setStartLawsuitPreview] = useState<any>(null);
  const [startLawsuitError, setStartLawsuitError] = useState("");
  const [packetPreview, setPacketPreview] = useState<any>(null);
  const [packetPreviewOpen, setPacketPreviewOpen] = useState(false);
  const [packetLoading, setPacketLoading] = useState(false);
  const [documentPreview, setDocumentPreview] = useState<any>(null);
  const [documentPreviewLoading, setDocumentPreviewLoading] = useState(false);
  const [matterDocumentDataPreviewLoading, setMatterDocumentDataPreviewLoading] = useState(false);
  const [matterDocumentTemplateQuery, setMatterDocumentTemplateQuery] = useState("");
  const [matterSelectedDocumentTemplateKey, setMatterSelectedDocumentTemplateKey] = useState("");
  const [matterDocumentSignerEmail, setMatterDocumentSignerEmail] = useState("dbarshay@brlfirm.com");
  const [matterDocumentWorkflowStage, setMatterDocumentWorkflowStage] = useState<"select" | "chooseAction" | "preview" | "edit" | "finalize" | "delivery">("select");

  const [matterDocumentDataPreview, setMatterDocumentDataPreview] = useState<any>(null);
  const [matterDocumentGenerationPopupOpen, setMatterDocumentGenerationPopupOpen] = useState(false);
  const [matterDocumentDeliveryToOverride, setMatterDocumentDeliveryToOverride] = useState("");
  const [finalizeUploadLoading, setFinalizeUploadLoading] = useState(false);
  const [finalizeUploadResult, setFinalizeUploadResult] = useState<any>(null);
  const [matterDocumentFinalizationResult, setMatterDocumentFinalizationResult] = useState<any>(null);
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
  const [emailThreadPreviewLoading, setEmailThreadPreviewLoading] = useState(false);
  const [emailThreadPreviewResult, setEmailThreadPreviewResult] = useState<any>(null);
  const [emailThreadLastCheckedAt, setEmailThreadLastCheckedAt] = useState("");
  const [graphThreadSyncPreviewLoading, setGraphThreadSyncPreviewLoading] = useState(false);
  const [graphThreadSyncPreviewResult, setGraphThreadSyncPreviewResult] = useState<any>(null);
  const [graphThreadSyncPreviewConversationId, setGraphThreadSyncPreviewConversationId] = useState<string>("");
  const [graphThreadSyncLoading, setGraphThreadSyncLoading] = useState(false);
  const [graphThreadSyncResult, setGraphThreadSyncResult] = useState<any>(null);
  const [graphThreadSyncConversationId, setGraphThreadSyncConversationId] = useState<string>("");
  const [expandedEmailThreadId, setExpandedEmailThreadId] = useState<string | null>(null);
  const [expandedEmailMessageId, setExpandedEmailMessageId] = useState<string | null>(null);
  const [matterViewEmailsPopupOpen, setMatterViewEmailsPopupOpen] = useState(false);
  const [matterClioDocumentsLoading, setMatterClioDocumentsLoading] = useState(false);
  const [matterClioDocumentsResult, setMatterClioDocumentsResult] = useState<any>(null);
  const [matterViewDocumentsPopupOpen, setMatterViewDocumentsPopupOpen] = useState(false);
  const [matterSelectedViewDocumentId, setMatterSelectedViewDocumentId] = useState("");
  const [matterDocumentActivityPopupOpen, setMatterDocumentActivityPopupOpen] = useState(false);
  const [matterDocumentActivityLoading, setMatterDocumentActivityLoading] = useState(false);
  const [matterDocumentActivityError, setMatterDocumentActivityError] = useState("");
  const [matterDocumentActivityResult, setMatterDocumentActivityResult] = useState<any>(null);

  const [activeWorkspaceTab, setActiveWorkspaceTabState] =
    useState<MatterWorkspaceTab>(() => matterWorkspaceTabFromUrl());

  function setActiveWorkspaceTab(tab: MatterWorkspaceTab, options: { updateUrl?: boolean; replaceUrl?: boolean } = {}) {
    const nextTab = normalizeMatterWorkspaceTab(tab);
    setActiveWorkspaceTabState(nextTab);

    if (typeof window !== "undefined" && options.updateUrl !== false) {
      const nextUrl = matterUrlWithWorkspaceTab(nextTab);
      const currentUrl = `${window.location.pathname}${window.location.search}`;

      if (nextUrl && nextUrl !== currentUrl) {
        if (options.replaceUrl) {
          window.history.replaceState({ barshMattersMatterTab: true }, "", nextUrl);
        } else {
          window.history.pushState({ barshMattersMatterTab: true }, "", nextUrl);
        }
      }
    }
  }
  useEffect(() => {
    if (!matterViewEmailsPopupOpen) return;
    if (emailThreadPreviewLoading || emailThreadPreviewResult) return;
    void loadMatterEmailThreadPreview();
  }, [matterViewEmailsPopupOpen, emailThreadPreviewLoading, emailThreadPreviewResult]);

  function directMatterNumericIdForDocuments(): number {
    const candidates = [
      matterId,
      matter?.matterId,
      matter?.matter_id,
      matter?.id,
      matter?.displayNumber,
      matter?.display_number,
    ];

    for (const candidate of candidates) {
      const raw = textValue(candidate);
      if (!raw) continue;

      const direct = Number(raw);
      if (Number.isFinite(direct) && direct > 0) return direct;

      const brlMatch = raw.toUpperCase().match(/^BRL\s*(\d+)$/);
      if (brlMatch?.[1]) {
        const parsed = Number(brlMatch[1]);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      }

      const digitMatch = raw.match(/(\d{5,})/);
      if (digitMatch?.[1]) {
        const parsed = Number(digitMatch[1]);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      }
    }

    return 0;
  }

  async function loadMatterClioDocuments() {
    const numericMatterId = directMatterNumericIdForDocuments();

    if (!Number.isFinite(numericMatterId) || numericMatterId <= 0) {
      setMatterClioDocumentsResult({
        ok: false,
        error: "No valid direct matter ID is available for Clio document lookup.",
        documents: [],
      });
      return;
    }

    try {
      setMatterClioDocumentsLoading(true);

      const response = await fetch(
        `/api/documents/clio-matter-documents?matterId=${encodeURIComponent(String(numericMatterId))}`,
        { cache: "no-store" }
      );
      const json = await response.json().catch(() => null);

      setMatterClioDocumentsResult(
        json || {
          ok: false,
          error: "Could not parse Clio document list response.",
          documents: [],
        }
      );
    } catch (error: any) {
      setMatterClioDocumentsResult({
        ok: false,
        error: error?.message || String(error),
        documents: [],
      });
    } finally {
      setMatterClioDocumentsLoading(false);
    }
  }

  function matterClioDocumentsArray(): any[] {
    return Array.isArray(matterClioDocumentsResult?.documents)
      ? matterClioDocumentsResult.documents
      : [];
  }

  function selectedMatterViewDocument(): any {
    return matterClioDocumentsArray().find((doc: any) => textValue(doc.clioDocumentId) === matterSelectedViewDocumentId) || null;
  }

  async function openMatterViewDocumentsPopup() {
    setMatterViewDocumentsPopupOpen(true);
    setMatterSelectedViewDocumentId("");

    if (!matterClioDocumentsResult && !matterClioDocumentsLoading) {
      await loadMatterClioDocuments();
    }
  }

  function closeMatterViewDocumentsPopup() {
    setMatterViewDocumentsPopupOpen(false);
    setMatterSelectedViewDocumentId("");
  }

  function matterViewDocumentListDisplayName(doc: any): string {
    const raw = textValue(doc?.latestDocumentVersion?.filename) || textValue(doc?.clioDocumentFilename) || textValue(doc?.clioDocumentName) || "Document";
    const parts = raw.split(" - ").map((part) => part.trim()).filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : raw;
  }

  function formatMatterDocumentUploadedSavedDate(value: unknown): string {
    const raw = textValue(value);
    if (!raw) return "—";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    return date.toLocaleString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function openDirectMatterListedDocument(doc: any, id: string, displayName: string): void {
    if (!id) return;
    setMatterSelectedViewDocumentId(id);
    const contentType = textValue(doc?.latestDocumentVersion?.contentType).toLowerCase();
    const lowerFilename = displayName.toLowerCase();
    const params = new URLSearchParams();
    params.set("documentId", id);
    params.set("filename", displayName);
    if (lowerFilename.endsWith(".pdf") || contentType.includes("pdf")) {
      params.set("mode", "inline");
      window.open("/api/documents/clio-document-open?" + params.toString(), "_blank", "noopener,noreferrer");
      return;
    }
    if (lowerFilename.endsWith(".eml") || contentType.includes("message/rfc822") || contentType.includes("eml")) {
      params.set("mode", "email-pdf");
      window.open("/api/documents/clio-document-open?" + params.toString(), "_blank", "noopener,noreferrer");
      return;
    }
    if (lowerFilename.endsWith(".docx") || lowerFilename.endsWith(".doc") || contentType.includes("word") || contentType.includes("docx") || contentType.includes("msword")) {
      params.set("mode", "edit");
      const editUrl = window.location.origin + "/api/documents/clio-document-open?" + params.toString();
      window.location.href = "ms-word:ofe|u|" + editUrl;
    }
  }

  function renderMatterViewDocumentsPopup() {
    if (!matterViewDocumentsPopupOpen) return null;

    const docs = matterClioDocumentsArray();
    const selectedDocument = selectedMatterViewDocument();

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="View Documents"
        onClick={closeMatterViewDocumentsPopup}
        onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeMatterViewDocumentsPopup(); } }}
        tabIndex={-1}
        style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(15, 23, 42, 0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      >
        <div onClick={(event) => event.stopPropagation()} style={{ width: "min(920px, 96vw)", maxHeight: "88vh", overflow: "hidden", border: "1px solid #1e3a8a", borderRadius: 18, background: "#ffffff", boxShadow: "0 28px 90px rgba(15, 23, 42, 0.34)", display: "flex", flexDirection: "column" }}>
          <div data-barsh-direct-view-documents-header-standard="true" style={{ display: "grid", gridTemplateColumns: "90px minmax(0, 1fr) 90px", alignItems: "center", gap: 14, padding: "16px 20px", background: "#1e3a8a", color: "#ffffff", textAlign: "center", borderBottom: "1px solid #1e3a8a", borderTopLeftRadius: 18, borderTopRightRadius: 18 }}>
            <div aria-hidden="true" />
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 950, color: "#ffffff" }}>View Documents</h2>
            <div aria-hidden="true" />
          </div>

          <div style={{ padding: 20, display: "grid", gap: 14, maxHeight: "calc(88vh - 154px)", overflowY: "auto" }}>
            <div style={{ color: "#334155", fontSize: 13, fontWeight: 900 }}>Documents: {docs.length}</div>
            {matterClioDocumentsResult?.ok === false && (
              <div style={{ padding: 12, border: "1px solid #fecaca", borderRadius: 10, background: "#fef2f2", color: "#991b1b", fontWeight: 850 }}>
                {textValue(matterClioDocumentsResult.error) || "Could not load Clio documents."}
              </div>
            )}

            {matterClioDocumentsLoading && (
              <div style={{ padding: 12, border: "1px solid #cbd5e1", borderRadius: 10, background: "#f8fafc", color: "#475569", fontWeight: 800 }}>Loading documents from Clio...</div>
            )}

            {matterClioDocumentsResult?.ok && docs.length === 0 && (
              <div style={{ padding: 12, border: "1px dashed #cbd5e1", borderRadius: 10, background: "#f8fafc", color: "#64748b", fontWeight: 800 }}>No documents are currently saved for this matter.</div>
            )}

            {docs.length > 0 && (
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                {docs.map((doc: any) => {
                  const id = textValue(doc.clioDocumentId);
                  const displayName = matterViewDocumentListDisplayName(doc);
                  const selected = Boolean(id) && id === matterSelectedViewDocumentId;
                  return (
                    <button key={id || textValue(doc.clioDocumentName)} type="button" title="Select and open document." onClick={() => openDirectMatterListedDocument(doc, id, displayName)} style={{ display: "block", width: "100%", textAlign: "left", border: 0, borderBottom: "1px solid #e5e7eb", background: selected ? "#eff6ff" : "#ffffff", color: "#0f172a", padding: 12, cursor: id ? "pointer" : "not-allowed", opacity: id ? 1 : 0.6 }}>
                      <div style={{ fontWeight: 950 }}>{displayName}</div>
                      <div style={{ marginTop: 4, color: "#64748b", fontSize: 12, fontWeight: 700 }}>
                        Uploaded/Saved: {formatMatterDocumentUploadedSavedDate(doc.updatedAt || doc.latestDocumentVersion?.updatedAt)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#f8fafc", padding: 14 }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 950, color: "#0f172a" }}>Selected Document</h3>
              {selectedDocument ? (
                <div style={{ display: "grid", gap: 8, color: "#334155", fontSize: 13, fontWeight: 800 }}>
                  <div><strong>Filename:</strong> {matterViewDocumentListDisplayName(selectedDocument)}</div>
                  <div><strong>Updated:</strong> {formatMatterDocumentUploadedSavedDate(selectedDocument.updatedAt || selectedDocument.latestDocumentVersion?.updatedAt)}</div>
                  <div><strong>Type:</strong> {textValue(selectedDocument.latestDocumentVersion?.contentType || selectedDocument.contentType) || "—"}</div>
                  <div><strong>Size:</strong> {textValue(selectedDocument.latestDocumentVersion?.size || selectedDocument.size) || "—"}</div>
                </div>
              ) : (
                <div style={{ color: "#64748b", fontSize: 13, fontWeight: 800 }}>Select a document to view its stored Clio metadata.</div>
              )}
            </div>
          </div>

          <div data-barsh-direct-view-documents-footer-actions="true" style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 20px 18px", borderTop: "1px solid #e2e8f0", background: "#ffffff" }}>
            <button type="button" onClick={closeMatterViewDocumentsPopup} style={{ minWidth: 96, height: 40, border: "1px solid #cbd5e1", borderRadius: 10, background: "#f8fafc", color: "#334155", fontWeight: 900, cursor: "pointer" }}>Close</button>
            <button type="button" onClick={() => void loadMatterClioDocuments()} disabled={matterClioDocumentsLoading} style={{ minWidth: 138, height: 40, border: "1px solid #1e3a8a", borderRadius: 10, background: matterClioDocumentsLoading ? "#dbeafe" : "#1e3a8a", color: "#ffffff", fontWeight: 950, cursor: matterClioDocumentsLoading ? "not-allowed" : "pointer" }}>{matterClioDocumentsLoading ? "Refreshing..." : "Refresh Documents"}</button>
          </div>
        </div>
      </div>
    );
  }

  function directMatterDisplayNumberForDocumentActivity(): string {
    const numericId = directMatterNumericIdForDocuments();
    const candidates = [
      textValue(matter?.displayNumber),
      textValue(matter?.matterDisplayNumber),
      textValue(matter?.display_number),
      textValue(matter?.matter_number),
      textValue(matter?.matterNumber),
      textValue(matter?.brlNumber),
      numericId ? `BRL${numericId}` : "",
      matterId ? `BRL${String(matterId).replace(/^BRL/i, "")}` : "",
    ].filter(Boolean);

    return candidates[0] || "";
  }

  function formatMatterDocumentActivityDate(value: unknown): string {
    if (!value) return "—";
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  }

  function formatMatterDocumentActivityStatus(value: unknown): string {
    const text = String(value || "").trim();
    return text || "—";
  }

  function describeMatterDocumentActivityEvent(event: any): string {
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

  async function loadMatterDocumentActivity() {
    const lookupMatterDisplayNumber = directMatterDisplayNumberForDocumentActivity();
    if (!lookupMatterDisplayNumber) {
      setMatterDocumentActivityResult(null);
      setMatterDocumentActivityError("Missing direct matter number.");
      return;
    }

    setMatterDocumentActivityLoading(true);
    setMatterDocumentActivityError("");

    try {
      const response = await fetch(
        `/api/documents/finalization-history?matterDisplayNumber=${encodeURIComponent(lookupMatterDisplayNumber)}&limit=50`,
        { cache: "no-store" }
      );
      const json = await response.json();
      setMatterDocumentActivityResult(json);
      if (!response.ok || !json?.ok) {
        setMatterDocumentActivityError(json?.error || "Document activity lookup failed.");
      }
    } catch (err: any) {
      setMatterDocumentActivityResult(null);
      setMatterDocumentActivityError(err?.message || "Document activity lookup failed.");
    } finally {
      setMatterDocumentActivityLoading(false);
    }
  }

  function openMatterDocumentActivityPopup() {
    setMatterDocumentActivityPopupOpen(true);
    void loadMatterDocumentActivity();
  }

  function closeMatterDocumentActivityPopup() {
    setMatterDocumentActivityPopupOpen(false);
    setMatterDocumentActivityError("");
  }

  function renderMatterDocumentActivityPopup() {
    if (!matterDocumentActivityPopupOpen) return null;

    const events = Array.isArray(matterDocumentActivityResult?.events)
      ? matterDocumentActivityResult.events
      : [];

    const sections = matterDocumentActivityResult?.sections || {};
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
        aria-label="Direct Matter Document Activity"
        tabIndex={-1}
        onClick={closeMatterDocumentActivityPopup}
        onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeMatterDocumentActivityPopup(); } }}
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
            overflow: "hidden",
            minWidth: 780,
            minHeight: 460,
            background: "#ffffff",
            borderRadius: 18,
            border: "1px solid #1e3a8a",
            boxShadow: "0 28px 90px rgba(15, 23, 42, 0.34)",
          }}
        >
          <div style={{ padding: "16px 20px", background: "#1e3a8a", color: "#ffffff", textAlign: "center", borderTopLeftRadius: 18, borderTopRightRadius: 18 }}>
            <div style={{ fontSize: 20, fontWeight: 950 }}>
              Document Activity
            </div>
            <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, opacity: 0.92 }}>
              Matter {directMatterDisplayNumberForDocumentActivity() || "—"}
            </div>
          </div>

          <div style={{ padding: 18, maxHeight: "calc(100vh - 250px)", overflowY: "auto" }}>
            <div
              style={{
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
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>
                  {label}
                </div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950, color: "#0f172a" }}>
                  {String(count)}
                </div>
              </div>
            ))}
          </div>

          {matterDocumentActivityError && (
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
              {matterDocumentActivityError}
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
                color: "#475569",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              <div style={{ padding: 12 }}>Date</div>
              <div style={{ padding: 12 }}>Activity</div>
              <div style={{ padding: 12 }}>Status</div>
              <div style={{ padding: 12 }}>Details</div>
            </div>

            {matterDocumentActivityLoading && events.length === 0 ? (
              <div style={{ padding: 18, fontSize: 13, color: "#64748b", fontWeight: 800 }}>
                Loading document activity...
              </div>
            ) : events.length === 0 ? (
              <div style={{ padding: 18, fontSize: 13, color: "#64748b", fontWeight: 800 }}>
                No document activity found for this matter.
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
                    color: "#0f172a",
                  }}
                >
                  <div style={{ padding: 12, color: "#475569", fontWeight: 800 }}>
                    {formatMatterDocumentActivityDate(event.occurredAt)}
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
                        color: "#334155",
                      }}
                    >
                      {formatMatterDocumentActivityStatus(event.status)}
                    </span>
                  </div>
                  <div style={{ padding: 12, color: "#334155", lineHeight: 1.45 }}>
                    {describeMatterDocumentActivityEvent(event)}
                  </div>
                </div>
              ))
            )}
          </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              padding: "14px 18px",
              borderTop: "1px solid #e2e8f0",
              background: "#ffffff",
              borderBottomLeftRadius: 18,
              borderBottomRightRadius: 18,
            }}
          >
            <button type="button" onClick={closeMatterDocumentActivityPopup} style={{ minWidth: 96, height: 38, border: "1px solid #cbd5e1", borderRadius: 10, background: "#f8fafc", color: "#334155", fontWeight: 900, cursor: "pointer" }}>Close</button>
            <button type="button" onClick={() => void loadMatterDocumentActivity()} disabled={matterDocumentActivityLoading} style={{ minWidth: 104, height: 38, border: "1px solid #1e3a8a", borderRadius: 10, background: matterDocumentActivityLoading ? "#93c5fd" : "#1e3a8a", color: "#ffffff", fontWeight: 900, cursor: matterDocumentActivityLoading ? "not-allowed" : "pointer" }}>{matterDocumentActivityLoading ? "Loading..." : "Refresh"}</button>
          </div>
        </div>
      </div>
    );
  }


  function renderMatterClioDocumentsPanel() {
    const docs = matterClioDocumentsArray();

    return (
      <div
        style={{
          marginTop: 14,
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
              Read-only document vault listing
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>
              Lists the current Clio Documents tab contents for this direct matter.  This does not upload, download, generate, email, print, queue, or write anything.
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadMatterClioDocuments()}
            disabled={matterClioDocumentsLoading}
            style={{
              border: "1px solid #1d4ed8",
              background: matterClioDocumentsLoading ? "#dbeafe" : "#2563eb",
              color: "#ffffff",
              borderRadius: 999,
              padding: "8px 12px",
              fontWeight: 900,
              cursor: matterClioDocumentsLoading ? "not-allowed" : "pointer",
            }}
          >
            {matterClioDocumentsLoading ? "Refreshing..." : "Refresh Clio Documents"}
          </button>
        </div>

        {matterClioDocumentsResult && (
          <div style={{ marginTop: 12 }}>
            {!matterClioDocumentsResult.ok && (
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
                {textValue(matterClioDocumentsResult.error) || "Could not load Clio documents."}
              </div>
            )}

            {matterClioDocumentsResult.ok && (
              <>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  <span style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 12, fontWeight: 850 }}>
                    Clio Matter ID: {textValue(matterClioDocumentsResult.clioMatterId) || "—"}
                  </span>
                  <span style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 12, fontWeight: 850 }}>
                    Documents: {matterClioDocumentsResult.summary?.documentCount ?? docs.length}
                  </span>
                  <span style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 12, fontWeight: 850 }}>
                    Fully Uploaded: {matterClioDocumentsResult.summary?.fullyUploadedCount ?? "—"}
                  </span>
                </div>

                {docs.length === 0 ? (
                  <div style={{ padding: 10, border: "1px dashed #cbd5e1", borderRadius: 8, background: "#ffffff", color: "#64748b", fontWeight: 750 }}>
                    No documents are currently saved for this matter.
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
                          <tr key={textValue(doc.clioDocumentId) || textValue(doc.clioDocumentName)}>
                            <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontWeight: 800 }}>
                              {textValue(doc.clioDocumentName) || textValue(doc.clioDocumentFilename) || "Untitled"}
                              <div style={{ color: "#64748b", fontWeight: 650 }}>{textValue(doc.clioDocumentFilename) || "—"}</div>
                            </td>
                            <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontFamily: "monospace" }}>
                              {textValue(doc.latestDocumentVersion?.uuid) || "—"}
                            </td>
                            <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>
                              {textValue(doc.latestDocumentVersion?.contentType) || "—"}
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
  const [directActionGroup, setDirectActionGroup] = useState<"payments" | "documents" | null>(null);
  const [directPaymentsPanelOpen, setDirectPaymentsPanelOpen] = useState(false);
  const [paymentAmountInput, setPaymentAmountInput] = useState("");
  const [paymentDateInput, setPaymentDateInput] = useState(() => formatPaymentDateYYYYMMDD(new Date()));
  const [paymentTransactionTypeInput, setPaymentTransactionTypeInput] = useState("Voluntary Payment");
  const [paymentTransactionStatusInput, setPaymentTransactionStatusInput] = useState("Show on Remittance");
  const [paymentTransactionTypeOptions, setPaymentTransactionTypeOptions] = useState<any[]>([]);
  const [paymentTransactionStatusOptions, setPaymentTransactionStatusOptions] = useState<any[]>([]);
  const [paymentTransactionOptionsLoading, setPaymentTransactionOptionsLoading] = useState(false);
  const [paymentCheckDateInput, setPaymentCheckDateInput] = useState("");
  const [paymentCheckNumberInput, setPaymentCheckNumberInput] = useState("");
  const [paymentVoidLoadingId, setPaymentVoidLoadingId] = useState<number | null>(null);
  const [paymentEditingReceipt, setPaymentEditingReceipt] = useState<any>(null);
  const [paymentShowVoided, setPaymentShowVoided] = useState(true);
  const [expandedPaymentReceiptId, setExpandedPaymentReceiptId] = useState<number | null>(null);
  const [paymentClosePromptOpen, setPaymentClosePromptOpen] = useState(false);
  const [directFieldEditModal, setDirectFieldEditModal] = useState<"claimAmount" | "dos" | "denialReason" | "status" | null>(null);
  const [directFieldEditLoading, setDirectFieldEditLoading] = useState(false);
  const [directFieldEditResult, setDirectFieldEditResult] = useState<any>(null);
  const [directFieldPicklistsLoading, setDirectFieldPicklistsLoading] = useState(false);
  const [directFieldPicklists, setDirectFieldPicklists] = useState<any>(null);
  const [identityFieldEditModal, setIdentityFieldEditModal] = useState<"patient_name" | "client_name" | "insurer_name" | "claim_number_raw" | "date_of_loss" | null>(null);
  const [identityFieldEditInput, setIdentityFieldEditInput] = useState("");
  const [identityFieldEditSelectedOptionId, setIdentityFieldEditSelectedOptionId] = useState("");
  const [identityReferenceOptions, setIdentityReferenceOptions] = useState<Record<string, any[]>>({});
  const [identityReferenceOptionsLoading, setIdentityReferenceOptionsLoading] = useState(false);
  const [identityFieldEditLoading, setIdentityFieldEditLoading] = useState(false);
  const [identityFieldEditResult, setIdentityFieldEditResult] = useState<any>(null);
  const [claimAmountInput, setClaimAmountInput] = useState("");
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

  const fallbackPaymentTransactionTypeOptions = [
    "Voluntary Payment",
    "Interest",
    "PreC to Provider",
  ];

  const paymentTransactionTypeFallbackOptions = [
    "Voluntary Payment",
    "Interest",
    "PreC to Provider",
  ];

  const fallbackPaymentTransactionStatusOptions = [
    "Show on Remittance",
    "Do Not Show on Remittance",
  ];

  function referenceOptionDisplayName(option: any): string {
    return String(option?.displayName || option?.label || option?.value || "").trim();
  }

  function directPaymentTransactionTypeDisplay(value: unknown): string {
    const text = String(value ?? "").trim();
    const normalized = text.toLowerCase();
    if (normalized === "voluntary payment") return "Voluntary";
    if (normalized === "prec to provider" || normalized === "direct pay to provider") return "Direct Pay to Provider";
    return text || "—";
  }

  function paymentTransactionTypeDropdownOptions(): string[] {
    return paymentTransactionTypeFallbackOptions;
  }

  function paymentTransactionStatusDropdownOptions(): string[] {
    const loaded = paymentTransactionStatusOptions.map(referenceOptionDisplayName).filter(Boolean);
    return loaded.length ? loaded : fallbackPaymentTransactionStatusOptions;
  }

  async function loadPaymentTransactionReferenceOptions() {
    setPaymentTransactionOptionsLoading(true);
    try {
      const [typeResponse, statusResponse] = await Promise.all([
        fetch("/api/reference-data/options?type=transaction_type", { cache: "no-store" }),
        fetch("/api/reference-data/options?type=transaction_status", { cache: "no-store" }),
      ]);

      const [typeJson, statusJson] = await Promise.all([
        typeResponse.json().catch(() => ({})),
        statusResponse.json().catch(() => ({})),
      ]);

      setPaymentTransactionTypeOptions(Array.isArray(typeJson?.options) ? typeJson.options : []);
      setPaymentTransactionStatusOptions(Array.isArray(statusJson?.options) ? statusJson.options : []);
    } catch {
      setPaymentTransactionTypeOptions([]);
      setPaymentTransactionStatusOptions([]);
    } finally {
      setPaymentTransactionOptionsLoading(false);
    }
  }

  useEffect(() => {
    void loadPaymentTransactionReferenceOptions();
  }, []);

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
      } else if (/^\d+$/.test(String(matterId || ""))) {
        params.set("matterDisplayNumber", String(matterId));
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
      window.alert(error?.message || "Administrator session check failed.");
    }
  }

  function openAdministratorMenu() {
    window.location.href = "/admin";
  }



  function openMatterAuditHistoryTab() {
    void runAdministratorGate(
      "Open Matter Audit / History",
      () => {
        setMatterAuditHistoryPopupOpen(true);
        void loadMatterAuditHistory();
      }
    );
  }

  function closeMatterAuditHistoryPopup() {
    setMatterAuditHistoryPopupOpen(false);
  }

  function selectedTreatingProviderOption(): any {
    return treatingProviderOptions.find((option: any) => String(option?.id) === String(treatingProviderInput)) || null;
  }

  function localTreatingProviderName(): string {
    return (
      textValue(claimIndexTreatingProviderField?.fieldValue) ||
      textValue(matter?.treatingProvider || matter?.treating_provider)
    );
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
    const numericMatterId = resolvedNumericMatterId();
    if (!numericMatterId) return;

    setTreatingProviderResult(null);

    const [optionsJson, fieldJson] = await Promise.all([
      loadTreatingProviderOptions(),
      fetch(
        `/api/matters/identity-field?matterId=${encodeURIComponent(String(numericMatterId))}&fieldName=treating_provider`,
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
    const numericMatterId = resolvedNumericMatterId();

    if (!numericMatterId) {
      setTreatingProviderResult({ ok: false, error: "No valid local matter ID is available.  Reopen this matter from search or refresh the page before saving." });
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
          matterId: numericMatterId,
          matterDisplayNumber: textValue(matter?.displayNumber || matter?.display_number || matterId),
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

  function isCostRecoveryPaymentTransactionType(value: unknown): boolean {
    const normalized = textValue(value).toLowerCase();
    if (normalized === "interest" || normalized === "interest payment" || normalized.includes("interest collected")) return true;
    return [
      "filing fee collected",
      "index fee collected",
      "service fee collected",
      "other court costs collected",
      "other court fees collected",
    ].includes(normalized);
  }

  function paymentFormDeltaValue(): number {
    const entered = paymentFormAmountValue();
    return paymentEditingReceipt ? entered - paymentFormOriginalAmountValue() : entered;
  }

  function paymentFormRequiredFieldsComplete(): boolean {
    return (
      paymentFormAmountValue() > 0 &&
      !!textValue(paymentDateInput) &&
      !!textValue(paymentTransactionTypeInput) &&
      !!textValue(paymentTransactionStatusInput) &&
      !!textValue(paymentCheckDateInput) &&
      !!textValue(paymentCheckNumberInput)
    );
  }

  function paymentFormSubmitDisabled(): boolean {
    return paymentApplyLoading || matterPaymentControlsDisabled() || !paymentFormRequiredFieldsComplete();
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
    const rawFinalStatus = textValue(matter?.finalStatus || matter?.final_status).toLowerCase();
    if (rawFinalStatus === "closed") return true;
    if (rawFinalStatus === "open") return false;
    return !!textValue(matter?.closeReason || matter?.close_reason);
  }

  function matterIsAggregatedForPayment(): boolean {
    return !!textValue(matter?.masterLawsuitId || matter?.master_lawsuit_id);
  }

  function matterPaymentDisabledReason(): string {
    if (matterIsAggregatedForPayment()) return "Payments must be posted in Lawsuit Screen";
    if (matterIsClosedForPayment()) return "Disabled because this matter is Closed.";
    return "";
  }

  function matterPaymentControlsDisabled(): boolean {
    return matterIsClosedForPayment() || matterIsAggregatedForPayment();
  }

  function matterHasFinalStatusForPayment(): boolean {
    return !!textValue(matter?.finalStatus || matter?.final_status);
  }

  function directMatterFinalStatusDisplayValue(): "Open" | "Closed" {
    const rawFinalStatus = textValue(matter?.finalStatus || matter?.final_status).toLowerCase();
    if (rawFinalStatus === "closed") return "Closed";
    if (rawFinalStatus === "open") return "Open";
    return textValue(matter?.closeReason || matter?.close_reason) ? "Closed" : "Open";
  }

  function directMatterIsClosedForDisplay(): boolean {
    return directMatterFinalStatusDisplayValue() === "Closed";
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

    return "";
  }

  function identityFieldReferenceType(field: "patient_name" | "client_name" | "insurer_name" | "claim_number_raw" | "date_of_loss" | null): string {
    if (field === "client_name") return "provider_client";
    if (field === "insurer_name") return "insurer_company";
    return "";
  }

  function identityFieldUsesReferenceOptions(field: "patient_name" | "client_name" | "insurer_name" | "claim_number_raw" | "date_of_loss" | null): boolean {
    return Boolean(identityFieldReferenceType(field));
  }

  function identityReferenceOptionLabel(option: any): string {
    return textValue(option?.displayName || option?.name || option?.value || option?.label);
  }

  function identityReferenceOptionValue(option: any): string {
    return textValue(option?.displayName || option?.name || option?.value || option?.label);
  }

  async function loadIdentityReferenceOptions(field: "patient_name" | "client_name" | "insurer_name" | "claim_number_raw" | "date_of_loss" | null) {
    const referenceType = identityFieldReferenceType(field);
    if (!referenceType) return [];

    const existing = identityReferenceOptions[referenceType];
    if (Array.isArray(existing) && existing.length) return existing;

    setIdentityReferenceOptionsLoading(true);

    try {
      const response = await fetch(`/api/reference-data/options?type=${encodeURIComponent(referenceType)}`, {
        cache: "no-store",
      });
      const json = await response.json().catch(() => ({}));
      const options = Array.isArray(json?.options) ? json.options : [];

      setIdentityReferenceOptions((prev) => ({
        ...prev,
        [referenceType]: options,
      }));

      return options;
    } catch {
      setIdentityReferenceOptions((prev) => ({
        ...prev,
        [referenceType]: [],
      }));
      return [];
    } finally {
      setIdentityReferenceOptionsLoading(false);
    }
  }

  function identityFieldEditLabel(field: "patient_name" | "client_name" | "insurer_name" | "claim_number_raw" | "date_of_loss" | null): string {
    if (field === "patient_name") return "Patient";
    if (field === "client_name") return "Provider";
    if (field === "insurer_name") return "Insurer";
    if (field === "claim_number_raw") return "Claim Number";
    if (field === "date_of_loss") return "Date of Loss";
    return "Identity Field";
  }

  function identityFieldCurrentValue(field: "patient_name" | "client_name" | "insurer_name" | "claim_number_raw" | "date_of_loss" | null): string {
    if (field === "patient_name") return textValue(matter?.patient?.name || matter?.patient);
    if (field === "client_name") return providerValue(matter);
    if (field === "insurer_name") return insurerValue(matter);
    if (field === "claim_number_raw") return textValue(matter?.claimNumber);
    if (field === "date_of_loss") return textValue(matter?.dateOfLoss || matter?.date_of_loss);
    return "";
  }

  function resolvedNumericMatterId(): number {
    const candidates = [
      matter?.matterId,
      matter?.matter_id,
      matter?.id,
      matterId,
    ];

    for (const candidate of candidates) {
      const numeric = Number(candidate);
      if (Number.isFinite(numeric) && numeric > 0) return numeric;
    }

    return 0;
  }

  function openIdentityFieldEditDialog(field: "patient_name" | "client_name" | "insurer_name" | "claim_number_raw" | "date_of_loss") {
    const currentValue = identityFieldCurrentValue(field);

    setIdentityFieldEditResult(null);
    setIdentityFieldEditInput(currentValue);
    setIdentityFieldEditSelectedOptionId("");
    setIdentityFieldEditModal(field);

    loadIdentityReferenceOptions(field).then((options) => {
      const match = Array.isArray(options)
        ? options.find((option: any) => identityReferenceOptionValue(option) === currentValue)
        : null;
      if (match?.id) setIdentityFieldEditSelectedOptionId(String(match.id));
    });
  }

  function closeIdentityFieldEditDialog() {
    if (identityFieldEditLoading) return;
    setIdentityFieldEditModal(null);
    setIdentityFieldEditResult(null);
    setIdentityFieldEditInput("");
    setIdentityFieldEditSelectedOptionId("");
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

  function applyIdentityFieldToMatterState(field: "patient_name" | "client_name" | "insurer_name" | "claim_number_raw" | "date_of_loss", value: string) {
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

      if (field === "date_of_loss") {
        return {
          ...current,
          dateOfLoss: value,
          date_of_loss: value,
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

      const numericMatterId = resolvedNumericMatterId();

      if (!numericMatterId) {
        setIdentityFieldEditResult({
          ok: false,
          error: "A valid local matter id is required.  Reopen this matter from search or refresh the page before saving.",
        });
        return;
      }

      const response = await fetch("/api/matters/identity-field", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matterId: numericMatterId,
          matterDisplayNumber: textValue(matter?.displayNumber || matter?.display_number || matterId),
          fieldName: identityFieldEditModal,
          fieldValue: value,
          fieldValueId: identityFieldEditSelectedOptionId,
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
      setIdentityFieldEditSelectedOptionId("");
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

  function directFieldMoneyInputValue(value: any): string {
    const raw = String(value ?? "").replace(/[$,]/g, "").trim();
    if (!raw) return "";
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return "";
    return String(parsed);
  }

  function formatMoneyInputValue(value: unknown): string {
  const numeric = num(value);
  if (!Number.isFinite(numeric)) return "";
  return numeric.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseMoneyInputValue(value: string): string {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  if (!cleaned) return "";
  const numeric = Number(cleaned);
  if (!Number.isFinite(numeric)) return "";
  return String(numeric);
}

function formatMoneyEditingInput(value: string): string {
  const cleaned = String(value || "").replace(/[^0-9.]/g, "");
  if (!cleaned) return "";
  return `$${cleaned}`;
}

function openClaimAmountEditDialog() {
    setDirectFieldEditResult(null);
    setClaimAmountInput(formatMoneyInputValue(matter?.claimAmount));
    setDirectFieldEditModal("claimAmount");
  }

  async function saveClaimAmountEditDialog() {
    const claimAmountRaw = parseMoneyInputValue(claimAmountInput);
    const claimAmount = Number(claimAmountRaw);

    if (!claimAmountRaw || !Number.isFinite(claimAmount) || claimAmount < 0) {
      setDirectFieldEditResult({
        ok: false,
        error: "A valid Claim Amount is required.",
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
          matterId: resolvedNumericMatterId(),
          field: "claimAmount",
          claimAmount,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        setDirectFieldEditResult({
          ok: false,
          error: json?.error || "Claim Amount could not be updated.",
          details: json,
        });
        return;
      }

      const nextPayment =
        num(matter?.paymentVoluntary ?? matter?.payment_voluntary ?? matter?.paymentAmount ?? matter?.payment_amount);
      const nextBalance = Math.max(claimAmount - nextPayment, 0);

      setMatter((current: any) => ({
        ...(current || {}),
        ...(json?.matter || {}),
        claimAmount,
        claim_amount: claimAmount,
        balancePresuit: nextBalance,
        balance_presuit: nextBalance,
        balanceAmount: nextBalance,
        balance_amount: nextBalance,
      }));

      setClaimAmountInput(formatMoneyInputValue(claimAmount));

      setDirectFieldEditResult({
        ok: true,
        message: "Claim Amount updated locally.",
        safety: json.safety,
      });

      setDirectFieldEditModal(null);
    } catch (error: any) {
      setDirectFieldEditResult({
        ok: false,
        error: error?.message || "Claim Amount could not be updated.",
      });
    } finally {
      setDirectFieldEditLoading(false);
    }
  }

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
          matterId: resolvedNumericMatterId(),
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

  function picklistOptionsForDirectField(field: "denialReason" | "status"): any[] {
    if (field === "denialReason") {
      return directFieldPicklists?.denialReason?.options || directFieldPicklists?.denialReasons || [];
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
            ...BARSH_MATTER_STATUS_OPTIONS,
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

  async function openPicklistEditDialog(field: "denialReason" | "status") {
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

  }

  function directPicklistFieldLabel(field: "denialReason" | "status"): string {
    if (field === "denialReason") return "Denial Reason";
    return "Status";
  }

  function directPicklistInputValue(field: "denialReason" | "status"): string {
    if (field === "denialReason") return denialReasonInput;
    return matterStageInput;
  }

  function setDirectPicklistInputValue(field: "denialReason" | "status", value: string) {
    if (field === "denialReason") setDenialReasonInput(value);
    if (field === "status") setMatterStageInput(value);
  }

  async function savePicklistEditDialog(field: "denialReason" | "status") {
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
        matterId: resolvedNumericMatterId(),
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
        `/api/matters/apply-payment?matterId=${encodeURIComponent(String(Number(matter?.matterId || matter?.matter_id || matter?.id || targetMatterId)))}&claimAmount=${encodeURIComponent(String(num(matter?.claimAmount)))}`,
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
    setPaymentTransactionTypeInput("Voluntary Payment");
    setPaymentTransactionStatusInput("Show on Remittance");
    setPaymentCheckDateInput("");
    setPaymentCheckNumberInput("");
    setPaymentEditingReceipt(null);
  }

  function beginEditPaymentReceipt(_receipt: any) {
    setPaymentApplyResult({
      ok: false,
      error: "Posted payments cannot be edited. Void the payment and post a corrected payment.",
    });
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

    const editingReceipt = null;
    const paymentDelta = paymentAmount;

    if (matterIsAggregatedForPayment()) {
      setPaymentApplyResult({
        ok: false,
        error: "Payments must be posted in Lawsuit Screen",
      });
      return;
    }

    if (!textValue(paymentTransactionTypeInput)) {
      setPaymentApplyResult({ ok: false, error: "Transaction Type is required." });
      return;
    }

    if (!textValue(paymentTransactionStatusInput)) {
      setPaymentApplyResult({ ok: false, error: "Transaction Status is required." });
      return;
    }

    if (!textValue(paymentCheckDateInput)) {
      setPaymentApplyResult({ ok: false, error: "Check Date is required." });
      return;
    }

    if (!textValue(paymentCheckNumberInput)) {
      setPaymentApplyResult({ ok: false, error: "Check Number is required." });
      return;
    }

    const claimAmount = num(matter?.claimAmount);
    const currentPaymentVoluntary = num(matter?.paymentVoluntary);
    const currentBalancePresuit = currentDirectMatterBalancePresuit(matter);
    const newPaymentVoluntary = currentPaymentVoluntary + paymentDelta;
    const newBalancePresuit = Math.max(currentBalancePresuit - paymentDelta, 0);

    const isCostRecoveryPayment = isCostRecoveryPaymentTransactionType(paymentTransactionTypeInput);

    if (!isCostRecoveryPayment && paymentDelta > currentBalancePresuit) {
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
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matterId: Number(matter?.matterId || matter?.matter_id || matter?.id || matterId),
          expectedDisplayNumber: textValue(matter?.displayNumber),
          paymentAmount,
          paymentDate,
          transactionType: paymentTransactionTypeInput,
          transactionStatus: paymentTransactionStatusInput,
          checkDate: paymentCheckDateInput,
          checkNumber: paymentCheckNumberInput,
          description: directPaymentTransactionTypeDisplay(paymentTransactionTypeInput),
          postingContext: "direct-matter",
          claimAmount: num(matter?.claimAmount),
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Payment save failed.");
      }

      setPaymentApplyResult(json);

      setMatter((prev: any) => {
        if (!prev || !json?.after) return prev;
        const nextPaymentVoluntary = json.after.paymentVoluntary ?? prev.paymentVoluntary ?? prev.payment_voluntary;
        const nextBalancePresuit = json.after.balancePresuit ?? prev.balancePresuit ?? prev.balance_presuit;
        return {
          ...prev,
          paymentVoluntary: nextPaymentVoluntary,
          payment_voluntary: nextPaymentVoluntary,
          balancePresuit: nextBalancePresuit,
          balance_presuit: nextBalancePresuit,
          balanceAmount: nextBalancePresuit,
          balance_amount: nextBalancePresuit,
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
          localParams.set("matterDisplayNumber", String(matterId));
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

      // Local-first transition: do not refresh ClaimIndex from Clio after close.
      // The close route owns any permitted local/legacy state transition.
      window.location.reload();
    } catch (err) {
      alert("Close failed");
    } finally {
      setClosing(false);
    }
  }

  async function previewStartLawsuitFromMatter() {
    if (submitting) return;

    const validationError = validateStartLawsuitInputs();
    if (validationError) {
      setStartLawsuitError(validationError);
      return;
    }

    const selectedRows = startLawsuitSelectedRowsForCreate();
    const invalid = selectedRows.filter(
      (row: any) => isAggregated(row) || !isSelectable(row)
    );

    if (invalid.length > 0) {
      setStartLawsuitError("One or more selected matters are not eligible for lawsuit generation.");
      return;
    }

    setSubmitting(true);
    setStartLawsuitError("");
    setStartLawsuitPreview(null);

    try {
      const selectedMatterIds = selectedRows.map((row: any) => Number(row.id));
      const amountSoughtMode =
        lawsuitOptions.amountSoughtMode === "custom"
          ? "custom"
          : lawsuitOptions.amountSoughtMode === "claim_amount"
          ? "claim_amount"
          : "balance_presuit";
      const selectedVenue = selectedStartLawsuitCourt();
      const customAmountSought =
        amountSoughtMode === "custom" ? parseMoneyInput(lawsuitOptions.customAmountSought) : null;

      const previewRes = await fetch("/api/lawsuits/local-generation-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          matterIds: selectedMatterIds,
          amountSoughtMode,
          customAmountSought,
          venue: selectedVenue,
          venueSelection: selectedVenue,
        }),
      });

      const previewJson = await previewRes.json();

      if (!previewRes.ok || !previewJson?.ok) {
        setStartLawsuitError(previewJson?.error || "Local lawsuit generation preview failed.");
        return;
      }

      setStartLawsuitPreview(previewJson);

      if (!previewJson.canCreate) {
        setStartLawsuitError(previewJson.blockingReason || "Selected matters cannot be used to create a new local lawsuit.");
        return;
      }
    } catch (err: any) {
      setStartLawsuitError(err?.message || "Local lawsuit generation preview failed.");
    } finally {
      setSubmitting(false);
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
      alert("One or more selected matters are not eligible for local lawsuit generation.");
      return;
    }

    setSubmitting(true);

    try {
      const selectedMatterIds = selectedRows.map((r) => Number(r.id));
      const amountSoughtMode =
        lawsuitOptions.amountSoughtMode === "custom"
          ? "custom"
          : lawsuitOptions.amountSoughtMode === "claim_amount"
          ? "claim_amount"
          : "balance_presuit";
      const selectedVenue =
        lawsuitOptions.venue === "Other"
          ? lawsuitOptions.venueOther.trim()
          : lawsuitOptions.venue.trim();
      const customAmountSought =
        amountSoughtMode === "custom" ? parseMoneyInput(lawsuitOptions.customAmountSought) : null;

      const previewRes = await fetch("/api/lawsuits/local-generation-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          matterIds: selectedMatterIds,
          amountSoughtMode,
          customAmountSought,
          venue: selectedVenue,
          venueSelection: selectedVenue,
        }),
      });

      const previewJson = await previewRes.json();

      if (!previewRes.ok || !previewJson?.ok) {
        alert(previewJson?.error || "Local lawsuit generation preview failed.");
        return;
      }

      if (!previewJson.canCreate) {
        alert(previewJson.blockingReason || "Selected matters cannot be used to create a new local lawsuit.");
        return;
      }

      const createRes = await fetch("/api/lawsuits/local-generation-create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          confirm: "create-local-lawsuit",
          matterIds: selectedMatterIds,
          amountSoughtMode,
          customAmountSought,
          venue: selectedVenue,
          venueSelection: selectedVenue,
          notes: lawsuitOptions.notes.trim() || "Created from Start Lawsuit individual matter workflow.",
        }),
      });

      const createJson = await createRes.json();
      createJson.noClioRecordsChangedMessage = "No Clio records were changed.";

      if (!createRes.ok || !createJson?.ok) {
        alert(createJson?.error || "Local lawsuit generation failed.");
        return;
      }

      setShowLawsuitOptionsModal(false);

      const createdMasterLawsuitId = String(createJson.masterLawsuitId || "").trim();

      if (!createdMasterLawsuitId) {
        alert("Local lawsuit was created, but no Master Lawsuit ID was returned.");
        return;
      }

      const createdMasterLawsuitUrl = new URL("/matters", window.location.origin);
      createdMasterLawsuitUrl.searchParams.set("master", createdMasterLawsuitId);
      createdMasterLawsuitUrl.searchParams.set("createdMasterLawsuitId", createdMasterLawsuitId);
      createdMasterLawsuitUrl.searchParams.set("from", "create-lawsuit");

      window.location.assign(`${createdMasterLawsuitUrl.pathname}${createdMasterLawsuitUrl.search}`);
    } catch (err: any) {
      alert(err?.message || "Local lawsuit generation failed.");
    } finally {
      setSubmitting(false);
    }
  }

  

  function openStartLawsuitModalFromMatter() {
    if (submitting) return;

    const currentMatterId = Number(matter?.id || matterId || 0);

    if (!Number.isFinite(currentMatterId) || currentMatterId <= 0) {
      alert("No valid matter is loaded for lawsuit generation.");
      return;
    }

    const currentMatterRow =
      rows.find((r) => Number(r.id) === currentMatterId) ||
      matter;

    if (!currentMatterRow) {
      alert("No matter row is loaded for lawsuit generation.");
      return;
    }

    if (isAggregated(currentMatterRow)) {
      alert("This matter is already part of a lawsuit.");
      return;
    }

    if (!isSelectable(currentMatterRow)) {
      alert("This matter is not eligible for lawsuit generation.");
      return;
    }

    setSelected([currentMatterId]);
    setLawsuitOptions(defaultLawsuitOptions());
    setStartLawsuitPreview(null);
    setStartLawsuitError("");
    setShowLawsuitOptionsModal(true);
  }

  function openLawsuitOptionsModal() {
    openStartLawsuitModalFromMatter();
  }

  async function deaggregateCluster() {
    alert(
      "Legacy de-aggregation is disabled.  Barsh Matters local schema is now the operational source of truth.  A local-first de-aggregation workflow must be built separately before lawsuit memberships can be removed."
    );
  }

  async function expandClaim() {
    if (expanding) return;

    setExpanding(true);

    try {
      alert(
        "Legacy claim expansion is disabled.  Claim grouping now reads from ClaimIndex/local Barsh Matters only.  Add missing matters through the local matter creation/import workflow."
      );
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
    const masterLawsuitId = usableMasterLawsuitIdForDocuments();

    if (!masterLawsuitId) {
      alert("No valid Master Lawsuit ID is available for finalization.  Load or connect a lawsuit first.");
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

  function usableMasterLawsuitIdForDocuments(): string {
    const candidates = [
      packetPreview?.packet?.masterLawsuitId,
      packetPreview?.packet?.master_lawsuit_id,
      packetPreview?.packet?.metadata?.masterLawsuitId?.value,
      packetPreview?.packet?.metadata?.master_lawsuit_id?.value,
      matter?.masterLawsuitId,
      matter?.master_lawsuit_id,
      tabMasterLawsuitId,
    ];

    for (const candidate of candidates) {
      const value = textValue(candidate);
      if (!value) continue;
      if (value === "MASTER_LAWSUIT_ID") continue;
      if (/^\d{4}\.\d{2}\.\d{5}$/.test(value)) return value;
    }

    return "";
  }

  async function loadFinalizePreview() {
    const masterLawsuitId = usableMasterLawsuitIdForDocuments();

    if (!masterLawsuitId) {
      alert("No valid Master Lawsuit ID is available for finalization.  Load or connect a lawsuit first.");
      return;
    }

    setDocumentPreviewLoading(true);

    try {
      const directMatterId = directMatterNumericIdForDocuments();
      const directMatterDisplayNumber =
        textValue(matter?.displayNumber || matter?.display_number) ||
        (directMatterId ? `BRL${directMatterId}` : "");

      const params = new URLSearchParams();
      params.set("masterLawsuitId", masterLawsuitId);
      params.set("uploadTarget", "direct-matter");
      if (directMatterId) params.set("directMatterId", String(directMatterId));
      if (directMatterDisplayNumber) params.set("directMatterDisplayNumber", directMatterDisplayNumber);

      const res = await fetch(`/api/documents/finalize-preview?${params.toString()}`);

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
      alert("Run Finalize Documents Preview successfully before uploading final documents to Barsh Matters Master Repository storage.");
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
      textValue(documentPreview?.clioUploadTarget?.displayNumber) || "the Clio repository storage";
    const targetMatterId = textValue(documentPreview?.clioUploadTarget?.matterId);

    const documentList = uploadableDocuments
      .map((doc: any) => `- ${textValue(doc.label) || textValue(doc.key)}: ${textValue(doc.filename)}`)
      .join("\n");

    const confirmed = confirm(
      `FINALIZE AND UPLOAD TO CLIO\n\n` +
        `Target: ${targetDisplay}${targetMatterId ? ` / Matter ID ${targetMatterId}` : ""}\n\n` +
        `This will upload the following final document copy/copies to the direct bill matter Clio Documents tab:\n\n` +
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
          uploadTargetMode: "direct-matter",
          directMatterId: /^BRL_/i.test(directMatterDisplayNumber) ? null : directMatterNumericIdForDocuments(),
          directMatterDisplayNumber:
            textValue(matter?.displayNumber || matter?.display_number) ||
            (directMatterNumericIdForDocuments() ? `BRL${directMatterNumericIdForDocuments()}` : ""),
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

  async function launchMatterStep2GeneratedDocumentEdit(selectedTemplate: { key: string; label: string; description: string } | null) {
    if (!selectedTemplate?.key) {
      alert("Select a document before editing.");
      return;
    }

    const directMatterId = directMatterNumericIdForDocuments();
    const directMatterDisplayNumber =
      textValue(matter?.displayNumber || matter?.display_number) ||
      (directMatterId ? `BRL${directMatterId}` : "");

    if (!directMatterId && !directMatterDisplayNumber) {
      alert("No valid direct matter ID is available for working-document creation.");
      return;
    }

    const directMatterIdForRequest = /^BRL_/i.test(directMatterDisplayNumber) ? null : directMatterId;

    setDocumentPreviewLoading(true);

    try {
      const response = await fetch("/api/documents/working-docx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmCreate: true,
          uploadTargetMode: "direct-matter",
          directMatterId: directMatterIdForRequest,
          directMatterDisplayNumber,
          signerEmail: matterDocumentSignerEmail.trim() || "dbarshay@brlfirm.com",
          documentKeys: [selectedTemplate.key],
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

      setMatterDocumentFinalizationResult({
        ok: true,
        action: "working-docx-create",
        selectedDocument: json.selectedDocument,
        workingDocument: working,
        note: "Working DOCX created from the direct matter packet. Edit and save in Word Web, then finalize to create the PDF delivery document.",
      });
      setMatterDocumentWorkflowStage("edit");
    } catch (err: any) {
      alert(err?.message || "Could not create the working Word document.");
    } finally {
      setDocumentPreviewLoading(false);
    }
  }


  async function launchMatterStep2PdfPreview(selectedTemplate: { key: string; label: string; description: string } | null) {
    if (!selectedTemplate?.key) {
      alert("Select a document before previewing.");
      return;
    }

    const directMatterId = directMatterNumericIdForDocuments();
    const directMatterDisplayNumber =
      textValue(matter?.displayNumber || matter?.display_number) ||
      (directMatterId ? `BRL${directMatterId}` : "");

    if (!directMatterId && !directMatterDisplayNumber) {
      alert("No valid direct matter ID is available for PDF preview.");
      return;
    }

    const directMatterIdForRequest = /^BRL_/i.test(directMatterDisplayNumber) ? null : directMatterId;

    const previewWindow = window.open("", "_blank");

    if (previewWindow) {
      previewWindow.document.write("<!doctype html><title>Preparing PDF Preview</title><body style='font-family: system-ui, sans-serif; padding: 24px;'>Preparing PDF preview...</body>");
      previewWindow.document.close();
    }

    setDocumentPreviewLoading(true);
    setMatterDocumentWorkflowStage("preview");

    try {
      const workingResponse = await fetch("/api/documents/working-docx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmCreate: true,
          uploadTargetMode: "direct-matter",
          directMatterId: directMatterIdForRequest,
          directMatterDisplayNumber,
          signerEmail: matterDocumentSignerEmail.trim() || "dbarshay@brlfirm.com",
          documentKeys: [selectedTemplate.key],
        }),
      });

      const workingJson = await workingResponse.json().catch(() => null);

      if (!workingResponse.ok || !workingJson?.ok || !workingJson?.workingDocument?.driveItemId) {
        alert(workingJson?.error || "Could not create a working Word document for PDF preview.");
        return;
      }

      const working = workingJson.workingDocument;
      setMatterDocumentFinalizationResult({
        ok: true,
        action: "working-docx-create",
        selectedDocument: workingJson.selectedDocument,
        workingDocument: working,
        note: "Working DOCX created from the direct matter packet for temporary PDF preview.",
      });

      const previewResponse = await fetch("/api/documents/preview-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workingDocumentDriveItemId: working.driveItemId,
          workingDocumentName: working.name || selectedTemplate.label,
          filename: working.originalFilename || working.name || selectedTemplate.label,
        }),
      });

      if (!previewResponse.ok) {
        const errorJson = await previewResponse.json().catch(() => null);
        alert(errorJson?.error || "Could not generate the PDF preview.");
        return;
      }

      const pdfBlob = await previewResponse.blob();
      const pdfUrl = URL.createObjectURL(pdfBlob);

      if (previewWindow) {
        previewWindow.location.href = pdfUrl;
      }

      window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 120000);
    } catch (err: any) {
      alert(err?.message || "Could not generate the PDF preview.");
    } finally {
      setDocumentPreviewLoading(false);
    }
  }


  async function finalizeMatterDocumentFromStep2(selectedTemplate: { key: string; label: string; description: string } | null) {
    if (documentPreviewLoading || finalizeUploadLoading) return;

    if (!selectedTemplate?.key) {
      alert("Select a document before finalizing.");
      return;
    }

    const directMatterId = directMatterNumericIdForDocuments();
    const directMatterDisplayNumber =
      textValue(matter?.displayNumber || matter?.display_number) ||
      (directMatterId ? `BRL${directMatterId}` : "");

    if (!directMatterId && !directMatterDisplayNumber) {
      alert("No valid direct matter ID is available for finalization.");
      return;
    }

    const workingDocument = matterDocumentFinalizationResult?.workingDocument || null;
    const workingDocumentDriveItemId = textValue(workingDocument?.driveItemId);

    if (!workingDocumentDriveItemId) {
      alert("Use Edit Document first, save in Word Web, then click Finalize Document.");
      return;
    }

    const effectiveSelectedDocumentKey =
      textValue(matterDocumentFinalizationResult?.selectedDocument?.key) ||
      textValue(selectedTemplate.key);
    const effectiveSelectedDocumentLabel =
      textValue(matterDocumentFinalizationResult?.selectedDocument?.label) ||
      textValue(selectedTemplate.label);

    setDocumentPreviewLoading(true);
    setFinalizeUploadLoading(true);
    setFinalizeUploadResult(null);

    try {
      const res = await fetch("/api/documents/finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmUpload: true,
          uploadTargetMode: "direct-matter",
          directMatterId,
          directMatterDisplayNumber,
          documentKeys: [effectiveSelectedDocumentKey].filter(Boolean),
          workingDocumentDriveItemId,
          workingDocumentKey: effectiveSelectedDocumentKey,
          selectedDocumentLabel: effectiveSelectedDocumentLabel,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setFinalizeUploadResult(json || { ok: false, error: "Direct matter document finalization failed." });
        alert(json?.error || "Direct matter document finalization failed.");
        return;
      }

      setFinalizeUploadResult(json);
      setDocumentPreview(json);
      await loadMatterClioDocuments();
      setMatterDocumentWorkflowStage("delivery");
    } catch (err: any) {
      const result = {
        ok: false,
        error: err?.message || "Direct matter document finalization failed.",
      };
      setFinalizeUploadResult(result);
      alert(result.error);
    } finally {
      setDocumentPreviewLoading(false);
      setFinalizeUploadLoading(false);
    }
  }

  function downloadBillScheduleDocx() {
    const masterLawsuitId = usableMasterLawsuitIdForDocuments();

    if (!masterLawsuitId) {
      alert("No valid Master Lawsuit ID found.");
      return;
    }

    window.open(
      `/api/documents/bill-schedule?masterLawsuitId=${encodeURIComponent(masterLawsuitId)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function downloadPacketSummaryDocx() {
    const masterLawsuitId = usableMasterLawsuitIdForDocuments();

    if (!masterLawsuitId) {
      alert("No valid Master Lawsuit ID found.");
      return;
    }

    window.open(
      `/api/documents/packet-summary?masterLawsuitId=${encodeURIComponent(masterLawsuitId)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function downloadSummonsComplaintDocx() {
    const masterLawsuitId = usableMasterLawsuitIdForDocuments();

    if (!masterLawsuitId) {
      alert("No valid Master Lawsuit ID found.");
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

  async function loadMatterDocumentDataPreview() {
    setMatterDocumentDataPreviewLoading(true);
    setMatterDocumentDataPreview(null);

    try {
      const res = await fetch(`/api/documents/matter-packet?matterId=${encodeURIComponent(String(matterId))}`);
      const json = await res.json();
      setMatterDocumentDataPreview(json);

      if (!res.ok) {
        throw new Error(json?.error || "Direct matter document data preview failed.");
      }
    } catch (err: any) {
      setMatterDocumentDataPreview({
        ok: false,
        error: err?.message || "Direct matter document data preview failed.",
        packet: null,
      });
    } finally {
      setMatterDocumentDataPreviewLoading(false);
    }
  }

  async function launchMatterDocumentGenerationDialog() {
    setActiveWorkspaceTab("documents");
    setMatterDocumentTemplateQuery("");
    setMatterSelectedDocumentTemplateKey("");
    setMatterDocumentSignerEmail("dbarshay@brlfirm.com");
    setMatterDocumentWorkflowStage("select");
    setMatterDocumentGenerationPopupOpen(true);
    await loadMatterDocumentDataPreview();
  }

  function buildMatterDocumentDeliveryContext(selectedTemplate: { key: string; label: string; description: string } | null): DocumentDeliveryContext {
    const documentData = matterDocumentDataPreview?.packet?.metadata?.documentData;
    const templateFields = documentData?.templateFields || {};
    const referenceData = documentData?.referenceData || {};
    const patientReference: any = (referenceData as any)?.patient || {};
    const insurerReference: any = (referenceData as any)?.insurer || {};
    const patientEmail = patientReference?.email || patientReference?.details?.email || patientReference?.details?.Email || "";
    const insurerEmail = insurerReference?.email || insurerReference?.details?.email || insurerReference?.details?.Email || "";
    const recipientEmail = patientEmail || insurerEmail || "";

    const documentLabel = selectedTemplate?.label || "Document";
    const matterDisplay = textValue(templateFields.displayNumber) || String(matterId || "");

    return {
      source: "direct_matter",
      documentKey: selectedTemplate?.key || "direct-matter-document",
      documentLabel,
      providerName: textValue(templateFields.providerName),
      patientName: textValue(templateFields.patientName),
      insurerName: textValue(templateFields.insurerName),
      indexNumber: textValue(templateFields.indexAaaNumber),
      ourCaseNumber: matterDisplay,
      suggestedRecipientName:
        textValue(templateFields.patientName) ||
        textValue(templateFields.insurerName) ||
        "",
      suggestedRecipientEmail: textValue(recipientEmail),
      matterId: matterDisplay,
    };
  }

  async function resolveMatterMaildropForDelivery(context: DocumentDeliveryContext): Promise<DocumentDeliveryContext> {
    return {
      ...context,
      clioMaildropEmail: "",
      clioMaildropLabel: "",
      maildropDeprecated: true,
      maildropDeprecationReason: "Deprecated Clio MailDrop is deprecated because Barsh Matters no longer uses legacy Clio storage references.",
    } as DocumentDeliveryContext;
  }

  function finalizedMatterDocumentLooksLikePdf(candidate: any): boolean {
    const filename = textValue(candidate?.filename || candidate?.clioDocumentName || candidate?.name).toLowerCase();
    const contentType = textValue(candidate?.contentType || candidate?.mimeType).toLowerCase();
    return filename.endsWith(".pdf") || contentType.includes("pdf");
  }

  function clioOpenPathForFinalizedMatterDocument(candidate: any, mode: "inline" | "download" = "inline"): string {
    const documentId = textValue(candidate?.clioDocumentId || candidate?.documentId || candidate?.id);
    const filename = textValue(candidate?.filename || candidate?.clioDocumentName || candidate?.name || "document.pdf");

    if (!documentId) return "";

    const params = new URLSearchParams();
    params.set("documentId", documentId);
    params.set("filename", filename);
    params.set("mode", mode);

    return "/api/documents/clio-document-open?" + params.toString();
  }

  function selectedFinalizedMatterDocumentCandidate(selectedTemplate: { key: string; label: string; description: string } | null): any {
    const selectedKey = textValue(selectedTemplate?.key).toLowerCase();
    const selectedLabel = textValue(selectedTemplate?.label).toLowerCase();
    const uploaded = Array.isArray(finalizeUploadResult?.uploaded) ? finalizeUploadResult.uploaded : [];
    const skipped = Array.isArray(finalizeUploadResult?.skipped) ? finalizeUploadResult.skipped : [];

    const uploadedCandidate =
      uploaded.find((doc: any) => textValue(doc?.key).toLowerCase() === selectedKey) ||
      uploaded.find((doc: any) => textValue(doc?.label).toLowerCase() === selectedLabel) ||
      uploaded[0];

    if (uploadedCandidate?.clioDocumentId) {
      return {
        ...uploadedCandidate,
        id: uploadedCandidate.clioDocumentId,
        clioDocumentId: uploadedCandidate.clioDocumentId,
        clioDocumentName: uploadedCandidate.clioDocumentName || uploadedCandidate.filename,
        filename: uploadedCandidate.filename || uploadedCandidate.clioDocumentName,
        contentType: uploadedCandidate.contentType || "application/pdf",
      };
    }

    const skippedCandidate =
      skipped.find((doc: any) => textValue(doc?.key).toLowerCase() === selectedKey) ||
      skipped.find((doc: any) => textValue(doc?.label).toLowerCase() === selectedLabel) ||
      skipped[0];

    const existing = Array.isArray(skippedCandidate?.existingClioDocuments)
      ? skippedCandidate.existingClioDocuments[0]
      : null;

    if (existing?.id) {
      return {
        ...skippedCandidate,
        ...existing,
        id: existing.id,
        clioDocumentId: existing.id,
        clioDocumentName: existing.name || skippedCandidate?.filename,
        filename:
          textValue(existing?.latestDocumentVersion?.filename) ||
          textValue(existing?.filename) ||
          textValue(existing?.name) ||
          textValue(skippedCandidate?.filename),
        contentType:
          textValue(existing?.latestDocumentVersion?.content_type) ||
          textValue(existing?.latestDocumentVersion?.contentType) ||
          "application/pdf",
      };
    }

    return null;
  }

  function buildMatterFinalizedPdfDeliveryContext(selectedTemplate: { key: string; label: string; description: string } | null): DocumentDeliveryContext {
    const context = buildMatterDocumentDeliveryContext(selectedTemplate);
    const candidate = selectedFinalizedMatterDocumentCandidate(selectedTemplate);
    const pdfUrl = candidate && finalizedMatterDocumentLooksLikePdf(candidate)
      ? clioOpenPathForFinalizedMatterDocument(candidate, "download")
      : "";
    const documentUrl = candidate ? clioOpenPathForFinalizedMatterDocument(candidate, "download") : "";

    return {
      ...context,
      documentUrl: documentUrl || context.documentUrl,
      pdfUrl: pdfUrl || context.pdfUrl,
      pdfFilename: candidate?.filename || candidate?.clioDocumentName || context.documentLabel,
      clioDocumentId: candidate?.clioDocumentId || candidate?.id || "",
      clioDocumentVersionUuid: candidate?.clioDocumentVersionUuid || candidate?.latestDocumentVersion?.uuid || "",
    } as any;
  }

  function isValidMatterDocumentDeliveryEmail(value: string): boolean {
    return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.trim());
  }

  function buildMatterDocumentDeliveryToOverrideRecipient(): any[] {
    const email = matterDocumentDeliveryToOverride.trim();
    return isValidMatterDocumentDeliveryEmail(email) ? [{ email, name: email }] : [];
  }

  async function launchMatterDocumentEmail(selectedTemplate: { key: string; label: string; description: string } | null) {
    const context = await resolveMatterMaildropForDelivery(buildMatterFinalizedPdfDeliveryContext(selectedTemplate));

    if (!context.pdfUrl) {
      alert("Finalize the document before preparing an email draft.  The email workflow requires a finalized PDF from this matter's Clio Documents tab.");
      return;
    }

    try {
      const response = await fetch("/api/documents/delivery-draft-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "direct_matter",
          context,
          ...(matterDocumentDeliveryToOverride.trim()
            ? { to: buildMatterDocumentDeliveryToOverrideRecipient() }
            : {}),
        }),
      });

      const preview = await response.json().catch(() => null);

      if (!response.ok || !preview?.ok) {
        alert(preview?.error || "Document delivery draft preview failed.");
        return;
      }

      const draft = preview.draft || {};
      const graphPreview = preview.graphDraftPayloadPreview || {};
      const readiness = graphPreview.readiness || {};
      const attachmentPlan = Array.isArray(graphPreview.attachmentPlan)
        ? graphPreview.attachmentPlan
        : Array.isArray(draft.attachments)
          ? draft.attachments
          : [];

      const createResponse = await fetch("/api/graph/create-draft?confirm=create-graph-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "direct_matter",
          context,
          draft: {
            ...draft,
            ...(matterDocumentDeliveryToOverride.trim()
              ? { to: buildMatterDocumentDeliveryToOverrideRecipient() }
              : {}),
          },
          ...(matterDocumentDeliveryToOverride.trim()
            ? {}
            : { graphDraftPayloadPreview: preview.graphDraftPayloadPreview }),
          to: matterDocumentDeliveryToOverride.trim()
            ? buildMatterDocumentDeliveryToOverrideRecipient()
            : undefined,
          matterId: context.matterId,
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

      if (createResult?.draft?.webLink) {
        window.open(createResult.draft.webLink, "_blank", "noopener,noreferrer");
      }

      alert(
        "Outlook Draft Created\n\n" +
          "No email was sent.  The draft was created through Microsoft Graph and opened in Outlook if the browser allowed the new tab.\n" +
          `Finalized PDF attachments uploaded: ${Array.isArray(createResult?.attachmentUploads) ? createResult.attachmentUploads.length : 0}\n\n` +
          `Document: ${context.documentLabel || selectedTemplate?.label || "Document"}\n` +
          `To: ${draft.to || "not resolved"}\n` +
          `Cc / Deprecated MailDrop: ${context.clioMaildropLabel || "MailDrop"} ${context.clioMaildropEmail ? "<" + context.clioMaildropEmail + ">" : "not resolved"}\n` +
          `Subject: ${draft.subject || "not resolved"}\n` +
          `Attachments planned: ${attachmentPlan.length}\n` +
          `Draft ID: ${createResult?.draft?.graphMessageId || "created"}`
      );
    } catch (error: any) {
      alert(error?.message || "Document delivery draft preview failed.");
    }
  }

  function launchMatterDocumentPrint(selectedTemplate: { key: string; label: string; description: string } | null) {
    const candidate = selectedFinalizedMatterDocumentCandidate(selectedTemplate);

    if (!candidate) {
      alert("Finalize the document before printing.  Barsh Matters could not find a finalized Clio document from the latest finalization result.");
      return;
    }

    const printableUrl = finalizedMatterDocumentLooksLikePdf(candidate)
      ? clioOpenPathForFinalizedMatterDocument(candidate, "inline")
      : clioOpenPathForFinalizedMatterDocument(candidate, "download");

    if (!printableUrl) {
      alert("Barsh Matters found a finalized document, but it could not build an openable Clio document URL.");
      return;
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
          // Browser-controlled print behavior; the opened PDF can still be printed manually.
        }
      }, delay);
    });
  }

  async function sendMatterDocumentToPrintQueue(selectedTemplate: { key: string; label: string; description: string } | null) {
    const context = buildMatterFinalizedPdfDeliveryContext(selectedTemplate);
    const candidate = selectedFinalizedMatterDocumentCandidate(selectedTemplate);
    const rawMasterLawsuitId = usableMasterLawsuitIdForDocuments();
    const directMatterId = directMatterNumericIdForDocuments();
    const clioTargetMatterId = Number(finalizeUploadResult?.clioUploadTarget?.matterId || 0);
    const printQueueMatterId = Number.isFinite(clioTargetMatterId) && clioTargetMatterId > 0
      ? clioTargetMatterId
      : directMatterId;
    const directMatterDisplayNumber =
      textValue(matter?.displayNumber || matter?.display_number) ||
      textValue(finalizeUploadResult?.clioUploadTarget?.displayNumber) ||
      (directMatterId ? `BRL${directMatterId}` : "");
    const masterLawsuitId =
      rawMasterLawsuitId ||
      (directMatterDisplayNumber ? `DIRECT-${directMatterDisplayNumber}` : directMatterId ? `DIRECT-BRL${directMatterId}` : "");

    if (!context.pdfUrl || !candidate?.clioDocumentId) {
      alert("Finalize the document before sending it to the print queue.  The queue workflow requires a finalized PDF from this matter's Clio Documents tab.");
      return;
    }

    if (!printQueueMatterId) {
      alert("Barsh Matters could not identify the Clio direct matter ID needed for the print queue.");
      return;
    }

    if (!masterLawsuitId) {
      alert("Barsh Matters could not identify a direct matter print queue grouping key.");
      return;
    }

    const confirmed = confirm(
      "SEND FINALIZED DOCUMENT TO PRINT QUEUE\n\n" +
        "Matter: " + (directMatterDisplayNumber || directMatterId) + "\n" +
        "Document: " + (context.documentLabel || selectedTemplate?.label || "Selected finalized document") + "\n\n" +
        "Barsh Matters will add the currently finalized repository PDF to the print queue.  Existing queue records are skipped.\n\n" +
        "Continue?"
    );

    if (!confirmed) return;

    try {
      const response = await fetch("/api/documents/print-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterLawsuitId,
          directMatterId: directMatterId,
          clioMatterId: printQueueMatterId,
          confirmAdd: true,
          directMatterCandidates: [
            {
              ...candidate,
              key: candidate.key || selectedTemplate?.key,
              label: candidate.label || selectedTemplate?.label,
              masterLawsuitId,
              masterMatterId: printQueueMatterId,
              clioMatterId: printQueueMatterId,
              directMatterId,
              masterDisplayNumber: directMatterDisplayNumber,
              directMatterDisplayNumber,
              source: "direct_matter",
            },
          ],
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        const verificationErrors = Array.isArray(json?.previewSummary?.verificationErrors)
          ? json.previewSummary.verificationErrors
          : [];
        const detailText = verificationErrors.length
          ? "\n\nVerification details:\n" +
            verificationErrors
              .map((item: any) =>
                [
                  item?.error ? "Error: " + item.error : "",
                  item?.masterMatterId ? "Matter ID: " + item.masterMatterId : "",
                  item?.clioDocumentId ? "Clio Document ID: " + item.clioDocumentId : "",
                  item?.filename ? "Filename: " + item.filename : "",
                ].filter(Boolean).join("\n")
              )
              .join("\n\n")
          : "";
        alert((json?.error || "Could not send the finalized document to the print queue.") + detailText);
        return;
      }

      alert(
        "Print queue updated.\n\n" +
          "Created: " + Number(json.createdCount || 0) + "\n" +
          "Already queued: " + Number(json.existingCount || 0)
      );
    } catch (err: any) {
      alert(err?.message || "Could not send the finalized document to the print queue.");
    }
  }

  function formatEmailThreadTimestamp(value: any): string {
    const raw = textValue(value);
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

  function emailThreadLastCheckedIsCurrent(): boolean {
    const raw = textValue(emailThreadLastCheckedAt);
    if (!raw) return false;
    if (emailThreadPreviewResult?.error) return false;

    const checkedAt = new Date(raw).getTime();
    if (!Number.isFinite(checkedAt)) return false;

    return Date.now() - checkedAt <= 15 * 60 * 1000;
  }

  function emailThreadLastCheckedColor(): string {
    return emailThreadLastCheckedIsCurrent() ? bmColors.green : bmColors.red;
  }

  function summarizeEmailRecipients(value: any): string {
    const recipients = Array.isArray(value) ? value : [];
    const labels = recipients
      .map((recipient: any) => {
        const emailAddress = recipient?.emailAddress || {};
        const name = textValue(emailAddress.name || recipient?.name);
        const address = textValue(emailAddress.address || recipient?.email || recipient?.address);
        if (name && address) return `${name} <${address}>`;
        return name || address;
      })
      .filter(Boolean);

    return labels.length ? labels.join(", ") : "—";
  }

  async function loadMatterEmailThreadPreview() {
    const displayNumber = textValue(matter?.displayNumber || matter?.display_number || matterId);
    const params = new URLSearchParams();
    params.set("limit", "25");

    if (matterId) params.set("matterId", String(matterId));
    if (displayNumber) params.set("matterDisplayNumber", displayNumber);

    setEmailThreadPreviewLoading(true);
    setEmailThreadPreviewResult(null);

    try {
      const response = await fetch(`/api/graph/local-thread-preview?${params.toString()}`);
      const json = await response.json().catch(() => ({}));
      setEmailThreadPreviewResult(json);
    } catch (err: any) {
      setEmailThreadPreviewResult({
        ok: false,
        error: err?.message || "Could not load local email/thread records.",
      });
    } finally {
      setEmailThreadLastCheckedAt(new Date().toISOString());
      setEmailThreadPreviewLoading(false);
    }
  }

  function firstMatterEmailConversationId(): string {
    const threads = Array.isArray(emailThreadPreviewResult?.threads) ? emailThreadPreviewResult.threads : [];
    return textValue(threads[0]?.conversationId);
  }

  function matterEmailSyncContext(conversationId: string) {
    const displayNumber = textValue(matter?.displayNumber || matter?.display_number || matterId);
    const threads = Array.isArray(emailThreadPreviewResult?.threads) ? emailThreadPreviewResult.threads : [];
    const matchingThread =
      threads.find((thread: any) => textValue(thread?.conversationId) === conversationId) ||
      threads[0] ||
      {};

    return {
      conversationId,
      matterId: Number(matterId),
      matterDisplayNumber: displayNumber,
      masterLawsuitId: textValue(matter?.masterLawsuitId || matter?.master_lawsuit_id || matchingThread?.masterLawsuitId),
      clioMatterId: Number(matterId),
      clioDisplayNumber: displayNumber,
      clioMaildropLabel: textValue(matchingThread?.clioMaildropLabel),
      limit: 25,
    };
  }

  async function previewGraphThreadUpdates(conversationIdOverride?: string) {
    const conversationId = textValue(conversationIdOverride) || firstMatterEmailConversationId();

    if (!conversationId) {
      setGraphThreadSyncPreviewResult({
        ok: false,
        error: "Load local Emails first so Barsh Matters can identify the stored Microsoft Graph conversationId.",
      });
      return;
    }

    setGraphThreadSyncPreviewLoading(true);
    setGraphThreadSyncPreviewConversationId(conversationId);
    setGraphThreadSyncPreviewResult(null);
    setGraphThreadSyncResult(null);

    try {
      const params = new URLSearchParams();
      params.set("confirm", "preview-graph-thread-sync");
      params.set("conversationId", conversationId);
      params.set("limit", "25");

      const response = await fetch(`/api/graph/thread-sync-preview?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await response.json().catch(() => ({}));
      setGraphThreadSyncPreviewResult(json);
    } catch (err: any) {
      setGraphThreadSyncPreviewResult({
        ok: false,
        error: err?.message || "Graph thread sync preview failed.",
      });
    } finally {
      setGraphThreadSyncPreviewLoading(false);
    }
  }

  async function syncGraphThreadToBarshMatters(conversationIdOverride?: string) {
    const conversationId = textValue(conversationIdOverride) || graphThreadSyncPreviewConversationId || firstMatterEmailConversationId();

    if (!conversationId) {
      setGraphThreadSyncResult({
        ok: false,
        error: "Load local Emails first so Barsh Matters can identify the stored Microsoft Graph conversationId.",
      });
      return;
    }

    if (!graphThreadSyncPreviewResult || graphThreadSyncPreviewResult.action !== "graph-thread-sync-preview") {
      setGraphThreadSyncResult({
        ok: false,
        error: "Run Preview Graph Updates before syncing this thread to Barsh Matters.",
      });
      return;
    }

    const previewConversationId = textValue(graphThreadSyncPreviewResult?.query?.conversationId || graphThreadSyncPreviewConversationId);
    if (previewConversationId && previewConversationId !== conversationId) {
      setGraphThreadSyncResult({
        ok: false,
        error: "Preview Graph Updates must be run for this specific thread before syncing it.",
      });
      return;
    }

    const confirmed = window.confirm(
      "Sync this Microsoft Graph thread to Barsh Matters local email records?\n\nThis will read Microsoft Graph and update local EmailThread / EmailMessage metadata only.  It will not create a draft, send email, write Clio, upload documents, or use local Outlook automation."
    );

    if (!confirmed) return;

    setGraphThreadSyncLoading(true);
    setGraphThreadSyncConversationId(conversationId);
    setGraphThreadSyncResult(null);

    try {
      const response = await fetch("/api/graph/thread-sync?confirm=sync-graph-thread", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(matterEmailSyncContext(conversationId)),
      });

      const json = await response.json().catch(() => ({}));
      setGraphThreadSyncResult(json);

      if (response.ok && json?.action === "graph-thread-sync" && json?.databaseRecordsChanged === true) {
        await loadMatterEmailThreadPreview();
      }
    } catch (err: any) {
      setGraphThreadSyncResult({
        ok: false,
        error: err?.message || "Graph thread sync failed.",
      });
    } finally {
      setGraphThreadSyncLoading(false);
    }
  }

  function openMatterViewEmailsPopup() {
    setMatterViewEmailsPopupOpen(true);
    if (!emailThreadPreviewLoading && !emailThreadPreviewResult) {
      void loadMatterEmailThreadPreview();
    }
  }

  function closeMatterViewEmailsPopup() {
    setMatterViewEmailsPopupOpen(false);
  }

  function renderMatterEmailThreadsPanel() {
    const threads = Array.isArray(emailThreadPreviewResult?.threads) ? emailThreadPreviewResult.threads : [];
    const counts = emailThreadPreviewResult?.counts || {};
    const displayNumber = textValue(matter?.displayNumber || matter?.display_number || matterId);
    const hasConversationId = Boolean(firstMatterEmailConversationId());
    const syncPreviewCounts = graphThreadSyncPreviewResult?.counts || {};
    const syncCounts = graphThreadSyncResult?.counts || {};

    return (
      <section id="matter-email-threads-section" style={{ ...tabPlaceholderPanelStyle, margin: 0, boxShadow: "none", border: 0, borderRadius: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={loadMatterEmailThreadPreview}
              disabled={emailThreadPreviewLoading || graphThreadSyncPreviewLoading || graphThreadSyncLoading}
              style={{
                minWidth: 118,
                height: 38,
                padding: "7px 12px",
                border: "1px solid #1e3a8a",
                background: emailThreadPreviewLoading ? "#f3f4f6" : "#1e3a8a",
                color: "#ffffff",
                borderRadius: 10,
                cursor: emailThreadPreviewLoading ? "not-allowed" : "pointer",
                fontWeight: 900,
                whiteSpace: "nowrap",
              }}
            >
              {emailThreadPreviewLoading ? "Loading..." : "Refresh Emails"}
            </button>

          <button
            type="button"
            onClick={openStartLawsuitModalFromMatter}
            disabled={submitting || matterIsClosedForPayment() || alreadyAggregated}
            title={alreadyAggregated ? "This matter is already assigned to a lawsuit." : "Create a lawsuit from this individual matter."}
            style={{
              border: "1px solid #1e3a8a",
              background: alreadyAggregated ? "#e2e8f0" : "#eff6ff",
              color: alreadyAggregated ? "#64748b" : "#1e3a8a",
              borderRadius: 999,
              padding: "8px 12px",
              fontWeight: 950,
              cursor: submitting || matterIsClosedForPayment() || alreadyAggregated ? "not-allowed" : "pointer",
              minHeight: 36,
            }}
          >
            Start Lawsuit
          </button>

            <button
              type="button"
              hidden
              aria-hidden="true"
              tabIndex={-1}
              onClick={() => previewGraphThreadUpdates()}
              disabled={!hasConversationId || emailThreadPreviewLoading || graphThreadSyncPreviewLoading || graphThreadSyncLoading}
              title={!hasConversationId ? "Load local Emails first." : "Preview Microsoft Graph messages for this stored conversationId without persisting changes."}
              style={{
                padding: "7px 10px",
                border: "1px solid #0f766e",
                background:
                  !hasConversationId || graphThreadSyncPreviewLoading || graphThreadSyncLoading ? "#f3f4f6" : "#0f766e",
                color:
                  !hasConversationId || graphThreadSyncPreviewLoading || graphThreadSyncLoading ? "#666" : "#fff",
                borderRadius: 4,
                cursor:
                  !hasConversationId || graphThreadSyncPreviewLoading || graphThreadSyncLoading ? "not-allowed" : "pointer",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              {graphThreadSyncPreviewLoading ? "Previewing..." : "Preview Graph Updates"}
            </button>

            <button
              type="button"
              hidden
              aria-hidden="true"
              tabIndex={-1}
              onClick={() => syncGraphThreadToBarshMatters()}
              disabled={
                !hasConversationId ||
                !graphThreadSyncPreviewResult ||
                graphThreadSyncPreviewLoading ||
                graphThreadSyncLoading
              }
              title="Run only after Preview Graph Updates.  Persists local EmailThread / EmailMessage metadata only."
              style={{
                padding: "7px 10px",
                border: "1px solid #7c3aed",
                background:
                  !hasConversationId ||
                  !graphThreadSyncPreviewResult ||
                  graphThreadSyncPreviewLoading ||
                  graphThreadSyncLoading
                    ? "#f3f4f6"
                    : "#7c3aed",
                color:
                  !hasConversationId ||
                  !graphThreadSyncPreviewResult ||
                  graphThreadSyncPreviewLoading ||
                  graphThreadSyncLoading
                    ? "#666"
                    : "#fff",
                borderRadius: 4,
                cursor:
                  !hasConversationId ||
                  !graphThreadSyncPreviewResult ||
                  graphThreadSyncPreviewLoading ||
                  graphThreadSyncLoading
                    ? "not-allowed"
                    : "pointer",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              {graphThreadSyncLoading ? "Syncing..." : "Sync Thread to Barsh Matters"}
            </button>
          </div>
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
              {displayNumber || "—"}
            </div>
          </div>

          <div style={bmStatCardStyle}>
            <div style={{ fontSize: 11, fontWeight: 900, color: bmColors.subtle, textTransform: "uppercase" }}>Threads</div>
            <div style={{ marginTop: 4, fontSize: 14, fontWeight: 900, color: bmColors.ink }}>
              {num(counts.threads)}
            </div>
          </div>

          <div style={bmStatCardStyle}>
            <div style={{ fontSize: 11, fontWeight: 900, color: bmColors.subtle, textTransform: "uppercase" }}>Messages</div>
            <div style={{ marginTop: 4, fontSize: 14, fontWeight: 900, color: bmColors.ink }}>
              {num(counts.messages)}
            </div>
          </div>

          <div style={bmStatCardStyle}>
            <div style={{ fontSize: 11, fontWeight: 900, color: bmColors.subtle, textTransform: "uppercase" }}>Last Checked</div>
            <div style={{ marginTop: 4, fontSize: 13, fontWeight: 900, color: emailThreadLastCheckedColor() }}>
              {emailThreadLastCheckedAt ? formatEmailThreadTimestamp(emailThreadLastCheckedAt) : "—"}
            </div>
          </div>

        </div>

        





        {emailThreadPreviewResult?.error && (
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
            {textValue(emailThreadPreviewResult.error)}
          </div>
        )}

        {!emailThreadPreviewResult && !emailThreadPreviewLoading && (
          <div style={{ marginTop: 12, color: bmColors.muted }}>
            Email records load automatically when this panel opens.  Background Graph/MailDrop sync will populate this area without user action.
          </div>
        )}

        {emailThreadPreviewLoading && (
          <div style={{ marginTop: 12, color: bmColors.muted }}>
            Loading local email/thread records...
          </div>
        )}

        {emailThreadPreviewResult &&
          threads.length === 0 &&
          !emailThreadPreviewResult?.error && (
            <div style={{ marginTop: 12, color: bmColors.muted }}>
              No local email/thread records found yet for this matter.
            </div>
          )}

        {threads.length > 0 && (
          <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
            {threads.map((thread: any) => {
              const threadKey = textValue(thread.id || thread.conversationId);
              const threadExpanded = expandedEmailThreadId === threadKey;
              const messages = Array.isArray(thread.messages) ? thread.messages : [];
              const anyMessageOutlookLinkAvailable = messages.some((message: any) => Boolean(textValue(message.webLink)));
              

              return (
                <article
                  key={threadKey}
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
                        {textValue(thread.subject) || "Email thread"}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 12, color: bmColors.subtle, fontWeight: 750 }}>
                        {formatEmailThreadTimestamp(thread.latestMessageAt)} · {messages.length} message{messages.length === 1 ? "" : "s"} · {textValue(thread.clioMaildropLabel) || "No MailDrop label"}
                      </div>
                      {anyMessageOutlookLinkAvailable && (
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
                        onClick={() => previewGraphThreadUpdates(textValue(thread.conversationId))}
                        disabled={!textValue(thread.conversationId) || graphThreadSyncPreviewLoading || graphThreadSyncLoading}
                        title="Preview Microsoft Graph updates for this specific thread without persisting changes."
                        style={{
                          fontSize: 12,
                          padding: "5px 9px",
                          border: "1px solid #0f766e",
                          borderRadius: 999,
                          background: graphThreadSyncPreviewLoading && graphThreadSyncPreviewConversationId === textValue(thread.conversationId) ? "#f3f4f6" : "#ecfeff",
                          color: "#0f766e",
                          cursor: !textValue(thread.conversationId) || graphThreadSyncPreviewLoading || graphThreadSyncLoading ? "not-allowed" : "pointer",
                          whiteSpace: "nowrap",
                          fontWeight: 800,
                        }}
                      >
                        {graphThreadSyncPreviewLoading && graphThreadSyncPreviewConversationId === textValue(thread.conversationId) ? "Previewing..." : "Preview This Thread"}
                      </button>

                      <button
                        type="button"
                        onClick={() => syncGraphThreadToBarshMatters(textValue(thread.conversationId))}
                        disabled={
                          !textValue(thread.conversationId) ||
                          !graphThreadSyncPreviewResult ||
                          textValue(graphThreadSyncPreviewResult?.query?.conversationId || graphThreadSyncPreviewConversationId) !== textValue(thread.conversationId) ||
                          graphThreadSyncPreviewLoading ||
                          graphThreadSyncLoading
                        }
                        title="Run only after Preview This Thread.  Persists local EmailThread / EmailMessage metadata only."
                        style={{
                          fontSize: 12,
                          padding: "5px 9px",
                          border: "1px solid #7c3aed",
                          borderRadius: 999,
                          background:
                            graphThreadSyncLoading && graphThreadSyncConversationId === textValue(thread.conversationId)
                              ? "#f3f4f6"
                              : "#f5f3ff",
                          color: "#6d28d9",
                          cursor:
                            !textValue(thread.conversationId) ||
                            !graphThreadSyncPreviewResult ||
                            textValue(graphThreadSyncPreviewResult?.query?.conversationId || graphThreadSyncPreviewConversationId) !== textValue(thread.conversationId) ||
                            graphThreadSyncPreviewLoading ||
                            graphThreadSyncLoading
                              ? "not-allowed"
                              : "pointer",
                          whiteSpace: "nowrap",
                          fontWeight: 800,
                        }}
                      >
                        {graphThreadSyncLoading && graphThreadSyncConversationId === textValue(thread.conversationId) ? "Syncing..." : "Sync This Thread"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setExpandedEmailThreadId(threadExpanded ? null : threadKey)}
                        style={{
                          fontSize: 12,
                          padding: "5px 9px",
                          border: "1px solid #94a3b8",
                          borderRadius: 999,
                          background: threadExpanded ? "#e2e8f0" : "#fff",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          fontWeight: 800,
                        }}
                      >
                        {threadExpanded ? "Hide Thread" : "View Thread"}
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, color: bmColors.subtle, fontWeight: 900, textTransform: "uppercase" }}>Source</div>
                      <div style={{ marginTop: 3, fontSize: 13, fontWeight: 850, color: bmColors.ink }}>{textValue(thread.source) || "—"}</div>
                    </div>

                    <div>
                      <div style={{ fontSize: 11, color: bmColors.subtle, fontWeight: 900, textTransform: "uppercase" }}>Direction</div>
                      <div style={{ marginTop: 3, fontSize: 13, fontWeight: 850, color: bmColors.ink }}>{textValue(thread.direction) || "—"}</div>
                    </div>

                    <div>
                      <div style={{ fontSize: 11, color: bmColors.subtle, fontWeight: 900, textTransform: "uppercase" }}>Conversation ID</div>
                      <div style={{ marginTop: 3, fontSize: 13, fontWeight: 850, color: bmColors.ink, overflowWrap: "anywhere" }}>{textValue(thread.conversationId) || "—"}</div>
                    </div>

                    <div>
                      <div style={{ fontSize: 11, color: bmColors.subtle, fontWeight: 900, textTransform: "uppercase" }}>MailDrop Present</div>
                      <div style={{ marginTop: 3, fontSize: 13, fontWeight: 850, color: thread.clioMaildropEmailPresent ? bmColors.green : bmColors.red }}>
                        {thread.clioMaildropEmailPresent ? "Yes" : "No"}
                      </div>
                    </div>
                  </div>

                  {threadExpanded && (
                    <div
                      style={{
                        display: "grid",
                        gap: 10,
                        padding: 10,
                        borderRadius: 12,
                        border: "1px solid " + bmColors.softLine,
                        background: bmColors.page,
                      }}
                    >
                      {messages.length === 0 && (
                        <div style={{ color: bmColors.muted }}>
                          This local thread has no persisted message records yet.
                        </div>
                      )}

                      {messages.map((message: any) => {
                        const messageKey = textValue(message.id || message.graphMessageId);
                        const messageExpanded = expandedEmailMessageId === messageKey;

                        return (
                          <div
                            key={messageKey}
                            style={{
                              border: "1px solid " + bmColors.line,
                              borderRadius: 12,
                              background: "#ffffff",
                              padding: 12,
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
                                <div style={{ fontWeight: 950, color: bmColors.ink }}>
                                  {message.isDraft ? "Draft" : message.isSent ? "Sent" : "Message"} · {textValue(message.subject) || textValue(thread.subject) || "No subject"}
                                </div>
                                <div style={{ marginTop: 4, fontSize: 12, color: bmColors.subtle, fontWeight: 750 }}>
                                  {formatEmailThreadTimestamp(message.sentAt || message.receivedAt)} · From: {textValue(message.fromEmail || message.from) || "—"}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => setExpandedEmailMessageId(messageExpanded ? null : messageKey)}
                                style={{
                                  fontSize: 12,
                                  padding: "5px 9px",
                                  border: "1px solid #94a3b8",
                                  borderRadius: 999,
                                  background: messageExpanded ? "#e2e8f0" : "#fff",
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                  fontWeight: 800,
                                }}
                              >
                                {messageExpanded ? "Hide Details" : "Details"}
                              </button>
                            </div>

                            <div style={{ marginTop: 8, color: bmColors.muted, fontSize: 13, lineHeight: 1.45 }}>
                              {textValue(message.bodyPreview) || "No local body preview available."}
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
                                  color: bmColors.green,
                                }}
                              >
                                <span>Outlook web link is stored locally.</span>
                                {textValue(message.webLink) && (
                                  <a
                                    href={textValue(message.webLink)}
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
                              <div
                                style={{
                                  marginTop: 10,
                                  display: "grid",
                                  gap: 8,
                                  fontSize: 12,
                                  color: bmColors.ink,
                                }}
                              >
                                <div><strong>To:</strong> {summarizeEmailRecipients(message.toRecipients)}</div>
                                <div><strong>Cc:</strong> {summarizeEmailRecipients(message.ccRecipients)}</div>
                                <div><strong>Bcc:</strong> {summarizeEmailRecipients(message.bccRecipients)}</div>
                                <div><strong>Graph Message ID:</strong> <span style={{ overflowWrap: "anywhere" }}>{textValue(message.graphMessageId) || "—"}</span></div>
                                <div><strong>Attachments:</strong> {Array.isArray(message.attachments) ? message.attachments.length : 0}</div>

                                {Array.isArray(message.attachments) && message.attachments.length > 0 && (
                                  <ul style={{ margin: "0 0 0 18px", padding: 0 }}>
                                    {message.attachments.map((attachment: any) => (
                                      <li key={textValue(attachment.id || attachment.name)}>
                                        {textValue(attachment.name) || "Attachment"} · {textValue(attachment.storageStatus) || "metadata"}
                                      </li>
                                    ))}
                                  </ul>
                                )}
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

        
      </section>
    );
  }

  function renderMatterDocumentGenerationPopup() {
    if (!matterDocumentGenerationPopupOpen) return null;
    const documentData = matterDocumentDataPreview?.packet?.metadata?.documentData;
    const templateFields = documentData?.templateFields || {};
    const referenceData = documentData?.referenceData || {};
    const query = matterDocumentTemplateQuery.trim().toLowerCase();

    const templateOptions = [
      {
        key: "blank-letterhead",
        label: "Blank Letterhead",
        description: "Current stored DOCX template from the local Barsh Matters template repository.",
      },
    ];

    const sortedTemplateOptions = [...templateOptions].sort((a, b) => a.label.localeCompare(b.label));

    const filteredTemplateOptions = sortedTemplateOptions.filter((option) => {
      const haystack = `${option.label} ${option.description}`.toLowerCase();
      return !query || haystack.includes(query);
    });

    const selectedTemplate =
      sortedTemplateOptions.find((option) => option.key === matterSelectedDocumentTemplateKey) || null;

    const matterDocumentSignerOptions = [
      {
        email: "dbarshay@brlfirm.com",
        displayName: "David M. Barshay",
      },
    ];

    const canFinalize =
      Boolean(selectedTemplate) &&
      (matterDocumentWorkflowStage === "preview" ||
        matterDocumentWorkflowStage === "edit" ||
        matterDocumentWorkflowStage === "finalize");

    const showSelectStep = matterDocumentWorkflowStage === "select";
    const showActionStep = matterDocumentWorkflowStage === "chooseAction";
    const showPreviewStep = matterDocumentWorkflowStage === "preview";
    const showEditStep = matterDocumentWorkflowStage === "edit";
    const showFinalizeStep = matterDocumentWorkflowStage === "finalize";
    const showDeliveryStep = matterDocumentWorkflowStage === "delivery";

    const stepBadge = (step: number, label: string, active: boolean, complete = false) => (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          borderRadius: 999,
          border: complete ? "1px solid #16a34a" : "1px solid #bbf7d0",
          background: complete ? "#16a34a" : "#dcfce7",
          color: complete ? "#ffffff" : "#166534",
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
            background: complete ? "#15803d" : "#bbf7d0",
            color: complete ? "#ffffff" : "#166534",
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
          border: disabled ? "1px solid #d1d5db" : "1px solid #1e3a8a",
          background: disabled ? "#f3f4f6" : "#1e3a8a",
          color: disabled ? "#6b7280" : "#fff",
          borderRadius: 12,
          padding: "10px 14px",
          fontWeight: 900,
          cursor: disabled ? "not-allowed" : "pointer",
          boxShadow: disabled ? "none" : "0 10px 20px rgba(30, 58, 138, 0.18)",
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

    const step1Complete = matterDocumentWorkflowStage !== "select";
    const step2Complete =
      matterDocumentWorkflowStage === "finalize" || matterDocumentWorkflowStage === "delivery";
    const step3Complete = matterDocumentWorkflowStage === "delivery";

    const canGoBackMatterDocumentGeneration = matterDocumentWorkflowStage !== "select";
    const goBackMatterDocumentGeneration = () => {
      if (matterDocumentWorkflowStage === "delivery") {
        setMatterDocumentWorkflowStage("finalize");
        return;
      }

      if (matterDocumentWorkflowStage === "finalize") {
        setMatterDocumentWorkflowStage("chooseAction");
        return;
      }

      if (matterDocumentWorkflowStage === "preview" || matterDocumentWorkflowStage === "edit" || matterDocumentWorkflowStage === "chooseAction") {
        setMatterSelectedDocumentTemplateKey("");
        setMatterDocumentTemplateQuery("");
        setDocumentPreview(null);
        setMatterDocumentFinalizationResult(null);
        setFinalizeUploadResult(null);
        setMatterDocumentWorkflowStage("select");
      }
    };

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Direct Matter Document Generation"
        tabIndex={-1}
        onClick={() => setMatterDocumentGenerationPopupOpen(false)}
        onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setMatterDocumentGenerationPopupOpen(false); } }}
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
            data-barsh-direct-document-generation-header-standard="true"
            style={{
              display: "grid",
              gridTemplateColumns: "90px minmax(0, 1fr) 90px",
              alignItems: "center",
              gap: 14,
              padding: "16px 20px",
              borderBottom: "1px solid #1e3a8a",
              background: "#1e3a8a",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
            }}
          >
            <div aria-hidden="true" />
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 950,
                color: "#ffffff",
                textAlign: "center",
              }}
            >
              Document Generation
            </h2>
            <div aria-hidden="true" />
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
              {stepBadge(1, "Select Document", matterDocumentWorkflowStage === "select", step1Complete)}
              {stepArrow(step1Complete)}
              {stepBadge(
                2,
                "Select Signer / Generate",
                matterDocumentWorkflowStage === "chooseAction" ||
                  matterDocumentWorkflowStage === "preview" ||
                  matterDocumentWorkflowStage === "edit",
                step2Complete
              )}
              {stepArrow(step2Complete)}
              {stepBadge(3, "Document Delivery", matterDocumentWorkflowStage === "delivery", false)}
              {stepArrow(step3Complete)}
              {/* Step 4 removed: delivery is now Step 3. */}
            </div>

            <section
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                padding: 18,
                background: "#f8fafc",
                display: showSelectStep ? "grid" : "none",
                gap: 14,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 18 }}>Step 1: Select Document</h3>
                <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.45 }}>
                  Select the document template for this matter.
                </p>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <input
                  value={matterDocumentTemplateQuery}
                  list="matter-document-template-options"
                  onChange={(event) => {
                    const value = event.target.value;
                    setMatterDocumentTemplateQuery(value);
                    const match = sortedTemplateOptions.find(
                      (option) => option.label.toLowerCase() === value.trim().toLowerCase()
                    );
                    if (match) {
                      setMatterSelectedDocumentTemplateKey(match.key);
                      setMatterDocumentWorkflowStage("chooseAction");
                    } else {
                      setMatterSelectedDocumentTemplateKey("");
                      setMatterDocumentWorkflowStage("select");
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
                <datalist id="matter-document-template-options">
                  {sortedTemplateOptions.map((option) => (
                    <option key={option.key} value={option.label} />
                  ))}
                </datalist>

                {matterSelectedDocumentTemplateKey && selectedTemplate && (
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
                    <strong>Selected:</strong> {selectedTemplate.label}
                    <div style={{ marginTop: 4, color: "#475569" }}>{selectedTemplate.description}</div>
                    <button
                      type="button"
                      data-barsh-direct-document-generation-continue-to-signer="true"
                      onClick={() => setMatterDocumentWorkflowStage("chooseAction")}
                      style={{
                        marginTop: 12,
                        border: "1px solid #1e3a8a",
                        background: "#1e3a8a",
                        color: "#ffffff",
                        borderRadius: 12,
                        padding: "9px 13px",
                        fontWeight: 950,
                        cursor: "pointer",
                      }}
                    >
                      Continue to Signer
                    </button>
                  </div>
                )}

                {matterDocumentTemplateQuery.trim() && filteredTemplateOptions.length === 0 && (
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
                <h3 style={{ margin: 0, fontSize: 18 }}>Step 2: Preview PDF / Edit / Finalize</h3>
                <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.45 }}>
                  {selectedTemplate
                    ? `Selected: ${selectedTemplate?.label || "Selected document"}`
                    : "Select a document before previewing, editing, or finalizing."}
                </p>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {actionButton(
                  "Preview PDF",
                  () => launchMatterStep2PdfPreview(selectedTemplate),
                  !selectedTemplate,
                  !selectedTemplate ? "Select a document first." : "Confirm signer, then open a temporary PDF preview without uploading to Clio."
                )}
                {actionButton(
                  "Edit Document",
                  () => launchMatterStep2GeneratedDocumentEdit(selectedTemplate),
                  !selectedTemplate,
                  !selectedTemplate ? "Select a document first." : "Confirm signer, then create a working DOCX and edit it in Word Web."
                )}
                {actionButton(
                  documentPreviewLoading || finalizeUploadLoading ? "Finalizing..." : "Finalize Document",
                  () => finalizeMatterDocumentFromStep2(selectedTemplate),
                  !selectedTemplate || documentPreviewLoading || finalizeUploadLoading,
                  !selectedTemplate ? "Select a document first." : "Confirm signer, then finalize the selected document."
                )}
              </div>

            </section>

            {(showPreviewStep || showEditStep || showFinalizeStep) && selectedTemplate && (
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
                    {showPreviewStep ? "Preview PDF" : showEditStep ? "Edit Document" : "Finalize Document"}
                  </h3>
                </div>

                {showEditStep && matterDocumentFinalizationResult?.workingDocument && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => {
                        const url = matterDocumentFinalizationResult?.workingDocument?.msWordEditUrl || "";
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
                      disabled={!matterDocumentFinalizationResult?.workingDocument?.msWordEditUrl}
                      style={{
                        border: "1px solid #cbd5e1",
                        background: "#fff",
                        color: "#334155",
                        borderRadius: 12,
                        padding: "10px 14px",
                        fontWeight: 900,
                        cursor: matterDocumentFinalizationResult?.workingDocument?.msWordEditUrl ? "pointer" : "not-allowed",
                        opacity: matterDocumentFinalizationResult?.workingDocument?.msWordEditUrl ? 1 : 0.55,
                      }}
                    >
                      Try Desktop Word
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const url = matterDocumentFinalizationResult?.workingDocument?.webUrl || "";
                        if (!url) {
                          alert("No Word web link is available for this working document.");
                          return;
                        }
                        window.open(url, "_blank", "noopener,noreferrer");
                      }}
                      disabled={!matterDocumentFinalizationResult?.workingDocument?.webUrl}
                      style={{
                        border: "1px solid #1e3a8a",
                        background: "#1e3a8a",
                        color: "#fff",
                        borderRadius: 12,
                        padding: "10px 14px",
                        fontWeight: 900,
                        cursor: matterDocumentFinalizationResult?.workingDocument?.webUrl ? "pointer" : "not-allowed",
                        opacity: matterDocumentFinalizationResult?.workingDocument?.webUrl ? 1 : 0.55,
                      }}
                    >
                      Open in Word Web
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        const url = matterDocumentFinalizationResult?.workingDocument?.webUrl || "";
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
                      disabled={!matterDocumentFinalizationResult?.workingDocument?.webUrl}
                      style={{
                        border: "1px solid #cbd5e1",
                        background: "#fff",
                        color: "#334155",
                        borderRadius: 12,
                        padding: "10px 14px",
                        fontWeight: 900,
                        cursor: matterDocumentFinalizationResult?.workingDocument?.webUrl ? "pointer" : "not-allowed",
                        opacity: matterDocumentFinalizationResult?.workingDocument?.webUrl ? 1 : 0.55,
                      }}
                    >
                      Copy Word Web Link
                    </button>
                  </div>
                )}

              <div data-barsh-direct-document-generation-signer-heading="true">
                <h3 style={{ margin: 0, fontSize: 18 }}>Step 2: Select Signer</h3>
                <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.45 }}>
                  Choose the signer for this document before previewing, editing, or finalizing.
                </p>
              </div>

              <div
                data-barsh-direct-document-generation-signer-default="true"
                data-barsh-direct-document-generation-signer-step="true"
                style={{
                  display: "grid",
                  gap: 8,
                  border: "1px solid #bfdbfe",
                  borderRadius: 14,
                  padding: 12,
                  background: "#eff6ff",
                }}
              >
                <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 950, color: "#1e3a8a" }}>
                  Signer
                  <select
                    value={matterDocumentSignerEmail}
                    onChange={(event) => setMatterDocumentSignerEmail(event.target.value)}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      border: "1px solid #93c5fd",
                      borderRadius: 10,
                      padding: "9px 11px",
                      fontSize: 13,
                      fontWeight: 900,
                      color: "#0f172a",
                      background: "#ffffff",
                    }}
                  >
                    {matterDocumentSignerOptions.map((signer) => (
                      <option key={signer.email} value={signer.email}>
                        {signer.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.35 }}>
                  Default signer is David M. Barshay. The selected display name controls signer.* document fields; the stored signer email is sent only for backend signer-profile resolution.
                </div>
              </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  
                  {actionButton(
                    documentPreviewLoading || finalizeUploadLoading ? "Finalizing..." : "Finalize Document",
                    () => finalizeMatterDocumentFromStep2(selectedTemplate),
                    documentPreviewLoading || finalizeUploadLoading,
                    "Finalize and upload the selected document to Clio."
                  )}
                </div>
              </section>
            )}

            {matterDocumentWorkflowStage === "finalize" && selectedTemplate && (
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
                  <h3 style={{ margin: 0, fontSize: 18 }}>Document Delivery</h3>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  <label style={{ display: "grid", gap: 6, maxWidth: 420 }}>
                    <span style={{ fontWeight: 850, color: "#334155" }}>To Email for Document Delivery</span>
                    <input
                      value={matterDocumentDeliveryToOverride}
                      onChange={(event) => setMatterDocumentDeliveryToOverride(event.target.value)}
                      placeholder="Recipient email"
                      style={{
                        border: "1px solid #cbd5e1",
                        borderRadius: 10,
                        padding: "9px 10px",
                        fontWeight: 750,
                      }}
                    />
                    {matterDocumentDeliveryToOverride.trim() && !isValidMatterDocumentDeliveryEmail(matterDocumentDeliveryToOverride) && (
                      <span style={{ color: "#b91c1c", fontSize: 12, fontWeight: 800 }}>Enter a valid email address.</span>
                    )}
                  </label>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {actionButton(
                      "Email Document",
                      () => launchMatterDocumentEmail(selectedTemplate),
                      Boolean(matterDocumentDeliveryToOverride.trim()) && !isValidMatterDocumentDeliveryEmail(matterDocumentDeliveryToOverride),
                      "Create an Outlook draft with the finalized PDF attached."
                    )}
                    {actionButton("Print Document", () => launchMatterDocumentPrint(selectedTemplate), false, "Open the finalized PDF/printable document and show the print dialog when available.")}
                    {actionButton("Send to Print Queue", () => sendMatterDocumentToPrintQueue(selectedTemplate), false, "Send this finalized document to the shared Barsh Matters print queue when backend support is available.")}
                  </div>
                </div>
              </section>
            )}

            {matterDocumentWorkflowStage === "delivery" && (
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
                <div style={{ display: "grid", gap: 10 }}>
                  <label style={{ display: "grid", gap: 6, maxWidth: 420 }}>
                    <span style={{ fontWeight: 850, color: "#334155" }}>To Email for Document Delivery</span>
                    <input
                      value={matterDocumentDeliveryToOverride}
                      onChange={(event) => setMatterDocumentDeliveryToOverride(event.target.value)}
                      placeholder="Recipient email"
                      style={{
                        border: "1px solid #cbd5e1",
                        borderRadius: 10,
                        padding: "9px 10px",
                        fontWeight: 750,
                      }}
                    />
                    {matterDocumentDeliveryToOverride.trim() && !isValidMatterDocumentDeliveryEmail(matterDocumentDeliveryToOverride) && (
                      <span style={{ color: "#b91c1c", fontSize: 12, fontWeight: 800 }}>Enter a valid email address.</span>
                    )}
                  </label>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {actionButton(
                      "Email Document",
                      () => launchMatterDocumentEmail(selectedTemplate),
                      Boolean(matterDocumentDeliveryToOverride.trim()) && !isValidMatterDocumentDeliveryEmail(matterDocumentDeliveryToOverride),
                      "Create an Outlook draft with the finalized PDF attached."
                    )}
                    {actionButton("Print Document", () => launchMatterDocumentPrint(selectedTemplate), false, "Open the finalized PDF/printable document and show the print dialog when available.")}
                    {actionButton("Send to Print Queue", () => sendMatterDocumentToPrintQueue(selectedTemplate), false, "Send this finalized document to the shared Barsh Matters print queue when backend support is available.")}
                  </div>
                </div>
              </section>
            )}

            {matterDocumentDataPreview?.error && (
              <div style={{ color: "#991b1b", fontWeight: 900 }}>
                Error: {textValue(matterDocumentDataPreview.error)}
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
                <p style={{ margin: "6px 0 12px", color: "#64748b", lineHeight: 1.45 }}>
                  Read-only local data available for future direct matter templates.  It does not generate documents, upload documents, write to Clio, or change the print queue.
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
                <div style={{ display: "none" }}>{renderMatterDocumentDataPreviewPanel()}</div>
              </div>
            </details>
          </div>

          <div
            data-barsh-direct-document-generation-footer-actions="true"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              padding: "14px 24px 18px",
              borderTop: "1px solid #e5e7eb",
              background: "#f8fafc",
            }}
          >
            <button
              type="button"
              onClick={goBackMatterDocumentGeneration}
              disabled={!canGoBackMatterDocumentGeneration || documentPreviewLoading || finalizeUploadLoading}
              style={{
                minWidth: 118,
                height: 38,
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                background: !canGoBackMatterDocumentGeneration || documentPreviewLoading || finalizeUploadLoading ? "#f3f4f6" : "#ffffff",
                color: !canGoBackMatterDocumentGeneration || documentPreviewLoading || finalizeUploadLoading ? "#94a3b8" : "#334155",
                fontWeight: 900,
                cursor: !canGoBackMatterDocumentGeneration || documentPreviewLoading || finalizeUploadLoading ? "not-allowed" : "pointer",
              }}
            >
              Back
            </button>

            <button
              type="button"
              onClick={() => setMatterDocumentGenerationPopupOpen(false)}
              disabled={documentPreviewLoading || finalizeUploadLoading}
              style={{
                minWidth: 118,
                height: 38,
                border: "1px solid #dc2626",
                borderRadius: 10,
                background: documentPreviewLoading || finalizeUploadLoading ? "#fecaca" : "#dc2626",
                color: "#ffffff",
                fontWeight: 900,
                cursor: documentPreviewLoading || finalizeUploadLoading ? "not-allowed" : "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderMatterViewEmailsPopup() {
    if (!matterViewEmailsPopupOpen) return null;

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="View Emails"
        data-barsh-direct-view-emails-standard-modal="true"
        tabIndex={-1}
        onClick={closeMatterViewEmailsPopup}
        onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeMatterViewEmailsPopup(); } }}
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
            width: "min(1180px, 96vw)",
            maxHeight: "88vh",
            overflow: "auto",
            border: "1px solid #cbd5e1",
            borderRadius: 22,
            background: "#ffffff",
            boxShadow: "0 28px 90px rgba(15, 23, 42, 0.34)",
          }}
        >
          <div
            data-barsh-direct-view-emails-header-standard="true"
            style={{
              position: "sticky",
              top: 0,
              zIndex: 2,
              display: "grid",
              gridTemplateColumns: "90px minmax(0, 1fr) 90px",
              alignItems: "center",
              gap: 14,
              padding: "16px 20px",
              borderBottom: "1px solid #1e3a8a",
              background: "#1e3a8a",
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
            }}
          >
            <div aria-hidden="true" />
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 950,
                color: "#ffffff",
                textAlign: "center",
              }}
            >
              View Emails
            </h2>
            <div aria-hidden="true" />
          </div>

          <div style={{ padding: 20 }}>
            {renderMatterEmailThreadsPanel()}
          </div>

          <div
            data-barsh-direct-view-emails-footer-actions="true"
            style={{
              display: "flex",
              justifyContent: "flex-end",
              padding: "14px 20px 18px",
              borderTop: "1px solid #e5e7eb",
              background: "#f8fafc",
            }}
          >
            <button
              type="button"
              onClick={closeMatterViewEmailsPopup}
              disabled={emailThreadPreviewLoading || graphThreadSyncPreviewLoading || graphThreadSyncLoading}
              style={{
                minWidth: 118,
                height: 38,
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                background: "#ffffff",
                color: "#334155",
                fontWeight: 900,
                cursor: emailThreadPreviewLoading || graphThreadSyncPreviewLoading || graphThreadSyncLoading ? "not-allowed" : "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderMatterDocumentDataPreviewPanel() {
    const documentData = matterDocumentDataPreview?.packet?.metadata?.documentData;
    const templateFields = documentData?.templateFields || {};
    const referenceData = documentData?.referenceData || {};
    const refresh = matterDocumentDataPreview?.packet?.refresh || {};

    return (
      <section
        id="matter-document-data-preview-panel"
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
            <p style={{ margin: "6px 0 0", color: "#475569", fontSize: 13, maxWidth: 820 }}>
              This is a read-only review of the data available for future Direct Matter templates.  It reads ClaimIndex and local reference data only.  It does not generate documents, upload documents, write to Clio, or change the print queue.
            </p>
          </div>

          <button
            type="button"
            onClick={loadMatterDocumentDataPreview}
            disabled={matterDocumentDataPreviewLoading}
            style={{
              border: 0,
              borderRadius: 999,
              padding: "10px 16px",
              fontWeight: 900,
              background: matterDocumentDataPreviewLoading ? "#e5e7eb" : "#2563eb",
              color: matterDocumentDataPreviewLoading ? "#64748b" : "#fff",
              cursor: matterDocumentDataPreviewLoading ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {matterDocumentDataPreviewLoading ? "Loading..." : "Refresh Data"}
          </button>
        </div>

        {matterDocumentDataPreview?.error && (
          <div style={{ marginTop: 12, color: "#991b1b", fontWeight: 800 }}>
            Error: {textValue(matterDocumentDataPreview.error)}
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
                <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Scope</div>
                <div style={{ fontWeight: 900 }}>{textValue(documentData.documentScope) || "direct_matter"}</div>
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
                <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>BRL Number</div>
                <div style={{ fontWeight: 900 }}>{textValue(templateFields.displayNumber) || "—"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Provider</div>
                <div style={{ fontWeight: 900 }}>{textValue(templateFields.providerName) || "—"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Patient</div>
                <div style={{ fontWeight: 900 }}>{textValue(templateFields.patientName) || "—"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Insurer</div>
                <div style={{ fontWeight: 900 }}>{textValue(templateFields.insurerName) || "—"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Claim Number</div>
                <div style={{ fontWeight: 900 }}>{textValue(templateFields.claimNumber) || "—"}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Claim Amount</div>
                <div style={{ fontWeight: 900 }}>{money(templateFields.claimAmount)}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Balance</div>
                <div style={{ fontWeight: 900 }}>{money(templateFields.balancePresuit)}</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Treating Provider</div>
                <div style={{ fontWeight: 900 }}>{textValue(templateFields.treatingProviderName) || "—"}</div>
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

            <div style={{ marginTop: 10, fontSize: 12, color: "#64748b", fontWeight: 800 }}>
              Refresh: {textValue(refresh.reason) || "—"}.
            </div>
          </>
        )}
      </section>
    );
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
      const json = {
        ok: false,
        blocked: true,
        error:
          "Settlement close preview is disabled pending a local-first close-preview workflow.  Barsh Matters local schema is now the operational source of truth.",
        sourceOfTruth: "local Barsh Matters schema",
        noClioRead: true,
        noClioWrite: true,
      };
      setSettlementClosePreviewResult(json);

      if (json?.error) {
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
      "Close Paid Settlements?\\n\\nUse this only after payment is confirmed. This will route through the guarded Close Lawsuit workflow, sync the Clio operational close status, mark the master lawsuit Closed with Close Reason = PAID (SETTLEMENT), and mark child matters Closed with Closed Reason = Closed Lawsuit. No documents or print queue records will be changed."
    );

    if (!confirmed) {
      return;
    }

    setSettlementCloseWritebackLoading(true);
    setSettlementCloseWritebackResult(null);

    try {
      const res = await fetch("/api/lawsuits/close", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          masterLawsuitId,
          closeReason: "PAID (SETTLEMENT)",
          actorName: "Barsh Matters User",
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
        action: "guarded-close-paid-settlement-lawsuit",
        error: err?.message || "Close Paid Settlements failed.",
        safety: {
          actionLabel: "Close Paid Settlements via guarded Close Lawsuit",
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

  const startLawsuitSelectedMatterSummary = useMemo(() => {
    const selectedMatterRows = rows.filter((row: any) => selected.includes(Number(row.id)));
    const selectedClaimTotal = selectedMatterRows.reduce((sum, row) => sum + num(row.claimAmount), 0);
    const selectedPaymentTotal = selectedMatterRows.reduce((sum, row) => sum + num(row.paymentVoluntary), 0);
    const selectedBalanceTotal = selectedClaimTotal - selectedPaymentTotal;

    return {
      count: selectedMatterRows.length,
      claimTotal: selectedClaimTotal,
      balanceTotal: selectedBalanceTotal,
      displayNumbers: selectedMatterRows
        .map((row: any) => textValue(row.displayNumber || row.display_number || row.id))
        .filter(Boolean),
    };
  }, [rows, selected]);

  function startLawsuitAmountForMode(): number {
    if (lawsuitOptions.amountSoughtMode === "claim_amount") {
      return startLawsuitSelectedMatterSummary.claimTotal;
    }
    if (lawsuitOptions.amountSoughtMode === "custom") {
      return parseMoneyInput(lawsuitOptions.customAmountSought) ?? 0;
    }
    return startLawsuitSelectedMatterSummary.balanceTotal;
  }

  function startLawsuitSelectedRowsForCreate() {
    return rows.filter((row: any) => selected.includes(Number(row.id)));
  }

  function selectedStartLawsuitCourt(): string {
    return lawsuitOptions.venue === "Other"
      ? lawsuitOptions.venueOther.trim()
      : lawsuitOptions.venue.trim();
  }

  function validateStartLawsuitInputs(): string {
    if (startLawsuitSelectedMatterSummary.count === 0) return "Select at least one matter.";
    if (!selectedStartLawsuitCourt()) return "Court / Venue is required before creating a lawsuit.";
    if (lawsuitOptions.amountSoughtMode === "custom" && startLawsuitAmountForMode() <= 0) {
      return "A valid Lawsuit Amount is required when Other is selected.";
    }
    if (startLawsuitAmountForMode() <= 0) {
      return "A valid Lawsuit Amount is required before creating a lawsuit.";
    }
    return "";
  }

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
        : "Auto-loads when this tab opens from the read-only Clio provider/client contact defaults.  Open the Settlement tab and confirm provider fee defaults were checked.",
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
          ? `${num(settlementValueComparisonMismatches.length)} mismatch(es) found.  Review Current Local Settlement Values and refresh after any correction.`
          : currentClioValuesLoaded
            ? "Current Clio values are loaded.  Save settlement values first, then refresh/read back for exact value comparison."
            : "Refresh local settlement values after saving.",
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

  const startLawsuitInputStyle: React.CSSProperties = {
    padding: 8,
    border: "1px solid #ccc",
    borderRadius: 6,
  };

  const startLawsuitTableStyle: React.CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  };

  const startLawsuitThStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "7px 8px",
    borderBottom: "1px solid #ddd",
    whiteSpace: "nowrap",
  };

  const startLawsuitThRightStyle: React.CSSProperties = {
    ...startLawsuitThStyle,
    textAlign: "right",
  };

  const startLawsuitTdStyle: React.CSSProperties = {
    padding: "7px 8px",
    borderBottom: "1px solid #eee",
    verticalAlign: "top",
  };

  const startLawsuitTdRightStyle: React.CSSProperties = {
    ...startLawsuitTdStyle,
    textAlign: "right",
    whiteSpace: "nowrap",
  };

  const startLawsuitModalBackdropStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 20000,
    background: "rgba(15, 23, 42, 0.32)",
  };

  const startLawsuitModalStyle: React.CSSProperties = {
    position: "absolute",
    left: "calc(50% - min(590px, calc((100vw - 48px) / 2)) + 0px)",
    top: 96,
    width: "min(1180px, calc(100vw - 48px))",
    height: "min(760px, calc(100vh - 96px))",
    minWidth: 720,
    minHeight: 480,
    maxWidth: "calc(100vw - 24px)",
    maxHeight: "calc(100vh - 24px)",
    overflow: "auto",
    resize: "both",
    background: "#fff",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.32)",
    padding: 18,
  };

  const startLawsuitModalDragHandleStyle: React.CSSProperties = {
    cursor: "default",
    userSelect: "none",
    margin: "-18px -18px 16px",
    padding: "14px 18px",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    background: "#0f2a44",
    boxShadow: "0 8px 18px rgba(15, 42, 68, 0.28)",
  };

  const startLawsuitModalTitleStyle: React.CSSProperties = {
    margin: 0,
    textAlign: "center",
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: 30,
    lineHeight: 1.2,
    fontWeight: 700,
    color: "#fff",
    letterSpacing: "0.02em",
  };

  const startLawsuitInlineFieldLabelStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    fontSize: 12,
    fontWeight: 900,
    color: "#334155",
  };

  const startLawsuitAmountModePanelStyle: React.CSSProperties = {
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  };

  const startLawsuitRadioLabelStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    fontWeight: 800,
    color: "#0f172a",
  };

  const startLawsuitModalButtonRowStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
  };

  const startLawsuitSecondaryButtonStyle: React.CSSProperties = {
    border: "1px solid #94a3b8",
    background: "#fff",
    color: "#334155",
    borderRadius: 999,
    padding: "9px 13px",
    fontWeight: 900,
    cursor: "pointer",
  };

  const startLawsuitPrimaryButtonStyle: React.CSSProperties = {
    border: "1px solid #1e3a8a",
    background: "#1e3a8a",
    color: "#fff",
    borderRadius: 999,
    padding: "9px 14px",
    fontWeight: 950,
    cursor: "pointer",
  };



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
      <div data-barsh-matter-header-grid="true" style={{ ...bmGlobalTopBarStyle, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 132px", alignItems: "start", gap: 12, minHeight: 92, maxHeight: 112, overflow: "hidden" }}>
        <div data-barsh-matter-header-left="true" style={{ ...bmGlobalLeftLogoWrapStyle, minWidth: 0, maxWidth: "100%", overflow: "hidden", display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "nowrap" }}>
          <img data-barsh-header-logo-containment="true" data-barsh-matter-left-logo="true" src="/brl-logo.png" alt="BRL Logo" style={{ ...bmGlobalBrlLogoStyle, width: 82, maxWidth: 82, height: "auto", maxHeight: 56, objectFit: "contain", flexShrink: 0 }} />
          <div data-barsh-matter-header-nav-wrap="true" style={{ paddingTop: 4, minWidth: 0, overflow: "hidden" }}>
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
                border: directMatterIsClosedForDisplay() ? "1px solid #fecaca" : "1px solid #86efac",
                borderRadius: 999,
                background: directMatterIsClosedForDisplay() ? "#fef2f2" : "#dcfce7",
                color: directMatterIsClosedForDisplay() ? "#991b1b" : "#166534",
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
          <div style={{ ...bmGlobalPrintButtonRowStyle, position: "relative" }}>
            <BarshHeaderActions onAdministratorClick={openAdministratorMenu} />
          </div>

          <a data-barsh-matter-header-right-logo-link="true" href="/" title="Return to Barsh Matters entry screen" style={{ ...bmGlobalLogoLinkStyle, width: 120, maxWidth: 120, height: 76, maxHeight: 76, overflow: "hidden", display: "flex", alignItems: "flex-start", justifyContent: "center", flexShrink: 0 }}>
            <img data-barsh-header-logo-containment="true" data-barsh-matter-right-logo="true" src="/barsh-matters-cropped-transparent.png" alt="Barsh Matters Logo" style={{ ...bmGlobalLogoStyle, width: 108, maxWidth: 108, height: "auto", maxHeight: 70, objectFit: "contain", display: "block" }} />
          </a>
        </div>
      </div>


{matterAuditHistoryPopupOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Matter Audit History"
          tabIndex={-1}
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
          onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeMatterAuditHistoryPopup(); } }}
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
              overflow: "hidden",
              border: "1px solid #1e3a8a",
              borderRadius: 18,
              background: "#ffffff",
              boxShadow: "0 30px 90px rgba(15, 23, 42, 0.38)",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                background: "#1e3a8a",
                color: "#ffffff",
                textAlign: "center",
                borderTopLeftRadius: 18,
                borderTopRightRadius: 18,
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 950 }}>
                Matter-Level Audit / History
              </div>
              <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, opacity: 0.92 }}>
                {textValue(matter?.displayNumber || matter?.display_number) || matterId || "Matter"}
              </div>
            </div>

            <div style={{ padding: 18, maxHeight: "calc(100vh - 300px)", overflowY: "auto" }}>
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
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                padding: "14px 18px",
                borderTop: "1px solid #e2e8f0",
                background: "#ffffff",
                borderBottomLeftRadius: 18,
                borderBottomRightRadius: 18,
              }}
            >
              <button type="button" onClick={closeMatterAuditHistoryPopup} style={{ minWidth: 96, height: 38, border: "1px solid #cbd5e1", borderRadius: 10, background: "#f8fafc", color: "#334155", fontWeight: 900, cursor: "pointer" }}>Close</button>
              <button type="button" onClick={loadMatterAuditHistory} disabled={matterAuditHistoryLoading} style={{ minWidth: 104, height: 38, border: "1px solid #1e3a8a", borderRadius: 10, background: matterAuditHistoryLoading ? "#93c5fd" : "#1e3a8a", color: "#ffffff", fontWeight: 900, cursor: matterAuditHistoryLoading ? "not-allowed" : "pointer" }}>{matterAuditHistoryLoading ? "Loading..." : "Refresh"}</button>
            </div>
          </div>
        </div>
      )}

{directFieldEditModal === "claimAmount" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit Claim Amount"
          data-barsh-direct-claim-amount-edit-standard-modal="true"
          onClick={() => setDirectFieldEditModal(null)}
          onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setDirectFieldEditModal(null); setDirectFieldEditResult(null); } }}
          tabIndex={-1}
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
          <form
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => { event.preventDefault(); if (!directFieldEditLoading && String(claimAmountInput || "").trim()) void saveClaimAmountEditDialog(); }}
            style={{
              width: "min(520px, calc(100vw - 48px))",
              maxHeight: "calc(100vh - 48px)",
              overflow: "hidden",
              background: "#1e3a8a",
              border: "1px solid transparent",
              borderRadius: 18,
              boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
            }}
          >
            <h2 style={{ margin: 0, padding: "12px 14px", background: "#1e3a8a", color: "#ffffff", textAlign: "center", fontSize: 17, fontWeight: 950, lineHeight: 1.15 }}>
              Edit Claim Amount
            </h2>
              <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.45, fontWeight: 800 }}>Claim Amount is ClaimIndex-backed.</p>

            <div style={{ display: "grid", gap: 12, padding: 16, background: "#ffffff" }}>
              <div data-barsh-direct-claim-amount-current-card="true" style={{ display: "grid", gap: 6, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 12, background: "#f8fafc" }}>
                <span style={{ fontSize: 12, fontWeight: 950, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b" }}>Current</span>
                <strong style={{ fontSize: 16, color: "#0f172a" }}>{formatMoneyInputValue(parseMoneyInputValue(claimAmountInput)) || "—"}</strong>
              </div>
              <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>
                <span>Claim Amount</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={claimAmountInput}
                  autoFocus
                  onFocus={(event) => event.currentTarget.select()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void saveClaimAmountEditDialog();
                    }
                  }}
                  onChange={(event) => setClaimAmountInput(formatMoneyEditingInput(event.target.value))}
                  onBlur={() => setClaimAmountInput(formatMoneyInputValue(parseMoneyInputValue(claimAmountInput)))}
                  style={{
                    height: 40,
                    border: "1px solid #cbd5e1",
                    borderRadius: 10,
                    padding: "0 10px",
                    fontWeight: 800,
                  }}
                />
              </label>

              {directFieldEditResult && !directFieldEditResult.ok && (
                <div
                  style={{
                    border: "1px solid #fecaca",
                    background: "#fef2f2",
                    color: "#991b1b",
                    borderRadius: 12,
                    padding: 10,
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  {textValue(directFieldEditResult.error) || "Claim Amount could not be updated."}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 16px 16px", borderTop: "1px solid #e2e8f0", background: "#ffffff" }}>
              <button
                type="button"
                onClick={() => setDirectFieldEditModal(null)}
                disabled={directFieldEditLoading}
                style={{
                  minWidth: 96,
                  height: 38,
                  border: "1px solid #dc2626",
                  borderRadius: 10,
                  background: directFieldEditLoading ? "#fecaca" : "#dc2626",
                  color: "#ffffff",
                  fontWeight: 900,
                  cursor: directFieldEditLoading ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={directFieldEditLoading || !String(claimAmountInput || "").trim()}
                style={{
                  minWidth: 118,
                  height: 38,
                  border: "1px solid #1e3a8a",
                  borderRadius: 10,
                  background: directFieldEditLoading || !String(claimAmountInput || "").trim() ? "#93c5fd" : "#1e3a8a",
                  color: "#ffffff",
                  fontWeight: 900,
                  cursor: directFieldEditLoading || !String(claimAmountInput || "").trim() ? "not-allowed" : "pointer",
                }}
              >
                {directFieldEditLoading ? "Saving..." : "Confirm Edit"}
              </button>
            </div>
          </form>
        </div>
      )}

      {directFieldEditModal === "dos" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit Date of Service"
          data-barsh-direct-dos-edit-standard-modal="true"
          onClick={() => { setDirectFieldEditModal(null); setDirectFieldEditResult(null); }}
          onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setDirectFieldEditModal(null); setDirectFieldEditResult(null); } }}
          tabIndex={-1}
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
          <form
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => { event.preventDefault(); if (!directFieldEditLoading) void saveDosEditDialog(); }}
            style={{
              width: "min(520px, calc(100vw - 48px))",
              overflow: "hidden",
              border: "1px solid transparent",
              borderRadius: 18,
              background: "#1e3a8a",
              boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
            }}
          >
            <h2 style={{ margin: 0, padding: "12px 14px", background: "#1e3a8a", color: "#ffffff", textAlign: "center", fontSize: 17, fontWeight: 950, lineHeight: 1.15 }}>
              Edit Date of Service
            </h2>

            <div style={{ display: "grid", gap: 12, padding: 16, background: "#ffffff" }}>
              <div data-barsh-direct-dos-current-card="true" style={{ display: "grid", gap: 6, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 12, background: "#f8fafc" }}>
                <span style={{ fontSize: 12, fontWeight: 950, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b" }}>Current</span>
                <strong style={{ fontSize: 16, color: "#0f172a" }}>{dosStartInput || "—"}{dosEndInput && dosEndInput !== dosStartInput ? ` – ${dosEndInput}` : ""}</strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>
                  <span>DOS Start</span>
                  <input type="date" value={dosStartInput} onChange={(event) => setDosStartInput(event.target.value)} style={{ height: 40, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 10px", fontWeight: 800 }} />
                </label>
                <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>
                  <span>DOS End</span>
                  <input type="date" value={dosEndInput} onChange={(event) => setDosEndInput(event.target.value)} style={{ height: 40, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 10px", fontWeight: 800 }} />
                </label>
              </div>
              {directFieldEditResult && !directFieldEditResult.ok && (
                <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 12, padding: 10, fontSize: 13, fontWeight: 800 }}>
                  {textValue(directFieldEditResult.error) || "Date of Service could not be updated."}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 16px 16px", borderTop: "1px solid #e2e8f0", background: "#ffffff" }}>
              <button type="button" onClick={() => { setDirectFieldEditModal(null); setDirectFieldEditResult(null); }} disabled={directFieldEditLoading} style={{ minWidth: 96, height: 38, border: "1px solid #dc2626", borderRadius: 10, background: directFieldEditLoading ? "#fecaca" : "#dc2626", color: "#ffffff", fontWeight: 900, cursor: directFieldEditLoading ? "not-allowed" : "pointer" }}>Cancel</button>
              <button type="submit" disabled={directFieldEditLoading} style={{ minWidth: 118, height: 38, border: "1px solid #1e3a8a", borderRadius: 10, background: directFieldEditLoading ? "#93c5fd" : "#1e3a8a", color: "#ffffff", fontWeight: 900, cursor: directFieldEditLoading ? "not-allowed" : "pointer" }}>{directFieldEditLoading ? "Saving..." : "Confirm Edit"}</button>
            </div>
          </form>
        </div>
      )}

      {directFieldEditModal && directFieldEditModal !== "claimAmount" && directFieldEditModal !== "dos" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Edit ${directPicklistFieldLabel(directFieldEditModal)}`}
          data-barsh-direct-picklist-edit-standard-modal="true"
          onClick={() => { setDirectFieldEditModal(null); setDirectFieldEditResult(null); }}
          onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setDirectFieldEditModal(null); setDirectFieldEditResult(null); } }}
          tabIndex={-1}
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
          <form
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => { event.preventDefault(); if (!directFieldEditLoading && !directFieldPicklistsLoading && directPicklistInputValue(directFieldEditModal)) void savePicklistEditDialog(directFieldEditModal); }}
            style={{
              width: "min(560px, calc(100vw - 48px))",
              boxSizing: "border-box",
              overflow: "hidden",
              border: "1px solid transparent",
              borderRadius: 18,
              background: "#1e3a8a",
              boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
            }}
          >
            <h2 style={{ margin: 0, padding: "12px 14px", background: "#1e3a8a", color: "#ffffff", textAlign: "center", fontSize: 17, fontWeight: 950, lineHeight: 1.15 }}>
              Edit {directPicklistFieldLabel(directFieldEditModal)}
            </h2>

            <div style={{ display: "grid", gap: 12, padding: 16, background: "#ffffff" }}>
              <div data-barsh-direct-picklist-current-card="true" style={{ display: "grid", gap: 6, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 12, background: "#f8fafc" }}>
                <span style={{ fontSize: 12, fontWeight: 950, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b" }}>Current</span>
                <strong style={{ fontSize: 16, color: "#0f172a" }}>{(() => { const currentValue = directPicklistInputValue(directFieldEditModal); const currentOption = picklistOptionsForDirectField(directFieldEditModal).find((option: any) => optionValue(option) === currentValue); return optionLabel(currentOption) || currentValue || "—"; })()}</strong>
              </div>

              <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>
                <span>{directPicklistFieldLabel(directFieldEditModal)}</span>
                <select
                  value={directPicklistInputValue(directFieldEditModal)}
                  onChange={(event) => setDirectPicklistInputValue(directFieldEditModal, event.target.value)}
                  disabled={directFieldPicklistsLoading || directFieldEditLoading}
                  style={{
                    width: "100%",
                    maxWidth: "100%",
                    boxSizing: "border-box",
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
                <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 12, padding: 10, fontSize: 13, fontWeight: 800 }}>
                  {textValue(directFieldEditResult.error) || `${directPicklistFieldLabel(directFieldEditModal)} could not be updated.`}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 16px 16px", borderTop: "1px solid #e2e8f0", background: "#ffffff" }}>
              <button type="button" onClick={() => { setDirectFieldEditModal(null); setDirectFieldEditResult(null); }} disabled={directFieldEditLoading} style={{ minWidth: 96, height: 38, border: "1px solid #dc2626", borderRadius: 10, background: directFieldEditLoading ? "#fecaca" : "#dc2626", color: "#ffffff", fontWeight: 900, cursor: directFieldEditLoading ? "not-allowed" : "pointer" }}>Cancel</button>
              <button type="submit" disabled={directFieldEditLoading || directFieldPicklistsLoading || !directPicklistInputValue(directFieldEditModal)} style={{ minWidth: 118, height: 38, border: "1px solid #1e3a8a", borderRadius: 10, background: directFieldEditLoading || directFieldPicklistsLoading || !directPicklistInputValue(directFieldEditModal) ? "#93c5fd" : "#1e3a8a", color: "#ffffff", fontWeight: 900, cursor: directFieldEditLoading || directFieldPicklistsLoading || !directPicklistInputValue(directFieldEditModal) ? "not-allowed" : "pointer" }}>{directFieldEditLoading ? "Saving..." : "Confirm Edit"}</button>
            </div>
          </form>
        </div>
      )}

      {identityFieldEditModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={"Edit " + identityFieldEditLabel(identityFieldEditModal)}
          data-barsh-direct-identity-edit-standard-modal="true"
          onClick={closeIdentityFieldEditDialog}
          onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeIdentityFieldEditDialog(); } }}
          tabIndex={-1}
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
          <form
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => { event.preventDefault(); if (!identityFieldEditLoading && textValue(identityFieldEditInput)) void saveIdentityFieldEditDialog(); }}
            onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeIdentityFieldEditDialog(); } }}
            style={{
              width: "min(560px, calc(100vw - 48px))",
              maxHeight: "calc(100vh - 48px)",
              overflow: "hidden",
              background: "#1e3a8a",
              border: "1px solid transparent",
              borderRadius: 18,
              boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
            }}
          >
            <h2 style={{ margin: 0, padding: "12px 14px", background: "#1e3a8a", color: "#ffffff", textAlign: "center", fontSize: 17, fontWeight: 950, lineHeight: 1.15 }}>
              Edit {identityFieldEditLabel(identityFieldEditModal)}
            </h2>

            <div style={{ display: "grid", gap: 12, padding: 16, background: "#ffffff" }}>
              <div data-barsh-direct-identity-current-card="true" style={{ display: "grid", gap: 6, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 12, background: "#f8fafc" }}>
                <span style={{ fontSize: 12, fontWeight: 950, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b" }}>Current</span>
                <strong style={{ fontSize: 16, color: "#0f172a" }}>{identityFieldEditModal === "date_of_loss" ? (formatDate(identityFieldEditInput) || "—") : (textValue(identityFieldEditInput) || "—")}</strong>
              </div>

              <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>
                <span>{identityFieldEditLabel(identityFieldEditModal)}</span>
                {identityFieldUsesReferenceOptions(identityFieldEditModal) ? (
                  <select
                    value={identityFieldEditSelectedOptionId}
                    onChange={(event) => {
                      const selectedId = event.target.value;
                      const referenceType = identityFieldReferenceType(identityFieldEditModal);
                      const option = (identityReferenceOptions[referenceType] || []).find((item: any) => String(item?.id) === selectedId);
                      const selectedValue = identityReferenceOptionValue(option);
                      setIdentityFieldEditSelectedOptionId(selectedId);
                      setIdentityFieldEditInput(selectedValue);
                      setIdentityFieldEditResult(null);
                    }}
                    disabled={identityFieldEditLoading || identityReferenceOptionsLoading}
                    style={{ width: "100%", minWidth: 0, border: "1px solid #cbd5e1", borderRadius: 10, background: "#ffffff", color: "#0f172a", padding: "11px 12px", fontSize: 14, fontWeight: 800 }}
                  >
                    <option value="">
                      {identityReferenceOptionsLoading ? "Loading..." : `Select ${identityFieldEditLabel(identityFieldEditModal)}`}
                    </option>
                    {(identityReferenceOptions[identityFieldReferenceType(identityFieldEditModal)] || []).map((option: any, index: number) => {
                      const label = identityReferenceOptionLabel(option);
                      if (!label) return null;
                      return (
                        <option key={`${option?.id || label}-${index}`} value={String(option?.id || "")}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <input
                    type={identityFieldEditModal === "date_of_loss" ? "date" : "text"}
                    value={identityFieldEditInput}
                    onChange={(event) => { setIdentityFieldEditInput(event.target.value); setIdentityFieldEditSelectedOptionId(""); setIdentityFieldEditResult(null); }}
                    disabled={identityFieldEditLoading}
                    style={{ width: "100%", minWidth: 0, border: "1px solid #cbd5e1", borderRadius: 10, background: "#ffffff", color: "#0f172a", padding: "11px 12px", fontSize: 14, fontWeight: 800 }}
                  />
                )}
              </label>

              {identityFieldEditResult && !identityFieldEditResult.ok ? (
                <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 12, padding: 10, fontSize: 13, fontWeight: 800 }}>
                  {textValue(identityFieldEditResult.error) || "Identity field could not be saved."}
                </div>
              ) : null}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 16px 16px", borderTop: "1px solid #e2e8f0", background: "#ffffff" }}>
              <button type="button" onClick={closeIdentityFieldEditDialog} disabled={identityFieldEditLoading} style={{ minWidth: 96, height: 38, border: "1px solid #dc2626", borderRadius: 10, background: identityFieldEditLoading ? "#fecaca" : "#dc2626", color: "#ffffff", fontWeight: 900, cursor: identityFieldEditLoading ? "not-allowed" : "pointer" }}>Cancel</button>
              <button type="submit" disabled={identityFieldEditLoading || !textValue(identityFieldEditInput)} style={{ minWidth: 118, height: 38, border: "1px solid #1e3a8a", borderRadius: 10, background: identityFieldEditLoading || !textValue(identityFieldEditInput) ? "#93c5fd" : "#1e3a8a", color: "#ffffff", fontWeight: 900, cursor: identityFieldEditLoading || !textValue(identityFieldEditInput) ? "not-allowed" : "pointer" }}>{identityFieldEditLoading ? "Saving..." : "Confirm Edit"}</button>
            </div>
          </form>
        </div>
      )}

      {treatingProviderEditOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit Treating Provider"
          data-barsh-direct-treating-provider-edit-standard-modal="true"
          onClick={closeTreatingProviderEditDialog}
          onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeTreatingProviderEditDialog(); } }}
          tabIndex={-1}
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
          <form
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => { event.preventDefault(); if (!treatingProviderSaving && !treatingProviderOptionsLoading && treatingProviderInput) void saveClaimIndexTreatingProvider(); }}
            onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeTreatingProviderEditDialog(); } }}
            style={{
              width: "min(560px, calc(100vw - 48px))",
              maxHeight: "calc(100vh - 48px)",
              overflow: "hidden",
              background: "#1e3a8a",
              border: "1px solid transparent",
              borderRadius: 18,
              boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
            }}
          >
            <h2 style={{ margin: 0, padding: "12px 14px", background: "#1e3a8a", color: "#ffffff", textAlign: "center", fontSize: 17, fontWeight: 950, lineHeight: 1.15 }}>
              Edit Treating Provider
            </h2>

            <div style={{ display: "grid", gap: 12, padding: 16, background: "#ffffff" }}>
              <div data-barsh-direct-treating-provider-current-card="true" style={{ display: "grid", gap: 6, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 12, background: "#f8fafc" }}>
                <span style={{ fontSize: 12, fontWeight: 950, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b" }}>Current</span>
                <strong style={{ fontSize: 16, color: "#0f172a" }}>{localTreatingProviderName() || "—"}</strong>
              </div>
              <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>
                <span>Treating Provider</span>
                <select value={treatingProviderInput} onChange={(event) => { setTreatingProviderInput(event.target.value); setTreatingProviderResult(null); }} disabled={treatingProviderOptionsLoading || treatingProviderSaving} style={{ width: "100%", minWidth: 0, border: "1px solid #cbd5e1", borderRadius: 10, background: "#ffffff", color: "#0f172a", padding: "11px 12px", fontSize: 14, fontWeight: 800 }}>
                  <option value="">{treatingProviderOptionsLoading ? "Loading Treating Providers..." : "Select Treating Provider"}</option>
                  {treatingProviderOptions.map((option: any) => (<option key={option.id} value={option.id}>{option.displayName}</option>))}
                </select>
              </label>
              {treatingProviderResult && !treatingProviderResult.ok ? (<div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 12, padding: 10, fontSize: 13, fontWeight: 800 }}>{textValue(treatingProviderResult.error) || "Treating Provider could not be saved."}</div>) : null}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 16px 16px", borderTop: "1px solid #e2e8f0", background: "#ffffff" }}>
              <button type="button" onClick={closeTreatingProviderEditDialog} disabled={treatingProviderSaving} style={{ minWidth: 96, height: 38, border: "1px solid #dc2626", borderRadius: 10, background: treatingProviderSaving ? "#fecaca" : "#dc2626", color: "#ffffff", fontWeight: 900, cursor: treatingProviderSaving ? "not-allowed" : "pointer" }}>Cancel</button>
              <button type="submit" disabled={treatingProviderSaving || treatingProviderOptionsLoading || !treatingProviderInput} style={{ minWidth: 118, height: 38, border: "1px solid #1e3a8a", borderRadius: 10, background: treatingProviderSaving || treatingProviderOptionsLoading || !treatingProviderInput ? "#93c5fd" : "#1e3a8a", color: "#ffffff", fontWeight: 900, cursor: treatingProviderSaving || treatingProviderOptionsLoading || !treatingProviderInput ? "not-allowed" : "pointer" }}>{treatingProviderSaving ? "Saving..." : "Confirm Edit"}</button>
            </div>
          </form>
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
          {matterHydrationError || "Refreshing matter workspace from local Barsh Matters data..."}
        </div>
      )}

            <section className="barsh-matter-top-workspace barsh-direct-matter-top-workspace">
        <div className="barsh-direct-matter-summary-grid">
          <div className="barsh-direct-matter-main">
<div
              className="barsh-direct-matter-detail-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) 520px",
                gap: 16,
                alignItems: "start",
              }}
            >
              <div
                className="barsh-direct-claim-info-status-layout"
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) 340px",
                  gap: 14,
                  alignItems: "start",
                  paddingTop: 12,
                }}
              >
                <div
                  className="barsh-direct-left-info-column"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                    gap: 12,
                    alignItems: "start",
                  }}
                >
              <div className="barsh-direct-summary-column">
                <div
                  className="barsh-direct-section-title"
                  style={{
                    color: "#334155",
                    fontSize: 12,
                    fontWeight: 950,
                    letterSpacing: "0.08em",
                    margin: "0 0 2px",
                    padding: "0 4px",
                    textTransform: "uppercase",
                  }}
                >
                  Claim Information
                </div>

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
                    <span>Date of Loss</span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openIdentityFieldEditDialog("date_of_loss");
                      }}
                      disabled={identityFieldEditLoading}
                      title="Edit Date of Loss."
                      style={identityEditButtonStyle}
                    >
                      Edit
                    </button>
                  </div>
                  <div className="barsh-direct-summary-value barsh-direct-summary-value-strong">
                    {textValue(matter?.dateOfLoss || matter?.date_of_loss) ? (
                      <a
                        href={`/matters?dateOfLoss=${encodeURIComponent(textValue(matter?.dateOfLoss || matter?.date_of_loss))}`}
                        className="barsh-filter-field-link"
                        style={{ color: "#1d4ed8", textDecoration: "underline", textUnderlineOffset: 2 }}
                      >
                        {formatDate(matter?.dateOfLoss || matter?.date_of_loss) || "—"}
                      </a>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>

              </div>

              <div className="barsh-direct-summary-column" style={{ paddingTop: 28 }}>
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
                    <span>Claim Amount</span>
                    <button
                      type="button"
                      onClick={openClaimAmountEditDialog}
                      disabled={directFieldEditLoading}
                      title="Edit Claim Amount."
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
                    {money(num(matter?.claimAmount))}
                  </div>
                </div>

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

                </div>

              <div
                className="barsh-direct-summary-column barsh-direct-claim-status-column"
                style={{
                  position: "relative",
                  display: "grid",
                  gap: 10,
                  width: 340,
                  maxWidth: "100%",
                  justifySelf: "start",
                  padding: "12px 0 0 12",
                  alignSelf: "stretch",
                  alignContent: "start",
                  borderLeft: "none",
                  height: 470,
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: -7,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background: "#94a3b8",
                  }}
                />
                <div
                  className="barsh-direct-section-title"
                  style={{
                    color: "#334155",
                    fontSize: 12,
                    fontWeight: 950,
                    letterSpacing: "0.08em",
                    margin: "0 0 2px",
                    padding: "0 4px",
                    textTransform: "uppercase",
                  }}
                >
                  Claim Status
                </div>

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
                    {textValue(matter?.matterStage?.name || matter?.matterStageName || matter?.matter_stage_name || matter?.status) || "—"}
                  </div>
                </div>

                <div className="barsh-direct-summary-card">
                  <div
                    className="barsh-direct-summary-label"
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
                  >
                    <span>Final Status</span>
                  </div>
                  <div className="barsh-direct-summary-value">
                    {(() => {
                      const rawFinalStatus = textValue(matter?.finalStatus || matter?.final_status).toLowerCase();
                      if (rawFinalStatus === "closed") return "Closed";
                      if (rawFinalStatus === "open") return "Open";
                      return textValue(matter?.closeReason || matter?.close_reason) ? "Closed" : "Open";
                    })()}
                  </div>
                </div>

                <div className="barsh-direct-summary-card">
                  <div
                    className="barsh-direct-summary-label"
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
                  >
                    <span>Closed Reason</span>
                  </div>
                  <div className="barsh-direct-summary-value">
                    {textValue(matter?.closeReason || "") || "—"}
                  </div>
                </div>              </div>
              </div>

              <div
                className="barsh-direct-financial-bubble"
                data-barsh-direct-actions-outer-section="true"
                style={{
                  marginTop: 12,
                  display: "grid",
                  gap: 8,
                  background: "transparent",
                  padding: 0,
                  border: "none",
                  borderRadius: 0,
                  boxShadow: "none",
                }}
              >
                <div
                  data-barsh-direct-actions-section-heading="true"
                  style={{
                    fontSize: 12,
                    fontWeight: 950,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#1e3a8a",
                    marginBottom: 8,
                  }}
                >
                  Actions
                </div>

                <div
                  data-barsh-direct-action-area="true"
                  style={{
                    display: "grid",
                    gap: 12,
                    marginBottom: 12,
                    padding: 12,
                    border: "1px solid #dbeafe",
                    borderRadius: 14,
                    background: "#ffffff",
                  }}
                >
                  <div
                    data-barsh-direct-action-tab-row="true"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 8,
                      alignItems: "stretch",
                    }}
                  >
                    {[
                      { key: "payments", label: "Payments", fill: "#16a34a", soft: "#f0fdf4", text: "#166534" },
                      { key: "documents", label: "Documents", fill: "#8b5e3c", soft: "#f8efe7", text: "#7c4a22" },
                    ].map(({ key, label, fill, soft, text }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setDirectActionGroup(key as any)}
                        data-barsh-direct-action-tab={key}
                        style={{
                          width: "100%",
                          minHeight: 40,
                          border: `1px solid ${fill}`,
                          borderRadius: 999,
                          background: directActionGroup === key ? fill : soft,
                          color: directActionGroup === key ? "#ffffff" : text,
                          fontSize: 12,
                          fontWeight: 950,
                          cursor: "pointer",
                          padding: "0 8px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div data-barsh-direct-action-panel="true" style={{ minHeight: directActionGroup ? 52 : 0 }}>
                    {directActionGroup === "payments" && (
                      <div
                        data-barsh-direct-action-section="payment-actions"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "132px 132px",
                          gap: "6px 10px",
                          alignItems: "start",
                          width: "fit-content",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentApplyResult(null);
                            setPaymentEditingReceipt(null);
                            setPaymentFormOpen((open) => !open);
                            setPaymentDateInput((current) => current || formatPaymentDateYYYYMMDD(new Date()));
                          }}
                          disabled={paymentApplyLoading || matterPaymentControlsDisabled()}
                          title={matterPaymentDisabledReason() || "Open payment entry form."}
                          style={{
                            height: 36,
                            minHeight: 36,
                            width: 132,
                            minWidth: 132,
                            border: "1px solid #16a34a",
                            borderRadius: 999,
                            background: paymentApplyLoading || matterPaymentControlsDisabled() ? "#f8fafc" : "#f0fdf4",
                            color: paymentApplyLoading || matterPaymentControlsDisabled() ? "#94a3b8" : "#166534",
                            fontSize: 12,
                            fontWeight: 950,
                            cursor: paymentApplyLoading || matterPaymentControlsDisabled() ? "not-allowed" : "pointer",
                            padding: "0 14px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {paymentApplyLoading ? "Posting..." : paymentFormOpen ? "Close Payment" : "Post Payment"}
                        </button>

                        <button
                          type="button"
                          onClick={() => setDirectPaymentsPanelOpen((open) => !open)}
                          title="Show recent matter payment receipts."
                          style={{
                            appearance: "none",
                            WebkitAppearance: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: 36,
                            minHeight: 36,
                            width: 132,
                            minWidth: 132,
                            lineHeight: 1,
                            padding: "0 14px",
                            margin: 0,
                            verticalAlign: "top",
                            boxShadow: "none",
                            transform: "none",
                            border: "1px solid #16a34a",
                            borderRadius: 999,
                            background: "#f0fdf4",
                            color: "#166534",
                            fontSize: 12,
                            fontWeight: 950,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                          data-barsh-direct-view-payments-button="true"
                        >
                          View Payments
                        </button>

                        {matterPaymentControlsDisabled() && (
                          <div
                            data-barsh-direct-payment-warning-under-post="true"
                            style={{
                            appearance: "none",
                            WebkitAppearance: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: 36,
                            minHeight: 36,
                            width: 132,
                            minWidth: 132,
                            lineHeight: 1,
                            padding: "0 14px",
                            margin: 0,
                            verticalAlign: "top",
                            boxShadow: "none",
                            transform: "none",
                              gridColumn: "1 / 2",
                              color: "#991b1b",
                              fontSize: 11,
                              fontWeight: 850,
                              maxWidth: 132,
                            }}
                          >
                            {matterPaymentDisabledReason()}
                          </div>
                        )}
                      </div>
                    )}

                    {directActionGroup === "documents" && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} data-barsh-direct-action-section="documents-communications">
                        <button
                          type="button"
                          title="Open the Direct Matter Clio document picker."
                          onClick={() => void openMatterViewDocumentsPopup()}
                          style={{
                            minHeight: 36,
                            border: "1px solid #8b5e3c",
                            borderRadius: 999,
                            background: "#f8efe7",
                            color: "#7c4a22",
                            fontSize: 12,
                            fontWeight: 950,
                            cursor: "pointer",
                            padding: "0 14px",
                            whiteSpace: "nowrap",
                          }}
                          data-barsh-direct-view-documents-button="true"
                        >
                          View Documents
                        </button>
                        <button
                          type="button"
                          title="Open read-only local email and Microsoft Graph thread records for this matter."
                          onClick={() => {
                            setActiveWorkspaceTab("email_threads");
                            openMatterViewEmailsPopup();
                          }}
                          style={{
                            minHeight: 36,
                            border: "1px solid #8b5e3c",
                            borderRadius: 999,
                            background: "#f8efe7",
                            color: "#7c4a22",
                            fontSize: 12,
                            fontWeight: 950,
                            cursor: "pointer",
                            padding: "0 14px",
                            whiteSpace: "nowrap",
                          }}
                          data-barsh-direct-view-emails-button="true"
                        >
                          View Emails
                        </button>
                        <button
                          type="button"
                          title="Open the Direct Matter document generation preview popup."
                          onClick={launchMatterDocumentGenerationDialog}
                          style={{
                            minHeight: 36,
                            border: "1px solid #8b5e3c",
                            borderRadius: 999,
                            background: "#f8efe7",
                            color: "#7c4a22",
                            fontSize: 12,
                            fontWeight: 950,
                            cursor: "pointer",
                            padding: "0 14px",
                            whiteSpace: "nowrap",
                          }}
                          data-barsh-direct-generate-documents-button="true"
                        >
                          Generate Documents
                        </button>
                      </div>
                    )}
                  </div>

                </div>

                <div style={{ textAlign: "center", marginBottom: 12 }}>
                </div>

                <div className="barsh-direct-financial-row">
                  <span>Claim Amount</span>
                  <strong>{money(directMatterClaimAmountValue(matter))}</strong>
                </div>

                <div className="barsh-direct-financial-row">
                  <span>Payments</span>
                  <strong>{money(directMatterPaymentPostedValue(matter))}</strong>
                </div>

                <div className="barsh-direct-financial-row total">
                  <span>Balance</span>
                  <strong>{money(currentDirectMatterBalancePresuit(matter))}</strong>
                </div>

                <button
                  type="button"
                  data-barsh-direct-visible-close-matter-button="true"
                  onClick={() => {
                    if (!matter?.id || matterIsClosedForPayment()) return;
                    setCloseMatterTarget({
                      id: matter.id,
                      displayNumber: textValue(matter?.displayNumber || matter?.display_number || matterId),
                    });
                    setCloseReason("");
                    setShowCloseModal(true);
                  }}
                  disabled={!matter?.id || matterIsClosedForPayment() || closing}
                  style={{
                    width: "100%",
                    minHeight: 42,
                    border: "1px solid #dc2626",
                    borderRadius: 999,
                    background: !matter?.id || matterIsClosedForPayment() || closing ? "#f3f4f6" : "#dc2626",
                    color: !matter?.id || matterIsClosedForPayment() || closing ? "#6b7280" : "#ffffff",
                    fontSize: 13,
                    fontWeight: 950,
                    cursor: !matter?.id || matterIsClosedForPayment() || closing ? "not-allowed" : "pointer",
                    marginTop: 10,
                  }}
                >
                  {matterIsClosedForPayment() ? "Matter Closed" : "Close Matter"}
                </button>


                {paymentFormOpen && (
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Post Payment"
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
                      data-barsh-direct-payment-header-standard="true"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "16px 18px",
                        borderBottom: "1px solid #1e3a8a",
                        background: "#1e3a8a",
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          fontSize: 18,
                          fontWeight: 950,
                          color: "#ffffff",
                          textAlign: "center",
                        }}
                      >
                        Post Individual Matter Payment
                      </div>
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
                        <span>Transaction Type{paymentTransactionOptionsLoading ? " · loading..." : ""}</span>
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
                          {paymentTransactionTypeDropdownOptions().map((option) => (
                            <option key={option} value={option}>
                                {directPaymentTransactionTypeDisplay(option)}
                              </option>
                          ))}
                        </select>
                      </label>

                      <label className="barsh-direct-payment-field">
                        <span>Transaction Status</span>
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
                          {paymentTransactionStatusDropdownOptions().map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </label>

                      <label className="barsh-direct-payment-field">
                        <span>Transaction Date</span>
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
                        <span>Amount</span>
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
                          setPaymentTransactionTypeInput("Voluntary Payment");
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
                        disabled={paymentFormSubmitDisabled()}
                        title={
                          paymentFormSubmitDisabled() && !paymentApplyLoading
                            ? "Complete all required payment fields before posting."
                            : "Post payment."
                        }
                        style={{
                          minWidth: 150,
                          height: 44,
                          border: "1px solid #16a34a",
                          borderRadius: 12,
                          background: paymentFormSubmitDisabled() ? "#bbf7d0" : "#16a34a",
                          color: "#fff",
                          fontWeight: 900,
                          fontSize: 15,
                          cursor: paymentFormSubmitDisabled() ? "not-allowed" : "pointer",
                          opacity: paymentFormSubmitDisabled() ? 0.72 : 1,
                        }}
                      >
                        {paymentApplyLoading ? "Posting..." : "Post Payment"}
                      </button>
                    </div>
                    </div>
                  </div>
                )}

                {paymentApplyResult?.ok && (
                  <div className="barsh-direct-payment-confirmation">
                    <div>
                      {paymentApplyResult?.action === "void-payment"
                        ? `Receipt #${paymentApplyResult?.receipt?.id || "—"} voided.`
                        : `Receipt #${paymentApplyResult?.receipt?.id || "—"} posted.`}
                    </div>
                    <div>
                      {paymentApplyResult?.action === "void-payment"
                        ? `Payment voided by ${money(paymentApplyResult.paymentVoided || paymentApplyResult.paymentApplied || 0)}.  Payments Posted: ${money(paymentApplyResult.after?.paymentVoluntary)}.  Balance: ${money(paymentApplyResult.after?.balancePresuit)}.`
                        : `Payment: ${money(paymentApplyResult.paymentApplied)}.  Payments Posted: ${money(paymentApplyResult.after?.paymentVoluntary)}.  Balance: ${money(paymentApplyResult.after?.balancePresuit)}.`}
                    </div>

                  </div>
                )}

                {paymentApplyResult && !paymentApplyResult.ok && (
                  <div className="barsh-direct-payment-error">
                    {textValue(paymentApplyResult.error) || "Payment could not be posted."}
                  </div>
                )}

                {paymentClosePromptOpen && (
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Close Matter?"
                    data-barsh-direct-payment-close-prompt-standard-modal="true"
                    onKeyDown={(event) => { if (event.key === "Escape") setPaymentClosePromptOpen(false); }}
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
                        width: "min(440px, calc(100vw - 48px))",
                        border: "1px solid #cbd5e1",
                        borderRadius: 18,
                        background: "#fff",
                        boxShadow: "0 28px 90px rgba(15, 23, 42, 0.34)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        data-barsh-direct-payment-close-prompt-header-standard="true"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "44px minmax(0, 1fr) 44px",
                          alignItems: "center",
                          gap: 10,
                          padding: "16px 18px",
                          borderBottom: "1px solid #1e3a8a",
                          background: "#1e3a8a",
                        }}
                      >
                        <div aria-hidden="true" />
                        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 950, color: "#ffffff", textAlign: "center" }}>
                          Close Matter?
                        </h2>
                        <div aria-hidden="true" />
                      </div>

                      <div style={{ padding: 18, display: "grid", gap: 12 }}>
                        <div
                          data-barsh-direct-payment-close-prompt-current-card="true"
                          style={{
                            border: "1px solid #e2e8f0",
                            borderRadius: 14,
                            background: "#f8fafc",
                            padding: 14,
                            color: "#0f172a",
                            fontSize: 14,
                            fontWeight: 800,
                            lineHeight: 1.45,
                          }}
                        >
                          Payment activity was saved. Do you want to close this matter now?
                        </div>
                      </div>

                      <div
                        data-barsh-direct-payment-close-prompt-footer-actions="true"
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: 10,
                          padding: "14px 18px 18px",
                          borderTop: "1px solid #e5e7eb",
                          background: "#f8fafc",
                        }}
                      >
                        <button type="button" onClick={() => setPaymentClosePromptOpen(false)} style={{ minWidth: 104, height: 38, border: "1px solid #cbd5e1", borderRadius: 10, background: "#ffffff", color: "#334155", fontSize: 14, fontWeight: 900, cursor: "pointer" }}>
                          No
                        </button>
                        <button type="button" onClick={openCloseMatterFromPayment} style={{ minWidth: 148, height: 38, border: "1px solid #dc2626", borderRadius: 10, background: "#dc2626", color: "#ffffff", fontSize: 14, fontWeight: 900, cursor: "pointer" }}>
                          Yes, Close Matter
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>

        {directPaymentsPanelOpen && (
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
                  {directPaymentTransactionTypeDisplay(receipt.transactionType)}
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
              Void reverses the local payment total and keeps the receipt as an audit record. Posted payments cannot be edited; void and repost if correction is needed.
            </div>
          )}
        </div>
        )}

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

      {false && activeWorkspaceTab === "lawsuit" && !alreadyAggregated && (
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
                Lawsuit generation and metadata controls for this matter group.  Barsh Matters local schema is the operational source of truth,
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
            <div
              style={{
                padding: "8px 12px",
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                color: "#475569",
                borderRadius: 4,
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              Use the Start Lawsuit button in Matter Actions to create a lawsuit from this individual matter.
            </div>

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
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                color: "#475569",
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              Lawsuit creation for this individual matter starts from the Start Lawsuit button in Matter Actions.
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

      {renderMatterViewDocumentsPopup()}
      {renderMatterDocumentActivityPopup()}
      {renderMatterDocumentGenerationPopup()}
      
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
                  Current Local Settlement Values
                </div>
                <div style={{ color: "#475569", fontSize: 12 }}>
                  Local settlement value review for child/bill matters.  This does not write to Clio, ClaimIndex, documents, or the print queue.
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
                {currentSettlementValuesLoading ? "Refreshing..." : "Refresh Local Values"}
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
              Source: {textValue(currentSettlementValuesResult?.source) || "local Barsh Matters data when loaded"}.
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
                    Read-only preview of planned settlement documents using local settlement values.  This does not generate documents, upload to Clio, create database records, or change the print queue.
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
              Preview does not close anything. Actual closure should occur only after payment is confirmed and now routes through the guarded Close Lawsuit workflow.
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
                    Use only after payment is confirmed. This runs the guarded Close Lawsuit workflow. Clio close sync must succeed before local close records are committed. Documents and print queue records are not changed.
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
                    Guarded Close Lawsuit completed. Clio operational close status was synced before local close records were committed.
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
                      These are proposed print candidates only.  Each listed document has been verified against the current Clio repository storage Documents tab.
                    </div>
                  </div>
                )}
            </>
          )}
        </section>
      )}

      {renderMatterViewEmailsPopup()}

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
                      <span style={{ fontSize: 18, lineHeight: 1 }}>🖨️</span>
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
                  {aggregated ? "🖨️ " : ""}
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
          background: "rgba(15, 23, 42, 0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
        onClick={() => setShowMetadataModal(false)}
        onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setShowMetadataModal(false); } }}
        tabIndex={-1}
      >
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            width: "min(560px, calc(100vw - 32px))",
            maxHeight: "calc(100vh - 64px)",
            overflow: "hidden",
            background: "#ffffff",
            border: "1px solid #1e3a8a",
            borderRadius: 18,
            boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
          }}
        >
          <h2 style={{ margin: 0, padding: "14px 18px", background: "#1e3a8a", color: "#ffffff", textAlign: "center", fontSize: 20, fontWeight: 950, lineHeight: 1.15 }}>
            Edit Lawsuit Metadata
          </h2>

          <div style={{ display: "grid", gap: 12, padding: 18, maxHeight: "calc(100vh - 170px)", overflowY: "auto", background: "#ffffff" }}>

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
              padding: "11px 12px",
              marginBottom: 10,
              border: "1px solid #cbd5e1",
              borderRadius: 10,
            }}
          >
            <option value="">Choose Court</option>
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
              placeholder="Court / venue"
              style={{
                width: "100%",
                padding: "11px 12px",
                marginBottom: 14,
                border: "1px solid #cbd5e1",
                borderRadius: 10,
              }}
            />
          )}

          <fieldset
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 12,
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
                placeholder="Total lawsuit amount sought"
                style={{
                  width: "100%",
                  padding: "11px 12px",
                  marginTop: 2,
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
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
            placeholder="Index / AAA Number"
            style={{
              width: "100%",
              padding: "11px 12px",
              marginBottom: 14,
              border: "1px solid #cbd5e1",
              borderRadius: 10,
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
            placeholder="Notes"
            rows={3}
            style={{
              width: "100%",
              padding: "11px 12px",
              marginBottom: 0,
              border: "1px solid #cbd5e1",
              borderRadius: 10,
              resize: "vertical",
            }}
          />

          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 18px", borderTop: "1px solid #e2e8f0", background: "#ffffff", borderBottomLeftRadius: 18, borderBottomRightRadius: 18 }}>
            <button
              onClick={() => setShowMetadataModal(false)}
              disabled={metadataSaving}
              style={{
                minWidth: 96,
                height: 38,
                border: "1px solid #dc2626",
                background: metadataSaving ? "#fecaca" : "#dc2626",
                color: "#ffffff",
                borderRadius: 10,
                fontWeight: 900,
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
                minWidth: 118,
                height: 38,
                border: "1px solid #1e3a8a",
                background:
                  metadataSaving ||
                  (metadataEdit.amountSoughtMode === "custom" &&
                    parseMoneyInput(metadataEdit.customAmountSought) === null)
                    ? "#93c5fd"
                    : "#1e3a8a",
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
      <div style={startLawsuitModalBackdropStyle}>
        <div style={startLawsuitModalStyle}>
          <div
            style={startLawsuitModalDragHandleStyle}
            title="Create Lawsuit"
          >
            <h2 style={startLawsuitModalTitleStyle}>Create Lawsuit</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(360px, 520px)", gap: 12, marginBottom: 12 }}>
            <label style={startLawsuitInlineFieldLabelStyle}>
              <span>Choose Court</span>
              <input
                list="barsh-start-lawsuit-court-options"
                value={lawsuitOptions.venue}
                onChange={(e) =>
                  setLawsuitOptions((prev) => ({
                    ...prev,
                    venue: e.target.value,
                    venueOther: e.target.value === "Other" ? prev.venueOther : "",
                  }))
                }
                placeholder="Select or enter court"
                style={{ ...startLawsuitInputStyle, width: 360 }}
              />
            </label>
          </div>

          <div style={startLawsuitAmountModePanelStyle}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>
              Lawsuit Amount <span style={{ color: "#dc2626" }}>*</span>
            </div>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <label style={startLawsuitRadioLabelStyle}>
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
                />
                Billed Amount ({money(startLawsuitSelectedMatterSummary.claimTotal)})
              </label>

              <label style={startLawsuitRadioLabelStyle}>
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
                />
                Balance ({money(startLawsuitSelectedMatterSummary.balanceTotal)})
              </label>

              <label style={startLawsuitRadioLabelStyle}>
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
                />
                Other
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
                  placeholder="Enter lawsuit amount"
                  style={{ ...startLawsuitInputStyle, width: 180 }}
                />
              )}
            </div>

            <div style={{ marginTop: 8, fontSize: 13, color: "#334155" }}>
              Selected Lawsuit Amount: <strong>{money(startLawsuitAmountForMode())}</strong>
            </div>
          </div>

          <datalist id="barsh-start-lawsuit-court-options">
            {VENUE_OPTIONS.map((venue) => (
              <option key={venue} value={venue} />
            ))}
          </datalist>

          <div style={{ marginBottom: 10, fontWeight: 900 }}>
            Selected Matters: {startLawsuitSelectedMatterSummary.count} · Selected Lawsuit Amount: {money(startLawsuitAmountForMode())}
          </div>

          <div style={{ maxHeight: 260, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 12 }}>
            <table style={startLawsuitTableStyle}>
              <thead>
                <tr>
                  <th style={startLawsuitThStyle}>Matter</th>
                  <th style={startLawsuitThStyle}>Patient</th>
                  <th style={startLawsuitThStyle}>Provider</th>
                  <th style={startLawsuitThStyle}>Insurer</th>
                  <th style={startLawsuitThRightStyle}>Claim Amount</th>
                  <th style={startLawsuitThRightStyle}>Payment</th>
                  <th style={startLawsuitThRightStyle}>Balance</th>
                  <th style={startLawsuitThStyle}>Denial Reason</th>
                  <th style={startLawsuitThStyle}>Filing Status</th>
                  <th style={startLawsuitThStyle}>Matter Status</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((row: any) => selected.includes(Number(row.id)))
                  .map((row: any) => (
                    <tr key={`start-lawsuit-review-${Number(row.id)}`}>
                      <td style={startLawsuitTdStyle}>{textValue(row.displayNumber || row.display_number || row.id)}</td>
                      <td style={startLawsuitTdStyle}>{textValue(row.patient) || "—"}</td>
                      <td style={startLawsuitTdStyle}>{providerValue(row) || "—"}</td>
                      <td style={startLawsuitTdStyle}>{insurerValue(row) || "—"}</td>
                      <td style={startLawsuitTdRightStyle}>{money(num(row.claimAmount))}</td>
                      <td style={startLawsuitTdRightStyle}>{money(num(row.paymentVoluntary))}</td>
                      <td style={startLawsuitTdRightStyle}>{money(num(row.claimAmount) - num(row.paymentVoluntary))}</td>
                      <td style={startLawsuitTdStyle}>{denialReasonValue(row) || "—"}</td>
                      <td style={startLawsuitTdStyle}>{textValue(row.masterLawsuitId) || "Not Filed"}</td>
                      <td style={startLawsuitTdStyle}>
                        <span style={{ color: String(row.closeReason || "").trim() ? "#dc2626" : "#15803d", fontWeight: 900 }}>
                          {String(row.closeReason || "").trim() ? "Closed" : "Open"}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 12 }}>
            <span>Lawsuit Notes</span>
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
                ...startLawsuitInputStyle,
                resize: "vertical",
              }}
            />
          </label>

          {startLawsuitError && (
            <div
              style={{
                border: "1px solid #fecaca",
                background: "#fef2f2",
                color: "#991b1b",
                borderRadius: 8,
                padding: 10,
                marginBottom: 12,
                fontSize: 13,
                fontWeight: 850,
              }}
            >
              {startLawsuitError}
            </div>
          )}

          {startLawsuitPreview && (
            <div
              style={{
                border: "1px solid #bbf7d0",
                background: "#f0fdf4",
                color: "#166534",
                borderRadius: 8,
                padding: 10,
                marginBottom: 12,
                fontSize: 13,
                fontWeight: 850,
              }}
            >
              <strong>Preview Ready:</strong> {startLawsuitPreview.selectedMatterCount} matters · Lawsuit Amount {money(startLawsuitPreview.amountSought)}
            </div>
          )}

          <div style={startLawsuitModalButtonRowStyle}>
            <button
              type="button"
              onClick={() => {
                setShowLawsuitOptionsModal(false);
                setStartLawsuitPreview(null);
                setStartLawsuitError("");
              }}
              disabled={submitting}
              style={{ ...startLawsuitSecondaryButtonStyle, border: "1px solid #dc2626", background: submitting ? "#fecaca" : "#dc2626", color: "#ffffff" }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={previewStartLawsuitFromMatter}
              disabled={submitting || Boolean(validateStartLawsuitInputs())}
              style={{
                ...startLawsuitSecondaryButtonStyle,
                opacity: submitting || Boolean(validateStartLawsuitInputs()) ? 0.45 : 1,
                cursor: submitting || Boolean(validateStartLawsuitInputs()) ? "not-allowed" : "pointer",
              }}
            >
              Preview Lawsuit
            </button>

            <button
              type="button"
              onClick={submitAggregationWithOptions}
              disabled={submitting || Boolean(validateStartLawsuitInputs())}
              style={{
                ...startLawsuitPrimaryButtonStyle,
                opacity: submitting || Boolean(validateStartLawsuitInputs()) ? 0.45 : 1,
                cursor: submitting || Boolean(validateStartLawsuitInputs()) ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Working..." : "Confirm Create Lawsuit"}
            </button>
          </div>
        </div>
      </div>
    )}

    {showCloseModal && (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Close Matter"
        data-barsh-direct-close-matter-standard-modal="true"
        onClick={() => { setShowCloseModal(false); setCloseMatterTarget(null); setCloseReason(""); }}
        onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setShowCloseModal(false); setCloseMatterTarget(null); setCloseReason(""); } }}
        tabIndex={-1}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.42)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: 24,
        }}
      >
        <form
          onClick={(event) => event.stopPropagation()}
          onSubmit={(event) => { event.preventDefault(); if (closeReason && !closing) void handleCloseMatter(); }}
          onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setShowCloseModal(false); setCloseMatterTarget(null); setCloseReason(""); } }}
          style={{
            width: "min(520px, calc(100vw - 48px))",
            overflow: "hidden",
            background: "#1e3a8a",
            border: "1px solid transparent",
            borderRadius: 18,
            boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
          }}
        >
          <h2 style={{ margin: 0, padding: "12px 14px", background: "#1e3a8a", color: "#ffffff", textAlign: "center", fontSize: 17, fontWeight: 950, lineHeight: 1.15 }}>
            Close Matter
          </h2>

          <div style={{ display: "grid", gap: 12, padding: 16, background: "#ffffff" }}>
            <div data-barsh-direct-close-matter-current-card="true" style={{ display: "grid", gap: 6, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 12, background: "#f8fafc" }}>
              <span style={{ fontSize: 12, fontWeight: 950, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b" }}>Current</span>
              <strong style={{ fontSize: 16, color: "#0f172a" }}>{textValue(closeMatterTarget?.displayNumber) || textValue(matter?.displayNumber || matter?.display_number) || "—"}</strong>
            </div>

            <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>
              <span>Close Reason</span>
              <select
                value={closeReason}
                onChange={(event) => setCloseReason(event.target.value)}
                style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 10, background: "#ffffff", color: "#0f172a", padding: "11px 12px", fontSize: 14, fontWeight: 800 }}
              >
                <option value="">Select Close Reason</option>
                {VALID_CLOSE_REASONS.map((reason) => (<option key={reason} value={reason}>{reason}</option>))}
              </select>
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 16px 16px", borderTop: "1px solid #e2e8f0", background: "#ffffff" }}>
            <button type="button" onClick={() => { setShowCloseModal(false); setCloseMatterTarget(null); setCloseReason(""); }} disabled={closing} style={{ minWidth: 96, height: 38, border: "1px solid #dc2626", borderRadius: 10, background: closing ? "#fecaca" : "#dc2626", color: "#ffffff", fontWeight: 900, cursor: closing ? "not-allowed" : "pointer" }}>Cancel</button>
            <button type="submit" disabled={!closeReason || closing} style={{ minWidth: 118, height: 38, border: "1px solid #dc2626", borderRadius: 10, background: !closeReason || closing ? "#fecaca" : "#dc2626", color: !closeReason || closing ? "#7f1d1d" : "#ffffff", fontWeight: 900, cursor: !closeReason || closing ? "not-allowed" : "pointer" }}>{closing ? "Closing..." : "Close Matter"}</button>
          </div>
        </form>
      </div>
    )}
    </>
  );
}
