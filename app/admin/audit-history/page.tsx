"use client";

import React, { useEffect, useState } from "react";
import BarshHeader from "@/app/components/BarshHeader";

type AuditEntry = {
  id?: string;
  createdAt?: string;
  timestamp?: string;
  action?: string;
  actionSummary?: string;
  matterId?: string | number;
  masterLawsuitId?: string;
  user?: string;
  details?: any;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function display(value: unknown, fallback = "—"): string {
  const text = clean(value);
  return text || fallback;
}

function formatDate(value: unknown): string {
  const raw = clean(value);
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString();
}

export default function AdminAuditHistoryPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadAuditHistory() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/audit-log?limit=100", { cache: "no-store" });
      const json = await response.json().catch(() => null);

      if (!response.ok || !json) {
        throw new Error(json?.error || "Audit / History load failed.");
      }

      const rows = Array.isArray(json.entries)
        ? json.entries
        : Array.isArray(json.rows)
          ? json.rows
          : Array.isArray(json.auditLog)
            ? json.auditLog
            : [];

      setEntries(rows);
    } catch (err: any) {
      setEntries([]);
      setError(err?.message || "Audit / History load failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAuditHistory();
  }, []);

  return (
    <main
      data-barsh-admin-audit-history="true"
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#00346e",
        padding: "28px 30px 46px",
        boxSizing: "border-box",
      }}
    >
      <BarshHeader />
      <div style={{ maxWidth: "none", margin: 0, display: "grid", gap: 18 }}>
        <header
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 24,
            padding: 22,
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 950, color: "#00346e", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Admin
              </div>
              <h1 style={{ margin: "4px 0 0", fontSize: 30, lineHeight: 1.1 }}>
                Audit / History
              </h1>
              <p style={{ margin: "8px 0 0", color: "#385a83", lineHeight: 1.45, maxWidth: 900 }}>
                Administrator view for recent local Barsh Matters audit/history entries.
              </p>
            </div>

            <button
              type="button"
              onClick={loadAuditHistory}
              disabled={loading}
              style={{
                alignSelf: "flex-start",
                border: "1px solid #0f172a",
                background: loading ? "#e5e7eb" : "#0f172a",
                color: loading ? "#385a83" : "#ffffff",
                borderRadius: 12,
                padding: "9px 13px",
                fontWeight: 950,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </header>

        {error && (
          <section
            style={{
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
              borderRadius: 18,
              padding: 16,
              fontWeight: 900,
            }}
          >
            {error}
          </section>
        )}

        <section
          data-barsh-admin-users-audit-history-focus="read-only"
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 18,
            padding: 18,
            boxShadow: "0 10px 25px rgba(0, 52, 110, 0.06)",
          }}
        >
          <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Admin Users Audit Focus</h2>
          <p style={{ margin: "0 0 10px", color: "#00346e", lineHeight: 1.5 }}>
            Focused read-only review labels for admin-user-create, admin-user-assign-role, admin-user-remove-role, and admin-user-permission-override audit entries. This page only reads the existing audit-log API and does not enable permission enforcement.
          </p>
          <div data-barsh-admin-users-audit-action-labels="true" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {["admin-user-create", "admin-user-assign-role", "admin-user-remove-role", "admin-user-permission-override"].map((action) => (
              <span key={action} style={{ border: "1px solid #bfdbfe", background: "#fff", color: "#00346e", borderRadius: 999, padding: "6px 10px", fontWeight: 900, fontSize: 12, fontFamily: "monospace" }}>{action}</span>
            ))}
          </div>
        </section>

        <section
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 22,
            overflow: "hidden",
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
          }}
        >
          <div style={{ padding: "16px 18px", borderBottom: "1px solid #e5e7eb" }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Recent Audit Entries</h2>
            <p style={{ margin: "4px 0 0", color: "#385a83", lineHeight: 1.4 }}>
              Shows the most recent local audit/history records available from the existing audit-log API.
            </p>
          </div>

          {loading && <div style={{ padding: 18, color: "#385a83", fontWeight: 900 }}>Loading audit history...</div>}

          {!loading && entries.length === 0 && (
            <div style={{ padding: 18, color: "#385a83", fontWeight: 900 }}>
              No audit/history entries returned.
            </div>
          )}

          {!loading && entries.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#385a83", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    <th style={{ textAlign: "left", padding: "11px 12px", borderBottom: "1px solid #e5e7eb" }}>Date</th>
                    <th style={{ textAlign: "left", padding: "11px 12px", borderBottom: "1px solid #e5e7eb" }}>Action</th>
                    <th style={{ textAlign: "left", padding: "11px 12px", borderBottom: "1px solid #e5e7eb" }}>Matter</th>
                    <th style={{ textAlign: "left", padding: "11px 12px", borderBottom: "1px solid #e5e7eb" }}>User</th>
                    <th style={{ textAlign: "left", padding: "11px 12px", borderBottom: "1px solid #e5e7eb" }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr key={entry.id || index} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: 12, verticalAlign: "top", whiteSpace: "nowrap" }}>
                        {formatDate(entry.createdAt || entry.timestamp)}
                      </td>
                      <td style={{ padding: 12, verticalAlign: "top" }}>
                        <div style={{ fontWeight: 950 }}>{display(entry.actionSummary || entry.action)}</div>
                        <div style={{ color: "#385a83", fontSize: 13 }}>{display(entry.action)}</div>
                      </td>
                      <td style={{ padding: 12, verticalAlign: "top" }}>
                        <div>{display(entry.matterId)}</div>
                        <div style={{ color: "#385a83", fontSize: 13 }}>{display(entry.masterLawsuitId)}</div>
                      </td>
                      <td style={{ padding: 12, verticalAlign: "top" }}>{display(entry.user)}</td>
                      <td style={{ padding: 12, verticalAlign: "top" }}>
                        <details>
                          <summary style={{ cursor: "pointer", fontWeight: 900 }}>View details</summary>
                          <pre
                            style={{
                              margin: "8px 0 0",
                              maxWidth: 460,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              background: "#f8fafc",
                              border: "1px solid #e5e7eb",
                              borderRadius: 10,
                              padding: 10,
                              fontSize: 12,
                            }}
                          >
                            {JSON.stringify(entry.details || entry, null, 2)}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
