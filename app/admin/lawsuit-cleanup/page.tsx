"use client";

import { useEffect, useMemo, useState } from "react";

type CleanupChild = {
  displayNumber: string;
  matterId: string;
  masterLawsuitId: string;
  patient: string;
  provider: string;
  insurer: string;
  claimNumber: string;
  claimAmount: number;
  balancePresuit: number;
};

type CleanupLawsuit = {
  masterLawsuitId: string;
  amountSought: number;
  venue: string;
  indexAaaNumber: string;
  clioMasterMatterId: string;
  clioMasterDisplayNumber: string;
  clioMasterMappingSource: string;
  hasClioShell: boolean;
  childCount: number;
  children: CleanupChild[];
};

type CleanupPreview = {
  ok?: boolean;
  error?: string;
  previewOnly?: boolean;
  keepMaster?: string;
  localLawsuitCount?: number;
  candidateLocalLawsuitCount?: number;
  keepMasterChildCount?: number;
  wouldClearChildClaimIndexLinkCount?: number;
  clioDeleteCandidateCount?: number;
  writesLocalDb?: boolean;
  writesClio?: boolean;
  deletesClio?: boolean;
  destructiveActionAvailable?: boolean;
  keepMasterChildren?: CleanupChild[];
  candidateLawsuits?: CleanupLawsuit[];
  safetyDecision?: string;
};

function money(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n)
    ? n.toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "$0.00";
}

function safe(value: unknown) {
  const text = value == null ? "" : String(value).trim();
  return text || "—";
}

export default function AdminLawsuitCleanupPage() {
  const [keepMaster, setKeepMaster] = useState("2026.05.00001");
  const [includeEmpty, setIncludeEmpty] = useState(true);
  const [onlyWithChildren, setOnlyWithChildren] = useState(false);
  const [onlyWithClioShell, setOnlyWithClioShell] = useState(false);
  const [preview, setPreview] = useState<CleanupPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleanupRunning, setCleanupRunning] = useState("");
  const [confirmByMaster, setConfirmByMaster] = useState<Record<string, string>>({});
  const [cleanupResult, setCleanupResult] = useState<any | null>(null);
  const [error, setError] = useState("");

  const candidateLawsuits = useMemo(
    () => (Array.isArray(preview?.candidateLawsuits) ? preview.candidateLawsuits : []),
    [preview]
  );

  async function confirmCleanup(lawsuit: CleanupLawsuit) {
    const expectedConfirmation = `DEAGGREGATE AND DELETE ${lawsuit.masterLawsuitId}`;
    const typedConfirmation = String(confirmByMaster[lawsuit.masterLawsuitId] || "").trim();

    if (typedConfirmation !== expectedConfirmation) {
      setError(`Exact confirmation required: ${expectedConfirmation}`);
      return;
    }

    setCleanupRunning(lawsuit.masterLawsuitId);
    setError("");
    setCleanupResult(null);

    try {
      const response = await fetch("/api/admin/lawsuits/cleanup-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          masterLawsuitId: lawsuit.masterLawsuitId,
          confirmation: typedConfirmation,
          deleteClioShell: true,
          actorName: "Admin Lawsuit Cleanup",
        }),
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Lawsuit cleanup failed.");
      }

      setCleanupResult(json);
      setConfirmByMaster((prev) => ({ ...prev, [lawsuit.masterLawsuitId]: "" }));
      await loadPreview();
    } catch (err: any) {
      setError(err?.message || "Lawsuit cleanup failed.");
    } finally {
      setCleanupRunning("");
    }
  }

  async function loadPreview() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      params.set("keepMaster", keepMaster.trim() || "2026.05.00001");
      params.set("includeEmpty", includeEmpty ? "true" : "false");
      params.set("onlyWithChildren", onlyWithChildren ? "true" : "false");
      params.set("onlyWithClioShell", onlyWithClioShell ? "true" : "false");

      const response = await fetch(`/api/admin/lawsuits/cleanup-preview?${params.toString()}`, {
        cache: "no-store",
      });

      const json = (await response.json().catch(() => ({}))) as CleanupPreview;

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Lawsuit cleanup preview failed.");
      }

      setPreview(json);
    } catch (err: any) {
      setPreview(null);
      setError(err?.message || "Lawsuit cleanup preview failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>Administrator</div>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.1 }}>Lawsuit Cleanup / Deaggregate</h1>
          <p style={subtitleStyle}>
            Preview-only Admin utility for inspecting extra local lawsuit records, child matter links, and mapped Clio master document shells.
          </p>
        </div>

        <a href="/admin" style={backLinkStyle}>
          ← Back to Admin Home
        </a>
      </section>

      <section style={warningStyle}>
        <strong>Preview only.</strong> This page does not deaggregate matters, delete local lawsuits, delete Clio shells, update ClaimIndex, write Clio, upload documents, send email, or queue print jobs.
      </section>

      <section style={filterCardStyle}>
        <h2 style={sectionTitleStyle}>Cleanup Preview Filters</h2>
        <div style={filterGridStyle}>
          <label style={labelStyle}>
            Keep Master Lawsuit
            <input value={keepMaster} onChange={(event) => setKeepMaster(event.target.value)} style={inputStyle} />
          </label>

          <label style={checkLabelStyle}>
            <input type="checkbox" checked={includeEmpty} onChange={(event) => setIncludeEmpty(event.target.checked)} />
            Include empty local lawsuit rows
          </label>

          <label style={checkLabelStyle}>
            <input type="checkbox" checked={onlyWithChildren} onChange={(event) => setOnlyWithChildren(event.target.checked)} />
            Only lawsuits with linked child matters
          </label>

          <label style={checkLabelStyle}>
            <input type="checkbox" checked={onlyWithClioShell} onChange={(event) => setOnlyWithClioShell(event.target.checked)} />
            Only lawsuits with mapped Clio shells
          </label>
        </div>

        <button type="button" onClick={() => void loadPreview()} disabled={loading} style={primaryButtonStyle}>
          {loading ? "Loading Preview..." : "Refresh Cleanup Preview"}
        </button>

        {error ? <div style={errorStyle}>{error}</div> : null}
      </section>

      {cleanupResult ? (
        <section style={successStyle}>
          <strong>Cleanup completed:</strong> {safe(cleanupResult.masterLawsuitId)} · cleared{" "}
          {cleanupResult.localResult?.clearedClaimIndexLinks ?? 0} child link(s) · audit log{" "}
          {cleanupResult.localResult?.auditLogId ?? "—"}
          {cleanupResult.clioDeleteResult ? (
            <> · deleted Clio shell status {cleanupResult.clioDeleteResult.status}</>
          ) : null}
        </section>
      ) : null}

      {preview ? (
        <>
          <section style={summaryGridStyle}>
            <div style={summaryCardStyle}>
              <div style={summaryLabelStyle}>Keep Master</div>
              <div style={summaryValueStyle}>{safe(preview.keepMaster)}</div>
            </div>
            <div style={summaryCardStyle}>
              <div style={summaryLabelStyle}>Local Lawsuits</div>
              <div style={summaryValueStyle}>{preview.localLawsuitCount ?? 0}</div>
            </div>
            <div style={summaryCardStyle}>
              <div style={summaryLabelStyle}>Cleanup Candidates</div>
              <div style={summaryValueStyle}>{preview.candidateLocalLawsuitCount ?? 0}</div>
            </div>
            <div style={summaryCardStyle}>
              <div style={summaryLabelStyle}>Child Links Previewed</div>
              <div style={summaryValueStyle}>{preview.wouldClearChildClaimIndexLinkCount ?? 0}</div>
            </div>
            <div style={summaryCardStyle}>
              <div style={summaryLabelStyle}>Clio Shell Candidates</div>
              <div style={summaryValueStyle}>{preview.clioDeleteCandidateCount ?? 0}</div>
            </div>
          </section>

          <section style={panelStyle}>
            <h2 style={sectionTitleStyle}>Kept Master Children</h2>
            <p style={mutedTextStyle}>These child matters stay linked to the keep-master lawsuit.</p>
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Matter</th>
                    <th style={thStyle}>Patient</th>
                    <th style={thStyle}>Provider</th>
                    <th style={thStyle}>Insurer</th>
                    <th style={thStyle}>Claim</th>
                    <th style={thRightStyle}>Claim Amount</th>
                    <th style={thRightStyle}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {(preview.keepMasterChildren || []).map((row) => (
                    <tr key={row.matterId}>
                      <td style={tdStyle}>
                        <a href={`/matter/${encodeURIComponent(row.matterId)}`} style={linkStyle}>
                          {safe(row.displayNumber)}
                        </a>
                      </td>
                      <td style={tdStyle}>{safe(row.patient)}</td>
                      <td style={tdStyle}>{safe(row.provider)}</td>
                      <td style={tdStyle}>{safe(row.insurer)}</td>
                      <td style={tdStyle}>{safe(row.claimNumber)}</td>
                      <td style={tdRightStyle}>{money(row.claimAmount)}</td>
                      <td style={tdRightStyle}>{money(row.balancePresuit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section style={panelStyle}>
            <h2 style={sectionTitleStyle}>Cleanup Candidates</h2>
            <p style={mutedTextStyle}>
              Preview-only candidate list. Future destructive action should require a separate exact confirmation and audit entry.
            </p>

            {candidateLawsuits.length ? (
              <div style={{ display: "grid", gap: 14 }}>
                {candidateLawsuits.map((lawsuit) => (
                  <article key={lawsuit.masterLawsuitId} style={candidateCardStyle}>
                    <div style={candidateHeaderStyle}>
                      <div>
                        <div style={candidateTitleStyle}>{lawsuit.masterLawsuitId}</div>
                        <div style={mutedTextStyle}>
                          {lawsuit.childCount} child matter(s) · Lawsuit Amount {money(lawsuit.amountSought)}
                        </div>
                      </div>
                      <a href={`/matters?master=${encodeURIComponent(lawsuit.masterLawsuitId)}`} style={linkStyle}>
                        Open Lawsuit
                      </a>
                    </div>

                    <div style={metaGridStyle}>
                      <div><strong>Venue:</strong> {safe(lawsuit.venue)}</div>
                      <div><strong>Index:</strong> {safe(lawsuit.indexAaaNumber)}</div>
                      <div><strong>Clio Shell:</strong> {safe(lawsuit.clioMasterDisplayNumber || lawsuit.clioMasterMatterId)}</div>
                      <div><strong>Mapping Source:</strong> {safe(lawsuit.clioMasterMappingSource)}</div>
                    </div>

                    <div style={dangerActionStyle}>
                      <div>
                        <strong>Guarded cleanup action</strong>
                        <div style={mutedTextStyle}>
                          This will delete only the mapped Clio master shell when present, clear local child lawsuit links,
                          delete this local Lawsuit row, and create an AuditLog entry.  It will not delete child/bill Clio matters.
                        </div>
                      </div>
                      <label style={labelStyle}>
                        Type exact confirmation
                        <input
                          value={confirmByMaster[lawsuit.masterLawsuitId] || ""}
                          onChange={(event) =>
                            setConfirmByMaster((prev) => ({
                              ...prev,
                              [lawsuit.masterLawsuitId]: event.target.value,
                            }))
                          }
                          placeholder={`DEAGGREGATE AND DELETE ${lawsuit.masterLawsuitId}`}
                          style={inputStyle}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void confirmCleanup(lawsuit)}
                        disabled={
                          cleanupRunning === lawsuit.masterLawsuitId ||
                          (confirmByMaster[lawsuit.masterLawsuitId] || "").trim() !==
                            `DEAGGREGATE AND DELETE ${lawsuit.masterLawsuitId}`
                        }
                        style={{
                          ...dangerButtonStyle,
                          opacity:
                            cleanupRunning === lawsuit.masterLawsuitId ||
                            (confirmByMaster[lawsuit.masterLawsuitId] || "").trim() !==
                              `DEAGGREGATE AND DELETE ${lawsuit.masterLawsuitId}`
                              ? 0.45
                              : 1,
                          cursor:
                            cleanupRunning === lawsuit.masterLawsuitId ||
                            (confirmByMaster[lawsuit.masterLawsuitId] || "").trim() !==
                              `DEAGGREGATE AND DELETE ${lawsuit.masterLawsuitId}`
                              ? "not-allowed"
                              : "pointer",
                        }}
                      >
                        {cleanupRunning === lawsuit.masterLawsuitId
                          ? "Cleaning Up..."
                          : "Confirm Deaggregate / Delete Shell"}
                      </button>
                    </div>

                    {lawsuit.children.length ? (
                      <div style={tableWrapStyle}>
                        <table style={tableStyle}>
                          <thead>
                            <tr>
                              <th style={thStyle}>Child Matter</th>
                              <th style={thStyle}>Patient</th>
                              <th style={thStyle}>Provider</th>
                              <th style={thRightStyle}>Claim Amount</th>
                              <th style={thRightStyle}>Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lawsuit.children.map((child) => (
                              <tr key={child.matterId}>
                                <td style={tdStyle}>
                                  <a href={`/matter/${encodeURIComponent(child.matterId)}`} style={linkStyle}>
                                    {safe(child.displayNumber)}
                                  </a>
                                </td>
                                <td style={tdStyle}>{safe(child.patient)}</td>
                                <td style={tdStyle}>{safe(child.provider)}</td>
                                <td style={tdRightStyle}>{money(child.claimAmount)}</td>
                                <td style={tdRightStyle}>{money(child.balancePresuit)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={emptyChildStyle}>No currently linked child matters.</div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div style={emptyChildStyle}>No cleanup candidates match the current filters.</div>
            )}
          </section>

          <section style={warningStyle}>
            <strong>Safety decision:</strong> {preview.safetyDecision}
          </section>
        </>
      ) : null}
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f8fafc",
  padding: 24,
  color: "#0f172a",
};

const heroStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "flex-start",
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 24,
  boxShadow: "0 14px 35px rgba(15, 23, 42, 0.08)",
  marginBottom: 18,
};

const eyebrowStyle: React.CSSProperties = {
  color: "#1d4ed8",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: 12,
  marginBottom: 8,
};

const subtitleStyle: React.CSSProperties = {
  margin: "10px 0 0",
  color: "#64748b",
  maxWidth: 900,
  fontSize: 15,
  lineHeight: 1.5,
};

const backLinkStyle: React.CSSProperties = {
  color: "#334155",
  fontWeight: 900,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const warningStyle: React.CSSProperties = {
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#7c2d12",
  borderRadius: 14,
  padding: 14,
  marginBottom: 18,
  fontWeight: 700,
};

const filterCardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 18,
  marginBottom: 18,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 22,
};

const filterGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(240px, 320px) repeat(3, minmax(180px, 1fr))",
  gap: 12,
  alignItems: "end",
  marginBottom: 14,
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  color: "#334155",
  fontSize: 13,
  fontWeight: 900,
};

const checkLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#334155",
  fontSize: 13,
  fontWeight: 900,
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "10px 12px",
  fontWeight: 800,
};

const primaryButtonStyle: React.CSSProperties = {
  background: "#0f172a",
  color: "white",
  border: 0,
  borderRadius: 12,
  padding: "11px 16px",
  fontWeight: 900,
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  marginTop: 12,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  borderRadius: 12,
  padding: 12,
  fontWeight: 800,
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(140px, 1fr))",
  gap: 12,
  marginBottom: 18,
};

const summaryCardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 14,
};

const summaryLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const summaryValueStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 22,
  fontWeight: 950,
};

const panelStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 18,
  marginBottom: 18,
};

const mutedTextStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 700,
};

const tableWrapStyle: React.CSSProperties = {
  overflowX: "auto",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  marginTop: 12,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: 10,
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
  color: "#475569",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const thRightStyle: React.CSSProperties = {
  ...thStyle,
  textAlign: "right",
};

const tdStyle: React.CSSProperties = {
  padding: 10,
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "top",
};

const tdRightStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: "right",
};

const linkStyle: React.CSSProperties = {
  color: "#1d4ed8",
  fontWeight: 900,
  textDecoration: "none",
};

const candidateCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 14,
  background: "#ffffff",
};

const candidateHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  marginBottom: 12,
};

const candidateTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 950,
};

const metaGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(160px, 1fr))",
  gap: 10,
  color: "#334155",
  fontSize: 13,
  marginBottom: 10,
};

const emptyChildStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  color: "#64748b",
  borderRadius: 12,
  padding: 12,
  fontWeight: 800,
  marginTop: 12,
};


const successStyle: React.CSSProperties = {
  background: "#ecfdf5",
  border: "1px solid #bbf7d0",
  color: "#14532d",
  borderRadius: 14,
  padding: 14,
  marginBottom: 18,
  fontWeight: 900,
};

const dangerActionStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: 12,
  padding: 12,
  margin: "12px 0",
};

const dangerButtonStyle: React.CSSProperties = {
  background: "#991b1b",
  color: "white",
  border: 0,
  borderRadius: 12,
  padding: "11px 16px",
  fontWeight: 950,
};
