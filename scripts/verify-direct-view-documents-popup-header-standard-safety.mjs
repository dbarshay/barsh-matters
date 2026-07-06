import fs from "fs";

const page = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");
const failures = [];

const start = page.indexOf("function renderMatterViewDocumentsPopup()");
const end = page.indexOf("function directMatterDisplayNumberForDocumentActivity()", start);
const region = start >= 0 && end > start ? page.slice(start, end) : "";

if (!region) failures.push("could not isolate direct View Documents popup region");

for (const token of [
  'data-barsh-direct-view-documents-header-standard="true"',
  'aria-label="View Documents"',
  'View Documents',
  'gridTemplateColumns: "90px minmax(0, 1fr) 90px"',
  'background: "#00346e"',
  'borderBottom: "1px solid #00346e"',
  'color: "#ffffff"',
  'textAlign: "center"',
  'Close',
  'data-barsh-direct-view-documents-footer-actions="true"',
  'justifyContent: "flex-end"',
  'Refresh Documents',
  // The popup body is now the BM folder tree (Clio stays a flat vault; tree is BM metadata).
  'FolderTree',
]) {
  if (!region.includes(token)) failures.push("missing direct View Documents popup token: " + token);
}

for (const forbidden of [
  'No documents are currently listed in this Clio matter Documents tab.',
  'Matter:',
  'Clio Matter ID:',
  'background: "rgba(255,255,255,0.14)"',
  "Pick a document from this matter's Clio Documents tab.",
  'background: "#ffffff",\n              borderTopLeftRadius: 22',
  '<h2 style={{ margin: 0, fontSize: 22 }}>View Documents</h2>',
]) {
  if (region.includes(forbidden)) failures.push("direct View Documents popup still has old header token: " + forbidden);
}

if (failures.length) {
  console.error("FAIL: direct View Documents popup header standard safety");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("PASS: direct View Documents popup header standard safety");
