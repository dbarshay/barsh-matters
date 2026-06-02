"use client";

import React, { useEffect, useMemo, useState } from "react";
import BarshHeaderQuickNav from "@/app/components/BarshHeaderQuickNav";
import * as XLSX from "xlsx";

type Matter = any;
type ClaimGroup = any;

function matterId(m: Matter) {
  return String(m.matterId ?? m.matter_id ?? m.id ?? "");
}

function displayNumber(m: Matter) {
  return m.displayNumber ?? m.display_number ?? m.matterNumber ?? m.matter_number ?? matterId(m);
}

function val(m: Matter, ...keys: string[]) {
  for (const k of keys) {
    if (m?.[k] !== undefined && m?.[k] !== null && m?.[k] !== "") return m[k];
  }
  return "";
}

function raw(m: Matter) {
  const r = m?.raw_json ?? m?.rawJson;
  if (!r) return null;
  if (typeof r === "object") return r;
  if (typeof r === "string") {
    try {
      return JSON.parse(r);
    } catch {
      return null;
    }
  }
  return null;
}

function insurerName(m: Matter) {
  const r = raw(m);

  return (
    val(
      m,
      "insurerName",
      "insurer_name",
      "insuranceCompanyName",
      "insurance_company_name",
      "insuranceCompany",
      "insurance_company"
    ) ||
    m?.insurance_company?.name ||
    m?.insuranceCompany?.name ||
    m?.insurer?.name ||
    r?.insurance_company?.name ||
    r?.insuranceCompany?.name ||
    r?.insurer?.name ||
    r?.custom_field_values?.find?.((cf: any) =>
      String(cf?.custom_field?.name ?? cf?.name ?? "")
        .toLowerCase()
        .includes("insurance")
    )?.value ||
    ""
  );
}

function moneyValue(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function money(v: unknown) {
  return moneyValue(v).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function getRows(g: ClaimGroup): Matter[] {
  return g.matters ?? g.rows ?? g.items ?? [];
}

function getClaimNumber(g: ClaimGroup) {
  return g.claimNumber ?? g.claim_number ?? g.claimNumberNormalized ?? g.claim_number_normalized ?? "(no claim number)";
}

function timestampForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function safeExportCell(value: unknown): string {
  return String(value ?? "").trim();
}

const standardCaseExportHeaders = [
  "Due",
  "Type",
  "Created",
  "Updated",
  "Matter",
  "Master Lawsuit",
  "Provider",
  "Patient",
  "Insurer",
  "Claim Number",
  "Date of Loss",
  "Court",
  "Index Number",
  "Date Filed",
  "Settled Date",
  "Settled With",
  "Denial Reason",
  "Status",
  "Closed Reason",
  "Closed Date",
];

function downloadWorkbookRows(headers: string[], rows: unknown[][], filename: string, sheetName: string) {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

function pickAny(source: any, keys: string[]): string {
  for (const key of keys) {
    const value = source?.[key];
    const cleaned = safeExportCell(value);
    if (cleaned) return cleaned;
  }
  return "";
}

function pickMeta(source: any, keys: string[]): string {
  const metadata = source?.metadata && typeof source.metadata === "object" ? source.metadata : {};
  for (const key of keys) {
    const value = metadata?.[key];
    const cleaned = safeExportCell(value);
    if (cleaned) return cleaned;
  }
  return "";
}

function masterId(m: Matter) {
  return val(m, "masterLawsuitId", "master_lawsuit_id") || "";
}

export default function LawsuitsPage() {
  const [claim, setClaim] = useState("");
  const [patient, setPatient] = useState("");
  const [provider, setProvider] = useState("");
  const [insurer, setInsurer] = useState("");
  const [providerReferenceOptions, setProviderReferenceOptions] = useState<any[]>([]);
  const [insurerReferenceOptions, setInsurerReferenceOptions] = useState<any[]>([]);
  const [referenceOptionsLoading, setReferenceOptionsLoading] = useState(false);

  const [groups, setGroups] = useState<ClaimGroup[]>([]);
  const [selected, setSelected] = useState<Record<string, Matter>>({});
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  const [searched, setSearched] = useState(false);

  const selectedMatters = useMemo(() => Object.values(selected), [selected]);

  const selectedTotal = selectedMatters.reduce(
    (sum, m) => sum + moneyValue(val(m, "claimAmount", "claim_amount")),
    0
  );

  useEffect(() => {
    let cancelled = false;

    async function loadReferenceOptions() {
      setReferenceOptionsLoading(true);
      try {
        const [providerResponse, insurerResponse] = await Promise.all([
          fetch("/api/reference-data/options?type=provider_client", { cache: "no-store" }),
          fetch("/api/reference-data/options?type=insurer_company", { cache: "no-store" }),
        ]);

        const [providerJson, insurerJson] = await Promise.all([
          providerResponse.ok ? providerResponse.json() : Promise.resolve({ options: [] }),
          insurerResponse.ok ? insurerResponse.json() : Promise.resolve({ options: [] }),
        ]);

        if (cancelled) return;

        setProviderReferenceOptions(Array.isArray(providerJson?.options) ? providerJson.options : []);
        setInsurerReferenceOptions(Array.isArray(insurerJson?.options) ? insurerJson.options : []);
      } catch {
        if (!cancelled) {
          setProviderReferenceOptions([]);
          setInsurerReferenceOptions([]);
        }
      } finally {
        if (!cancelled) setReferenceOptionsLoading(false);
      }
    }

    loadReferenceOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  async function search() {
    setLoading(true);
    setError("");
    setResult(null);
    setSearched(true);
    setSelected({});

    try {
      const params = new URLSearchParams();
      if (claim.trim()) params.set("claim", claim.trim());
      if (patient.trim()) params.set("patient", patient.trim());
      if (provider.trim()) params.set("provider", provider.trim());
      if (insurer.trim()) params.set("insurer", insurer.trim());

      if (!params.toString()) {
        throw new Error("Enter at least one search parameter.");
      }

      const res = await fetch(`/api/claim-index/search-grouped?${params.toString()}`, {
        cache: "no-store",
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Search failed.");

      const nextGroups = json.groups ?? json.claims ?? json.results ?? json.data ?? [];
      setGroups(Array.isArray(nextGroups) ? nextGroups : []);
      setSelected({});
    } catch (e: any) {
      setError(e?.message || "Search failed.");
      setGroups([]);
      setSelected({});
    } finally {
      setLoading(false);
    }
  }

  function exportSearchResultsXlsx() {
    const rows = groups.flatMap((group) =>
      getRows(group).map((matter) => [
        "",
        "",
        pickAny(matter, ["createdAt", "created_at", "openedAt", "opened_at"]),
        pickAny(matter, ["updatedAt", "updated_at", "indexed_at"]),
        displayNumber(matter),
        safeExportCell(masterId(matter)),
        safeExportCell(val(matter, "client_name", "clientName", "provider_name", "providerName")),
        safeExportCell(val(matter, "patientName", "patient_name")),
        safeExportCell(insurerName(matter)),
        safeExportCell(getClaimNumber(group)),
        pickAny(matter, ["dateOfLoss", "date_of_loss"]),
        pickAny(matter, ["court", "courtVenue", "court_venue"]),
        pickAny(matter, ["indexAaaNumber", "index_aaa_number", "indexNumber"]),
        pickAny(matter, ["dateFiled", "date_filed", "filedDate", "filed_at"]),
        pickAny(matter, ["settledDate", "settlementDate", "settlement_date"]),
        pickAny(matter, ["settledWith", "settled_with"]),
        pickAny(matter, ["denialReason", "denial_reason"]),
        pickAny(matter, ["status", "matter_stage_name"]),
        pickAny(matter, ["closeReason", "close_reason", "closedReason"]),
        pickAny(matter, ["closedDate", "closed_date", "closedAt"]),
      ])
    );

    if (!rows.length) return;

    downloadWorkbookRows(
      standardCaseExportHeaders,
      rows,
      `barsh-matters-lawsuit-search-results-${timestampForFilename()}.xlsx`,
      "Search Results"
    );
  }

  function toggleMatter(m: Matter) {
    const id = matterId(m);
    if (!id || masterId(m)) return;

    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = m;
      return next;
    });
  }

  function toggleAllEligible(rows: Matter[]) {
    const eligible = rows.filter((m) => matterId(m) && !masterId(m));
    const allSelected = eligible.length > 0 && eligible.every((m) => selected[matterId(m)]);

    setSelected((prev) => {
      const next = { ...prev };

      if (allSelected) {
        eligible.forEach((m) => {
          delete next[matterId(m)];
        });
      } else {
        eligible.forEach((m) => {
          next[matterId(m)] = m;
        });
      }

      return next;
    });
  }

  async function createOrExtend() {
    if (!selectedMatters.length) return;

    setRunning(true);
    setError("");
    setResult(null);

    try {
      const matterIds = selectedMatters.map((m) => Number(matterId(m)));

      const previewRes = await fetch("/api/lawsuits/local-generation-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          matterIds,
          amountSoughtMode: "balance_presuit",
        }),
      });

      const previewJson = await previewRes.json();
      if (!previewRes.ok || !previewJson?.ok) {
        throw new Error(previewJson?.error || "Local lawsuit generation preview failed.");
      }

      if (!previewJson.canCreate) {
        setResult(previewJson);
        throw new Error(previewJson.blockingReason || "Selected matters cannot be used to create a new local lawsuit.");
      }

      const createRes = await fetch("/api/lawsuits/local-generation-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          confirm: "create-local-lawsuit",
          matterIds,
          amountSoughtMode: "balance_presuit",
          notes: "Created from Lawsuits page local-first generation workflow.",
        }),
      });

      const createJson = await createRes.json();
      if (!createRes.ok || !createJson?.ok) {
        throw new Error(createJson?.error || "Local lawsuit generation failed.");
      }

      setResult({
        ...createJson,
        preview: previewJson,
      });
      await search();
    } catch (e: any) {
      setError(e?.message || "Local lawsuit generation failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main style={{ padding: 16, width: "100vw", maxWidth: "none", marginLeft: "calc(50% - 50vw)", marginRight: "calc(50% - 50vw)" }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10000,
          isolation: "isolate",
          display: "grid",
          gridTemplateColumns: "500px minmax(0, 1fr) 330px",
          alignItems: "start",
          gap: 16,
          marginBottom: 14,
          padding: "8px 0 10px",
          background: "#f8fafc",
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.10)",
          borderBottom: "1px solid rgba(203, 213, 225, 0.9)",
        }}
      >
        <div style={{ gridColumn: "1", display: "flex", justifyContent: "flex-start", alignItems: "flex-start", gap: 12 }}>
          <img
            src="/brl-logo.png"
            alt="BRL Logo"
            style={{ width: 216, height: 144, objectFit: "contain", display: "block" }}
          />
          <div style={{ paddingTop: 8 }}>
            <BarshHeaderQuickNav />
          </div>
        </div>
<div
          style={{
            gridColumn: "3",
            justifySelf: "end",
            position: "relative",
            width: 330,
            height: 152,
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: -86,
              display: "flex",
              justifyContent: "flex-start",
              alignItems: "center",
            }}
          >
            <button
                type="button"
                onClick={() => {
                  window.location.href = "/print-queue";
                }}
                title="Open Daily Print Queue."
                style={{
                  display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "7px 11px",
                border: "1px solid #cbd5e1",
                borderRadius: 999,
                background: "#f8fafc",
                color: "#475569",
                fontSize: 12,
                fontWeight: 800,
                whiteSpace: "nowrap",
                cursor: "pointer",
                opacity: 1,
              }}
              >
                <span aria-hidden="true">🖨️</span>
                <span>Print Queue</span>
              </button>
          </div>

          <a href="/" title="Return to Barsh Matters entry screen" style={{ display: "inline-flex", textDecoration: "none" }}>
            <img
              src="/barsh-matters-cropped-transparent.png"
              alt="Barsh Matters Logo"
              style={{
                width: 330,
                height: 152,
                objectFit: "contain",
                objectPosition: "right top",
                display: "block",
              }}
            />
          </a>
        </div>
      </div>


<div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, margin: "0 0 4px 0" }}>Lawsuit Aggregation</h1>
          <div style={{ color: "#475569", fontSize: 13 }}>
            Search, aggregate, and manage lawsuit matter groups.
          </div>
        </div>

        <a
          href="/print-queue"
          style={{
            fontSize: 13,
            padding: "6px 10px",
            border: "1px solid #94a3b8",
            borderRadius: 6,
            color: "#0f172a",
            textDecoration: "none",
            background: "#fff",
            whiteSpace: "nowrap",
          }}
        >
          Daily Print Queue
        </a>
      </div>

      <div style={searchGrid}>
        <input placeholder="Claim number" value={claim} onChange={(e) => setClaim(e.target.value)} style={input} />
        <input placeholder="Patient" value={patient} onChange={(e) => setPatient(e.target.value)} style={input} />
        <input
          placeholder={referenceOptionsLoading ? "Provider · loading..." : "Provider"}
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          list="barsh-lawsuit-provider-reference-options"
          style={input}
        />
        <input
          placeholder={referenceOptionsLoading ? "Insurer · loading..." : "Insurer"}
          value={insurer}
          onChange={(e) => setInsurer(e.target.value)}
          list="barsh-lawsuit-insurer-reference-options"
          style={input}
        />
        <datalist id="barsh-lawsuit-provider-reference-options">
          {providerReferenceOptions.map((option, index) => {
            const value = String(option?.displayName || option?.name || option?.value || "").trim();
            if (!value) return null;
            return <option key={`lawsuit-provider-reference-${option.id || value}-${index}`} value={value} />;
          })}
        </datalist>
        <datalist id="barsh-lawsuit-insurer-reference-options">
          {insurerReferenceOptions.map((option, index) => {
            const value = String(option?.displayName || option?.name || option?.value || "").trim();
            if (!value) return null;
            return <option key={`lawsuit-insurer-reference-${option.id || value}-${index}`} value={value} />;
          })}
        </datalist>
        <button onClick={search} disabled={loading || running} style={primaryBtn}>
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      {result && (
        <div style={successBox}>
          <strong>Result:</strong> {result.action ?? result.status ?? result.result ?? "completed"}
          {(result.masterLawsuitId ?? result.master_lawsuit_id) ? ` — ${result.masterLawsuitId ?? result.master_lawsuit_id}` : ""}
        </div>
      )}

      {groups.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button
            type="button"
            onClick={exportSearchResultsXlsx}
            style={{
              border: "1px solid #4f46e5",
              background: "#4f46e5",
              color: "#fff",
              borderRadius: 999,
              padding: "8px 12px",
              fontWeight: 900,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Export XLS
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>
        <section>
          {!searched ? (
            <p>Enter a selector and search.</p>
          ) : loading ? (
            <p>Loading claim clusters...</p>
          ) : groups.length === 0 ? (
            <p>No claim clusters found.</p>
          ) : (
            groups.map((group, idx) => {
              const rows = [...getRows(group)].sort((a, b) => {
                const aM = masterId(a);
                const bM = masterId(b);
                if (!aM && bM) return -1;
                if (aM && !bM) return 1;
                return String(aM).localeCompare(String(bM));
              });

              const eligibleRows = rows.filter((m) => matterId(m) && !masterId(m));
              const allEligibleSelected =
                eligibleRows.length > 0 && eligibleRows.every((m) => selected[matterId(m)]);

              return (
                <div key={`${getClaimNumber(group)}-${idx}`} style={card}>
                  <div style={header}>
                    <span>Claim Number: {getClaimNumber(group)}</span>
                  </div>

                  <table style={table}>
                    <thead>
                      <tr>
                        <th style={thCheck}>
                          <input
                            type="checkbox"
                            checked={allEligibleSelected}
                            disabled={eligibleRows.length === 0}
                            onChange={() => toggleAllEligible(rows)}
                            title="Select/deselect all eligible matters"
                          />
                        </th>
                        <th style={th}>Matter</th>
                        <th style={th}>Patient</th>
                        <th style={th}>Provider</th>
                        <th style={th}>Insurer</th>
                        <th style={thRight}>Claim Amount</th>
                        <th style={thRight}>Balance</th>
                        <th style={th}>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map((m) => {
                        const id = matterId(m);
                        const checked = Boolean(selected[id]);
                        const hasMaster = !!masterId(m);

                        return (
                          <tr
                            key={id}
                            style={{
                              background: checked ? "#fff7cc" : hasMaster ? "#f2f2f2" : "white",
                              opacity: hasMaster ? 0.55 : 1,
                            }}
                          >
                            <td style={tdCheck}>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={hasMaster}
                                onChange={() => toggleMatter(m)}
                              />
                            </td>
                            <td style={td}>{displayNumber(m)}</td>
                            <td style={td}>{val(m, "patientName", "patient_name")}</td>
                            <td style={td}>{val(m, "client_name", "clientName", "provider_name", "providerName")}</td>
                            <td style={td}>{insurerName(m)}</td>
                            <td style={tdRight}>{money(val(m, "claimAmount", "claim_amount"))}</td>
                            <td style={tdRight}>{money(val(m, "balanceAmount", "balance_amount"))}</td>
                            <td style={td}>{hasMaster ? `Existing: ${masterId(m)}` : "New"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </section>

        <aside style={panel}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Selected Matters</h3>
          <p style={panelLine}><strong>Count:</strong> {selectedMatters.length}</p>
          <p style={panelLine}><strong>Total Claim Amount:</strong> {money(selectedTotal)}</p>

          <button
            onClick={createOrExtend}
            disabled={!selectedMatters.length || running}
            style={{
              ...primaryBtn,
              width: "100%",
              opacity: !selectedMatters.length || running ? 0.45 : 1,
              cursor: !selectedMatters.length || running ? "not-allowed" : "pointer",
            }}
          >
            {running ? "Working..." : "Create / Extend Lawsuit"}
          </button>
        </aside>
      </div>
    </main>
  );
}

const searchGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr) 220px",
  gap: 8,
  marginBottom: 12,
};

const input: React.CSSProperties = {
  padding: 8,
  border: "1px solid #ccc",
  borderRadius: 6,
};

const card: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  marginBottom: 12,
  overflow: "hidden",
};

const header: React.CSSProperties = {
  padding: "8px 10px",
  background: "#fafafa",
  borderBottom: "1px solid #ddd",
  fontWeight: 700,
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "7px 8px",
  borderBottom: "1px solid #ddd",
  whiteSpace: "nowrap",
};

const thCheck: React.CSSProperties = {
  ...th,
  width: 32,
  textAlign: "center",
};

const thRight: React.CSSProperties = {
  ...th,
  textAlign: "right",
};

const td: React.CSSProperties = {
  padding: "7px 8px",
  borderBottom: "1px solid #eee",
  verticalAlign: "top",
};

const tdCheck: React.CSSProperties = {
  ...td,
  width: 32,
  textAlign: "center",
};

const tdRight: React.CSSProperties = {
  ...td,
  textAlign: "right",
  whiteSpace: "nowrap",
};

const panel: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: 12,
  height: "fit-content",
  position: "sticky",
  top: 16,
};

const panelLine: React.CSSProperties = {
  margin: "5px 0",
};

const primaryBtn: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  background: "#111",
  color: "white",
  border: "none",
  cursor: "pointer",
};

const errorBox: React.CSSProperties = {
  padding: 10,
  background: "#fee",
  border: "1px solid #f99",
  marginBottom: 12,
};

const successBox: React.CSSProperties = {
  padding: 10,
  background: "#eef9ee",
  border: "1px solid #9c9",
  marginBottom: 12,
};
