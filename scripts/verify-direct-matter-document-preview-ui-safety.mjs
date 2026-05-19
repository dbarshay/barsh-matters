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
  if (!page.includes(needle)) pass(`${pagePath}: does not contain ${label}`);
  else fail(`${pagePath}: contains forbidden ${label}`);
}

console.log("=== DIRECT MATTER DOCUMENT DATA PREVIEW UI SAFETY VERIFICATION ===");

mustContain("matter preview loading state", "matterDocumentDataPreviewLoading");
mustContain("matter preview result state", "matterDocumentDataPreview");
mustContain("matter preview loader", "loadMatterDocumentDataPreview");
mustContain("matter preview renderer", "renderMatterDocumentDataPreviewPanel");
mustContain("direct matter packet endpoint", "/api/documents/matter-packet");
mustContain("preview button", "Preview Matter Data");
mustContain("templateFields JSON details", "Raw templateFields JSON");
mustContain("referenceData JSON details", "Raw referenceData JSON");
mustContain("documents section renderer", "{renderMatterDocumentDataPreviewPanel()}");
mustContain("explicit no generation language", "It does not generate documents, upload documents, write to Clio, or change the print queue.");

mustNotContain("preview route using matter-context", "matter-context");
mustNotContain("preview action writing to Clio", "loadMatterDocumentDataPreviewToClio");

if (failures > 0) {
  console.error(`=== DIRECT MATTER DOCUMENT DATA PREVIEW UI SAFETY VERIFICATION FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== DIRECT MATTER DOCUMENT DATA PREVIEW UI SAFETY VERIFICATION PASSED ===");
