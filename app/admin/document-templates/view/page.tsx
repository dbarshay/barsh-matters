"use client";

import { useMemo, useState } from "react";

const rows = [
  { name: "Initial Billing Letter", status: "Active", lastEdited: "Phase readiness sample", lastEditedBy: "System", defaultSignature: "User Selects" },
  { name: "VR Response", status: "Inactive", lastEdited: "Phase readiness sample", lastEditedBy: "System", defaultSignature: "Firm" },
  { name: "Legacy Demand Letter", status: "Archived", lastEdited: "Phase readiness sample", lastEditedBy: "System", defaultSignature: "User Selects" },
  { name: "Deleted Sample", status: "Deleted", lastEdited: "Phase readiness sample", lastEditedBy: "System", defaultSignature: "Firm" }
];

const filters = ["All", "Active", "Inactive", "Archived", "Deleted"];

export default function ViewTemplatesPage() {
  const [filter, setFilter] = useState("All");

  const visibleRows = useMemo(() => {
    if (filter === "All") return rows.filter((row) => row.status !== "Deleted");
    return rows.filter((row) => row.status === filter);
  }, [filter]);

  const actionsFor = (status: string) => {
    if (status === "Deleted") return ["Restore"];
    if (status === "Active") return ["Edit", "Deactivate", "Archive", "Delete"];
    if (status === "Inactive") return ["Edit", "Make Active", "Archive", "Delete"];
    return ["Edit", "Make Active", "Delete"];
  };

  return (
    <main style={{ padding: "32px", maxWidth: "1280px", margin: "0 auto" }}>
      <a href="/admin/document-templates" style={{ color: "#1e3a8a", fontWeight: 700 }}>Back to Document Templates</a>
      <h1 style={{ margin: "18px 0 10px", fontSize: "30px", color: "#0f172a" }}>View Templates</h1>
      <p style={{ margin: "0 0 22px", color: "#334155", lineHeight: 1.6 }}>
        Phase 1 locks the list, filter, lifecycle, and filename-visibility contract. The rows below are readiness samples, not production repository data.
      </p>

      <section style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "18px" }}>
        {filters.map((item) => (
          <button key={item} type="button" onClick={() => setFilter(item)} style={{ padding: "9px 14px", borderRadius: "999px", border: "1px solid #1e3a8a", background: filter === item ? "#1e3a8a" : "#ffffff", color: filter === item ? "#ffffff" : "#1e3a8a", fontWeight: 700 }}>
            {item}
          </button>
        ))}
      </section>

      <div style={{ overflowX: "auto", border: "1px solid #cbd5e1", borderRadius: "12px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#ffffff" }}>
          <thead style={{ background: "#1e3a8a", color: "#ffffff" }}>
            <tr>
              <th style={{ padding: "12px", textAlign: "left" }}>Name</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Status</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Last Edited</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Last Edited By</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Default Signature</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.name} style={{ borderTop: "1px solid #e2e8f0" }}>
                <td style={{ padding: "12px" }}>{row.name}</td>
                <td style={{ padding: "12px" }}>{row.status}</td>
                <td style={{ padding: "12px" }}>{row.lastEdited}</td>
                <td style={{ padding: "12px" }}>{row.lastEditedBy}</td>
                <td style={{ padding: "12px" }}>{row.defaultSignature}</td>
                <td style={{ padding: "12px" }}>{actionsFor(row.status).join(" · ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section style={{ marginTop: "18px", padding: "16px", borderRadius: "12px", border: "1px solid #fde68a", background: "#fffbeb", color: "#713f12", lineHeight: 1.55 }}>
        Status lifecycle actions are audit logged and move DOCX objects between BM cloud template namespaces. They do not update Last Edited or Last Edited By. Make Active requires a fresh token scan before activation. Make Active token scan readiness is defined in Phase 4 before production activation is wired. This screen reflects the templates.manage lifecycle contract for Phase 2 readiness.
      </section>
    
      <section style={{ marginTop: "18px", padding: "16px", borderRadius: "12px", border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#14532d", lineHeight: 1.55 }}>
        New templates default Inactive and will be hidden from matter-side Generate Documents until later activation logic is implemented and the template passes the required token scan.
      </section>
    </main>
  );
}
