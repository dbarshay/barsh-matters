import { existsSync, readFileSync } from "node:fs";

const component = "components/templates/TemplateDocxCompatibilityUpload.tsx";
const buildPage = "app/admin/document-templates/build/page.tsx";
const failures = [];

function requireFile(path) {
  if (existsSync(path) === false) {
    failures.push("missing file: " + path);
    return "";
  }
  return readFileSync(path, "utf8");
}

const componentText = requireFile(component);
const buildPageText = requireFile(buildPage);

const componentRequired = [
  "Upload Template",
  "Choose DOCX",
  "Drop DOCX here",
  "scanDocx",
  "parseZip",
  "word/document.xml",
  "header",
  "footer",
  ".xml",
  "pageTokens",
  "data-template-merge-field-token",
  "DOCX is readable",
  "not currently visible in the Template Builder canonical field table",
  "Checking DOCX compatibility locally in this browser."
];

const pageRequired = [
  "TemplateDocxCompatibilityUpload",
  "<TemplateDocxCompatibilityUpload />"
];

const pageTokenAttributeOptions = [
  "data-template-merge-field-token={token}",
  "data-template-merge-field-token={field.token}"
];

const forbiddenComponentSnippets = [
  "fetch(",
  "axios",
  "FormData",
  "XMLHttpRequest",
  "/api/",
  "clio",
  "Clio",
  "Microsoft Graph",
  "graph.microsoft",
  "templates/inactive/",
  "print",
  "queue"
];

for (const snippet of componentRequired) {
  if (componentText.includes(snippet) === false) failures.push("component missing snippet: " + snippet);
}

for (const snippet of pageRequired) {
  if (buildPageText.includes(snippet) === false) failures.push("build page missing snippet: " + snippet);
}

if (pageTokenAttributeOptions.some((snippet) => buildPageText.includes(snippet)) === false) {
  failures.push("build page missing token data attribute on merge-field token code cell");
}

for (const snippet of forbiddenComponentSnippets) {
  if (componentText.includes(snippet)) failures.push("component contains forbidden non-local behavior or reference: " + snippet);
}

if (failures.length > 0) {
  console.error("FAIL: Template Generation Phase 1G local-only DOCX compatibility upload verifier");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("PASS: Template Generation Phase 1G local-only DOCX compatibility upload verified");
