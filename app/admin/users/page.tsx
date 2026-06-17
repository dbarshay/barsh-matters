"use client";

import { useEffect, useMemo, useState } from "react";

export default function AdminUsersPlanningPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/users/planning", { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => setData(json))
      .catch((err) => setError(err?.message || "Admin users planning lookup failed."));
  }, []);

  const roles = Array.isArray(data?.roles) ? data.roles : [];
  const users = Array.isArray(data?.users) ? data.users : [];
  const dbUsers = Array.isArray(data?.databasePreview?.users) ? data.databasePreview.users : [];
  const dbRoles = Array.isArray(data?.databasePreview?.roles) ? data.databasePreview.roles : [];
  const enforcementLabel = useMemo(() => (data?.enforcementEnabled ? "Yes" : "No"), [data?.enforcementEnabled]);

  return (
    <main data-barsh-admin-users-planning-page="read-only" style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", padding: 30, boxSizing: "border-box" }}>
      <div style={{ maxWidth: 1220, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 24, padding: 22 }}>
          <p style={{ margin: "0 0 8px", color: "#64748b", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", fontSize: 12 }}>Phase 2 Planning</p>
          <h1 style={{ margin: 0, fontSize: 30 }}>Admin Users / Roles</h1>
          <p style={{ margin: "10px 0 0", color: "#475569", lineHeight: 1.5 }}>Read-only planning surface for future administrator users, roles, and effective permission review. This page does not create users, edit roles, assign permissions, write database records, write Clio, or enable production enforcement.</p>
        </section>

        {error ? <section data-barsh-admin-users-planning-error="true" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 18, padding: 16 }}>{error}</section> : null}

        <section data-barsh-admin-users-planning-summary="true" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 22, padding: 18 }}>
          <strong>Mode:</strong> {data?.mode || "loading"} | <strong>Enforcement Enabled:</strong> {enforcementLabel} | <strong>Planning Roles:</strong> {roles.length} | <strong>Planning Users:</strong> {users.length} | <strong>DB Roles:</strong> {data?.databasePreview?.roleCount ?? 0} | <strong>DB Users:</strong> {data?.databasePreview?.userCount ?? 0}
        </section>

        <section data-barsh-admin-users-db-preview="read-only" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 22, padding: 18, overflowX: "auto" }}>
          <h2 style={{ marginTop: 0 }}>Database-Backed Preview</h2>
          <p style={{ color: "#475569" }}>Read-only preview of persisted admin users and roles. These records are not used for enforcement yet.</p>
          <h3>DB Users</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["Name", "Email", "Status", "Bootstrap Safe", "Roles", "Overrides"].map((header) => <th key={header} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #cbd5e1" }}>{header}</th>)}</tr></thead>
            <tbody>{dbUsers.length ? dbUsers.map((user: any) => <tr key={user.id}><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontWeight: 900 }}>{user.displayName || ""}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontFamily: "monospace" }}>{user.email}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{user.status}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{user.bootstrapSafe ? "Yes" : "No"}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{(user.roleKeys || []).join(", ") || "None"}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{(user.explicitOverrides || []).length}</td></tr>) : <tr><td colSpan={6} style={{ padding: 10, borderBottom: "1px solid #e5e7eb", color: "#64748b" }}>No persisted admin users yet.</td></tr>}</tbody>
          </table>
          <h3>DB Roles</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["Key", "Label", "Status", "System Role", "Permission Count"].map((header) => <th key={header} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #cbd5e1" }}>{header}</th>)}</tr></thead>
            <tbody>{dbRoles.length ? dbRoles.map((role: any) => <tr key={role.id}><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontFamily: "monospace", fontWeight: 900 }}>{role.key}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{role.label}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{role.status}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{role.systemRole ? "Yes" : "No"}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{(role.permissionKeys || []).length}</td></tr>) : <tr><td colSpan={5} style={{ padding: 10, borderBottom: "1px solid #e5e7eb", color: "#64748b" }}>No persisted admin roles yet.</td></tr>}</tbody>
          </table>
        </section>

        <section data-barsh-admin-users-planning-users="true" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 22, padding: 18, overflowX: "auto" }}>
          <h2 style={{ marginTop: 0 }}>Planned Users</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Name", "Email", "Roles", "Explicit Allow", "Explicit Block", "Effective Permissions", "Source"].map((header) => <th key={header} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #cbd5e1" }}>{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {users.map((user: any) => (
                <tr key={user.email}>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontWeight: 900 }}>{user.displayName}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontFamily: "monospace" }}>{user.email}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{(user.plannedRoles || []).join(", ")}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{(user.explicitAllow || []).join(", ") || "None"}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{(user.explicitBlock || []).join(", ") || "None"}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{user.effectivePermissionCount}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{user.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ color: "#475569" }}>Effective permissions are calculated for review only. They are not enforced and are not persisted.</p>
        </section>

        <section data-barsh-admin-users-planning-roles="true" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 22, padding: 18, overflowX: "auto" }}>
          <h2 style={{ marginTop: 0 }}>Planned Roles</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Role", "Description", "Write Capable", "Permission Count", "Permissions"].map((header) => <th key={header} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #cbd5e1" }}>{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {roles.map((role: any) => (
                <tr key={role.key}>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontFamily: "monospace", fontWeight: 900 }}>{role.label}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{role.description}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{role.writeCapable ? "Yes" : "No"}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{role.permissionCount}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontFamily: "monospace" }}>{(role.permissions || []).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
