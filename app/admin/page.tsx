"use client";

import BarshHeaderQuickNav from "@/app/components/BarshHeaderQuickNav";
import BarshHeaderActions from "@/app/components/BarshHeaderActions";

import React, { useEffect, useState } from "react";

const adminCards = [
  {
    label: "Readiness Dashboard",
    href: "/admin/readiness-dashboard",
    description:
      "Single read-only dashboard for ClaimIndex, Lawsuit/master, and document-generation readiness audit status.",
    icon: "📊",
  },
  {
    label: "ClaimIndex Viewer",
    href: "/admin/claim-index",
    description:
      "Read-only audit/search view of the local ClaimIndex table for backup, restore, and data-confidence review.",
    icon: "🔎",
  },
  {
    label: "ClaimIndex Audit",
    href: "/admin/claim-index/audit",
    description:
      "Read-only data-quality and restore-confidence audit for local ClaimIndex identity, status, lawsuit grouping, and financial fields.",
    icon: "🧪",
  },
  {
    label: "Lawsuit / Master Audit",
    href: "/admin/lawsuits/audit",
    description:
      "Read-only restore-confidence audit for local Lawsuit/master metadata, child links, close status, and document-generation readiness.",
    icon: "⚖️",
  },
  {
    label: "Document Readiness Audit",
    href: "/admin/document-readiness/audit",
    description:
      "Read-only audit for document-generation readiness across local master metadata, child matter fields, templates, and final delivery prerequisites.",
    icon: "🧾",
  },
  {
    label: "Lawsuit Cleanup / Deaggregate",
    href: "/admin/lawsuit-cleanup",
    description:
      "Preview extra local lawsuits, child matter links, and mapped Clio document shells before any separately approved cleanup.",
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
    label: "Permissions",
    href: "/admin/permissions",
    description:
      "Read-only view of admin permission keys and route/function mappings before enforcement is enabled.",
    icon: "Permissions",
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
      "Read-only document-template repository view, including categories, repository source, versions, and merge fields.",
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
      await fetch("/api/auth/logout", { method: "POST" });
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
        color: "#0f172a",
        padding: "28px 30px 46px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gap: 18 }}>
        <section
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          <BarshHeaderQuickNav />
          <BarshHeaderActions />
        </section>
        <section data-barsh-admin-session-control="true" style={{ background: "#ffffff", border: "1px solid #dbeafe", borderRadius: 18, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)" }}>
          <div style={{ display: "grid", gap: 2 }}>
            <div style={{ fontSize: 12, fontWeight: 950, color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.08em" }}>Session</div>
            <div data-barsh-admin-session-status="true" style={{ fontWeight: 900, color: "#0f172a" }}>{adminSessionStatus}</div>
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
          <div style={{ fontSize: 13, fontWeight: 950, color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Administrator
          </div>
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1 }}>Admin Home</h1>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.45, maxWidth: 900 }}>
            Admin-only Barsh Matters functions.  This page is protected by the administrator gate and does not perform imports, writes, edits, uploads, document generation, printing, email, queueing, or Clio operations by itself.
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
                color: "#0f172a",
                boxShadow: "0 14px 32px rgba(15, 23, 42, 0.07)",
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ fontSize: 28 }}>{card.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 950 }}>{card.label}</div>
              <div style={{ color: "#475569", lineHeight: 1.45 }}>{card.description}</div>
              <div style={{ marginTop: 8, fontWeight: 950, color: "#4f46e5" }}>Open →</div>
            </a>
          ))}
        </section>

        <section
          style={{
            border: "1px solid #dbeafe",
            background: "#eff6ff",
            color: "#1e3a8a",
            borderRadius: 18,
            padding: 16,
            lineHeight: 1.45,
          }}
        >
          <strong>Safety:</strong> Admin routes are protected by the Barsh Matters administrator proxy gate.  Print Queue remains a separate header function and is not included in this Administrator page.
        </section>

        <div>
          <a href="/" style={{ color: "#334155", fontWeight: 900, textDecoration: "none" }}>
            ← Back to Barsh Matters
          </a>
        </div>
      </div>
    </main>
  );
}
