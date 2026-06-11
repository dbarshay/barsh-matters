import fs from "node:fs";

const pagePath = "app/matter/[id]/page.tsx";
const page = fs.readFileSync(pagePath, "utf8");

let failures = 0;

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

function mustContain(label, needle) {
  if (page.includes(needle)) pass(`${pagePath}: found ${label}`);
  else fail(`${pagePath}: missing ${label}`);
}

function mustNotContain(label, needle) {
  if (!page.includes(needle)) pass(`${pagePath}: contains no ${label}`);
  else fail(`${pagePath}: contains forbidden ${label}`);
}

console.log("=== DIRECT DOCUMENT GENERATION ACTION BUTTON SAFETY VERIFICATION ===");

mustContain("Document Generation action label", "Document Generation");
mustContain("document generation launcher", "launchMatterDocumentGenerationDialog");
mustContain("document generation popup state", "matterDocumentGenerationPopupOpen");
mustContain("document generation popup renderer", "renderMatterDocumentGenerationPopup");
mustContain("direct popup title", "Direct Matter Document Generation");
mustContain("direct popup action title", "Open the Direct Matter document generation preview popup.");
mustContain("direct preview loader", "loadMatterDocumentDataPreview");
mustContain("direct preview panel reuse", "renderMatterDocumentDataPreviewPanel");
mustContain("Refresh Data button", "Refresh Data");
mustContain("Direct matter packet endpoint", "/api/documents/matter-packet");
mustContain("direct popup renderer", "renderMatterDocumentGenerationPopup");

mustNotContain("old direct placeholder title", "View Documents action will be wired later.");
mustNotContain("old direct action title", "Launch the Direct Matter document generation preview.");
mustNotContain("matter-context dependency", "matter-context");
mustNotContain("direct Clio write action", "loadMatterDocumentDataPreviewToClio");

if (failures > 0) {
  console.error(`=== DIRECT DOCUMENT GENERATION ACTION BUTTON SAFETY VERIFICATION FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== DIRECT DOCUMENT GENERATION ACTION BUTTON SAFETY VERIFICATION PASSED ===");
