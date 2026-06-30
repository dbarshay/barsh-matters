"use client";

import BarshHeaderActions from "@/app/components/BarshHeaderActions";
import BarshHeaderQuickNav from "@/app/components/BarshHeaderQuickNav";
import BarshHeader from "@/app/components/BarshHeader";
import { formatDateOnlyForDisplay } from "@/lib/dateOnlyDisplay";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type CalendarEvent = {
  id: string;
  masterLawsuitId: string;
  displayNumber?: string | null;
  eventType: string;
  title: string;
  court?: string | null;
  venue?: string | null;
  indexAaaNumber?: string | null;
  calendarNumber?: string | null;
  eventDate: string;
  eventTime?: string | null;
  part?: string | null;
  judgeOrArbitrator?: string | null;
  appearanceType?: string | null;
  notes?: string | null;
  status: string;
  reminderDate?: string | null;
  reminderTicklerId?: string | null;
  caseData?: {
    childCount?: number;
    patients?: string[];
    providers?: string[];
    insurers?: string[];
    lawsuitAmount?: number | null;
    lawsuitBalance?: number | null;
    caption?: string | null;
    lawsuitStatus?: string | null;
    adversaryAttorney?: string | null;
    claimNumbers?: string[];
    matters?: Array<Record<string, unknown>>;
  };
};

type SearchResult = {
  ok?: boolean;
  count?: number;
  events?: CalendarEvent[];
  error?: string;
  safety?: Record<string, unknown>;
};

const eventTypeOptions = [
  ["all", "All Types"],
  ["appearance", "Appearance"],
  ["filing_deadline", "Filing Deadline"],
  ["return_date", "Return Date"],
  ["motion_date", "Motion Date"],
  ["trial_date", "Trial Date"],
  ["arbitration_date", "Arbitration Date"],
  ["adjournment", "Adjournment"],
  ["follow_up", "Follow-Up"],
  ["custom", "Custom"],
];

const statusOptions = [
  ["all", "All Statuses"],
  ["scheduled", "Scheduled"],
  ["completed", "Completed"],
  ["adjourned", "Adjourned"],
  ["cancelled", "Cancelled"],
  ["missed", "Missed"],
];

const WEB_CIVIL_LOCAL_CALENDAR_URL = "https://iapps.courts.state.ny.us/webcivilLocal/LCCalendarSearch";

const appearanceTypeOptions = [["all", "All"], ["Trial", "Trial"], ["Conference", "Conference"], ["Motion", "Motion"]];

type FilterOptionsResult = { ok?: boolean; appearanceTypes?: string[]; venues?: string[]; clientNames?: string[]; error?: string; };

type WebCivilImportResult = {
  ok?: boolean;
  previewOnly?: boolean;
  databaseRecordsChanged?: boolean;
  parsedRowCount?: number;
  importableRowCount?: number;
  skippedRowCount?: number;
  updatedCount?: number;
  rows?: Array<{
    rowNumber: number;
    eventId?: string;
    calendarNumber?: string;
    status: "ready" | "updated" | "skipped" | "error";
    reason?: string;
    currentCalendarNumber?: string | null;
    event?: CalendarEvent | null;
  }>;
  error?: string;
  safety?: Record<string, unknown>;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function labelFromCode(value: unknown): string {
  const raw = text(value);
  if (!raw) return "—";
  return raw
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function dateOnly(value: unknown): string {
  return formatDateOnlyForDisplay(value) || text(value) || "—";
}


function money(value: unknown) {
  const formatted = printableMoney(value);
  return formatted || "—";
}

function safeExportCell(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => text(item)).filter(Boolean).join("; ");
  return text(value);
}

function safeHtml(value: unknown): string {
  return text(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function printableMoney(value: unknown) {
  const raw = text(value).trim();
  if (!raw) return "";
  const numeric = typeof value === "number" ? value : Number(raw.replace(/[$,]/g, ""));
  if (!Number.isFinite(numeric)) return raw.startsWith("$") ? raw : "$" + raw;
  return "$" + numeric.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function printableResultLines(): string {
  return "<div class=\"adj-line\"><span>Adj.</span><span class=\"date-write-line\"></span></div>" +
    ["Final?", "Conf.?", "Settled?", "Discon.?"].map((label) => "<div class=\"scan-choice\"><span class=\"scan-label\">" + label + "</span><span class=\"bubble\"></span><span>Yes</span><span class=\"bubble\"></span><span>No</span></div>").join("");
}

function timestampForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function downloadWorkbookRows(headers: string[], rows: unknown[][], filename: string, sheetName: string) {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

const pageStyle: React.CSSProperties = {
  padding: "12px 14px 30px",
  width: "100%",
  maxWidth: "none",
  margin: 0,
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  color: "#0f172a",
  background: "#f8fafc",
  minHeight: "100vh",
};

const headerRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 18,
  flexWrap: "wrap",
};

const headerLeftStyle: React.CSSProperties = {
  display: "grid",
  justifyItems: "start",
  alignContent: "start",
  maxWidth: 760,
};

const quickNavWrapStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "flex-start",
  maxWidth: 700,
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  background: "#fff",
  boxShadow: "0 14px 34px rgba(15, 23, 42, 0.07)",
  padding: 16,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "9px 10px",
  fontWeight: 750,
  color: "#0f172a",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
  fontSize: 12,
  color: "#475569",
  fontWeight: 900,
};

const primaryButtonStyle: React.CSSProperties = {
  border: "1px solid #1e3a8a",
  background: "#1e3a8a",
  color: "#fff",
  borderRadius: 999,
  padding: "10px 14px",
  fontWeight: 950,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #94a3b8",
  background: "#fff",
  color: "#334155",
  borderRadius: 999,
  padding: "10px 14px",
  fontWeight: 900,
  cursor: "pointer",
  textDecoration: "none",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 8px",
  borderBottom: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#334155",
  fontSize: 12,
  fontWeight: 950,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px solid #e5e7eb",
  verticalAlign: "top",
  fontSize: 13,
};

const wrapCellStyle: React.CSSProperties = {
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
  lineHeight: 1.25,
};

const nowrapCellStyle: React.CSSProperties = {
  whiteSpace: "nowrap",
};

const compactIdCellStyle: React.CSSProperties = {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const moneyCellStyle: React.CSSProperties = {
  whiteSpace: "nowrap",
  textAlign: "left",
  fontVariantNumeric: "tabular-nums",
};

const resultColumnWidths = [
  "5.5%",  // Date
  "9.5%",  // Court
  "6%",    // Calendar Number
  "7%",    // Index Number
  "7.5%",  // Lawsuit Number
  "7.5%",  // Appearance Type
  "6.5%",  // Lawsuit Amount
  "6.5%",  // Lawsuit Balance
  "7%",    // Adversary Attorney
  "37%",   // Caption
];
const resultTableMinWidth = 1280;

export default function CourtCalendarPage() {
  const [masterLawsuitId, setMasterLawsuitId] = useState("");
  const [eventType, setEventType] = useState("all");
  const [status, setStatus] = useState("scheduled");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appearanceTypeFilter, setAppearanceTypeFilter] = useState("all");
  const [venueFilter, setVenueFilter] = useState("all");
  const [clientNameFilter, setClientNameFilter] = useState("all");
  const [hideClosedMatters, setHideClosedMatters] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptionsResult | null>(null);
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [reportType, setReportType] = useState("all");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createResult, setCreateResult] = useState<any>(null);
  const [webCivilImportOpen, setWebCivilImportOpen] = useState(false);
  const [webCivilImportText, setWebCivilImportText] = useState("");
  const [webCivilImportLoading, setWebCivilImportLoading] = useState(false);
  const [webCivilImportResult, setWebCivilImportResult] = useState<WebCivilImportResult | null>(null);
  const [calendarNumberDrafts, setCalendarNumberDrafts] = useState<Record<string, string>>({});
  const [calendarNumberSaving, setCalendarNumberSaving] = useState(false);
  const [form, setForm] = useState({
    masterLawsuitId: "",
    eventType: "appearance",
    title: "",
    eventDate: "",
    eventTime: "",
    court: "",
    venue: "",
    indexAaaNumber: "",
    calendarNumber: "",
    part: "",
    judgeOrArbitrator: "",
    appearanceType: "",
    reminderDate: "",
    createReminderTickler: true,
    notes: "",
  });

  const rawEvents = useMemo(() => Array.isArray(result?.events) ? result.events : [], [result]);
  type CourtCalendarSortKey = "eventDate" | "court" | "calendarNumber" | "indexNumber" | "lawsuitNumber" | "appearanceType" | "lawsuitAmount" | "lawsuitBalance" | "caption";
  const [calendarResultSort, setCalendarResultSort] = useState<{ key: CourtCalendarSortKey; direction: "asc" | "desc" }>({ key: "eventDate", direction: "asc" });

  function calendarResultSortValue(event: CalendarEvent, key: CourtCalendarSortKey) {
    if (key === "eventDate") return text(event.eventDate);
    if (key === "court") return text(event.court || event.venue).toLowerCase();
    if (key === "calendarNumber") return text(event.calendarNumber).toLowerCase();
    if (key === "indexNumber") return text(event.indexAaaNumber).toLowerCase();
    if (key === "lawsuitNumber") return text(event.displayNumber || event.masterLawsuitId).toLowerCase();
    if (key === "appearanceType") return text(event.appearanceType).toLowerCase();
    if (key === "lawsuitAmount") return Number(event.caseData?.lawsuitAmount || 0);
    if (key === "lawsuitBalance") return Number(event.caseData?.lawsuitBalance || 0);
    if (key === "caption") return text(event.caseData?.caption).toLowerCase();
    return "";
  }

  function sortableCalendarValue(event: CalendarEvent, key: CourtCalendarSortKey): string | number {
    if (key === "eventDate") return text(event.eventDate);
    if (key === "court") return text(event.court || event.venue).toLowerCase();
    if (key === "calendarNumber") {
      const numeric = Number(text(event.calendarNumber).replace(/[^0-9.]/g, ""));
      return Number.isFinite(numeric) ? numeric : text(event.calendarNumber).toLowerCase();
    }
    if (key === "indexNumber") return text(event.indexAaaNumber).toLowerCase();
    if (key === "lawsuitNumber") return text(event.displayNumber || event.masterLawsuitId).toLowerCase();
    if (key === "appearanceType") return text(event.appearanceType || event.eventType).toLowerCase();
    if (key === "lawsuitAmount") return Number(event.caseData?.lawsuitAmount || 0);
    if (key === "lawsuitBalance") return Number(event.caseData?.lawsuitBalance || 0);
    if (key === "caption") return text(event.caseData?.caption).toLowerCase();
    return "";
  }

  const events = useMemo(() => {
    const sorted = [...rawEvents];
    sorted.sort((a, b) => {
      if (calendarResultSort.key === "eventDate" && calendarResultSort.direction === "asc") {
        const dateCompare = text(a.eventDate).localeCompare(text(b.eventDate));
        if (dateCompare !== 0) return dateCompare;
        const courtCompare = text(a.court || a.venue).localeCompare(text(b.court || b.venue));
        if (courtCompare !== 0) return courtCompare;
        const leftCalendarNumber = Number(text(a.calendarNumber).replace(/[^0-9.]/g, ""));
        const rightCalendarNumber = Number(text(b.calendarNumber).replace(/[^0-9.]/g, ""));
        if (Number.isFinite(leftCalendarNumber) || Number.isFinite(rightCalendarNumber)) return (Number.isFinite(leftCalendarNumber) ? leftCalendarNumber : 999999) - (Number.isFinite(rightCalendarNumber) ? rightCalendarNumber : 999999);
        return text(a.calendarNumber).localeCompare(text(b.calendarNumber));
      }
      const left = sortableCalendarValue(a, calendarResultSort.key);
      const right = sortableCalendarValue(b, calendarResultSort.key);
      if (typeof left === "number" || typeof right === "number") return (Number(left) - Number(right)) * (calendarResultSort.direction === "asc" ? 1 : -1);
      return String(left).localeCompare(String(right)) * (calendarResultSort.direction === "asc" ? 1 : -1);
    });
    return sorted;
  }, [rawEvents, calendarResultSort]);

  function sortableCalendarHeader(label: string, key: CourtCalendarSortKey) {
    const active = calendarResultSort.key === key;
    const direction = active ? calendarResultSort.direction : "asc";
    return (
      <button
        type="button"
        onClick={() => setCalendarResultSort((current) => current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" })}
        style={{ appearance: "none", border: 0, background: "transparent", color: "inherit", font: "inherit", fontWeight: 950, cursor: "pointer", padding: 0, textAlign: "left" }}
        data-barsh-court-calendar-sort-header={key}
        title={`Sort by ${label}`}
      >
        {label} {active ? (direction === "asc" ? "▲" : "▼") : ""}
      </button>
    );
  }

  useEffect(() => { async function loadFilterOptions() { setFilterOptionsLoading(true); try { const response = await fetch("/api/court-calendar/filter-options", { cache: "no-store" }); const json = await response.json().catch(() => ({})); setFilterOptions(json); } catch (error: any) { setFilterOptions({ ok: false, error: error?.message || "Could not load filter options." }); } finally { setFilterOptionsLoading(false); } } void loadFilterOptions(); }, []);

  const venueOptions = useMemo(() => Array.isArray(filterOptions?.venues) ? filterOptions.venues : [], [filterOptions]);
  const clientNameOptions = useMemo(() => Array.isArray(filterOptions?.clientNames) ? filterOptions.clientNames : [], [filterOptions]);

  function resetCourtCalendarFilters() {
    setMasterLawsuitId("");
    setEventType("all");
    setStatus("scheduled");
    setDateFrom("");
    setDateTo("");
    setAppearanceTypeFilter("all");
    setVenueFilter("all");
    setClientNameFilter("all");
    setHideClosedMatters(false);
    setQuery("");
    setReportType("all");
    setResult(null);
    setCalendarNumberDrafts({});
    setWebCivilImportResult(null);
  }

  function buildSearchParams() {
    const params = new URLSearchParams();
    if (masterLawsuitId.trim()) params.set("masterLawsuitId", masterLawsuitId.trim());
    if (eventType && eventType !== "all") params.set("eventType", eventType);
    if (status && status !== "all") params.set("status", status);
    if (dateFrom.trim()) params.set("dateFrom", dateFrom.trim());
    if (dateTo.trim()) params.set("dateTo", dateTo.trim());
    if (venueFilter && venueFilter !== "all") params.set("venue", venueFilter);
    if (appearanceTypeFilter && appearanceTypeFilter !== "all") params.set("appearanceType", appearanceTypeFilter);
    if (clientNameFilter && clientNameFilter !== "all") params.set("clientName", clientNameFilter);
    if (query.trim()) params.set("q", query.trim());
    if (hideClosedMatters) params.set("hideClosedMatters", "true");
    params.set("includeCaseData", "true");
    params.set("limit", "500");
    return params;
  }

  async function searchEvents() {
    setLoading(true);
    try {
      const response = await fetch(`/api/court-calendar/events?${buildSearchParams().toString()}`, { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      setResult(json);
      if (!response.ok || !json?.ok) {
        alert(json?.error || "Court calendar search failed.");
      }
    } catch (error: any) {
      const fallback = { ok: false, error: error?.message || "Court calendar search failed.", events: [] };
      setResult(fallback);
      alert(fallback.error);
    } finally {
      setLoading(false);
    }
  }

  function handleCalendarFilterKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void searchEvents();
  }

  async function createEvent() {
    if (!form.masterLawsuitId.trim()) {
      alert("Master Lawsuit ID is required.");
      return;
    }

    if (!form.eventDate.trim()) {
      alert("Event Date is required.");
      return;
    }

    setCreateLoading(true);
    setCreateResult(null);

    try {
      const response = await fetch("/api/court-calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          createReminderTickler: !!form.createReminderTickler && !!form.reminderDate,
          sourcePage: "court-calendar",
          sourceAction: "dedicated-court-calendar-page-create",
          actorName: "Barsh Matters User",
        }),
      });

      const json = await response.json().catch(() => ({}));
      setCreateResult(json);

      if (!response.ok || !json?.ok) {
        alert(json?.error || "Court calendar event creation failed.");
        return;
      }

      setCreateOpen(false);
      setMasterLawsuitId(form.masterLawsuitId);
      await searchEvents();
    } catch (error: any) {
      const fallback = { ok: false, error: error?.message || "Court calendar event creation failed." };
      setCreateResult(fallback);
      alert(fallback.error);
    } finally {
      setCreateLoading(false);
    }
  }

  function selectedCourtCalendarReportTitle(activeReportType = reportType) {
    if (activeReportType === "trial-calendar") return "Trial Calendar Report";
    if (activeReportType === "appearance-calendar") return "Court Appearance Report";
    return "Court Calendar Report";
  }

  function selectedCourtCalendarReportSlug(activeReportType = reportType) {
    if (activeReportType === "trial-calendar") return "trial-calendar-report";
    if (activeReportType === "appearance-calendar") return "appearance-calendar-report";
    return "court-calendar-report";
  }

  function selectedCourtCalendarReportSheetName(activeReportType = reportType) {
    if (activeReportType === "trial-calendar") return "Trial Calendar";
    if (activeReportType === "appearance-calendar") return "Appearance Calendar";
    return "Court Calendar";
  }

  function buildCourtCalendarFilterSummary() {
    return [
      dateFrom || dateTo ? "Date: " + (dateFrom || "Any") + " to " + (dateTo || "Any") : "Date: Current filtered results",
      venueFilter === "all" ? "Venue: All" : "Venue: " + venueFilter,
      clientNameFilter === "all" ? "Provider: All" : "Provider: " + clientNameFilter,
      appearanceTypeFilter === "all" ? "Appearance: All" : "Appearance: " + appearanceTypeFilter,
      hideClosedMatters ? "Closed matters hidden" : "Closed matters included",
      "Report Type: " + selectedCourtCalendarReportTitle(),
    ].join(" · ");
  }

  function groupedCourtCalendarEvents() {
    const groupMap = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const groupName = text(event.court || event.venue) || "Unspecified Court / Venue";
      const existingGroup = groupMap.get(groupName);
      if (existingGroup) existingGroup.push(event);
      else groupMap.set(groupName, [event]);
    }
    return Array.from(groupMap.entries());
  }

  function printableCourtCalendarReportTable(groupEvents: CalendarEvent[], activeReportType = reportType) {
    function printableAppearanceCaption(rawCaption: string) {
      const caption = text(rawCaption);
      const marker = " v. ";
      const last = caption.lastIndexOf(marker);
      if (last > 0) {
        const lead = caption.slice(0, last).trim();
        const insurer = caption.slice(last + marker.length).trim();
        return safeHtml(lead) + "<br/><span class=\"caption-insurer-line\">v. " + safeHtml(insurer) + "</span>";
      }
      return safeHtml(caption);
    }

    if (activeReportType === "appearance-calendar") {
      let rowsHtml = "";
      for (const event of groupEvents) {
        rowsHtml += "<tr><td class=\"cal-no\">" + safeHtml(event.calendarNumber || "") + "</td><td class=\"index-no\">" + safeHtml(event.indexAaaNumber) + "</td><td class=\"packet-id\">" + safeHtml(event.displayNumber || event.masterLawsuitId) + "</td><td class=\"case-status\">" + safeHtml(event.caseData?.lawsuitStatus || "") + "</td><td class=\"money\">" + safeHtml(printableMoney(event.caseData?.lawsuitAmount)) + "</td><td class=\"money\">" + safeHtml(printableMoney(event.caseData?.lawsuitBalance)) + "</td><td class=\"caption\">" + printableAppearanceCaption(event.caseData?.caption || event.title) + "</td><td class=\"adversary-attorney\">" + safeHtml(event.caseData?.adversaryAttorney || "") + "</td><td class=\"appearance-type\">" + safeHtml(event.appearanceType || labelFromCode(event.eventType)) + "</td><td class=\"result-cell\">" + printableResultLines() + "</td></tr>";
      }
      return "<table class=\"appearance-report court-appearance-report\"><thead><tr><th>Calendar<br/>Number</th><th>Index<br/>Number</th><th>Lawsuit<br/>Number</th><th>Status</th><th>Lawsuit<br/>Amount</th><th>Lawsuit<br/>Balance</th><th>Caption</th><th>Adversary<br/>Attorney</th><th>Appearance<br/>Type</th><th>Result</th></tr></thead><tbody>" + rowsHtml + "</tbody></table>";
    }

    if (activeReportType === "trial-calendar") {
      let rowsHtml = "";
      for (const event of groupEvents) {
        rowsHtml += "<tr><td class=\"cal-no\">" + safeHtml(event.calendarNumber || "0") + "</td><td class=\"index-no\">" + safeHtml(event.indexAaaNumber) + "</td><td class=\"packet-id\">" + safeHtml(event.displayNumber || event.masterLawsuitId) + "</td><td class=\"case-status\">" + safeHtml(labelFromCode(event.status || event.eventType)) + "</td><td class=\"money\">" + safeHtml(printableMoney(event.caseData?.lawsuitAmount)) + "</td><td class=\"money\">" + safeHtml(printableMoney(event.caseData?.lawsuitBalance)) + "</td><td class=\"caption\">" + safeHtml(event.caseData?.caption || event.title) + "</td><td class=\"defense-attorney\"></td><td class=\"trial-status\">" + safeHtml(event.appearanceType || labelFromCode(event.eventType)) + "</td><td class=\"trial-result\">" + printableResultLines() + "</td></tr>";
      }
      return "<table class=\"trial-report\"><thead><tr><th>Daily Court<br/>Cal. No</th><th>Index / AAA<br/>Number</th><th>Packet ID /<br/>Case ID</th><th>Case Status</th><th>Claim<br/>Amount</th><th>Balance<br/>Amount</th><th>Case Caption</th><th>Defendant<br/>Attorney</th><th>Trial Status</th><th>Trial Result</th></tr></thead><tbody>" + rowsHtml + "</tbody></table>";
    }

    let rowsHtml = "";
    for (const event of groupEvents) {
      rowsHtml += "<tr><td class=\"date-cell\">" + safeHtml(dateOnly(event.eventDate)) + "</td><td class=\"time-cell\">" + safeHtml(event.eventTime || "") + "</td><td class=\"cal-no\">" + safeHtml(event.calendarNumber || "") + "</td><td class=\"index-no\">" + safeHtml(event.indexAaaNumber) + "</td><td class=\"packet-id\">" + safeHtml(event.displayNumber || event.masterLawsuitId) + "</td><td class=\"case-status\">" + safeHtml(labelFromCode(event.status || event.eventType)) + "</td><td class=\"appearance-type\">" + safeHtml(event.appearanceType || labelFromCode(event.eventType)) + "</td><td class=\"money\">" + safeHtml(printableMoney(event.caseData?.lawsuitAmount)) + "</td><td class=\"money\">" + safeHtml(printableMoney(event.caseData?.lawsuitBalance)) + "</td><td class=\"caption\">" + safeHtml(event.caseData?.caption || event.title) + "</td><td class=\"judge-cell\">" + safeHtml(event.judgeOrArbitrator || "") + "</td></tr>";
    }
    return "<table class=\"all-report\"><thead><tr><th>Date</th><th>Time</th><th>Cal.<br/>No.</th><th>Index / AAA<br/>Number</th><th>Lawsuit<br/>Number</th><th>Status</th><th>Appearance<br/>Type</th><th>Claim<br/>Amount</th><th>Balance<br/>Amount</th><th>Caption</th><th>Judge /<br/>Arbitrator</th></tr></thead><tbody>" + rowsHtml + "</tbody></table>";
  }

  function printCalendarReport(activeReportType = "all") {
    if (events.length === 0) {
      alert("Run a search before printing the Court Calendar report.");
      return;
    }
    const printWindow = window.open("", "_blank");
    if (printWindow === null) {
      alert("Browser blocked printable Court Calendar report window.");
      return;
    }
    const reportDate = dateFrom || events[0]?.eventDate || new Date().toISOString().slice(0, 10);
    const generatedAt = new Date().toLocaleString();
    const filterSummary = buildCourtCalendarFilterSummary();
    const reportTitle = selectedCourtCalendarReportTitle(activeReportType);
    let groupsHtml = "";
    for (const [groupName, groupEvents] of groupedCourtCalendarEvents()) {
      const groupDate = groupEvents[0]?.eventDate || reportDate;
      if (activeReportType === "appearance-calendar") {
        groupsHtml += "<section class=\"court-group court-appearance-group\"><h1 class=\"report-title\">Court Appearance Report" + (groupName ? " for " + safeHtml(groupName) : "") + "</h1><div class=\"appearance-date\">" + safeHtml(dateOnly(groupDate)) + "</div>" + printableCourtCalendarReportTable(groupEvents, activeReportType) + "</section>";
      } else {
        groupsHtml += "<section class=\"court-group\"><div class=\"court-heading\"><span>" + safeHtml(dateOnly(reportDate)) + "</span><span>" + safeHtml(groupName) + "</span></div>" + printableCourtCalendarReportTable(groupEvents, activeReportType) + "</section>";
      }
    }
    const html = "<!doctype html><html><head><meta charset=\"utf-8\" /><title>" + safeHtml(reportTitle) + "</title><style>@page { size: landscape; margin: 0.28in 0.22in; } * { box-sizing: border-box; } body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; background: #fff; font-size: 9px; } .report-title { text-align: center; font-size: 22px; font-weight: 900; margin: 0 0 14px; } .report-meta { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 6px; font-size: 8px; color: #334155; } .court-heading { display: grid; grid-template-columns: 115px 1fr; align-items: end; gap: 8px; font-size: 12px; font-weight: 900; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding: 0 0 3px; margin: 0 0 3px; } .court-group { margin-bottom: 14px; } .court-appearance-report { margin-top: 4px; } table { width: 100%; border-collapse: collapse; table-layout: fixed; page-break-inside: auto; } thead { display: table-header-group; } tfoot { display: table-footer-group; } tbody { display: table-row-group; } tr { page-break-inside: avoid; break-inside: avoid; } tbody tr { page-break-inside: avoid; break-inside: avoid; } th { text-align: left; vertical-align: bottom; font-size: 7.5px; font-weight: 900; color: #475569; border-bottom: 1px solid #cbd5e1; padding: 2px 3px; line-height: 1.05; page-break-inside: avoid; break-inside: avoid; } td { vertical-align: top; border-bottom: 1px solid #d7dde5; padding: 3px 3px; line-height: 1.08; word-break: break-word; overflow-wrap: anywhere; page-break-inside: avoid; break-inside: avoid; } .money { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; } .trial-result { white-space: nowrap; } .result-line { display: grid; grid-template-columns: 34px 1fr; align-items: end; gap: 2px; line-height: 1.08; } .blank-line { border-bottom: 1px solid #9ca3af; height: 8px; min-width: 72px; } .appearance-date { text-align: center; font-size: 17px; font-weight: 950; margin: 4px 0 18px; } .result-cell { font-size: 7.5px; line-height: 1.12; } .adj-line { display: grid; grid-template-columns: 28px 1fr; gap: 5px; align-items: end; margin-bottom: 4px; } .date-write-line { border-bottom: 1px solid #111827; min-width: 70px; height: 14px; } .scan-choice { display: grid; grid-template-columns: 38px 8px 16px 8px 14px; gap: 2px; align-items: center; margin-top: 1px; white-space: nowrap; } .bubble { display: inline-block; width: 7px; height: 7px; border: 1px solid #111827; border-radius: 999px; } .trial-report th:nth-child(1), .trial-report td:nth-child(1) { width: 5.8%; } .trial-report th:nth-child(2), .trial-report td:nth-child(2) { width: 9.3%; } .trial-report th:nth-child(3), .trial-report td:nth-child(3) { width: 9.3%; } .trial-report th:nth-child(4), .trial-report td:nth-child(4) { width: 9.3%; } .trial-report th:nth-child(5), .trial-report td:nth-child(5) { width: 7.2%; } .trial-report th:nth-child(6), .trial-report td:nth-child(6) { width: 7.4%; } .trial-report th:nth-child(7), .trial-report td:nth-child(7) { width: 17.8%; } .trial-report th:nth-child(8), .trial-report td:nth-child(8) { width: 10%; } .trial-report th:nth-child(9), .trial-report td:nth-child(9) { width: 8.7%; } .trial-report th:nth-child(10), .trial-report td:nth-child(10) { width: 15.2%; } .appearance-report th:nth-child(1), .appearance-report td:nth-child(1) { width: 7.2%; } .appearance-report th:nth-child(2), .appearance-report td:nth-child(2) { width: 5.2%; } .appearance-report th:nth-child(3), .appearance-report td:nth-child(3) { width: 5.4%; } .appearance-report th:nth-child(4), .appearance-report td:nth-child(4) { width: 9%; } .appearance-report th:nth-child(5), .appearance-report td:nth-child(5) { width: 8.2%; } .appearance-report th:nth-child(6), .appearance-report td:nth-child(6) { width: 8.5%; } .appearance-report th:nth-child(7), .appearance-report td:nth-child(7) { width: 7%; } .appearance-report th:nth-child(8), .appearance-report td:nth-child(8) { width: 7%; } .appearance-report th:nth-child(9), .appearance-report td:nth-child(9) { width: 24%; } .appearance-report th:nth-child(10), .appearance-report td:nth-child(10) { width: 8%; } .appearance-report th:nth-child(11), .appearance-report td:nth-child(11) { width: 10.5%; } .court-appearance-report th, .court-appearance-report td { font-size: 9.6px; line-height: 1.18; padding: 5px 5px; } .court-appearance-report tbody tr { min-height: 74px; } .court-appearance-report th { text-align: center; } .court-appearance-report th:nth-child(1), .court-appearance-report td:nth-child(1) { width: 3.2%; white-space: nowrap; } .court-appearance-report th:nth-child(2), .court-appearance-report td:nth-child(2) { width: 6.3%; white-space: nowrap; } .court-appearance-report th:nth-child(3), .court-appearance-report td:nth-child(3) { width: 6.2%; white-space: normal; overflow-wrap: anywhere; } .court-appearance-report th:nth-child(4), .court-appearance-report td:nth-child(4) { width: 8%; } .court-appearance-report th:nth-child(5), .court-appearance-report td:nth-child(5) { width: 5%; white-space: nowrap; text-align: right; } .court-appearance-report th:nth-child(6), .court-appearance-report td:nth-child(6) { width: 5%; white-space: nowrap; text-align: right; } .court-appearance-report th:nth-child(7), .court-appearance-report td:nth-child(7) { width: 30%; padding-left: 10px; } .court-appearance-report th:nth-child(8), .court-appearance-report td:nth-child(8) { width: 12%; } .court-appearance-report th:nth-child(9), .court-appearance-report td:nth-child(9) { width: 7%; } .court-appearance-report th:nth-child(10), .court-appearance-report td:nth-child(10) { width: 16.3%; } .court-appearance-report .result-cell { font-size: 9.2px; line-height: 1.36; white-space: nowrap; padding-top: 8px; padding-bottom: 8px; } .court-appearance-report .scan-choice { grid-template-columns: 54px 14px 22px 14px 20px; column-gap: 5px; row-gap: 7px; margin-top: 8px; margin-bottom: 6px; } .court-appearance-report .bubble { width: 14px; height: 14px; border-width: 1.4px; } .court-appearance-report th:nth-child(2), .court-appearance-report td:nth-child(2), .court-appearance-report th:nth-child(3), .court-appearance-report td:nth-child(3) { white-space: nowrap; word-break: keep-all; overflow-wrap: normal; } .court-appearance-report th:nth-child(4), .court-appearance-report td:nth-child(4) { padding-left: 10px; } .court-appearance-report th:nth-child(9), .court-appearance-report td:nth-child(9) { white-space: nowrap; word-break: keep-all; overflow-wrap: normal; } .court-appearance-report .caption-insurer-line { display: block; margin-top: 2px; } .court-appearance-report .caption { line-height: 1.08; } .all-report th:nth-child(1), .all-report td:nth-child(1) { width: 6.5%; } .all-report th:nth-child(2), .all-report td:nth-child(2) { width: 4.8%; } .all-report th:nth-child(3), .all-report td:nth-child(3) { width: 5%; } .all-report th:nth-child(4), .all-report td:nth-child(4) { width: 8.2%; } .all-report th:nth-child(5), .all-report td:nth-child(5) { width: 7.8%; } .all-report th:nth-child(6), .all-report td:nth-child(6) { width: 7%; } .all-report th:nth-child(7), .all-report td:nth-child(7) { width: 8%; } .all-report th:nth-child(8), .all-report td:nth-child(8) { width: 6.5%; } .all-report th:nth-child(9), .all-report td:nth-child(9) { width: 6.5%; } .all-report th:nth-child(10), .all-report td:nth-child(10) { width: 31.7%; } .all-report th:nth-child(11), .all-report td:nth-child(11) { width: 8%; } .screen-only { margin: 10px 0; text-align: center; } @media print { .screen-only { display: none; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }</style></head><body><div class=\"screen-only\"><button onclick=\"window.print()\">Print / Save PDF</button></div>" + (activeReportType === "appearance-calendar" ? "" : "<h1 class=\"report-title\">" + safeHtml(reportTitle) + "</h1>") + (activeReportType === "appearance-calendar" ? "" : "<div class=\"report-meta\"><div>" + safeHtml(filterSummary) + "</div><div>" + safeHtml(events.length) + " matters from current filtered results · Generated " + safeHtml(generatedAt) + "</div></div>") + groupsHtml + "<script>setTimeout(() => window.print(), 250);</script></body></html>";
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  function exportCalendarReport(activeReportType = "all") {
    let headers: string[];
    let rows: any[][];

    if (activeReportType === "trial-calendar") {
      headers = ["Event Date", "Event Time", "Court", "Daily Court Cal. No", "Index / AAA Number", "Packet ID / Case ID", "Case Status", "Claim Amount", "Balance Amount", "Case Caption", "Defendant Attorney", "Trial Status", "Trial Result"];
      rows = events.map((event) => [safeExportCell(event.eventDate), safeExportCell(event.eventTime), safeExportCell(event.court || event.venue), safeExportCell(event.calendarNumber || "0"), safeExportCell(event.indexAaaNumber), safeExportCell(event.displayNumber || event.masterLawsuitId), safeExportCell(labelFromCode(event.status || event.eventType)), safeExportCell(printableMoney(event.caseData?.lawsuitAmount)), safeExportCell(printableMoney(event.caseData?.lawsuitBalance)), safeExportCell(event.caseData?.caption || event.title), "", safeExportCell(event.appearanceType || labelFromCode(event.eventType)), ""]);
    } else if (activeReportType === "appearance-calendar") {
      headers = ["Event Date", "Event Time", "Court", "Calendar Number", "Index / AAA", "Master Lawsuit", "Appearance Type", "Claim Amount", "Balance Amount", "Caption", "Judge / Arbitrator", "Notes"];
      rows = events.map((event) => [safeExportCell(event.eventDate), safeExportCell(event.eventTime), safeExportCell(event.court || event.venue), safeExportCell(event.calendarNumber), safeExportCell(event.indexAaaNumber), safeExportCell(event.displayNumber || event.masterLawsuitId), safeExportCell(event.appearanceType || labelFromCode(event.eventType)), safeExportCell(printableMoney(event.caseData?.lawsuitAmount)), safeExportCell(printableMoney(event.caseData?.lawsuitBalance)), safeExportCell(event.caseData?.caption || event.title), safeExportCell(event.judgeOrArbitrator), safeExportCell(event.notes)]);
    } else {
      headers = ["Event Date", "Event Time", "Court", "Calendar Number", "Index / AAA", "Master Lawsuit", "Status", "Appearance Type", "Claim Amount", "Balance Amount", "Caption", "Judge / Arbitrator", "Notes"];
      rows = events.map((event) => [safeExportCell(event.eventDate), safeExportCell(event.eventTime), safeExportCell(event.court || event.venue), safeExportCell(event.calendarNumber), safeExportCell(event.indexAaaNumber), safeExportCell(event.displayNumber || event.masterLawsuitId), safeExportCell(labelFromCode(event.status || event.eventType)), safeExportCell(event.appearanceType || labelFromCode(event.eventType)), safeExportCell(printableMoney(event.caseData?.lawsuitAmount)), safeExportCell(printableMoney(event.caseData?.lawsuitBalance)), safeExportCell(event.caseData?.caption || event.title), safeExportCell(event.judgeOrArbitrator), safeExportCell(event.notes)]);
    }

    downloadWorkbookRows(headers, rows, `barsh-matters-${selectedCourtCalendarReportSlug(activeReportType)}-${timestampForFilename()}.xlsx`, selectedCourtCalendarReportSheetName(activeReportType));
  }

  function printCourtAppearanceReport() {
    printCalendarReport("appearance-calendar");
  }

  function calendarNumberDraftChanged(event: CalendarEvent) {
    const eventKey = String(event.id);
    if (!Object.prototype.hasOwnProperty.call(calendarNumberDrafts, eventKey)) return false;
    return calendarNumberDrafts[eventKey].trim() !== text(event.calendarNumber).trim();
  }

  function hasCalendarNumberChanges() {
    return events.some((event) => calendarNumberDraftChanged(event));
  }

  async function saveCalendarNumbers() {
    const changedEvents = events.filter((event) => calendarNumberDraftChanged(event));
    if (!changedEvents.length) return;
    setCalendarNumberSaving(true);
    try {
      for (const event of changedEvents) {
        const eventKey = String(event.id);
        const next = (calendarNumberDrafts[eventKey] ?? "").trim();
        const response = await fetch("/api/court-calendar/events", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: event.id,
            masterLawsuitId: event.masterLawsuitId,
            eventDate: event.eventDate,
            eventTime: event.eventTime,
            court: event.court || event.venue,
            venue: event.venue || event.court,
            eventType: event.eventType || event.status,
            status: event.status || event.eventType,
            appearanceType: event.appearanceType,
            indexAaaNumber: event.indexAaaNumber,
            calendarNumber: next,
          }),
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok || !json?.ok) {
          alert(json?.error || "Calendar Number save failed.");
          return;
        }
      }
      setResult((prev) => prev ? {
        ...prev,
        events: Array.isArray(prev.events) ? prev.events.map((row) => {
          const rowKey = String(row.id);
          if (!Object.prototype.hasOwnProperty.call(calendarNumberDrafts, rowKey)) return row;
          return { ...row, calendarNumber: (calendarNumberDrafts[rowKey] ?? "").trim() || null };
        }) : prev.events,
      } : prev);
      setCalendarNumberDrafts({});
    } catch (error: any) {
      alert(error?.message || "Calendar Number save failed.");
    } finally {
      setCalendarNumberSaving(false);
    }
  }

  function renderCalendarNumberCell(event: CalendarEvent) {
    const eventKey = String(event.id);
    const current = text(event.calendarNumber);
    const draft = Object.prototype.hasOwnProperty.call(calendarNumberDrafts, eventKey) ? calendarNumberDrafts[eventKey] : current;
    return (
      <td style={{ ...tdStyle, ...nowrapCellStyle }} data-barsh-court-calendar-calendar-number-cell="true">
        <input
          value={draft}
          onChange={(changeEvent) => setCalendarNumberDrafts((prev) => ({ ...prev, [eventKey]: changeEvent.target.value }))}
          placeholder="Cal. #"
          style={{ ...inputStyle, width: 76, height: 28, padding: "3px 6px", fontSize: 12, fontWeight: 850 }}
          data-barsh-court-calendar-calendar-number-input="true"
        />
      </td>
    );
  }

  function webCivilImportTemplateText() {
    const headers = ["Event ID", "Event Date", "Court", "Index Number", "Lawsuit Number", "Current Calendar Number", "Calendar Number"];
    const rows = events.map((event) => [
      text(event.id),
      dateOnly(event.eventDate),
      text(event.court || event.venue),
      text(event.indexAaaNumber),
      text(event.displayNumber || event.masterLawsuitId),
      text(event.calendarNumber),
      "",
    ]);
    return [headers, ...rows].map((row) => row.map((cell) => String(cell ?? "").replace(/[\t\r\n]+/g, " ").trim()).join("\t")).join("\n");
  }

  async function copyWebCivilImportTemplate() {
    const template = webCivilImportTemplateText();
    setWebCivilImportText(template);
    try {
      await navigator.clipboard.writeText(template);
      setWebCivilImportResult({ ok: true, previewOnly: true, parsedRowCount: events.length, importableRowCount: 0, skippedRowCount: 0, rows: [], safety: { clipboardOnly: true, clioRecordsChanged: false, externalWebCivilCalled: false } });
    } catch {
      setWebCivilImportResult({ ok: true, previewOnly: true, parsedRowCount: events.length, importableRowCount: 0, skippedRowCount: 0, rows: [], error: "Template filled below. Browser clipboard permission was not available.", safety: { clipboardOnly: true, clioRecordsChanged: false, externalWebCivilCalled: false } });
    }
  }

  async function submitWebCivilImport(previewOnly: boolean) {
    if (!webCivilImportText.trim()) {
      alert("Paste the WebCivil Local import rows first.");
      return;
    }

    setWebCivilImportLoading(true);
    setWebCivilImportResult(null);

    try {
      const response = await fetch("/api/court-calendar/import-webcivil-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pastedText: webCivilImportText,
          previewOnly,
          sourcePage: "court-calendar",
          sourceAction: previewOnly ? "preview-webcivil-local-calendar-number-import" : "apply-webcivil-local-calendar-number-import",
          actorName: "Barsh Matters User",
        }),
      });
      const json = await response.json().catch(() => ({}));
      setWebCivilImportResult(json);
      if (json?.ok && !json?.previewOnly) {
        const refreshedResponse = await fetch(`/api/court-calendar/events?${buildSearchParams().toString()}`, { cache: "no-store" });
        const refreshedJson = await refreshedResponse.json().catch(() => null);
        if (refreshedJson?.ok) setResult(refreshedJson);
      }
      if (!response.ok || !json?.ok) {
        alert(json?.error || "WebCivil Local import failed.");
        return;
      }
      if (!previewOnly) await searchEvents();
    } catch (error: any) {
      const fallback = { ok: false, error: error?.message || "WebCivil Local import failed." };
      setWebCivilImportResult(fallback);
      alert(fallback.error);
    } finally {
      setWebCivilImportLoading(false);
    }
  }

  return (
    <main style={pageStyle} data-barsh-court-calendar-page="true">
      <BarshHeader
        center={
          <div style={{ marginTop: 16 }}>
            <h1 style={{ margin: "4px 0 6px", fontSize: 30, lineHeight: 1.1 }}>Court Calendars</h1>
          </div>
        }
      />

      <section style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: "0 0 5px", fontSize: 20 }}>Filters</h2>
            <p style={{ margin: 0, color: "#64748b", fontWeight: 750 }}>
              
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => void searchEvents()} style={primaryButtonStyle} disabled={loading}>
              {loading ? "Searching..." : "Search Calendar"}
            </button>
            <button type="button" onClick={resetCourtCalendarFilters} style={{ ...secondaryButtonStyle, border: "1px solid #64748b", background: "#f8fafc", color: "#334155" }} data-barsh-court-calendar-reset-filters="true">Reset Filters</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "130px 130px minmax(210px, 1fr) 180px minmax(250px, 1.1fr) minmax(220px, 0.95fr) 190px", gap: 10, marginTop: 14 }} data-barsh-court-calendar-exact-filter-screen="true" onKeyDown={handleCalendarFilterKeyDown}>
          <label style={labelStyle}>
            Date From
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Date To
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Venue {filterOptionsLoading ? "· loading" : ""}
            <select value={venueFilter} onChange={(event) => setVenueFilter(event.target.value)} style={inputStyle} data-barsh-court-calendar-venue-filter="true">
              <option value="all">All</option>
              {venueOptions.map((venue) => <option key={venue} value={venue}>{venue}</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            Appearance Type
            <select value={appearanceTypeFilter} onChange={(event) => setAppearanceTypeFilter(event.target.value)} style={inputStyle} data-barsh-court-calendar-appearance-type-filter="true">
              {appearanceTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            Provider {filterOptionsLoading ? "· loading" : ""}
            <select value={clientNameFilter} onChange={(event) => setClientNameFilter(event.target.value)} style={inputStyle} data-barsh-court-calendar-provider-filter="true">
              <option value="all">All</option>
              {clientNameOptions.map((clientName) => <option key={clientName} value={clientName}>{clientName}</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            Search Text
            <input value={query} onChange={(event) => setQuery(event.target.value)} style={inputStyle} placeholder="Court, calendar, index, caption..." data-barsh-court-calendar-search-text-filter="true" />
          </label>
          <label style={{ ...labelStyle, justifyContent: "end" }}>
            Hide Closed Matters
            <span style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 38, fontWeight: 900, color: "#334155" }}>
              <input type="checkbox" checked={hideClosedMatters} onChange={(event) => setHideClosedMatters(event.target.checked)} data-barsh-court-calendar-hide-closed-matters-filter="true" />
              {hideClosedMatters ? "Yes" : "No"}
            </span>
          </label>
        </div>
      </section>

      {webCivilImportOpen && (
        <section style={{ ...cardStyle, marginBottom: 14 }} data-barsh-court-calendar-webcivil-local-import-panel="true">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: "0 0 6px", fontSize: 20 }}>Import Calendar Numbers from WebCivil Local</h2>
              <p style={{ margin: 0, color: "#64748b", fontWeight: 750, maxWidth: 980 }}>
                Copy the template from the currently loaded calendar results, look up the calendar numbers in WebCivil Local, paste the completed rows here, preview, then apply.
              </p>
            </div>
            <a href={WEB_CIVIL_LOCAL_CALENDAR_URL} target="_blank" rel="noreferrer" style={secondaryButtonStyle} data-barsh-court-calendar-webcivil-local-import-open-link="true">Open WebCivil Local</a>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button type="button" onClick={() => void copyWebCivilImportTemplate()} style={secondaryButtonStyle} disabled={!events.length} data-barsh-court-calendar-webcivil-local-copy-template="true">Copy Import Template</button>
            <button type="button" onClick={() => void submitWebCivilImport(true)} style={secondaryButtonStyle} disabled={webCivilImportLoading} data-barsh-court-calendar-webcivil-local-preview-import="true">Preview Import</button>
            <button type="button" onClick={() => void submitWebCivilImport(false)} style={primaryButtonStyle} disabled={webCivilImportLoading} data-barsh-court-calendar-webcivil-local-apply-import="true">{webCivilImportLoading ? "Importing..." : "Apply Import"}</button>
          </div>
          <label style={{ ...labelStyle, marginTop: 12 }}>
            Paste completed import rows
            <textarea value={webCivilImportText} onChange={(event) => setWebCivilImportText(event.target.value)} style={{ ...inputStyle, minHeight: 150, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12 }} placeholder={"Event ID\tEvent Date\tCourt\tIndex Number\tLawsuit Number\tCurrent Calendar Number\tCalendar Number"} data-barsh-court-calendar-webcivil-local-import-textarea="true" />
          </label>
          {webCivilImportResult && (
            <div style={{ marginTop: 12, border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }} data-barsh-court-calendar-webcivil-local-import-result="true">
              <div style={{ padding: 10, background: webCivilImportResult.ok ? "#f0fdf4" : "#fef2f2", color: webCivilImportResult.ok ? "#166534" : "#991b1b", fontWeight: 950 }}>
                {webCivilImportResult.ok ? `${webCivilImportResult.previewOnly ? "Preview ready" : "Import applied"} · ${webCivilImportResult.importableRowCount ?? 0} importable · ${webCivilImportResult.skippedRowCount ?? 0} skipped · ${webCivilImportResult.updatedCount ?? 0} updated` : webCivilImportResult.error || "Import failed."}
              </div>
              {!!webCivilImportResult.rows?.length && (
                <div style={{ maxHeight: 240, overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                    <thead><tr><th style={thStyle}>Row</th><th style={thStyle}>Status</th><th style={thStyle}>Event ID</th><th style={thStyle}>Current</th><th style={thStyle}>Imported</th><th style={thStyle}>Reason</th></tr></thead>
                    <tbody>
                      {webCivilImportResult.rows.map((row) => (
                        <tr key={`${row.rowNumber}-${row.eventId || "missing"}`}>
                          <td style={tdStyle}>{row.rowNumber}</td>
                          <td style={{ ...tdStyle, fontWeight: 950 }}>{row.status}</td>
                          <td style={tdStyle}>{row.eventId || "—"}</td>
                          <td style={tdStyle}>{text(row.currentCalendarNumber) || "—"}</td>
                          <td style={tdStyle}>{text(row.calendarNumber) || "—"}</td>
                          <td style={tdStyle}>{row.reason || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {createOpen && (
        <section style={{ ...cardStyle, marginBottom: 14 }} data-barsh-court-calendar-create-panel="true">
          <h2 style={{ margin: "0 0 10px", fontSize: 20 }}>Create Court Calendar Event</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(150px, 1fr))", gap: 10 }}>
            <label style={labelStyle}>Master Lawsuit<input value={form.masterLawsuitId} onChange={(event) => setForm((prev) => ({ ...prev, masterLawsuitId: event.target.value }))} style={inputStyle} /></label>
            <label style={labelStyle}>Event Type<select value={form.eventType} onChange={(event) => setForm((prev) => ({ ...prev, eventType: event.target.value }))} style={inputStyle}>{eventTypeOptions.filter(([value]) => value !== "all").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label style={labelStyle}>Event Date<input type="date" value={form.eventDate} onChange={(event) => setForm((prev) => ({ ...prev, eventDate: event.target.value }))} style={inputStyle} /></label>
            <label style={labelStyle}>Event Time<input type="time" value={form.eventTime} onChange={(event) => setForm((prev) => ({ ...prev, eventTime: event.target.value }))} style={inputStyle} /></label>
            <label style={labelStyle}>Title<input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} style={inputStyle} placeholder="Optional; auto-fills if blank" /></label>
            <label style={labelStyle}>Court<input value={form.court} onChange={(event) => setForm((prev) => ({ ...prev, court: event.target.value }))} style={inputStyle} /></label>
            <label style={labelStyle}>Part<input value={form.part} onChange={(event) => setForm((prev) => ({ ...prev, part: event.target.value }))} style={inputStyle} /></label>
            <label style={labelStyle}>Judge / Arbitrator<input value={form.judgeOrArbitrator} onChange={(event) => setForm((prev) => ({ ...prev, judgeOrArbitrator: event.target.value }))} style={inputStyle} /></label>
            <label style={labelStyle}>Index Number<input value={form.indexAaaNumber} onChange={(event) => setForm((prev) => ({ ...prev, indexAaaNumber: event.target.value }))} style={inputStyle} /></label>
            <label style={labelStyle}>Calendar Number
              <input value={form.calendarNumber} onChange={(event) => setForm((prev) => ({ ...prev, calendarNumber: event.target.value }))} style={inputStyle} />
              <span style={{ marginTop: 4, color: "#64748b", fontSize: 11, fontWeight: 800, lineHeight: 1.25 }} data-barsh-court-calendar-webcivil-local-helper="true">
                Confirm manually in WebCivil Local using court, date range, and index number.
                <a href={WEB_CIVIL_LOCAL_CALENDAR_URL} target="_blank" rel="noreferrer" style={{ color: "#1d4ed8", fontWeight: 950, marginLeft: 8 }}>Open WebCivil Local Court Calendars</a>
              </span>
            </label>
            <label style={labelStyle}>Appearance Type<input value={form.appearanceType} onChange={(event) => setForm((prev) => ({ ...prev, appearanceType: event.target.value }))} style={inputStyle} placeholder="In person, virtual, submission..." /></label>
            <label style={labelStyle}>Reminder Date<input type="date" value={form.reminderDate} onChange={(event) => setForm((prev) => ({ ...prev, reminderDate: event.target.value }))} style={inputStyle} /></label>
            <label style={{ ...labelStyle, alignContent: "end" }}>
              Reminder Tickler
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#0f172a" }}>
                <input type="checkbox" checked={form.createReminderTickler} onChange={(event) => setForm((prev) => ({ ...prev, createReminderTickler: event.target.checked }))} />
                Create if reminder date is set
              </span>
            </label>
          </div>
          <label style={{ ...labelStyle, marginTop: 10 }}>
            Notes
            <textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} style={{ ...inputStyle, minHeight: 78 }} />
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
            <button type="button" onClick={() => void createEvent()} style={primaryButtonStyle} disabled={createLoading}>
              {createLoading ? "Creating..." : "Create Calendar Event"}
            </button>
            {createResult && (
              <span style={{ color: createResult.ok ? "#166534" : "#991b1b", fontWeight: 900 }}>
                {createResult.ok ? "Created." : createResult.error || "Creation failed."}
              </span>
            )}
          </div>
        </section>
      )}

      <section style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>Calendar Results</h2>
            <p style={{ margin: "4px 0 0", color: "#64748b", fontWeight: 750 }}>
              {result?.ok ? `${events.length} event(s).` : "Run a search to load events."}
            </p>
          </div>
          <div style={{ display: "grid", gap: 8, justifyItems: "end" }} data-barsh-court-calendar-report-controls="true">
            <label style={{ ...labelStyle, minWidth: 260 }}>
              Report Type
              <select value={reportType} onChange={(event) => setReportType(event.target.value)} style={inputStyle} data-barsh-court-calendar-report-type-selector="true">
                <option value="all">All</option>
                <option value="trial-calendar">Trial Calendar Report</option>
                <option value="appearance-calendar">Appearance Calendar Report</option>
              </select>
            </label>
          </div>
        </div>

        <div style={{ overflowX: "auto", width: "100%" }} data-barsh-court-calendar-results-scroll="true">
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1260, tableLayout: "fixed" }} data-barsh-court-calendar-results-fit-columns="true" data-barsh-court-calendar-results-table="true">
            <colgroup>
              {resultColumnWidths.map((width, index) => <col key={index} style={{ width }} />)}
            </colgroup>
            <thead>
              <tr>
                <th style={thStyle}>{sortableCalendarHeader("Date", "eventDate")}</th>
                <th style={thStyle}>{sortableCalendarHeader("Court", "court")}</th>
                <th style={thStyle}>{sortableCalendarHeader("Calendar Number", "calendarNumber")}</th>
                <th style={thStyle}>{sortableCalendarHeader("Index Number", "indexNumber")}</th>
                <th style={thStyle}>{sortableCalendarHeader("Lawsuit Number", "lawsuitNumber")}</th>
                <th style={thStyle}>{sortableCalendarHeader("Appearance Type", "appearanceType")}</th>
                <th style={thStyle}>{sortableCalendarHeader("Lawsuit Amount", "lawsuitAmount")}</th>
                <th style={thStyle}>{sortableCalendarHeader("Lawsuit Balance", "lawsuitBalance")}</th>
                <th style={thStyle} data-barsh-court-calendar-results-adversary-attorney-column="true">Adversary Attorney</th>
                <th style={thStyle} data-barsh-court-calendar-results-caption-column="true">{sortableCalendarHeader("Caption", "caption")}</th>
              </tr>
            </thead>
            <tbody>
              {!events.length ? (
                <tr>
                  <td style={tdStyle} colSpan={10}>{loading ? "Loading..." : "No court calendar events found."}</td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} data-barsh-court-calendar-result-row="true" style={{ verticalAlign: "top" }}>
                    <td style={{ ...tdStyle, ...nowrapCellStyle, fontWeight: 950 }}>{dateOnly(event.eventDate)}</td>
                    <td style={{ ...tdStyle, ...wrapCellStyle }}>{text(event.court || event.venue) || "—"}</td>
                    {renderCalendarNumberCell(event)}
                    <td style={{ ...tdStyle, ...compactIdCellStyle }} title={text(event.indexAaaNumber)}>{text(event.indexAaaNumber) || "—"}</td>
                    <td style={{ ...tdStyle, ...compactIdCellStyle }} title={text(event.displayNumber || event.masterLawsuitId)}>
                      <a href={`/matters?master=${encodeURIComponent(text(event.displayNumber || event.masterLawsuitId))}`} style={{ color: "#1d4ed8", fontWeight: 900, textDecoration: "underline", display: "inline-block", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", verticalAlign: "top" }}>
                        {text(event.displayNumber || event.masterLawsuitId) || "—"}
                      </a>
                    </td>
                    <td style={{ ...tdStyle, ...wrapCellStyle }}>{text(event.appearanceType) || "—"}</td>
                    <td style={{ ...tdStyle, ...moneyCellStyle }}>{money(event.caseData?.lawsuitAmount)}</td>
                    <td style={{ ...tdStyle, ...moneyCellStyle }}>{money(event.caseData?.lawsuitBalance)}</td>
                    <td style={{ ...tdStyle, ...wrapCellStyle, paddingTop: 6, paddingBottom: 6, lineHeight: 1.15 }} title={text(event.caseData?.adversaryAttorney)}>{text(event.caseData?.adversaryAttorney) || "—"}</td>
                    <td style={{ ...tdStyle, ...wrapCellStyle, paddingTop: 6, paddingBottom: 6, lineHeight: 1.15 }} title={text(event.caseData?.caption)} data-barsh-court-calendar-results-caption-cell="true">{text(event.caseData?.caption) || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", marginTop: 14 }} data-barsh-court-calendar-result-bottom-actions="true">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-start" }} data-barsh-court-calendar-left-actions="true">
            <button type="button" onClick={printCourtAppearanceReport} style={{ ...secondaryButtonStyle, border: "1px solid #ea580c", background: events.length === 0 ? "#fed7aa" : "#ea580c", color: "#ffffff" }} disabled={events.length === 0} data-barsh-court-calendar-print-appearance-report="true">Print Court Appearance Report</button>
            <button type="button" onClick={() => setWebCivilImportOpen((open) => !open)} style={{ ...secondaryButtonStyle, border: "1px solid #1e3a8a", background: "#eff6ff", color: "#1e3a8a" }} data-barsh-court-calendar-webcivil-local-import-toggle="true">Import Calendar Numbers from WebCivil Local</button>
            {hasCalendarNumberChanges() && (
              <button type="button" onClick={() => void saveCalendarNumbers()} disabled={calendarNumberSaving} style={{ ...secondaryButtonStyle, border: "1px solid #15803d", background: calendarNumberSaving ? "#bbf7d0" : "#15803d", color: "#ffffff" }} data-barsh-court-calendar-calendar-number-save-all="true">{calendarNumberSaving ? "Saving..." : "Save Calendar Numbers"}</button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }} data-barsh-court-calendar-right-actions="true">
            <button type="button" onClick={() => printCalendarReport("all")} style={{ ...secondaryButtonStyle, border: "1px solid #1e3a8a", background: events.length === 0 ? "#bfdbfe" : "#1e3a8a", color: "#ffffff" }} disabled={events.length === 0} data-barsh-court-calendar-print-filtered-results="true">Print / Save PDF</button>
            <button type="button" onClick={() => exportCalendarReport("all")} style={{ ...secondaryButtonStyle, border: "1px solid #1e3a8a", background: !events.length ? "#bfdbfe" : "#1e3a8a", color: "#ffffff" }} disabled={!events.length} data-barsh-court-calendar-export-xlsx="true">Export XLSX</button>
          </div>
        </div>
      </section>
    </main>
  );
}
