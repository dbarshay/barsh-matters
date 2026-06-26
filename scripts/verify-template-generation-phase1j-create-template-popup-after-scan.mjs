import { existsSync, readFileSync } from "node:fs";

const uploadComponent = "components/templates/TemplateDocxCompatibilityUpload.tsx";
const metadataShell = "components/templates/CreateTemplateMetadataShell.tsx";
const buildPage = "app/admin/document-templates/build/page.tsx";
const failures = [];

function read(path) {
  if (existsSync(path) === false) {
    failures.push("missing file: " + path);
    return "";
  }
  return readFileSync(path, "utf8");
}

const uploadText = read(uploadComponent);
const shellText = read(metadataShell);
const buildText = read(buildPage);

const uploadRequired = [
  "CreateTemplateMetadataShell",
  "showCreateTemplateModal",
  "scanResult.status === \"compatible\"",
  "setShowCreateTemplateModal(true)",
  "data-template-create-metadata-popup=\"phase1j\"",
  "Compatibility check passed",
  "<CreateTemplateMetadataShell />",
  "role=\"dialog\"",
  "aria-modal=\"true\""
];

const shellRequired = [
  "data-template-create-metadata-shell=\"phase1i\"",
  "Default generation contact display",
  "Eligible signers remain selectable",
  "defaultContactDisplayMode",
  "Metadata preview"
];

for (const snippet of uploadRequired) {
  if (uploadText.includes(snippet) === false) failures.push("upload component missing snippet: " + snippet);
}

for (const snippet of shellRequired) {
  if (shellText.includes(snippet) === false) failures.push("metadata shell missing snippet: " + snippet);
}

if (buildText.includes("<CreateTemplateMetadataShell />")) {
  failures.push("Build Template page should not render CreateTemplateMetadataShell directly; it belongs in the successful-scan popup");
}

if (buildText.includes("CreateTemplateMetadataShell from")) {
  failures.push("Build Template page should not import CreateTemplateMetadataShell directly");
}

const forbiddenUploadSnippets = [
  "fetch(",
  "axios",
  "FormData",
  "XMLHttpRequest",
  "/api/",
  "PrismaClient",
  "prisma.",
  "clio",
  "Clio",
  "Microsoft Graph",
  "graph.microsoft",
  "templates/inactive/"
];

for (const snippet of forbiddenUploadSnippets) {
  if (uploadText.includes(snippet)) failures.push("upload component contains forbidden runtime/write/external snippet: " + snippet);
}

if (failures.length > 0) {
  console.error("FAIL: Template Generation Phase 1J Create Template popup-after-scan verifier");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("PASS: Template Generation Phase 1J Create Template metadata popup opens after successful local DOCX scan");
