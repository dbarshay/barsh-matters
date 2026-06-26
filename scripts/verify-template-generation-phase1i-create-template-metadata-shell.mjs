import { existsSync, readFileSync } from "node:fs";

const component = "components/templates/CreateTemplateMetadataShell.tsx";
const buildPage = "app/admin/document-templates/build/page.tsx";
const phase1hContract = "src/lib/templates/template-contact-display-default-phase1h.ts";
const failures = [];

function read(path) {
  if (existsSync(path) === false) {
    failures.push("missing file: " + path);
    return "";
  }
  return readFileSync(path, "utf8");
}

const componentText = read(component);
const buildPageText = read(buildPage);
const contractText = read(phase1hContract);

const componentRequired = [
  "Create Template",
  "data-template-create-metadata-shell=\"phase1i\"",
  "Template display name",
  "Template category",
  "Default generation contact display",
  "Eligible signers remain selectable",
  "defaultContactDisplayMode",
  "TEMPLATE_CONTACT_DISPLAY_DEFAULT_OPTIONS_PHASE1H",
  "Metadata preview",
  "not implemented in Phase 1I",
  "does not save, import, upload, generate, print, or queue"
];

const buildPageRequired = [
  "CreateTemplateMetadataShell",
  "<CreateTemplateMetadataShell />",
  "TemplateDocxCompatibilityUpload"
];

const contractRequired = [
  "TemplateContactDisplayDefaultPhase1H = \"signer\" | \"firm\"",
  "TEMPLATE_CONTACT_DISPLAY_DEFAULT_OPTIONS_PHASE1H",
  "Signer contact",
  "Firm contact",
  "defaultContactDisplayMode",
  "eligibleSignerSelectorRemainsAvailable: true",
  "noClio: true",
  "noGraph: true",
  "noDocxMutation: true",
  "noDatabaseImport: true",
  "noPrintQueue: true"
];

const forbiddenComponentSnippets = [
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

for (const snippet of componentRequired) {
  if (componentText.includes(snippet) === false) failures.push("component missing snippet: " + snippet);
}

for (const snippet of buildPageRequired) {
  if (buildPageText.includes(snippet) === false) failures.push("build page missing snippet: " + snippet);
}

for (const snippet of contractRequired) {
  if (contractText.includes(snippet) === false) failures.push("Phase 1H contract missing snippet: " + snippet);
}

for (const snippet of forbiddenComponentSnippets) {
  if (componentText.includes(snippet)) failures.push("component contains forbidden runtime/write/external snippet: " + snippet);
}

if (failures.length > 0) {
  console.error("FAIL: Template Generation Phase 1I Create Template metadata shell verifier");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("PASS: Template Generation Phase 1I Create Template metadata shell verified");
