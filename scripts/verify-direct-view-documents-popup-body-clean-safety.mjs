import fs from "fs";

const page = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");
const failures = [];

const start = page.indexOf("function renderMatterViewDocumentsPopup()");
const end = page.indexOf("function directMatterDisplayNumberForDocumentActivity()", start);
const region = start >= 0 && end > start ? page.slice(start, end) : "";

if (!region) failures.push("could not isolate direct View Documents popup region");

for (const token of [
  'data-barsh-direct-view-documents-header-standard="true"',
  'data-barsh-direct-view-documents-footer-actions="true"',
  // Body is now the BM folder tree (documents organized by folder/title; Clio stays a flat vault).
  "FolderTree",
]) {
  if (!region.includes(token)) failures.push("missing direct View Documents clean body token: " + token);
}

for (const forbidden of [
  "Document opening/viewing will be wired to a safe Clio retrieval route next.",
  "This step only lists and selects document metadata.",
  "<strong>Clio Document ID:</strong>",
  "<strong>Version UUID:</strong>",
  "<strong>Fully Uploaded:</strong>",
]) {
  if (region.includes(forbidden)) failures.push("direct View Documents popup still has placeholder/debug token: " + forbidden);
}

if (failures.length) {
  console.error("FAIL: direct View Documents popup body clean safety");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("PASS: direct View Documents popup body clean safety");
