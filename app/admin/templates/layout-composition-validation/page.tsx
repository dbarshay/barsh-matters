import { buildTemplateLayoutCompositionAdminReadinessPayload } from "../../../../src/lib/templates/layout-composition-admin-readiness.mjs";
import fixtureInput from "../../../../test/fixtures/templates/layout-composition-batch-validator-fixtures.json";

export const dynamic = "force-dynamic";

export default function TemplateLayoutCompositionValidationPage() {
  const payload = buildTemplateLayoutCompositionAdminReadinessPayload(fixtureInput);
  const errorSection = payload.sections.find((section) => section.id === "errors");
  const warningSection = payload.sections.find((section) => section.id === "warnings");
  const invalidSection = payload.sections.find((section) => section.id === "invalidTemplates");

  return (
    <main style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      <p style={{ margin: 0, color: "#475569", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase" }}>Admin / Templates</p>
      <h1 style={{ marginTop: "8px" }}>Layout Composition Validation</h1>
      <p>This read-only page validates template layout-composition metadata against the locked fixture source. It does not generate documents, upload files, mutate templates, or call external document-storage services.</p>
      <section aria-label="Validation summary" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", margin: "24px 0" }}>
        {payload.cards.map((card) => (
          <article key={card.id} style={{ border: "1px solid #cbd5e1", borderRadius: "10px", padding: "14px", background: "#fff" }}>
            <div style={{ color: "#475569", fontSize: "13px" }}>{card.title}</div>
            <div style={{ fontSize: "28px", fontWeight: 700 }}>{card.value}</div>
            <div style={{ color: card.severity === "error" ? "#b91c1c" : card.severity === "warning" ? "#92400e" : "#334155", fontSize: "12px" }}>{card.severity}</div>
          </article>
        ))}
      </section>
      <section>
        <h2>Invalid Templates</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={{ textAlign: "left", borderBottom: "1px solid #cbd5e1" }}>Template</th><th style={{ textAlign: "left", borderBottom: "1px solid #cbd5e1" }}>Kind</th><th style={{ textAlign: "left", borderBottom: "1px solid #cbd5e1" }}>Errors</th></tr></thead>
          <tbody>
            {(invalidSection?.rows || []).map((row: any) => (
              <tr key={row.templateId}><td style={{ padding: "8px 0" }}>{row.templateName}</td><td>{row.templateKind}</td><td>{row.errorCount}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2>Errors</h2>
        <ul>
          {(errorSection?.rows || []).map((row: any, index: number) => (
            <li key={`${row.templateId}-${row.code}-${index}`}>{row.templateId}: {row.code}{row.field ? ` (${row.field})` : ""}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Warnings</h2>
        <ul>
          {(warningSection?.rows || []).map((row: any, index: number) => (
            <li key={`${row.templateId}-${row.code}-${index}`}>{row.templateId}: {row.code}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Markdown Report</h2>
        <pre style={{ whiteSpace: "pre-wrap", border: "1px solid #cbd5e1", borderRadius: "10px", padding: "14px", background: "#f8fafc" }}>{payload.markdown}</pre>
      </section>
    </main>
  );
}
