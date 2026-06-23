import { buildTemplateLayoutCompositionValidationReport } from "./layout-composition-validation-report.mjs";
import { buildTemplateFileReadinessReport } from "./template-file-readiness-report.mjs";

function statusFromReport(report) {
  if (report.ok) return "ready";
  if (report.summary.validTemplateCount > 0) return "needs-attention";
  return "blocked";
}

function card(id, title, value, severity) {
  return {
    id,
    title,
    value,
    severity,
  };
}

function findingRow(finding) {
  return {
    templateId: finding.templateId || "unknown-template",
    templateName: finding.templateName || "Unknown template",
    code: finding.code || "UNKNOWN",
    role: finding.role || null,
    assetKey: finding.assetKey || null,
    field: finding.field || null,
    message: finding.message || "",
  };
}

export function buildTemplateLayoutCompositionAdminReadinessPayload(input) {
  const report = buildTemplateLayoutCompositionValidationReport(input);
  const status = statusFromReport(report);

  const cards = [
    card("templates", "Templates", report.summary.templateCount, "info"),
    card("validTemplates", "Valid Templates", report.summary.validTemplateCount, report.summary.validTemplateCount === report.summary.templateCount ? "success" : "info"),
    card("invalidTemplates", "Invalid Templates", report.summary.invalidTemplateCount, report.summary.invalidTemplateCount > 0 ? "error" : "success"),
    card("errors", "Errors", report.summary.errorCount, report.summary.errorCount > 0 ? "error" : "success"),
    card("warnings", "Warnings", report.summary.warningCount, report.summary.warningCount > 0 ? "warning" : "success"),
  ];

  const sections = [
    {
      id: "summary",
      title: "Summary",
      rows: cards,
    },
    {
      id: "errorCodes",
      title: "Error Codes",
      rows: report.errorSummaryByCode.map((item) => ({
        code: item.code,
        count: item.count,
      })),
    },
    {
      id: "warningCodes",
      title: "Warning Codes",
      rows: report.warningSummaryByCode.map((item) => ({
        code: item.code,
        count: item.count,
      })),
    },
    {
      id: "invalidTemplates",
      title: "Invalid Templates",
      rows: report.invalidTemplates.map((item) => ({
        templateId: item.templateId,
        templateName: item.templateName,
        templateKind: item.templateKind,
        errorCount: item.errorCount,
        warningCount: item.warningCount,
      })),
    },
    {
      id: "errors",
      title: "Errors",
      rows: report.errors.map(findingRow),
    },
    {
      id: "warnings",
      title: "Warnings",
      rows: report.warnings.map(findingRow),
    },
  ];

  const registryForTemplateFileReadiness =
    input && typeof input === "object" && Array.isArray(input.templates)
      ? input
      : input && typeof input === "object" && input.registry
        ? input.registry
        : null;
  const templateFileReadiness = buildTemplateFileReadinessReport(registryForTemplateFileReadiness, {
    approvedTemplatePathPrefixes: ["templates/docx/", "templates/production/"],
    physicalFileExists: () => false,
    generatedAt: null,
  });

  return {
    templateFileReadiness,
    status,
    ok: report.ok,
    cards,
    sections,
    markdown: report.markdown,
    rawReport: report,
  };
}
