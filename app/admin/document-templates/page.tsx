export default function DocumentTemplatesPage() {
  return (
    <main style={{ padding: "32px", maxWidth: "1120px", margin: "0 auto" }}>
      <p style={{ margin: "0 0 8px", color: "#475569", fontSize: "14px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        Admin
      </p>
      <h1 style={{ margin: "0 0 12px", fontSize: "32px", color: "#0f172a" }}>Document Templates</h1>
      <p style={{ margin: "0 0 28px", color: "#334155", lineHeight: 1.6 }}>
        Template Builder Phase 1 prepares the admin UI and BM cloud repository foundation. Templates are stored in BM cloud storage only, never in Clio. This readiness surface is scoped to templates.manage and does not wire production document generation.
      </p>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "18px" }}>
        <a href="/admin/document-templates/build" style={{ display: "block", padding: "22px", border: "1px solid #cbd5e1", borderRadius: "14px", background: "#ffffff", color: "#0f172a", textDecoration: "none" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: "22px" }}>Build Template</h2>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.55 }}>
            Search canonical merge fields, review example output, inspect signature and header usage notes, and prepare custom manual placeholders.
          </p>
        </a>

        <a href="/admin/document-templates/view" style={{ display: "block", padding: "22px", border: "1px solid #cbd5e1", borderRadius: "14px", background: "#ffffff", color: "#0f172a", textDecoration: "none" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: "22px" }}>View Templates</h2>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.55 }}>
            Review the template repository lifecycle contract for Active, Inactive, Archived, and Deleted templates.
          </p>
        </a>
      </section>

      <section style={{ marginTop: "28px", padding: "18px", border: "1px solid #bfdbfe", borderRadius: "12px", background: "#eff6ff" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: "18px", color: "#1e3a8a" }}>Phase 1 readiness guardrails</h2>
        <p style={{ margin: 0, color: "#1e293b", lineHeight: 1.55 }}>
          Required storage namespaces: templates/active/, templates/inactive/, templates/archived/, and templates/deleted/. Internal filenames and storage paths remain hidden from routine UI views. Phase 2 centralizes this lifecycle contract under templates.manage for later route-level enforcement.
        </p>
      </section>
    
      <section style={{ marginTop: "18px", padding: "18px", border: "1px solid #bbf7d0", borderRadius: "12px", background: "#f0fdf4" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: "18px", color: "#166534" }}>Template creation readiness gate</h2>
        <p style={{ margin: 0, color: "#14532d", lineHeight: 1.55 }}>
          Phase 5 confirms the app is ready for the next implementation step: Create Template with BM display name, DOCX picker, default signature mode, DOCX-only validation, duplicate filename check across all template folders, token scan before save, and storage under templates/inactive/. No template creation or upload is wired yet.
        </p>
      </section>
    </main>
  );
}
