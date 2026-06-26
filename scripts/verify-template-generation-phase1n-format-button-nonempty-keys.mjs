import fs from "node:fs";

const pagePath = "app/admin/document-templates/build/page.tsx";
const page = fs.readFileSync(pagePath, "utf8");

const failures = [];

for (const forbidden of [
  "key={format}",
  "key={formatValue || formatLabelText}",
  "key={formatReactKey}",
  "selectedFormats.includes(format)",
  "toggleFormat(format)",
  "TEMPLATE_BUILDER_SUPPORTED_FORMAT_MODIFIERS.map((format, formatIndex) =>",
  "rawFormatValue",
  "rawFormatLabel",
  "formatReactKey",
  "format-\" + formatIndex",
]) {
  if (page.includes(forbidden)) failures.push(`fragile/synthetic format render snippet remains: ${forbidden}`);
}

for (const required of [
  "TEMPLATE_BUILDER_SUPPORTED_FORMAT_MODIFIERS.map((format) =>",
  "const formatValue = String(format).trim();",
  "const formatLabelText = formatLabel(formatValue);",
  "key={\"format-modifier-\" + formatValue}",
  "selectedFormats.includes(formatValue)",
  "onClick={() => toggleFormat(formatValue)}",
  "{checked ? \"✓ \" : \"\"}{formatLabelText}",
]) {
  if (!page.includes(required)) failures.push(`missing final nonempty format key snippet: ${required}`);
}

if (page.includes("<option key={category} value={category}>{category}</option>")) failures.push("raw category option key regression detected");
if (page.includes("key={category}")) failures.push("raw category key regression detected");

if (failures.length) {
  console.error("FAIL: Phase 1N nonempty format key verifier failed");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("PASS: Phase 1N verifier accepts final Phase 1O non-empty string format keys.");
