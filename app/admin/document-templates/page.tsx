import BarshHeader from "@/app/components/BarshHeader";

export default function DocumentTemplatesPage() {
  return (
    <main style={{ padding: "32px 48px", color: "#1f2937" }}>
      <BarshHeader />
      <div style={{ maxWidth: "none", margin: 0 }}>
        <h1 style={{ margin: "0 0 16px", fontSize: "30px", fontWeight: 700, color: "#111827" }}>
          Document Templates
        </h1>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "18px",
            marginTop: "24px",
          }}
        >
          <a
            href="/admin/document-templates/build"
            style={{
              display: "block",
              padding: "22px",
              border: "1px solid #d1d5db",
              borderRadius: "12px",
              background: "#ffffff",
              color: "inherit",
              textDecoration: "none",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
            }}
          >
            <h2 style={{ margin: "0 0 8px", fontSize: "20px", color: "#111827" }}>
              Build Template
            </h2>
            <p style={{ margin: 0, lineHeight: 1.5, color: "#4b5563" }}>
              Browse and copy canonical merge fields for a fresh DOCX.
            </p>
          </a>

          <a
            href="/admin/document-templates/view"
            style={{
              display: "block",
              padding: "22px",
              border: "1px solid #d1d5db",
              borderRadius: "12px",
              background: "#ffffff",
              color: "inherit",
              textDecoration: "none",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
            }}
          >
            <h2 style={{ margin: "0 0 8px", fontSize: "20px", color: "#111827" }}>
              View Templates
            </h2>
            <p style={{ margin: 0, lineHeight: 1.5, color: "#4b5563" }}>
              Review template records and lifecycle status.
            </p>
          </a>
        </div>
      </div>
    </main>
  );
}
