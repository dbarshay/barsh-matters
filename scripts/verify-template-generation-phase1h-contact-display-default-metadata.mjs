import { existsSync, readFileSync } from "node:fs";

const docs = "docs/templates/template-generation-phase1h-contact-display-default-metadata.md";
const contract = "src/lib/templates/template-contact-display-default-phase1h.ts";
const failures = [];

function read(path) {
  if (existsSync(path) === false) {
    failures.push("missing file: " + path);
    return "";
  }
  return readFileSync(path, "utf8");
}

const docText = read(docs);
const contractText = read(contract);

const docRequired = [
  "TemplateContactDisplayDefault = \"signer\" | \"firm\"",
  "defaultContactDisplayMode",
  "selected signer defaults to the signed-in generating user",
  "any other eligible signer",
  "Other eligible signers remain available",
  "{{signer.email}}",
  "{{signer.fax}}",
  "{{signer.extension}}",
  "{{signer.*}} tokens always resolve from the selected signer",
  "does not mutate any DOCX file",
  "does not import a DOCX into the database",
  "upload to Clio",
  "call Microsoft Graph",
  "print or queue documents"
];

const contractRequired = [
  "TemplateContactDisplayDefaultPhase1H = \"signer\" | \"firm\"",
  "TEMPLATE_CONTACT_DISPLAY_DEFAULT_OPTIONS_PHASE1H",
  "defaultContactDisplayMode",
  "normalizeTemplateContactDisplayDefaultPhase1H",
  "eligibleSignerSelectorRemainsAvailable: true",
  "noClio: true",
  "noGraph: true",
  "noDocxMutation: true",
  "noDatabaseImport: true",
  "noPrintQueue: true"
];

for (const snippet of docRequired) {
  if (docText.includes(snippet) === false) failures.push("doc missing snippet: " + snippet);
}

for (const snippet of contractRequired) {
  if (contractText.includes(snippet) === false) failures.push("contract missing snippet: " + snippet);
}

const forbiddenRuntimeSnippets = [
  "fetch(",
  "FormData",
  "XMLHttpRequest",
  "PrismaClient",
  "prisma.",
  "graph.microsoft",
  "CLIO_",
  "clio/oauth"
];

for (const snippet of forbiddenRuntimeSnippets) {
  if (contractText.includes(snippet)) failures.push("contract contains forbidden runtime/write/external snippet: " + snippet);
}

if (failures.length > 0) {
  console.error("FAIL: Template Generation Phase 1H contact-display default metadata verifier");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("PASS: Template Generation Phase 1H contact-display default metadata verified");
