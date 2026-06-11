import fs from "node:fs";

const directPath = "app/matter/[id]/page.tsx";
const masterPath = "app/matters/page.tsx";
const direct = fs.readFileSync(directPath, "utf8");
const master = fs.readFileSync(masterPath, "utf8");

let failures = 0;

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

function mustContain(source, sourceName, label, needle) {
  if (source.includes(needle)) pass(`${sourceName}: found ${label}`);
  else fail(`${sourceName}: missing ${label}`);
}

function mustNotContain(source, sourceName, label, needle) {
  if (!source.includes(needle)) pass(`${sourceName}: does not contain ${label}`);
  else fail(`${sourceName}: contains forbidden ${label}`);
}

console.log("=== DOCUMENT GENERATION ACTION POPUP SAFETY VERIFICATION ===");

mustContain(direct, directPath, "direct launcher", "launchMatterDocumentGenerationDialog");
mustContain(direct, directPath, "direct popup state", "matterDocumentGenerationPopupOpen");
mustContain(direct, directPath, "direct popup renderer", "renderMatterDocumentGenerationPopup");
mustContain(direct, directPath, "direct popup title", "Direct Matter Document Generation");
mustContain(direct, directPath, "direct action title", "Open the Direct Matter document generation preview popup.");
mustContain(direct, directPath, "direct preview loader", "loadMatterDocumentDataPreview");
mustContain(direct, directPath, "direct preview panel reuse", "renderMatterDocumentDataPreviewPanel");
mustContain(direct, directPath, "direct popup renderer", "renderMatterDocumentGenerationPopup");
mustContain(direct, directPath, "Document Generation label", "Document Generation");

mustContain(master, masterPath, "master launcher", "launchMasterDocumentGenerationDialog");
mustContain(master, masterPath, "master popup state", "masterDocumentGenerationPopupOpen");
mustContain(master, masterPath, "master popup renderer", "renderMasterDocumentGenerationPopup");
mustContain(master, masterPath, "master popup title", "Master Lawsuit Document Generation");
mustContain(master, masterPath, "master action title", "Open the Master Lawsuit document generation preview popup.");
mustContain(master, masterPath, "master preview loader", "loadMasterDocumentDataPreview");
mustContain(master, masterPath, "master preview panel reuse", "renderMasterDocumentDataPreviewPanel");
mustContain(master, masterPath, "master popup renderer", "renderMasterDocumentGenerationPopup");
mustContain(master, masterPath, "Document Generation label", "Document Generation");

mustNotContain(direct, directPath, "old direct popup title", "Launch the Direct Matter document generation preview.");
mustNotContain(master, masterPath, "old master popup title", "Launch the Master Lawsuit document generation preview.");
mustNotContain(direct, directPath, "matter-context dependency", "matter-context");
mustNotContain(master, masterPath, "matter-context dependency", "matter-context");
mustNotContain(direct, directPath, "direct Clio write action", "loadMatterDocumentDataPreviewToClio");
mustNotContain(master, masterPath, "master Clio write action", "loadMasterDocumentDataPreviewToClio");

if (failures > 0) {
  console.error(`=== DOCUMENT GENERATION ACTION POPUP SAFETY VERIFICATION FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== DOCUMENT GENERATION ACTION POPUP SAFETY VERIFICATION PASSED ===");
