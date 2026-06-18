"use client";

import BarshHeaderActions from "@/app/components/BarshHeaderActions";
import BarshHeaderQuickNav from "@/app/components/BarshHeaderQuickNav";
import { useEffect, useMemo, useState } from "react";

type PermissionCatalogItem = {
  key: string;
  group: string;
  label: string;
  description: string;
  routeScopes: string[];
  functionScopes: string[];
  riskLevel: string;
  enforcementStatus: string;
};

type PermissionsData = {
  mode?: string;
  enforcementEnabled?: boolean;
  permissions?: any[];
  routePermissions?: any[];
  routeDryRun?: any[];
  overrideConfig?: any;
};

type CatalogData = {
  ok?: boolean;
  action?: string;
  phase?: string;
  enforcementScope?: string;
  runtimeEnforcementChanged?: boolean;
  catalogCount?: number;
  groups?: string[];
  catalog?: PermissionCatalogItem[];
};

type RoleMatrixRow = {
  roleKey: string;
  permissionKey: string;
  decision: string;
  reason: string;
  enforcementStatus: string;
};

type RoleMatrixData = {
  ok?: boolean;
  action?: string;
  phase?: string;
  enforcementScope?: string;
  runtimeEnforcementChanged?: boolean;
  matrixMode?: string;
  roles?: string[];
  rowCount?: number;
  matrix?: RoleMatrixRow[];
};

type UserPreviewRow = {
  id?: string;
  name?: string;
  email?: string;
  username?: string;
  displayName?: string;
  roleKey?: string;
  roles?: string[];
  locked?: boolean;
  lockout?: boolean;
  isLocked?: boolean;
};

const thStyle: React.CSSProperties = {
  padding: 8,
  borderBottom: "1px solid #cbd5e1",
  textAlign: "left",
  fontSize: 12,
  color: "#334155",
  textTransform: "uppercase",
  letterSpacing: ".04em",
};

const tdStyle: React.CSSProperties = {
  padding: 8,
  borderBottom: "1px solid #e5e7eb",
  verticalAlign: "top",
};

const monoCellStyle: React.CSSProperties = {
  ...tdStyle,
  fontFamily: "monospace",
  fontWeight: 900,
};

function listText(values: string[] | undefined) {
  return Array.isArray(values) && values.length ? values.join(", ") : "—";
}

function badgeStyle(value: string): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "3px 8px",
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid",
    whiteSpace: "nowrap",
  };

  if (value === "enforced-currently") return { ...base, background: "#dcfce7", borderColor: "#86efac", color: "#166534" };
  if (value === "planned-not-enforced") return { ...base, background: "#fef9c3", borderColor: "#fde68a", color: "#854d0e" };
  if (value === "never-block") return { ...base, background: "#e0f2fe", borderColor: "#7dd3fc", color: "#075985" };
  if (value === "financial" || value === "destructive" || value === "administrative") return { ...base, background: "#fee2e2", borderColor: "#fecaca", color: "#991b1b" };
  return { ...base, background: "#f1f5f9", borderColor: "#cbd5e1", color: "#334155" };
}

export default function AdminPermissionsPage() {
  const [data, setData] = useState<PermissionsData | null>(null);
  const [catalogData, setCatalogData] = useState<CatalogData | null>(null);
  const [roleMatrixData, setRoleMatrixData] = useState<RoleMatrixData | null>(null);
  const [userPreviewData, setUserPreviewData] = useState<any>(null);
  const [error, setError] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [roleMatrixError, setRoleMatrixError] = useState("");
  const [userPreviewError, setUserPreviewError] = useState("");
  const [blockedNotice, setBlockedNotice] = useState<{ blocked: boolean; from: string; permission: string }>({ blocked: false, from: "", permission: "" });
  const [simulatorRoleKey, setSimulatorRoleKey] = useState("read_only_admin");
  const [simulatorPermissionKey, setSimulatorPermissionKey] = useState("admin.home.view");
  const [simulatorRouteIndex, setSimulatorRouteIndex] = useState("0");
  const [userPreviewIndex, setUserPreviewIndex] = useState("0");

  useEffect(() => {
    fetch("/api/admin/permissions", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setData(j))
      .catch((e) => setError(e?.message || "Permissions lookup failed."));

    fetch("/api/admin/permissions/catalog", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setCatalogData(j))
      .catch((e) => setCatalogError(e?.message || "Permission catalog lookup failed."));

    fetch("/api/admin/permissions/role-matrix", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setRoleMatrixData(j))
      .catch((e) => setRoleMatrixError(e?.message || "Permission role matrix lookup failed."));

    fetch("/api/admin/users/planning", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setUserPreviewData(j))
      .catch((e) => setUserPreviewError(e?.message || "User preview lookup failed."));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setBlockedNotice({
      blocked: params.get("blocked") === "1",
      from: String(params.get("from") || "").trim(),
      permission: String(params.get("permission") || "").trim(),
    });
  }, []);

  const permissions = Array.isArray(data?.permissions) ? data.permissions : [];
  const routes = Array.isArray(data?.routePermissions) ? data.routePermissions : [];
  const catalog = Array.isArray(catalogData?.catalog) ? catalogData.catalog : [];
  const groups = Array.isArray(catalogData?.groups) ? catalogData.groups : [];
  const roleMatrix = Array.isArray(roleMatrixData?.matrix) ? roleMatrixData.matrix : [];
  const roleKeys = Array.isArray(roleMatrixData?.roles) ? roleMatrixData.roles : [];
  const userPreviewRows: UserPreviewRow[] = Array.isArray(userPreviewData?.users) ? userPreviewData.users : Array.isArray(userPreviewData?.rows) ? userPreviewData.rows : Array.isArray(userPreviewData?.adminUsers) ? userPreviewData.adminUsers : [];
  const groupedCatalog = useMemo(() => groups.map((group) => ({ group, items: catalog.filter((item) => item.group === group) })), [groups, catalog]);
  const groupedRoleMatrix = useMemo(() => roleKeys.map((roleKey) => ({ roleKey, rows: roleMatrix.filter((row) => row.roleKey === roleKey) })), [roleKeys, roleMatrix]);
  const simulatorRoleOptions = roleKeys.length ? roleKeys : ["owner_admin", "read_only_admin"];
  const simulatorPermissionOptions = catalog.length ? catalog.map((item: any) => item.key) : permissions.map((item: any) => item.key);
  const simulatorRow = roleMatrix.find((row: any) => row.roleKey === simulatorRoleKey && row.permissionKey === simulatorPermissionKey);
  const simulatorDecision = simulatorRow ? String(simulatorRow.decision || "").toLowerCase() : "";
  const simulatorReason = simulatorRow ? String(simulatorRow.reason || "") : "";
  const simulatorEnforcementStatus = simulatorRow ? String(simulatorRow.enforcementStatus || "") : "";
  const simulatorAllowed = simulatorRow ? !["block", "blocked", "deny", "denied", "false", "no"].includes(simulatorDecision) : simulatorRoleKey === "owner_admin";
  const simulatorRoute = routes[Number(simulatorRouteIndex)] || null;
  const simulatorRoutePermission = simulatorRoute ? String(simulatorRoute.permission || "") : "";
  const simulatorRouteMatrixRow = roleMatrix.find((row) => row.roleKey === simulatorRoleKey && row.permissionKey === simulatorRoutePermission);
  const simulatorRouteDecision = simulatorRouteMatrixRow ? String(simulatorRouteMatrixRow.decision || "").toLowerCase() : "";
  const simulatorRouteReason = simulatorRouteMatrixRow ? String(simulatorRouteMatrixRow.reason || "") : "";
  const simulatorRouteEnforcementStatus = simulatorRouteMatrixRow ? String(simulatorRouteMatrixRow.enforcementStatus || "") : "";
  const simulatorRouteAllowed = simulatorRouteMatrixRow ? !["block", "blocked", "deny", "denied", "false", "no"].includes(simulatorRouteDecision) : simulatorRoleKey === "owner_admin";
  const selectedUserPreview = userPreviewRows[Number(userPreviewIndex)] || null;
  const selectedUserRoles = selectedUserPreview ? (Array.isArray(selectedUserPreview.roles) ? selectedUserPreview.roles : selectedUserPreview.roleKey ? [selectedUserPreview.roleKey] : []) : [];
  const selectedUserPrimaryRole = selectedUserRoles[0] || "unassigned";
  const selectedUserPermissionRows = roleMatrix.filter((row) => selectedUserRoles.includes(row.roleKey));
  const selectedUserAllowedCount = selectedUserPermissionRows.filter((row) => !["block", "blocked", "deny", "denied", "false", "no"].includes(String(row.decision || "").toLowerCase())).length;
  const selectedUserBlockedCount = selectedUserPermissionRows.length - selectedUserAllowedCount;
  const selectedUserRouteRows = roleMatrix.filter((row) => selectedUserRoles.includes(row.roleKey) && row.permissionKey === simulatorRoutePermission);
  const selectedUserRouteBlocked = selectedUserRouteRows.some((row) => ["block", "blocked", "deny", "denied", "false", "no"].includes(String(row.decision || "").toLowerCase()));
  const selectedUserRouteAllowed = selectedUserRouteRows.length ? !selectedUserRouteBlocked : selectedUserPrimaryRole === "owner_admin";
  const selectedUserRouteDecision = selectedUserRouteRows.length ? (selectedUserRouteAllowed ? "allow" : "block") : "unmapped";
  const blockedRouteLabel = useMemo(() => blockedNotice.from || "the requested administrator page", [blockedNotice.from]);
  const blockedPermissionLabel = useMemo(() => blockedNotice.permission || "the mapped administrator permission", [blockedNotice.permission]);

  return (
    <main data-barsh-admin-permissions-page="read-only" style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", padding: 30, boxSizing: "border-box" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <BarshHeaderQuickNav />
          <BarshHeaderActions />
        </section>

        <header style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 22, padding: 20, boxShadow: "0 14px 32px rgba(15,23,42,.07)" }}>
          <div style={{ fontSize: 13, fontWeight: 950, color: "#4f46e5", textTransform: "uppercase", letterSpacing: ".08em" }}>Administrator</div>
          <h1 style={{ margin: "8px 0", fontSize: 32 }}>Permissions</h1>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.45 }}>Read-only permissions foundation. This page exposes permission definitions, the Phase 15 static permission catalog, and route/function mappings. It does not create users, edit roles, block pages, block functions, modify records, write Clio, or broaden permission restrictions.</p>
        </header>

        {error ? <section data-barsh-admin-permissions-error="true" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 18, padding: 16 }}>{error}</section> : null}
        {catalogError ? <section data-barsh-admin-permissions-catalog-error="true" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 18, padding: 16 }}>{catalogError}</section> : null}
        {roleMatrixError ? <section data-barsh-admin-permissions-role-matrix-error="true" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 18, padding: 16 }}>{roleMatrixError}</section> : null}
        {userPreviewError ? <section data-barsh-admin-permissions-user-preview-error="true" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 18, padding: 16 }}>{userPreviewError}</section> : null}

        {blockedNotice.blocked ? (
          <section data-barsh-admin-permissions-blocked-notice="true" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 18, padding: 16, lineHeight: 1.5 }}>
            <strong>Access blocked:</strong> {blockedRouteLabel} is currently blocked by administrator permission settings. <span style={{ fontFamily: "monospace", fontWeight: 900 }}>Permission: {blockedPermissionLabel}</span>. This safety page remains available so permissions can be reviewed without locking out the administrator.
          </section>
        ) : null}

        <section data-barsh-admin-permissions-summary="true" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 22, padding: 18 }}>
          <strong>Mode:</strong> {data?.mode || "loading"} | <strong>Enforcement Enabled:</strong> {data?.enforcementEnabled ? "Yes" : "No"} | <strong>Legacy Definitions:</strong> {permissions.length} | <strong>Mappings:</strong> {routes.length} | <strong>Static Catalog:</strong> {catalogData?.catalogCount ?? catalog.length} | <strong>Catalog Scope:</strong> {catalogData?.enforcementScope || "loading"} | <strong>Role Matrix:</strong> {roleMatrixData?.rowCount ?? roleMatrix.length} | <strong>Matrix Mode:</strong> {roleMatrixData?.matrixMode || "loading"}
        </section>

        <section data-barsh-admin-permissions-static-catalog="true" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 22, padding: 18, overflowX: "auto" }}>
          <h2 style={{ marginTop: 0 }}>Static Permission Catalog</h2>
          <p style={{ color: "#475569" }}>Phase 15D read-only catalog display. Catalog entries are metadata only unless a later enforcement phase explicitly activates them. Runtime enforcement remains <strong>admin-functions-only</strong>.</p>
          <div data-barsh-admin-permissions-catalog-runtime-flag="true" style={{ border: "1px solid #dbeafe", background: "#eff6ff", color: "#1e3a8a", borderRadius: 14, padding: 12, marginBottom: 14 }}>
            <strong>Runtime Enforcement Changed:</strong> {catalogData?.runtimeEnforcementChanged ? "Yes" : "No"} | <strong>Phase:</strong> {catalogData?.phase || "15C/15D"} | <strong>Endpoint:</strong> /api/admin/permissions/catalog
          </div>
          {groupedCatalog.map(({ group, items }) => (
            <div key={group} data-barsh-admin-permissions-catalog-group={group} style={{ marginTop: 18 }}>
              <h3 style={{ marginBottom: 8 }}>{group}</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Key</th>
                    <th style={thStyle}>Label</th>
                    <th style={thStyle}>Risk</th>
                    <th style={thStyle}>Enforcement</th>
                    <th style={thStyle}>Route Scope</th>
                    <th style={thStyle}>Function Scope</th>
                    <th style={thStyle}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.key} data-barsh-admin-permissions-catalog-key={item.key}>
                      <td style={monoCellStyle}>{item.key}</td>
                      <td style={tdStyle}>{item.label}</td>
                      <td style={tdStyle}><span style={badgeStyle(item.riskLevel)}>{item.riskLevel}</span></td>
                      <td style={tdStyle}><span style={badgeStyle(item.enforcementStatus)}>{item.enforcementStatus}</span></td>
                      <td style={{ ...tdStyle, fontFamily: "monospace" }}>{listText(item.routeScopes)}</td>
                      <td style={{ ...tdStyle, fontFamily: "monospace" }}>{listText(item.functionScopes)}</td>
                      <td style={tdStyle}>{item.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>

        <section data-barsh-admin-permissions-simulator="read-only" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 22, padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Phase 16A Permission Simulator</h2>
          <p style={{ color: "#475569", lineHeight: 1.45 }}>Read-only simulator. It evaluates the Phase 15 static role matrix for planning visibility only. It does not save settings, edit roles, change users, enable runtime enforcement, block pages, block API routes, write Clio, or modify records.</p>
          <div data-barsh-admin-permissions-simulator-runtime-flag="true" style={{ border: "1px solid #dbeafe", background: "#eff6ff", color: "#1e3a8a", borderRadius: 14, padding: 12, marginBottom: 14 }}>
            <strong>Runtime Enforcement Changed:</strong> No | <strong>Simulator Mode:</strong> read-only | <strong>Source:</strong> Phase 15 static role matrix
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, alignItems: "end" }}>
            <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>Role
              <select data-barsh-admin-permissions-simulator-role="true" value={simulatorRoleKey} onChange={(event) => setSimulatorRoleKey(event.target.value)} style={{ padding: 10, border: "1px solid #cbd5e1", borderRadius: 10 }}>
                {simulatorRoleOptions.map((roleKey: string) => <option key={roleKey} value={roleKey}>{roleKey}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>Permission
              <select data-barsh-admin-permissions-simulator-permission="true" value={simulatorPermissionKey} onChange={(event) => setSimulatorPermissionKey(event.target.value)} style={{ padding: 10, border: "1px solid #cbd5e1", borderRadius: 10 }}>
                {simulatorPermissionOptions.map((permissionKey: string) => <option key={permissionKey} value={permissionKey}>{permissionKey}</option>)}
              </select>
            </label>
            <div data-barsh-admin-permissions-simulator-result="true" style={{ border: simulatorAllowed ? "1px solid #bbf7d0" : "1px solid #fecaca", background: simulatorAllowed ? "#f0fdf4" : "#fef2f2", color: simulatorAllowed ? "#166534" : "#991b1b", borderRadius: 14, padding: 12, fontWeight: 950 }}>
              Simulated Result: {simulatorAllowed ? "ALLOW" : "BLOCK"}
            </div>
          </div>
          <div data-barsh-admin-permissions-simulator-diagnostics="true" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 14 }}>
            <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 }}><strong>Decision:</strong> {simulatorDecision || "unmapped"}</div>
            <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 }}><strong>Reason:</strong> {simulatorReason || "No matching matrix row"}</div>
            <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 }}><strong>Enforcement Status:</strong> {simulatorEnforcementStatus || "planning-only"}</div>
          </div>
          <pre data-barsh-admin-permissions-simulator-row="true" style={{ whiteSpace: "pre-wrap", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, marginTop: 14 }}>{JSON.stringify({ roleKey: simulatorRoleKey, permissionKey: simulatorPermissionKey, decision: simulatorDecision || "unmapped", reason: simulatorReason || "No matching matrix row", enforcementStatus: simulatorEnforcementStatus || "planning-only", allowed: simulatorAllowed, matchedMatrixRow: simulatorRow || null, runtimeEnforcementChanged: false }, null, 2)}</pre>
          <div data-barsh-admin-permissions-route-simulator="read-only" style={{ borderTop: "1px solid #e5e7eb", marginTop: 16, paddingTop: 16 }}>
            <h3 style={{ margin: "0 0 8px" }}>Route / Function Simulator</h3>
            <p style={{ color: "#475569", lineHeight: 1.45, marginTop: 0 }}>Read-only route simulation. It maps the selected route/function to its permission key and evaluates that key against the selected role. It does not enforce, save, or modify anything.</p>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) minmax(180px, 260px)", gap: 12, alignItems: "end" }}>
              <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>Route / Function
                <select data-barsh-admin-permissions-route-simulator-route="true" value={simulatorRouteIndex} onChange={(event) => setSimulatorRouteIndex(event.target.value)} style={{ padding: 10, border: "1px solid #cbd5e1", borderRadius: 10 }}>
                  {routes.map((route: any, index: number) => <option key={`${route.pattern || "route"}:${route.method || "ANY"}:${index}`} value={String(index)}>{`${route.method || "ANY"} ${route.pattern || "(unmapped route)"} → ${route.permission || "(no permission)"}`}</option>)}
                </select>
              </label>
              <div data-barsh-admin-permissions-route-simulator-result="true" style={{ border: simulatorRouteAllowed ? "1px solid #bbf7d0" : "1px solid #fecaca", background: simulatorRouteAllowed ? "#f0fdf4" : "#fef2f2", color: simulatorRouteAllowed ? "#166534" : "#991b1b", borderRadius: 14, padding: 12, fontWeight: 950 }}>
                Route Result: {simulatorRouteAllowed ? "ALLOW" : "BLOCK"}
              </div>
            </div>
            <div data-barsh-admin-permissions-route-simulator-diagnostics="true" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 14 }}>
              <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 }}><strong>Decision:</strong> {simulatorRouteDecision || "unmapped"}</div>
              <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 }}><strong>Reason:</strong> {simulatorRouteReason || "No matching matrix row"}</div>
              <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 }}><strong>Enforcement Status:</strong> {simulatorRouteEnforcementStatus || "planning-only"}</div>
            </div>
            <pre data-barsh-admin-permissions-route-simulator-row="true" style={{ whiteSpace: "pre-wrap", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, marginTop: 14 }}>{JSON.stringify({ roleKey: simulatorRoleKey, route: simulatorRoute ? { pattern: simulatorRoute.pattern || "", method: simulatorRoute.method || "ANY", permission: simulatorRoutePermission } : null, decision: simulatorRouteDecision || "unmapped", reason: simulatorRouteReason || "No matching matrix row", enforcementStatus: simulatorRouteEnforcementStatus || "planning-only", allowed: simulatorRouteAllowed, matchedMatrixRow: simulatorRouteMatrixRow || null, runtimeEnforcementChanged: false }, null, 2)}</pre>
          </div>
        </section>

        <section data-barsh-admin-permissions-user-effective-preview="read-only" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 22, padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Phase 17A User Effective-Permission Preview</h2>
          <p style={{ color: "#475569", lineHeight: 1.45 }}>Read-only planning preview. This combines the selected user's assigned role keys with the Phase 15 static role matrix. It does not assign roles, remove roles, edit overrides, lock users, enable enforcement, block pages, block API routes, or modify records.</p>
          <div data-barsh-admin-permissions-user-effective-runtime-flag="true" style={{ border: "1px solid #dbeafe", background: "#eff6ff", color: "#1e3a8a", borderRadius: 14, padding: 12, marginBottom: 14 }}>
            <strong>Runtime Enforcement Changed:</strong> No | <strong>Preview Mode:</strong> read-only | <strong>Source:</strong> /api/admin/users/planning + Phase 15 static role matrix
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) repeat(auto-fit, minmax(160px, 220px))", gap: 12, alignItems: "end" }}>
            <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>User
              <select data-barsh-admin-permissions-user-effective-select="true" value={userPreviewIndex} onChange={(event) => setUserPreviewIndex(event.target.value)} style={{ padding: 10, border: "1px solid #cbd5e1", borderRadius: 10 }}>
                {userPreviewRows.map((user: UserPreviewRow, index: number) => <option key={`${user.id || user.username || user.email || "user"}:${index}`} value={String(index)}>{user.displayName || user.name || user.username || user.email || `User ${index + 1}`}</option>)}
              </select>
            </label>
            <div data-barsh-admin-permissions-user-effective-role="true" style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 }}><strong>Primary Role:</strong> {selectedUserPrimaryRole}</div>
            <div data-barsh-admin-permissions-user-effective-counts="true" style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 }}><strong>Allow:</strong> {selectedUserAllowedCount} | <strong>Block:</strong> {selectedUserBlockedCount}</div>
          </div>
          <div data-barsh-admin-permissions-user-route-effective-preview="read-only" style={{ borderTop: "1px solid #e5e7eb", marginTop: 16, paddingTop: 16 }}>
            <h3 style={{ margin: "0 0 8px" }}>Selected User Route / Function Preview</h3>
            <p style={{ color: "#475569", lineHeight: 1.45, marginTop: 0 }}>Read-only preview using the selected user, selected route/function from the simulator above, and the Phase 15 static role matrix. It does not write, enforce, or change user permissions.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              <div data-barsh-admin-permissions-user-route-effective-route="true" style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 }}><strong>Route Permission:</strong> {simulatorRoutePermission || "unmapped"}</div>
              <div data-barsh-admin-permissions-user-route-effective-result="true" style={{ border: selectedUserRouteAllowed ? "1px solid #bbf7d0" : "1px solid #fecaca", background: selectedUserRouteAllowed ? "#f0fdf4" : "#fef2f2", color: selectedUserRouteAllowed ? "#166534" : "#991b1b", borderRadius: 12, padding: 10, fontWeight: 950 }}>User Route Result: {selectedUserRouteAllowed ? "ALLOW" : "BLOCK"}</div>
              <div data-barsh-admin-permissions-user-route-effective-decision="true" style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 }}><strong>Decision:</strong> {selectedUserRouteDecision}</div>
            </div>
            <pre data-barsh-admin-permissions-user-route-effective-json="true" style={{ whiteSpace: "pre-wrap", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, marginTop: 14 }}>{JSON.stringify({ selectedUser: selectedUserPreview ? { id: selectedUserPreview.id || "", name: selectedUserPreview.displayName || selectedUserPreview.name || "", username: selectedUserPreview.username || "", emailPresent: Boolean(selectedUserPreview.email), locked: Boolean(selectedUserPreview.locked || selectedUserPreview.lockout || selectedUserPreview.isLocked), roles: selectedUserRoles } : null, route: simulatorRoute ? { pattern: simulatorRoute.pattern || "", method: simulatorRoute.method || "ANY", permission: simulatorRoutePermission } : null, decision: selectedUserRouteDecision, allowed: selectedUserRouteAllowed, matchedMatrixRows: selectedUserRouteRows, runtimeEnforcementChanged: false }, null, 2)}</pre>
          </div>
          <pre data-barsh-admin-permissions-user-effective-json="true" style={{ whiteSpace: "pre-wrap", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, marginTop: 14 }}>{JSON.stringify({ selectedUser: selectedUserPreview ? { id: selectedUserPreview.id || "", name: selectedUserPreview.displayName || selectedUserPreview.name || "", username: selectedUserPreview.username || "", emailPresent: Boolean(selectedUserPreview.email), locked: Boolean(selectedUserPreview.locked || selectedUserPreview.lockout || selectedUserPreview.isLocked), roles: selectedUserRoles } : null, allowedCount: selectedUserAllowedCount, blockedCount: selectedUserBlockedCount, matrixRows: selectedUserPermissionRows, runtimeEnforcementChanged: false }, null, 2)}</pre>
        </section>

        <section data-barsh-admin-permissions-role-matrix="true" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 22, padding: 18, overflowX: "auto" }}>
          <h2 style={{ marginTop: 0 }}>Static Role Permission Matrix</h2>
          <p style={{ color: "#475569" }}>Phase 15E planning-only role matrix. These rows describe the intended owner_admin and read_only_admin baseline. Runtime enforcement remains <strong>admin-functions-only</strong>.</p>
          <div data-barsh-admin-permissions-role-matrix-runtime-flag="true" style={{ border: "1px solid #dbeafe", background: "#eff6ff", color: "#1e3a8a", borderRadius: 14, padding: 12, marginBottom: 14 }}>
            <strong>Runtime Enforcement Changed:</strong> {roleMatrixData?.runtimeEnforcementChanged ? "Yes" : "No"} | <strong>Matrix Mode:</strong> {roleMatrixData?.matrixMode || "planning-only"} | <strong>Endpoint:</strong> /api/admin/permissions/role-matrix
          </div>
          {groupedRoleMatrix.map(({ roleKey, rows }) => (
            <div key={roleKey} data-barsh-admin-permissions-role-matrix-role={roleKey} style={{ marginTop: 18 }}>
              <h3 style={{ marginBottom: 8 }}>{roleKey}</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Permission</th>
                    <th style={thStyle}>Decision</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.roleKey}:${row.permissionKey}`} data-barsh-admin-permissions-role-matrix-key={`${row.roleKey}:${row.permissionKey}`}>
                      <td style={monoCellStyle}>{row.permissionKey}</td>
                      <td style={tdStyle}><span style={badgeStyle(row.decision)}>{row.decision}</span></td>
                      <td style={tdStyle}><span style={badgeStyle(row.enforcementStatus)}>{row.enforcementStatus}</span></td>
                      <td style={tdStyle}>{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>

        <section data-barsh-admin-permissions-definitions="true" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 22, padding: 18, overflowX: "auto" }}>
          <h2>Dry-Run Decisions</h2>
          <p style={{ color: "#475569" }}>Dry-run only: these rows show what the current override config would allow or block if enforcement were later enabled. No enforcement is active now.</p>
          <pre data-barsh-admin-permissions-dry-run="true" style={{ whiteSpace: "pre-wrap", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>{JSON.stringify(data?.routeDryRun || [], null, 2)}</pre>
          <h2>Legacy Permission Definitions</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>{permissions.map((p: any) => <tr key={p.key}><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontFamily: "monospace", fontWeight: 900 }}>{p.key}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{p.label}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{p.category}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{p.description}</td></tr>)}</tbody>
          </table>
        </section>

        <section data-barsh-admin-permissions-route-map="true" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 22, padding: 18, overflowX: "auto" }}>
          <h2>Permission Override Config Preview</h2>
          <p style={{ color: "#475569" }}>Environment key shown for planning: BARSH_ADMIN_PERMISSION_OVERRIDES_JSON. Enforcement activation is deferred to a later explicit phase and is not available from this read-only page. Overrides are displayed for planning only and are not enforced yet.</p>
          <pre data-barsh-admin-permissions-override-config="true" style={{ whiteSpace: "pre-wrap", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>{JSON.stringify(data?.overrideConfig || {}, null, 2)}</pre>
          <h2>Route / Function Mapping</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>{routes.map((r: any, i: number) => <tr key={i}><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontFamily: "monospace", fontWeight: 900 }}>{r.pattern}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{r.method || "ANY"}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontFamily: "monospace" }}>{r.permission}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>No</td></tr>)}</tbody>
          </table>
        </section>

        <section style={{ border: "1px solid #dbeafe", background: "#eff6ff", color: "#1e3a8a", borderRadius: 18, padding: 16 }}><strong>Safety:</strong> This page is read-only. Permission enforcement and user-configurable allow/block settings are deferred.</section>
        <a href="/admin" style={{ color: "#334155", fontWeight: 900, textDecoration: "none" }}>Back to Admin Home</a>
      </div>
    </main>
  );
}
