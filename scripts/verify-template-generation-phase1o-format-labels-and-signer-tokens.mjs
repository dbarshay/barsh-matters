import fs from "node:fs";

const page = fs.readFileSync("app/admin/document-templates/build/page.tsx", "utf8");
const library = fs.readFileSync("src/lib/templates/template-builder-merge-field-library.ts", "utf8");
const preview = fs.readFileSync("src/lib/templates/template-builder-live-example-preview.ts", "utf8");

const failures = [];

const formatArrayStart = library.indexOf("export const TEMPLATE_BUILDER_SUPPORTED_FORMAT_MODIFIERS");
const categoriesStart = library.indexOf("export const TEMPLATE_BUILDER_STARTING_CATEGORIES");
const canonicalStart = library.indexOf("export const TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS");
const formatArray = formatArrayStart >= 0 && categoriesStart > formatArrayStart ? library.slice(formatArrayStart, categoriesStart) : "";
const canonicalArray = canonicalStart >= 0 ? library.slice(canonicalStart) : "";

for (const token of [
  "{{signer.email}}",
  "{{signer.fax}}",
  "{{signer.extension}}",
  "{{signer.displayName}}",
  "{{signer.signatureName}}",
  "{{signer.title}}",
]) {
  if (formatArray.includes(token)) failures.push(`Signer token incorrectly remains in supported format modifiers: ${token}`);
  if (!canonicalArray.includes(token)) failures.push(`Signer token missing from canonical merge fields: ${token}`);
}

// The live preview emits every canonical merge field (signer tokens included) by iterating
// the canonical library through the single generation resolver — guaranteed by construction.
if (!preview.includes("for (const field of TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS)")) {
  failures.push("live preview no longer iterates the canonical merge fields (signer tokens not guaranteed in preview map)");
}

for (const required of [
  "| \"Signer\"",
  "{ id: \"signer\", label: \"Signer\" }",
  "category: \"Signer\"",
  "kind: \"canonical\"",
  "fieldType: \"text\"",
  "compatibleModifiers: TEXT_MODIFIERS",
]) {
  if (!library.includes(required)) failures.push(`missing Signer catalog requirement: ${required}`);
}

for (const forbidden of [
  "format-\" + formatIndex",
  "formatReactKey",
  "rawFormatValue",
  "rawFormatLabel",
  "key={format}",
  "key={formatValue || formatLabelText}",
  "selectedFormats.includes(format)",
  "toggleFormat(format)",
]) {
  if (page.includes(forbidden)) failures.push(`forbidden fragile/synthetic format UI snippet remains: ${forbidden}`);
}

for (const required of [
  "TEMPLATE_BUILDER_SUPPORTED_FORMAT_MODIFIERS.map((format) =>",
  "const formatValue = String(format).trim();",
  "const formatLabelText = formatLabel(formatValue);",
  "key={\"format-modifier-\" + formatValue}",
  "selectedFormats.includes(formatValue)",
  "onClick={() => toggleFormat(formatValue)}",
]) {
  if (!page.includes(required)) failures.push(`missing canonical string-only format UI snippet: ${required}`);
}

if (!page.includes("TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS")) failures.push("Build Template page no longer reads canonical merge fields");
if (!page.includes("data-template-merge-field-token={token}")) failures.push("Build Template page no longer exposes visible token data attribute for DOCX checker");

if (failures.length) {
  console.error("FAIL: Phase 1O catalog placement verifier failed");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("PASS: Phase 1O Signer tokens are canonical merge fields under Category=Signer, not format modifiers.");
console.log("PASS: Phase 1O format buttons render only canonical format modifier strings.");
