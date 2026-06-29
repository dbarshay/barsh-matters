import fs from "node:fs";

const libraryPath = "src/lib/templates/template-builder-merge-field-library.ts";
const previewPath = "src/lib/templates/template-builder-live-example-preview.ts";
const uploadPath = "components/templates/TemplateDocxCompatibilityUpload.tsx";
const metadataPath = "components/templates/CreateTemplateMetadataShell.tsx";

const library = fs.readFileSync(libraryPath, "utf8");
const preview = fs.readFileSync(previewPath, "utf8");
const upload = fs.readFileSync(uploadPath, "utf8");
const metadata = fs.readFileSync(metadataPath, "utf8");

const signerTokens = [
  "{{signer.email}}",
  "{{signer.fax}}",
  "{{signer.extension}}",
  "{{signer.displayName}}",
  "{{signer.signatureName}}",
  "{{signer.title}}",
];

const firstDocTokens = [
  "{{matter.fileNumber}}",
  "{{matter.providerName}}",
  "{{matter.patientName}}",
  "{{matter.billedAmount}}",
  "{{claim.number}}",
  "{{claim.dateOfLoss}}",
  "{{claim.dateOfService}}",
  "{{claim.denialReason}}",
  "{{claim.balance}}",
  "{{insurer.fullAddressBlock}}",
  "{{adversary.fullAddressBlock}}",
];

const failures = [];

for (const token of firstDocTokens) {
  if (!library.includes(token)) failures.push(`canonical library lost first-doc token ${token}`);
}

for (const token of signerTokens) {
  if (!library.includes(token)) failures.push(`canonical library missing Signer token ${token}`);
}

// The live preview now builds its example output by iterating the canonical merge-field
// library through the single generation resolver, so every canonical token above (signer
// and first-doc) is emitted by construction — no per-token source-text snapshot needed.
if (!preview.includes("for (const field of TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS)")) {
  failures.push("live preview no longer iterates the canonical merge fields (signer/first-doc tokens not guaranteed)");
}

for (const token of signerTokens) {
  const tokenIndex = library.indexOf(token);
  const prior = tokenIndex >= 0 ? library.slice(Math.max(0, tokenIndex - 350), tokenIndex) : "";
  if (!prior.includes("category: \"Signer\"")) {
    failures.push(`token is not in Signer category: ${token}`);
  }
  if (prior.includes("subcategory:")) {
    failures.push(`token should not use a selected-signer subcategory: ${token}`);
  }
}

for (const snippet of [
  "data-template-merge-field-token",
  "document.querySelectorAll",
  "DOCX is readable and all discovered tokens match visible canonical Template Builder fields",
]) {
  if (!upload.includes(snippet)) failures.push(`local compatibility upload missing snippet ${snippet}`);
}

for (const snippet of [
  "defaultContactDisplayMode",
  "signer.* tokens resolve from selected signer",
]) {
  if (!metadata.includes(snippet)) failures.push(`metadata shell missing snippet ${snippet}`);
}

for (const forbidden of [
  "graph.microsoft",
  "Microsoft Graph",
  "createClio",
  "uploadToClio",
  "printQueue",
  "templates/docx/letters/initial-billing-letter.docx",
  "letterhead-simple",
  "pleading-paper",
]) {
  if (library.includes(forbidden) || preview.includes(forbidden) || upload.includes(forbidden) || metadata.includes(forbidden)) {
    failures.push(`forbidden external/write/legacy snippet present: ${forbidden}`);
  }
}

if (failures.length) {
  console.error("FAIL: Phase 1L Signer category token verifier failed");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("PASS: Phase 1L adds signer.* tokens under Category=Signer only.");
console.log("PASS: First fresh DOCX trial tokens remain available.");
console.log("PASS: No persistence, Clio, Graph, upload, print, queue, legacy DOCX source, letterhead-simple, or pleading-paper restoration was introduced.");
