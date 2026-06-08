"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ClientRow = {
  id: string;
  displayName: string;
  normalizedName?: string;
  isActive?: boolean;
  aliases?: string[];
  detailKeys?: string[];
  address?: string;
  phone?: string;
  email?: string;
  updatedAt?: string | null;
};

const pageStyle: React.CSSProperties = {
  maxWidth: 1500,
  margin: "0 auto",
  padding: "32px 24px 80px",
  fontFamily: "var(--font-geist-sans)",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "#fff",
  padding: 18,
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb",
  padding: "10px 8px",
  fontSize: 12,
  color: "#475569",
  background: "#f8fafc",
  position: "sticky",
  top: 0,
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #f1f5f9",
  padding: "10px 8px",
  verticalAlign: "top",
  fontSize: 13,
};

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function clientLabel(row: ClientRow) {
  const aliasText = row.aliases?.length ? ` — aliases: ${row.aliases.slice(0, 3).join(", ")}` : "";
  return `${row.displayName || "(Unnamed client)"}${aliasText}`;
}

export default function AdminClientsPage() {
  const [active, setActive] = useState("active");
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState("Loading clients...");
  const [error, setError] = useState("");

  async function loadClients() {
    setError("");
    setStatus("Loading clients...");
    const params = new URLSearchParams();
    params.set("active", active);
    params.set("take", "1000");
    const res = await fetch(`/api/admin/clients?${params.toString()}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Could not load clients.");
    const nextRows: ClientRow[] = json.rows || [];
    setRows(nextRows);
    setCount(json.count || 0);
    setSelectedClientId((current) => (current && nextRows.some((row) => row.id === current) ? current : ""));
    setStatus(`Loaded ${json.count || 0} client${json.count === 1 ? "" : "s"}.`);
  }

  useEffect(() => {
    loadClients().catch((err) => {
      setError(err?.message || "Could not load clients.");
      setStatus("");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const selectedClient = useMemo(
    () => rows.find((row) => row.id === selectedClientId) || null,
    [rows, selectedClientId]
  );

  const visibleRows = useMemo(
    () => (selectedClientId ? rows.filter((row) => row.id === selectedClientId) : rows),
    [rows, selectedClientId]
  );

  return (
    <main style={pageStyle}>
      <div style={{ marginBottom: 18 }}>
        <Link href="/admin" style={{ color: "#2563eb", fontWeight: 700, textDecoration: "none" }}>
          ← Admin
        </Link>
      </div>

      <section style={{ marginBottom: 22 }}>
        <div style={{ color: "#64748b", fontSize: 13, fontWeight: 700, textTransform: "uppercase" }}>
          Administrator
        </div>
        <h1 style={{ margin: "6px 0 8px", fontSize: 34 }}>Clients</h1>
      </section>

      <section style={{ ...cardStyle, marginBottom: 18 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(360px, 1fr) 220px",
            gap: 14,
            alignItems: "end",
          }}
        >
          <label style={{ display: "grid", gap: 6, fontWeight: 700 }}>
            Select Client
            <select
              value={selectedClientId}
              onChange={(event) => setSelectedClientId(event.target.value)}
              style={{
                width: "100%",
                maxWidth: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                background: "#fff",
              }}
            >
              <option value="">All clients</option>
              {rows.map((row) => (
                <option key={row.id} value={row.id}>
                  {clientLabel(row)}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6, fontWeight: 700 }}>
            Status
            <select
              value={active}
              onChange={(event) => setActive(event.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                background: "#fff",
              }}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
          </label>
        </div>

        <div style={{ marginTop: 12, color: error ? "#b91c1c" : "#475569", fontWeight: 700 }}>
          {error || status}
        </div>

      </section>

      <section style={cardStyle}>
        <div style={{ marginBottom: 12 }}>
          <strong>
            {selectedClient ? "Selected client" : `${count} client${count === 1 ? "" : "s"}`}
          </strong>
        </div>

        <div style={{ overflowX: "auto", maxHeight: "68vh" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr>
                <th style={thStyle}>Client</th>
                <th style={thStyle}>Aliases</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  <td style={tdStyle}>
                    <Link
                      href={`/admin/clients/${encodeURIComponent(row.id)}`}
                      style={{ color: "#2563eb", fontWeight: 800, textDecoration: "none" }}
                    >
                      {row.displayName || "(Unnamed client)"}
                    </Link>
                    <div style={{ color: "#64748b", fontSize: 12 }}>{row.normalizedName || ""}</div>
                  </td>
                  <td style={tdStyle}>{row.aliases?.length ? row.aliases.join(", ") : "—"}</td>
                  <td style={tdStyle}>{row.isActive === false ? "Inactive" : "Active"}</td>
                  <td style={tdStyle}>{formatDate(row.updatedAt)}</td>
                </tr>
              ))}

              {!visibleRows.length && (
                <tr>
                  <td style={tdStyle} colSpan={4}>
                    No clients found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
