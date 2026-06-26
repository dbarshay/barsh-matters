import { existsSync, readFileSync } from "node:fs";

const page = "app/admin/document-templates/page.tsx";
const failures = [];

if (!existsSync(page)) {
  failures.push("missing route page: " + page);
} else {
  const text = readFileSync(page, "utf8");
  const required = [
    "export default function DocumentTemplatesPage()",
    "Document Templates",
    "/admin/document-templates/build",
    "/admin/document-templates/view",
    "Build Template",
    "View Templates"
  ];
  const forbidden = [
    "Template Builder Phase 1 prepares",
    "This readiness surface is scoped",
    "Phase 1 readiness guardrails",
    "Required storage namespaces",
    "Template creation readiness gate",
    "Phase 5 confirms the app is ready",
    "No template creation or upload is wired yet"
  ];

  for (const snippet of required) {
    if (!text.includes(snippet)) failures.push("route page missing required snippet: " + snippet);
  }

  for (const phrase of forbidden) {
    if (text.includes(phrase)) failures.push("route page still contains forbidden readiness phrase: " + phrase);
  }
}

if (failures.length) {
  console.error("FAIL: Template Generation Phase 1F Document Templates page component verifier");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("PASS: Template Generation Phase 1F Document Templates page has valid default component without readiness copy");
