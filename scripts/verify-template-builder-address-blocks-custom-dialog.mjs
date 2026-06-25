import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const checks = [];

function has(name, text, needle) {
  if (!text.includes(needle)) throw new Error(name + " missing " + needle);
  checks.push(name + ": " + needle);
}

function lacks(name, text, needle) {
  if (text.includes(needle)) throw new Error(name + " still contains " + needle);
  checks.push(name + ": no " + needle);
}

const library = read("src/lib/templates/template-builder-merge-field-library.ts");
const preview = read("src/lib/templates/template-builder-live-example-preview.ts");
const build = read("app/admin/document-templates/build/page.tsx");

has("merge field library", library, "{{insurer.fullAddressBlock}}");
has("merge field library", library, "{{adversary.fullAddressBlock}}");
has("live preview resolver", preview, "{{insurer.fullAddressBlock}}");
has("live preview resolver", preview, "{{adversary.fullAddressBlock}}");
has("live preview resolver", preview, "function addressBlock(");
has("build ui", build, "TEMPLATE_BUILDER_CUSTOM_PLACEHOLDER_FIELDS");
has("build ui", build, "Add Custom Placeholder");
has("build ui", build, "custom-placeholder-title");
has("build ui", build, "customPlaceholderDialogOpen");

for (const forbidden of [
  "Category readiness",
  "Custom manual placeholder readiness",
  "Token scan readiness",
  "Ready for Create Template implementation",
  "Phase 3 locks the searchable merge-field library",
]) {
  lacks("build ui cleanliness", build, forbidden);
}

console.log("PASS: Template Builder address blocks and custom placeholder dialog verified (" + checks.length + " checks)");
