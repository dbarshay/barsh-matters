"use client";

import React from "react";
import BarshHeader from "@/app/components/BarshHeader";

// "Import OTHERS" landing: sources that aren't a Dow or Carisk spreadsheet. Two paths —
//   1) Create Matter Manually (hand-key a paper file or read a non-standard spreadsheet)
//   2) Other Spreadsheet (a future generic parser) — coming soon.

const NAVY = "#00346e";
const MUTED = "#385a83";

const cards = [
  {
    label: "Create Matter Manually",
    href: "/admin/matter/new",
    description: "Hand-key a single matter from a paper file or a non-Dow/Carisk spreadsheet. Controlled dropdowns, dedup check, mints the next BRL number.",
    icon: "✍️",
  },
  {
    label: "Other Spreadsheet",
    href: "/admin/import/other/spreadsheet",
    description: "Import a non-Dow/Carisk spreadsheet: map its columns to BM fields (auto-suggested), save the mapping, then preview, reconcile, and confirm.",
    icon: "📄",
  },
  {
    label: "Bulk Import",
    href: "/admin/import/other/bulk",
    description: "One-time bulk load of a very large closed-file spreadsheet (e.g. NF All Closed). Lenient carrier matching (records raw when unmatched), accident-key patient dedup, pre-2025 quarantine, and a -legacy tag.",
    icon: "📦",
  },
  {
    label: "Document OCR",
    href: "#",
    description: "Scan a document (usually a bill / claim form) and attempt to extract a matter from it — coming soon.",
    icon: "🖨️",
    comingSoon: true,
  },
];

export default function ImportOthersPage() {
  return (
    <main style={{ padding: "12px 14px 40px", background: "#f8fafc", minHeight: "100vh", color: NAVY, fontFamily: "Inter, system-ui, sans-serif" }}>
      <BarshHeader center={<div style={{ fontSize: 28, fontWeight: 950, color: "#fff" }}>Import — Other Sources</div>} />

      <div style={{ width: "100%", maxWidth: "100%", margin: 0, boxSizing: "border-box" }}>
        <div style={{ marginBottom: 12 }}>
          <a href="/admin" style={{ color: MUTED, fontWeight: 800, textDecoration: "none" }}>← Back to Admin Home</a>
        </div>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          {cards.map((c) => {
            const style: React.CSSProperties = {
              background: c.comingSoon ? "#f8fafc" : "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 22,
              padding: 20,
              textDecoration: "none",
              color: c.comingSoon ? "#94a3b8" : NAVY,
              boxShadow: c.comingSoon ? "none" : "0 14px 32px rgba(15, 23, 42, 0.07)",
              display: "grid",
              gap: 10,
              cursor: c.comingSoon ? "default" : "pointer",
            };
            const inner = (
              <>
                <div style={{ fontSize: 28, opacity: c.comingSoon ? 0.5 : 1 }}>{c.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 950 }}>{c.label}</div>
                <div style={{ color: c.comingSoon ? "#94a3b8" : MUTED, lineHeight: 1.45 }}>{c.description}</div>
                <div style={{ marginTop: 8, fontWeight: 950, color: c.comingSoon ? "#94a3b8" : NAVY }}>{c.comingSoon ? "Coming soon" : "Open →"}</div>
              </>
            );
            return c.comingSoon ? <div key={c.label} style={style}>{inner}</div> : <a key={c.label} href={c.href} style={style}>{inner}</a>;
          })}
        </section>
      </div>
    </main>
  );
}
