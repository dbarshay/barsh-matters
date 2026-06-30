"use client";

import BarshHeader from "@/app/components/BarshHeader";
import { useEffect, useMemo, useState } from "react";

// Displays the reworked permission model (see docs/permission-model.md):
// five tiers (view/edit/process/admin/security) and five roles derived from them.
// This page is a read-only model viewer + a planning simulator; it does not enforce.

type CatalogItem = {
  key: string;
  group: string;
  label: string;
  description: string;
  routeScopes: string[];
  functionScopes: string[];
  tier: string;
  enforcementStatus: string;
};

type CatalogData = { ok?: boolean; groups?: string[]; catalog?: CatalogItem[] };

type RoleSummary = {
  roleKey: string;
  label: string;
  allowedTiers: string[];
  allowedPermissionKeys: string[];
  blockedPermissionKeys: string[];
};

type MatrixRow = { roleKey: string; roleLabel: string; permissionKey: string; tier: string; decision: string };

type RoleMatrixData = { ok?: boolean; roleKeys?: string[]; roles?: RoleSummary[]; matrix?: MatrixRow[] };

const TIERS = ["view", "edit", "process", "admin", "security"] as const;

const TIER_DESCRIPTION: Record<string, string> = {
  view: "Read-only: open screens, view data, search.",
  edit: "Create/edit routine records and draft documents.",
  process: "Payments, settlement amounts, invoices, finalize documents, close/void matters/lawsuits/settlements.",
  admin: "General administrator functions (audits, backups, reference data, templates, ticklers, cleanup). Grantable per-user.",
  security: "Manage admin users, roles, permissions, and security. Owner only.",
};

const th: React.CSSProperties = { padding: 8, borderBottom: "1px solid #cbd5e1", textAlign: "left", fontSize: 12, color: "#334155", textTransform: "uppercase", letterSpacing: ".04em" };
const td: React.CSSProperties = { padding: 8, borderBottom: "1px solid #e5e7eb", verticalAlign: "top" };
const mono: React.CSSProperties = { ...td, fontFamily: "monospace", fontWeight: 800 };

function tierBadge(tier: string): React.CSSProperties {
  const base: React.CSSProperties = { display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "3px 9px", fontSize: 12, fontWeight: 800, border: "1px solid", whiteSpace: "nowrap" };
  if (tier === "view") return { ...base, background: "#e0f2fe", borderColor: "#7dd3fc", color: "#075985" };
  if (tier === "edit") return { ...base, background: "#dcfce7", borderColor: "#86efac", color: "#166534" };
  if (tier === "process") return { ...base, background: "#fef9c3", borderColor: "#fde68a", color: "#854d0e" };
  if (tier === "admin") return { ...base, background: "#ede9fe", borderColor: "#c4b5fd", color: "#5b21b6" };
  if (tier === "security") return { ...base, background: "#fee2e2", borderColor: "#fecaca", color: "#991b1b" };
  return { ...base, background: "#f1f5f9", borderColor: "#cbd5e1", color: "#334155" };
}

function decisionBadge(allowed: boolean): React.CSSProperties {
  const base: React.CSSProperties = { display: "inline-flex", borderRadius: 999, padding: "3px 9px", fontSize: 12, fontWeight: 800, border: "1px solid" };
  return allowed
    ? { ...base, background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }
    : { ...base, background: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" };
}

const cardStyle: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 18, padding: 18 };

export default function AdminPermissionsPage() {
  const [catalogData, setCatalogData] = useState<CatalogData | null>(null);
  const [roleData, setRoleData] = useState<RoleMatrixData | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [roleError, setRoleError] = useState("");
  const [simRole, setSimRole] = useState("view_only");
  const [simPermission, setSimPermission] = useState("matters.view");

  useEffect(() => {
    fetch("/api/admin/permissions/catalog", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setCatalogData(j))
      .catch((e) => setCatalogError(e?.message || "Permission catalog lookup failed."));
    fetch("/api/admin/permissions/role-matrix", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setRoleData(j))
      .catch((e) => setRoleError(e?.message || "Permission role matrix lookup failed."));
  }, []);

  const catalog = Array.isArray(catalogData?.catalog) ? catalogData!.catalog! : [];
  const groups = Array.isArray(catalogData?.groups) ? catalogData!.groups! : [];
  const roles = Array.isArray(roleData?.roles) ? roleData!.roles! : [];
  const matrix = Array.isArray(roleData?.matrix) ? roleData!.matrix! : [];

  const groupedCatalog = useMemo(() => groups.map((group) => ({ group, items: catalog.filter((item) => item.group === group) })), [groups, catalog]);
  const permissionOptions = catalog.map((item) => item.key);
  const roleOptions = roles.map((role) => role.roleKey);

  const simRow = matrix.find((row) => row.roleKey === simRole && row.permissionKey === simPermission) || null;
  const simAllowed = simRow ? simRow.decision === "allow" : false;
  const simTier = simRow?.tier || catalog.find((item) => item.key === simPermission)?.tier || "—";

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", padding: 30, boxSizing: "border-box" }}>
      <div style={{ maxWidth: "none", margin: 0, display: "grid", gap: 18 }}>
        <BarshHeader />

        <header style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#4f46e5", textTransform: "uppercase", letterSpacing: ".08em" }}>Administrator</div>
          <h1 style={{ margin: "8px 0", fontSize: 32 }}>Permissions</h1>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.45 }}>
            Five permission tiers and the five roles built from them. {catalog.length} permissions · {roles.length} roles.
          </p>
        </header>

        {catalogError ? <section style={{ ...cardStyle, background: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" }}>{catalogError}</section> : null}
        {roleError ? <section style={{ ...cardStyle, background: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" }}>{roleError}</section> : null}

        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Tiers</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr><th style={th}>Tier</th><th style={th}>Meaning</th></tr></thead>
            <tbody>
              {TIERS.map((tier) => (
                <tr key={tier}><td style={td}><span style={tierBadge(tier)}>{tier}</span></td><td style={td}>{TIER_DESCRIPTION[tier]}</td></tr>
              ))}
            </tbody>
          </table>
        </section>

        <section style={{ ...cardStyle, overflowX: "auto" }}>
          <h2 style={{ marginTop: 0 }}>Roles</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={th}>Role</th>
                {TIERS.map((tier) => <th key={tier} style={{ ...th, textAlign: "center" }}>{tier}</th>)}
                <th style={{ ...th, textAlign: "center" }}>Allowed</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.roleKey}>
                  <td style={{ ...td, fontWeight: 800 }}>{role.label} <span style={{ fontFamily: "monospace", color: "#94a3b8", fontWeight: 400 }}>{role.roleKey}</span></td>
                  {TIERS.map((tier) => {
                    const has = role.allowedTiers.includes(tier);
                    const grantedNote = tier === "admin" && role.roleKey === "administrator";
                    return <td key={tier} style={{ ...td, textAlign: "center", color: has ? "#166534" : "#cbd5e1", fontWeight: 800 }}>{has ? (grantedNote ? "granted" : "✓") : "–"}</td>;
                  })}
                  <td style={{ ...td, textAlign: "center", fontWeight: 800 }}>{role.allowedPermissionKeys.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ margin: "10px 0 0", color: "#64748b", fontSize: 12 }}>Administrator&apos;s admin functions are granted per-user. Security (manage users/roles/permissions) is Owner-only.</p>
        </section>

        <section style={{ ...cardStyle, overflowX: "auto" }}>
          <h2 style={{ marginTop: 0 }}>Permission catalog</h2>
          {groupedCatalog.map(({ group, items }) => (
            <div key={group} style={{ marginTop: 16 }}>
              <h3 style={{ marginBottom: 8 }}>{group}</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={th}>Key</th>
                    <th style={th}>Label</th>
                    <th style={th}>Tier</th>
                    <th style={th}>Route Scope</th>
                    <th style={th}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.key}>
                      <td style={mono}>{item.key}</td>
                      <td style={td}>{item.label}</td>
                      <td style={td}><span style={tierBadge(item.tier)}>{item.tier}</span></td>
                      <td style={{ ...td, fontFamily: "monospace" }}>{item.routeScopes.join(", ") || "—"}</td>
                      <td style={td}>{item.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>

        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Simulator</h2>
          <p style={{ margin: "0 0 12px", color: "#475569" }}>Check whether a role allows a permission under this model.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, alignItems: "end" }}>
            <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>Role
              <select value={simRole} onChange={(e) => setSimRole(e.target.value)} style={{ padding: 10, border: "1px solid #cbd5e1", borderRadius: 10 }}>
                {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>Permission
              <select value={simPermission} onChange={(e) => setSimPermission(e.target.value)} style={{ padding: 10, border: "1px solid #cbd5e1", borderRadius: 10 }}>
                {permissionOptions.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={tierBadge(simTier)}>{simTier}</span>
              <span style={decisionBadge(simAllowed)}>{simAllowed ? "ALLOW" : "BLOCK"}</span>
            </div>
          </div>
        </section>

        <a href="/admin" style={{ color: "#334155", fontWeight: 900, textDecoration: "none" }}>Back to Admin Home</a>
      </div>
    </main>
  );
}
