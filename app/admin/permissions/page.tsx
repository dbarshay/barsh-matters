"use client";

import BarshHeaderActions from "@/app/components/BarshHeaderActions";
import BarshHeaderQuickNav from "@/app/components/BarshHeaderQuickNav";
import { useEffect, useState } from "react";

export default function AdminPermissionsPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/admin/permissions", { cache: "no-store" }).then(r => r.json()).then(j => setData(j)).catch(e => setError(e?.message || "Permissions lookup failed.")); }, []);
  const permissions = Array.isArray(data?.permissions) ? data.permissions : [];
  const routes = Array.isArray(data?.routePermissions) ? data.routePermissions : [];
  return (
    <main data-barsh-admin-permissions-page="read-only" style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", padding: 30, boxSizing: "border-box" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}><BarshHeaderQuickNav /><BarshHeaderActions /></section>
        <header style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 22, padding: 20, boxShadow: "0 14px 32px rgba(15,23,42,.07)" }}>
          <div style={{ fontSize: 13, fontWeight: 950, color: "#4f46e5", textTransform: "uppercase", letterSpacing: ".08em" }}>Administrator</div>
          <h1 style={{ margin: "8px 0", fontSize: 32 }}>Permissions</h1>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.45 }}>Read-only permissions foundation. This page exposes permission definitions and route/function mappings. It does not create users, edit roles, block pages, block functions, modify records, write Clio, or enforce permission restrictions yet.</p>
        </header>
        {error ? <section data-barsh-admin-permissions-error="true" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 18, padding: 16 }}>{error}</section> : null}
        <section data-barsh-admin-permissions-summary="true" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 22, padding: 18 }}><strong>Mode:</strong> {data?.mode || "loading"} | <strong>Enforcement Enabled:</strong> {data?.enforcementEnabled ? "Yes" : "No"} | <strong>Permissions:</strong> {permissions.length} | <strong>Mappings:</strong> {routes.length}</section>
        <section data-barsh-admin-permissions-definitions="true" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 22, padding: 18, overflowX: "auto" }}><h2>Permission Definitions</h2><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><tbody>{permissions.map((p:any) => <tr key={p.key}><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontFamily: "monospace", fontWeight: 900 }}>{p.key}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{p.label}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{p.category}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{p.description}</td></tr>)}</tbody></table></section>
        <section data-barsh-admin-permissions-route-map="true" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 22, padding: 18, overflowX: "auto" }}><h2>Permission Override Config Preview</h2><p style={{ color: "#475569" }}>Environment key: BARSH_ADMIN_PERMISSION_OVERRIDES_JSON. Overrides are displayed for planning only and are not enforced yet.</p><pre data-barsh-admin-permissions-override-config="true" style={{ whiteSpace: "pre-wrap", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>{JSON.stringify(data?.overrideConfig || {}, null, 2)}</pre><h2>Route / Function Mapping</h2><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><tbody>{routes.map((r:any, i:number) => <tr key={i}><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontFamily: "monospace", fontWeight: 900 }}>{r.pattern}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{r.method || "ANY"}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontFamily: "monospace" }}>{r.permission}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>No</td></tr>)}</tbody></table></section>
        <section style={{ border: "1px solid #dbeafe", background: "#eff6ff", color: "#1e3a8a", borderRadius: 18, padding: 16 }}><strong>Safety:</strong> This page is read-only. Permission enforcement and user-configurable allow/block settings are deferred.</section>
        <a href="/admin" style={{ color: "#334155", fontWeight: 900, textDecoration: "none" }}>Back to Admin Home</a>
      </div>
    </main>
  );
}
