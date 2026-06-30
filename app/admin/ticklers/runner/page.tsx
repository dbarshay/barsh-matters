"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BarshHeader from "@/app/components/BarshHeader";

type RunnerResponse = {
  ok?: boolean;
  mode?: string;
  writePerformed?: boolean;
  count?: number;
  completedCount?: number;
  criteria?: Record<string, unknown>;
  ticklers?: any[];
  error?: string;
};

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function displayKind(kind: string): string {
  if (kind === "settlement_payment_due_followup") return "Settlement: Follow-Up for Payment";
  if (kind === "settlement_signed_agreement_followup") return "Settlement: Follow-Up for Signed Agreement";
  return kind || "—";
}

function cell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function dueDate(value: unknown): string {
  if (!value || typeof value !== "string") return "—";
  return value.slice(0, 10);
}

function dateTimeCell(value: unknown): string {
  if (!value || typeof value !== "string") return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function firstCompletionTimestamp(ticklers: any[]): string {
  const first = ticklers.find((tickler) => tickler?.completedAt)?.completedAt;
  return dateTimeCell(first);
}

type AdminTicklerRunnerUrlState = {
  kind: string;
  dueThrough: string;
  limit: string;
};

function adminTicklerRunnerStateFromUrl(): AdminTicklerRunnerUrlState {
  if (typeof window === "undefined") {
    return {
      kind: "all",
      dueThrough: todayInputValue(),
      limit: "100",
    };
  }

  const params = new URLSearchParams(window.location.search);

  return {
    kind: params.get("kind") || "all",
    dueThrough: params.get("dueThrough") || todayInputValue(),
    limit: params.get("limit") || "100",
  };
}

function adminTicklerRunnerUrlForState(state: AdminTicklerRunnerUrlState) {
  const params = new URLSearchParams();

  if (state.kind && state.kind !== "all") params.set("kind", state.kind);
  if (state.dueThrough && state.dueThrough !== todayInputValue()) params.set("dueThrough", state.dueThrough);
  if (state.limit && state.limit !== "100") params.set("limit", state.limit);

  return params.toString() ? `/admin/ticklers/runner?${params.toString()}` : "/admin/ticklers/runner";
}

export default function AdminTicklerRunnerPage() {
  const initialUrlState = adminTicklerRunnerStateFromUrl();
  const [kind, setKindState] = useState(initialUrlState.kind);
  const [dueThrough, setDueThroughState] = useState(initialUrlState.dueThrough);
  const [limit, setLimitState] = useState(initialUrlState.limit);
  const [completedNote, setCompletedNote] = useState("Completed by Administrator bulk tickler runner.");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RunnerResponse | null>(null);
  const [previewCriteria, setPreviewCriteria] = useState<Record<string, unknown> | null>(null);

  const ticklers = useMemo(() => result?.ticklers || [], [result]);
  function pushRunnerFilterUrl(nextState: AdminTicklerRunnerUrlState) {
    if (typeof window === "undefined") return;

    const nextUrl = adminTicklerRunnerUrlForState(nextState);
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (nextUrl !== currentUrl) {
      window.history.pushState({ barshMattersAdminTicklerRunnerFilters: true }, "", nextUrl);
    }
  }

  function applyRunnerFilterState(nextState: AdminTicklerRunnerUrlState, options: { updateUrl?: boolean } = {}) {
    setKindState(nextState.kind);
    setDueThroughState(nextState.dueThrough);
    setLimitState(nextState.limit);
    invalidatePreviewCriteria();

    if (options.updateUrl !== false) {
      pushRunnerFilterUrl(nextState);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    function applyRunnerFiltersFromUrl() {
      const nextState = adminTicklerRunnerStateFromUrl();
      setKindState(nextState.kind);
      setDueThroughState(nextState.dueThrough);
      setLimitState(nextState.limit);
      setPreviewCriteria(null);
      setResult(null);
    }

    applyRunnerFiltersFromUrl();
    window.addEventListener("popstate", applyRunnerFiltersFromUrl);

    return () => {
      window.removeEventListener("popstate", applyRunnerFiltersFromUrl);
    };
  }, []);


  const currentPreviewCriteria = useMemo(
    () => ({
      kind,
      dueThrough,
      limit: Number(limit),
    }),
    [kind, dueThrough, limit],
  );

  const previewCriteriaMatchesCurrent =
    !!previewCriteria &&
    previewCriteria.kind === currentPreviewCriteria.kind &&
    previewCriteria.dueThrough === currentPreviewCriteria.dueThrough &&
    Number(previewCriteria.limit) === Number(currentPreviewCriteria.limit);

  const completeDisabled = loading || !previewCriteriaMatchesCurrent;

  function invalidatePreviewCriteria() {
    setPreviewCriteria(null);
    setResult(null);
  }

  async function run(mode: "preview" | "complete") {
    if (mode === "complete") {
      if (!previewCriteriaMatchesCurrent) {
        setResult({ ok: false, error: "Run Preview first. Completion is locked to the exact current filter set." });
        return;
      }

      const ok = window.confirm(
        "Complete the exact previewed open tickler filter set?",
      );
      if (!ok) return;
    }

    setLoading(true);
    setResult(null);

    const requestPayload =
      mode === "complete" && previewCriteriaMatchesCurrent && previewCriteria
        ? {
            ...previewCriteria,
            mode,
            completedBy: "admin-bulk-tickler-runner",
            completedNote,
          }
        : {
            mode,
            kind,
            dueThrough,
            limit: Number(limit),
            completedBy: "admin-bulk-tickler-runner",
            completedNote,
          };

    try {
      const response = await fetch("/api/admin/ticklers/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });

      const json = await response.json().catch(() => ({}));
      if (mode === "preview" && response.ok && json?.ok) {
        setPreviewCriteria(currentPreviewCriteria);
      }
      if (mode === "complete" && response.ok && json?.ok) {
        setPreviewCriteria(null);
      }
      setResult({ ...json, httpStatus: response.status });
    } catch (error: any) {
      setResult({ ok: false, error: error?.message || "Unable to run tickler bulk runner." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: "none", margin: 0 }}>
      <BarshHeader />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: 0 }}>Admin Tickler Bulk Runner</h1>
          <p style={{ marginTop: 8, color: "#475569", maxWidth: 880 }}>
            Administrator action screen for bulk processing open ticklers.
          </p>
        </div>
        <Link
          href="/admin/ticklers"
          style={{
            border: "1px solid #1f4f73",
            color: "#1f4f73",
            borderRadius: 10,
            padding: "9px 14px",
            textDecoration: "none",
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          Back to Admin Ticklers
        </Link>
      </div>

      <section
        data-barsh-admin-tickler-bulk-runner-controls="true"
        style={{
          marginTop: 18,
          border: "1px solid #d7e0ec",
          borderRadius: 14,
          padding: 18,
          background: "#f8fbff",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Runner Filters</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(180px, 1fr))", gap: 12 }}>
          <label style={{ display: "grid", gap: 6, fontWeight: 700 }}>
            Type / Kind
            <select value={kind} onChange={(event) => applyRunnerFilterState({ kind: event.target.value, dueThrough, limit })} style={{ padding: 9 }}>
              <option value="all">All open ticklers</option>
              <option value="settlement_payment_due_followup">Settlement: Follow-Up for Payment</option>
              <option value="settlement_signed_agreement_followup">Settlement: Follow-Up for Signed Agreement</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6, fontWeight: 700 }}>
            Due Through
            <input type="date" value={dueThrough} onChange={(event) => applyRunnerFilterState({ kind, dueThrough: event.target.value, limit })} style={{ padding: 9 }} />
          </label>

          <label style={{ display: "grid", gap: 6, fontWeight: 700 }}>
            Limit
            <input value={limit} onChange={(event) => applyRunnerFilterState({ kind, dueThrough, limit: event.target.value })} style={{ padding: 9 }} />
          </label>

          <label style={{ display: "grid", gap: 6, fontWeight: 700 }}>
            Completion Note
            <input value={completedNote} onChange={(event) => setCompletedNote(event.target.value)} style={{ padding: 9 }} />
          </label>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            data-barsh-admin-tickler-bulk-runner-preview="true"
            disabled={loading}
            onClick={() => run("preview")}
            style={{
              border: "1px solid #1f4f73",
              background: "#ffffff",
              color: "#1f4f73",
              borderRadius: 10,
              padding: "9px 16px",
              fontWeight: 800,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            Preview Matching Open Ticklers
          </button>

          <button
            type="button"
            data-barsh-admin-tickler-bulk-runner-complete="true"
            disabled={completeDisabled}
            data-barsh-admin-tickler-bulk-runner-complete-disabled-until-preview={completeDisabled}
            title={completeDisabled ? "Run Preview first. Completion is locked to the exact current filter set." : "Complete the exact previewed filter set."}
            onClick={() => run("complete")}
            style={{
              border: "1px solid #7f1d1d",
              background: "#7f1d1d",
              color: "#ffffff",
              borderRadius: 10,
              padding: "9px 16px",
              fontWeight: 800,
              cursor: completeDisabled ? "not-allowed" : "pointer",
              opacity: completeDisabled ? 0.55 : 1,
            }}
          >
            Complete Previewed Filter Set
          </button>
        </div>

        <p
          data-barsh-admin-tickler-bulk-runner-preview-lock-status="true"
          style={{ margin: "10px 0 0", color: previewCriteriaMatchesCurrent ? "#166534" : "#7f1d1d", fontWeight: 700 }}
        >
          {previewCriteriaMatchesCurrent
            ? "Completion is locked to the exact previewed filter set."
            : "Run Preview before completing. Changing Type / Kind, Due Through, or Limit clears the preview lock."}
        </p>
      </section>

      {result ? (
        <section
          data-barsh-admin-tickler-bulk-runner-results="true"
          style={{ marginTop: 18, border: "1px solid #d7e0ec", borderRadius: 14, padding: 18, background: "#ffffff" }}
        >
          <h2 style={{ marginTop: 0 }}>Runner Result</h2>
          {!result.ok ? (
            <p style={{ color: "#991b1b", fontWeight: 700 }}>{result.error || "Runner failed."}</p>
          ) : (
            <>
              <p style={{ marginTop: 0, color: result.writePerformed ? "#7f1d1d" : "#166534", fontWeight: 800 }}>
                {result.writePerformed
                  ? `Completed ${result.completedCount || 0} open tickler(s).`
                  : `Preview found ${result.count || 0} open tickler(s).`}
              </p>

              {result.writePerformed ? (
                <div
                  data-barsh-admin-tickler-bulk-runner-completion-audit-summary="true"
                  style={{
                    margin: "12px 0 16px",
                    border: "1px solid #fecaca",
                    borderRadius: 12,
                    padding: 14,
                    background: "#fff7f7",
                  }}
                >
                  <h3 style={{ margin: "0 0 8px", color: "#7f1d1d" }}>Completion Audit Summary</h3>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, minmax(160px, 1fr))",
                      gap: 10,
                      fontSize: 13,
                    }}
                  >
                    <div>
                      <strong>Completed Count</strong>
                      <div>{result.completedCount || 0}</div>
                    </div>
                    <div>
                      <strong>Completed By</strong>
                      <div>{cell(ticklers[0]?.completedBy)}</div>
                    </div>
                    <div>
                      <strong>Completed At</strong>
                      <div>{firstCompletionTimestamp(ticklers)}</div>
                    </div>
                    <div>
                      <strong>Completion Note</strong>
                      <div>{cell(ticklers[0]?.completedNote)}</div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid #d7e0ec" }}>
                      <th style={{ padding: 8 }}>Due</th>
                      <th style={{ padding: 8 }}>Type</th>
                      <th style={{ padding: 8 }}>Matter</th>
                      <th style={{ padding: 8 }}>Master Lawsuit</th>
                      <th style={{ padding: 8 }}>Provider</th>
                      <th style={{ padding: 8 }}>Patient</th>
                      <th style={{ padding: 8 }}>Insurer</th>
                      <th style={{ padding: 8 }}>Status</th>
                      <th style={{ padding: 8 }}>Completed At</th>
                      <th style={{ padding: 8 }}>Completed By</th>
                      <th style={{ padding: 8 }}>Completion Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ticklers.length === 0 ? (
                      <tr>
                        <td colSpan={11} style={{ padding: 12, color: "#64748b" }}>
                          No matching ticklers.
                        </td>
                      </tr>
                    ) : (
                      ticklers.map((tickler) => (
                        <tr key={tickler.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: 8 }}>{dueDate(tickler.dueAt)}</td>
                          <td style={{ padding: 8 }}>{displayKind(tickler.kind)}</td>
                          <td style={{ padding: 8 }}>{cell(tickler.caseData?.matter || tickler.displayNumber || tickler.matterId)}</td>
                          <td style={{ padding: 8 }}>{cell(tickler.caseData?.masterLawsuit || tickler.masterLawsuitId)}</td>
                          <td style={{ padding: 8 }}>{cell(tickler.caseData?.provider)}</td>
                          <td style={{ padding: 8 }}>{cell(tickler.caseData?.patient)}</td>
                          <td style={{ padding: 8 }}>{cell(tickler.caseData?.insurer)}</td>
                          <td style={{ padding: 8, fontWeight: 800 }}>{cell(tickler.status)}</td>
                          <td style={{ padding: 8 }}>{dateTimeCell(tickler.completedAt)}</td>
                          <td style={{ padding: 8 }}>{cell(tickler.completedBy)}</td>
                          <td style={{ padding: 8 }}>{cell(tickler.completedNote)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      ) : null}
    </main>
  );
}
