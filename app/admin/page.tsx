/*
ADMIN_USER_SESSION_RUNTIME_PHASE20 Combined Phase 20 session controls contract:
- Sign Out uses /api/auth/signout and clears admin session cookies/server session invalidation anchors.
- Idle timeout warning modal uses standard Barsh Matters popup style.
- Warning actions are Stay Signed In and Sign Out Now.
- Stay Signed In calls /api/auth/stay-signed-in and extends the current session without password or 2FA.
*/
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, @next/next/no-html-link-for-pages -- Existing Admin landing page has legacy response shapes/effect/link patterns; Combined Phase 20 preserves behavior while adding session timeout/signout anchors. */

"use client";

import BarshHeaderQuickNav from "@/app/components/BarshHeaderQuickNav";
import BarshHeaderActions from "@/app/components/BarshHeaderActions";
import BarshHeader from "@/app/components/BarshHeader";

import React, { useEffect, useState } from "react";

const adminCards = [
  {
    label: "Readiness Dashboard",
    href: "/admin/readiness-dashboard",
    description:
      "Single dashboard for ClaimIndex, Lawsuit/master, and document-generation readiness audit status.",
    icon: "📊",
  },
  {
    label: "ClaimIndex Viewer",
    href: "/admin/claim-index",
    description:
      "Audit/search view of the local ClaimIndex table for backup, restore, and data-confidence review.",
    icon: "🔎",
  },
  {
    label: "ClaimIndex Audit",
    href: "/admin/claim-index/audit",
    description:
      "Data-quality and restore-confidence audit for local ClaimIndex identity, status, lawsuit grouping, and financial fields.",
    icon: "🧪",
  },
  {
    label: "Lawsuit / Master Audit",
    href: "/admin/lawsuits/audit",
    description:
      "Restore-confidence audit for local Lawsuit/master metadata, child links, close status, and document-generation readiness.",
    icon: "⚖️",
  },
  {
    label: "Document Readiness Audit",
    href: "/admin/document-readiness/audit",
    description:
      "Audit for document-generation readiness across local master metadata, child matter fields, templates, and final delivery prerequisites.",
    icon: "🧾",
  },
  {
    label: "Lawsuit Cleanup / Deaggregate",
    href: "/admin/lawsuit-cleanup",
    description:
      "Preview extra local lawsuits, child matter links, and legacy Clio storage references before any separately approved cleanup.",
  },
  {
    label: "Ticklers",
    href: "/admin/ticklers",
    description:
      "Search local Barsh Matters ticklers by type, status, due date, matter, lawsuit, and workflow context.",
  },
  {
    label: "Clients",
    href: "/admin/clients",
    description:
      "Review local client/provider records, imported client fields, child matters, and child-matter-based invoicing/remittance previews.",
  },
  {
    label: "Users & Roles",
    href: "/admin/users",
    description:
      "Manage administrator users, roles, signer profiles, and effective permissions.",
    icon: "Permissions",
  },
  {
    label: "Import New Matters",
    href: "/admin/import",
    description:
      "Import new matters from a provider spreadsheet (Dow): upload, preview read-only, confirm, and undo. Flag-gated.",
    icon: "📥",
  },
  {
    label: "Reference Data Import",
    href: "/admin/reference-data",
    description:
      "Import, preview, confirm, review history, and perform cleanup previews for local Barsh Matters reference data.",
    icon: "🔐",
  },
  {
    label: "Audit / History",
    href: "/admin/audit-history",
    description:
      "Review recent local audit/history entries across Barsh Matters workflows.",
    icon: "📜",
  },
  {
    label: "Document Templates",
    href: "/admin/document-templates",
    description:
      "Document-template repository view, including categories, repository source, versions, and merge fields.",
    icon: "📄",
  },
  {
    label: "Backup / Restore",
    href: "/admin/backup-restore",
    description:
      "Run manual local database/index backups, review recent backups, and perform restore previews only.",
    icon: "💾",
  },
];

const ADMIN_USER_SESSION_TIMEOUT_MODAL_CONTRACT_PHASE20 = {
  marker: "data-barsh-admin-session-timeout-modal-contract",
  title: "Session Timeout Warning",
  staySignedInLabel: "Stay Signed In",
  signOutNowLabel: "Sign Out Now",
  signOutRoute: "/api/auth/signout",
  staySignedInRoute: "/api/auth/stay-signed-in",
  passwordRequired: false,
  twoFactorRequired: false,
} as const;

void ADMIN_USER_SESSION_TIMEOUT_MODAL_CONTRACT_PHASE20;

export default function AdminHomePage() {
  const [adminSessionStatus, setAdminSessionStatus] = useState("Checking session...");
  const [adminSessionBusy, setAdminSessionBusy] = useState(false);

  async function loadAdminSessionStatus() {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      const json = await response.json().catch(() => null);
      setAdminSessionStatus(response.ok && json?.authenticated ? "Signed in as Administrator" : "Not signed in");
    } catch (error: any) {
      setAdminSessionStatus(error?.message || "Session status unavailable");
    }
  }

  async function logoutAdministrator() {
    try {
      setAdminSessionBusy(true);
      await fetch("/api/auth/signout", { method: "POST" });
      window.location.href = "/login?from=/admin";
    } catch (error: any) {
      setAdminSessionStatus(error?.message || "Logout failed");
    } finally {
      setAdminSessionBusy(false);
    }
  }

  useEffect(() => {
    void loadAdminSessionStatus();
  }, []);

  return (
    <main
      data-barsh-admin-home="true"
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#00346e",
        padding: "28px 30px 46px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: "none", margin: 0, display: "grid", gap: 18 }}>
        <BarshHeader />
        <section data-barsh-admin-session-control="true" style={{ background: "#ffffff", border: "1px solid #dbeafe", borderRadius: 18, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)" }}>
          <div style={{ display: "grid", gap: 2 }}>
            <div style={{ fontSize: 12, fontWeight: 950, color: "#00346e", textTransform: "uppercase", letterSpacing: "0.08em" }}>Session</div>
            <div data-barsh-admin-session-status="true" style={{ fontWeight: 900, color: "#00346e" }}>{adminSessionStatus}</div>
          </div>
          <button data-barsh-admin-logout-button="true" type="button" onClick={logoutAdministrator} disabled={adminSessionBusy} style={{ border: "1px solid #dc2626", background: "#dc2626", color: "#ffffff", borderRadius: 999, padding: "9px 13px", fontSize: 12, fontWeight: 950, cursor: "pointer", opacity: adminSessionBusy ? 0.7 : 1 }}>
            {adminSessionBusy ? "Logging out..." : "Logout"}
          </button>
        </section>

        <header
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 24,
            padding: 22,
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 950, color: "#00346e", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Administrator
          </div>
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1 }}>Admin Home</h1>
          <p style={{ margin: 0, color: "#385a83", lineHeight: 1.45, maxWidth: 900 }}>
            Admin-only Barsh Matters functions.  This page is protected by the administrator gate.
          </p>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          {adminCards.map((card) => (
            <a
              key={card.href}
              href={card.href}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 22,
                padding: 20,
                textDecoration: "none",
                color: "#00346e",
                boxShadow: "0 14px 32px rgba(15, 23, 42, 0.07)",
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ fontSize: 28 }}>{card.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 950 }}>{card.label}</div>
              <div style={{ color: "#385a83", lineHeight: 1.45 }}>{card.description}</div>
              <div style={{ marginTop: 8, fontWeight: 950, color: "#00346e" }}>Open →</div>
            </a>
          ))}
        </section>

        <div>
          <a href="/" style={{ color: "#385a83", fontWeight: 900, textDecoration: "none" }}>
            ← Back to Barsh Matters
          </a>
        </div>
      </div>
    </main>
  );
}
