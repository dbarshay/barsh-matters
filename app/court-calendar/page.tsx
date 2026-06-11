"use client";

import BarshHeaderActions from "@/app/components/BarshHeaderActions";
import BarshHeaderQuickNav from "@/app/components/BarshHeaderQuickNav";
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

const appearanceTypeOptions = [["all", "All"], ["Trial", "Trial"], ["Conference", "Conference"], ["Motion", "Motion"]];

type FilterOptionsResult = { ok?: boolean; appearanceTypes?: string[]; venues?: string[]; clientNames?: string[]; error?: string; };

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
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || Math.abs(amount) < 0.005) return "—";
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function safeExportCell(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => text(item)).filter(Boolean).join("; ");
  return text(value);
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
  width: "100vw",
  maxWidth: "none",
  marginLeft: "calc(50% - 50vw)",
  marginRight: "calc(50% - 50vw)",
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

export default function CourtCalendarPage() {
  const [masterLawsuitId, setMasterLawsuitId] = useState("");
  const [eventType, setEventType] = useState("all");
  const [status, setStatus] = useState("scheduled");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appearanceTypeFilter, setAppearanceTypeFilter] = useState("all");
  const [venueFilter, setVenueFilter] = useState("all");
  const [clientNameFilter, setClientNameFilter] = useState("all");
  const [filterOptions, setFilterOptions] = useState<FilterOptionsResult | null>(null);
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createResult, setCreateResult] = useState<any>(null);
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

  const events = useMemo(() => Array.isArray(result?.events) ? result.events : [], [result]);

  useEffect(() => { async function loadFilterOptions() { setFilterOptionsLoading(true); try { const response = await fetch("/api/court-calendar/filter-options", { cache: "no-store" }); const json = await response.json().catch(() => ({})); setFilterOptions(json); } catch (error: any) { setFilterOptions({ ok: false, error: error?.message || "Could not load filter options." }); } finally { setFilterOptionsLoading(false); } } void loadFilterOptions(); }, []);

  const venueOptions = useMemo(() => Array.isArray(filterOptions?.venues) ? filterOptions.venues : [], [filterOptions]);
  const clientNameOptions = useMemo(() => Array.isArray(filterOptions?.clientNames) ? filterOptions.clientNames : [], [filterOptions]);

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

  function exportCalendarReport() {
    const headers = [
      "Event Date",
      "Event Time",
      "Type",
      "Status",
      "Master Lawsuit",
      "Index / AAA",
      "Court",
      "Part",
      "Judge / Arbitrator",
      "Appearance Type",
      "Title",
      "Reminder Date",
      "Child Matter Count",
      "Patients",
      "Providers",
      "Insurers",
      "Claim Numbers",
      "Notes",
    ];

    const rows = events.map((event) => [
      safeExportCell(event.eventDate),
      safeExportCell(event.eventTime),
      labelFromCode(event.eventType),
      labelFromCode(event.status),
      safeExportCell(event.masterLawsuitId),
      safeExportCell(event.indexAaaNumber),
      safeExportCell(event.court || event.venue),
      safeExportCell(event.part),
      safeExportCell(event.judgeOrArbitrator),
      safeExportCell(event.appearanceType),
      safeExportCell(event.title),
      safeExportCell(event.reminderDate),
      safeExportCell(event.caseData?.childCount),
      safeExportCell(event.caseData?.patients),
      safeExportCell(event.caseData?.providers),
      safeExportCell(event.caseData?.insurers),
      safeExportCell(event.caseData?.claimNumbers),
      safeExportCell(event.notes),
    ]);

    downloadWorkbookRows(headers, rows, `barsh-matters-court-calendar-${timestampForFilename()}.xlsx`, "Court Calendar");
  }

  return (
    <main style={pageStyle} data-barsh-court-calendar-page="true">
      <div style={headerRowStyle}>
        <div style={headerLeftStyle}>
          <div style={quickNavWrapStyle}>
            <BarshHeaderQuickNav />
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ color: "#64748b", fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 12 }}>
              Barsh Matters
            </div>
            <h1 style={{ margin: "4px 0 6px", fontSize: 30, lineHeight: 1.1 }}>Court Calendar</h1>
            <p style={{ margin: 0, color: "#475569", fontWeight: 750 }}>
              
            </p>
          </div>
        </div>
        <BarshHeaderActions />
      </div>

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
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "140px 140px minmax(220px, 1fr) 190px minmax(260px, 1.15fr) minmax(220px, 0.95fr)", gap: 10, marginTop: 14 }} data-barsh-court-calendar-exact-filter-screen="true" onKeyDown={handleCalendarFilterKeyDown}>
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
            <input value={query} onChange={(event) => setQuery(event.target.value)} style={inputStyle} placeholder="Court, part, judge, notes..." data-barsh-court-calendar-search-text-filter="true" />
          </label>
        </div>
      </section>

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
            <label style={labelStyle}>Calendar Number<input value={form.calendarNumber} onChange={(event) => setForm((prev) => ({ ...prev, calendarNumber: event.target.value }))} style={inputStyle} /></label>
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
          <Link href="/matters" style={secondaryButtonStyle}>Open Matters</Link>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1400 }}>
            <thead>
              <tr>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Court</th>
                <th style={thStyle}>Calendar Number</th>
                <th style={thStyle}>Index Number</th>
                <th style={thStyle}>Lawsuit Number</th>
                <th style={thStyle}>Appearance Type</th>
                <th style={thStyle}>Lawsuit Amount</th>
                <th style={thStyle}>Lawsuit Balance</th>
                <th style={thStyle}>Caption</th>
              </tr>
            </thead>
            <tbody>
              {!events.length ? (
                <tr>
                  <td style={tdStyle} colSpan={9}>{loading ? "Loading..." : "No court calendar events found."}</td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} data-barsh-court-calendar-result-row="true">
                    <td style={{ ...tdStyle, fontWeight: 950 }}>{dateOnly(event.eventDate)}</td>
                    <td style={tdStyle}>{text(event.court || event.venue) || "—"}</td>
                    <td style={tdStyle}>{text(event.calendarNumber) || "—"}</td>
                    <td style={tdStyle}>{text(event.indexAaaNumber) || "—"}</td>
                    <td style={tdStyle}>
                      <a href={`/matters?master=${encodeURIComponent(text(event.displayNumber || event.masterLawsuitId))}`} style={{ color: "#1d4ed8", fontWeight: 900, textDecoration: "underline" }}>
                        {text(event.displayNumber || event.masterLawsuitId) || "—"}
                      </a>
                    </td>
                    <td style={tdStyle}>{text(event.appearanceType) || "—"}</td>
                    <td style={tdStyle}>{money(event.caseData?.lawsuitAmount)}</td>
                    <td style={tdStyle}>{money(event.caseData?.lawsuitBalance)}</td>
                    <td style={{ ...tdStyle, minWidth: 320 }}>{text(event.caseData?.caption) || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
