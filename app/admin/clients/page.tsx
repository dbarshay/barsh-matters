"use client";

import BarshHeader from "@/app/components/BarshHeader";
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

type SortKey = "client" | "aliases" | "status" | "updated";
type SortDirection = "asc" | "desc";

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
  padding: "8px 8px",
  fontSize: 12,
  color: "#385a83",
  background: "#f8fafc",
  position: "sticky",
  top: 0,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #f1f5f9",
  padding: "7px 8px",
  verticalAlign: "middle",
  fontSize: 13,
  lineHeight: 1.2,
  whiteSpace: "nowrap",
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

function statusBadge(isActive?: boolean) {
  const active = isActive !== false;
  return (
    <span
      style={{
        color: active ? "#166534" : "#b91c1c",
        background: active ? "#dcfce7" : "#fee2e2",
        border: `1px solid ${active ? "#86efac" : "#fecaca"}`,
        borderRadius: 999,
        padding: "3px 9px",
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function sortText(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function sortDate(value?: string | null) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export default function AdminClientsPage() {
  const [active, setActive] = useState("active");
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("client");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
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

  const visibleRows = useMemo(() => {
    const filteredRows = selectedClientId ? rows.filter((row) => row.id === selectedClientId) : rows;
    const direction = sortDirection === "asc" ? 1 : -1;

    return [...filteredRows].sort((a, b) => {
      if (sortKey === "updated") {
        return (sortDate(a.updatedAt) - sortDate(b.updatedAt)) * direction;
      }

      const aValue =
        sortKey === "client"
          ? sortText(a.displayName)
          : sortKey === "aliases"
            ? sortText(a.aliases?.join(" "))
            : sortKey === "status"
              ? sortText(a.isActive === false ? "inactive" : "active")
              : "";

      const bValue =
        sortKey === "client"
          ? sortText(b.displayName)
          : sortKey === "aliases"
            ? sortText(b.aliases?.join(" "))
            : sortKey === "status"
              ? sortText(b.isActive === false ? "inactive" : "active")
              : "";

      return aValue.localeCompare(bValue) * direction;
    });
  }, [rows, selectedClientId, sortDirection, sortKey]);

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDirection === "asc" ? " ▲" : " ▼";
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  function sortableHeader(label: string, key: SortKey) {
    return (
      <button
        type="button"
        onClick={() => toggleSort(key)}
        style={{
          border: 0,
          background: "transparent",
          padding: 0,
          margin: 0,
          color: "inherit",
          font: "inherit",
          fontWeight: 800,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {label}
        {sortIndicator(key)}
      </button>
    );
  }

  return (
    <main style={pageStyle}>
      <BarshHeader />
      <div style={{ marginBottom: 18 }}>
        <Link href="/admin" style={{ color: "#00346e", fontWeight: 700, textDecoration: "none" }}>
          ← Admin
        </Link>
      </div>

      <section style={{ marginBottom: 22 }}>
        <div style={{ color: "#385a83", fontSize: 13, fontWeight: 700, textTransform: "uppercase" }}>
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

        <div style={{ marginTop: 12, color: error ? "#b91c1c" : "#385a83", fontWeight: 700 }}>
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
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
            <thead>
              <tr>
                <th style={thStyle}>{sortableHeader("Client", "client")}</th>
                <th style={thStyle}>{sortableHeader("Aliases", "aliases")}</th>
                <th style={thStyle}>{sortableHeader("Status", "status")}</th>
                <th style={thStyle}>{sortableHeader("Updated", "updated")}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  <td style={tdStyle}>
                    <Link
                      href={`/admin/clients/${encodeURIComponent(row.id)}`}
                      style={{ color: "#00346e", fontWeight: 800, textDecoration: "none" }}
                    >
                      {row.displayName || "(Unnamed client)"}
                    </Link>
                  </td>
                  <td style={{ ...tdStyle, maxWidth: 520, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {row.aliases?.length ? row.aliases.join(", ") : "—"}
                  </td>
                  <td style={tdStyle}>{statusBadge(row.isActive)}</td>
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
