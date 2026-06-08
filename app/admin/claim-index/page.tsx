"use client";

import BarshHeaderActions from "@/app/components/BarshHeaderActions";
import BarshHeaderQuickNav from "@/app/components/BarshHeaderQuickNav";

import React, { useEffect, useMemo, useState } from "react";

type SortDirection = "asc" | "desc";

type ClaimIndexAdminRow = {
  matter_id: number;
  display_number?: string | null;
  description?: string | null;
  claim_number_raw?: string | null;
  claim_number_normalized?: string | null;
  patient_name?: string | null;
  client_name?: string | null;
  insurer_name?: string | null;
  provider_name?: string | null;
  treating_provider?: string | null;
  claim_amount?: number | null;
  payment_amount?: number | null;
  balance_amount?: number | null;
  bill_number?: string | null;
  dos_start?: string | null;
  dos_end?: string | null;
  denial_reason?: string | null;
  service_type?: string | null;
  policy_number?: string | null;
  date_of_loss?: string | null;
  master_lawsuit_id?: string | null;
  status?: string | null;
  close_reason?: string | null;
  final_status?: string | null;
  matter_stage_name?: string | null;
  index_aaa_number?: string | null;
  indexed_at?: string | null;
};

type SearchResult = {
  ok?: boolean;
  rows?: ClaimIndexAdminRow[];
  total?: number;
  returned?: number;
  limit?: number;
  sort?: string;
  direction?: SortDirection;
  sourceOfTruth?: string;
  readOnly?: boolean;
  safety?: string;
  error?: string;
};

type FilterState = {
  q: string;
  displayNumber: string;
  matterId: string;
  patient: string;
  provider: string;
  insurer: string;
  claimNumber: string;
  status: string;
  finalStatus: string;
  closedReason: string;
  masterLawsuitId: string;
};

const emptyFilters: FilterState = {
  q: "",
  displayNumber: "",
  matterId: "",
  patient: "",
  provider: "",
  insurer: "",
  claimNumber: "",
  status: "",
  finalStatus: "",
  closedReason: "",
  masterLawsuitId: "",
};

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f8fafc",
  color: "#0f172a",
  padding: "28px 30px 46px",
  boxSizing: "border-box",
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 22,
  padding: 18,
  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.07)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 14,
  background: "#fff",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  fontWeight: 900,
  color: "#334155",
};

const buttonStyle: React.CSSProperties = {
  border: "1px solid #4f46e5",
  background: "#4f46e5",
  color: "#fff",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 950,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#334155",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #cbd5e1",
  padding: "10px 8px",
  fontSize: 12,
  color: "#334155",
  background: "#f8fafc",
  position: "sticky",
  top: 0,
  whiteSpace: "nowrap",
  zIndex: 1,
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  padding: "9px 8px",
  verticalAlign: "top",
  fontSize: 13,
};

const sortableColumns = [
  ["Matter ID", "matter_id"],
  ["BRL / Display #", "display_number"],
  ["Patient", "patient_name"],
  ["Provider", "provider_name"],
  ["Insurer", "insurer_name"],
  ["Claim #", "claim_number_raw"],
  ["Status", "status"],
  ["Final Status", "final_status"],
  ["Closed Reason", "close_reason"],
  ["Master Lawsuit", "master_lawsuit_id"],
  ["Indexed", "indexed_at"],
] as const;

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function money(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function dateText(value: unknown): string {
  const text = clean(value);
  if (!text) return "";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleString();
}

function filtersFromUrl(): FilterState {
  if (typeof window === "undefined") return emptyFilters;
  const params = new URLSearchParams(window.location.search);
  return {
    q: params.get("q") || "",
    displayNumber: params.get("displayNumber") || "",
    matterId: params.get("matterId") || "",
    patient: params.get("patient") || "",
    provider: params.get("provider") || "",
    insurer: params.get("insurer") || "",
    claimNumber: params.get("claimNumber") || "",
    status: params.get("status") || "",
    finalStatus: params.get("finalStatus") || "",
    closedReason: params.get("closedReason") || "",
    masterLawsuitId: params.get("masterLawsuitId") || "",
  };
}

function sortFromUrl(): { sort: string; direction: SortDirection } {
  if (typeof window === "undefined") return { sort: "display_number", direction: "asc" };
  const params = new URLSearchParams(window.location.search);
  return {
    sort: params.get("sort") || "display_number",
    direction: params.get("direction") === "desc" ? "desc" : "asc",
  };
}

function paramsForState(filters: FilterState, sort: string, direction: SortDirection): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    const text = clean(value);
    if (text) params.set(key, text);
  }
  if (sort) params.set("sort", sort);
  if (direction) params.set("direction", direction);
  params.set("limit", "500");
  return params;
}

function csvCell(value: unknown): string {
  const text = clean(value).replace(/\r?\n/g, " ");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportRowsToCsv(rows: ClaimIndexAdminRow[]) {
  const headers = [
    "Matter ID",
    "Display Number",
    "Patient",
    "Provider",
    "Treating Provider",
    "Insurer",
    "Claim Number",
    "Claim Number Normalized",
    "Claim Amount",
    "Payment Amount",
    "Balance Amount",
    "Status",
    "Final Status",
    "Closed Reason",
    "Matter Stage",
    "Master Lawsuit ID",
    "Bill Number",
    "DOS Start",
    "DOS End",
    "Denial Reason",
    "Service Type",
    "Policy Number",
    "Date of Loss",
    "Index/AAA Number",
    "Indexed At",
    "Description",
  ];

  const body = rows.map((row) => [
    row.matter_id,
    row.display_number,
    row.patient_name,
    row.provider_name,
    row.treating_provider,
    row.insurer_name,
    row.claim_number_raw,
    row.claim_number_normalized,
    row.claim_amount,
    row.payment_amount,
    row.balance_amount,
    row.status,
    row.final_status,
    row.close_reason,
    row.matter_stage_name,
    row.master_lawsuit_id,
    row.bill_number,
    row.dos_start,
    row.dos_end,
    row.denial_reason,
    row.service_type,
    row.policy_number,
    row.date_of_loss,
    row.index_aaa_number,
    row.indexed_at,
    row.description,
  ]);

  const csv = [headers, ...body].map((line) => line.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `barsh-matters-admin-claim-index-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function AdminClaimIndexPage() {
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [sort, setSort] = useState("display_number");
  const [direction, setDirection] = useState<SortDirection>("asc");
  const [rows, setRows] = useState<ClaimIndexAdminRow[]>([]);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Loading ClaimIndex rows...");

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((value) => clean(value)).length,
    [filters]
  );

  async function loadClaimIndex(nextFilters = filters, nextSort = sort, nextDirection = direction, pushUrl = true) {
    const params = paramsForState(nextFilters, nextSort, nextDirection);
    const nextUrl = params.toString() ? `/admin/claim-index?${params.toString()}` : "/admin/claim-index";

    if (pushUrl && typeof window !== "undefined") {
      window.history.pushState({ barshMattersAdminClaimIndex: true }, "", nextUrl);
    }

    setBusy(true);
    setMessage("Searching local ClaimIndex...");
    try {
      const response = await fetch(`/api/admin/claim-index/search?${params.toString()}`, { cache: "no-store" });
      const data: SearchResult = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Admin ClaimIndex search failed.");
      }
      setRows(data.rows || []);
      setResult(data);
      setMessage(`Showing ${data.returned ?? 0} of ${data.total ?? 0} matching ClaimIndex row(s).`);
    } catch (err: any) {
      setRows([]);
      setResult(null);
      setMessage(err?.message || "Admin ClaimIndex search failed.");
    } finally {
      setBusy(false);
    }
  }

  function setFilter(name: keyof FilterState, value: string) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function submitSearch(event?: React.FormEvent) {
    event?.preventDefault();
    void loadClaimIndex(filters, sort, direction, true);
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setSort("display_number");
    setDirection("asc");
    void loadClaimIndex(emptyFilters, "display_number", "asc", true);
  }

  function changeSort(nextSort: string) {
    const nextDirection: SortDirection = nextSort === sort && direction === "asc" ? "desc" : "asc";
    setSort(nextSort);
    setDirection(nextDirection);
    void loadClaimIndex(filters, nextSort, nextDirection, true);
  }

  function sortLabel(column: string): string {
    if (sort !== column) return "";
    return direction === "asc" ? " ▲" : " ▼";
  }

  useEffect(() => {
    const initialFilters = filtersFromUrl();
    const initialSort = sortFromUrl();
    setFilters(initialFilters);
    setSort(initialSort.sort);
    setDirection(initialSort.direction);
    void loadClaimIndex(initialFilters, initialSort.sort, initialSort.direction, false);

    const onPopState = () => {
      const nextFilters = filtersFromUrl();
      const nextSort = sortFromUrl();
      setFilters(nextFilters);
      setSort(nextSort.sort);
      setDirection(nextSort.direction);
      void loadClaimIndex(nextFilters, nextSort.sort, nextSort.direction, false);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main
      data-barsh-admin-claim-index-viewer="true"
      data-claim-index-read-only="true"
      data-restore-execution-enabled="false"
      data-clio-operations-enabled="false"
      style={pageStyle}
    >
      <div style={{ maxWidth: 1480, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <BarshHeaderQuickNav />
          <BarshHeaderActions />
        </section>

        <header style={{ ...cardStyle, display: "grid", gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 950, color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Administrator
          </div>
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1 }}>ClaimIndex Viewer</h1>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.45, maxWidth: 980 }}>
            Read-only audit view of the local Barsh Matters ClaimIndex table.  This page searches ClaimIndex only and does not edit matters, restore data, call Clio, generate documents, send email, print, queue, or write to the database.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", color: "#334155", fontWeight: 900 }}>
            <span>Source: {result?.sourceOfTruth || "ClaimIndex/local Barsh Matters"}</span>
            <span>Read-only: {result?.readOnly === false ? "NO" : "YES"}</span>
            <span>Limit: {result?.limit ?? 500}</span>
          </div>
        </header>

        <section style={{ border: "1px solid #dbeafe", background: "#eff6ff", color: "#1e3a8a", borderRadius: 18, padding: 16, lineHeight: 1.45 }}>
          <strong>Safety:</strong> Display and CSV export are client-side/read-only.  No confirm buttons, restore actions, Clio writebacks, matter edits, document generation, print queue writes, or database writes are exposed here.
        </section>

        <form onSubmit={submitSearch} style={{ ...cardStyle, display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>Search / Filter</h2>
              <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                {activeFilterCount} active filter(s). Results are capped at 500 rows.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="submit" disabled={busy} style={{ ...buttonStyle, opacity: busy ? 0.65 : 1 }}>
                {busy ? "Searching..." : "Search"}
              </button>
              <button type="button" onClick={clearFilters} disabled={busy} style={secondaryButtonStyle}>
                Clear
              </button>
              <button type="button" onClick={() => exportRowsToCsv(rows)} disabled={!rows.length} style={{ ...secondaryButtonStyle, opacity: rows.length ? 1 : 0.55 }}>
                Export CSV
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
            <label style={labelStyle}>
              General Search
              <input value={filters.q} onChange={(event) => setFilter("q", event.target.value)} style={inputStyle} placeholder="BRL, matter ID, patient, provider, claim..." />
            </label>
            <label style={labelStyle}>
              BRL / Display #
              <input value={filters.displayNumber} onChange={(event) => setFilter("displayNumber", event.target.value)} style={inputStyle} placeholder="BRL30121" />
            </label>
            <label style={labelStyle}>
              Matter ID
              <input value={filters.matterId} onChange={(event) => setFilter("matterId", event.target.value)} style={inputStyle} placeholder="1876895480" />
            </label>
            <label style={labelStyle}>
              Patient
              <input value={filters.patient} onChange={(event) => setFilter("patient", event.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Provider / Client
              <input value={filters.provider} onChange={(event) => setFilter("provider", event.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Insurer
              <input value={filters.insurer} onChange={(event) => setFilter("insurer", event.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Claim Number
              <input value={filters.claimNumber} onChange={(event) => setFilter("claimNumber", event.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Status
              <input value={filters.status} onChange={(event) => setFilter("status", event.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Final Status
              <input value={filters.finalStatus} onChange={(event) => setFilter("finalStatus", event.target.value)} style={inputStyle} placeholder="Open / Closed" />
            </label>
            <label style={labelStyle}>
              Closed Reason
              <input value={filters.closedReason} onChange={(event) => setFilter("closedReason", event.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Master Lawsuit ID
              <input value={filters.masterLawsuitId} onChange={(event) => setFilter("masterLawsuitId", event.target.value)} style={inputStyle} placeholder="2026.05.00001" />
            </label>
          </div>
        </form>

        <section style={{ ...cardStyle, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>Results</h2>
              <div style={{ color: "#64748b", marginTop: 4 }}>{message}</div>
            </div>
              <a href="/admin/claim-index/audit" style={secondaryButtonStyle}>
                Data-Quality Audit
              </a>
            <a href="/admin" style={{ color: "#334155", fontWeight: 900, textDecoration: "none" }}>
              ← Back to Admin Home
            </a>
          </div>

          <div style={{ overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 16, maxHeight: "68vh" }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", minWidth: 1600 }}>
              <thead>
                <tr>
                  {sortableColumns.map(([label, column]) => (
                    <th key={column} style={thStyle}>
                      <button
                        type="button"
                        onClick={() => changeSort(column)}
                        style={{ border: 0, background: "transparent", padding: 0, margin: 0, font: "inherit", fontWeight: 950, color: "#334155", cursor: "pointer" }}
                      >
                        {label}{sortLabel(column)}
                      </button>
                    </th>
                  ))}
                  <th style={thStyle}>Claim Amount</th>
                  <th style={thStyle}>Payment</th>
                  <th style={thStyle}>Balance</th>
                  <th style={thStyle}>DOS</th>
                  <th style={thStyle}>Denial Reason</th>
                  <th style={thStyle}>Service Type</th>
                  <th style={thStyle}>Description</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((row) => (
                  <tr key={row.matter_id}>
                    <td style={tdStyle}>{row.matter_id}</td>
                    <td style={tdStyle}>{row.display_number || ""}</td>
                    <td style={tdStyle}>{row.patient_name || ""}</td>
                    <td style={tdStyle}>
                      <div>{row.provider_name || row.client_name || ""}</div>
                      {row.treating_provider ? <div style={{ color: "#64748b", fontSize: 12 }}>Treating: {row.treating_provider}</div> : null}
                    </td>
                    <td style={tdStyle}>{row.insurer_name || ""}</td>
                    <td style={tdStyle}>
                      <div>{row.claim_number_raw || ""}</div>
                      {row.claim_number_normalized && row.claim_number_normalized !== row.claim_number_raw ? (
                        <div style={{ color: "#64748b", fontSize: 12 }}>{row.claim_number_normalized}</div>
                      ) : null}
                    </td>
                    <td style={tdStyle}>{row.status || ""}</td>
                    <td style={tdStyle}>{row.final_status || row.matter_stage_name || ""}</td>
                    <td style={tdStyle}>{row.close_reason || ""}</td>
                    <td style={tdStyle}>{row.master_lawsuit_id || ""}</td>
                    <td style={tdStyle}>{dateText(row.indexed_at)}</td>
                    <td style={tdStyle}>{money(row.claim_amount)}</td>
                    <td style={tdStyle}>{money(row.payment_amount)}</td>
                    <td style={tdStyle}>{money(row.balance_amount)}</td>
                    <td style={tdStyle}>{[row.dos_start, row.dos_end].filter(Boolean).join(" – ")}</td>
                    <td style={tdStyle}>{row.denial_reason || ""}</td>
                    <td style={tdStyle}>{row.service_type || ""}</td>
                    <td style={{ ...tdStyle, minWidth: 260 }}>{row.description || ""}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={18} style={{ ...tdStyle, color: "#64748b", padding: 18 }}>
                      No ClaimIndex rows matched the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.45 }}>
            API safety message: {result?.safety || "Read-only ClaimIndex viewer. No write actions are available."}
          </div>
        </section>
      </div>
    </main>
  );
}
