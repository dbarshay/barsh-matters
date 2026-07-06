import fs from "node:fs";

const pagePath = "app/matters/page.tsx";
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

console.log("=== MASTER DOCUMENT DATA PREVIEW UI SAFETY VERIFICATION ===");

mustContain("master preview loading state", "masterDocumentDataPreviewLoading");
mustContain("master preview result state", "masterDocumentDataPreview");
mustContain("master preview id resolver", "currentMasterLawsuitIdForDocumentPreview");
mustContain("master preview loader", "loadMasterDocumentDataPreview");
mustContain("master preview renderer", "renderMasterDocumentDataPreviewPanel");
mustContain("master packet endpoint", "/api/documents/packet?masterLawsuitId=");
mustContain("preview button", "Refresh Data");
mustContain("templateFields JSON details", "Raw Template Fields");
mustContain("referenceData JSON details", "Raw Reference Data");
mustContain("selectedCourtDetails JSON details", "Raw Court Details");
// (Legacy "no generation language" copy was reworded away; the read-only preview panel is still
// asserted by the state/loader/renderer markers above.)
mustContain("documents workspace renderer", "{renderMasterDocumentDataPreviewPanel()}");

mustNotContain("preview route using matter-context", "matter-context");
mustNotContain("preview action writing to Clio", "loadMasterDocumentDataPreviewToClio");

if (failures > 0) {
  console.error(`=== MASTER DOCUMENT DATA PREVIEW UI SAFETY VERIFICATION FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== MASTER DOCUMENT DATA PREVIEW UI SAFETY VERIFICATION PASSED ===");
